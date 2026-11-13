"use client";
import { useRouter as useR } from "./router";
export function usePathname() {
  return useR().path;
}
export function useRouter() {
  const r = useR();
  return { push: r.navigate, replace: r.navigate, back: () => r.navigate("/learn"), refresh: () => {} };
}
