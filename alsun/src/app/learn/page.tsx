"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { getCourse, stages, unitsOf, type PathLesson } from "@/content";
import { useGame } from "@/components/GameProvider";
import { LangSwitcher, useActiveLang } from "@/components/LangSwitcher";
import { Bar, TopStats } from "@/components/ui";
import { useProgress } from "@/lib/progress";

const KIND_ICON: Record<string, string> = { script: "🔤", tones: "🎵", vocab: "📖", phrases: "💬", boss: "🐉", ai: "✨" };

export default function LearnPage() {
  const { state } = useGame();
  const [lang] = useActiveLang();
  const course = getCourse(lang);
  const prog = useProgress(lang);
  const freeRoam = Boolean(state?.profile.settings?.freeRoam);
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<PathLesson | null>(null);

  const byId = useMemo(() => new Map(prog.path.map((p) => [p.lesson.id, p])), [prog.path]);
  useEffect(() => {
    if (prog.next) setOpen(prog.next.level.code);
  }, [prog.next?.level.code, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!prog.loading && prog.next) document.getElementById(`node-${prog.next.lesson.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [prog.loading, open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <TopStats />
      <main className="px-4 pt-4">
        <LangSwitcher />
        <div className="mt-2 text-xs text-muted">
          الإطار: {course.framework === "CEFR" ? "الإطار الأوروبي المرجعي CEFR (A1 ← C2)" : "معيار HSK 3.0 الصيني (1 ← 9)"}
        </div>

        {stages(course).map((level) => {
          const units = unitsOf(course, level);
          const lessons = units.flatMap((u) => u.lessons);
          const doneN = lessons.filter((l) => prog.done(l.id)).length;
          const isOpen = open === level.code;
          const ai = level.units.length === 0;
          return (
            <section key={level.code} className="mt-5">
              <button onClick={() => setOpen(isOpen ? null : level.code)} className="card flex w-full items-center gap-3 p-4 text-right" style={{ borderColor: isOpen ? course.color : undefined }}>
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-black" style={{ background: `color-mix(in oklab, ${course.color} 28%, var(--card-2))` }}>
                  {level.code === "FOUNDATION" ? "⛩️" : level.code.replace("HSK", "")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-black">
                    {level.region} <span className="text-sm font-bold text-muted">· {level.code === "FOUNDATION" ? level.title : `${level.code} ${level.title}`}</span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted">{level.description}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Bar value={doneN / lessons.length} color={course.color} className="h-1.5" />
                    <span className="shrink-0 text-[10px] text-muted">
                      {doneN}/{lessons.length}
                    </span>
                    {ai && <span className="shrink-0 rounded bg-xp/20 px-1.5 text-[10px] font-bold text-xp">✨ مولَّد</span>}
                  </div>
                </div>
                <span className={`transition ${isOpen ? "rotate-90" : ""}`}>◀</span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    {level.canDo.length > 0 && (
                      <ul className="mt-3 space-y-1 rounded-2xl bg-card-2/50 p-3 text-xs text-muted">
                        {level.canDo.map((c) => (
                          <li key={c}>🎯 {c}</li>
                        ))}
                      </ul>
                    )}
                    {units.map((u) => (
                      <div key={u.id} className="mt-6">
                        <div className="flex items-center gap-3 rounded-2xl px-3 py-2" style={{ background: `color-mix(in oklab, ${course.color} 16%, transparent)` }}>
                          <span className="text-3xl">{u.icon}</span>
                          <div className="min-w-0">
                            <div className="font-black">{u.title}</div>
                            <div className="truncate text-xs text-muted">{u.description}</div>
                          </div>
                        </div>
                        <div className="relative mt-10 flex flex-col items-center gap-6 pb-2">
                          {u.lessons.map((l, i) => {
                            const p = byId.get(l.id)!;
                            const unlocked = prog.unlocked(p, freeRoam);
                            const row = prog.rows?.get(l.id);
                            const isNext = prog.next?.lesson.id === l.id;
                            const boss = l.kind === "boss";
                            const offset = Math.sin((p.index + i) * 1.15) * 70;
                            return (
                              <motion.button
                                id={`node-${l.id}`}
                                key={l.id}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => setSelected(p)}
                                style={{ transform: `translateX(${offset}px)` }}
                                className="relative"
                              >
                                {isNext && (
                                  <motion.div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-gold px-2 py-0.5 text-xs font-black text-black" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}>
                                    ابدأ هنا
                                  </motion.div>
                                )}
                                <div
                                  className={`grid place-items-center rounded-full border-4 text-3xl ${boss ? "h-24 w-24" : "h-18 w-18"} ${unlocked ? "" : "grayscale opacity-40"}`}
                                  style={{
                                    borderColor: row?.crowns ? "var(--gold)" : unlocked ? course.color : "var(--line)",
                                    background: row?.crowns ? "color-mix(in oklab, var(--gold) 25%, var(--card))" : unlocked ? `color-mix(in oklab, ${course.color} 35%, var(--card))` : "var(--card)",
                                    boxShadow: unlocked ? `0 6px 0 color-mix(in oklab, ${row?.crowns ? "var(--gold)" : course.color} 50%, black)` : "0 6px 0 var(--line)",
                                  }}
                                >
                                  {unlocked ? KIND_ICON[l.kind] : "🔒"}
                                </div>
                                {row?.crowns ? <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs">{"👑".repeat(row.crowns)}</div> : null}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </main>

      <AnimatePresence>
        {selected && (
          <motion.div className="fixed inset-0 z-[55] flex items-end bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}>
            <motion.div
              className="card safe-bottom mx-auto w-full max-w-3xl rounded-b-none p-6"
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragEnd={(_, i) => i.offset.y > 80 && setSelected(null)}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
              <div className="text-xs text-muted">
                {selected.unit.title} · {selected.level.code === "FOUNDATION" ? "التأسيس" : selected.level.code}
              </div>
              <div className="mt-1 text-2xl font-black">
                {KIND_ICON[selected.lesson.kind]} {selected.lesson.title}
              </div>
              <div className="mt-2 text-sm text-muted">
                {selected.lesson.kind === "boss"
                  ? "معركة شاملة لكل ما في الوحدة. لديك 3 دروع — كل خطأ يكسر درعاً. اهزم الزعيم لتحصل على خبرة مضاعفة!"
                  : selected.lesson.kind === "ai"
                    ? `درس يولّده الذكاء الاصطناعي حول «${selected.lesson.aiTopic}» مع قاعدة «${selected.lesson.aiGrammar}» ويُحفظ لك بعد أول مرة.`
                    : `${selected.lesson.items.length} عنصراً جديداً`}
              </div>
              {prog.rows?.get(selected.lesson.id) && (
                <div className="mt-2 text-sm text-gold">
                  {"👑".repeat(prog.rows.get(selected.lesson.id)!.crowns)} · أفضل دقة {Math.round(prog.rows.get(selected.lesson.id)!.bestAccuracy * 100)}%
                </div>
              )}
              {prog.unlocked(selected, freeRoam) ? (
                <Link href={`/lesson/${lang}/${encodeURIComponent(selected.lesson.id)}`} className="btn btn-gold mt-5 w-full text-lg">
                  {prog.done(selected.lesson.id) ? "تدرّب مجدداً (+تاج)" : "ابدأ الدرس"}
                </Link>
              ) : (
                <div className="btn btn-ghost mt-5 w-full">🔒 أكمل الدرس السابق أولاً</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
