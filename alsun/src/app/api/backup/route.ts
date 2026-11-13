import { db, schema as s } from "@/db";
import { handler } from "@/server/http";

const TABLES = {
  profile: s.profile,
  languageProgress: s.languageProgress,
  skillStats: s.skillStats,
  lessonProgress: s.lessonProgress,
  srsCards: s.srsCards,
  reviewLogs: s.reviewLogs,
  xpEvents: s.xpEvents,
  achievements: s.achievements,
  dailyQuests: s.dailyQuests,
  inventory: s.inventory,
  counters: s.counters,
  aiCache: s.aiCache,
  conversations: s.conversations,
  pronunciationAttempts: s.pronunciationAttempts,
} as const;

/** تصدير كامل لتقدمك كملف JSON */
export const GET = handler(async () => {
  const out: Record<string, unknown[]> = {};
  for (const [k, t] of Object.entries(TABLES)) out[k] = await db.select().from(t);
  return new Response(JSON.stringify({ app: "alsun", version: 1, exportedAt: new Date().toISOString(), data: out }), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="alsun-backup-${Date.now()}.json"` },
  });
});

/** استيراد نسخة احتياطية (يستبدل كل البيانات الحالية) */
export const POST = handler(async (req) => {
  const body = (await req.json()) as { app?: string; data?: Record<string, Record<string, unknown>[]> };
  if (body.app !== "alsun" || !body.data) throw new Error("ملف غير صالح");
  await db.transaction(async (tx) => {
    for (const [k, t] of Object.entries(TABLES)) {
      await tx.delete(t);
      const rows = body.data![k] ?? [];
      for (let i = 0; i < rows.length; i += 200) if (rows.length) await tx.insert(t).values(rows.slice(i, i + 200) as never);
    }
  });
  return { ok: true };
});
