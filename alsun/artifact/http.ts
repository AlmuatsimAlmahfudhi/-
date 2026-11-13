import { ready, scheduleSave } from "./db";
import { AiDisabledError } from "./ai";

export function handler<T>(fn: (req: Request, ctx: T) => Promise<unknown>) {
  return async (req: Request, ctx: T) => {
    try {
      await ready();
      const out = await fn(req, ctx);
      scheduleSave();
      if (out instanceof Response) return out;
      return Response.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof AiDisabledError) return Response.json({ error: e.message, code: "ai_disabled" }, { status: 503 });
      console.error(e);
      return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  };
}
