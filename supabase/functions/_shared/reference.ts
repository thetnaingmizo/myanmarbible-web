// Typed Bible references in Burmese or English ("ယော ၃:၁၆", "John 3:16",
// "jn3.16", "1 cor 13"). Port of the app's ReferenceParser (Dart) so the
// app and the server agree on what counts as a reference.

export interface BookRef {
  number: number;
  chapterCount: number;
  names: string[];
}

export interface ParsedReference {
  book: BookRef;
  chapter: number;
  verse: number | null;
}

const MY_DIGITS = "၀၁၂၃၄၅၆၇၈၉";
export const toAsciiDigits = (s: string) => s.replace(/[၀-၉]/g, (d) => String(MY_DIGITS.indexOf(d)));
export const key = (s: string) => toAsciiDigits(s).toLowerCase().replace(/[\s.​‌‍]/g, "");

const BURMESE_ALIASES: Record<number, string[]> = {
  40: ["မဿဲ"],
  41: ["မာကု", "မာ"],
  42: ["လုကာ", "လု"],
  43: ["ယော", "ယောဟန်"],
  44: ["တမန်", "တမန်တော်"],
};

const ENGLISH_ALIASES: Record<number, string[]> = {
  1: ["gen", "ge", "gn"], 2: ["exod", "exo", "ex"], 3: ["lev", "lv"], 4: ["num", "nm"], 5: ["deut", "dt"],
  6: ["josh", "jos"], 7: ["judg", "jdg"], 8: ["ruth", "ru"], 9: ["1sam", "1sa"], 10: ["2sam", "2sa"],
  11: ["1kgs", "1ki", "1kings"], 12: ["2kgs", "2ki", "2kings"], 13: ["1chr", "1ch"], 14: ["2chr", "2ch"],
  15: ["ezra", "ezr"], 16: ["neh"], 17: ["esth", "est"], 18: ["job", "jb"], 19: ["ps", "psa", "psalm", "pss"],
  20: ["prov", "pr", "prv"], 21: ["eccl", "ecc", "qoh"], 22: ["song", "sos", "songofsongs", "cant"],
  23: ["isa", "is"], 24: ["jer"], 25: ["lam"], 26: ["ezek", "eze", "ezk"], 27: ["dan", "dn"], 28: ["hos"],
  29: ["joel", "jl"], 30: ["amos", "am"], 31: ["obad", "ob"], 32: ["jonah", "jon"], 33: ["mic"], 34: ["nah"],
  35: ["hab"], 36: ["zeph", "zep"], 37: ["hag"], 38: ["zech", "zec"], 39: ["mal"],
  40: ["matt", "mt", "mat"], 41: ["mark", "mk", "mrk"], 42: ["luke", "lk", "luk"], 43: ["john", "jn", "jhn"],
  44: ["acts", "ac"], 45: ["rom", "rm"], 46: ["1cor", "1co"], 47: ["2cor", "2co"], 48: ["gal"], 49: ["eph"],
  50: ["phil", "php"], 51: ["col"], 52: ["1thess", "1th"], 53: ["2thess", "2th"], 54: ["1tim", "1ti"],
  55: ["2tim", "2ti"], 56: ["titus", "tit"], 57: ["phlm", "philem", "phm"], 58: ["heb"], 59: ["jas", "jm"],
  60: ["1pet", "1pe", "1pt"], 61: ["2pet", "2pe", "2pt"], 62: ["1john", "1jn"], 63: ["2john", "2jn"],
  64: ["3john", "3jn"], 65: ["jude", "jud"], 66: ["rev", "re", "rv", "revelation"],
};

function* variants(name: string): Generator<string> {
  const n = name.replace(/​/g, "").trim();
  yield n;
  if (n.endsWith("ကျမ်း")) yield n.slice(0, -"ကျမ်း".length);
  if (n.startsWith("ရှင်")) yield n.slice("ရှင်".length);
}

export class ReferenceParser {
  private exact = new Map<string, BookRef>();
  private all: [string, BookRef][] = [];

  constructor(books: BookRef[]) {
    for (const b of books) {
      const aliases = new Set<string>();
      for (const n of b.names) for (const v of variants(n)) aliases.add(v);
      for (const a of ENGLISH_ALIASES[b.number] ?? []) aliases.add(a);
      for (const a of BURMESE_ALIASES[b.number] ?? []) aliases.add(a);
      for (const a of aliases) {
        const k = key(a);
        if (!k) continue;
        if (!this.exact.has(k)) this.exact.set(k, b);
        this.all.push([k, b]);
      }
    }
  }

  suggest(partial: string): BookRef[] {
    const k = key(partial);
    if (!k) return [];
    const seen = new Set<number>();
    const out: BookRef[] = [];
    for (const [alias, b] of this.all) {
      if (alias.startsWith(k) && !seen.has(b.number)) {
        seen.add(b.number);
        out.push(b);
      }
    }
    return out.sort((a, b) => a.number - b.number);
  }

  resolveBook(name: string): BookRef | null {
    const k = key(name);
    if (!k) return null;
    const exact = this.exact.get(k);
    if (exact) return exact;
    const m = this.suggest(name);
    return m.length === 1 ? m[0] : null;
  }

  /** A full reference, or null. A bare book name is not a reference here
   *  (on the server "Ruth" is more likely a question than a jump). */
  parse(input: string): ParsedReference | null {
    const text = toAsciiDigits(input.trim());
    const m = /^(.+?)\s*(\d+)(?:\s*[:：.]\s*(\d+))?\s*$/.exec(text);
    if (!m) return null;
    const book = this.resolveBook(m[1]);
    if (!book) return null;
    const chapter = Number(m[2]);
    const verse = m[3] ? Number(m[3]) : null;
    if (chapter < 1 || chapter > book.chapterCount || (verse !== null && verse < 1)) return null;
    return { book, chapter, verse };
  }
}
