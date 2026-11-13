"use client";
import { useEffect, useRef } from "react";
import { TONE_CONTOURS, TONE_LABELS, toChaoScale } from "@/lib/audio";
import { useRecorder } from "@/hooks/useRecorder";

/** رسم منحنى نغمة: المرجعي (منقط) وصوت المتعلم (متصل) */
export function ToneCurve({ tone, user, w = 220, h = 90 }: { tone?: number; user?: number[]; w?: number; h?: number }) {
  const y = (v: number) => h - 8 - ((v - 1) / 4) * (h - 16);
  const line = (vals: number[]) => vals.map((v, i) => `${8 + (i / Math.max(1, vals.length - 1)) * (w - 16)},${y(v)}`).join(" ");
  const ref = tone ? TONE_CONTOURS[tone] : undefined;
  const smooth = user && user.length > 4 ? user.map((_, i, a) => a.slice(Math.max(0, i - 2), i + 3).reduce((s, x, _j, arr) => s + x / arr.length, 0)) : user;
  return (
    <svg width={w} height={h} className="rounded-xl bg-card-2" viewBox={`0 0 ${w} ${h}`}>
      {[1, 2, 3, 4, 5].map((l) => (
        <line key={l} x1={8} x2={w - 8} y1={y(l)} y2={y(l)} stroke="var(--line)" strokeWidth={1} strokeDasharray="2 4" />
      ))}
      {ref && <polyline points={line(ref)} fill="none" stroke="var(--gold)" strokeWidth={4} strokeDasharray="8 6" strokeLinecap="round" />}
      {smooth && smooth.length > 1 && <polyline points={line(smooth)} fill="none" stroke="var(--gem)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

export function ToneIcon({ tone, size = 40 }: { tone: number; size?: number }) {
  const pts = TONE_CONTOURS[tone];
  const y = (v: number) => size - 6 - ((v - 1) / 4) * (size - 12);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polyline
        points={pts.map((v, i) => `${6 + (i / (pts.length - 1)) * (size - 12)},${y(v)}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** لوحة تدريب النغمة بالميكروفون: تقارن منحنى صوتك بالمنحنى الصحيح */
export function PitchPractice({ tone }: { tone: number }) {
  const r = useRecorder();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const user = toChaoScale(r.pitch);
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <ToneCurve tone={tone} user={user} />
      <div className="text-xs text-muted">
        <span className="text-gold">- - -</span> النغمة {TONE_LABELS[tone].name} · <span className="text-gem">—</span> صوتك
      </div>
      <button
        className={`btn ${r.recording ? "btn-bad" : "btn-ghost"}`}
        onClick={async () => {
          if (r.recording) await r.stop();
          else {
            await r.start();
            timer.current = setTimeout(() => r.stop(), 1800);
          }
        }}
      >
        {r.recording ? "⏹ إيقاف" : "🎤 جرّب نطقها وارسم صوتك"}
      </button>
      {r.error && <div className="text-xs text-bad">{r.error}</div>}
    </div>
  );
}
