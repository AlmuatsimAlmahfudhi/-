"use client";
/** مؤثرات صوتية مُركّبة بالمتصفح (بلا ملفات) */
let ctx: AudioContext | null = null;
const tone = (freq: number, at: number, dur: number, type: OscillatorType = "sine", gain = 0.12) => {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime + at);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + at);
  o.stop(ctx.currentTime + at + dur);
};

export type Sfx = "correct" | "wrong" | "levelup" | "achievement" | "hit" | "combo" | "tap" | "win" | "lose";

export function sfx(kind: Sfx) {
  try {
    if (typeof window === "undefined" || localStorage.getItem("alsun-sfx") === "off") return;
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    switch (kind) {
      case "correct": tone(660, 0, 0.12, "triangle"); tone(990, 0.08, 0.18, "triangle"); break;
      case "wrong": tone(220, 0, 0.18, "sawtooth", 0.07); tone(160, 0.1, 0.25, "sawtooth", 0.07); break;
      case "combo": tone(880, 0, 0.08, "square", 0.05); tone(1320, 0.06, 0.12, "square", 0.05); break;
      case "hit": tone(120, 0, 0.15, "square", 0.12); tone(80, 0.05, 0.2, "sawtooth", 0.1); break;
      case "tap": tone(520, 0, 0.05, "sine", 0.05); break;
      case "levelup": [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, "triangle")); break;
      case "achievement": [784, 988, 1175].forEach((f, i) => tone(f, i * 0.09, 0.35, "sine")); break;
      case "win": [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.35, "triangle")); break;
      case "lose": [392, 330, 262].forEach((f, i) => tone(f, i * 0.15, 0.35, "sawtooth", 0.06)); break;
    }
  } catch {}
}
