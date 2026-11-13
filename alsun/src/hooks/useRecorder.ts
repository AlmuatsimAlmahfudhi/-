"use client";
import { useCallback, useRef, useState } from "react";
import { blobToWav16k, detectPitch } from "@/lib/audio";

/** تسجيل من الميكروفون مع تتبع درجة الصوت لحظياً (لمنحنى النغمات) */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [pitch, setPitch] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const raf = useRef(0);
  const cleanup = useRef<() => void>(() => {});
  const resolver = useRef<((b: Blob | null) => void) | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setPitch([]);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("insecure");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      const freqs: number[] = [];
      const loop = () => {
        an.getFloatTimeDomainData(buf);
        let rms = 0;
        for (const x of buf) rms += x * x;
        setLevel(Math.min(1, Math.sqrt(rms / buf.length) * 8));
        const f = detectPitch(buf, ctx.sampleRate);
        if (f) {
          freqs.push(f);
          setPitch([...freqs]);
        }
        raf.current = requestAnimationFrame(loop);
      };
      loop();
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks.current, { type: mr.mimeType });
        cleanup.current();
        try {
          resolver.current?.(await blobToWav16k(blob));
        } catch {
          resolver.current?.(blob);
        }
      };
      cleanup.current = () => {
        cancelAnimationFrame(raf.current);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        setLevel(0);
      };
      mr.start();
      rec.current = mr;
      setRecording(true);
    } catch (e) {
      setError(
        e instanceof Error && e.message === "insecure"
          ? "الميكروفون يتطلب اتصالاً آمناً: افتح الموقع عبر https أو localhost"
          : "تعذّر الوصول إلى الميكروفون — اسمح للموقع باستخدامه من إعدادات المتصفح",
      );
    }
  }, []);

  const stop = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        resolver.current = resolve;
        setRecording(false);
        if (rec.current && rec.current.state !== "inactive") rec.current.stop();
        else resolve(null);
      }),
    [],
  );

  return { recording, level, pitch, error, start, stop };
}
