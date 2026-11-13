/** الوصول إلى قدرات عارض claude.ai — كل قدرة قد تكون null فنتعامل مع غيابها */
type Use = (name: string) => Promise<unknown>;
const cache = new Map<string, Promise<unknown>>();
export function cap<T = any>(name: string): Promise<T | null> {  // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!cache.has(name)) {
    const w = window as unknown as { claude?: { use?: Use } };
    const p = w.claude?.use ? w.claude.use(name).catch(() => null) : Promise.resolve(null);
    cache.set(name, p);
  }
  return cache.get(name) as Promise<T | null>;
}

/** نسخ متزامنة تُملأ عند الإقلاع لما يحتاج فحصاً فورياً (مثل start() من النقرة مباشرة) */
export const ready: { dictation: any; tts: any; sample: any; downloads: any } = { dictation: null, tts: null, sample: null, downloads: null }; // eslint-disable-line @typescript-eslint/no-explicit-any
export async function boot() {
  const [dictation, tts, sample, downloads] = await Promise.all([cap("dictation"), cap("tts"), cap("sample"), cap("downloads")]);
  Object.assign(ready, { dictation, tts, sample, downloads });
}
