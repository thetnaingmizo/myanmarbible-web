// "Why do they differ?" — the model names a phrase in each translation for
// every difference. The app underlines those phrases in the real verse text,
// so each one must be an exact piece of that text; anything else is dropped.

export type Difference = { phrases: Record<string, string>; note: string };

/** Zero-width spaces split Burmese syllables in the source; they are not part of the words. */
export const stripZwsp = (s: string) => s.replace(/​/g, "");

/**
 * [phrase] as it is written in [text], ignoring spaces and zero-width spaces
 * (some Burmese sources break words with stray spaces; the model drops them)
 * and, failing that, case. Null when it isn't there.
 */
export function locate(text: string, phrase: string): string | null {
  const skip = (c: string) => /[\s\u200B]/.test(c);
  const chars = [...text]; // code points, so indexes line up
  const kept = chars.map((c, i) => [c, i] as const).filter(([c]) => !skip(c));
  const target = [...phrase].filter((c) => !skip(c));
  if (target.length === 0) return null;
  for (const fold of [(c: string) => c, (c: string) => c.toLowerCase()]) {
    const hay = kept.map(([c]) => fold(c));
    const needle = target.map(fold);
    for (let i = 0; i + needle.length <= hay.length; i++) {
      if (needle.every((c, j) => hay[i + j] === c)) {
        return chars.slice(kept[i][1], kept[i + needle.length - 1][1] + 1).join("");
      }
    }
  }
  return null;
}

/**
 * Keeps phrases that occur in their translation's text (see [locate]), and
 * differences that still name at least two translations. At most [max].
 */
export function validDifferences(raw: unknown, texts: Record<string, string>, max = 3): Difference[] {
  if (!Array.isArray(raw)) return [];
  const out: Difference[] = [];
  for (const d of raw) {
    const note = typeof d?.note === "string" ? d.note.trim() : "";
    if (!note) continue;
    const phrases: Record<string, string> = {};
    const given = Array.isArray(d?.phrases) ? d.phrases : [];
    for (const p of given) {
      const code = typeof p?.code === "string" ? p.code.toLowerCase() : "";
      const phrase = typeof p?.phrase === "string" ? stripZwsp(p.phrase).trim() : "";
      const text = texts[code];
      if (!text || !phrase || phrases[code]) continue;
      const found = locate(text, phrase);
      if (found) phrases[code] = found;
    }
    if (Object.keys(phrases).length >= 2) out.push({ phrases, note });
    if (out.length >= max) break;
  }
  return out;
}
