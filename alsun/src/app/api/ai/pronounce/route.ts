import { db, schema as s } from "@/db";
import { isLang } from "@/content";
import { handler } from "@/server/http";
import { assessPronunciation } from "@/server/ai";

/** يستقبل تسجيلاً صوتياً (multipart) ويعيد تقييماً مفصلاً للنطق والنغمات */
export const POST = handler(async (req) => {
  const form = await req.formData();
  const lang = String(form.get("lang"));
  const target = String(form.get("target"));
  const reading = form.get("reading") ? String(form.get("reading")) : undefined;
  const audio = form.get("audio");
  if (!isLang(lang) || !(audio instanceof Blob)) throw new Error("طلب غير صالح");
  if (audio.size > 8_000_000) throw new Error("التسجيل طويل جداً");
  const b64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
  const mime = (audio.type || "audio/webm").split(";")[0];
  const result = await assessPronunciation(lang, target, reading, b64, mime);
  await db.insert(s.pronunciationAttempts).values({ lang, target, score: result.score, details: result, createdAt: Date.now() });
  return result;
});
