"use client";
import { useCallback, useEffect, useState } from "react";
import { learningPath, type LangCode, type PathLesson } from "@/content";
import { api } from "./api";

export interface LessonRow {
  lessonId: string;
  crowns: number;
  bestAccuracy: number;
  timesCompleted: number;
}

/** تقدم اللغة: الدروس المنجزة، والدرس التالي، وحالة الفتح لكل درس */
export function useProgress(lang: LangCode) {
  const [rows, setRows] = useState<Map<string, LessonRow> | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    const r = await api<{ lessons: LessonRow[]; seenItems: string[] }>(`/api/progress/${lang}`);
    setRows(new Map(r.lessons.map((x) => [x.lessonId, x])));
    setSeen(new Set(r.seenItems));
  }, [lang]);
  useEffect(() => {
    setRows(null);
    load().catch(console.error);
  }, [load]);
  const path = learningPath(lang);
  const done = (id: string) => (rows?.get(id)?.crowns ?? 0) > 0;
  const nextIndex = path.findIndex((p) => !done(p.lesson.id));
  const next: PathLesson | undefined = path[nextIndex === -1 ? path.length - 1 : nextIndex];
  const unlocked = (p: PathLesson, freeRoam = false) => freeRoam || p.index === 0 || done(p.lesson.id) || done(path[p.index - 1].lesson.id);
  const doneCount = path.filter((p) => done(p.lesson.id)).length;
  return { rows, seen, path, next, done, unlocked, doneCount, reload: load, loading: rows === null };
}
