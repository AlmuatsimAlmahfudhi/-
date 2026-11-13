"use client";
import { ready } from "./claude";

/** الإملاء الصوتي من claude.ai (Chrome على الحاسوب وتطبيق سطح المكتب) */
export function speechRecognitionAvailable() {
  return Boolean(ready.dictation);
}

/** يبدأ الاستماع فوراً (يجب استدعاؤه من النقرة مباشرة) ويعيد ما قيل بعد توقف قصير */
export function recognizeOnce(bcp47: string, timeoutMs = 8000): Promise<string[]> {
  const d = ready.dictation;
  if (!d) return Promise.reject(new Error("unsupported"));
  let text = "";
  let partial = "";
  let silence: ReturnType<typeof setTimeout> | undefined;
  const startP = d.start({ language: bcp47 });
  return new Promise((resolve, reject) => {
    const subs: (() => void)[] = [];
    const finish = async () => {
      clearTimeout(silence);
      clearTimeout(hard);
      try {
        await d.stop();
      } catch {}
      subs.forEach((u) => u());
      const out = (text || partial).trim();
      resolve(out ? [out] : []);
    };
    const bump = () => {
      clearTimeout(silence);
      silence = setTimeout(finish, 1400);
    };
    subs.push(d.onFinal(({ text: t }: { text: string }) => { text += t; bump(); }));
    subs.push(d.onPartial(({ text: t }: { text: string }) => { partial = t; if (t) bump(); }));
    const hard = setTimeout(finish, timeoutMs);
    startP.catch((e: { code?: string }) => {
      clearTimeout(hard);
      subs.forEach((u) => u());
      reject(new Error(e?.code === "unavailable" ? "unsupported" : e?.code ?? "error"));
    });
  });
}
