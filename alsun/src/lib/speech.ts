"use client";
import type { LangCode } from "@/content";

const BCP: Record<LangCode, string> = { en: "en-US", fr: "fr-FR", es: "es-ES", zh: "zh-CN" };

function pickVoice(lang: LangCode): SpeechSynthesisVoice | undefined {
  if (typeof speechSynthesis === "undefined") return;
  const voices = speechSynthesis.getVoices();
  const want = BCP[lang].toLowerCase();
  const base = want.split("-")[0];
  const cands = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(base));
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang.toLowerCase().replace("_", "-") === want ? 4 : 0) + (/natural|neural|premium|enhanced|google/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
  return cands.sort((a, b) => score(b) - score(a))[0];
}

export function hasBrowserVoice(lang: LangCode) {
  return Boolean(pickVoice(lang));
}

let current: HTMLAudioElement | null = null;
let aiAvailable = false;
/** يُضبط من مزوّد الحالة: هل مفتاح Gemini متاح لنطق عالي الجودة؟ */
export function setAiTtsAvailable(v: boolean) {
  aiAvailable = v;
}

function aiTtsPreferred() {
  try {
    return localStorage.getItem("alsun-tts") === "gemini";
  } catch {
    return false;
  }
}

/** ينطق النص: صوت المتصفح أولاً (مجاني وفوري)، أو Gemini عند تفعيله أو عند غياب صوت مناسب */
export async function speak(lang: LangCode, text: string, opts: { slow?: boolean } = {}): Promise<void> {
  const clean = lang === "zh" ? text.replace(/\s+/g, "") : text;
  stopSpeaking();
  const voice = pickVoice(lang);
  if (!voice && !aiAvailable) return; // لا صوت مثبت لهذه اللغة ولا مفتاح Gemini
  if (aiAvailable && (aiTtsPreferred() || !voice)) {
    try {
      current = new Audio(`/api/ai/tts?lang=${lang}&text=${encodeURIComponent(clean)}`);
      current.playbackRate = opts.slow ? 0.75 : 1;
      await current.play();
      await new Promise<void>((r) => current!.addEventListener("ended", () => r(), { once: true }));
      return;
    } catch {
      if (!voice) return;
    }
  }
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = BCP[lang];
    if (voice) u.voice = voice;
    u.rate = opts.slow ? 0.55 : lang === "zh" ? 0.8 : 0.9;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  if (current) {
    current.pause();
    current = null;
  }
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
