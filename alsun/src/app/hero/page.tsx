"use client";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { getCourse } from "@/content";
import { useGame } from "@/components/GameProvider";
import { LangSwitcher, useActiveLang } from "@/components/LangSwitcher";
import { Bar, SectionTitle, TopStats } from "@/components/ui";
import { api } from "@/lib/api";
import { ACHIEVEMENTS, ATTRIBUTES, HERO_CLASSES, SHOP, titleFor, type Attribute, type HeroClass, type ShopItem } from "@/lib/game-rules";
import type { GameEvent } from "@/server/game";
import { downloadBackup } from "@/lib/backup";

function Radar({ values }: { values: Record<string, number> }) {
  const keys = Object.keys(ATTRIBUTES) as Attribute[];
  const max = Math.max(20, ...keys.map((k) => values[k] ?? 0));
  const size = 260;
  const c = size / 2;
  const R = c - 38;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-xs">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={keys.map((_, i) => pt(i, R * f).join(",")).join(" ")} fill="none" stroke="var(--line)" />
      ))}
      <motion.polygon
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ transformOrigin: "center" }}
        points={keys.map((k, i) => pt(i, R * Math.max(0.04, (values[k] ?? 0) / max)).join(",")).join(" ")}
        fill="color-mix(in oklab, var(--gold) 35%, transparent)"
        stroke="var(--gold)"
        strokeWidth={2}
      />
      {keys.map((k, i) => {
        const [x, y] = pt(i, R + 22);
        return (
          <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="var(--muted)">
            {ATTRIBUTES[k].icon} {ATTRIBUTES[k].name}
          </text>
        );
      })}
    </svg>
  );
}

export default function HeroPage() {
  const { state, ai, refresh, handleEvents, toast } = useGame();
  const [lang] = useActiveLang();
  const [name, setName] = useState("");
  const [models, setModels] = useState<{ name: string; actions: string[] }[] | null>(null);
  const [aiCfg, setAiCfg] = useState<{ textModel: string; liveModel: string; ttsModel: string; voice: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<File | null>(null);
  const [prefs, setPrefs] = useState({ theme: "dark", sfx: "on", tts: "browser" });

  useEffect(() => {
    if (state) setName(state.profile.displayName);
  }, [state?.profile.displayName]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      setPrefs({ theme: localStorage.getItem("alsun-theme") ?? "dark", sfx: localStorage.getItem("alsun-sfx") ?? "on", tts: localStorage.getItem("alsun-tts") ?? "browser" });
    } catch {}
    api<{ textModel: string; liveModel: string; ttsModel: string; voice: string }>("/api/ai/status").then(setAiCfg).catch(() => {});
  }, []);

  if (!state) return <TopStats />;
  const p = state.profile;
  const attrs = Object.fromEntries(state.attributes.filter((a) => a.lang === lang).map((a) => [a.attribute, a.points]));
  const unlocked = new Set(state.achievements.map((a) => a.id));

  const save = async (body: Record<string, unknown>) => {
    await api("/api/profile", body);
    await refresh();
  };
  const setPref = (k: "theme" | "sfx" | "tts", v: string) => {
    setPrefs((x) => ({ ...x, [k]: v }));
    try {
      localStorage.setItem(`alsun-${k}`, v);
    } catch {}
    if (k === "theme") document.documentElement.dataset.theme = v;
  };
  const buy = async (item: ShopItem) => {
    const r = await api<{ ok: boolean; message?: string; events?: GameEvent[] }>("/api/shop", { item });
    if (!r.ok) toast(r.message ?? "تعذّر الشراء", "💸");
    else {
      toast(`اشتريت ${SHOP[item].name}`, SHOP[item].icon);
      handleEvents(r.events);
      refresh();
    }
  };
  const importBackup = async (f: File) => {
    setPendingImport(null);
    await api("/api/backup", JSON.parse(await f.text()));
    toast("تم استيراد النسخة الاحتياطية", "✅");
    refresh();
  };
  const saveModel = async (k: string, v: string) => {
    await save({ settings: { [k]: v } });
    setAiCfg((c) => c && { ...c, [k]: v });
  };

  return (
    <>
      <TopStats />
      <main className="overflow-x-clip px-4 pt-4">
        <div className="card p-5 text-center">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-card-2 text-6xl ring-4 ring-gold">{state.profile.heroClassInfo.icon}</div>
          <div className="mt-3 text-2xl font-black">{p.displayName}</div>
          <div className="font-bold text-gold">
            المستوى {state.level.level} · {titleFor(state.level.level)}
          </div>
          <div className="mx-auto mt-3 max-w-xs">
            <Bar value={state.level.progress} color="linear-gradient(90deg,var(--xp),var(--accent))" />
            <div className="mt-1 text-xs text-muted">
              {state.level.intoLevel} / {state.level.needed} خبرة للمستوى التالي
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              ["🔥", p.streak, "السلسلة"],
              ["🏅", p.longestStreak, "الأطول"],
              ["⭐", p.totalXp, "الخبرة"],
              ["📚", state.stats.lessons, "دروس"],
            ].map(([i, v, l]) => (
              <div key={String(l)} className="rounded-2xl bg-card-2 p-2">
                <div className="text-lg">{i}</div>
                <div className="font-black">{v}</div>
                <div className="text-[10px] text-muted">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <SectionTitle>⚔️ فئة البطل</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(HERO_CLASSES) as HeroClass[]).map((k) => {
            const c = HERO_CLASSES[k];
            const on = p.heroClass === k;
            return (
              <button key={k} onClick={() => save({ heroClass: k })} className={`card p-3 text-right ${on ? "ring-2 ring-gold" : "opacity-75"}`}>
                <div className="text-3xl">{c.icon}</div>
                <div className="font-black">{c.name}</div>
                <div className="text-xs text-muted">{c.perk}</div>
              </button>
            );
          })}
        </div>

        <SectionTitle>📊 سمات البطل</SectionTitle>
        <LangSwitcher />
        <div className="card mt-3 p-3">
          <Radar values={attrs} />
          <div className="text-center text-xs text-muted">تنمو كل سمة بنوع التمارين التي تتقنها في {getCourse(lang).name}</div>
        </div>

        <SectionTitle>🏪 متجر القافلة</SectionTitle>
        <div className="space-y-2">
          {(Object.keys(SHOP) as ShopItem[]).map((k) => (
            <div key={k} className="card flex items-center gap-3 p-4">
              <span className="text-3xl">{SHOP[k].icon}</span>
              <div className="flex-1">
                <div className="font-black">
                  {SHOP[k].name} {state.inventory[k] ? <span className="text-sm text-muted">(لديك {state.inventory[k]})</span> : null}
                </div>
                <div className="text-xs text-muted">{SHOP[k].desc}</div>
              </div>
              <button className="btn btn-ghost !min-h-10 text-gem" disabled={p.gems < SHOP[k].price} onClick={() => buy(k)}>
                {SHOP[k].price} 💎
              </button>
            </div>
          ))}
        </div>

        <SectionTitle>
          🏆 الإنجازات ({unlocked.size}/{ACHIEVEMENTS.length})
        </SectionTitle>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const has = unlocked.has(a.id);
            const tierColor = { bronze: "#cd7f32", silver: "#c0c0c0", gold: "var(--gold)", legend: "var(--xp)" }[a.tier];
            return (
              <div key={a.id} className={`card p-3 text-center ${has ? "" : "opacity-35 grayscale"}`} style={{ borderColor: has ? tierColor : undefined }} title={a.desc}>
                <div className="text-3xl">{a.icon}</div>
                <div className="mt-1 text-xs font-black">{a.name}</div>
                <div className="text-[10px] text-muted">{a.desc}</div>
              </div>
            );
          })}
        </div>

        <SectionTitle>⚙️ الإعدادات</SectionTitle>
        <div className="card space-y-4 p-4">
          <label className="block">
            <span className="text-sm text-muted">الاسم</span>
            <div className="mt-1 flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-line bg-card-2 px-3 py-2" />
              <button className="btn btn-ghost !min-h-10" onClick={() => save({ displayName: name })}>
                حفظ
              </button>
            </div>
          </label>
          <div>
            <span className="text-sm text-muted">الهدف اليومي</span>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {[30, 50, 100, 200].map((g) => (
                <button key={g} className={`option !min-h-11 font-bold ${p.dailyGoalXp === g ? "!border-gold" : ""}`} onClick={() => save({ dailyGoalXp: g })}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          {[
            { k: "theme" as const, label: "المظهر", opts: [["dark", "🌙 ليلي"], ["light", "☀️ نهاري"]] },
            { k: "sfx" as const, label: "المؤثرات الصوتية", opts: [["on", "🔔 مفعّلة"], ["off", "🔕 مطفأة"]] },
            { k: "tts" as const, label: "صوت النطق", opts: [["browser", "صوت الجهاز (مجاني)"], ["gemini", "Gemini (أوضح)"]] },
          ].map((row) => (
            <div key={row.k}>
              <span className="text-sm text-muted">{row.label}</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {row.opts.map(([v, l]) => (
                  <button key={v} className={`option !min-h-11 text-sm font-bold ${prefs[row.k] === v ? "!border-gold" : ""}`} onClick={() => setPref(row.k, v)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label className="flex items-center justify-between">
            <span>
              <span className="font-bold">التجوال الحر</span>
              <span className="block text-xs text-muted">فتح كل الدروس دون اشتراط الترتيب</span>
            </span>
            <input type="checkbox" className="h-6 w-6 accent-[var(--gold)]" checked={Boolean(p.settings?.freeRoam)} onChange={(e) => save({ settings: { freeRoam: e.target.checked } })} />
          </label>
        </div>

        <SectionTitle>🔮 الذكاء الاصطناعي</SectionTitle>
        {(ai as { provider?: string } | null)?.provider === "claude" ? (
          <div className="card p-4 text-sm leading-7">
            <div className={`font-bold ${ai?.enabled ? "text-good" : "text-bad"}`}>{ai?.enabled ? "✓ Claude مدمج ويعمل" : "✗ غير متاح في هذا العرض"}</div>
            <div className="text-muted">في هذه النسخة يتولى Claude توليد الدروس وشرح الأخطاء والمحادثة، ويُفهم كلامك عبر خاصية الإملاء الصوتي في المتصفح.</div>
          </div>
        ) : (
        <div className="card space-y-3 p-4 text-sm">
          <div className={`font-bold ${ai?.enabled ? "text-good" : "text-bad"}`}>{ai?.enabled ? "✓ المفتاح مضبوط" : "✗ لم يُضبط مفتاح GEMINI_API_KEY"}</div>
          {!ai?.enabled && (
            <ol className="list-decimal space-y-1 pe-5 leading-7 text-muted">
              <li>افتح aistudio.google.com/apikey وسجّل بحساب Google.</li>
              <li>أنشئ مفتاحاً (Create API key).</li>
              <li>
                ضعه في ملف <span className="foreign">.env.local</span> داخل مجلد المشروع: <code className="foreign">GEMINI_API_KEY=...</code>
              </li>
              <li>أعد تشغيل الموقع.</li>
            </ol>
          )}
          {ai?.enabled && aiCfg && (
            <>
              {(
                [
                  ["textModel", "نموذج النصوص والتقييم", (m: { name: string; actions: string[] }) => m.actions.includes("generateContent") && !/tts|image|embed|live|native-audio/.test(m.name)],
                  ["liveModel", "نموذج المحادثة الحية", (m: { name: string; actions: string[] }) => m.actions.includes("bidiGenerateContent")],
                  ["ttsModel", "نموذج النطق", (m: { name: string }) => /tts/.test(m.name)],
                ] as const
              ).map(([k, label, f]) => (
                <label key={k} className="block">
                  <span className="text-muted">{label}</span>
                  {models ? (
                    <select value={aiCfg[k]} onChange={(e) => saveModel(k, e.target.value)} className="foreign mt-1 w-full rounded-xl border border-line bg-card-2 px-3 py-2">
                      {[aiCfg[k], ...models.filter(f).map((m) => m.name)].filter((v, i, a) => a.indexOf(v) === i).map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="foreign mt-1 rounded-xl bg-card-2 px-3 py-2">{aiCfg[k]}</div>
                  )}
                </label>
              ))}
              {!models && (
                <button className="btn btn-ghost w-full" onClick={() => api<{ models: { name: string; actions: string[] }[] }>("/api/ai/models").then((r) => setModels(r.models)).catch((e) => toast(e.message, "⚠️"))}>
                  تحميل النماذج المتاحة لمفتاحك
                </button>
              )}
              <label className="block">
                <span className="text-muted">صوت الشريك</span>
                <select value={aiCfg.voice} onChange={(e) => saveModel("voice", e.target.value)} className="foreign mt-1 w-full rounded-xl border border-line bg-card-2 px-3 py-2">
                  {["Kore", "Puck", "Charon", "Aoede", "Fenrir", "Leda", "Orus", "Zephyr"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        )}

        <SectionTitle>💾 النسخ الاحتياطي</SectionTitle>
        <div className="card flex gap-3 p-4">
          <button onClick={() => downloadBackup().catch((e) => toast(e.message, "⚠️"))} className="btn btn-ghost flex-1">
            ⬇️ تصدير
          </button>
          <label className="btn btn-ghost flex-1 cursor-pointer">
            ⬆️ استيراد
            <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && setPendingImport(e.target.files[0])} />
          </label>
        </div>
        {pendingImport && (
          <div className="card mt-2 flex items-center gap-2 border-bad p-3 text-sm">
            <span className="flex-1">سيستبدل الاستيراد كل تقدمك الحالي بالملف «{pendingImport.name}».</span>
            <button className="btn btn-bad !min-h-10" onClick={() => importBackup(pendingImport)}>
              استبدل
            </button>
            <button className="btn btn-ghost !min-h-10" onClick={() => setPendingImport(null)}>
              إلغاء
            </button>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">كل بياناتك محفوظة محلياً في الملف data/alsun.db على جهازك.</p>
      </main>
    </>
  );
}
