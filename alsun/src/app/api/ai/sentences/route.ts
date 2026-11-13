import { z } from "zod";
import { isLang } from "@/content";
import { handler } from "@/server/http";
import { contextSentences } from "@/server/ai";
import { knownWords } from "@/server/known";

const Body = z.object({ lang: z.string(), level: z.string(), words: z.array(z.string()).optional(), n: z.number().int().min(1).max(10).optional() });

export const POST = handler(async (req) => {
  const b = Body.parse(await req.json());
  if (!isLang(b.lang)) throw new Error("لغة غير معروفة");
  const words = b.words?.length ? b.words : (await knownWords(b.lang)).slice(-60);
  return contextSentences(b.lang, b.level, words, b.n ?? 5);
});
