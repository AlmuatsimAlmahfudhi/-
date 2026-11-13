"use client";
import type { LangCode } from "@/content";
import { ready } from "./claude";

const BCP: Record<LangCode, string> = { en: "en-US", fr: "fr-FR", es: "es-ES", zh: "zh-CN" };

function pickVoice(lang: LangCode): SpeechSynthesisVoice | undefined {
  try {
    if (typeof speechSynthesis === "undefined") return;
    const want = BCP[lang].toLowerCase();
    const base = want.split("-")[0];
    const cands = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(base));
    const score = (v: SpeechSynthesisVoice) => (v.lang.toLowerCase().replace("_", "-") === want ? 4 : 0) + (/natural|neural|premium|enhanced|google/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
    return cands.sort((a, b) => score(b) - score(a))[0];
  } catch {
    return undefined;
  }
}

export const hasBrowserVoice = (lang: LangCode) => Boolean(pickVoice(lang));
export function setAiTtsAvailable(_v: boolean) {}

/** صوت الجهاز أولاً، وإلا صوت Claude المدمج */
export async function speak(lang: LangCode, text: string, opts: { slow?: boolean } = {}): Promise<void> {
  const clean = lang === "zh" ? text.replace(/\s+/g, "") : text;
  stopSpeaking();
  const voice = pickVoice(lang);
  if (voice) {
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = BCP[lang];
      u.voice = voice;
      u.rate = opts.slow ? 0.55 : lang === "zh" ? 0.8 : 0.9;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
    return;
  }
  const t = ready.tts;
  if (!t) return;
  try {
    await t.speak(clean, { language: BCP[lang].split("-")[0], rate: opts.slow ? 0.7 : 0.9 });
  } catch {}
}

export function stopSpeaking() {
  try {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    ready.tts?.stop?.();
  } catch {}
}

try {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
  }
} catch {}
