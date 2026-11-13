"use client";
import { api } from "./api";
import { ready } from "./claude";

export async function downloadBackup(): Promise<void> {
  const data = await api<unknown>("/api/backup");
  const dl = ready.downloads;
  if (!dl) throw new Error("التنزيل غير متاح في هذا العرض");
  await dl.save({ filename: `alsun-backup-${new Date().toISOString().slice(0, 10)}.json`, data: new Blob([JSON.stringify(data)], { type: "application/json" }) });
}
