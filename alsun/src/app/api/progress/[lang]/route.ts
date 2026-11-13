import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { handler } from "@/server/http";

export const GET = handler(async (_req, ctx: { params: Promise<{ lang: string }> }) => {
  const { lang } = await ctx.params;
  const rows = await db.select().from(s.lessonProgress).where(eq(s.lessonProgress.lang, lang));
  const seen = await db.select({ id: s.srsCards.itemId }).from(s.srsCards).where(eq(s.srsCards.lang, lang));
  return { lessons: rows, seenItems: seen.map((r) => r.id) };
});
