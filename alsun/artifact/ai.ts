/**
 * الذكاء الاصطناعي في نسخة claude.ai: Claude عبر قدرة sample بدل Gemini.
 * الدوال بنفس توقيعات src/server/ai.ts لتعمل مسارات الـ API كما هي.
 */
import { eq } from "drizzle-orm";
import { db, ready, schema as s } from "./db";
import { cap } from "./claude";
import type { LangCode } from "@/content";

export class AiDisabledError extends Error {
  constructor() {
    super("الذكاء الاصطناعي غير متاح في هذا العرض");
  }
}

const LANG_NAMES: Record<LangCode, string> = { en: "English", fr: "French", es: "Spanish", zh: "Mandarin Chinese" };
const TEACHER = `You are an expert applied linguist designing lessons for a native Arabic speaker (a law student).
All explanations, meanings and notes MUST be in clear Modern Standard Arabic. Be level-appropriate (CEFR / HSK 3.0). Never invent fake words.`;

type Sample = ((input: unknown, opts?: unknown) => Promise<{ text: string }>) & { json<T>(input: unknown, opts?: unknown): Promise<T> };
async function sample(): Promise<Sample> {
  const smp = await cap<Sample>("sample");
  if (!smp) throw new AiDisabledError();
  return smp;
}
async function json<T>(prompt: string, shape: string, tier: "quick" | "default" = "default"): Promise<T> {
  const smp = await sample();
  return smp.json<T>(`${TEACHER}\n\n${prompt}\n\nReply with ONLY JSON of this exact shape:\n${shape}`, { modelTier: tier });
}

export const aiEnabled = () => true;
export async function aiSettings() {
  return { textModel: "Claude", liveModel: "Claude", ttsModel: "browser", voice: "Kore" };
}
export async function listModels() {
  return [] as { name: string; actions: string[] }[];
}

async function cached<T>(key: string, make: () => Promise<T>): Promise<T> {
  await ready();
  const [hit] = await db.select().from(s.aiCache).where(eq(s.aiCache.key, key));
  if (hit) return hit.payload as T;
  const v = await make();
  await db.insert(s.aiCache).values({ key, payload: v, createdAt: Date.now() }).onConflictDoUpdate({ target: s.aiCache.key, set: { payload: v } });
  return v;
}

const ITEM = `{"text": string (target language; for Chinese: Hanzi with spaces between words), "ar": string (Arabic meaning), "reading": string (pinyin with tone marks for Chinese, else approximate pronunciation in Arabic letters)}`;

export interface AiLesson {
  vocab: { text: string; ar: string; reading: string }[];
  phrases: { text: string; ar: string; reading: string }[];
  grammar: { title: string; body: string[]; examples: { text: string; ar: string }[]; arabicBridge: string };
}

export async function generateLesson(o: { lang: LangCode; lessonId: string; level: string; topic: string; grammar?: string; title: string; known: string[]; regenerate?: boolean }): Promise<AiLesson> {
  const key = `lesson:${o.lessonId}`;
  if (o.regenerate) await db.delete(s.aiCache).where(eq(s.aiCache.key, key));
  return cached(key, async () => {
    const r = await json<AiLesson>(
      `Create a ${LANG_NAMES[o.lang]} lesson for level ${o.level}. Lesson: "${o.title}" — topic: "${o.topic}" — grammar focus: "${o.grammar ?? "review"}".
Learner already knows (reuse some in phrases, don't repeat as new vocab): ${o.known.slice(-100).join(", ")}.
Give 8-10 NEW high-frequency vocabulary items, 6 short natural phrases using the grammar focus (rebuildable word by word), and a concise Arabic grammar explanation (2-4 short paragraphs) with 2-3 examples and an "arabicBridge" comparing it to Arabic.`,
      `{"vocab": [${ITEM}], "phrases": [${ITEM}], "grammar": {"title": string, "body": [string], "examples": [{"text": string, "ar": string}], "arabicBridge": string}}`,
    );
    if (!Array.isArray(r?.vocab) || !Array.isArray(r?.phrases) || !r.grammar) throw new Error("ردّ غير مكتمل، أعد المحاولة");
    return r;
  });
}

export async function contextSentences(lang: LangCode, level: string, words: string[], n = 5) {
  return json<{ sentences: { text: string; ar: string; reading: string }[] }>(
    `Write ${n} short, varied, natural ${LANG_NAMES[lang]} sentences for level ${level} using mostly these known words: ${words.join(", ")}. Each 3-8 words, a different real-life context each. For Chinese put spaces between words.`,
    `{"sentences": [${ITEM}]}`,
    "quick",
  );
}

export async function explainMistake(lang: LangCode, prompt: string, given: string, correct: string) {
  return json<{ explanation: string; tip: string }>(
    `Learner of ${LANG_NAMES[lang]} answered "${given}" but the correct answer is "${correct}" (exercise: ${prompt}). Explain briefly in Arabic WHY (1-3 sentences), and give one memorable tip.`,
    `{"explanation": string, "tip": string}`,
    "quick",
  );
}

export interface PronunciationResult {
  score: number;
  heard: string;
  verdict: string;
  words: { word: string; score: number; issue: string }[];
  tones?: { syllable: string; expected: number; heard: number }[];
  tip: string;
}
export async function assessPronunciation(): Promise<PronunciationResult> {
  throw new Error("تقييم التسجيل الصوتي غير متاح هنا؛ يُستعمل الإملاء الصوتي بدلاً منه");
}

export async function liveToken(): Promise<never> {
  throw new Error("غير مستعمل في هذه النسخة");
}

/** رد الشريك في المحادثة (دور واحد) */
export async function conversationReply(lang: LangCode, level: string, role: string, goal: string, known: string[], turns: { role: "user" | "ai"; text: string }[]) {
  const smp = await sample();
  const beginner = /^(FOUNDATION|A1|A2|HSK[123])$/.test(level);
  const sys = `You are role-playing as ${role} in a spoken ${LANG_NAMES[lang]} practice. The learner is a native Arabic speaker at level ${level}. Learner's goal: ${goal}.
Rules: reply ONLY with what you say aloud, in ${LANG_NAMES[lang]} ${beginner ? "using very short simple sentences (max 8 words), preferring these known words: " + known.slice(-60).join(", ") : "at the learner's level"}. 1-3 sentences, end with a question. If the learner made a mistake, naturally recast the correct form first. If they wrote Arabic or seem stuck, add a one-line Arabic hint in parentheses. No stage directions, no translations otherwise.${turns.length ? "" : " Start now with a greeting that opens the scenario."}`;
  const msgs: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: sys }];
  for (const t of turns.slice(-16)) msgs.push({ role: t.role === "user" ? "user" : "assistant", content: t.text });
  if (msgs[msgs.length - 1].role !== "user") msgs.push({ role: "user", content: "(continue)" });
  const r = await smp(msgs, { modelTier: "quick", cache: false });
  return r.text.trim();
}

export async function conversationFeedback(lang: LangCode, level: string, transcript: { role: string; text: string }[]) {
  return json<{ score: number; summary: string; strengths: string[]; corrections: { said: string; better: string; why: string }[]; newWords: { text: string; ar: string; reading: string }[] }>(
    `Review this spoken ${LANG_NAMES[lang]} practice (learner level ${level}). Transcript:
${transcript.map((t) => `${t.role === "user" ? "LEARNER" : "PARTNER"}: ${t.text}`).join("\n")}
Give: score 0-100 relative to level, 2-sentence Arabic summary, up to 3 strengths (Arabic), up to 6 corrections of the learner's actual utterances (why in Arabic), up to 6 useful words to save.`,
    `{"score": number, "summary": string, "strengths": [string], "corrections": [{"said": string, "better": string, "why": string}], "newWords": [${ITEM}]}`,
  );
}

export async function tts(): Promise<never> {
  throw new Error("غير مستعمل في هذه النسخة");
}
export function courseLevelName(_l: LangCode, code: string) {
  return code;
}
