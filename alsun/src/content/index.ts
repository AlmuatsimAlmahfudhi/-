import { aiUnitsFor } from "./builder";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import type { Course, Item, LangCode, Lesson, LevelDef, Unit } from "./types";
import { zh } from "./zh";

export * from "./types";

export const COURSES: Record<LangCode, Course> = { en, fr, es, zh };
export const LANGS: LangCode[] = ["en", "fr", "es", "zh"];

export function getCourse(lang: string): Course {
  const c = COURSES[lang as LangCode];
  if (!c) throw new Error(`Unknown language ${lang}`);
  return c;
}

export function isLang(lang: string): lang is LangCode {
  return lang in COURSES;
}

/** المراحل بالترتيب: التأسيس ثم مستويات الإطار */
export function stages(course: Course): LevelDef[] {
  return [course.foundation, ...course.levels];
}

export interface PathLesson {
  lesson: Lesson;
  unit: Unit;
  level: LevelDef;
  index: number;
}

const pathCache = new Map<LangCode, PathLesson[]>();
const unitCache = new Map<string, Unit[]>();

export function unitsOf(course: Course, level: LevelDef): Unit[] {
  const key = `${course.lang}:${level.code}`;
  if (!unitCache.has(key)) unitCache.set(key, aiUnitsFor(course.lang, level));
  return unitCache.get(key)!;
}

/** المسار الخطي الكامل لكل دروس اللغة (يحدد ترتيب الفتح) */
export function learningPath(lang: LangCode): PathLesson[] {
  if (!pathCache.has(lang)) {
    const course = getCourse(lang);
    const out: PathLesson[] = [];
    for (const level of stages(course))
      for (const unit of unitsOf(course, level))
        for (const lesson of unit.lessons) out.push({ lesson, unit, level, index: out.length });
    pathCache.set(lang, out);
  }
  return pathCache.get(lang)!;
}

export function findLesson(lang: LangCode, lessonId: string): PathLesson | undefined {
  return learningPath(lang).find((p) => p.lesson.id === lessonId);
}

export function getItem(lang: LangCode, id: string): Item | undefined {
  return getCourse(lang).items[id];
}

/** النص كما يُعرض (الصينية بلا مسافات) */
export function display(lang: LangCode, text: string): string {
  return lang === "zh" ? text.replace(/\s+/g, "") : text;
}

/** الكلمات المكوّنة للجملة لتمرين بناء الجمل */
export function tokens(text: string): string[] {
  return text.replace(/[¿?¡!.,]/g, " ").split(/\s+/).filter(Boolean);
}

/** كل العناصر التي سبق للمتعلم مواجهتها حتى درس معين (لتوليد مشتتات واقعية) */
export function itemsUpTo(lang: LangCode, lessonIndex: number): Item[] {
  const course = getCourse(lang);
  const ids = new Set<string>();
  for (const p of learningPath(lang).slice(0, lessonIndex + 1)) p.lesson.items.forEach((i) => ids.add(i));
  return [...ids].map((i) => course.items[i]).filter(Boolean);
}
