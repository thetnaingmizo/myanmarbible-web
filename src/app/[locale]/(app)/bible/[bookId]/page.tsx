import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { bookName, getAllBooks, getBibles } from "@/lib/bible/data";
import { num } from "@/lib/bible/reader-text";
import { BibleChips } from "../bible-chips";

type Props = {
  params: Promise<{ locale: string; bookId: string }>;
};

async function load(bookId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(bookId)) return null;
  const [bibles, allBooks] = await Promise.all([getBibles(), getAllBooks()]);
  const book = allBooks.find((b) => b.id === bookId);
  const bible = book && bibles.find((b) => b.id === book.translation_id);
  return book && bible ? { bibles, allBooks, book, bible } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await load((await params).bookId);
  return ctx ? { title: bookName(ctx.book, ctx.bible.language) } : {};
}

export default async function BookPage({ params }: Props) {
  const { locale, bookId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Bible");
  const ctx = await load(bookId);
  if (!ctx) notFound();
  const { bibles, allBooks, book, bible } = ctx;
  const burmese = bible.language === "my";
  const sameBook = (id: string) => allBooks.find((b) => b.translation_id === id && b.book_number === book.book_number);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <Link href={`/bible?t=${bible.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-maroon">
        <ChevronLeft className="size-4" aria-hidden />
        {t("backToBooks")}
      </Link>
      <h1 className="font-serif text-3xl font-semibold" lang={burmese ? "my" : undefined}>
        {bookName(book, bible.language)}
      </h1>
      <BibleChips bibles={bibles} current={bible.id} hrefFor={(b) => (sameBook(b.id) ? `/bible/${sameBook(b.id)!.id}` : null)} />
      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-2">{t("chapters")}</h2>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
          {Array.from({ length: book.chapter_count }, (_, i) => i + 1).map((ch) => (
            <Link
              key={ch}
              href={`/bible/${book.id}/${ch}`}
              className="grid h-12 place-items-center rounded-xl border border-line bg-surface text-sm font-semibold hover:border-maroon/40 hover:bg-sunk"
            >
              {num(ch, burmese)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
