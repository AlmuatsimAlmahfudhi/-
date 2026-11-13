"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGame } from "./GameProvider";

const TABS = [
  { href: "/", icon: "🏠", label: "الرئيسية", match: (p: string) => p === "/" },
  { href: "/learn", icon: "🗺️", label: "المغامرة", match: (p: string) => p.startsWith("/learn") },
  { href: "/review", icon: "🔁", label: "المراجعة", match: (p: string) => p.startsWith("/review") },
  { href: "/speak", icon: "🎙️", label: "المحادثة", match: (p: string) => p.startsWith("/speak") },
  { href: "/hero", icon: "🛡️", label: "البطل", match: (p: string) => p.startsWith("/hero") },
];

export function BottomNav() {
  const path = usePathname();
  const { state } = useGame();
  if (path.startsWith("/lesson")) return null;
  const due = Object.values(state?.due ?? {}).reduce((a, b) => a + b, 0);
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg-2/90 backdrop-blur-md">
      <div className="mx-auto grid max-w-3xl grid-cols-5">
        {TABS.map((t) => {
          const active = t.match(path);
          return (
            <Link key={t.href} href={t.href} className="relative flex min-h-16 flex-col items-center justify-center gap-0.5 pt-1">
              <span className={`text-2xl transition-transform ${active ? "scale-115" : "opacity-60 grayscale-[60%]"}`}>{t.icon}</span>
              <span className={`text-[11px] font-bold ${active ? "text-gold" : "text-muted"}`}>{t.label}</span>
              {t.href === "/review" && due > 0 && (
                <span className="absolute top-1 left-1/2 -translate-x-[-10px] rounded-full bg-bad px-1.5 text-[10px] font-black text-white">{due > 99 ? "99+" : due}</span>
              )}
              {active && <span className="absolute top-0 h-1 w-10 rounded-b-full bg-gold" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
