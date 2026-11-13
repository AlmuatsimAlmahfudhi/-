import "server-only";
import { NextResponse } from "next/server";
import { AiDisabledError } from "./ai";
import { ready } from "@/db";

export function handler<T>(fn: (req: Request, ctx: T) => Promise<unknown>) {
  return async (req: Request, ctx: T) => {
    try {
      await ready();
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof AiDisabledError) return NextResponse.json({ error: e.message, code: "ai_disabled" }, { status: 503 });
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}
