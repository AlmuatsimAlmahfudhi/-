"use client";
/**
 * المحادثة الصوتية في نسخة claude.ai: إملاء صوتي مستمر ← Claude ← نطق الرد.
 * نفس واجهة useLiveConversation في النسخة المحلية، مع sendText للكتابة عند غياب الإملاء.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { LangCode } from "@/content";
import { SCENARIOS } from "@/content/scenarios";
import { ready } from "./claude";
import { conversationReply } from "./ai";
import { speak, stopSpeaking } from "./speech";
import { ready as dbReady } from "./db";
import { knownWords } from "@/server/known";

export type Turn = { role: "user" | "ai"; text: string };
export type LiveStatus = "idle" | "connecting" | "live" | "ended" | "error";
const BCP: Record<LangCode, string> = { en: "en-US", fr: "fr-FR", es: "es-ES", zh: "zh-CN" };

export function useLiveConversation() {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const r = useRef({ turns: [] as Turn[], buffer: "", busy: false, speaking: false, muted: false, opts: null as null | { lang: LangCode; level: string; scenario: string }, known: [] as string[], started: 0, subs: [] as (() => void)[], silence: undefined as ReturnType<typeof setTimeout> | undefined, alive: false });

  useEffect(() => {
    r.current.muted = muted;
  }, [muted]);

  const respond = useCallback(async () => {
    const st = r.current;
    if (!st.opts || st.busy || !st.alive) return;
    st.busy = true;
    try {
      const sc = SCENARIOS.find((x) => x.id === st.opts!.scenario) ?? SCENARIOS[0];
      const reply = await conversationReply(st.opts.lang, st.opts.level, sc.role, sc.goal, st.known, st.turns);
      if (!st.alive) return;
      st.turns = [...st.turns, { role: "ai", text: reply }];
      setTurns(st.turns);
      st.speaking = true;
      setAiSpeaking(true);
      await speak(st.opts.lang, reply.replace(/\([^)]*[؀-ۿ][^)]*\)/g, ""));
      await new Promise((res) => setTimeout(res, 500));
    } catch (e) {
      setError((e as { message?: string })?.message ?? "تعذّر الرد");
    } finally {
      st.speaking = false;
      setAiSpeaking(false);
      st.busy = false;
    }
  }, []);

  const pushUser = useCallback(
    (text: string) => {
      const st = r.current;
      const t = text.trim();
      if (!t) return;
      st.turns = [...st.turns, { role: "user", text: t }];
      setTurns(st.turns);
      respond();
    },
    [respond],
  );

  const stop = useCallback(() => {
    const st = r.current;
    st.alive = false;
    clearTimeout(st.silence);
    st.subs.forEach((u) => u());
    st.subs = [];
    ready.dictation?.stop().catch(() => {});
    stopSpeaking();
    setMicLevel(0);
    setStatus((s) => (s === "live" || s === "connecting" ? "ended" : s));
    return Math.round((Date.now() - st.started) / 1000);
  }, []);

  const start = useCallback(
    async (opts: { lang: LangCode; level: string; scenario: string }) => {
      const st = r.current;
      setError(null);
      st.turns = [];
      setTurns([]);
      st.opts = opts;
      st.alive = true;
      st.buffer = "";
      setStatus("connecting");
      const d = ready.dictation;
      setCanDictate(Boolean(d));
      if (d) {
        // يجب أن يبدأ الإملاء داخل النقرة نفسها قبل أي انتظار
        d.start({ language: BCP[opts.lang] }).catch((e: { code?: string }) => {
          setCanDictate(false);
          if (e?.code !== "stopped") setError(e?.code === "not_granted" ? "لم يُسمح بالإملاء الصوتي — اكتب ردودك بدلاً من ذلك" : "الإملاء الصوتي غير متاح الآن — اكتب ردودك");
        });
        const bump = () => {
          clearTimeout(st.silence);
          st.silence = setTimeout(() => {
            const b = st.buffer;
            st.buffer = "";
            setMicLevel(0);
            if (b.trim()) pushUser(b);
          }, 1600);
        };
        st.subs.push(
          d.onFinal(({ text }: { text: string }) => {
            if (st.speaking || st.muted || st.busy) return;
            st.buffer += text;
            bump();
          }),
          d.onPartial(({ text }: { text: string }) => {
            if (st.speaking || st.muted || st.busy) return;
            setMicLevel(text ? 0.6 : 0);
            if (text) bump();
          }),
        );
      }
      await dbReady();
      st.known = await knownWords(opts.lang).catch(() => []);
      st.started = Date.now();
      setStatus("live");
      await respond();
    },
    [pushUser, respond],
  );

  useEffect(() => () => void stop(), [stop]);
  return { status, error, turns, micLevel, aiSpeaking, muted, setMuted, start, stop, sendText: pushUser, canDictate };
}
