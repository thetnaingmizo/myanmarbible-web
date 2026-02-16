import { setRequestLocale } from "next-intl/server";
import { getTranslations, getBooks, getDefaultTranslation } from "@/lib/bible/queries";
import { BibleBookList } from "./bible-book-list";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string }>;
};

export default async function BiblePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { t: translationId } = await searchParams;

  const translations = await getTranslations();

  let currentTranslation = translationId
    ? translations.find((tr) => tr.id === translationId)
    : null;

  if (!currentTranslation) {
    const defaultTr = await getDefaultTranslation(locale);
    currentTranslation = defaultTr
      ? translations.find((tr) => tr.id === defaultTr.id) ?? translations[0]
      : translations[0];
  }

  if (!currentTranslation) {
    return <div className="p-8 text-center text-muted-foreground">No Bible translations found.</div>;
  }

  const books = await getBooks(currentTranslation.id);

  return (
    <BibleBookList
      translations={translations}
      currentTranslationId={currentTranslation.id}
      books={books}
    />
  );
}
