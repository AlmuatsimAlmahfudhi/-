"use client";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { COURSES, display, LANGS, type LangCode } from "@/content";
import { useGame } from "@/components/GameProvider";
import { Empty, Foreign, SpeakButton, TopStats } from "@/components/ui";
import { api } from "@/lib/api";
import { speak } from "@/lib/speech";
import { sfx } from "@/lib/sfx";
import type { GameEvent } from "@/server/game";

interface Card {
  id: string;
  lang: LangCode;
  front: string;
  back: string;
  reading: string | null;
  state: number;
  reps: number;
  preview: Record<1 | 2 | 3 | 4, number>;
}

function fmt(ms: number) {
  const m = ms / 60000;
  if (m < 60) return `${Math.max(1, Math.round(m))} د`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)} س`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)} ي`;
  const mo = d / 30;
  if (mo < 12) return `${Math.round(mo)} ش`;
  return `${(mo / 12).toFixed(1)} سنة`;
}

const RATINGS = [
  { r: 1 as const, label: "نسيت", cls: "btn-bad" },
  { r: 2 as const, label: "صعب", cls: "btn-ghost" },
  { r: 3 as const, label: "جيد", cls: "btn-good" },
  { r: 4 as const, label: "سهل", cls: "btn-gold" },
];

export default function ReviewPage() {
  const { state, handleEvents, refresh } = useGame();
  const [filter, setFilter] = useState<LangCode | "all">("all");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [total, setTotal] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const goodOpacity = useTransform(x, [20, 120], [0, 1]);
  const badOpacity = useTransform(x, [-120, -20], [1, 0]);

  const load = useCallback(async () => {
    const r = await api<{ cards: Card[]; total: number }>(`/api/review${filter === "all" ? "" : `?lang=${filter}`}`);
    setCards(r.cards);
    setTotal(r.total);
    setFlipped(false);
    setReverse(Math.random() < 0.35);
  }, [filter]);
  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const card = cards?.[0];
  useEffect(() => {
    if (card && !reverse) speak(card.lang, card.front);
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rate = async (r: 1 | 2 | 3 | 4) => {
    if (!card) return;
    sfx(r === 1 ? "wrong" : "correct");
    const rest = cards!.slice(1);
    setCards(rest);
    setFlipped(false);
    setReverse(Math.random() < 0.35);
    x.set(0);
    setDoneCount((d) => d + 1);
    const res = await api<{ events: GameEvent[] }>("/api/review", { cardId: card.id, rating: r });
    handleEvents(res.events);
    if (!rest.length) {
      await load();
      refresh();
    }
  };

  return (
    <>
      <TopStats />
      <main className="px-4 pt-4">
        <h1 className="text-2xl font-black">🔁 المراجعة المتباعدة</h1>
        <p className="mt-1 text-sm text-muted">خوارزمية FSRS تختار لكل بطاقة اللحظة المثلى قبل أن تنساها. اسحب يميناً إن تذكّرت ويساراً إن نسيت.</p>
        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
          {(["all", ...LANGS] as const).map((l) => (
            <button key={l} onClick={() => setFilter(l)} className={`shrink-0 rounded-xl border-2 px-3 py-1.5 text-sm font-bold ${filter === l ? "border-gold bg-card-2" : "border-line bg-card"}`}>
              {l === "all" ? "الكل" : `${COURSES[l].flag} ${COURSES[l].name}`} {l !== "all" && state?.due[l] ? `(${state.due[l]})` : ""}
            </button>
          ))}
        </div>

        {cards === null ? (
          <div className="mt-20 text-center text-muted">…</div>
        ) : !card ? (
          <div className="mt-8">
            <Empty icon={doneCount ? "🏆" : "🌙"} title={doneCount ? `أنهيت ${doneCount} مراجعة!` : "لا بطاقات مستحقة الآن"}>
              {doneCount ? "ذاكرتك تزداد قوة. عُد لاحقاً للمزيد." : "أكمل دروساً جديدة لتضاف كلماتها هنا تلقائياً."}
            </Empty>
          </div>
        ) : (
          <>
            <div className="mt-4 text-center text-xs text-muted">
              متبقٍّ: {total - doneCount > 0 ? total - doneCount : cards.length} · أنجزت: {doneCount}
            </div>
            <div className="relative mt-3 h-[22rem]">
              <AnimatePresence>
                <motion.div
                  key={card.id}
                  drag={flipped ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, i) => {
                    if (i.offset.x > 110) rate(3);
                    else if (i.offset.x < -110) rate(1);
                  }}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => {
                    if (!flipped) {
                      setFlipped(true);
                      if (reverse) speak(card.lang, card.front);
                    }
                  }}
                  className="card absolute inset-0 flex cursor-pointer select-none flex-col items-center justify-center p-6 text-center"
                  style={{ x, rotate, borderColor: COURSES[card.lang].color }}
                >
                  <motion.div style={{ opacity: goodOpacity }} className="absolute right-4 top-4 rounded-xl border-2 border-good px-3 py-1 font-black text-good">
                    تذكّرت ✓
                  </motion.div>
                  <motion.div style={{ opacity: badOpacity }} className="absolute left-4 top-4 rounded-xl border-2 border-bad px-3 py-1 font-black text-bad">
                    نسيت ✗
                  </motion.div>
                  <div className="absolute right-4 bottom-4 text-xl">{COURSES[card.lang].flag}</div>
                  {card.state === 0 && <div className="absolute left-4 bottom-4 rounded bg-xp/20 px-2 text-xs text-xp">جديدة</div>}
                  {reverse && !flipped ? (
                    <div className="text-3xl font-black">{card.back}</div>
                  ) : (
                    <>
                      <Foreign lang={card.lang} className={`font-black ${card.front.length > 16 ? "text-3xl" : "text-5xl"}`}>
                        {display(card.lang, card.front)}
                      </Foreign>
                      {flipped && card.reading && <div className="mt-2 text-gold">{card.lang === "zh" ? <Foreign lang="en">{card.reading}</Foreign> : card.reading}</div>}
                    </>
                  )}
                  {flipped ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 border-t border-line pt-5">
                      {!reverse ? <div className="text-2xl font-bold">{card.back}</div> : <div className="text-sm text-muted">{card.back}</div>}
                      <div className="mt-3 flex justify-center">
                        <SpeakButton lang={card.lang} text={card.front} size="sm" />
                      </div>
                    </motion.div>
                  ) : (
                    <div className="mt-6 text-sm text-muted">{reverse ? "تذكّر الكلمة بلغة الهدف، ثم اضغط" : "تذكّر المعنى، ثم اضغط لكشفه"}</div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            {flipped ? (
              <div className="mt-5 grid grid-cols-4 gap-2">
                {RATINGS.map((b) => (
                  <button key={b.r} className={`btn ${b.cls} !flex-col !gap-0 !px-1 py-2`} onClick={() => rate(b.r)}>
                    <span>{b.label}</span>
                    <span className="text-[11px] font-normal opacity-80">{fmt(card.preview[b.r])}</span>
                  </button>
                ))}
              </div>
            ) : (
              <button className="btn btn-gold mt-5 w-full text-lg" onClick={() => setFlipped(true)}>
                اكشف الإجابة
              </button>
            )}
          </>
        )}
      </main>
    </>
  );
}
