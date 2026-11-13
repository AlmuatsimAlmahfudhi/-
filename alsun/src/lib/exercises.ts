/**
 * محرك توليد التمارين — يعمل محلياً بلا إنترنت انطلاقاً من عناصر الدرس.
 * المحتوى المولَّد بالذكاء الاصطناعي يُحوَّل إلى عناصر Item ثم يمر بالمحرك نفسه.
 */
import { display, tokens, type Item, type LangCode, type LessonKind } from "@/content";
import type { Attribute } from "./game-rules";

export type Exercise =
  | { id: string; kind: "intro"; item: Item; attr: Attribute }
  | {
      id: string;
      kind: "choice";
      mode: "meaning" | "reverse" | "listen" | "letter";
      item: Item;
      question: string;
      options: { label: string; sub?: string; ltr: boolean }[];
      answer: number;
      attr: Attribute;
    }
  | { id: string; kind: "match"; pairs: { a: string; b: string; item: Item }[]; attr: Attribute }
  | { id: string; kind: "build"; item: Item; bank: string[]; answer: string[]; attr: Attribute }
  | { id: string; kind: "type"; item: Item; attr: Attribute }
  | { id: string; kind: "speak"; item: Item; attr: Attribute }
  | { id: string; kind: "tone"; item: Item; attr: Attribute };

const shuffle = <T,>(a: T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};
const pick = <T,>(a: T[], n: number) => shuffle(a).slice(0, n);
let uid = 0;
const nid = () => `ex${++uid}`;

function distractors(item: Item, pool: Item[], n = 3): Item[] {
  const same = pool.filter((p) => p.id !== item.id && p.type === item.type && p.text !== item.text && p.ar !== item.ar);
  const other = pool.filter((p) => p.id !== item.id && p.text !== item.text && p.ar !== item.ar && !same.includes(p));
  return [...pick(same, n), ...pick(other, n)].slice(0, n);
}

function choice(lang: LangCode, item: Item, pool: Item[], mode: "meaning" | "reverse" | "listen" | "letter"): Exercise | null {
  const ds = distractors(item, pool);
  if (ds.length < 2) return null;
  const all = shuffle([item, ...ds]);
  const answer = all.indexOf(item);
  const isScript = item.type === "letter" || item.type === "sound";
  const opts = all.map((o) => {
    if (mode === "meaning") return { label: o.ar.split(" — ")[0], ltr: false };
    if (mode === "letter") return { label: o.reading ?? o.ar, ltr: false };
    return { label: display(lang, o.text), sub: lang === "zh" && !isScript ? o.reading : undefined, ltr: true };
  });
  const question =
    mode === "meaning" ? "ما معنى هذا؟" : mode === "reverse" ? "كيف تقول هذا؟" : mode === "letter" ? "كيف يُنطق هذا؟" : "ماذا تسمع؟";
  return { id: nid(), kind: "choice", mode, item, question, options: opts, answer, attr: mode === "listen" ? "listening" : mode === "reverse" ? "vocabulary" : "reading" };
}

function match(items: Item[], lang: LangCode): Exercise | null {
  const chosen = pick(
    items.filter((i, idx, arr) => arr.findIndex((x) => x.text === i.text) === idx),
    5,
  );
  if (chosen.length < 3) return null;
  return {
    id: nid(),
    kind: "match",
    pairs: chosen.map((i) => ({ a: display(lang, i.text), b: i.type === "letter" || i.type === "sound" ? i.reading ?? i.ar : i.ar.split(" — ")[0], item: i })),
    attr: "vocabulary",
  };
}

function build(lang: LangCode, item: Item, pool: Item[]): Exercise | null {
  const answer = tokens(item.text);
  if (answer.length < 2) return null;
  const extra = pick(
    pool.filter((p) => p.type === "word" || p.type === "phrase").flatMap((p) => tokens(p.text)).filter((t) => !answer.includes(t)),
    Math.min(4, Math.max(2, Math.ceil(answer.length / 2))),
  );
  return { id: nid(), kind: "build", item, answer, bank: shuffle([...answer, ...new Set(extra)]), attr: lang === "zh" ? "grammar" : "writing" };
}

export interface BuildOptions {
  lang: LangCode;
  kind: LessonKind;
  items: Item[];
  /** عناصر تعلّمها المتعلم سابقاً — لمشتتات أذكى */
  known: Item[];
  /** هل العنصر جديد على المتعلم (لعرض بطاقة التعريف) */
  isNew: (item: Item) => boolean;
  speechAvailable: boolean;
}

export function buildExercises(o: BuildOptions): Exercise[] {
  const { lang, kind, items } = o;
  const pool = [...items, ...o.known.filter((k) => !items.some((i) => i.id === k.id))];
  const out: Exercise[] = [];
  const push = (e: Exercise | null) => e && out.push(e);

  if (kind === "boss") {
    for (const item of pick(items, 14)) {
      const r = Math.random();
      if (item.type === "phrase") push(r < 0.6 ? build(lang, item, pool) : choice(lang, item, pool, "listen"));
      else if (item.type === "tone" || item.type === "syllable") push({ id: nid(), kind: "tone", item, attr: "listening" });
      else if (item.type === "letter" || item.type === "sound") push(choice(lang, item, pool, r < 0.5 ? "letter" : "listen"));
      else push(choice(lang, item, pool, r < 0.33 ? "meaning" : r < 0.66 ? "reverse" : "listen"));
    }
    push(match(items.filter((i) => i.type !== "phrase"), lang));
    return out;
  }

  const groups: Item[][] = [];
  for (let i = 0; i < items.length; i += 3) groups.push(items.slice(i, i + 3));

  for (const g of groups) {
    for (const item of g) if (o.isNew(item)) out.push({ id: nid(), kind: "intro", item, attr: item.type === "phrase" ? "grammar" : "vocabulary" });
    for (const item of shuffle(g)) {
      switch (item.type) {
        case "tone":
        case "syllable":
          push({ id: nid(), kind: "tone", item, attr: "listening" });
          if (o.speechAvailable) push({ id: nid(), kind: "speak", item, attr: "pronunciation" });
          break;
        case "letter":
        case "sound":
          push(choice(lang, item, pool, "letter"));
          push(choice(lang, item, pool, "listen"));
          if (o.speechAvailable && Math.random() < 0.5) push({ id: nid(), kind: "speak", item, attr: "pronunciation" });
          break;
        case "hanzi":
          push(choice(lang, item, pool, "meaning"));
          push(choice(lang, item, pool, "reverse"));
          break;
        case "phrase":
          push(build(lang, item, pool));
          push(choice(lang, item, pool, Math.random() < 0.5 ? "listen" : "meaning"));
          if (o.speechAvailable) push({ id: nid(), kind: "speak", item, attr: "speaking" });
          break;
        default:
          push(choice(lang, item, pool, "meaning"));
          push(choice(lang, item, pool, Math.random() < 0.5 ? "reverse" : "listen"));
          if (Math.random() < 0.45) push({ id: nid(), kind: "type", item, attr: "writing" });
          if (o.speechAvailable && Math.random() < 0.4) push({ id: nid(), kind: "speak", item, attr: "pronunciation" });
      }
    }
  }
  push(match(items.filter((i) => i.type !== "phrase"), lang));
  // إعادة خلط خفيفة مع الإبقاء على بطاقات التعريف قبل تمارينها
  return out;
}

// ───────────── التحقق من الإجابات المكتوبة ─────────────

const stripMarks = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export function normalizeAnswer(s: string) {
  return stripMarks(s.toLowerCase())
    .replace(/[’']/g, "'")
    .replace(/[¿?¡!.,;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** يعيد: exact (تطابق تام) | accent (صحيح لكن بلا علامات) | wrong */
export function checkTyped(lang: LangCode, item: Item, input: string): "exact" | "accent" | "wrong" {
  const targets = lang === "zh" ? [item.text.replace(/\s/g, ""), item.reading ?? ""] : [item.text];
  for (const t of targets) {
    if (!t) continue;
    const clean = (x: string) => x.toLowerCase().replace(/[¿?¡!.,;:\s]/g, "").replace(/ü/g, "v");
    if (clean(t) === clean(input)) return "exact";
    if (normalizeAnswer(t).replace(/\s/g, "").replace(/ü/g, "u") === normalizeAnswer(input).replace(/\s/g, "").replace(/v/g, "u")) return "accent";
  }
  return "wrong";
}

/** مقارنة نص التعرّف على الكلام بالهدف (نسبة تقريبية 0..100) */
export function similarity(a: string, b: string): number {
  const x = normalizeAnswer(a).replace(/\s/g, "");
  const y = normalizeAnswer(b).replace(/\s/g, "");
  if (!x.length || !y.length) return 0;
  const dp = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) dp[0][j] = j;
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return Math.round((1 - dp[x.length][y.length] / Math.max(x.length, y.length)) * 100);
}
