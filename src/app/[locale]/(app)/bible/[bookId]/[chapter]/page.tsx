import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  getBook,
  getBookByNumber,
  getVerses,
  getTranslations as getBibleTranslations,
} from "@/lib/bible/queries";
import { getSession } from "@/lib/auth/session";
import { getUserBookmarkedVerseIds } from "@/lib/bookmarks/queries";
import { TranslationSwitcher } from "@/components/translation-switcher";
import { Button } from "@/components/ui/button";
import { ChapterContent } from "./chapter-content";

type Props = {
  params: Promise<{ locale: string; bookId: string; chapter: string }>;
  searchParams: Promise<{ t?: string }>;
};

export default async function ChapterPage({ params, searchParams }: Props) {
  const { locale, bookId, chapter: chapterStr } = await params;
  setRequestLocale(locale);
  const { t: translationId } = await searchParams;
  const t = await getTranslations("Bible");

  const chapterNumber = parseInt(chapterStr, 10);
  if (isNaN(chapterNumber) || chapterNumber < 1) notFound();

  const book = await getBook(bookId);
  if (!book) notFound();
  if (chapterNumber > book.chapter_count) notFound();

  const currentTranslationId = translationId ?? book.translation_id;
  const translations = await getBibleTranslations();
  const currentTranslation = translations.find((tr) => tr.id === currentTranslationId);
  const bibleLanguage = currentTranslation?.language ?? "en";
  const verses = await getVerses(bookId, chapterNumber);
  const bookName = bibleLanguage === "my" && book.name_my ? book.name_my : book.name_en;

  // Fetch session + bookmarked verse IDs (optional)
  const session = await getSession();
  const userId = session?.user?.id ?? null;
  const bookmarkedVerseIds = userId
    ? Array.from(await getUserBookmarkedVerseIds(userId))
    : [];

  // Build hrefMap for translation switching at chapter level
  const hrefMap: Record<string, string> = {};
  await Promise.all(
    translations.map(async (tr) => {
      if (tr.id === currentTranslationId) {
        hrefMap[tr.id] = `/bible/${book.id}/${chapterNumber}?t=${tr.id}`;
      } else {
        const equivalent = await getBookByNumber(tr.id, book.book_number);
        if (equivalent) {
          hrefMap[tr.id] = `/bible/${equivalent.id}/${chapterNumber}?t=${tr.id}`;
        }
      }
    })
  );

  const hasPrev = chapterNumber > 1;
  const hasNext = chapterNumber < book.chapter_count;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-2 flex gap-2 text-sm text-muted-foreground">
        <Link href={`/bible?t=${currentTranslationId}`} className="hover:underline">
          {t("backToBooks")}
        </Link>
        <span>/</span>
        <Link href={`/bible/${bookId}?t=${currentTranslationId}`} className="hover:underline">
          {bookName}
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          {bookName} {chapterNumber}
        </h1>
        <TranslationSwitcher
          translations={translations}
          current={currentTranslationId}
          hrefMap={hrefMap}
        />
      </div>

      {/* Verses with interactive actions */}
      <ChapterContent
        verses={verses}
        bookName={bookName}
        chapterNumber={chapterNumber}
        userId={userId}
        bookmarkedVerseIds={bookmarkedVerseIds}
      />

      {/* Chapter navigation */}
      <div className="mt-8 flex justify-between">
        {hasPrev ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/bible/${bookId}/${chapterNumber - 1}?t=${currentTranslationId}`}>
              &larr; {t("previousChapter")}
            </Link>
          </Button>
        ) : (
          <div />
        )}
        {hasNext ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/bible/${bookId}/${chapterNumber + 1}?t=${currentTranslationId}`}>
              {t("nextChapter")} &rarr;
            </Link>
          </Button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
