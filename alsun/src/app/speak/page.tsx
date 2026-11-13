"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { getCourse } from "@/content";
import { SCENARIOS, type Scenario } from "@/content/scenarios";
import { useGame } from "@/components/GameProvider";
import { LangSwitcher, useActiveLang } from "@/components/LangSwitcher";
import { Empty, Foreign, TopStats } from "@/components/ui";
import { useLiveConversation } from "@/hooks/useLiveConversation";
import { api } from "@/lib/api";
import type { GameEvent } from "@/server/game";

const ORDER = ["FOUNDATION", "A1", "A2", "B1", "B2", "C1", "C2"];
const HSK_TO_CEFR: Record<string, string> = { HSK1: "A1", HSK2: "A1", HSK3: "A2", HSK4: "B1", HSK5: "B2", HSK6: "B2", HSK7: "C1", HSK8: "C1", HSK9: "C2" };

interface Feedback {
  score: number;
  summary: string;
  strengths: string[];
  corrections: { said: string; better: string; why: string }[];
  newWords: { text: string; ar: string; reading: string }[];
}

export default function SpeakPage() {
  const { state, ai, handleEvents, refresh } = useGame();
  const [lang] = useActiveLang();
  const course = getCourse(lang);
  const level = state?.languages.find((l) => l.lang === lang)?.currentLevel ?? "FOUNDATION";
  const cefr = HSK_TO_CEFR[level] ?? level;
  const live = useLiveConversation();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [saving, setSaving] = useState(false);
  const [typed, setTyped] = useState("");
  const sendText = (live as { sendText?: (t: string) => void }).sendText;
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [live.turns.length]);

  const begin = (s: Scenario) => {
    setScenario(s);
    setFeedback(null);
    live.start({ lang, level, scenario: s.id });
  };

  const end = async () => {
    const duration = live.stop();
    if (!scenario) return;
    setSaving(true);
    try {
      const r = await api<{ feedback: Feedback | null; events: GameEvent[] }>("/api/conversation", { lang, level, scenarioId: scenario.id, durationSec: duration, transcript: live.turns });
      setFeedback(r.feedback);
      handleEvents(r.events);
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const inSession = live.status === "connecting" || live.status === "live";

  if (ai && !ai.enabled)
    return (
      <>
        <TopStats />
        <main className="px-4 pt-6">
          <Empty icon="🔮" title="المحادثة الصوتية تحتاج مفتاح Gemini">
            <span className="leading-7">
              أنشئ مفتاحاً مجانياً من Google AI Studio، وضعه في ملف <span className="foreign">.env.local</span> بالشكل:
              <br />
              <code className="foreign mt-2 inline-block rounded bg-card-2 px-2 py-1">GEMINI_API_KEY=...</code>
              <br />
              ثم أعد تشغيل الموقع.
            </span>
          </Empty>
        </main>
      </>
    );

  return (
    <>
      <TopStats />
      <main className="px-4 pt-4">
        {!scenario || (!inSession && !saving && !feedback && live.status !== "error") ? (
          <>
            <h1 className="text-2xl font-black">🎙️ ساحة المحادثة</h1>
            <p className="mt-1 text-sm text-muted">محادثة صوتية فورية مع شخصيات بالذكاء الاصطناعي، تتكيف مع مستواك ({level}) وتستعمل كلماتك المحفوظة.</p>
            <div className="mt-4">
              <LangSwitcher />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SCENARIOS.map((s) => {
                const ready = ORDER.indexOf(cefr) >= ORDER.indexOf(s.minLevel) || s.minLevel === "A1";
                return (
                  <motion.button whileTap={{ scale: 0.97 }} key={s.id} onClick={() => begin(s)} className={`card flex items-center gap-3 p-4 text-right ${ready ? "" : "opacity-60"}`}>
                    <span className="text-4xl">{s.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-black">{s.title}</div>
                      <div className="text-xs text-muted">{s.goal}</div>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold ${ready ? "bg-good/20 text-good" : "bg-card-2 text-muted"}`}>{s.minLevel}+</span>
                  </motion.button>
                );
              })}
            </div>
            <p className="mt-6 text-xs leading-6 text-muted">
              💡 استعمل سماعة أذن لأفضل نتيجة. يمكنك مقاطعة الشريك في أي لحظة كما في محادثة حقيقية. إن علقت، قل كلمة بالعربية وسيساعدك.
            </p>
          </>
        ) : (
          <div className="flex min-h-[70dvh] flex-col">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{scenario.icon}</span>
              <div className="flex-1">
                <div className="font-black">{scenario.title}</div>
                <div className="text-xs text-muted">🎯 {scenario.goal}</div>
              </div>
              <span className="text-2xl">{course.flag}</span>
            </div>

            <div className="my-6 grid place-items-center">
              <motion.div
                animate={{ scale: live.aiSpeaking ? [1, 1.12, 1] : 1 + live.micLevel * 0.25 }}
                transition={live.aiSpeaking ? { repeat: Infinity, duration: 0.9 } : { duration: 0.08 }}
                className="grid h-36 w-36 place-items-center rounded-full text-6xl"
                style={{
                  background: `radial-gradient(circle at 35% 30%, ${course.color}, color-mix(in oklab, ${course.color} 30%, var(--bg)))`,
                  boxShadow: `0 0 ${30 + live.micLevel * 80}px ${course.color}`,
                }}
              >
                {live.status === "connecting" ? "⏳" : live.aiSpeaking ? "🗣️" : live.muted ? "🔇" : "👂"}
              </motion.div>
              <div className="mt-3 text-sm text-muted">
                {live.status === "connecting" ? "جارٍ الاتصال…" : live.status === "live" ? (live.aiSpeaking ? "الشريك يتكلم…" : "دورك — تكلّم الآن") : saving ? "جارٍ التقييم…" : live.status === "error" ? "" : "انتهت المحادثة"}
              </div>
              {live.error && <div className="mt-2 max-w-sm text-center text-sm text-bad">{live.error}</div>}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {live.turns.map((t, i) => (
                <div key={i} className={`flex ${t.role === "user" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${t.role === "user" ? "bg-accent/25" : "bg-card-2"}`}>
                    <Foreign lang={lang}>{t.text}</Foreign>
                  </div>
                </div>
              ))}
              <div ref={bottom} />
            </div>

            {inSession && sendText && live.status === "live" && (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendText(typed);
                  setTyped("");
                }}
              >
                <input id="typed-reply" dir="auto" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="أو اكتب ردك هنا…" className="min-w-0 flex-1 rounded-xl border border-line bg-card-2 px-3 py-2" />
                <button className="btn btn-ghost !min-h-10" disabled={!typed.trim()}>
                  إرسال
                </button>
              </form>
            )}
            {inSession ? (
              <div className="sticky bottom-24 mt-4 flex gap-3">
                <button className="btn btn-ghost" onClick={() => live.setMuted(!live.muted)}>
                  {live.muted ? "🔇 مكتوم" : "🎤 مفتوح"}
                </button>
                <button className="btn btn-bad flex-1" onClick={end}>
                  إنهاء المحادثة والتقييم
                </button>
              </div>
            ) : (
              <AnimatePresence>
                {feedback && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card mt-4 p-5">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-black">📋 تقرير المحادثة</div>
                      <div className={`text-3xl font-black ${feedback.score >= 75 ? "text-good" : feedback.score >= 50 ? "text-gold" : "text-bad"}`}>{feedback.score}</div>
                    </div>
                    <p className="mt-2 leading-7">{feedback.summary}</p>
                    {feedback.strengths.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm text-good">
                        {feedback.strengths.map((s) => (
                          <li key={s}>✓ {s}</li>
                        ))}
                      </ul>
                    )}
                    {feedback.corrections.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <div className="font-bold">✍️ تصحيحات</div>
                        {feedback.corrections.map((c, i) => (
                          <div key={i} className="rounded-xl bg-card-2 p-3 text-sm">
                            <div className="text-bad line-through">
                              <Foreign lang={lang}>{c.said}</Foreign>
                            </div>
                            <div className="font-bold text-good">
                              <Foreign lang={lang}>{c.better}</Foreign>
                            </div>
                            <div className="mt-1 text-muted">{c.why}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {feedback.newWords.length > 0 && (
                      <div className="mt-4 text-sm">
                        <div className="font-bold">🗃️ أُضيفت إلى مراجعتك:</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {feedback.newWords.map((w) => (
                            <span key={w.text} className="rounded-lg bg-xp/15 px-2 py-1">
                              <Foreign lang={lang}>{w.text}</Foreign> — {w.ar}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
                <div className="mt-4 flex gap-3">
                  <button className="btn btn-gold flex-1" onClick={() => begin(scenario)}>
                    ↻ محادثة جديدة
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setScenario(null);
                      setFeedback(null);
                    }}
                  >
                    السيناريوهات
                  </button>
                </div>
              </AnimatePresence>
            )}
          </div>
        )}
      </main>
    </>
  );
}
