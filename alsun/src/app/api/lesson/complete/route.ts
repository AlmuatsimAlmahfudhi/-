import { z } from "zod";
import { findLesson, getCourse, isLang, type Item } from "@/content";
import { handler } from "@/server/http";
import { completeLesson } from "@/server/game";
import { addCards } from "@/server/srs";

const Body = z.object({
  lang: z.string(),
  lessonId: z.string(),
  accuracy: z.number().min(0).max(1),
  xp: z.number().int().min(0).max(2000),
  maxCombo: z.number().int().min(0),
  won: z.boolean(),
  speakCount: z.number().int().min(0).default(0),
  attrs: z.record(z.string(), z.number()).default({}),
  /** لدروس الذكاء الاصطناعي: العناصر المولَّدة لتُضاف إلى المراجعة */
  aiItems: z.array(z.object({ id: z.string(), type: z.string(), text: z.string(), ar: z.string(), reading: z.string().optional() })).optional(),
});

export const POST = handler(async (req) => {
  const b = Body.parse(await req.json());
  if (!isLang(b.lang)) throw new Error("لغة غير معروفة");
  const p = findLesson(b.lang, b.lessonId);
  if (!p) throw new Error("درس غير موجود");
  const result = await completeLesson({
    lang: b.lang,
    lessonId: b.lessonId,
    accuracy: b.accuracy,
    xp: b.xp,
    maxCombo: b.maxCombo,
    boss: p.lesson.kind === "boss",
    won: b.won,
    attrs: b.attrs,
    speakCount: b.speakCount,
  });
  if (b.won) {
    const course = getCourse(b.lang);
    const items = p.lesson.items.map((id) => course.items[id]).filter(Boolean);
    await addCards(b.lang, [...items, ...((b.aiItems ?? []) as Item[])]);
  }
  return result;
});
