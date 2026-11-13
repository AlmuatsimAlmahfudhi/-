import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isLang } from "@/content";
import { handler } from "@/server/http";
import { tts } from "@/server/ai";

/** نطق عالي الجودة من Gemini مع تخزين دائم على القرص (يُولَّد مرة واحدة لكل نص) */
export const GET = handler(async (req) => {
  const u = new URL(req.url);
  const lang = u.searchParams.get("lang") ?? "";
  const text = (u.searchParams.get("text") ?? "").slice(0, 300);
  if (!isLang(lang) || !text) throw new Error("طلب غير صالح");
  const dir = path.join(process.cwd(), "data", "tts");
  const file = path.join(dir, createHash("sha1").update(`${lang}:${text}`).digest("hex") + ".wav");
  let wav: Buffer;
  try {
    wav = await readFile(file);
  } catch {
    wav = await tts(lang, text);
    await mkdir(dir, { recursive: true });
    await writeFile(file, wav);
  }
  return new Response(new Uint8Array(wav), { headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=31536000, immutable" } });
});
