import "server-only";
import { and, eq, gte, lte, sql, count } from "drizzle-orm";
import { db, ready, schema as s } from "@/db";
import { getCourse, learningPath, type LangCode } from "@/content";
import {
  ACHIEVEMENTS,
  HERO_CLASSES,
  levelInfo,
  localDay,
  dayDiff,
  questsForDay,
  type Attribute,
  type GameStats,
  type HeroClass,
  type QuestMetric,
  SHOP,
  type ShopItem,
} from "@/lib/game-rules";

/** أحداث تعود للواجهة لعرض المؤثرات: رفع المستوى، فتح إنجاز، إكمال مهمة... */
export type GameEvent =
  | { type: "levelUp"; level: number }
  | { type: "achievement"; id: string; name: string; icon: string; reward: number }
  | { type: "quest"; text: string; reward: number }
  | { type: "streak"; streak: number; freezeUsed: boolean }
  | { type: "goal"; goal: number };

async function getCounter(key: string) {
  const r = await db.select().from(s.counters).where(eq(s.counters.key, key));
  return r[0]?.value ?? 0;
}
export async function bumpCounter(key: string, by = 1) {
  await db
    .insert(s.counters)
    .values({ key, value: by })
    .onConflictDoUpdate({ target: s.counters.key, set: { value: sql`${s.counters.value} + ${by}` } });
}
async function setMaxCounter(key: string, v: number) {
  const cur = await getCounter(key);
  if (v > cur) await db.insert(s.counters).values({ key, value: v }).onConflictDoUpdate({ target: s.counters.key, set: { value: v } });
}

export async function getProfile() {
  await ready();
  const [p] = await db.select().from(s.profile).where(eq(s.profile.id, 1));
  return p;
}

async function inventoryQty(itemId: string) {
  const r = await db.select().from(s.inventory).where(eq(s.inventory.itemId, itemId));
  return r[0]?.qty ?? 0;
}
async function addInventory(itemId: string, by: number) {
  await db
    .insert(s.inventory)
    .values({ itemId, qty: Math.max(0, by) })
    .onConflictDoUpdate({ target: s.inventory.itemId, set: { qty: sql`max(0, ${s.inventory.qty} + ${by})` } });
}

/** يتحقق من انقطاع السلسلة عند فتح الموقع، ويستهلك الدروع تلقائياً */
export async function reconcileStreak(): Promise<GameEvent[]> {
  const p = await getProfile();
  if (!p.lastStreakDate || p.streak === 0) return [];
  const today = localDay();
  const gap = dayDiff(p.lastStreakDate, today);
  if (gap <= 1) return [];
  const missed = gap - 1;
  const freezes = await inventoryQty("streak_freeze");
  if (freezes >= missed) {
    await addInventory("streak_freeze", -missed);
    // نقدّم تاريخ آخر يوم إلى الأمس كأن الأيام الفائتة مُغطاة
    const y = new Date();
    y.setDate(y.getDate() - 1);
    await db.update(s.profile).set({ lastStreakDate: localDay(y) }).where(eq(s.profile.id, 1));
    return [{ type: "streak", streak: p.streak, freezeUsed: true }];
  }
  await db.update(s.profile).set({ streak: 0 }).where(eq(s.profile.id, 1));
  return [];
}

export async function xpToday(day = localDay()) {
  const [r] = await db.select({ v: sql<number>`coalesce(sum(${s.xpEvents.amount}),0)` }).from(s.xpEvents).where(eq(s.xpEvents.day, day));
  return Number(r.v);
}

export async function questProgress(metric: QuestMetric, value: number, mode: "add" | "max" = "add"): Promise<GameEvent[]> {
  const day = localDay();
  const events: GameEvent[] = [];
  for (const q of questsForDay(day).filter((q) => q.metric === metric)) {
    await db.insert(s.dailyQuests).values({ day, questId: q.id, target: q.target }).onConflictDoNothing();
    const [row] = await db.select().from(s.dailyQuests).where(and(eq(s.dailyQuests.day, day), eq(s.dailyQuests.questId, q.id)));
    if (row.claimed) continue;
    const progress = mode === "add" ? row.progress + value : Math.max(row.progress, value);
    const done = progress >= q.target;
    await db
      .update(s.dailyQuests)
      .set({ progress: Math.min(progress, q.target), claimed: done })
      .where(and(eq(s.dailyQuests.day, day), eq(s.dailyQuests.questId, q.id)));
    if (done) {
      await db.update(s.profile).set({ gems: sql`${s.profile.gems} + ${q.reward}` }).where(eq(s.profile.id, 1));
      events.push({ type: "quest", text: q.text, reward: q.reward });
    }
  }
  return events;
}

/** المنح المركزي للخبرة: يطبق مزايا الفئة والمضاعِف ويحدّث السلسلة والسمات والمهام */
export async function awardXp(opts: {
  lang: LangCode | null;
  amount: number;
  source: string;
  attrs?: Partial<Record<Attribute, number>>;
}): Promise<{ gained: number; events: GameEvent[] }> {
  const p = await getProfile();
  const events: GameEvent[] = [];
  let amount = opts.amount;
  const cls = p.heroClass as HeroClass;
  if (cls === "scholar" && opts.source === "review") amount *= 1.2;
  if (cls === "orator" && (opts.source === "speak" || opts.source === "conversation")) amount *= 1.3;
  if (p.xpBoostUntil && p.xpBoostUntil > Date.now()) amount *= 2;
  amount = Math.round(amount);
  if (amount <= 0) return { gained: 0, events };

  const day = localDay();
  const before = await xpToday(day);
  const beforeLevel = levelInfo(p.totalXp).level;

  await db.insert(s.xpEvents).values({ day, lang: opts.lang, amount, source: opts.source, createdAt: Date.now() });
  await db.update(s.profile).set({ totalXp: sql`${s.profile.totalXp} + ${amount}` }).where(eq(s.profile.id, 1));
  if (opts.lang) {
    await db
      .insert(s.languageProgress)
      .values({ lang: opts.lang, xp: amount, currentLevel: "FOUNDATION", startedAt: Date.now() })
      .onConflictDoUpdate({ target: s.languageProgress.lang, set: { xp: sql`${s.languageProgress.xp} + ${amount}` } });
    for (const [attr, pts] of Object.entries(opts.attrs ?? {})) {
      if (!pts) continue;
      await db
        .insert(s.skillStats)
        .values({ lang: opts.lang, attribute: attr, points: pts })
        .onConflictDoUpdate({ target: [s.skillStats.lang, s.skillStats.attribute], set: { points: sql`${s.skillStats.points} + ${pts}` } });
    }
  }

  const afterLevel = levelInfo(p.totalXp + amount).level;
  if (afterLevel > beforeLevel) {
    events.push({ type: "levelUp", level: afterLevel });
    await db.update(s.profile).set({ gems: sql`${s.profile.gems} + ${10 * (afterLevel - beforeLevel)}` }).where(eq(s.profile.id, 1));
  }

  // السلسلة: تُحسب عند بلوغ الهدف اليومي لأول مرة اليوم
  if (before < p.dailyGoalXp && before + amount >= p.dailyGoalXp && p.lastStreakDate !== day) {
    const gap = p.lastStreakDate ? dayDiff(p.lastStreakDate, day) : 99;
    const streak = gap === 1 ? p.streak + 1 : 1;
    await db
      .update(s.profile)
      .set({ streak, longestStreak: Math.max(p.longestStreak, streak), lastStreakDate: day })
      .where(eq(s.profile.id, 1));
    events.push({ type: "goal", goal: p.dailyGoalXp }, { type: "streak", streak, freezeUsed: false });
    if (cls === "ranger" && streak % 7 === 0) await addInventory("streak_freeze", 1);
  }

  events.push(...(await questProgress("xp", amount)));
  events.push(...(await checkAchievements()));
  return { gained: amount, events };
}

export async function gameStats(): Promise<GameStats> {
  const p = await getProfile();
  const [cards] = await db.select({ c: count() }).from(s.srsCards);
  const [reviews] = await db.select({ c: count() }).from(s.reviewLogs);
  const [convos] = await db.select({ c: count() }).from(s.conversations);
  const [speak] = await db.select({ c: count() }).from(s.pronunciationAttempts);
  const langs = await db.select().from(s.languageProgress);
  const lessons = await getCounter("lessons");
  let foundationsDone = 0;
  for (const l of langs) {
    const course = getCourse(l.lang);
    const ids = course.foundation.units.flatMap((u) => u.lessons.map((x) => x.id));
    const done = await db
      .select({ c: count() })
      .from(s.lessonProgress)
      .where(and(eq(s.lessonProgress.lang, l.lang), gte(s.lessonProgress.crowns, 1)));
    const doneIds = new Set(
      (await db.select().from(s.lessonProgress).where(eq(s.lessonProgress.lang, l.lang))).filter((r) => r.crowns > 0).map((r) => r.lessonId),
    );
    if (done[0].c > 0 && ids.every((id) => doneIds.has(id))) foundationsDone++;
  }
  return {
    totalXp: p.totalXp,
    level: levelInfo(p.totalXp).level,
    streak: p.streak,
    longestStreak: p.longestStreak,
    lessons,
    perfectLessons: await getCounter("perfect"),
    bosses: await getCounter("bosses"),
    reviews: reviews.c,
    cards: cards.c,
    speakAttempts: speak.c + (await getCounter("speak_local")),
    conversations: convos.c,
    maxCombo: await getCounter("max_combo"),
    langsStarted: langs.length,
    foundationsDone,
    gemsSpent: await getCounter("gems_spent"),
  };
}

export async function checkAchievements(): Promise<GameEvent[]> {
  const stats = await gameStats();
  const have = new Set((await db.select().from(s.achievements)).map((a) => a.id));
  const events: GameEvent[] = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id) || !a.test(stats)) continue;
    await db.insert(s.achievements).values({ id: a.id, unlockedAt: Date.now() }).onConflictDoNothing();
    await db.update(s.profile).set({ gems: sql`${s.profile.gems} + ${a.reward}` }).where(eq(s.profile.id, 1));
    events.push({ type: "achievement", id: a.id, name: a.name, icon: a.icon, reward: a.reward });
  }
  return events;
}

/** إنهاء درس: تيجان، أحجار، عدادات، مهام */
export async function completeLesson(opts: {
  lang: LangCode;
  lessonId: string;
  accuracy: number;
  xp: number;
  maxCombo: number;
  boss: boolean;
  won: boolean;
  attrs: Partial<Record<Attribute, number>>;
  speakCount: number;
}) {
  const { crownsFor, gemsForLesson, XP } = await import("@/lib/game-rules");
  const events: GameEvent[] = [];
  const now = Date.now();
  let gems = 0;
  if (opts.won) {
    const crowns = crownsFor(opts.accuracy);
    await db
      .insert(s.lessonProgress)
      .values({ lang: opts.lang, lessonId: opts.lessonId, crowns, bestAccuracy: opts.accuracy, timesCompleted: 1, lastCompletedAt: now })
      .onConflictDoUpdate({
        target: [s.lessonProgress.lang, s.lessonProgress.lessonId],
        set: {
          crowns: sql`max(${s.lessonProgress.crowns}, ${crowns})`,
          bestAccuracy: sql`max(${s.lessonProgress.bestAccuracy}, ${opts.accuracy})`,
          timesCompleted: sql`${s.lessonProgress.timesCompleted} + 1`,
          lastCompletedAt: now,
        },
      });
    gems = gemsForLesson(opts.accuracy, opts.boss);
    await db.update(s.profile).set({ gems: sql`${s.profile.gems} + ${gems}` }).where(eq(s.profile.id, 1));
    await bumpCounter("lessons");
    events.push(...(await questProgress("lessons", 1)));
    if (opts.accuracy >= 1) {
      await bumpCounter("perfect");
      events.push(...(await questProgress("perfect", 1)));
    }
    if (opts.boss) {
      await bumpCounter("bosses");
      events.push(...(await questProgress("boss", 1)));
    }
    await updateCurrentLevel(opts.lang);
  }
  await setMaxCounter("max_combo", opts.maxCombo);
  events.push(...(await questProgress("combo", opts.maxCombo, "max")));
  if (opts.speakCount) {
    await bumpCounter("speak_local", opts.speakCount);
    events.push(...(await questProgress("speak", opts.speakCount)));
  }
  let xp = opts.xp + (opts.won ? XP.lessonComplete : 0) + (opts.won && opts.accuracy >= 1 ? XP.perfectBonus : 0);
  if (opts.boss && opts.won) xp *= XP.bossMultiplier;
  const r = await awardXp({ lang: opts.lang, amount: xp, source: opts.boss ? "boss" : "lesson", attrs: opts.attrs });
  return { xp: r.gained, gems, events: [...events, ...r.events] };
}

async function updateCurrentLevel(lang: LangCode) {
  const done = new Set(
    (await db.select().from(s.lessonProgress).where(eq(s.lessonProgress.lang, lang))).filter((r) => r.crowns > 0).map((r) => r.lessonId),
  );
  const path = learningPath(lang);
  const next = path.find((p) => !done.has(p.lesson.id));
  const level = next?.level.code ?? path[path.length - 1].level.code;
  await db
    .insert(s.languageProgress)
    .values({ lang, xp: 0, currentLevel: level, startedAt: Date.now() })
    .onConflictDoUpdate({ target: s.languageProgress.lang, set: { currentLevel: level } });
}

export async function buyItem(item: ShopItem) {
  const p = await getProfile();
  const def = SHOP[item];
  if (!def) throw new Error("عنصر غير معروف");
  if (p.gems < def.price) return { ok: false as const, message: "لا تملك أحجاراً كافية" };
  await db.update(s.profile).set({ gems: sql`${s.profile.gems} - ${def.price}` }).where(eq(s.profile.id, 1));
  await bumpCounter("gems_spent", def.price);
  if (item === "xp_boost") {
    const base = Math.max(Date.now(), p.xpBoostUntil ?? 0);
    await db.update(s.profile).set({ xpBoostUntil: base + 15 * 60_000 }).where(eq(s.profile.id, 1));
  } else await addInventory(item, 1);
  return { ok: true as const, events: await checkAchievements() };
}

export async function consumeItem(item: ShopItem) {
  const q = await inventoryQty(item);
  if (q <= 0) return false;
  await addInventory(item, -1);
  return true;
}

/** لقطة كاملة لحالة اللاعب تُعرض في الواجهة */
export async function snapshot() {
  const events = await reconcileStreak();
  const p = await getProfile();
  const day = localDay();
  const today = await xpToday(day);
  const quests = questsForDay(day);
  const qRows = await db.select().from(s.dailyQuests).where(eq(s.dailyQuests.day, day));
  const inv = Object.fromEntries((await db.select().from(s.inventory)).map((r) => [r.itemId, r.qty]));
  const langs = await db.select().from(s.languageProgress);
  const attrs = await db.select().from(s.skillStats);
  const now = Date.now();
  const dueRows = await db
    .select({ lang: s.srsCards.lang, c: count() })
    .from(s.srsCards)
    .where(lte(s.srsCards.due, now))
    .groupBy(s.srsCards.lang);
  const week: { day: string; xp: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = localDay(d);
    week.push({ day: k, xp: await xpToday(k) });
  }
  const unlocked = await db.select().from(s.achievements);
  return {
    profile: { ...p, heroClassInfo: HERO_CLASSES[p.heroClass as HeroClass] ?? HERO_CLASSES.scholar },
    level: levelInfo(p.totalXp),
    xpToday: today,
    quests: quests.map((q) => {
      const r = qRows.find((x) => x.questId === q.id);
      return { ...q, progress: r?.progress ?? 0, claimed: r?.claimed ?? false };
    }),
    inventory: inv,
    languages: langs,
    attributes: attrs,
    due: Object.fromEntries(dueRows.map((r) => [r.lang, r.c])) as Record<string, number>,
    week,
    achievements: unlocked,
    stats: await gameStats(),
    events,
  };
}
export type Snapshot = Awaited<ReturnType<typeof snapshot>>;
