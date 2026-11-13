import { z } from "zod";
import { isLang } from "@/content";
import { handler } from "@/server/http";
import { explainMistake } from "@/server/ai";

const Body = z.object({ lang: z.string(), prompt: z.string(), given: z.string(), correct: z.string() });

export const POST = handler(async (req) => {
  const b = Body.parse(await req.json());
  if (!isLang(b.lang)) throw new Error("لغة غير معروفة");
  return explainMistake(b.lang, b.prompt, b.given, b.correct);
});
