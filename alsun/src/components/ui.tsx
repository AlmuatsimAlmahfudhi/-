"use client";
import { motion } from "motion/react";
import type { LangCode } from "@/content";
import { speak } from "@/lib/speech";
import { useGame } from "./GameProvider";

export function Foreign({ lang, children, className = "" }: { lang: LangCode; children: React.ReactNode; className?: string }) {
  return (
    <span lang={lang} dir="ltr" className={`foreign ${className}`}>
      {children}
    </span>
  );
}

export function SpeakButton({ lang, text, size = "md", slow }: { lang: LangCode; text: string; size?: "sm" | "md" | "lg"; slow?: boolean }) {
  const s = size === "lg" ? "h-20 w-20 text-4xl" : size === "sm" ? "h-9 w-9 text-lg" : "h-12 w-12 text-2xl";
  return (
    <button
      type="button"
      aria-label="استمع"
      onClick={(e) => {
        e.stopPropagation();
        speak(lang, text, { slow });
      }}
      className={`grid shrink-0 place-items-center rounded-2xl bg-accent text-white shadow-[0_4px_0_color-mix(in_oklab,var(--accent)_55%,black)] active:translate-y-0.5 ${s}`}
    >
      {slow ? "🐢" : "🔊"}
    </button>
  );
}

export function Bar({ value, color = "var(--gold)", className = "h-3" }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`w-full overflow-hidden rounded-full bg-card-2 ${className}`}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={false} animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} transition={{ type: "spring", damping: 20 }} />
    </div>
  );
}

/** الشريط العلوي: السلسلة، الأحجار، الخبرة */
export function TopStats() {
  const { state } = useGame();
  if (!state) return <div className="h-14" />;
  const p = state.profile;
  const boost = p.xpBoostUntil && p.xpBoostUntil > Date.now();
  return (
    <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-line/60 bg-bg/80 px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 font-black" title="السلسلة اليومية">
        <span className={p.streak > 0 ? "" : "grayscale"}>🔥</span>
        <span className="text-fire">{p.streak}</span>
      </div>
      <div className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 font-black" title="الأحجار الكريمة">
        <span>💎</span>
        <span className="text-gem">{p.gems}</span>
      </div>
      {boost && <div className="rounded-full bg-xp/20 px-2 py-1 text-xs font-bold text-xp">🧪 ×2</div>}
      <div className="mr-auto flex min-w-0 flex-1 items-center gap-2 ps-2">
        <span className="rounded-lg bg-gold px-2 py-0.5 text-sm font-black text-black">{state.level.level}</span>
        <Bar value={state.level.progress} color="linear-gradient(90deg,var(--xp),var(--accent))" className="h-2.5" />
      </div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between">
      <h2 className="text-lg font-black">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <div className="text-5xl">{icon}</div>
      <div className="mt-3 text-lg font-bold">{title}</div>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}
