import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  getBook,
  getBookByNumber,
  getTranslations as getBibleTranslations,
} from "@/lib/bible/queries";
import { TranslationSwitcher } from "@/components/translation-switcher";
import { ChapterGrid } from "./chapter-grid";

type Props = {
  params: Promise<{ locale: string; bookId: string }>;
  searchParams: Promise<{ t?: string }>;
};

export default async function BookPage({ params, searchParams }: Props) {
  const { locale, bookId } = await params;
  setRequestLocale(locale);
  const { t: translationId } = await searchParams;
  const t = await getTranslations("Bible");

  const book = await getBook(bookId);
  if (!book) notFound();

  const currentTranslationId = translationId ?? book.translation_id;
  const translations = await getBibleTranslations();
  const currentTranslation = translations.find((tr) => tr.id === currentTranslationId);
  const bibleLanguage = currentTranslation?.language ?? "en";
  const bookName = bibleLanguage === "my" && book.name_my ? book.name_my : book.name_en;

  // Build hrefMap: for each translation, find the equivalent book by book_number
  const hrefMap: Record<string, string> = {};
  await Promise.all(
    translations.map(async (tr) => {
      if (tr.id === currentTranslationId) {
        hrefMap[tr.id] = `/bible/${book.id}?t=${tr.id}`;
      } else {
        const equivalent = await getBookByNumber(tr.id, book.book_number);
        if (equivalent) {
          hrefMap[tr.id] = `/bible/${equivalent.id}?t=${tr.id}`;
        }
      }
    })
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-2">
        <Link
          href={`/bible?t=${currentTranslationId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; {t("backToBooks")}
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{bookName}</h1>
        <TranslationSwitcher
          translations={translations}
          current={currentTranslationId}
          hrefMap={hrefMap}
        />
      </div>

      <ChapterGrid
        bookId={book.id}
        chapterCount={book.chapter_count}
        translationId={currentTranslationId}
      />
    </div>
  );
}
