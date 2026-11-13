import { desc } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { isLang } from "@/content";
import { handler } from "@/server/http";
import { conversationFeedback } from "@/server/ai";
import { awardXp, checkAchievements, questProgress } from "@/server/game";
import { addCards } from "@/server/srs";
import { XP } from "@/lib/game-rules";

const Body = z.object({
  lang: z.string(),
  level: z.string(),
  scenarioId: z.string(),
  durationSec: z.number().int().min(0),
  transcript: z.array(z.object({ role: z.enum(["user", "ai"]), text: z.string() })),
});

/** حفظ المحادثة + تقييمها + مكافأة الخبرة + حفظ الكلمات الجديدة في المراجعة */
export const POST = handler(async (req) => {
  const b = Body.parse(await req.json());
  if (!isLang(b.lang)) throw new Error("لغة غير معروفة");
  const userTurns = b.transcript.filter((t) => t.role === "user" && t.text.trim()).length;
  let feedback: Awaited<ReturnType<typeof conversationFeedback>> | null = null;
  if (userTurns > 0) {
    try {
      feedback = await conversationFeedback(b.lang, b.level, b.transcript);
    } catch (e) {
      console.error(e);
    }
  }
  await db.insert(s.conversations).values({ lang: b.lang, scenarioId: b.scenarioId, transcript: b.transcript, feedback, durationSec: b.durationSec, createdAt: Date.now() });
  if (feedback?.newWords?.length)
    await addCards(
      b.lang,
      feedback.newWords.map((w, i) => ({ id: `${b.lang}.convo.${Date.now()}.${i}`, type: "word" as const, ...w })),
    );
  const q = await questProgress("speak", userTurns);
  const xp = await awardXp({ lang: b.lang, amount: userTurns * XP.speakTurn + Math.round(b.durationSec / 20), source: "conversation", attrs: { speaking: userTurns * 2, listening: userTurns } });
  const ach = await checkAchievements();
  return { feedback, xp: xp.gained, events: [...q, ...xp.events, ...ach] };
});

export const GET = handler(async () => ({ conversations: await db.select().from(s.conversations).orderBy(desc(s.conversations.createdAt)).limit(30) }));
