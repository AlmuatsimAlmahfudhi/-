/**
 * مخطط قاعدة البيانات (SQLite محلية عبر Drizzle ORM)
 *
 * ملاحظة معمارية: المنهج نفسه (اللغات ← المستويات ← الوحدات ← الدروس ← العناصر)
 * محفوظ كبيانات ثابتة مُصنَّفة الأنواع في src/content، لأنه محتوى مُحرَّر لا يتغير
 * بتغير المستخدم. أما قاعدة البيانات فتحفظ كل ما يتعلق بالمتعلم: التقدم،
 * بطاقات التكرار المتباعد، اللعب، والمحتوى المولَّد بالذكاء الاصطناعي.
 */
import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

/** ملف اللاعب (صف واحد فقط id = 1 لأن الموقع لمستخدم واحد) */
export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey(),
  displayName: text("display_name").notNull().default("البطل"),
  heroClass: text("hero_class").notNull().default("scholar"), // فئة البطل في نظام اللعب
  totalXp: integer("total_xp").notNull().default(0),
  gems: integer("gems").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastStreakDate: text("last_streak_date"), // YYYY-MM-DD آخر يوم اكتمل فيه الهدف
  dailyGoalXp: integer("daily_goal_xp").notNull().default(50),
  xpBoostUntil: integer("xp_boost_until"), // طابع زمني ms لانتهاء مضاعِف النقاط
  activeLang: text("active_lang").notNull().default("en"),
  settings: text("settings", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: integer("created_at").notNull(),
});

/** تقدم المتعلم في كل لغة */
export const languageProgress = sqliteTable("language_progress", {
  lang: text("lang").primaryKey(), // en | fr | es | zh
  xp: integer("xp").notNull().default(0),
  currentLevel: text("current_level").notNull(), // A1..C2 أو HSK1..HSK9
  startedAt: integer("started_at").notNull(),
});

/** سمات البطل لكل لغة: استماع، محادثة، قراءة، كتابة، مفردات، قواعد، نطق */
export const skillStats = sqliteTable(
  "skill_stats",
  {
    lang: text("lang").notNull(),
    attribute: text("attribute").notNull(),
    points: integer("points").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.lang, t.attribute] })],
);

/** حالة كل درس في خريطة المغامرة */
export const lessonProgress = sqliteTable(
  "lesson_progress",
  {
    lang: text("lang").notNull(),
    lessonId: text("lesson_id").notNull(),
    crowns: integer("crowns").notNull().default(0), // 0..3 درجات الإتقان
    bestAccuracy: real("best_accuracy").notNull().default(0),
    timesCompleted: integer("times_completed").notNull().default(0),
    lastCompletedAt: integer("last_completed_at"),
  },
  (t) => [primaryKey({ columns: [t.lang, t.lessonId] })],
);

/** بطاقات التكرار المتباعد (خوارزمية FSRS) */
export const srsCards = sqliteTable(
  "srs_cards",
  {
    id: text("id").primaryKey(), // `${lang}:${itemId}`
    lang: text("lang").notNull(),
    itemId: text("item_id").notNull(),
    front: text("front").notNull(), // النص الأجنبي
    back: text("back").notNull(), // المعنى العربي
    reading: text("reading"), // نطق تقريبي / بينيين
    due: integer("due").notNull(),
    stability: real("stability").notNull(),
    difficulty: real("difficulty").notNull(),
    elapsedDays: integer("elapsed_days").notNull(),
    scheduledDays: integer("scheduled_days").notNull(),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull(),
    lapses: integer("lapses").notNull(),
    state: integer("state").notNull(), // 0 جديد، 1 تعلم، 2 مراجعة، 3 إعادة تعلم
    lastReview: integer("last_review"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("srs_due_idx").on(t.lang, t.due)],
);

/** سجل المراجعات (لتحليل الأداء وضبط FSRS لاحقاً) */
export const reviewLogs = sqliteTable("review_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: text("card_id").notNull(),
  rating: integer("rating").notNull(), // 1 نسيت، 2 صعب، 3 جيد، 4 سهل
  reviewedAt: integer("reviewed_at").notNull(),
  elapsedDays: integer("elapsed_days").notNull(),
  scheduledDays: integer("scheduled_days").notNull(),
});

/** كل نقطة خبرة مكتسبة — مصدر حساب الهدف اليومي والرسوم البيانية */
export const xpEvents = sqliteTable(
  "xp_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    day: text("day").notNull(), // YYYY-MM-DD بالتوقيت المحلي
    lang: text("lang"),
    amount: integer("amount").notNull(),
    source: text("source").notNull(), // lesson | review | boss | quest | speak | achievement
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("xp_day_idx").on(t.day)],
);

/** الإنجازات المفتوحة */
export const achievements = sqliteTable("achievements", {
  id: text("id").primaryKey(),
  unlockedAt: integer("unlocked_at").notNull(),
});

/** المهام اليومية */
export const dailyQuests = sqliteTable(
  "daily_quests",
  {
    day: text("day").notNull(),
    questId: text("quest_id").notNull(),
    target: integer("target").notNull(),
    progress: integer("progress").notNull().default(0),
    claimed: integer("claimed", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.day, t.questId] })],
);

/** حقيبة الأدوات: حماية السلسلة، مضاعف النقاط... */
export const inventory = sqliteTable("inventory", {
  itemId: text("item_id").primaryKey(),
  qty: integer("qty").notNull().default(0),
});

/** عدادات عامة للإنجازات (عدد المحادثات، الدروس المثالية، الزعماء المهزومين...) */
export const counters = sqliteTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});

/** ذاكرة المحتوى المولَّد بالذكاء الاصطناعي (دروس المستويات العليا، تمارين إضافية) */
export const aiCache = sqliteTable("ai_cache", {
  key: text("key").primaryKey(),
  payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
  createdAt: integer("created_at").notNull(),
});

/** المحادثات الصوتية مع تقييمها */
export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lang: text("lang").notNull(),
  scenarioId: text("scenario_id").notNull(),
  transcript: text("transcript", { mode: "json" }).$type<{ role: "user" | "ai"; text: string }[]>().notNull(),
  feedback: text("feedback", { mode: "json" }).$type<unknown>(),
  durationSec: integer("duration_sec").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

/** محاولات النطق وتقييمها */
export const pronunciationAttempts = sqliteTable("pronunciation_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lang: text("lang").notNull(),
  target: text("target").notNull(),
  score: integer("score").notNull(),
  details: text("details", { mode: "json" }).$type<unknown>(),
  createdAt: integer("created_at").notNull(),
});
