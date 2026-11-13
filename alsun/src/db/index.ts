import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const g = globalThis as unknown as { __alsunDb?: ReturnType<typeof drizzle<typeof schema>>; __alsunReady?: Promise<void> };

export const db = g.__alsunDb ?? drizzle(createClient({ url: `file:${path.join(dataDir, "alsun.db")}` }), { schema });
g.__alsunDb = db;

/** تُشغَّل الترحيلات تلقائياً عند أول طلب، فلا يحتاج المستخدم أي أمر إضافي */
export function ready(): Promise<void> {
  if (!g.__alsunReady) {
    g.__alsunReady = migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") }).then(async () => {
      await db
        .insert(schema.profile)
        .values({ id: 1, createdAt: Date.now() })
        .onConflictDoNothing();
    });
  }
  return g.__alsunReady;
}

export { schema };
