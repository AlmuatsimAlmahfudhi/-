export type LangCode = "en" | "fr" | "es" | "zh";

export type ItemType = "letter" | "sound" | "tone" | "syllable" | "word" | "phrase" | "hanzi";

/** أصغر وحدة تعليمية: حرف، صوت، نغمة، كلمة، أو جملة */
export interface Item {
  id: string;
  type: ItemType;
  /** النص بلغة الهدف (في الصينية تُفصل الكلمات بمسافة لتمرين بناء الجمل وتُحذف عند العرض) */
  text: string;
  /** المعنى أو الشرح بالعربية */
  ar: string;
  /** النطق: تقريب بحروف عربية للغات الأوروبية، والبينيين للصينية */
  reading?: string;
  /** ما يُرسَل لمحرك النطق إن اختلف عن النص (مثلاً حرف صيني يمثّل مقطع بينيين) */
  say?: string;
  /** ملاحظة تعليمية قصيرة بالعربية */
  note?: string;
  /** للنغمات الصينية: رقم النغمة 1..5 */
  tone?: number;
}

export interface GrammarNote {
  title: string;
  /** شرح بالعربية، كل عنصر فقرة */
  body: string[];
  examples?: { text: string; ar: string }[];
  /** مقارنة بالعربية تقرّب الفكرة للمتعلم العربي */
  arabicBridge?: string;
}

export type LessonKind = "script" | "tones" | "vocab" | "phrases" | "boss" | "ai";

export interface Lesson {
  id: string;
  title: string;
  kind: LessonKind;
  /** معرّفات العناصر المستعملة في الدرس */
  items: string[];
  grammar?: GrammarNote;
  /** لدروس الذكاء الاصطناعي: موضوع الدرس ونقطته النحوية */
  aiTopic?: string;
  aiGrammar?: string;
}

export interface Unit {
  id: string;
  title: string;
  icon: string;
  description: string;
  lessons: Lesson[];
}

export interface LevelDef {
  code: string; // A1..C2 / HSK1..HSK9 / FOUNDATION
  title: string;
  /** اسم المنطقة في خريطة المغامرة */
  region: string;
  description: string;
  canDo: string[];
  topics: string[];
  grammar: string[];
  /** الوحدات المكتوبة مسبقاً؛ إن كانت فارغة تُبنى وحدات من المواضيع ويولّدها الذكاء الاصطناعي */
  units: Unit[];
  /** عدد المفردات التقريبي المستهدف في هذا المستوى */
  targetVocab?: number;
}

export interface Course {
  lang: LangCode;
  name: string;
  nativeName: string;
  flag: string;
  framework: "CEFR" | "HSK";
  /** رمز اللغة لمحرك النطق والتعرف على الكلام */
  bcp47: string;
  /** لون السمة */
  color: string;
  /** المرحلة التأسيسية: الحروف والأصوات أو البينيين والنغمات */
  foundation: LevelDef;
  levels: LevelDef[];
  items: Record<string, Item>;
}
