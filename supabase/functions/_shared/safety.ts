// Crisis routing: someone who may be in danger gets a fixed, caring answer
// with where to get help — never a generated one, and it costs no quota.

const CRISIS: RegExp[] = [
  // English
  /\b(kill|killing|hurt|harm|cut)\s+(myself|me)\b/i,
  /\bsuicid(e|al)\b/i,
  /\b(end|take)\s+(my|his|her)\s+(own\s+)?life\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive)\b/i,
  /\bbetter\s+off\s+dead\b/i,
  // Burmese (zero-width spaces are removed before matching)
  /သေချင်/,
  /ကိုယ့်ကိုယ်ကို\s*(သတ်|အဆုံးစီရင်|နာကျင်)/,
  /မိမိကိုယ်ကို\s*(သတ်|အဆုံးစီရင်)/,
  /အသက်\s*(မ)?ရှင်ချင်တော့ဘူး/,
  /မရှင်ချင်တော့/,
  /အဆုံးစီရင်/,
];

export function isCrisis(message: string): boolean {
  const text = message.replace(/​/g, "");
  return CRISIS.some((r) => r.test(text));
}

/** Placeholder until the founder confirms real Myanmar helplines (open question in the build plan). */
export const HELPLINE = "[VERIFIED MYANMAR HELPLINE — to be confirmed]";

export function crisisMessage(lang: "my" | "en"): string {
  return lang === "my"
    ? "သင် ယခု အလွန်ခက်ခဲနေပုံရပါတယ်။ သင်တစ်ယောက်တည်း မဟုတ်ပါ။ ချက်ချင်း အန္တရာယ်ရှိပါက အနီးဆုံး ဆေးရုံ သို့မဟုတ် " +
        `အရေးပေါ်ဌာနကို ဆက်သွယ်ပါ။ စကားပြောရန် — ${HELPLINE}။ ယုံကြည်ရသော မိတ်ဆွေ၊ မိသားစု သို့မဟုတ် သင်းအုပ်ဆရာကိုလည်း ယခုပဲ ပြောပြပါ။`
    : "It sounds like you are going through something very hard. You are not alone. If you are in danger right now, " +
        `contact the nearest hospital or emergency service. To talk to someone: ${HELPLINE}. Please also tell someone you ` +
        "trust — a friend, family member or pastor — today.";
}
