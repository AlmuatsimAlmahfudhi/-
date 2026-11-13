"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { getCourse } from "@/content";
import { useGame } from "@/components/GameProvider";
import { LangSwitcher, useActiveLang } from "@/components/LangSwitcher";
import { Bar, SectionTitle, TopStats } from "@/components/ui";
import { titleFor } from "@/lib/game-rules";
import { useProgress } from "@/lib/progress";

const DAYS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

function Ring({ value, size = 92, children }: { value: number; size?: number; children: React.ReactNode }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--card-2)" strokeWidth={9} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--fire)"
          strokeWidth={9}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, value)) }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export default function Home() {
  const { state, ai } = useGame();
  const [lang] = useActiveLang();
  const course = getCourse(lang);
  const prog = useProgress(lang);
  if (!state) return <TopStats />;
  const p = state.profile;
  const goal = state.xpToday / p.dailyGoalXp;
  const due = state.due[lang] ?? 0;
  const maxWeek = Math.max(p.dailyGoalXp, ...state.week.map((w) => w.xp));

  return (
    <>
      <TopStats />
      <main className="px-4 pt-4">
        <div className="card relative overflow-hidden p-5">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-card-2 text-4xl ring-2 ring-gold">{state.profile.heroClassInfo.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-muted">مرحباً بعودتك</div>
              <div className="truncate text-xl font-black">{p.displayName}</div>
              <div className="text-sm font-bold text-gold">
                {titleFor(state.level.level)} · {state.profile.heroClassInfo.name}
              </div>
            </div>
            <Ring value={goal}>
              <div>
                <div className="text-lg font-black">{state.xpToday}</div>
                <div className="text-[10px] text-muted">/ {p.dailyGoalXp} خبرة</div>
              </div>
            </Ring>
          </div>
        </div>

        <SectionTitle>لغتك الحالية</SectionTitle>
        <LangSwitcher />

        {prog.next && (
          <Link href={`/lesson/${lang}/${encodeURIComponent(prog.next.lesson.id)}`} className="mt-4 block">
            <motion.div whileTap={{ scale: 0.98 }} className="card relative overflow-hidden p-5" style={{ borderColor: course.color }}>
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-4xl" style={{ background: `color-mix(in oklab, ${course.color} 30%, transparent)` }}>
                  {prog.next.unit.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-muted">
                    {prog.next.level.region} · {prog.next.level.code === "FOUNDATION" ? "التأسيس" : prog.next.level.code}
                  </div>
                  <div className="truncate text-lg font-black">{prog.next.unit.title}</div>
                  <div className="text-sm text-muted">{prog.next.lesson.title}</div>
                </div>
                <div className="btn btn-gold shrink-0">{prog.doneCount ? "تابع" : "ابدأ"} ◀</div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                <Bar value={prog.doneCount / prog.path.length} color={course.color} className="h-2" />
                <span className="shrink-0">
                  {prog.doneCount}/{prog.path.length}
                </span>
              </div>
            </motion.div>
          </Link>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link href="/review" className="card p-4">
            <div className="text-3xl">🔁</div>
            <div className="mt-1 font-black">المراجعة</div>
            <div className="text-sm text-muted">{due ? `${due} بطاقة مستحقة` : "لا مراجعات الآن"}</div>
          </Link>
          <Link href="/speak" className="card p-4">
            <div className="text-3xl">🎙️</div>
            <div className="mt-1 font-black">المحادثة</div>
            <div className="text-sm text-muted">{ai?.enabled ? "تكلّم مع الذكاء الاصطناعي" : "يتطلب مفتاح Gemini"}</div>
          </Link>
        </div>

        <SectionTitle>📜 مهام اليوم</SectionTitle>
        <div className="space-y-2">
          {state.quests.map((q) => (
            <div key={q.id} className={`card flex items-center gap-3 p-4 ${q.claimed ? "opacity-60" : ""}`}>
              <div className="text-2xl">{q.claimed ? "✅" : "⚔️"}</div>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{q.text}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Bar value={q.progress / q.target} color="var(--gem)" className="h-2" />
                  <span className="shrink-0 text-xs text-muted">
                    {q.progress}/{q.target}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-sm font-black text-gem">+{q.reward} 💎</div>
            </div>
          ))}
        </div>

        <SectionTitle>📈 خبرة الأسبوع</SectionTitle>
        <div className="card flex h-40 items-end gap-2 p-4">
          {state.week.map((w) => {
            const d = new Date(w.day + "T12:00:00");
            const hit = w.xp >= p.dailyGoalXp;
            return (
              <div key={w.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-muted">{w.xp || ""}</span>
                <motion.div
                  className="w-full rounded-t-lg"
                  style={{ background: hit ? "var(--fire)" : "var(--accent)" }}
                  initial={{ height: 0 }}
                  animate={{ height: `${(w.xp / maxWeek) * 100}%` }}
                />
                <span className="text-[10px] text-muted">{DAYS[d.getDay()]}</span>
              </div>
            );
          })}
        </div>

        {!ai?.enabled && ai && (
          <div className="card mt-6 border-dashed p-4 text-sm leading-7 text-muted">
            <b className="text-gold">🔮 فعّل قوى الذكاء الاصطناعي:</b> أضف مفتاح Gemini إلى ملف <code className="foreign">.env.local</code> لتفتح المحادثة الصوتية،
            وتقييم النطق، ودروس المستويات العليا. التفاصيل في صفحة البطل ← الإعدادات.
          </div>
        )}
      </main>
    </>
  );
}
