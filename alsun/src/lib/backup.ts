"use client";
/** تنزيل نسخة احتياطية (في النسخة المحلية: عبر مسار الخادم) */
export async function downloadBackup(): Promise<void> {
  window.location.href = "/api/backup";
}
