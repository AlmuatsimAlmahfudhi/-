"use client";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { titleFor } from "@/lib/game-rules";
import type { GameEvent, Snapshot } from "@/server/game";
import { sfx } from "@/lib/sfx";
import { setAiTtsAvailable } from "@/lib/speech";

interface Ctx {
  state: Snapshot | null;
  ai: { enabled: boolean } | null;
  refresh: () => Promise<void>;
  handleEvents: (events: GameEvent[] | undefined) => void;
  toast: (text: string, icon?: string) => void;
}
const GameCtx = createContext<Ctx>(null as never);
export const useGame = () => useContext(GameCtx);

type Toast = { id: number; text: string; icon: string; sub?: string; tone: "gold" | "fire" | "gem" | "plain" };

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Snapshot | null>(null);
  const [ai, setAi] = useState<{ enabled: boolean } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const tid = useRef(0);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++tid.current;
    setToasts((x) => [...x, { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 3800);
  }, []);

  const handleEvents = useCallback(
    (events: GameEvent[] | undefined) => {
      for (const e of events ?? []) {
        if (e.type === "levelUp") {
          setLevelUp(e.level);
          sfx("levelup");
          confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 }, colors: ["#f5c542", "#a78bfa", "#38bdf8"] });
        } else if (e.type === "achievement") {
          sfx("achievement");
          pushToast({ icon: e.icon, text: `إنجاز جديد: ${e.name}`, sub: `+${e.reward} 💎`, tone: "gold" });
        } else if (e.type === "quest") pushToast({ icon: "📜", text: `مهمة مكتملة: ${e.text}`, sub: `+${e.reward} 💎`, tone: "gem" });
        else if (e.type === "streak")
          pushToast({
            icon: e.freezeUsed ? "🛡️" : "🔥",
            text: e.freezeUsed ? `درع السلسلة حمى سلسلتك (${e.streak} يوماً)` : `السلسلة: ${e.streak} ${e.streak === 1 ? "يوم" : "أيام"}!`,
            tone: "fire",
          });
        else if (e.type === "goal") pushToast({ icon: "🎯", text: "حققت هدفك اليومي!", tone: "plain" });
      }
    },
    [pushToast],
  );

  const refresh = useCallback(async () => {
    const s = await api<Snapshot>("/api/state");
    setState(s);
    handleEvents(s.events);
  }, [handleEvents]);

  useEffect(() => {
    refresh().catch(console.error);
    api<{ enabled: boolean }>("/api/ai/status")
      .then((s) => {
        setAiTtsAvailable(s.enabled);
        setAi(s);
      })
      .catch(() => setAi({ enabled: false }));
    try {
      const t = localStorage.getItem("alsun-theme");
      if (t) document.documentElement.dataset.theme = t;
    } catch {}
  }, [refresh]);

  return (
    <GameCtx.Provider value={{ state, ai, refresh, handleEvents, toast: (text, icon = "ℹ️") => pushToast({ text, icon, tone: "plain" }) }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ y: -30, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="card flex w-full max-w-md items-center gap-3 px-4 py-3 shadow-2xl"
              style={{ borderColor: t.tone === "gold" ? "var(--gold)" : t.tone === "fire" ? "var(--fire)" : t.tone === "gem" ? "var(--gem)" : "var(--line)" }}
            >
              <span className="text-2xl">{t.icon}</span>
              <div className="flex-1 text-sm font-bold">{t.text}</div>
              {t.sub && <span className="text-sm font-bold text-gem">{t.sub}</span>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {levelUp && (
          <motion.div
            className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLevelUp(null)}
          >
            <motion.div initial={{ scale: 0.5, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", damping: 12 }} className="card w-full max-w-sm p-8 text-center" style={{ borderColor: "var(--gold)" }}>
              <div className="text-7xl">⭐</div>
              <div className="mt-3 text-lg text-muted">ارتقيت إلى المستوى</div>
              <div className="text-6xl font-black text-gold">{levelUp}</div>
              <div className="mt-2 text-xl font-bold">{titleFor(levelUp)}</div>
              <div className="mt-2 text-sm text-gem">+{10} 💎 مكافأة الارتقاء</div>
              <button className="btn btn-gold mt-6 w-full">رائع!</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GameCtx.Provider>
  );
}
