/** موجّه داخلي: نفس مسارات /api/* لكنها تُنفَّذ داخل المتصفح مباشرة */
import * as aiExplain from "@/app/api/ai/explain/route";
import * as aiLesson from "@/app/api/ai/lesson/route";
import * as aiSentences from "@/app/api/ai/sentences/route";
import * as conversation from "@/app/api/conversation/route";
import * as backup from "@/app/api/backup/route";
import * as lessonComplete from "@/app/api/lesson/complete/route";
import * as profile from "@/app/api/profile/route";
import * as progress from "@/app/api/progress/[lang]/route";
import * as review from "@/app/api/review/route";
import * as shop from "@/app/api/shop/route";
import * as speakLog from "@/app/api/speak-log/route";
import * as state from "@/app/api/state/route";
import { replaceAll, ready, schema as s } from "./db";
import { ready as caps } from "./claude";

export class ApiError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
  }
}

type Mod = { GET?: (req: Request, ctx: unknown) => Promise<Response>; POST?: (req: Request, ctx: unknown) => Promise<Response> };
const ROUTES: [RegExp, Mod][] = [
  [/^\/api\/state$/, state],
  [/^\/api\/profile$/, profile],
  [/^\/api\/progress\/(?<lang>[a-z]+)$/, progress],
  [/^\/api\/lesson\/complete$/, lessonComplete],
  [/^\/api\/review$/, review],
  [/^\/api\/shop$/, shop],
  [/^\/api\/speak-log$/, speakLog],
  [/^\/api\/conversation$/, conversation],
  [/^\/api\/backup$/, backup],
  [/^\/api\/ai\/lesson$/, aiLesson],
  [/^\/api\/ai\/sentences$/, aiSentences],
  [/^\/api\/ai\/explain$/, aiExplain],
];

const TABLES = {
  profile: s.profile, languageProgress: s.languageProgress, skillStats: s.skillStats, lessonProgress: s.lessonProgress,
  srsCards: s.srsCards, reviewLogs: s.reviewLogs, xpEvents: s.xpEvents, achievements: s.achievements, dailyQuests: s.dailyQuests,
  inventory: s.inventory, counters: s.counters, aiCache: s.aiCache, conversations: s.conversations, pronunciationAttempts: s.pronunciationAttempts,
};

export async function api<T = unknown>(url: string, body?: unknown): Promise<T> {
  const u = new URL(url, "https://alsun.local");
  const method = body === undefined ? "GET" : "POST";
  if (u.pathname === "/api/ai/status") return { enabled: Boolean(caps.sample), mic: false, provider: "claude", textModel: "Claude", liveModel: "Claude", ttsModel: "browser", voice: "Kore" } as T;
  if (u.pathname === "/api/backup" && method === "POST") {
    const b = body as { app?: string; data?: Record<string, Record<string, unknown>[]> };
    if (b.app !== "alsun" || !b.data) throw new ApiError("ملف غير صالح");
    await replaceAll(b.data, TABLES);
    return { ok: true } as T;
  }
  await ready();
  for (const [re, mod] of ROUTES) {
    const m = u.pathname.match(re);
    if (!m) continue;
    const fn = mod[method];
    if (!fn) break;
    const req = new Request(u.toString(), {
      method,
      body: method === "POST" ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      headers: body instanceof FormData || method === "GET" ? undefined : { "Content-Type": "application/json" },
    });
    const res = await fn(req, { params: Promise.resolve(m.groups ?? {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error ?? `خطأ ${res.status}`, data.code, res.status);
    return data as T;
  }
  throw new ApiError(`مسار غير معروف: ${u.pathname}`, undefined, 404);
}
