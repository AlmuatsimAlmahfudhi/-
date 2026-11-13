import { z } from "zod";
import { isLang } from "@/content";
import { handler } from "@/server/http";
import { liveToken } from "@/server/ai";
import { knownWords } from "@/server/known";

const Body = z.object({ lang: z.string(), level: z.string(), scenario: z.string() });

export const POST = handler(async (req) => {
  const b = Body.parse(await req.json());
  if (!isLang(b.lang)) throw new Error("لغة غير معروفة");
  return liveToken(b.lang, b.level, b.scenario, await knownWords(b.lang));
});
