"use client";
/** التعرف على الكلام المدمج في المتصفح (Chrome/Edge/Safari) — بديل مجاني يعمل بلا مفتاح */
type SR = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function speechRecognitionAvailable() {
  return typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

export function recognizeOnce(bcp47: string, timeoutMs = 7000): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return reject(new Error("unsupported"));
    const r = new Ctor();
    r.lang = bcp47;
    r.interimResults = false;
    r.maxAlternatives = 5;
    let done = false;
    const t = setTimeout(() => r.stop(), timeoutMs);
    r.onresult = (e) => {
      done = true;
      clearTimeout(t);
      const alts = Array.from(e.results[0] ?? []).map((a) => a.transcript);
      resolve(alts);
    };
    r.onerror = (e) => {
      clearTimeout(t);
      if (!done) reject(new Error(e.error));
    };
    r.onend = () => {
      clearTimeout(t);
      if (!done) resolve([]);
    };
    r.start();
  });
}
