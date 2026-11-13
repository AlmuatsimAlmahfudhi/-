"use client";
/** أدوات الصوت: تحويل التسجيل إلى WAV، ترميز PCM، واكتشاف درجة الصوت لرسم منحنى النغمات */

export async function blobToWav16k(blob: Blob): Promise<Blob> {
  const buf = await blob.arrayBuffer();
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(buf);
  ctx.close();
  const rate = 16000;
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return new Blob([encodeWav(rendered.getChannelData(0), rate)], { type: "audio/wav" });
}

export function encodeWav(samples: Float32Array, rate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function floatToPcm16Base64(f: Float32Array): string {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(out.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function pcm16Base64ToFloat(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
  const f = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 0x8000;
  return f;
}

/** تقدير التردد الأساسي (F0) بالارتباط الذاتي — يكفي لرسم منحنيات النغمات الصينية */
export function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  let rms = 0;
  for (const x of buf) rms += x * x;
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.012) return null;
  const minLag = Math.floor(sampleRate / 450);
  const maxLag = Math.floor(sampleRate / 70);
  let best = -1;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i < buf.length - lag; i++) c += buf[i] * buf[i + lag];
    if (c > bestCorr) {
      bestCorr = c;
      best = lag;
    }
  }
  let energy = 0;
  for (const x of buf) energy += x * x;
  if (best < 0 || bestCorr / energy < 0.3) return null;
  return sampleRate / best;
}

/** منحنيات النغمات المرجعية على سلم من 1 (منخفض) إلى 5 (عالٍ) — نظام Chao */
export const TONE_CONTOURS: Record<number, number[]> = {
  1: [5, 5, 5, 5, 5],
  2: [3, 3.5, 4, 4.5, 5],
  3: [2, 1.4, 1, 2, 4],
  4: [5, 4, 3, 2, 1],
  5: [3, 3, 3],
};

export const TONE_LABELS: Record<number, { name: string; mark: string }> = {
  1: { name: "الأولى ـ مستوية", mark: "ˉ" },
  2: { name: "الثانية ـ صاعدة", mark: "ˊ" },
  3: { name: "الثالثة ـ منخفضة", mark: "ˇ" },
  4: { name: "الرابعة ـ هابطة", mark: "ˋ" },
  5: { name: "الخفيفة", mark: "·" },
};

/** يحوّل سلسلة ترددات إلى سلم 1..5 نسبةً لمدى صوت المتكلم */
export function toChaoScale(freqs: number[]): number[] {
  if (freqs.length < 3) return [];
  const st = freqs.map((f) => 12 * Math.log2(f));
  const sorted = [...st].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.05)];
  const hi = sorted[Math.floor(sorted.length * 0.95)];
  const span = Math.max(4, hi - lo); // مدى أدنى 4 أنصاف نغمات لتفادي تضخيم الرعشة
  const mid = (hi + lo) / 2;
  return st.map((s) => Math.max(1, Math.min(5, 3 + ((s - mid) / span) * 4)));
}
