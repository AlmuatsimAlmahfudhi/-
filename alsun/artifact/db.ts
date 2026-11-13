/**
 * قاعدة البيانات داخل المتصفح: SQLite (sql.js) مع Drizzle نفسه المستعمل في النسخة المحلية.
 * الحفظ: نسخة سريعة في متصفحك، ونسخة دائمة في حسابك عبر قدرة db (مقسّمة إلى أجزاء).
 */
import initSqlJs from "sql.js/dist/sql-wasm-inline.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "@/db/schema";
import initSql from "../drizzle/0000_init.sql";
import { cap } from "./claude";

type Db = ReturnType<typeof drizzle<typeof schema>>;
let real: Db | null = null;
let raw: { export(): Uint8Array; run(s: string): void } | null = null;

export const db = new Proxy({} as Db, {
  get(_t, prop) {
    if (!real) throw new Error("قاعدة البيانات لم تجهز بعد");
    const v = (real as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});
export { schema };

const LS_KEY = "alsun-db-v1";
const CHUNK = 180_000;

function b64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

type Col = { doc(id: string): { get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>; set(d: Record<string, unknown>): Promise<void> } };
let col: Col | null = null;
export let storageMode: "cloud" | "browser" | "memory" = "memory";

async function cloudCollection(): Promise<Col | null> {
  try {
    const [store, user] = await Promise.all([cap("db"), cap("user")]);
    if (!store || !user) return null;
    const id = await user.id();
    if (!id) return null;
    return store.collection(`data/users/${id}`) as Col;
  } catch {
    return null;
  }
}

async function loadCloud(): Promise<{ bytes: Uint8Array; at: number } | null> {
  if (!col) return null;
  const meta = await col.doc("meta").get();
  if (!meta.exists) return null;
  const m = meta.data() as { chunks: number; at: number };
  const parts: string[] = [];
  for (let i = 0; i < m.chunks; i++) {
    const d = await col.doc(`chunk${i}`).get();
    if (!d.exists) return null;
    parts.push(String(d.data()!.b));
  }
  return { bytes: unb64(parts.join("")), at: m.at };
}

function loadLocal(): { bytes: Uint8Array; at: number } | null {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (!s) return null;
    const { at, b } = JSON.parse(s);
    return { bytes: unb64(b), at };
  } catch {
    return null;
  }
}

let readyP: Promise<void> | null = null;
export function ready(): Promise<void> {
  readyP ??= (async () => {
    const SQL = await initSqlJs();
    col = await cloudCollection();
    let cloud: { bytes: Uint8Array; at: number } | null = null;
    try {
      cloud = await loadCloud();
    } catch {
      col = null;
    }
    const local = loadLocal();
    const pick = cloud && (!local || cloud.at >= local.at) ? cloud : local;
    const sqlDb = pick ? new SQL.Database(pick.bytes) : new SQL.Database();
    raw = sqlDb;
    if (!pick) for (const stmt of initSql.split("--> statement-breakpoint")) if (stmt.trim()) sqlDb.run(stmt);
    real = drizzle(sqlDb, { schema });
    await real.insert(schema.profile).values({ id: 1, createdAt: Date.now() }).onConflictDoNothing();
    storageMode = col ? "cloud" : local !== null || canLocal() ? "browser" : "memory";
  })();
  return readyP;
}

function canLocal() {
  try {
    localStorage.setItem("alsun-probe", "1");
    localStorage.removeItem("alsun-probe");
    return true;
  } catch {
    return false;
  }
}

// ───── الحفظ المؤجَّل: دفعة واحدة بعد كل توقف قصير عن الكتابة ─────
let timer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<void> = Promise.resolve();
const lastChunks: string[] = [];

export function scheduleSave() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    saving = saving.then(saveNow).catch((e) => console.error("save failed", e));
  }, 1500);
}

async function saveNow() {
  if (!raw) return;
  const b = b64(raw.export());
  const at = Date.now();
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ at, b }));
  } catch {}
  if (!col) return;
  const chunks: string[] = [];
  for (let i = 0; i < b.length; i += CHUNK) chunks.push(b.slice(i, i + CHUNK));
  let changed = chunks.length !== lastChunks.length;
  for (let i = 0; i < chunks.length; i++) {
    if (lastChunks[i] === chunks[i]) continue;
    changed = true;
    await col.doc(`chunk${i}`).set({ b: chunks[i] });
    lastChunks[i] = chunks[i];
  }
  lastChunks.length = chunks.length;
  if (changed) await col.doc("meta").set({ chunks: chunks.length, at });
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (raw) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), b: b64(raw.export()) }));
      } catch {}
    }
  });
}

/** استيراد نسخة احتياطية بلا معاملات (المحرك المتزامن لا يقبل معاملات async) */
export async function replaceAll(data: Record<string, Record<string, unknown>[]>, tables: Record<string, unknown>) {
  await ready();
  for (const [k, t] of Object.entries(tables)) {
    await real!.delete(t as typeof schema.profile);
    const rows = data[k] ?? [];
    for (let i = 0; i < rows.length; i += 200) if (rows.length) await real!.insert(t as typeof schema.profile).values(rows.slice(i, i + 200) as never);
  }
  scheduleSave();
}
