/**
 * Bible seed configuration
 *
 * Defines the translations to download from eBible.org and the
 * canonical book metadata (names, abbreviations, chapter counts).
 */

// ---------------------------------------------------------------------------
// Translation sources
// ---------------------------------------------------------------------------

export interface TranslationSource {
  /** Short code stored in DB (translations.code) */
  code: string;
  /** eBible.org translation id used in download URLs ("" for local sources) */
  ebibleId: string;
  /**
   * Local SQLite source instead of an eBible download. `file` is relative to
   * scripts/seed-bible/; `table` must have columns
   * (id, type, book, chapter, verse, text) — see parse-local-sqlite.ts.
   */
  localSqlite?: { file: string; table: string; mergedVerseMarkers?: boolean };
  /** English display name */
  nameEn: string;
  /** Myanmar display name */
  nameMy: string | null;
  /** ISO language: 'my' for Myanmar, 'en' for English */
  language: string;
  /** Whether this is the default translation */
  isDefault: boolean;
  /** License text */
  licenseInfo: string;
  /** Source URL shown to users */
  sourceUrl: string;
}

export const TRANSLATIONS: TranslationSource[] = [
  {
    // Adoniram Judson's Burmese Bible (1840), public domain — the exact text
    // Myanmar Bible v2.1 bundled (assets/my-judson.yes, exported 2026-09-27 to
    // sources/judson-1840.db), so upgrading readers keep the words they know.
    // (Until 2026-09-27 this code wrongly seeded eBible `mya`, the Common
    // Language Bible 2005 — © Bible Society of Myanmar inside Myanmar.)
    code: "judson",
    ebibleId: "",
    localSqlite: { file: "sources/judson-1840.db", table: "judson", mergedVerseMarkers: true },
    nameEn: "Judson Bible (1840)",
    nameMy: "ယုဒသန် မြန်မာကျမ်းစာ",
    language: "my",
    isDefault: true,
    licenseInfo: "Public Domain (Adoniram Judson, 1840)",
    sourceUrl: "https://ebible.org/find/details.php?id=myajvb",
  },
  {
    code: "kjv",
    ebibleId: "eng-kjv2006",
    nameEn: "King James Version",
    nameMy: null,
    language: "en",
    isDefault: false,
    licenseInfo: "Public Domain",
    sourceUrl: "https://ebible.org/find/details.php?id=eng-kjv2006",
  },
  {
    code: "mizo",
    ebibleId: "",
    localSqlite: { file: "sources/mizogobible.db", table: "mizogobible" },
    nameEn: "Mizo Bible",
    nameMy: null,
    language: "lus",
    isDefault: false,
    licenseInfo: "Source provided by the app owner",
    sourceUrl: "",
  },
];

// ---------------------------------------------------------------------------
// Download URLs (USFX XML format from eBible.org)
// ---------------------------------------------------------------------------

/**
 * Returns the USFX zip download URL for a given eBible translation id.
 *
 * Pattern: https://eBible.org/Scriptures/{ebibleId}_usfx.zip
 * Inside the zip is a single XML file: {ebibleId}_usfx.xml
 */
export function getUsfxDownloadUrl(ebibleId: string): string {
  return `https://eBible.org/Scriptures/${ebibleId}_usfx.zip`;
}

/**
 * The XML filename found inside the USFX zip archive.
 */
export function getUsfxFilename(ebibleId: string): string {
  return `${ebibleId}_usfx.xml`;
}

// ---------------------------------------------------------------------------
// Canonical book metadata (66 books, Protestant canon)
// ---------------------------------------------------------------------------

export interface BookMeta {
  /** 1-based book number */
  bookNumber: number;
  /** USFX 3-letter book id (e.g. "GEN", "MAT") */
  usfxId: string;
  /** English name */
  nameEn: string;
  /** Myanmar name */
  nameMy: string;
  /** English abbreviation */
  abbreviationEn: string;
  /** Myanmar abbreviation */
  abbreviationMy: string;
  /** OT or NT */
  testament: "OT" | "NT";
  /** Total chapters in this book */
  chapterCount: number;
}

/**
 * All 66 canonical books with their USFX ids, names (EN & MY), and chapter counts.
 */
export const BOOKS: BookMeta[] = [
  // ---- OLD TESTAMENT ----
  { bookNumber: 1,  usfxId: "GEN", nameEn: "Genesis",         nameMy: "ကမ္ဘာ\u200Bဦး\u200Bကျမ်း",                          abbreviationEn: "Gen", abbreviationMy: "ကမ္ဘာ\u200Bဦး",                  testament: "OT", chapterCount: 50 },
  { bookNumber: 2,  usfxId: "EXO", nameEn: "Exodus",          nameMy: "ထွက်\u200Bမြောက်\u200Bရာ\u200Bကျမ်း",               abbreviationEn: "Exo", abbreviationMy: "ထွက်\u200Bမြောက်",               testament: "OT", chapterCount: 40 },
  { bookNumber: 3,  usfxId: "LEV", nameEn: "Leviticus",       nameMy: "ဝတ်\u200Bပြု\u200Bရာ\u200Bကျမ်း",                   abbreviationEn: "Lev", abbreviationMy: "ဝတ်\u200Bပြု",                   testament: "OT", chapterCount: 27 },
  { bookNumber: 4,  usfxId: "NUM", nameEn: "Numbers",         nameMy: "တော\u200Bလည်\u200Bရာ\u200Bကျမ်း",                   abbreviationEn: "Num", abbreviationMy: "တော\u200Bလည်",                   testament: "OT", chapterCount: 36 },
  { bookNumber: 5,  usfxId: "DEU", nameEn: "Deuteronomy",     nameMy: "တ\u200Bရား\u200Bဟော\u200Bရာ\u200Bကျမ်း",            abbreviationEn: "Deu", abbreviationMy: "တ\u200Bရား\u200Bဟော",            testament: "OT", chapterCount: 34 },
  { bookNumber: 6,  usfxId: "JOS", nameEn: "Joshua",          nameMy: "ယော\u200Bရှု\u200Bမှတ်\u200Bစာ",                     abbreviationEn: "Jos", abbreviationMy: "ယော\u200Bရှု",                   testament: "OT", chapterCount: 24 },
  { bookNumber: 7,  usfxId: "JDG", nameEn: "Judges",          nameMy: "တ\u200Bရား\u200Bသူ\u200Bကြီး\u200Bမှတ်\u200Bစာ",    abbreviationEn: "Jdg", abbreviationMy: "သူ\u200Bကြီး",                   testament: "OT", chapterCount: 21 },
  { bookNumber: 8,  usfxId: "RUT", nameEn: "Ruth",            nameMy: "ရု\u200Bသ\u200Bဝတ္ထု",                                abbreviationEn: "Rut", abbreviationMy: "ရု\u200Bသ",                      testament: "OT", chapterCount: 4 },
  { bookNumber: 9,  usfxId: "1SA", nameEn: "1 Samuel",        nameMy: "ဓမ္မ\u200Bရာ\u200Bဇ\u200Bဝင်\u200Bပ\u200Bထ\u200Bမ\u200Bစောင်", abbreviationEn: "1Sa", abbreviationMy: "၁ ရာ", testament: "OT", chapterCount: 31 },
  { bookNumber: 10, usfxId: "2SA", nameEn: "2 Samuel",        nameMy: "ဓမ္မ\u200Bရာ\u200Bဇ\u200Bဝင်\u200Bဒု\u200Bတိ\u200Bယ\u200Bစောင်", abbreviationEn: "2Sa", abbreviationMy: "၂ ရာ", testament: "OT", chapterCount: 24 },
  { bookNumber: 11, usfxId: "1KI", nameEn: "1 Kings",         nameMy: "ဓမ္မ\u200Bရာ\u200Bဇဝင်\u200Bတ\u200Bတိ\u200Bယ\u200Bစောင်", abbreviationEn: "1Ki", abbreviationMy: "၃ ရာ", testament: "OT", chapterCount: 22 },
  { bookNumber: 12, usfxId: "2KI", nameEn: "2 Kings",         nameMy: "ဓမ္မ\u200Bရာ\u200Bဇ\u200Bဝင်\u200Bစ\u200Bတုတ္ထ\u200Bစောင်", abbreviationEn: "2Ki", abbreviationMy: "၄ ရာ", testament: "OT", chapterCount: 25 },
  { bookNumber: 13, usfxId: "1CH", nameEn: "1 Chronicles",    nameMy: "ရာ\u200Bဇ\u200Bဝင်\u200Bချုပ်\u200Bပ\u200Bထ\u200Bမ\u200Bစောင်", abbreviationEn: "1Ch", abbreviationMy: "၁ ရာ\u200Bချုပ်", testament: "OT", chapterCount: 29 },
  { bookNumber: 14, usfxId: "2CH", nameEn: "2 Chronicles",    nameMy: "ရာ\u200Bဇ\u200Bဝင်\u200Bချုပ်\u200Bဒု\u200Bတိ\u200Bယ\u200Bစောင်", abbreviationEn: "2Ch", abbreviationMy: "၂ ရာ\u200Bချုပ်", testament: "OT", chapterCount: 36 },
  { bookNumber: 15, usfxId: "EZR", nameEn: "Ezra",            nameMy: "ဧ\u200Bဇ\u200Bရ\u200Bမှတ်\u200Bစာ",                 abbreviationEn: "Ezr", abbreviationMy: "ဧ\u200Bဇ\u200Bရ",               testament: "OT", chapterCount: 10 },
  { bookNumber: 16, usfxId: "NEH", nameEn: "Nehemiah",        nameMy: "နေ\u200Bဟ\u200Bမိ\u200Bမှတ်\u200Bစာ",               abbreviationEn: "Neh", abbreviationMy: "နေ\u200Bဟ\u200Bမိ",             testament: "OT", chapterCount: 13 },
  { bookNumber: 17, usfxId: "EST", nameEn: "Esther",          nameMy: "ဧ\u200Bသ\u200Bတာ\u200Bဝတ္ထု",                        abbreviationEn: "Est", abbreviationMy: "ဧ\u200Bသ\u200Bတာ",              testament: "OT", chapterCount: 10 },
  { bookNumber: 18, usfxId: "JOB", nameEn: "Job",             nameMy: "ယောဘဝတ္တု",                                           abbreviationEn: "Job", abbreviationMy: "ယောဘဝတ္တု",                     testament: "OT", chapterCount: 42 },
  { bookNumber: 19, usfxId: "PSA", nameEn: "Psalms",          nameMy: "ဆာ\u200Bလံ\u200Bကျမ်း",                               abbreviationEn: "Psa", abbreviationMy: "ဆာ\u200Bလံ",                    testament: "OT", chapterCount: 150 },
  { bookNumber: 20, usfxId: "PRO", nameEn: "Proverbs",        nameMy: "သုတ္တံကျမ်း",                                          abbreviationEn: "Pro", abbreviationMy: "သုတ္တံကျမ်း",                    testament: "OT", chapterCount: 31 },
  { bookNumber: 21, usfxId: "ECC", nameEn: "Ecclesiastes",    nameMy: "ဒေသနာကျမ်း",                                          abbreviationEn: "Ecc", abbreviationMy: "ဒေသနာကျမ်း",                    testament: "OT", chapterCount: 12 },
  { bookNumber: 22, usfxId: "SNG", nameEn: "Song of Solomon", nameMy: "ရှောလမုန်သီချင်း",                                     abbreviationEn: "Sng", abbreviationMy: "ရှောလမုန်သီချင်း",               testament: "OT", chapterCount: 8 },
  { bookNumber: 23, usfxId: "ISA", nameEn: "Isaiah",          nameMy: "ဟေ\u200Bရှာ\u200Bယ\u200Bအ\u200Bနာ\u200Bဂတ္တိ\u200Bကျမ်း", abbreviationEn: "Isa", abbreviationMy: "ဟေ\u200Bရှာ\u200Bယ", testament: "OT", chapterCount: 66 },
  { bookNumber: 24, usfxId: "JER", nameEn: "Jeremiah",        nameMy: "ယေ\u200Bရ\u200Bမိ\u200Bအ\u200Bနာ\u200Bဂတ္တိ\u200Bကျမ်း", abbreviationEn: "Jer", abbreviationMy: "ယေ\u200Bရ\u200Bမိ", testament: "OT", chapterCount: 52 },
  { bookNumber: 25, usfxId: "LAM", nameEn: "Lamentations",    nameMy: "ယေ\u200Bရ\u200Bမိ\u200Bမြည်\u200Bတမ်း\u200Bစ\u200Bကား", abbreviationEn: "Lam", abbreviationMy: "မြည်\u200Bတမ်း\u200Bစ\u200Bကား", testament: "OT", chapterCount: 5 },
  { bookNumber: 26, usfxId: "EZK", nameEn: "Ezekiel",         nameMy: "ယေ\u200Bဇ\u200Bကျေ\u200Bလ\u200Bအ\u200Bနာ\u200Bဂတ္တိ\u200Bကျမ်း", abbreviationEn: "Ezk", abbreviationMy: "ယေ\u200Bဇ\u200Bကျေ\u200Bလ", testament: "OT", chapterCount: 48 },
  { bookNumber: 27, usfxId: "DAN", nameEn: "Daniel",          nameMy: "ဒံ\u200Bယေ\u200Bလ\u200Bအ\u200Bနာ\u200Bဂတ္တိ\u200Bကျမ်း", abbreviationEn: "Dan", abbreviationMy: "ဒံ\u200Bယေ\u200Bလ", testament: "OT", chapterCount: 12 },
  { bookNumber: 28, usfxId: "HOS", nameEn: "Hosea",           nameMy: "ဟော\u200Bရှေ\u200Bအ\u200Bနာ\u200Bဂတ္တိ\u200Bကျမ်း", abbreviationEn: "Hos", abbreviationMy: "ဟော\u200Bရှေ",                testament: "OT", chapterCount: 14 },
  { bookNumber: 29, usfxId: "JOL", nameEn: "Joel",            nameMy: "ယော\u200Bလ\u200Bအ\u200Bနာ\u200Bဂတ္တိ\u200Bကျမ်း",   abbreviationEn: "Jol", abbreviationMy: "ယော\u200Bလ",                    testament: "OT", chapterCount: 3 },
  { bookNumber: 30, usfxId: "AMO", nameEn: "Amos",            nameMy: "အာ\u200Bမုတ်\u200Bအ\u200Bနာ\u200Bဂတ္တိ\u200Bကျမ်း", abbreviationEn: "Amo", abbreviationMy: "အာ\u200Bမုတ်",                 testament: "OT", chapterCount: 9 },
  { bookNumber: 31, usfxId: "OBA", nameEn: "Obadiah",         nameMy: "သြ\u200Bဗ\u200Bဒိ\u200Bဗျာ\u200Bဒိတ်\u200Bရူ\u200Bပါ\u200Bရုံ", abbreviationEn: "Oba", abbreviationMy: "သြ\u200Bဗ\u200Bဒိ", testament: "OT", chapterCount: 1 },
  { bookNumber: 32, usfxId: "JON", nameEn: "Jonah",           nameMy: "ယော\u200Bန\u200Bဝတ္ထု",                                abbreviationEn: "Jon", abbreviationMy: "ယော\u200Bန",                    testament: "OT", chapterCount: 4 },
  { bookNumber: 33, usfxId: "MIC", nameEn: "Micah",           nameMy: "မိက္ခာ\u200Bအ\u200Bနာ\u200Bဂတ္တိ\u200Bကျမ်း",        abbreviationEn: "Mic", abbreviationMy: "မိက္ခာ",                        testament: "OT", chapterCount: 7 },
  { bookNumber: 34, usfxId: "NAM", nameEn: "Nahum",           nameMy: "နာ\u200Bဟုံ\u200Bအ\u200Bနာ\u200Bဂတ္တိ\u200Bကျမ်း",   abbreviationEn: "Nam", abbreviationMy: "နာ\u200Bဟုံ",                   testament: "OT", chapterCount: 3 },
  { bookNumber: 35, usfxId: "HAB", nameEn: "Habakkuk",        nameMy: "ဟ\u200Bဗက္ကုတ်\u200Bအ\u200Bနာ\u200Bဂတ္တိ\u200Bကျမ်း", abbreviationEn: "Hab", abbreviationMy: "ဟ\u200Bဗက္ကုတ်",            testament: "OT", chapterCount: 3 },
  { bookNumber: 36, usfxId: "ZEP", nameEn: "Zephaniah",       nameMy: "ဇေဖနိအနာဂတ္တိကျမ်း",                                  abbreviationEn: "Zep", abbreviationMy: "ဇေဖနိ",                        testament: "OT", chapterCount: 3 },
  { bookNumber: 37, usfxId: "HAG", nameEn: "Haggai",          nameMy: "ဟ္ဂဲ\u200Bကျမ်း",                                     abbreviationEn: "Hag", abbreviationMy: "ဟ္ဂဲ",                          testament: "OT", chapterCount: 2 },
  { bookNumber: 38, usfxId: "ZEC", nameEn: "Zechariah",       nameMy: "ဇာ\u200Bခ\u200Bရိ\u200Bအ\u200Bနာ\u200Bဂတ္တိ\u200Bကျမ်း", abbreviationEn: "Zec", abbreviationMy: "ဇာ\u200Bခ\u200Bရိ", testament: "OT", chapterCount: 14 },
  { bookNumber: 39, usfxId: "MAL", nameEn: "Malachi",         nameMy: "မာ\u200Bလ\u200Bခိ\u200Bအနာ\u200Bဂတ္တိ\u200Bကျမ်း",   abbreviationEn: "Mal", abbreviationMy: "မာ\u200Bလ\u200Bခိ",            testament: "OT", chapterCount: 4 },

  // ---- NEW TESTAMENT ----
  { bookNumber: 40, usfxId: "MAT", nameEn: "Matthew",          nameMy: "ရှင်\u200Bမ\u200Bဿဲ",                                  abbreviationEn: "Mat", abbreviationMy: "မဿဲ",                          testament: "NT", chapterCount: 28 },
  { bookNumber: 41, usfxId: "MRK", nameEn: "Mark",             nameMy: "ရှင်မာကု",                                              abbreviationEn: "Mrk", abbreviationMy: "ရှင်မာကု",                     testament: "NT", chapterCount: 16 },
  { bookNumber: 42, usfxId: "LUK", nameEn: "Luke",             nameMy: "ရှင်\u200Bလု\u200Bကာ",                                  abbreviationEn: "Luk", abbreviationMy: "လုကာ",                         testament: "NT", chapterCount: 24 },
  { bookNumber: 43, usfxId: "JHN", nameEn: "John",             nameMy: "ရှင်ယောဟန်",                                             abbreviationEn: "Jhn", abbreviationMy: "ရှင်ယောဟန်",                   testament: "NT", chapterCount: 21 },
  { bookNumber: 44, usfxId: "ACT", nameEn: "Acts",             nameMy: "တမန်တော်ဝတ္ထု",                                          abbreviationEn: "Act", abbreviationMy: "တမန်တော်ဝတ္ထု",                testament: "NT", chapterCount: 28 },
  { bookNumber: 45, usfxId: "ROM", nameEn: "Romans",           nameMy: "ရော\u200Bမ",                                             abbreviationEn: "Rom", abbreviationMy: "ရော\u200Bမ",                   testament: "NT", chapterCount: 16 },
  { bookNumber: 46, usfxId: "1CO", nameEn: "1 Corinthians",    nameMy: "ကော\u200Bရိန္သု\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ ပ\u200Bထ\u200Bမ\u200Bစောင်", abbreviationEn: "1Co", abbreviationMy: "၁ ကော", testament: "NT", chapterCount: 16 },
  { bookNumber: 47, usfxId: "2CO", nameEn: "2 Corinthians",    nameMy: "ကော\u200Bရိန္သု\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ ဒု\u200Bတိ\u200Bယ\u200Bစောင်", abbreviationEn: "2Co", abbreviationMy: "၂ ကော", testament: "NT", chapterCount: 13 },
  { bookNumber: 48, usfxId: "GAL", nameEn: "Galatians",        nameMy: "ဂ\u200Bလာ\u200Bတိ\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ",   abbreviationEn: "Gal", abbreviationMy: "ဂ\u200Bလာ\u200Bတိ",           testament: "NT", chapterCount: 6 },
  { bookNumber: 49, usfxId: "EPH", nameEn: "Ephesians",        nameMy: "ဧ\u200Bဖက်\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ",           abbreviationEn: "Eph", abbreviationMy: "ဧ\u200Bဖက်",                  testament: "NT", chapterCount: 6 },
  { bookNumber: 50, usfxId: "PHP", nameEn: "Philippians",      nameMy: "ဖိ\u200Bလိပ္ပိ\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ",       abbreviationEn: "Php", abbreviationMy: "ဖိ\u200Bလိပ္ပိ",               testament: "NT", chapterCount: 4 },
  { bookNumber: 51, usfxId: "COL", nameEn: "Colossians",       nameMy: "ကော\u200Bလော\u200Bသဲ\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ", abbreviationEn: "Col", abbreviationMy: "ကော\u200Bလော\u200Bသဲ",       testament: "NT", chapterCount: 4 },
  { bookNumber: 52, usfxId: "1TH", nameEn: "1 Thessalonians",  nameMy: "သက်\u200Bသာ\u200Bလော\u200Bနိတ်\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ\u200Bပ\u200Bထ\u200Bမ\u200Bစောင်", abbreviationEn: "1Th", abbreviationMy: "၁ သက်", testament: "NT", chapterCount: 5 },
  { bookNumber: 53, usfxId: "2TH", nameEn: "2 Thessalonians",  nameMy: "သက်\u200Bသာ\u200Bလော\u200Bနိတ်\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ\u200Bဒု\u200Bတိ\u200Bယ\u200Bစောင်", abbreviationEn: "2Th", abbreviationMy: "၂ သက်", testament: "NT", chapterCount: 3 },
  { bookNumber: 54, usfxId: "1TI", nameEn: "1 Timothy",        nameMy: "တိ\u200Bမော\u200Bသေ\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ\u200Bပ\u200Bထ\u200Bမ\u200Bစောင်", abbreviationEn: "1Ti", abbreviationMy: "၁ တိ", testament: "NT", chapterCount: 6 },
  { bookNumber: 55, usfxId: "2TI", nameEn: "2 Timothy",        nameMy: "တိ\u200Bမော\u200Bသေ\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ\u200Bဒု\u200Bတိ\u200Bယ\u200Bစောင်", abbreviationEn: "2Ti", abbreviationMy: "၂ တိ", testament: "NT", chapterCount: 4 },
  { bookNumber: 56, usfxId: "TIT", nameEn: "Titus",            nameMy: "တိ\u200Bတု\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ",           abbreviationEn: "Tit", abbreviationMy: "တိ\u200Bတု",                   testament: "NT", chapterCount: 3 },
  { bookNumber: 57, usfxId: "PHM", nameEn: "Philemon",         nameMy: "ဖိ\u200Bလေ\u200Bမုန်\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ", abbreviationEn: "Phm", abbreviationMy: "ဖိ\u200Bလေ\u200Bမုန်",       testament: "NT", chapterCount: 1 },
  { bookNumber: 58, usfxId: "HEB", nameEn: "Hebrews",          nameMy: "ဟေ\u200Bဗြဲ\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ",          abbreviationEn: "Heb", abbreviationMy: "ဟေ\u200Bဗြဲ",                  testament: "NT", chapterCount: 13 },
  { bookNumber: 59, usfxId: "JAS", nameEn: "James",            nameMy: "ရှင်\u200Bယာ\u200Bကုပ်\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ", abbreviationEn: "Jas", abbreviationMy: "ယာ\u200Bကုပ်",              testament: "NT", chapterCount: 5 },
  { bookNumber: 60, usfxId: "1PE", nameEn: "1 Peter",          nameMy: "ရှင်\u200Bပေ\u200Bတ\u200Bရု\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ\u200Bပ\u200Bထ\u200Bမ\u200Bစောင်", abbreviationEn: "1Pe", abbreviationMy: "၁ ပေ", testament: "NT", chapterCount: 5 },
  { bookNumber: 61, usfxId: "2PE", nameEn: "2 Peter",          nameMy: "ရှင်\u200Bပေ\u200Bတ\u200Bရု\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ\u200Bဒု\u200Bတိ\u200Bယ\u200Bစောင်", abbreviationEn: "2Pe", abbreviationMy: "၂ ပေ", testament: "NT", chapterCount: 3 },
  { bookNumber: 62, usfxId: "1JN", nameEn: "1 John",           nameMy: "ရှင်\u200Bယော\u200Bဟန်\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ\u200Bပ\u200Bထ\u200Bမ\u200Bစောင်", abbreviationEn: "1Jn", abbreviationMy: "၁ ယော", testament: "NT", chapterCount: 5 },
  { bookNumber: 63, usfxId: "2JN", nameEn: "2 John",           nameMy: "ရှင်\u200Bယော\u200Bဟန်\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ\u200Bဒု\u200Bတိ\u200Bယ\u200Bစောင်", abbreviationEn: "2Jn", abbreviationMy: "၂ ယော", testament: "NT", chapterCount: 1 },
  { bookNumber: 64, usfxId: "3JN", nameEn: "3 John",           nameMy: "ရှင်\u200Bယော\u200Bဟန်\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ\u200Bတ\u200Bတိ\u200Bယ\u200Bစောင်", abbreviationEn: "3Jn", abbreviationMy: "၃ ယော", testament: "NT", chapterCount: 1 },
  { bookNumber: 65, usfxId: "JUD", nameEn: "Jude",             nameMy: "ရှင်\u200Bယု\u200Bဒ\u200Bသြ\u200Bဝါ\u200Bဒ\u200Bစာ",  abbreviationEn: "Jud", abbreviationMy: "ယု\u200Bဒ",                   testament: "NT", chapterCount: 1 },
  { bookNumber: 66, usfxId: "REV", nameEn: "Revelation",       nameMy: "ဗျာ\u200Bဒိတ်\u200Bကျမ်း",                              abbreviationEn: "Rev", abbreviationMy: "ဗျာ\u200Bဒိတ်",               testament: "NT", chapterCount: 22 },
];

/**
 * USFX book ids for non-canonical books (introductions, front matter, etc.)
 * that we skip during import.
 */
export const IGNORED_USFX_BOOK_IDS = new Set([
  "FRT", // Front matter
  "INT", // Introduction
  "BAK", // Back matter
  "OTH", // Other
  "XXA", "XXB", "XXC", "XXD", "XXE", "XXF", "XXG", // Extra matter
  "TOB", "JDT", "ESG", "WIS", "SIR", "BAR", "LJE", // Deuterocanonical
  "S3Y", "SUS", "BEL", "MA1", "MA2", "MA3", "MA4", // Deuterocanonical
  "PS2", "ODA", "PSS", "EZA", "JUB", "ENO",         // Pseudepigrapha
  "DAG", "PS3", "MAN", "LBA", "LBJ", "WSD",         // Other non-canonical
]);

/**
 * Lookup a book by its USFX id. Returns undefined for non-canonical books.
 */
export function findBookByUsfxId(usfxId: string): BookMeta | undefined {
  return BOOKS.find((b) => b.usfxId === usfxId);
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Root directory of the project */
export const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

/** Temp directory for downloaded zip/xml files (gitignored) */
export const DOWNLOAD_DIR = path.join(PROJECT_ROOT, "scripts", "seed-bible", ".data");

/** Batch size for DB inserts */
export const INSERT_BATCH_SIZE = 500;
