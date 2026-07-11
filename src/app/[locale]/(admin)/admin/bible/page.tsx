import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { VerseRow } from "./verse-row";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string; b?: string; c?: string }>;
};

export default async function AdminBiblePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { t: translationId, b: bookId, c: chapterParam } = await searchParams;

  const supabase = await createClient();

  const { data: translations } = await supabase
    .from("translations")
    .select("id, code, name_en, language")
    .order("code");

  const selectedTranslation =
    translations?.find((tr) => tr.id === translationId) ?? translations?.[0];

  const { data: books } = selectedTranslation
    ? await supabase
        .from("books")
        .select("id, book_number, name_en, chapter_count")
        .eq("translation_id", selectedTranslation.id)
        .order("book_number")
    : { data: null };

  const selectedBook = books?.find((bk) => bk.id === bookId) ?? null;
  const chapter = Math.max(1, parseInt(chapterParam ?? "1", 10) || 1);

  const { data: verses } = selectedBook
    ? await supabase
        .from("verses")
        .select("id, verse_number, text, updated_at")
        .eq("book_id", selectedBook.id)
        .eq("chapter_number", chapter)
        .order("verse_number")
    : { data: null };

  const base = `/${locale}/admin/bible`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Bible Content</h1>
        <a href={`/${locale}/admin`} className="text-sm text-muted-foreground hover:underline">
          ← Admin home
        </a>
      </div>

      {/* Translation tabs */}
      <div className="flex flex-wrap gap-2">
        {translations?.map((tr) => (
          <a
            key={tr.id}
            href={`${base}?t=${tr.id}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              tr.id === selectedTranslation?.id
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            {tr.name_en}
            <span className="ml-1.5 uppercase opacity-60">{tr.code}</span>
          </a>
        ))}
      </div>

      {/* Book grid */}
      <div className="flex flex-wrap gap-1.5">
        {books?.map((bk) => (
          <a
            key={bk.id}
            href={`${base}?t=${selectedTranslation?.id}&b=${bk.id}`}
            className={`rounded border px-2 py-0.5 text-xs ${
              bk.id === selectedBook?.id
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
            title={bk.name_en}
          >
            {bk.name_en}
          </a>
        ))}
      </div>

      {selectedBook && (
        <>
          {/* Chapter picker */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-2 text-sm font-medium">
              {selectedBook.name_en} — chapter:
            </span>
            {Array.from({ length: selectedBook.chapter_count }, (_, i) => i + 1).map(
              (ch) => (
                <a
                  key={ch}
                  href={`${base}?t=${selectedTranslation?.id}&b=${selectedBook.id}&c=${ch}`}
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    ch === chapter
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {ch}
                </a>
              )
            )}
          </div>

          {/* Verses */}
          <div className="space-y-1 rounded-lg border">
            <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
              <span>
                {verses?.length ?? 0} verses — click a verse to edit. Edits bump the
                content version so apps pick them up on next launch.
              </span>
              <Badge variant="outline">{selectedTranslation?.code}</Badge>
            </div>
            {verses?.map((v) => (
              <VerseRow
                key={v.id}
                id={v.id}
                verseNumber={v.verse_number}
                text={v.text}
                updatedAt={v.updated_at}
              />
            ))}
          </div>
        </>
      )}

      {!selectedBook && (
        <p className="text-sm text-muted-foreground">Select a book to browse its verses.</p>
      )}
    </div>
  );
}
