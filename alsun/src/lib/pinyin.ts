/** أدوات البينيين: نزع علامات النغمة وتطبيقها حسب قواعد الكتابة الرسمية */
const MARKS: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  o: ["ō", "ó", "ǒ", "ò"],
  u: ["ū", "ú", "ǔ", "ù"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
};
const REVERSE = new Map<string, [string, number]>();
for (const [v, arr] of Object.entries(MARKS)) arr.forEach((m, i) => REVERSE.set(m, [v, i + 1]));

export function toneOfSyllable(s: string): number {
  for (const ch of s) if (REVERSE.has(ch)) return REVERSE.get(ch)![1];
  return 5;
}

export function stripTone(s: string): string {
  return [...s].map((c) => REVERSE.get(c)?.[0] ?? c).join("");
}

/** يضع علامة النغمة على الحرف الصحيح: a/e أولاً، ثم o في ou، وإلا آخر حرف علة */
export function withTone(syllable: string, tone: number): string {
  const base = stripTone(syllable);
  if (tone === 5) return base;
  const lower = base.toLowerCase();
  let idx = lower.search(/[ae]/);
  if (idx < 0) idx = lower.indexOf("ou");
  if (idx < 0) {
    for (let i = lower.length - 1; i >= 0; i--)
      if ("iouü".includes(lower[i])) {
        idx = i;
        break;
      }
  }
  if (idx < 0) return base;
  const v = lower[idx];
  return base.slice(0, idx) + MARKS[v][tone - 1] + base.slice(idx + 1);
}

/** يقطّع نص بينيين إلى مقاطع (بالمسافات فقط — يكفي لمحتوانا) */
export const syllables = (s: string) => s.split(/\s+/).filter(Boolean);

/** بدائل خاطئة لنطق مقاطع متعددة (لتمرين تغيّر النغمات) */
export function toneVariants(reading: string, n = 3): string[] {
  const syl = syllables(reading);
  const out = new Set<string>([reading]);
  let guard = 0;
  while (out.size < n + 1 && guard++ < 50) {
    const k = Math.floor(Math.random() * syl.length);
    const t = 1 + Math.floor(Math.random() * 4);
    const copy = [...syl];
    copy[k] = withTone(copy[k], t);
    out.add(copy.join(" "));
  }
  return [...out];
}
