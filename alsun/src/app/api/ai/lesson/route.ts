import { z } from "zod";
import { findLesson, isLang } from "@/content";
import { handler } from "@/server/http";
import { generateLesson } from "@/server/ai";
import { knownWords } from "@/server/known";

const Body = z.object({ lang: z.string(), lessonId: z.string(), regenerate: z.boolean().optional() });

/** يولّد محتوى درس من دروس المستويات العليا ويحفظه (يُولَّد مرة واحدة ثم يُقرأ من الذاكرة) */
export const POST = handler(async (req) => {
  const b = Body.parse(await req.json());
  if (!isLang(b.lang)) throw new Error("لغة غير معروفة");
  const p = findLesson(b.lang, b.lessonId);
  if (!p || !p.lesson.aiTopic) throw new Error("ليس درس ذكاء اصطناعي");
  // معركة الزعيم في وحدة مولَّدة تجمع محتوى دروس الوحدة الثلاثة
  const lessons = p.lesson.kind === "boss" ? p.unit.lessons.filter((l) => l.kind === "ai") : [p.lesson];
  const known = await knownWords(b.lang);
  const out = await Promise.all(
    lessons.map((l) =>
      generateLesson({
        lang: b.lang as "en",
        lessonId: l.id,
        level: p.level.code,
        topic: l.aiTopic!,
        grammar: l.aiGrammar,
        title: l.title,
        known,
        regenerate: b.regenerate && l.id === p.lesson.id,
      }),
    ),
  );
  return { parts: out };
});
