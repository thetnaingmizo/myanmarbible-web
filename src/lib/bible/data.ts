import { unstable_cache } from "next/cache";
import { publicClient } from "@/lib/supabase/public";

// Bible text is the same for every reader, so it is cached across requests
// (tag "bible"). Admin verse edits call updateTag(BIBLE_TAG).
export const BIBLE_TAG = "bible";
const DAY = 60 * 60 * 24;

export type Bible = {
  id: string;
  code: string;
  name_en: string;
  name_my: string | null;
  language: string;
  is_default: boolean | null;
};

export type Book = {
  id: string;
  translation_id: string;
  book_number: number;
  name_en: string;
  name_my: string | null;
  abbreviation_en: string;
  abbreviation_my: string | null;
  testament: string;
  chapter_count: number;
};

export type Verse = { id: string; verse_number: number; text: string };

const cached = <A extends unknown[], R>(key: string, fn: (...args: A) => Promise<R>) =>
  unstable_cache(fn, [key], { tags: [BIBLE_TAG], revalidate: DAY });

/** Every Bible on the site: default first, then Burmese, then the rest by name. */
export const getBibles = cached("bibles", async (): Promise<Bible[]> => {
  const { data, error } = await publicClient()
    .from("translations")
    .select("id, code, name_en, name_my, language, is_default");
  if (error) throw error;
  const rank = (b: Bible) => (b.is_default ? 0 : b.language === "my" ? 1 : 2);
  return [...(data ?? [])].sort((a, b) => rank(a) - rank(b) || a.name_en.localeCompare(b.name_en));
});

const BOOK_COLUMNS =
  "id, translation_id, book_number, name_en, name_my, abbreviation_en, abbreviation_my, testament, chapter_count";

/** All books of every Bible (≈66 × Bibles rows); used for lookups and switching Bibles. */
export const getAllBooks = cached("books-all", async (): Promise<Book[]> => {
  // The API returns at most 1,000 rows per request; page through.
  const out: Book[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await publicClient()
      .from("books")
      .select(BOOK_COLUMNS)
      .order("translation_id")
      .order("book_number")
      .range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
});

export async function getBooks(translationId: string): Promise<Book[]> {
  return (await getAllBooks()).filter((b) => b.translation_id === translationId);
}

export async function getBook(bookId: string): Promise<Book | null> {
  return (await getAllBooks()).find((b) => b.id === bookId) ?? null;
}

/** The same book (by number) in another Bible. */
export async function getBookIn(translationId: string, bookNumber: number): Promise<Book | null> {
  return (await getAllBooks()).find((b) => b.translation_id === translationId && b.book_number === bookNumber) ?? null;
}

export const getChapter = cached("chapter", async (bookId: string, chapter: number): Promise<Verse[]> => {
  const { data, error } = await publicClient()
    .from("verses")
    .select("id, verse_number, text")
    .eq("book_id", bookId)
    .eq("chapter_number", chapter)
    .order("verse_number");
  if (error) throw error;
  return data ?? [];
});

/** The reader's default Bible for a site language (Judson for my, KJV for en). */
export async function defaultBible(locale: string): Promise<Bible | null> {
  const bibles = await getBibles();
  const language = locale === "my" ? "my" : "en";
  return bibles.find((b) => b.language === language) ?? bibles[0] ?? null;
}

/** Display name of a Bible in its own language. */
export function bibleName(b: Pick<Bible, "language" | "name_en" | "name_my">) {
  return b.language === "my" && b.name_my ? b.name_my : b.name_en;
}

/** Book name as that Bible's readers expect it (Burmese names for Burmese Bibles). */
export function bookName(book: Pick<Book, "name_en" | "name_my">, bibleLanguage: string) {
  return (bibleLanguage === "my" && book.name_my ? book.name_my : book.name_en).replace(/​/g, "");
}
