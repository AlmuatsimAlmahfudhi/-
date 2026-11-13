import "server-only";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { LangCode } from "@/content";

/** الكلمات التي يعرفها المتعلم (من بطاقات المراجعة) — تُغذّي الذكاء الاصطناعي بسياق شخصي */
export async function knownWords(lang: LangCode): Promise<string[]> {
  const rows = await db.select({ f: s.srsCards.front }).from(s.srsCards).where(eq(s.srsCards.lang, lang));
  return rows.map((r) => r.f).filter((w) => w.length < 40);
}
