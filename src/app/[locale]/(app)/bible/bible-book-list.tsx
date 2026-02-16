"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TranslationSwitcher } from "@/components/translation-switcher";

type Translation = {
  id: string;
  code: string;
  name_en: string;
  name_my: string | null;
  language: string;
};

type Book = {
  id: string;
  book_number: number;
  name_en: string;
  name_my: string | null;
  abbreviation_en: string;
  abbreviation_my: string | null;
  testament: string;
  chapter_count: number;
};

type Props = {
  translations: Translation[];
  currentTranslationId: string;
  books: Book[];
};

export function BibleBookList({ translations, currentTranslationId, books }: Props) {
  const t = useTranslations("Bible");

  const bibleLanguage =
    translations.find((tr) => tr.id === currentTranslationId)?.language ?? "en";
  const otBooks = books.filter((b) => b.testament === "OT");
  const ntBooks = books.filter((b) => b.testament === "NT");

  function bookName(book: Book) {
    return bibleLanguage === "my" && book.name_my ? book.name_my : book.name_en;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <TranslationSwitcher
          translations={translations}
          current={currentTranslationId}
        />
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-muted-foreground">
          {t("oldTestament")}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {otBooks.map((book) => (
            <Link
              key={book.id}
              href={`/bible/${book.id}?t=${currentTranslationId}`}
              className="rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              {bookName(book)}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-muted-foreground">
          {t("newTestament")}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {ntBooks.map((book) => (
            <Link
              key={book.id}
              href={`/bible/${book.id}?t=${currentTranslationId}`}
              className="rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              {bookName(book)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
