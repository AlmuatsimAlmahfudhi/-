"use client";
import { COURSES, LANGS, type LangCode } from "@/content";
import { api } from "@/lib/api";
import { useGame } from "./GameProvider";

export function useActiveLang(): [LangCode, (l: LangCode) => Promise<void>] {
  const { state, refresh } = useGame();
  const lang = (state?.profile.activeLang ?? "en") as LangCode;
  return [
    lang,
    async (l) => {
      await api("/api/profile", { activeLang: l });
      await refresh();
    },
  ];
}

export function LangSwitcher() {
  const [lang, setLang] = useActiveLang();
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      {LANGS.map((l) => {
        const c = COURSES[l];
        const on = l === lang;
        return (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`flex shrink-0 items-center gap-2 rounded-2xl border-2 px-4 py-2 font-bold transition ${on ? "bg-card-2" : "border-line bg-card opacity-70"}`}
            style={{ borderColor: on ? c.color : undefined }}
          >
            <span className="text-2xl">{c.flag}</span>
            <span>{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
