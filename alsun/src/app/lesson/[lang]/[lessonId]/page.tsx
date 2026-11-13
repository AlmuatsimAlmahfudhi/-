"use client";
import confetti from "canvas-confetti";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findLesson, getCourse, isLang, itemsUpTo, type GrammarNote, type Item, type LangCode } from "@/content";
import { useGame } from "@/components/GameProvider";
import { Bar, Foreign } from "@/components/ui";
import { BuildEx, ChoiceEx, IntroCard, MatchEx, SpeakEx, ToneEx, TypeEx, type AnswerResult } from "@/components/lesson/Exercises";
import { api, ApiError } from "@/lib/api";
import { buildExercises, type Exercise } from "@/lib/exercises";
import { comboMultiplier, crownsFor, XP, type Attribute } from "@/lib/game-rules";
import { sfx } from "@/lib/sfx";
import { speechRecognitionAvailable } from "@/hooks/useSpeechRecognition";
import type { AiLesson } from "@/server/ai";
import type { GameEvent } from "@/server/game";

type Phase = "loading" | "grammar" | "play" | "done" | "error";
const BOSSES = ["🐉", "👹", "🧌", "🦂", "🐲", "👺", "🦑", "🗿"];

function GrammarCard({ g, lang, onNext }: { g: GrammarNote; lang: LangCode; onNext: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-4">
      <div className="mb-3 text-sm font-bold text-xp">📜 لوح المعرفة</div>
      <h1 className="text-2xl font-black">{g.title}</h1>
      <div className="mt-4 space-y-3 leading-8">
        {g.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {g.examples?.length ? (
        <div className="card mt-5 divide-y divide-line">
          {g.examples.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-4">
              <Foreign lang={lang} className="text-lg font-bold">
                {e.text}
              </Foreign>
              <span className="text-sm text-muted">{e.ar}</span>
            </div>
          ))}
        </div>
      ) : null}
      {g.arabicBridge && (
        <div className="mt-5 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm leading-7">
          <b className="text-gold">🌉 جسر من العربية: </b>
          {g.arabicBridge}
        </div>
      )}
      <button className="btn btn-gold mt-8 w-full text-lg" onClick={onNext}>
        إلى التدريب ⚔️
      </button>
    </motion.div>
  );
}

export default function LessonPage({ params }: { params: Promise<{ lang: string; lessonId: string }> }) {
  const { lang: rawLang, lessonId: rawId } = use(params);
  const lessonId = decodeURIComponent(rawId);
  const { state, ai, refresh, handleEvents } = useGame();
  const valid = isLang(rawLang);
  const lang = (valid ? rawLang : "en") as LangCode;
  const path = valid ? findLesson(lang, lessonId) : undefined;
  const lesson = path?.lesson;
  const boss = lesson?.kind === "boss";

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<Exercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<(AnswerResult & { explain?: { explanation: string; tip: string } | "loading" }) | null>(null);
  const [grammar, setGrammar] = useState<GrammarNote | null>(null);
  const [aiItems, setAiItems] = useState<Item[]>([]);
  const [stats, setStats] = useState({ correct: 0, graded: 0, combo: 0, maxCombo: 0, xp: 0, speak: 0 });
  const attrs = useRef<Partial<Record<Attribute, number>>>({});
  const retried = useRef(new Set<string>());
  const [shields, setShields] = useState(3);
  const [bossHp, setBossHp] = useState(1);
  const [bossHit, setBossHit] = useState(0);
  const [result, setResult] = useState<{ xp: number; gems: number; won: boolean; accuracy: number; events: GameEvent[] } | null>(null);
  const bossFace = useMemo(() => BOSSES[Math.floor(Math.random() * BOSSES.length)], []);
  const warrior = state?.profile.heroClass === "warrior";

  // ── تحميل الدرس وتوليد التمارين ──
  useEffect(() => {
    if (!lesson || !path || !ai) return; // ننتظر معرفة حالة الذكاء الاصطناعي لنبني الدرس مرة واحدة
    let alive = true;
    (async () => {
      try {
        const course = getCourse(lang);
        const prog = await api<{ seenItems: string[] }>(`/api/progress/${lang}`);
        const seen = new Set(prog.seenItems);
        let items = lesson.items.map((id) => course.items[id]).filter(Boolean);
        let g = lesson.grammar ?? null;
        const extra: Item[] = [];
        if (lesson.aiTopic) {
          const r = await api<{ parts: AiLesson[] }>("/api/ai/lesson", { lang, lessonId });
          r.parts.forEach((part, pi) => {
            const pre = `${lesson.id}.${pi}`;
            extra.push(
              ...part.vocab.map((v, i) => ({ id: `${pre}.v${i}`, type: "word" as const, text: v.text, ar: v.ar, reading: v.reading })),
              ...part.phrases.map((v, i) => ({ id: `${pre}.p${i}`, type: "phrase" as const, text: v.text, ar: v.ar, reading: v.reading })),
            );
          });
          if (!boss) g = r.parts[0]?.grammar ?? null;
          items = extra;
        }
        if (!alive) return;
        setAiItems(extra);
        const known = itemsUpTo(lang, path.index);
        const ex = buildExercises({
          lang,
          kind: lesson.kind === "ai" ? "vocab" : lesson.kind,
          items,
          known,
          isNew: (it) => !seen.has(it.id),
          speechAvailable: Boolean(ai?.enabled) || speechRecognitionAvailable(),
        });
        setQueue(ex);
        setIdx(0);
        setFeedback(null);
        setBossHp(ex.filter((e) => e.kind !== "intro").length);
        setShields(3);
        setGrammar(g);
        setPhase(g ? "grammar" : "play");

        // بناء جمل ديناميكي: جمل جديدة من مفرداتك في سياقات مختلفة
        if (ai?.enabled && ["phrases", "boss"].includes(lesson.kind) && path.level.code !== "FOUNDATION") {
          api<{ sentences: { text: string; ar: string; reading: string }[] }>("/api/ai/sentences", {
            lang,
            level: path.level.code,
            words: [...known.slice(-40), ...items].filter((i) => i.type === "word").map((i) => i.text),
            n: 3,
          })
            .then(({ sentences }) => {
              if (!alive) return;
              const sItems: Item[] = sentences.map((s, i) => ({ id: `${lesson.id}.ctx${i}`, type: "phrase", ...s }));
              const more = buildExercises({ lang, kind: "boss", items: sItems, known: [...known, ...items], isNew: () => false, speechAvailable: false }).filter((e) => e.kind === "build");
              if (!more.length) return;
              setQueue((q) => [...q.slice(0, -1), ...more, ...q.slice(-1)]);
              setBossHp((h) => h + more.length);
            })
            .catch(() => {});
        }
      } catch (e) {
        if (!alive) return;
        setError(e instanceof ApiError && e.code === "ai_disabled" ? "هذا الدرس يولّده الذكاء الاصطناعي ويحتاج مفتاح Gemini. أضفه في ملف ‎.env.local ثم أعد تشغيل الموقع." : e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [lessonId, lang, ai === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const ex = queue[idx];

  const finish = useCallback(
    async (won: boolean, s = stats) => {
      setPhase("done");
      const accuracy = s.graded ? s.correct / s.graded : 1;
      sfx(won ? "win" : "lose");
      if (won) confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      try {
        const r = await api<{ xp: number; gems: number; events: GameEvent[] }>("/api/lesson/complete", {
          lang,
          lessonId,
          accuracy,
          xp: s.xp,
          maxCombo: s.maxCombo,
          won,
          speakCount: s.speak,
          attrs: attrs.current,
          aiItems: won ? aiItems : undefined,
        });
        setResult({ ...r, won, accuracy });
        handleEvents(r.events);
        refresh();
      } catch (e) {
        setResult({ xp: 0, gems: 0, won, accuracy, events: [] });
        console.error(e);
      }
    },
    [stats, lang, lessonId, aiItems, handleEvents, refresh],
  );

  const onAnswer = (r: AnswerResult) => {
    if (!ex || feedback) return;
    const s = { ...stats };
    if (r.speak) s.speak++;
    if (r.graded) {
      s.graded++;
      attrs.current[ex.attr] = (attrs.current[ex.attr] ?? 0) + (r.correct ? 2 : 0);
      if (r.correct) {
        s.correct++;
        s.combo++;
        s.maxCombo = Math.max(s.maxCombo, s.combo);
        s.xp += Math.round(XP.correct * comboMultiplier(s.combo));
        sfx(s.combo > 0 && s.combo % 5 === 0 ? "combo" : "correct");
        if (boss) {
          const dmg = warrior && Math.random() < 0.25 ? 2 : 1;
          setBossHp((h) => Math.max(0, h - dmg));
          setBossHit((x) => x + 1);
          sfx("hit");
        }
      } else {
        s.combo = 0;
        sfx("wrong");
        if (boss) setShields((x) => x - 1);
        else if (!ex.id.endsWith("r") && !retried.current.has(ex.id)) {
          // التعلم بالإتقان: يعود السؤال الخاطئ مرة واحدة في آخر الدرس
          retried.current.add(ex.id);
          setQueue((q) => [...q, { ...ex, id: ex.id + "r" }]);
        }
      }
    } else if (ex.kind === "intro") s.xp += XP.intro;
    setStats(s);
    if (ex.kind === "intro" || ex.kind === "match" || ex.kind === "speak") return advance(s);
    setFeedback(r);
  };

  const advance = (s = stats) => {
    setFeedback(null);
    if (boss && shields <= 0) return finish(false, s);
    if (idx + 1 >= queue.length) return finish(true, s);
    setIdx((i) => i + 1);
  };

  const drinkPotion = async () => {
    const r = await api<{ ok: boolean }>("/api/shop", { item: "boss_potion", action: "use" });
    if (r.ok) {
      setShields((x) => x + 1);
      refresh();
    }
  };

  const explain = async () => {
    if (!feedback || !ex) return;
    setFeedback({ ...feedback, explain: "loading" });
    try {
      const r = await api<{ explanation: string; tip: string }>("/api/ai/explain", {
        lang,
        prompt: `${ex.kind} — ${ex.kind !== "match" ? ex.item.text + " = " + ex.item.ar : ""}`,
        given: feedback.given ?? "",
        correct: feedback.expected ?? "",
      });
      setFeedback((f) => f && { ...f, explain: r });
    } catch {
      setFeedback((f) => f && { ...f, explain: undefined });
    }
  };

  if (!valid || !lesson || !path)
    return (
      <div className="p-8 text-center">
        الدرس غير موجود. <Link href="/learn" className="text-gold">العودة</Link>
      </div>
    );

  const progress = queue.length ? idx / queue.length : 0;
  const potions = state?.inventory?.boss_potion ?? 0;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* الشريط العلوي */}
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-bg/90 px-4 py-3 backdrop-blur">
        <Link href="/learn" className="grid h-10 w-10 place-items-center rounded-xl bg-card text-xl" aria-label="خروج">
          ✕
        </Link>
        <div className="flex-1">
          <Bar value={progress} color="linear-gradient(90deg,var(--good),var(--gem))" className="h-4" />
        </div>
        {stats.combo >= 3 && (
          <motion.div key={stats.combo} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="rounded-full bg-fire/20 px-2.5 py-1 text-sm font-black text-fire">
            🔥×{stats.combo}
          </motion.div>
        )}
        {boss && <div className="text-lg">{"🛡️".repeat(Math.max(0, shields))}</div>}
      </div>

      {/* لوحة الزعيم */}
      {boss && phase === "play" && (
        <div className="mx-4 mb-2 flex items-center gap-3 rounded-2xl border border-bad/40 bg-bad/10 p-3">
          <motion.div key={bossHit} animate={bossHit ? { x: [0, -10, 10, -6, 0], rotate: [0, -8, 8, 0], filter: ["brightness(1)", "brightness(2.5)", "brightness(1)"] } : {}} className="text-5xl">
            {bossFace}
          </motion.div>
          <div className="flex-1">
            <div className="mb-1 text-xs font-bold text-bad">
              زعيم {path.unit.title} · {bossHp} نقطة حياة
            </div>
            <Bar value={bossHp / Math.max(1, queue.filter((e) => e.kind !== "intro").length)} color="var(--bad)" className="h-3" />
          </div>
          {potions > 0 && shields < 3 && (
            <button onClick={drinkPotion} className="rounded-xl bg-card px-2 py-1 text-sm" title="استخدم جرعة الحياة">
              ❤️‍🩹×{potions}
            </button>
          )}
        </div>
      )}

      <main className="flex-1 px-4 pb-48 pt-2">
        {phase === "loading" && (
          <div className="grid place-items-center pt-24 text-center">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="text-6xl">
              {lesson.aiTopic ? "🔮" : "⚙️"}
            </motion.div>
            <div className="mt-4 text-muted">{lesson.aiTopic ? "يستحضر الذكاء الاصطناعي درسك… (مرة واحدة فقط ثم يُحفظ)" : "يُجهَّز الدرس…"}</div>
          </div>
        )}
        {phase === "error" && (
          <div className="card mt-10 p-6 text-center">
            <div className="text-5xl">🧱</div>
            <div className="mt-3 leading-7">{error}</div>
            <Link href="/learn" className="btn btn-ghost mt-5">
              العودة للخريطة
            </Link>
          </div>
        )}
        {phase === "grammar" && grammar && <GrammarCard g={grammar} lang={lang} onNext={() => setPhase("play")} />}
        {phase === "play" && ex && (
          <AnimatePresence mode="wait">
            <motion.div key={ex.id} initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.2 }}>
              {ex.kind === "intro" && <IntroCard ex={ex} lang={lang} locked={!!feedback} onAnswer={onAnswer} />}
              {ex.kind === "choice" && <ChoiceEx ex={ex} lang={lang} locked={!!feedback} onAnswer={onAnswer} />}
              {ex.kind === "match" && <MatchEx ex={ex} lang={lang} locked={!!feedback} onAnswer={onAnswer} />}
              {ex.kind === "build" && <BuildEx ex={ex} lang={lang} locked={!!feedback} onAnswer={onAnswer} />}
              {ex.kind === "type" && <TypeEx ex={ex} lang={lang} locked={!!feedback} onAnswer={onAnswer} />}
              {ex.kind === "speak" && <SpeakEx ex={ex} lang={lang} locked={!!feedback} onAnswer={onAnswer} />}
              {ex.kind === "tone" && <ToneEx ex={ex} lang={lang} locked={!!feedback} onAnswer={onAnswer} />}
            </motion.div>
          </AnimatePresence>
        )}
        {phase === "done" && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="pt-8 text-center">
            <div className="text-8xl">{result?.won === false ? "💀" : boss ? "🏆" : "🎉"}</div>
            <h1 className="mt-4 text-3xl font-black">{result?.won === false ? "هزمك الزعيم هذه المرة" : boss ? "انتصرت على الزعيم!" : "أكملت الدرس!"}</h1>
            {result?.won === false && <p className="mt-2 text-muted">راجع دروس الوحدة ثم عد أقوى. لا تُفقد أي خبرة اكتسبتها.</p>}
            <div className="mt-8 grid grid-cols-3 gap-3">
              <div className="card p-4">
                <div className="text-2xl font-black text-xp">+{result?.xp ?? "…"}</div>
                <div className="text-xs text-muted">خبرة</div>
              </div>
              <div className="card p-4">
                <div className="text-2xl font-black text-good">{Math.round((result?.accuracy ?? 0) * 100)}%</div>
                <div className="text-xs text-muted">دقة</div>
              </div>
              <div className="card p-4">
                <div className="text-2xl font-black text-gem">+{result?.gems ?? 0}</div>
                <div className="text-xs text-muted">💎</div>
              </div>
            </div>
            {result?.won && <div className="mt-5 text-3xl">{"👑".repeat(crownsFor(result.accuracy))}</div>}
            <div className="mt-2 text-sm text-muted">أطول سلسلة: 🔥 {stats.maxCombo}</div>
            <div className="mt-8 flex gap-3">
              <Link href="/learn" className="btn btn-gold flex-1 text-lg">
                متابعة ◀
              </Link>
              <button onClick={() => location.reload()} className="btn btn-ghost">
                ↻ إعادة
              </button>
            </div>
          </motion.div>
        )}
      </main>

      {/* ورقة التقييم */}
      <AnimatePresence>
        {feedback && phase === "play" && (
          <motion.div
            initial={{ y: 200 }}
            animate={{ y: 0 }}
            exit={{ y: 200 }}
            className={`safe-bottom fixed inset-x-0 bottom-0 z-40 border-t-2 p-5 ${feedback.correct ? "border-good bg-[color-mix(in_oklab,var(--good)_15%,var(--bg))]" : "border-bad bg-[color-mix(in_oklab,var(--bad)_15%,var(--bg))]"}`}
          >
            <div className="mx-auto max-w-3xl">
              <div className={`text-xl font-black ${feedback.correct ? "text-good" : "text-bad"}`}>
                {feedback.correct ? ["ممتاز!", "أحسنت!", "رائع!", "إجابة صحيحة!"][stats.correct % 4] : "ليس تماماً"}
                {feedback.correct && stats.combo >= 3 && <span className="text-fire"> 🔥 {stats.combo} متتالية</span>}
              </div>
              {!feedback.correct && feedback.expected && (
                <div className="mt-1">
                  الإجابة الصحيحة: <b className="foreign">{feedback.expected}</b>
                </div>
              )}
              {feedback.expected?.includes("انتبه للعلامات") && feedback.correct && <div className="mt-1 text-sm text-gold">✔ {feedback.expected}</div>}
              {feedback.explain && feedback.explain !== "loading" && (
                <div className="mt-2 text-sm leading-7">
                  {feedback.explain.explanation}
                  <div className="text-gold">💡 {feedback.explain.tip}</div>
                </div>
              )}
              <div className="mt-4 flex gap-3">
                {!feedback.correct && ai?.enabled && !feedback.explain && (
                  <button className="btn btn-ghost" onClick={explain}>
                    🧙 لماذا؟
                  </button>
                )}
                {feedback.explain === "loading" && <span className="btn btn-ghost">⏳</span>}
                <button className={`btn flex-1 text-lg ${feedback.correct ? "btn-good" : "btn-bad"}`} onClick={() => advance()}>
                  متابعة
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
