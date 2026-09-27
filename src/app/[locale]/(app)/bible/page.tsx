import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { defaultBible, getBibles, getBooks, type Book } from "@/lib/bible/data";
import { shortBurmeseBookName } from "@/lib/bible/reader-text";
import { ContinueReading } from "@/components/reader/continue-reading";
import { PassageJump } from "@/components/reader/passage-jump";
import { BibleChips } from "./bible-chips";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Bible" });
  return { title: t("title") };
}

export default async function BiblePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { t: bibleId } = await searchParams;
  const t = await getTranslations("Bible");

  const bibles = await getBibles();
  const bible = bibles.find((b) => b.id === bibleId) ?? (await defaultBible(locale));
  if (!bible) return <p className="p-8 text-center text-ink-3">{t("noMatch")}</p>;
  const books = await getBooks(bible.id);
  const burmese = bible.language === "my";
  const name = (b: Book) => {
    const n = (burmese && b.name_my ? b.name_my : b.name_en).replace(/​/g, "");
    return burmese ? shortBurmeseBookName(n) : n;
  };

  const grid = (list: Book[]) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {list.map((b) => (
        <Link
          key={b.id}
          href={`/bible/${b.id}`}
          className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink hover:border-maroon/40 hover:bg-sunk"
        >
          {name(b)}
        </Link>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">{t("title")}</h1>
      <div className="grid gap-3 md:grid-cols-2">
        <PassageJump bible={bible} books={books} />
        <ContinueReading />
      </div>
      <BibleChips bibles={bibles} current={bible.id} hrefFor={(b) => `/bible?t=${b.id}`} />
      <section lang={burmese ? "my" : undefined}>
        <h2 className="mb-3 text-lg font-semibold text-ink-2">{t("oldTestament")}</h2>
        {grid(books.filter((b) => b.testament === "OT"))}
      </section>
      <section lang={burmese ? "my" : undefined}>
        <h2 className="mb-3 text-lg font-semibold text-ink-2">{t("newTestament")}</h2>
        {grid(books.filter((b) => b.testament === "NT"))}
      </section>
    </div>
  );
}
