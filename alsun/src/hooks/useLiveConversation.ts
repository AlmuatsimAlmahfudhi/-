"use client";
import { GoogleGenAI, type LiveConnectConfig, type LiveServerMessage, type Session } from "@google/genai";
import { useCallback, useEffect, useRef, useState } from "react";
import { floatToPcm16Base64, pcm16Base64ToFloat } from "@/lib/audio";
import { api } from "@/lib/api";
import type { LangCode } from "@/content";

export type Turn = { role: "user" | "ai"; text: string };
export type LiveStatus = "idle" | "connecting" | "live" | "ended" | "error";

/** معالج صوتي يلتقط إطارات الميكروفون ويخفض معدلها إلى 16kHz */
const WORKLET = `
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = []; this.ratio = sampleRate / 16000; this.acc = 0; }
  process(inputs) {
    const ch = inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.acc += 1;
      if (this.acc >= this.ratio) { this.acc -= this.ratio; this.buf.push(ch[i]); }
    }
    if (this.buf.length >= 1600) { this.port.postMessage(new Float32Array(this.buf)); this.buf = []; }
    return true;
  }
}
registerProcessor("alsun-capture", Capture);`;

/**
 * المحادثة الصوتية الفورية عبر Gemini Live API (WebSocket):
 * الميكروفون ← PCM 16kHz ← Gemini ← صوت PCM 24kHz ← السماعة، مع نصوص فورية للطرفين.
 */
export function useLiveConversation() {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const session = useRef<Session | null>(null);
  const inCtx = useRef<AudioContext | null>(null);
  const outCtx = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const playHead = useRef(0);
  const sources = useRef<AudioBufferSourceNode[]>([]);
  const startedAt = useRef(0);
  const mutedRef = useRef(false);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const appendText = (role: Turn["role"], text: string) =>
    setTurns((t) => {
      const last = t[t.length - 1];
      if (last && last.role === role && !last.text.endsWith("\u0000")) return [...t.slice(0, -1), { role, text: last.text + text }];
      return [...t.map((x) => ({ ...x, text: x.text.replace(/\u0000$/, "") })), { role, text }];
    });
  const closeTurn = () => setTurns((t) => (t.length ? [...t.slice(0, -1), { ...t[t.length - 1], text: t[t.length - 1].text + "\u0000" }] : t));

  const stopPlayback = () => {
    sources.current.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    sources.current = [];
    playHead.current = 0;
    setAiSpeaking(false);
  };

  const onMessage = (m: LiveServerMessage) => {
    const sc = m.serverContent;
    if (!sc) return;
    if (sc.interrupted) stopPlayback();
    if (sc.inputTranscription?.text) appendText("user", sc.inputTranscription.text);
    if (sc.outputTranscription?.text) appendText("ai", sc.outputTranscription.text);
    for (const part of sc.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (!data || !outCtx.current) continue;
      const f = pcm16Base64ToFloat(data);
      const ctx = outCtx.current;
      const buf = ctx.createBuffer(1, f.length, 24000);
      buf.copyToChannel(f as Float32Array<ArrayBuffer>, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      const at = Math.max(ctx.currentTime, playHead.current);
      src.start(at);
      playHead.current = at + buf.duration;
      sources.current.push(src);
      setAiSpeaking(true);
      src.onended = () => {
        sources.current = sources.current.filter((x) => x !== src);
        if (!sources.current.length) setAiSpeaking(false);
      };
    }
    if (sc.turnComplete) closeTurn();
  };

  const stop = useCallback(() => {
    session.current?.close();
    session.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    inCtx.current?.close().catch(() => {});
    outCtx.current?.close().catch(() => {});
    inCtx.current = outCtx.current = null;
    stopPlayback();
    setMicLevel(0);
    setStatus((s) => (s === "live" || s === "connecting" ? "ended" : s));
    return Math.round((Date.now() - startedAt.current) / 1000);
  }, []);

  const start = useCallback(
    async (opts: { lang: LangCode; level: string; scenario: string }) => {
      setError(null);
      setTurns([]);
      setStatus("connecting");
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("الميكروفون يتطلب https أو localhost");
        const { token, model, config } = await api<{ token: string; model: string; config: LiveConnectConfig }>("/api/ai/live-token", opts);
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
        inCtx.current = new AudioContext();
        outCtx.current = new AudioContext({ sampleRate: 24000 });
        const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
        await inCtx.current.audioWorklet.addModule(url);
        const client = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });
        session.current = await client.live.connect({
          model,
          config,
          callbacks: {
            onopen: () => {
              setStatus("live");
              startedAt.current = Date.now();
            },
            onmessage: onMessage,
            onerror: (e) => {
              setError(e.message || "انقطع الاتصال");
              setStatus("error");
            },
            onclose: (e) => {
              if (e?.code && e.code !== 1000 && e.reason) setError(`أُغلق الاتصال: ${e.reason}`);
              setStatus((s) => (s === "live" ? "ended" : s));
            },
          },
        });
        const src = inCtx.current.createMediaStreamSource(stream.current);
        const node = new AudioWorkletNode(inCtx.current, "alsun-capture");
        node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
          const f = ev.data;
          let rms = 0;
          for (const x of f) rms += x * x;
          setMicLevel(Math.min(1, Math.sqrt(rms / f.length) * 8));
          if (mutedRef.current || !session.current) return;
          session.current.sendRealtimeInput({ audio: { data: floatToPcm16Base64(f), mimeType: "audio/pcm;rate=16000" } });
        };
        src.connect(node);
        // نبدأ المحادثة: الشريك يحيّي أولاً
        session.current.sendRealtimeInput({ text: "(The learner has joined. Greet them and start the scenario.)" });
      } catch (e) {
        stop();
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    },
    [stop],
  );

  useEffect(() => () => void stop(), [stop]);

  const clean = turns.map((t) => ({ ...t, text: t.text.replace(/\u0000$/, "").trim() })).filter((t) => t.text);
  return { status, error, turns: clean, micLevel, aiSpeaking, muted, setMuted, start, stop };
}
