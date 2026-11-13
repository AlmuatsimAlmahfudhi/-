import "server-only";
import { and, asc, eq, lte, count } from "drizzle-orm";
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from "ts-fsrs";
import { db, ready, schema as s } from "@/db";
import type { Item, LangCode } from "@/content";
import { awardXp, questProgress } from "./game";
import { XP } from "@/lib/game-rules";

const scheduler = fsrs(generatorParameters({ enable_fuzz: true, request_retention: 0.9, maximum_interval: 3650 }));

type Row = typeof s.srsCards.$inferSelect;

const toCard = (r: Row): Card => ({
  due: new Date(r.due),
  stability: r.stability,
  difficulty: r.difficulty,
  elapsed_days: r.elapsedDays,
  scheduled_days: r.scheduledDays,
  learning_steps: r.learningSteps,
  reps: r.reps,
  lapses: r.lapses,
  state: r.state,
  last_review: r.lastReview ? new Date(r.lastReview) : undefined,
});

const fromCard = (c: Card) => ({
  due: c.due.getTime(),
  stability: c.stability,
  difficulty: c.difficulty,
  elapsedDays: c.elapsed_days,
  scheduledDays: c.scheduled_days,
  learningSteps: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  state: c.state,
  lastReview: c.last_review ? c.last_review.getTime() : null,
});

/** تُضاف العناصر المتعلَّمة إلى المراجعة (الحروف والكلمات والجمل) بعد إكمال الدرس */
export async function addCards(lang: LangCode, items: Item[]) {
  await ready();
  const now = new Date();
  for (const it of items) {
    if (it.type === "tone") continue; // النغمات تُتدرَّب في الدروس
    const empty = createEmptyCard(now);
    await db
      .insert(s.srsCards)
      .values({
        id: `${lang}:${it.id}`,
        lang,
        itemId: it.id,
        front: it.text,
        back: it.ar.split(" — ")[0],
        reading: it.reading ?? null,
        createdAt: now.getTime(),
        ...fromCard(empty),
      })
      .onConflictDoNothing();
  }
}

export async function dueCards(lang: LangCode | null, limit = 30) {
  await ready();
  const now = Date.now();
  const where = lang ? and(eq(s.srsCards.lang, lang), lte(s.srsCards.due, now)) : lte(s.srsCards.due, now);
  const rows = await db.select().from(s.srsCards).where(where).orderBy(asc(s.srsCards.due)).limit(limit);
  const [total] = await db.select({ c: count() }).from(s.srsCards).where(where);
  // معاينة الفاصل الزمني لكل زر تقييم
  const withPreview = rows.map((r) => {
    const pv = scheduler.repeat(toCard(r), new Date());
    const fmt = (g: Grade) => pv[g].card.due.getTime() - now;
    return { ...r, preview: { 1: fmt(Rating.Again), 2: fmt(Rating.Hard), 3: fmt(Rating.Good), 4: fmt(Rating.Easy) } };
  });
  return { cards: withPreview, total: total.c };
}

export async function reviewCard(cardId: string, rating: 1 | 2 | 3 | 4) {
  await ready();
  const [r] = await db.select().from(s.srsCards).where(eq(s.srsCards.id, cardId));
  if (!r) throw new Error("بطاقة غير موجودة");
  const now = new Date();
  const { card, log } = scheduler.next(toCard(r), now, rating as Grade);
  await db.update(s.srsCards).set(fromCard(card)).where(eq(s.srsCards.id, cardId));
  await db.insert(s.reviewLogs).values({
    cardId,
    rating,
    reviewedAt: now.getTime(),
    elapsedDays: log.elapsed_days,
    scheduledDays: log.scheduled_days,
  });
  const qEvents = await questProgress("reviews", 1);
  const res = await awardXp({
    lang: r.lang as LangCode,
    amount: rating === 1 ? 1 : XP.review,
    source: "review",
    attrs: { vocabulary: 1 },
  });
  return { next: card.due.getTime(), events: [...qEvents, ...res.events] };
}
