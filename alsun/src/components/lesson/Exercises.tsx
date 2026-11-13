"use client";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { display, type Item, type LangCode } from "@/content";
import { Foreign, SpeakButton } from "@/components/ui";
import { useGame } from "@/components/GameProvider";
import { checkTyped, similarity, type Exercise } from "@/lib/exercises";
import { speak } from "@/lib/speech";
import { sfx } from "@/lib/sfx";
import { toneVariants, toneOfSyllable, syllables } from "@/lib/pinyin";
import { TONE_LABELS, toChaoScale } from "@/lib/audio";
import { useRecorder } from "@/hooks/useRecorder";
import { recognizeOnce, speechRecognitionAvailable } from "@/hooks/useSpeechRecognition";
import { api } from "@/lib/api";
import { PitchPractice, ToneCurve, ToneIcon } from "./Pitch";
import type { PronunciationResult } from "@/server/ai";

export type AnswerResult = { correct: boolean; graded: boolean; given?: string; expected?: string; speak?: boolean };
type Props<K extends Exercise["kind"]> = { ex: Extract<Exercise, { kind: K }>; lang: LangCode; locked: boolean; onAnswer: (r: AnswerResult) => void };

const sayOf = (item: Item) => item.say ?? item.text;
const isScript = (i: Item) => ["letter", "sound", "tone", "syllable"].includes(i.type);

// ───────────── بطاقة التعريف ─────────────

function HanziStroke({ char, size = 140 }: { char: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const writer = useRef<{ animateCharacter: () => void } | null>(null);
  useEffect(() => {
    let alive = true;
    import("hanzi-writer").then(({ default: HanziWriter }) => {
      if (!alive || !ref.current) return;
      ref.current.innerHTML = "";
      writer.current = HanziWriter.create(ref.current, char, {
        width: size,
        height: size,
        padding: 6,
        strokeColor: getComputedStyle(document.documentElement).getPropertyValue("--gold").trim() || "#f5c542",
        radicalColor: "#6d7dff",
        outlineColor: "#2e3970",
        strokeAnimationSpeed: 1.2,
        delayBetweenStrokes: 220,
        onLoadCharDataError: () => {
          if (ref.current) ref.current.innerHTML = `<div style="font-size:${size * 0.7}px;line-height:${size}px" lang="zh">${char}</div>`;
        },
      });
      writer.current.animateCharacter();
    });
    return () => {
      alive = false;
    };
  }, [char, size]);
  return <div ref={ref} onClick={() => writer.current?.animateCharacter()} className="cursor-pointer rounded-2xl bg-card-2" style={{ width: size, height: size }} title="انقر لإعادة رسم الضربات" />;
}

export function IntroCard({ ex, lang, onAnswer }: Props<"intro">) {
  const it = ex.item;
  const [showNote, setShowNote] = useState(true);
  useEffect(() => {
    speak(lang, sayOf(it));
  }, [it, lang]);
  const hanzi = lang === "zh" && !isScript(it) ? [...display(lang, it.text)].filter((c) => /\p{Script=Han}/u.test(c)) : [];
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-3 rounded-full bg-xp/20 px-3 py-1 text-sm font-bold text-xp">✨ عنصر جديد</div>
      {hanzi.length > 0 && hanzi.length <= 3 ? (
        <div className="flex gap-2">
          {hanzi.map((c, i) => (
            <HanziStroke key={i + c} char={c} size={hanzi.length === 1 ? 160 : 110} />
          ))}
        </div>
      ) : (
        <Foreign lang={lang} className={`font-black ${it.text.length > 14 ? "text-3xl" : "text-6xl"}`}>
          {display(lang, it.text)}
        </Foreign>
      )}
      {it.reading && (
        <div className="mt-3 text-xl text-gold">
          {lang === "zh" ? <Foreign lang="en">{it.reading}</Foreign> : <>🗣️ {it.reading} <span className="text-xs text-muted">(تقريبي)</span></>}
        </div>
      )}
      <div className="mt-3 text-2xl font-bold">{it.ar.split(" — ")[0]}</div>
      {it.ar.includes(" — ") && <div className="mt-1 text-sm text-muted">{it.ar.split(" — ").slice(1).join(" — ")}</div>}
      {it.note && showNote && (
        <div className="mt-4 rounded-2xl border border-line bg-card-2 px-4 py-3 text-sm" onClick={() => setShowNote(false)}>
          💡 {it.note}
        </div>
      )}
      {it.tone && <PitchPractice tone={it.tone} />}
      <div className="mt-6 flex gap-3">
        <SpeakButton lang={lang} text={sayOf(it)} size="lg" />
        <SpeakButton lang={lang} text={sayOf(it)} size="lg" slow />
      </div>
      <button className="btn btn-gold mt-8 w-full max-w-sm text-lg" onClick={() => onAnswer({ correct: true, graded: false })}>
        فهمت ◀
      </button>
    </div>
  );
}

// ───────────── الاختيار من متعدد ─────────────

export function ChoiceEx({ ex, lang, locked, onAnswer }: Props<"choice">) {
  const [picked, setPicked] = useState<number | null>(null);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (ex.mode === "listen" || ex.mode === "meaning") speak(lang, sayOf(ex.item));
  }, [ex, lang]);
  const it = ex.item;
  const long = ex.options.some((o) => o.label.length > 18);
  return (
    <div>
      <div className="mb-2 text-lg font-bold text-muted">{ex.question}</div>
      <div className="card mb-6 flex min-h-36 flex-col items-center justify-center gap-3 p-5 text-center">
        {ex.mode === "listen" ? (
          <div className="flex gap-3">
            <SpeakButton lang={lang} text={sayOf(it)} size="lg" />
            <SpeakButton lang={lang} text={sayOf(it)} size="lg" slow />
          </div>
        ) : ex.mode === "reverse" ? (
          <div className="text-3xl font-black">{it.ar.split(" — ")[0]}</div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Foreign lang={lang} className={`font-black ${it.text.length > 14 ? "text-3xl" : "text-5xl"}`}>
                {display(lang, it.text)}
              </Foreign>
              <SpeakButton lang={lang} text={sayOf(it)} size="sm" />
            </div>
            {it.reading && ex.mode === "meaning" && (
              <button onClick={() => setHint(true)} className="text-sm text-gold">
                {hint || lang === "zh" ? <Foreign lang="en">{it.reading}</Foreign> : "👁 أظهر النطق"}
              </button>
            )}
          </>
        )}
      </div>
      <div className={`grid gap-3 ${long ? "grid-cols-1" : "grid-cols-2"}`}>
        {ex.options.map((o, i) => {
          const state = picked === null ? undefined : i === ex.answer ? "correct" : i === picked ? "wrong" : undefined;
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.97 }}
              disabled={locked || picked !== null}
              data-state={state}
              className={`option text-lg font-bold ${state === "wrong" ? "shake" : ""}`}
              onClick={() => {
                setPicked(i);
                const ok = i === ex.answer;
                if (!ok || ex.mode === "letter") speak(lang, sayOf(it));
                onAnswer({ correct: ok, graded: true, given: o.label, expected: ex.options[ex.answer].label });
              }}
            >
              {o.ltr ? <Foreign lang={lang}>{o.label}</Foreign> : o.label}
              {o.sub && <div className="foreign text-xs font-normal text-muted">{o.sub}</div>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ───────────── التوصيل بين الأزواج ─────────────

export function MatchEx({ ex, lang, onAnswer }: Props<"match">) {
  const right = useMemo(() => [...ex.pairs].sort(() => Math.random() - 0.5), [ex]);
  const [sel, setSel] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [bad, setBad] = useState<number | null>(null);
  const mistakes = useRef(0);
  const tryMatch = (rightIdx: number) => {
    if (sel === null) return;
    const pr = right[rightIdx];
    if (ex.pairs[sel] === pr) {
      sfx("tap");
      const nd = new Set(done).add(sel);
      setDone(nd);
      setSel(null);
      if (nd.size === ex.pairs.length) onAnswer({ correct: mistakes.current <= 1, graded: true });
    } else {
      mistakes.current++;
      sfx("wrong");
      setBad(rightIdx);
      setTimeout(() => setBad(null), 400);
    }
  };
  return (
    <div>
      <div className="mb-4 text-lg font-bold text-muted">صِل كل كلمة بمعناها</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-3">
          {ex.pairs.map((p, i) => (
            <button
              key={i}
              disabled={done.has(i)}
              data-state={done.has(i) ? "correct" : sel === i ? "selected" : undefined}
              className={`option w-full text-lg font-bold ${done.has(i) ? "opacity-40" : ""}`}
              onClick={() => {
                setSel(i);
                speak(lang, sayOf(p.item));
              }}
            >
              <Foreign lang={lang}>{p.a}</Foreign>
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {right.map((p, i) => {
            const isDone = done.has(ex.pairs.indexOf(p));
            return (
              <button key={i} disabled={isDone} data-state={isDone ? "correct" : bad === i ? "wrong" : undefined} className={`option w-full font-bold ${isDone ? "opacity-40" : ""} ${bad === i ? "shake" : ""}`} onClick={() => tryMatch(i)}>
                {p.b}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ───────────── بناء الجملة ─────────────

export function BuildEx({ ex, lang, locked, onAnswer }: Props<"build">) {
  const [chosen, setChosen] = useState<number[]>([]);
  const sentence = chosen.map((i) => ex.bank[i]);
  return (
    <div>
      <div className="mb-2 text-lg font-bold text-muted">رتّب الكلمات لتكوّن الجملة</div>
      <div className="card mb-4 flex items-center gap-3 p-4">
        <SpeakButton lang={lang} text={ex.item.text} size="sm" />
        <div className="text-xl font-bold">{ex.item.ar.split(" — ")[0]}</div>
      </div>
      <div className="mb-6 flex min-h-20 flex-wrap content-start gap-2 border-b-2 border-dashed border-line pb-3" dir="ltr">
        {chosen.map((bi, k) => (
          <motion.button layout key={bi} className="option !min-h-11 !px-3 !py-1 text-lg" onClick={() => !locked && setChosen(chosen.filter((_, j) => j !== k))}>
            <Foreign lang={lang}>{ex.bank[bi]}</Foreign>
          </motion.button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2" dir="ltr">
        {ex.bank.map((t, i) => (
          <motion.button
            layout
            key={i}
            disabled={chosen.includes(i) || locked}
            className={`option !min-h-11 !px-3 !py-1 text-lg ${chosen.includes(i) ? "opacity-20" : ""}`}
            onClick={() => {
              sfx("tap");
              setChosen([...chosen, i]);
            }}
          >
            <Foreign lang={lang}>{t}</Foreign>
          </motion.button>
        ))}
      </div>
      <button
        className="btn btn-gold mt-8 w-full text-lg"
        disabled={!chosen.length || locked}
        onClick={() => {
          const ok = sentence.join(" ").toLowerCase() === ex.answer.join(" ").toLowerCase();
          speak(lang, ex.item.text);
          onAnswer({ correct: ok, graded: true, given: display(lang, sentence.join(" ")), expected: display(lang, ex.item.text) });
        }}
      >
        تحقّق
      </button>
    </div>
  );
}

// ───────────── الكتابة ─────────────

const SPECIAL: Partial<Record<LangCode, string[]>> = {
  fr: ["é", "è", "ê", "à", "â", "ç", "ô", "î", "ù", "û", "ë", "œ"],
  es: ["á", "é", "í", "ó", "ú", "ñ", "ü", "¿", "¡"],
  zh: ["ā", "á", "ǎ", "à", "ē", "é", "ě", "è", "ī", "í", "ǐ", "ì", "ō", "ó", "ǒ", "ò", "ū", "ú", "ǔ", "ù", "ü", "ǚ"],
};

export function TypeEx({ ex, lang, locked, onAnswer }: Props<"type">) {
  const [v, setV] = useState("");
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inp.current?.focus();
  }, [ex]);
  const submit = () => {
    if (!v.trim() || locked) return;
    const r = checkTyped(lang, ex.item, v);
    speak(lang, sayOf(ex.item));
    onAnswer({ correct: r !== "wrong", graded: true, given: v, expected: display(lang, ex.item.text) + (r === "accent" ? " (انتبه للعلامات)" : "") });
  };
  return (
    <div>
      <div className="mb-2 text-lg font-bold text-muted">{lang === "zh" ? "اكتب بالبينيين أو بالحروف الصينية" : "اكتبها بلغة الهدف"}</div>
      <div className="card mb-5 p-5 text-center text-3xl font-black">{ex.item.ar.split(" — ")[0]}</div>
      <input
        ref={inp}
        dir="ltr"
        lang={lang}
        value={v}
        disabled={locked}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="foreign w-full rounded-2xl border-2 border-line bg-card-2 px-4 py-4 text-2xl outline-none focus:border-accent"
        placeholder="…"
      />
      {SPECIAL[lang] && (
        <div className="mt-3 flex flex-wrap gap-1.5" dir="ltr">
          {SPECIAL[lang]!.map((c) => (
            <button key={c} className="option !min-h-10 !px-3 !py-1 foreign" onClick={() => setV(v + c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      <button className="btn btn-gold mt-6 w-full text-lg" disabled={!v.trim() || locked} onClick={submit}>
        تحقّق
      </button>
    </div>
  );
}

// ───────────── النغمات ─────────────

export function ToneEx({ ex, lang, locked, onAnswer }: Props<"tone">) {
  const it = ex.item;
  const reading = it.reading ?? it.text;
  const multi = syllables(reading).length > 1 || /[a-zü]+[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ][a-z]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(reading);
  const target = multi ? 0 : toneOfSyllable(reading);
  const variants = useMemo(() => (multi ? toneVariants(reading).sort(() => Math.random() - 0.5) : []), [multi, reading]);
  const [picked, setPicked] = useState<string | number | null>(null);
  useEffect(() => {
    speak(lang, sayOf(it));
  }, [it, lang]);
  return (
    <div>
      <div className="mb-2 text-lg font-bold text-muted">{multi ? "كيف تُنطق فعلاً؟ (انتبه لتغيّر النغمات)" : "ما النغمة التي تسمعها؟"}</div>
      <div className="card mb-6 flex flex-col items-center gap-3 p-6">
        <div className="flex gap-3">
          <SpeakButton lang={lang} text={sayOf(it)} size="lg" />
          <SpeakButton lang={lang} text={sayOf(it)} size="lg" slow />
        </div>
        {multi && <div className="text-sm text-muted">{it.ar.split(" — ")[0]}</div>}
      </div>
      {multi ? (
        <div className="grid grid-cols-2 gap-3">
          {variants.map((vv) => (
            <button
              key={vv}
              disabled={locked || picked !== null}
              data-state={picked === null ? undefined : vv === reading ? "correct" : vv === picked ? "wrong" : undefined}
              className="option text-xl font-bold"
              onClick={() => {
                setPicked(vv);
                onAnswer({ correct: vv === reading, graded: true, given: vv, expected: reading });
              }}
            >
              <Foreign lang="en">{vv}</Foreign>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].concat(target === 5 ? [5] : []).map((t) => (
              <button
                key={t}
                disabled={locked || picked !== null}
                data-state={picked === null ? undefined : t === target ? "correct" : t === picked ? "wrong" : undefined}
                className="option flex items-center justify-between font-bold"
                onClick={() => {
                  setPicked(t);
                  onAnswer({ correct: t === target, graded: true, given: TONE_LABELS[t].name, expected: `${TONE_LABELS[target].name} (${reading})` });
                }}
              >
                <span>{TONE_LABELS[t].name}</span>
                <span className="text-gold">
                  <ToneIcon tone={t} />
                </span>
              </button>
            ))}
          </div>
          {picked !== null && <PitchPractice tone={target} />}
        </>
      )}
    </div>
  );
}

// ───────────── النطق ─────────────

export function SpeakEx({ ex, lang, locked, onAnswer }: Props<"speak">) {
  const { ai } = useGame();
  const it = ex.item;
  const rec = useRecorder();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [local, setLocal] = useState<{ score: number; heard: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const bcp = { en: "en-US", fr: "fr-FR", es: "es-ES", zh: "zh-CN" }[lang];
  const useAi = Boolean(ai?.enabled) && (ai as { mic?: boolean } | null)?.mic !== false;
  const score = result?.score ?? local?.score;
  const pass = score !== undefined && score >= 60;

  const runLocal = async () => {
    setBusy(true);
    try {
      const alts = await recognizeOnce(bcp);
      const targets = [display(lang, it.text), it.say ?? ""].filter(Boolean);
      let best = { score: 0, heard: alts[0] ?? "" };
      for (const a of alts) for (const t of targets) {
        const sc = similarity(a, t);
        if (sc > best.score) best = { score: sc, heard: a };
      }
      setLocal(best);
    } catch (e) {
      setErr(e instanceof Error && e.message === "unsupported" ? "متصفحك لا يدعم التعرف على الكلام — جرّب Chrome أو فعّل مفتاح Gemini" : "لم أسمعك جيداً، حاول مجدداً");
    } finally {
      setBusy(false);
    }
  };

  const runAi = async () => {
    if (!rec.recording) return rec.start();
    const wav = await rec.stop();
    if (!wav) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("audio", wav, "speech.wav");
      fd.append("lang", lang);
      fd.append("target", display(lang, it.text));
      if (it.reading) fd.append("reading", it.reading);
      setResult(await api<PronunciationResult>("/api/ai/pronounce", fd));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّر التقييم");
    } finally {
      setBusy(false);
    }
  };

  const canLocal = speechRecognitionAvailable();
  return (
    <div className="text-center">
      <div className="mb-2 text-lg font-bold text-muted">🎤 انطقها بصوتك</div>
      <div className="card mb-5 flex flex-col items-center gap-2 p-5">
        <div className="flex items-center gap-3">
          <Foreign lang={lang} className="text-4xl font-black">
            {display(lang, it.text)}
          </Foreign>
          <SpeakButton lang={lang} text={sayOf(it)} size="sm" />
        </div>
        {it.reading && <div className="text-gold">{lang === "zh" ? <Foreign lang="en">{it.reading}</Foreign> : it.reading}</div>}
        <div className="text-sm text-muted">{it.ar.split(" — ")[0]}</div>
      </div>

      {lang === "zh" && it.tone && rec.pitch.length > 0 && (
        <div className="mb-3 flex justify-center">
          <ToneCurve tone={it.tone} user={toChaoScale(rec.pitch)} />
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.92 }}
        disabled={busy || locked || (!useAi && !canLocal)}
        onClick={useAi ? runAi : runLocal}
        className={`mx-auto grid h-28 w-28 place-items-center rounded-full text-5xl text-white ${rec.recording ? "bg-bad" : "bg-accent"}`}
        style={{ boxShadow: rec.recording ? `0 0 0 ${8 + rec.level * 30}px color-mix(in oklab, var(--bad) 25%, transparent)` : "0 6px 0 color-mix(in oklab, var(--accent) 50%, black)" }}
      >
        {busy ? "⏳" : rec.recording ? "⏹" : "🎤"}
      </motion.button>
      <div className="mt-3 text-sm text-muted">
        {busy ? "جارٍ التقييم…" : useAi ? (rec.recording ? "اضغط للإيقاف والتقييم" : "اضغط وابدأ الكلام") : "اضغط وتكلّم (التعرف المدمج في المتصفح)"}
      </div>
      {(err || rec.error) && <div className="mt-2 text-sm text-bad">{err ?? rec.error}</div>}

      {score !== undefined && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card mt-5 p-4 text-right">
          <div className="flex items-center justify-between">
            <span className="text-lg font-black">{result?.verdict ?? (pass ? "أحسنت!" : "قريب، حاول مرة أخرى")}</span>
            <span className={`text-3xl font-black ${score >= 80 ? "text-good" : score >= 60 ? "text-gold" : "text-bad"}`}>{score}</span>
          </div>
          <div className="mt-1 text-sm text-muted">
            سمعتُ: <Foreign lang={lang}>{result?.heard ?? local?.heard ?? "—"}</Foreign>
          </div>
          {result?.words?.length ? (
            <div className="mt-3 flex flex-wrap gap-2" dir="ltr">
              {result.words.map((w, i) => (
                <span key={i} title={w.issue} className="rounded-lg px-2 py-1 text-sm font-bold" style={{ background: `color-mix(in oklab, ${w.score >= 80 ? "var(--good)" : w.score >= 60 ? "var(--gold)" : "var(--bad)"} 25%, transparent)` }}>
                  <Foreign lang={lang}>{w.word}</Foreign> {w.score}
                </span>
              ))}
            </div>
          ) : null}
          {result?.tones?.length ? (
            <div className="mt-2 text-sm">
              النغمات:{" "}
              {result.tones.map((t, i) => (
                <span key={i} className={t.expected === t.heard ? "text-good" : "text-bad"}>
                  {" "}
                  <Foreign lang="en">{t.syllable}</Foreign>({t.heard}/{t.expected})
                </span>
              ))}
            </div>
          ) : null}
          {result?.words?.filter((w) => w.issue && w.score < 80).map((w, i) => (
            <div key={i} className="mt-1 text-xs text-muted">
              • <Foreign lang={lang}>{w.word}</Foreign>: {w.issue}
            </div>
          ))}
          {result?.tip && <div className="mt-2 text-sm text-gold">💡 {result.tip}</div>}
        </motion.div>
      )}

      <div className="mt-5 flex gap-3">
        <button className="btn btn-ghost flex-1" disabled={locked} onClick={() => onAnswer({ correct: true, graded: false })}>
          تخطَّ الآن
        </button>
        {score !== undefined && (
          <button className={`btn flex-1 ${pass ? "btn-good" : "btn-ghost"}`} disabled={locked} onClick={() => onAnswer({ correct: pass, graded: pass, speak: true })}>
            {pass ? "متابعة ◀" : "متابعة على أي حال"}
          </button>
        )}
      </div>
    </div>
  );
}
