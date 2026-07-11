/**
 * Parse a Bible from a local SQLite source file (e.g. the Mizo Bible,
 * sources/mizogobible.db) into the same ParseResult shape produced by the
 * USFX parser, so seed.ts can ingest it unchanged.
 *
 * Expected table columns: (id, type, book, chapter, verse, text)
 * - Rows are in canonical order by id; distinct `book` values appear in
 *   canonical order, so the Nth distinct book is book_number N (1-66).
 * - `type` is 'verse' for verse rows and 'pericope' (spelling varies) for
 *   section headings. Headings are skipped: the verses table has no heading
 *   support yet.
 * - A few rows have NULL book/chapter (data glitches); they are repaired by
 *   carrying forward the previous row's book/chapter (verified valid for
 *   mizogobible.db: Luke 5:23, 5:24, 5:35, 5:38).
 * - The localized book name from the source is used as the book's display
 *   name (name_en), since that is what readers of this translation expect;
 *   the Burmese name from BOOKS metadata is kept for the my locale.
 */

import Database from "better-sqlite3";
import { BOOKS } from "./config.js";
import type { ParseResult, ParsedBook, ParsedVerse } from "./parse-usfx.js";

interface SourceRow {
  id: number;
  type: string | null;
  book: string | null;
  chapter: number | null;
  /** Usually a number; merged verses are stored as a range string ("8-9"). */
  verse: number | string | null;
  text: string | null;
}

/**
 * A merged-verse row ("8-9", "13-15") covers several verse numbers in one
 * text; store it under the first number (the remaining numbers simply don't
 * exist in this translation).
 */
function parseVerseNumber(verse: number | string | null): number | null {
  if (typeof verse === "number") return verse;
  if (typeof verse === "string") {
    const m = verse.match(/^(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

/** Abbreviate a localized book name, e.g. "1 Johana" -> "1 Joh". */
function abbreviate(name: string): string {
  const m = name.match(/^(\d+)\s+(.+)$/);
  if (m) return `${m[1]} ${m[2].slice(0, 3)}`;
  return name.slice(0, 4).trim();
}

export function parseLocalSqlite(dbPath: string, table: string): ParseResult {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });

  const rows = db
    .prepare(
      `SELECT id, type, book, chapter, verse, text FROM "${table}" ORDER BY id`
    )
    .all() as SourceRow[];
  db.close();

  // Map distinct source book names (in order of appearance) to book numbers.
  const bookNumberByName = new Map<string, number>();
  for (const row of rows) {
    if (row.book && !bookNumberByName.has(row.book)) {
      bookNumberByName.set(row.book, bookNumberByName.size + 1);
    }
  }
  if (bookNumberByName.size !== BOOKS.length) {
    throw new Error(
      `Expected ${BOOKS.length} books in ${dbPath}, found ${bookNumberByName.size}`
    );
  }

  const books: ParsedBook[] = [...bookNumberByName.entries()].map(
    ([sourceName, bookNumber]) => {
      const meta = BOOKS[bookNumber - 1];
      return {
        meta: {
          ...meta,
          // Localized names from the source are the display names readers of
          // this translation expect; keep the Burmese name from BOOKS meta.
          nameEn: sourceName,
          abbreviationEn: abbreviate(sourceName),
        },
        maxChapter: 0,
        verses: [],
      };
    }
  );

  let totalVerses = 0;
  let repaired = 0;
  let duplicates = 0;
  let lastBook: string | null = null;
  let lastChapter: number | null = null;
  const seen = new Set<string>();

  for (const row of rows) {
    // Verse rows have type 'verse' or (for a few glitched rows) NULL;
    // everything else is a section heading ('pericope'/'Pericope'/'percope'),
    // not representable in the verses table yet.
    const type = (row.type ?? "verse").toLowerCase();
    if (type !== "verse") {
      lastBook = row.book ?? lastBook;
      lastChapter = row.chapter ?? lastChapter;
      continue;
    }

    // Repair rows with missing book/chapter by carrying the previous row's.
    let book = row.book;
    let chapter = row.chapter;
    if ((book === null || chapter === null) && row.verse != null && row.text) {
      book = book ?? lastBook;
      chapter = chapter ?? lastChapter;
      repaired++;
    }
    const verseNumber = parseVerseNumber(row.verse);
    if (!book || chapter == null || verseNumber == null || !row.text) continue;

    lastBook = book;
    lastChapter = chapter;

    const bookNumber = bookNumberByName.get(book);
    if (!bookNumber) continue;

    const key = `${bookNumber}:${chapter}:${verseNumber}`;
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);

    const parsedBook = books[bookNumber - 1];
    const verse: ParsedVerse = {
      bookNumber,
      usfxBookId: parsedBook.meta.usfxId,
      chapter,
      verse: verseNumber,
      text: row.text.trim(),
    };
    parsedBook.verses.push(verse);
    if (chapter > parsedBook.maxChapter) parsedBook.maxChapter = chapter;
    totalVerses++;
  }

  for (const b of books) {
    if (b.verses.length === 0) {
      throw new Error(`Book ${b.meta.nameEn} has no verses`);
    }
  }

  const notes = [
    repaired ? `repaired ${repaired} rows with missing book/chapter` : "",
    duplicates ? `skipped ${duplicates} duplicate verse refs` : "",
  ].filter(Boolean);
  console.log(
    `  Parsed ${totalVerses} verses across ${books.length} books` +
      (notes.length ? ` (${notes.join("; ")})` : "")
  );

  return { books, totalVerses };
}
