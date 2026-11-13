import type { GrammarNote, Item, ItemType, LangCode, Lesson, LevelDef, Unit } from "./types";

/**
 * أدوات كتابة المنهج بصيغة مختصرة.
 * كل وحدة تُكتب كقائمة مفردات + جمل + ملاحظة نحوية، ثم تُبنى منها الدروس تلقائياً:
 *   درس مفردات (1) ← درس مفردات (2) ← درس جمل ← معركة الزعيم
 */
export class CourseBuilder {
  items: Record<string, Item> = {};
  constructor(public lang: LangCode) {}

  add(type: ItemType, id: string, text: string, ar: string, extra: Partial<Item> = {}): string {
    const full = `${this.lang}.${id}`;
    this.items[full] = { id: full, type, text, ar, ...extra };
    return full;
  }

  /** [النص، المعنى، النطق، ملاحظة؟، ما يُنطق؟] */
  words(prefix: string, rows: [string, string, string?, string?, string?][], type: ItemType = "word"): string[] {
    return rows.map(([text, ar, reading, note, say], i) =>
      this.add(type, `${prefix}.${i}`, text, ar, { reading, note, say }),
    );
  }

  unit(
    id: string,
    title: string,
    icon: string,
    description: string,
    opts: {
      words: [string, string, string?, string?, string?][];
      phrases?: [string, string, string?, string?][];
      grammar?: GrammarNote;
      kind?: "vocab" | "script" | "tones";
      itemType?: ItemType;
    },
  ): Unit {
    const kind = opts.kind ?? "vocab";
    const wordIds = this.words(`${id}.w`, opts.words, opts.itemType ?? (kind === "script" ? "letter" : "word"));
    const phraseIds = opts.phrases ? this.words(`${id}.p`, opts.phrases, "phrase") : [];
    const lessons: Lesson[] = [];
    const chunk = Math.ceil(wordIds.length / 2);
    const first = wordIds.slice(0, chunk);
    const second = wordIds.slice(chunk);
    lessons.push({ id: `${id}.l1`, title: kind === "vocab" ? "مفردات (1)" : "التعرّف (1)", kind, items: first, grammar: opts.grammar });
    if (second.length)
      lessons.push({ id: `${id}.l2`, title: kind === "vocab" ? "مفردات (2)" : "التعرّف (2)", kind, items: second });
    if (phraseIds.length)
      lessons.push({ id: `${id}.l3`, title: "جمل وتعابير", kind: "phrases", items: [...phraseIds], grammar: opts.grammar });
    lessons.push({ id: `${id}.boss`, title: "معركة الزعيم", kind: "boss", items: [...wordIds, ...phraseIds] });
    return { id: `${this.lang}.${id}`, title, icon, description, lessons: lessons.map((l) => ({ ...l, id: `${this.lang}.${l.id}` })) };
  }
}

/** يحوّل مواضيع مستوى غير مكتوب مسبقاً إلى وحدات يولّد الذكاء الاصطناعي دروسها */
export function aiUnitsFor(lang: LangCode, level: LevelDef): Unit[] {
  if (level.units.length) return level.units;
  const icons = ["🗺️", "🏛️", "⚔️", "🧭", "📜", "🔮", "🏰", "🐉", "🌋", "🌌", "🛡️", "👑"];
  return level.topics.map((topic, i) => {
    const grammar = level.grammar[i % Math.max(1, level.grammar.length)];
    const base = `${lang}.${level.code}.ai${i}`;
    return {
      id: base,
      title: topic,
      icon: icons[i % icons.length],
      description: `موضوع: ${topic} — قاعدة: ${grammar ?? "مراجعة"}`,
      lessons: [
        { id: `${base}.l1`, title: "مفردات الموضوع", kind: "ai", items: [], aiTopic: topic, aiGrammar: grammar },
        { id: `${base}.l2`, title: "القاعدة في سياقها", kind: "ai", items: [], aiTopic: topic, aiGrammar: grammar },
        { id: `${base}.l3`, title: "حوار تطبيقي", kind: "ai", items: [], aiTopic: `${topic} (حوار)`, aiGrammar: grammar },
        { id: `${base}.boss`, title: "معركة الزعيم", kind: "boss", items: [], aiTopic: topic, aiGrammar: grammar },
      ],
    } satisfies Unit;
  });
}
