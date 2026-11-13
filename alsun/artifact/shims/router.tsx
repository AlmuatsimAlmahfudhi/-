"use client";
import { createContext, useContext, useEffect, useState } from "react";

const TABS: Record<string, string> = { "": "/", home: "/", learn: "/learn", review: "/review", speak: "/speak", hero: "/hero" };
const HASH: Record<string, string> = { "/": "home", "/learn": "learn", "/review": "review", "/speak": "speak", "/hero": "hero" };

type Nav = { path: string; navigate: (p: string) => void };
const Ctx = createContext<Nav>({ path: "/", navigate: () => {} });
export const useRouter = () => useContext(Ctx);

let external: ((p: string) => void) | null = null;
export const navigate = (p: string) => external?.(p);

export function RouterProvider({ children }: { children: (path: string) => React.ReactNode }) {
  const initial = () => {
    try {
      return TABS[location.hash.replace("#", "")] ?? "/";
    } catch {
      return "/";
    }
  };
  const [path, setPath] = useState(initial);
  const go = (p: string) => {
    setPath(p);
    window.scrollTo(0, 0);
    try {
      const h = HASH[p];
      if (h && location.hash !== "#" + h) history.replaceState(null, "", "#" + h);
    } catch {}
  };
  external = go;
  useEffect(() => {
    const on = () => setPath(initial());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return <Ctx.Provider value={{ path, navigate: go }}>{children(path)}</Ctx.Provider>;
}
