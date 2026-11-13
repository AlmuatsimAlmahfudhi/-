/**
 * قواعد نظام اللعب (دوال نقية، تعمل على الخادم والمتصفح)
 */

// ───────────── المستويات والألقاب ─────────────

/** الخبرة اللازمة للانتقال من المستوى n إلى n+1 */
export const xpToNext = (n: number) => Math.round(80 + 45 * n + 6 * n * n);

export function levelInfo(totalXp: number) {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level++;
  }
  return { level, intoLevel: remaining, needed: xpToNext(level), progress: remaining / xpToNext(level) };
}

const TITLES: [number, string][] = [
  [1, "تلميذ الحروف"],
  [3, "مستكشف الكلمات"],
  [6, "رحّالة اللغات"],
  [10, "فارس البيان"],
  [15, "حارس المعاني"],
  [20, "ساحر الألسن"],
  [30, "حكيم اللغات"],
  [40, "سيّد البلاغة"],
  [50, "أسطورة الألسن"],
];
export const titleFor = (level: number) => [...TITLES].reverse().find(([l]) => level >= l)![1];

// ───────────── فئات الأبطال ─────────────

export const HERO_CLASSES = {
  scholar: { name: "الحكيم", icon: "📚", perk: "+20% خبرة من المراجعة المتباعدة" },
  warrior: { name: "المحارب", icon: "⚔️", perk: "ضربات أقوى بـ 25% في معارك الزعماء" },
  orator: { name: "الخطيب", icon: "🎙️", perk: "+30% خبرة من تمارين النطق والمحادثة" },
  ranger: { name: "الرحّالة", icon: "🧭", perk: "درع سلسلة مجاني كل 7 أيام متتالية" },
} as const;
export type HeroClass = keyof typeof HERO_CLASSES;

// ───────────── السمات ─────────────

export const ATTRIBUTES = {
  listening: { name: "الاستماع", icon: "👂" },
  speaking: { name: "المحادثة", icon: "🗣️" },
  pronunciation: { name: "النطق", icon: "🎯" },
  reading: { name: "القراءة", icon: "📖" },
  writing: { name: "الكتابة", icon: "✍️" },
  vocabulary: { name: "المفردات", icon: "🧠" },
  grammar: { name: "القواعد", icon: "🏗️" },
} as const;
export type Attribute = keyof typeof ATTRIBUTES;

// ───────────── الخبرة ─────────────

export const XP = {
  correct: 10,
  intro: 2,
  perfectBonus: 25,
  lessonComplete: 15,
  bossMultiplier: 2,
  review: 4,
  speakTurn: 6,
  comboStep: 0.1, // +10% لكل إجابة متتالية صحيحة
  comboMax: 1, // حتى +100%
};

export function comboMultiplier(combo: number) {
  return 1 + Math.min(XP.comboMax, Math.max(0, combo - 1) * XP.comboStep);
}

/** أحجار كريمة مقابل إكمال درس */
export function gemsForLesson(accuracy: number, boss: boolean) {
  const base = boss ? 30 : 8;
  return Math.round(base * (accuracy >= 1 ? 1.5 : accuracy >= 0.8 ? 1 : 0.6));
}

/** درجات الإتقان (التيجان) بحسب الدقة */
export function crownsFor(accuracy: number) {
  return accuracy >= 0.95 ? 3 : accuracy >= 0.8 ? 2 : 1;
}

// ───────────── متجر الأدوات ─────────────

export const SHOP = {
  streak_freeze: { name: "درع السلسلة", icon: "🛡️", price: 60, desc: "يحمي سلسلتك يوماً واحداً إن غبت" },
  xp_boost: { name: "إكسير الخبرة", icon: "🧪", price: 120, desc: "يضاعف الخبرة لمدة 15 دقيقة" },
  boss_potion: { name: "جرعة الحياة", icon: "❤️‍🩹", price: 40, desc: "درع إضافي في معركة الزعيم القادمة" },
} as const;
export type ShopItem = keyof typeof SHOP;

// ───────────── المهام اليومية ─────────────

export type QuestMetric = "xp" | "lessons" | "reviews" | "speak" | "perfect" | "combo" | "boss";
export interface QuestDef {
  id: string;
  metric: QuestMetric;
  target: number;
  text: string;
  reward: number; // أحجار كريمة
}
export const QUEST_POOL: QuestDef[] = [
  { id: "xp50", metric: "xp", target: 50, text: "اكسب 50 نقطة خبرة", reward: 15 },
  { id: "xp120", metric: "xp", target: 120, text: "اكسب 120 نقطة خبرة", reward: 30 },
  { id: "lessons2", metric: "lessons", target: 2, text: "أكمل درسين", reward: 15 },
  { id: "lessons4", metric: "lessons", target: 4, text: "أكمل 4 دروس", reward: 30 },
  { id: "reviews15", metric: "reviews", target: 15, text: "راجع 15 بطاقة", reward: 20 },
  { id: "speak5", metric: "speak", target: 5, text: "انطق 5 كلمات أو جمل بصوتك", reward: 20 },
  { id: "perfect1", metric: "perfect", target: 1, text: "أنهِ درساً بلا أي خطأ", reward: 25 },
  { id: "combo8", metric: "combo", target: 8, text: "حقق سلسلة 8 إجابات صحيحة متتالية", reward: 20 },
  { id: "boss1", metric: "boss", target: 1, text: "اهزم زعيماً واحداً", reward: 35 },
];

/** اختيار 3 مهام يومية بشكل حتمي من تاريخ اليوم */
export function questsForDay(day: string): QuestDef[] {
  let seed = [...day].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const pool = [...QUEST_POOL];
  const out: QuestDef[] = [];
  const metrics = new Set<string>();
  while (out.length < 3 && pool.length) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const [q] = pool.splice(seed % pool.length, 1);
    if (metrics.has(q.metric)) continue;
    metrics.add(q.metric);
    out.push(q);
  }
  return out;
}

// ───────────── الإنجازات ─────────────

export interface GameStats {
  totalXp: number;
  level: number;
  streak: number;
  longestStreak: number;
  lessons: number;
  perfectLessons: number;
  bosses: number;
  reviews: number;
  cards: number;
  speakAttempts: number;
  conversations: number;
  maxCombo: number;
  langsStarted: number;
  foundationsDone: number;
  gemsSpent: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  tier: "bronze" | "silver" | "gold" | "legend";
  reward: number;
  test: (s: GameStats) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_lesson", name: "الخطوة الأولى", icon: "👣", desc: "أكمل أول درس", tier: "bronze", reward: 10, test: (s) => s.lessons >= 1 },
  { id: "lessons_10", name: "طالب مثابر", icon: "📘", desc: "أكمل 10 دروس", tier: "bronze", reward: 20, test: (s) => s.lessons >= 10 },
  { id: "lessons_50", name: "باحث نهم", icon: "📚", desc: "أكمل 50 درساً", tier: "silver", reward: 50, test: (s) => s.lessons >= 50 },
  { id: "lessons_200", name: "علّامة", icon: "🏛️", desc: "أكمل 200 درس", tier: "gold", reward: 150, test: (s) => s.lessons >= 200 },
  { id: "perfect_1", name: "بلا خطأ", icon: "💎", desc: "أنهِ درساً بدقة 100%", tier: "bronze", reward: 15, test: (s) => s.perfectLessons >= 1 },
  { id: "perfect_25", name: "الكمال", icon: "✨", desc: "25 درساً بلا خطأ", tier: "gold", reward: 100, test: (s) => s.perfectLessons >= 25 },
  { id: "boss_1", name: "قاهر الزعيم", icon: "🐉", desc: "اهزم أول زعيم", tier: "bronze", reward: 25, test: (s) => s.bosses >= 1 },
  { id: "boss_10", name: "صياد التنانين", icon: "⚔️", desc: "اهزم 10 زعماء", tier: "silver", reward: 80, test: (s) => s.bosses >= 10 },
  { id: "streak_3", name: "شرارة", icon: "🔥", desc: "سلسلة 3 أيام", tier: "bronze", reward: 15, test: (s) => s.longestStreak >= 3 },
  { id: "streak_7", name: "أسبوع من نار", icon: "🔥", desc: "سلسلة 7 أيام", tier: "silver", reward: 40, test: (s) => s.longestStreak >= 7 },
  { id: "streak_30", name: "شعلة لا تنطفئ", icon: "☄️", desc: "سلسلة 30 يوماً", tier: "gold", reward: 150, test: (s) => s.longestStreak >= 30 },
  { id: "streak_100", name: "العنقاء", icon: "🦅", desc: "سلسلة 100 يوم", tier: "legend", reward: 500, test: (s) => s.longestStreak >= 100 },
  { id: "cards_50", name: "ذاكرة حديدية", icon: "🧠", desc: "50 بطاقة في المراجعة", tier: "bronze", reward: 20, test: (s) => s.cards >= 50 },
  { id: "cards_500", name: "مكتبة متنقلة", icon: "🗃️", desc: "500 بطاقة في المراجعة", tier: "gold", reward: 120, test: (s) => s.cards >= 500 },
  { id: "reviews_100", name: "المراجِع", icon: "🔁", desc: "100 مراجعة", tier: "silver", reward: 40, test: (s) => s.reviews >= 100 },
  { id: "speak_1", name: "أول كلمة", icon: "🎤", desc: "انطق أول كلمة", tier: "bronze", reward: 10, test: (s) => s.speakAttempts >= 1 },
  { id: "speak_100", name: "لسان طليق", icon: "🗣️", desc: "100 محاولة نطق", tier: "silver", reward: 60, test: (s) => s.speakAttempts >= 100 },
  { id: "convo_1", name: "كاسر الحاجز", icon: "💬", desc: "أول محادثة صوتية مع الذكاء الاصطناعي", tier: "silver", reward: 30, test: (s) => s.conversations >= 1 },
  { id: "convo_20", name: "المحاور", icon: "🎭", desc: "20 محادثة صوتية", tier: "gold", reward: 120, test: (s) => s.conversations >= 20 },
  { id: "combo_15", name: "إعصار", icon: "🌪️", desc: "سلسلة 15 إجابة صحيحة", tier: "silver", reward: 30, test: (s) => s.maxCombo >= 15 },
  { id: "polyglot_2", name: "ثنائي اللسان", icon: "🌍", desc: "ابدأ لغتين", tier: "bronze", reward: 20, test: (s) => s.langsStarted >= 2 },
  { id: "polyglot_4", name: "متعدد الألسن", icon: "🌐", desc: "ابدأ اللغات الأربع", tier: "gold", reward: 100, test: (s) => s.langsStarted >= 4 },
  { id: "foundation_1", name: "حارس المعبد", icon: "⛩️", desc: "أكمل المرحلة التأسيسية في لغة", tier: "silver", reward: 60, test: (s) => s.foundationsDone >= 1 },
  { id: "level_10", name: "فارس البيان", icon: "🛡️", desc: "بلغ المستوى 10", tier: "silver", reward: 50, test: (s) => s.level >= 10 },
  { id: "level_25", name: "ساحر الألسن", icon: "🔮", desc: "بلغ المستوى 25", tier: "gold", reward: 150, test: (s) => s.level >= 25 },
  { id: "shopper", name: "التاجر", icon: "💰", desc: "اشترِ أداة من المتجر", tier: "bronze", reward: 5, test: (s) => s.gemsSpent > 0 },
];

// ───────────── التاريخ المحلي ─────────────

export function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00") - Date.parse(a + "T00:00:00")) / 86400000);
}
