"use server";

import { unstable_cache } from "next/cache";
import { publicClient } from "@/lib/supabase/public";
import { getAllBooks, getBibles, getChapter } from "./data";

// Public study data for the verse action panels. Free (no AI).

export type CompareRow = {
  bibleId: string;
  code: string;
  name: string;
  language: string;
  /** Verse numbers → text (joined verses come back as their holder's text). */
  verses: { n: number; text: string }[];
};

/** The selected verses in every Bible on the site. */
export async function compareVerses(bookNumber: number, chapter: number, numbers: number[]): Promise<CompareRow[]> {
  const wanted = numbers.filter((n) => Number.isInteger(n) && n > 0).slice(0, 10);
  const [bibles, books] = await Promise.all([getBibles(), getAllBooks()]);
  const rows = await Promise.all(
    bibles.map(async (b): Promise<CompareRow | null> => {
      const book = books.find((x) => x.translation_id === b.id && x.book_number === bookNumber);
      if (!book || chapter > book.chapter_count) return null;
      const verses = await getChapter(book.id, chapter);
      const out: { n: number; text: string }[] = [];
      for (const n of wanted) {
        let v = verses.find((x) => x.verse_number === n);
        // A joined verse (empty) reads as the verse that holds its text.
        if (v && !v.text.trim()) v = [...verses].reverse().find((x) => x.verse_number < n && x.text.trim());
        if (v && !out.some((o) => o.n === v!.verse_number)) out.push({ n: v.verse_number, text: v.text });
      }
      return {
        bibleId: b.id,
        code: b.code,
        name: b.language === "my" && b.name_my ? b.name_my : b.name_en,
        language: b.language,
        verses: out,
      };
    })
  );
  return rows.filter((r): r is CompareRow => r !== null);
}

export type OriginalWord = { position: number; word: string; translit: string | null; gloss: string | null; strong: string | null };
export type LexiconEntry = {
  strong: string;
  lemma: string | null;
  translit: string | null;
  pos: string | null;
  gloss: string | null;
  definition: string | null;
  gloss_my: string | null;
  gloss_my_status: string | null;
};

const WORDS_TAG = "words";

const originalWordsCached = unstable_cache(
  async (book: number, chapter: number, verse: number) => {
    const sb = publicClient();
    const { data: words } = await sb
      .from("original_words")
      .select("position, word, translit, gloss, strong")
      .match({ book_number: book, chapter_number: chapter, verse_number: verse })
      .order("position");
    const strongs = [...new Set((words ?? []).map((w) => w.strong).filter((s): s is string => !!s))];
    const { data: lex } = strongs.length
      ? await sb
          .from("lexicon")
          .select("strong, lemma, translit, pos, gloss, definition, gloss_my, gloss_my_status")
          .in("strong", strongs)
      : { data: [] as LexiconEntry[] };
    return { words: (words ?? []) as OriginalWord[], lexicon: (lex ?? []) as LexiconEntry[] };
  },
  ["original-words"],
  { tags: [WORDS_TAG], revalidate: 60 * 60 * 24 }
);

/** Original-language words of one verse plus their lexicon entries (STEPBible, CC BY 4.0). */
export async function originalWords(book: number, chapter: number, verse: number) {
  if (![book, chapter, verse].every((n) => Number.isInteger(n) && n > 0)) return { words: [], lexicon: [] };
  return originalWordsCached(book, chapter, verse);
}

/** How many verses use this word (the app's word_occurrences RPC). */
export async function wordOccurrences(strong: string): Promise<number | null> {
  if (!/^[GH]\d{1,5}[A-Za-z]?$/.test(strong)) return null;
  const { data, error } = await publicClient().rpc("word_occurrences", { p_strong: strong, lim: 1 });
  if (error || !Array.isArray(data)) return null;
  const first = data[0] as { total?: number } | undefined;
  return first?.total ?? data.length;
}
