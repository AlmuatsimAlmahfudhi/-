import "server-only";
import { GoogleGenAI, Modality } from "@google/genai";
import { eq } from "drizzle-orm";
import { db, ready, schema as s } from "@/db";
import { getCourse, type LangCode } from "@/content";
import { SCENARIOS } from "@/content/scenarios";

// ───────────── الإعداد ─────────────

export interface AiSettings {
  textModel: string;
  liveModel: string;
  ttsModel: string;
  voice: string;
}

export async function aiSettings(): Promise<AiSettings> {
  await ready();
  const [p] = await db.select().from(s.profile).where(eq(s.profile.id, 1));
  const st = (p?.settings ?? {}) as Partial<AiSettings>;
  return {
    textModel: st.textModel || process.env.GEMINI_TEXT_MODEL || "gemini-flash-latest",
    liveModel: st.liveModel || process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-preview-09-2025",
    ttsModel: st.ttsModel || process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts",
    voice: st.voice || "Kore",
  };
}

export const aiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

let client: GoogleGenAI | null = null;
function ai(apiVersion?: string) {
  if (!process.env.GEMINI_API_KEY) throw new AiDisabledError();
  if (apiVersion) return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion } });
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export class AiDisabledError extends Error {
  constructor() {
    super("لم يُضبط مفتاح GEMINI_API_KEY في ملف ‎.env.local");
  }
}

const LANG_NAMES: Record<LangCode, string> = { en: "English", fr: "French", es: "Spanish", zh: "Mandarin Chinese" };

async function json<T>(prompt: string, schema: object, system?: string): Promise<T> {
  const { textModel } = await aiSettings();
  const res = await ai().models.generateContent({
    model: textModel,
    contents: prompt,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      temperature: 0.7,
    },
  });
  return JSON.parse(res.text ?? "{}") as T;
}

async function cached<T>(key: string, make: () => Promise<T>): Promise<T> {
  await ready();
  const [hit] = await db.select().from(s.aiCache).where(eq(s.aiCache.key, key));
  if (hit) return hit.payload as T;
  const v = await make();
  await db.insert(s.aiCache).values({ key, payload: v, createdAt: Date.now() }).onConflictDoUpdate({ target: s.aiCache.key, set: { payload: v } });
  return v;
}

const TEACHER_SYSTEM = `You are an expert applied linguist designing lessons for a native Arabic speaker (Omani law student).
All explanations, meanings and notes MUST be in clear Modern Standard Arabic.
Be pedagogically precise and level-appropriate (CEFR or HSK 3.0). Never invent fake words.`;

// ───────────── توليد الدروس (الجزء الديناميكي من المنهج) ─────────────

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string", description: "Target language text. For Chinese: Hanzi with spaces between words." },
    ar: { type: "string", description: "Arabic meaning" },
    reading: { type: "string", description: "Pinyin with tone marks for Chinese; approximate pronunciation in Arabic letters otherwise" },
  },
  required: ["text", "ar", "reading"],
};

export interface AiLesson {
  vocab: { text: string; ar: string; reading: string }[];
  phrases: { text: string; ar: string; reading: string }[];
  grammar: { title: string; body: string[]; examples: { text: string; ar: string }[]; arabicBridge: string };
}

export async function generateLesson(opts: {
  lang: LangCode;
  lessonId: string;
  level: string;
  topic: string;
  grammar?: string;
  title: string;
  known: string[];
  regenerate?: boolean;
}): Promise<AiLesson> {
  const key = `lesson:${opts.lessonId}`;
  if (opts.regenerate) await db.delete(s.aiCache).where(eq(s.aiCache.key, key));
  return cached(key, () =>
    json<AiLesson>(
      `Create a ${LANG_NAMES[opts.lang]} lesson for level ${opts.level}.
Lesson: "${opts.title}" — topic: "${opts.topic}" — grammar focus: "${opts.grammar ?? "review"}".
The learner already knows these words (reuse some in phrases, do NOT repeat them as new vocab): ${opts.known.slice(-120).join(", ")}.
Return 8-10 NEW high-frequency vocabulary items for this level and topic, 6 natural example sentences/phrases (short enough to rebuild word by word, using the grammar focus), and a concise Arabic grammar explanation (2-4 short paragraphs) with 2-3 examples and an "arabicBridge" comparing it to Arabic.`,
      {
        type: "object",
        properties: {
          vocab: { type: "array", items: ITEM_SCHEMA },
          phrases: { type: "array", items: ITEM_SCHEMA },
          grammar: {
            type: "object",
            properties: {
              title: { type: "string" },
              body: { type: "array", items: { type: "string" } },
              examples: { type: "array", items: { type: "object", properties: { text: { type: "string" }, ar: { type: "string" } }, required: ["text", "ar"] } },
              arabicBridge: { type: "string" },
            },
            required: ["title", "body", "examples", "arabicBridge"],
          },
        },
        required: ["vocab", "phrases", "grammar"],
      },
      TEACHER_SYSTEM,
    ),
  );
}

/** جمل جديدة في سياقات متنوعة مبنية من مفردات المتعلم (بناء الجمل الديناميكي) */
export async function contextSentences(lang: LangCode, level: string, words: string[], n = 5) {
  return json<{ sentences: { text: string; ar: string; reading: string }[] }>(
    `Write ${n} short, varied, natural ${LANG_NAMES[lang]} sentences for level ${level} using mostly these known words: ${words.join(", ")}.
Each sentence 3-8 words, a different real-life context each time. For Chinese put spaces between words.`,
    { type: "object", properties: { sentences: { type: "array", items: ITEM_SCHEMA } }, required: ["sentences"] },
    TEACHER_SYSTEM,
  );
}

// ───────────── شرح الأخطاء ─────────────

export async function explainMistake(lang: LangCode, prompt: string, given: string, correct: string) {
  return json<{ explanation: string; tip: string }>(
    `Learner of ${LANG_NAMES[lang]} answered "${given}" but the correct answer is "${correct}" (exercise: ${prompt}).
Explain briefly in Arabic WHY (1-3 sentences), and give one memorable tip.`,
    { type: "object", properties: { explanation: { type: "string" }, tip: { type: "string" } }, required: ["explanation", "tip"] },
    TEACHER_SYSTEM,
  );
}

// ───────────── تقييم النطق ─────────────

export interface PronunciationResult {
  score: number;
  heard: string;
  verdict: string;
  words: { word: string; score: number; issue: string }[];
  tones?: { syllable: string; expected: number; heard: number }[];
  tip: string;
}

export async function assessPronunciation(lang: LangCode, target: string, reading: string | undefined, audioB64: string, mime: string) {
  const { textModel } = await aiSettings();
  const zh = lang === "zh";
  const res = await ai().models.generateContent({
    model: textModel,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: audioB64, mimeType: mime } },
          {
            text: `You are a strict but kind ${LANG_NAMES[lang]} pronunciation examiner for an Arabic speaker.
Target: "${target}"${reading ? ` (${reading})` : ""}.
Listen to the recording and assess accuracy of each word/syllable${zh ? " and EACH TONE (1-4, 5=neutral)" : ""}.
Score 0-100 (90+ native-like, 70-89 clear with minor errors, 50-69 understandable, <50 unclear or wrong).
If the audio is silent or a different phrase, score below 20.
All feedback (verdict, issue, tip) in Arabic. Mention typical Arabic-speaker issues (p/b, v/f, vowels${zh ? ", tones" : ""}) when relevant.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
      responseJsonSchema: {
        type: "object",
        properties: {
          score: { type: "integer" },
          heard: { type: "string", description: "What you actually heard (transcription)" },
          verdict: { type: "string" },
          words: {
            type: "array",
            items: { type: "object", properties: { word: { type: "string" }, score: { type: "integer" }, issue: { type: "string" } }, required: ["word", "score", "issue"] },
          },
          ...(zh
            ? {
                tones: {
                  type: "array",
                  items: { type: "object", properties: { syllable: { type: "string" }, expected: { type: "integer" }, heard: { type: "integer" } }, required: ["syllable", "expected", "heard"] },
                },
              }
            : {}),
          tip: { type: "string" },
        },
        required: ["score", "heard", "verdict", "words", "tip"],
      },
    },
  });
  return JSON.parse(res.text ?? "{}") as PronunciationResult;
}

// ───────────── المحادثة الصوتية الحية (Gemini Live) ─────────────

function conversationSystem(lang: LangCode, level: string, scenarioId: string, knownWords: string[]) {
  const sc = SCENARIOS.find((x) => x.id === scenarioId) ?? SCENARIOS[0];
  const beginner = /^(FOUNDATION|A1|A2|HSK[123])$/.test(level);
  return `You are role-playing as ${sc.role} in a spoken ${LANG_NAMES[lang]} practice session.
The learner is a native Arabic speaker at level ${level}. Scenario goal for the learner: ${sc.goal}.
Rules:
- Speak ${LANG_NAMES[lang]} ${beginner ? "VERY slowly and simply, short sentences (max 8 words), prefer these known words: " + knownWords.slice(-80).join(", ") : "naturally at the learner's level"}.
- Keep each turn short (1-3 sentences) and always end with a question or prompt so the learner keeps speaking.
- If the learner makes a pronunciation or grammar mistake, briefly recast the correct form naturally, then continue.
- If the learner speaks Arabic or seems stuck, give a one-line hint in Arabic, then repeat your line in ${LANG_NAMES[lang]}.
- Start the conversation yourself with a greeting appropriate to the scenario.`;
}

/** رمز مؤقت للمتصفح؛ المفتاح الحقيقي لا يغادر الخادم أبداً */
export async function liveToken(lang: LangCode, level: string, scenarioId: string, knownWords: string[]) {
  const { liveModel, voice } = await aiSettings();
  const expire = new Date(Date.now() + 30 * 60_000).toISOString();
  const token = await ai("v1alpha").authTokens.create({
    config: {
      uses: 1,
      expireTime: expire,
      newSessionExpireTime: new Date(Date.now() + 2 * 60_000).toISOString(),
      httpOptions: { apiVersion: "v1alpha" },
    },
  });
  return {
    token: token.name!,
    model: liveModel,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: conversationSystem(lang, level, scenarioId, knownWords),
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };
}

export async function conversationFeedback(lang: LangCode, level: string, transcript: { role: string; text: string }[]) {
  return json<{
    score: number;
    summary: string;
    strengths: string[];
    corrections: { said: string; better: string; why: string }[];
    newWords: { text: string; ar: string; reading: string }[];
  }>(
    `Review this spoken ${LANG_NAMES[lang]} practice (learner level ${level}). Transcript:
${transcript.map((t) => `${t.role === "user" ? "LEARNER" : "PARTNER"}: ${t.text}`).join("\n")}
Give: overall score 0-100 for the learner's performance relative to level, a 2-sentence Arabic summary, up to 3 strengths (Arabic),
up to 6 corrections of the learner's actual utterances (said / better / why in Arabic), and up to 6 useful words from the conversation the learner should save.`,
    {
      type: "object",
      properties: {
        score: { type: "integer" },
        summary: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        corrections: { type: "array", items: { type: "object", properties: { said: { type: "string" }, better: { type: "string" }, why: { type: "string" } }, required: ["said", "better", "why"] } },
        newWords: { type: "array", items: ITEM_SCHEMA },
      },
      required: ["score", "summary", "strengths", "corrections", "newWords"],
    },
    TEACHER_SYSTEM,
  );
}

// ───────────── تحويل النص إلى كلام بجودة عالية ─────────────

export async function tts(lang: LangCode, text: string): Promise<Buffer> {
  const { ttsModel, voice } = await aiSettings();
  const res = await ai().models.generateContent({
    model: ttsModel,
    contents: [{ parts: [{ text: `Say clearly and slowly in ${LANG_NAMES[lang]}, like a language teacher: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  });
  const b64 = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!b64) throw new Error("لم يُرجع النموذج صوتاً");
  return pcmToWav(Buffer.from(b64, "base64"), 24000);
}

function pcmToWav(pcm: Buffer, rate: number) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** قائمة النماذج المتاحة لمفتاحك (لصفحة الإعدادات) */
export async function listModels() {
  const pager = await ai().models.list({ config: { pageSize: 200 } });
  const out: { name: string; actions: string[] }[] = [];
  for await (const m of pager) out.push({ name: (m.name ?? "").replace(/^models\//, ""), actions: m.supportedActions ?? [] });
  return out;
}

export function courseLevelName(lang: LangCode, code: string) {
  const c = getCourse(lang);
  return [c.foundation, ...c.levels].find((l) => l.code === code)?.title ?? code;
}
