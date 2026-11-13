import { z } from "zod";
import { db, schema as s } from "@/db";
import { handler } from "@/server/http";
import { awardXp, questProgress } from "@/server/game";
import { XP } from "@/lib/game-rules";

const Body = z.object({ lang: z.enum(["en", "fr", "es", "zh"]), target: z.string(), score: z.number().int().min(0).max(100), details: z.unknown().optional() });

/** يسجّل محاولة نطق (من التعرف المحلي أو من تقييم Gemini) */
export const POST = handler(async (req) => {
  const b = Body.parse(await req.json());
  await db.insert(s.pronunciationAttempts).values({ lang: b.lang, target: b.target, score: b.score, details: b.details ?? null, createdAt: Date.now() });
  const q = await questProgress("speak", 1);
  const r = await awardXp({ lang: b.lang, amount: Math.round((XP.speakTurn * b.score) / 100), source: "speak", attrs: { pronunciation: b.score >= 70 ? 2 : 1 } });
  return { events: [...q, ...r.events] };
});
