/** سيناريوهات المحادثة الصوتية — كل سيناريو لعب أدوار مع شخصية */
export interface Scenario {
  id: string;
  title: string;
  icon: string;
  minLevel: "A1" | "A2" | "B1" | "B2" | "C1";
  role: string; // دور الذكاء الاصطناعي
  goal: string; // مهمة المتعلم بالعربية
}

export const SCENARIOS: Scenario[] = [
  { id: "free", title: "محادثة حرة مع المعلم", icon: "🧙", minLevel: "A1", role: "a patient, encouraging language tutor", goal: "تحدّث في أي موضوع، وسيصحح لك المعلم بلطف" },
  { id: "intro", title: "التعارف الأول", icon: "🤝", minLevel: "A1", role: "a friendly student you just met at a university event", goal: "عرّف بنفسك: اسمك، بلدك، ودراستك، واسأل عن الطرف الآخر" },
  { id: "cafe", title: "في المقهى", icon: "☕", minLevel: "A1", role: "a barista at a busy café", goal: "اطلب مشروباً وشيئاً للأكل، واسأل عن السعر وادفع" },
  { id: "directions", title: "تائه في المدينة", icon: "🧭", minLevel: "A1", role: "a local passer-by", goal: "اسأل عن طريق الفندق وتأكد أنك فهمت الاتجاهات" },
  { id: "hotel", title: "حجز في الفندق", icon: "🏨", minLevel: "A2", role: "a hotel receptionist", goal: "احجز غرفة لثلاث ليالٍ واسأل عن الإفطار والإنترنت" },
  { id: "doctor", title: "عند الطبيب", icon: "🩺", minLevel: "A2", role: "a doctor at a clinic", goal: "صف أعراضك وافهم تعليمات الدواء" },
  { id: "market", title: "المساومة في السوق", icon: "🛍️", minLevel: "A2", role: "a market seller who loves to bargain", goal: "اشترِ هدية وفاوض على السعر" },
  { id: "airport", title: "في المطار", icon: "✈️", minLevel: "A2", role: "an airline check-in agent", goal: "أنهِ إجراءات السفر واسأل عن البوابة والأمتعة" },
  { id: "interview", title: "مقابلة عمل", icon: "💼", minLevel: "B1", role: "a hiring manager at a law firm", goal: "أجب عن أسئلة المقابلة وتحدث عن مهاراتك وطموحك" },
  { id: "debate", title: "مناظرة", icon: "⚖️", minLevel: "B2", role: "a sharp debate opponent who argues the opposite view", goal: "دافع عن رأيك في قضية معاصرة وفنّد حجج خصمك" },
  { id: "court", title: "قاعة المحكمة", icon: "🏛️", minLevel: "B2", role: "a judge presiding over a civil case hearing", goal: "قدّم دفوعك بصفتك محامي المدعى عليه وأجب عن أسئلة القاضي" },
  { id: "lecture", title: "نقاش أكاديمي", icon: "🎓", minLevel: "C1", role: "a university professor of comparative law", goal: "ناقش الأستاذ في مسألة قانونية مقارنة بلغة أكاديمية" },
];
