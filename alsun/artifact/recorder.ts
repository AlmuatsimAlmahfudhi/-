"use client";
/** التسجيل المباشر للميكروفون غير متاح داخل claude.ai؛ نُبقي الواجهة نفسها */
export function useRecorder() {
  return {
    unsupported: true,
    recording: false,
    level: 0,
    pitch: [] as number[],
    error: null as string | null,
    start: async () => {},
    stop: async () => null as Blob | null,
  };
}
