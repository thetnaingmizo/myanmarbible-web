// Pure text helpers for the 3.0 reader — a port of the app's
// lib/features/bible/presentation/reader/reader_text.dart (keep in sync).

const MYANMAR_DIGITS = "၀၁၂၃၄၅၆၇၈၉";

export function toMyanmarDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => MYANMAR_DIGITS[Number(d)]);
}

export function toAsciiDigits(s: string): string {
  return s.replace(/[၀-၉]/g, (d) => String(MYANMAR_DIGITS.indexOf(d)));
}

/** Digits for a Bible's language: Myanmar numerals for Burmese Bibles. */
export function num(n: number | string, burmese: boolean): string {
  return burmese ? toMyanmarDigits(n) : String(n);
}

/**
 * Display text for a verse. Drops the KJV paragraph mark (¶) everywhere and,
 * in paragraph mode, the Burmese continuation dash (၊- ။-) that says "this
 * sentence continues into the next verse".
 */
export function cleanVerseText(raw: string, paragraphMode: boolean): string {
  let t = raw.trim();
  if (t.startsWith("¶")) t = t.slice(1).trimStart();
  if (paragraphMode && t.endsWith("-")) t = t.slice(0, -1).trimEnd();
  return t;
}

/**
 * Verse number label. Merged verses (6 then 8) and joined verses (see
 * foldJoinedVerses) show as a range so nothing looks missing.
 */
export function verseLabel(
  number: number,
  opts: { nextNumber?: number; through?: number; burmese: boolean }
): string {
  const { nextNumber, through, burmese } = opts;
  const end = through ?? (nextNumber != null && nextNumber > number + 1 ? nextNumber - 1 : number);
  return num(end > number ? `${number}–${end}` : `${number}`, burmese);
}

/**
 * Some translations join verses: Judson's John 3:35 holds the text of 35–36,
 * and 3:36 is stored with empty text. Returns the verses to show and, for
 * each shown verse that absorbs empty ones, the last verse number it covers.
 */
export function foldJoinedVerses<T>(
  verses: T[],
  text: (v: T) => string,
  number: (v: T) => number
): { shown: T[]; through: Map<number, number> } {
  const through = new Map<number, number>();
  if (!verses.some((v) => !text(v).trim())) return { shown: verses, through };
  const shown: T[] = [];
  for (const v of verses) {
    if (!text(v).trim() && shown.length) through.set(number(shown[shown.length - 1]), number(v));
    else shown.push(v);
  }
  return { shown, through };
}

/**
 * Groups verse indexes into paragraphs using the translation's own markers:
 * trailing "-" (Burmese: sentence continues) or leading "¶" (KJV: new
 * paragraph). Otherwise breaks after a sentence end once a paragraph has
 * `minVerses`. Never more than `maxVerses` per paragraph.
 */
export function groupParagraphs(
  rawTexts: string[],
  paragraphMode: boolean,
  minVerses = 3,
  maxVerses = 8
): number[][] {
  const n = rawTexts.length;
  if (!paragraphMode) return rawTexts.map((_, i) => [i]);
  if (n === 0) return [];
  const dashCount = rawTexts.filter((t) => t.trimEnd().endsWith("-")).length;
  const useDash = dashCount >= n * 0.2;
  const usePilcrow = !useDash && rawTexts.some((t) => t.trimStart().startsWith("¶"));
  const sentenceEnd = /[.။?!”"’)]\s*$/;

  const groups: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i < n; i++) {
    if (usePilcrow && current.length && rawTexts[i].trimStart().startsWith("¶")) {
      groups.push(current);
      current = [];
    }
    current.push(i);
    const t = rawTexts[i].trimEnd();
    const breakAfter = useDash
      ? !t.endsWith("-")
      : usePilcrow
        ? false
        : current.length >= minVerses && sentenceEnd.test(t);
    if (breakAfter || current.length >= maxVerses) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

/** "3–5", "3, 5, 7–8" — Myanmar digits when burmese. */
export function formatVerseRanges(verses: number[], burmese: boolean): string {
  if (!verses.length) return "";
  const sorted = [...verses].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = start;
  for (const v of sorted.slice(1)) {
    if (v === prev + 1) {
      prev = v;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = v;
  }
  parts.push(start === prev ? `${start}` : `${start}–${prev}`);
  return num(parts.join(", "), burmese);
}

/** Burmese book name without the "ရှင်" (saint) prefix or "ကျမ်း" (book) suffix. */
export function shortBurmeseBookName(name: string): string {
  let n = name.replace(/​/g, "");
  if (n.startsWith("ရှင်") && n.length > "ရှင်".length + 2) n = n.slice("ရှင်".length);
  if (n.endsWith("ကျမ်း") && n.length > "ကျမ်း".length + 2) n = n.slice(0, -"ကျမ်း".length);
  return n;
}
