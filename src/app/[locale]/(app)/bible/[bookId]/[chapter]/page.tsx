import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Marker } from "@/components/reader/study/context";
import { getUserBookmarkedVerseIds } from "@/lib/bookmarks/queries";
import { bibleName, bookName, getAllBooks, getBibles, getChapter } from "@/lib/bible/data";
import { cleanVerseText, num } from "@/lib/bible/reader-text";
import { Reader, type ReaderData } from "@/components/reader/reader";

type Props = {
  params: Promise<{ locale: string; bookId: string; chapter: string }>;
  searchParams: Promise<{ p?: string; v?: string }>;
};

const UUID = /^[0-9a-f-]{36}$/i;

async function load(bookId: string, chapterStr: string) {
  const chapter = Number(chapterStr);
  if (!UUID.test(bookId) || !Number.isInteger(chapter) || chapter < 1) return null;
  const [bibles, allBooks] = await Promise.all([getBibles(), getAllBooks()]);
  const book = allBooks.find((b) => b.id === bookId);
  if (!book || chapter > book.chapter_count) return null;
  const bible = bibles.find((b) => b.id === book.translation_id);
  if (!bible) return null;
  return { chapter, bibles, allBooks, book, bible };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bookId, chapter } = await params;
  const ctx = await load(bookId, chapter);
  if (!ctx) return {};
  const burmese = ctx.bible.language === "my";
  const title = `${bookName(ctx.book, ctx.bible.language)} ${num(ctx.chapter, burmese)} · ${bibleName(ctx.bible)}`;
  const first = (await getChapter(ctx.book.id, ctx.chapter)).find((v) => v.text.trim());
  return { title, description: first ? cleanVerseText(first.text, true).slice(0, 160) : undefined };
}

export default async function ChapterPage({ params, searchParams }: Props) {
  const { locale, bookId, chapter: chapterStr } = await params;
  setRequestLocale(locale);
  const { p, v } = await searchParams;

  const ctx = await load(bookId, chapterStr);
  if (!ctx) notFound();
  const { chapter, bibles, allBooks, book, bible } = ctx;

  const books = allBooks.filter((b) => b.translation_id === bible.id);
  const index = books.findIndex((b) => b.id === book.id);
  const prevBook = books[index - 1];
  const nextBook = books[index + 1];
  const prev =
    chapter > 1
      ? { bookId: book.id, chapter: chapter - 1 }
      : prevBook
        ? { bookId: prevBook.id, chapter: prevBook.chapter_count }
        : null;
  const next =
    chapter < book.chapter_count
      ? { bookId: book.id, chapter: chapter + 1 }
      : nextBook
        ? { bookId: nextBook.id, chapter: 1 }
        : null;

  // The same book in each other Bible, for switching and parallel reading.
  const switchTo: Record<string, string> = {};
  for (const b of allBooks) if (b.book_number === book.book_number) switchTo[b.translation_id] = b.id;

  const parallelBible = p && p !== bible.id ? bibles.find((b) => b.id === p) : undefined;
  const parallelBook = parallelBible
    ? allBooks.find((b) => b.translation_id === parallelBible.id && b.book_number === book.book_number)
    : undefined;

  const session = await getSession();
  const userId = session?.user?.id ?? null;
  const [verses, parallelVerses, bookmarked] = await Promise.all([
    getChapter(book.id, chapter),
    parallelBook && chapter <= parallelBook.chapter_count ? getChapter(parallelBook.id, chapter) : Promise.resolve([]),
    userId ? getUserBookmarkedVerseIds(userId) : Promise.resolve(new Set<string>()),
  ]);
  if (verses.length === 0) notFound();

  // This reader's highlights and notes in the chapter (RLS: own rows only).
  const markers: Record<string, Marker> = {};
  if (userId) {
    const supabase = await createClient();
    const { data: rows } = await supabase
      .from("web_markers")
      .select("verse_id, highlight, note")
      .in("verse_id", verses.map((x) => x.id));
    for (const r of rows ?? []) markers[r.verse_id] = r;
  }

  const data: ReaderData = {
    bible,
    bibles,
    book,
    books,
    chapter,
    verses,
    prev,
    next,
    switchTo,
    parallel: parallelBible
      ? { bible: parallelBible, book: parallelBook ?? null, verses: parallelVerses }
      : null,
    bookmarkedIds: [...bookmarked].filter((id) => verses.some((x) => x.id === id)),
    markers,
    signedIn: !!userId,
    targetVerse: v ? Number(v) || null : null,
  };
  return <Reader key={`${book.id}:${chapter}:${data.targetVerse ?? ""}:${parallelBible?.id ?? ""}`} data={data} />;
}
