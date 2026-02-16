import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Character = {
  id: string;
  name_en: string;
  name_my: string | null;
  slug: string;
  description_en: string | null;
  description_my: string | null;
  bio_en: string | null;
  bio_my: string | null;
  testament: string | null;
  key_verse_ids: string[];
  image_url: string | null;
};

type Verse = {
  id: string;
  verse_number: number;
  chapter_number: number;
  text: string;
  book_id: string;
  books: { name_en: string; name_my: string | null } | null;
};

type Props = {
  character: Character;
  verses: Verse[];
};

export function CharacterDetail({ character, verses }: Props) {
  const locale = useLocale();
  const t = useTranslations("Characters");

  const name = locale === "my" && character.name_my ? character.name_my : character.name_en;
  const secondaryName = locale === "my" ? character.name_en : character.name_my;
  const bio = locale === "my" && character.bio_my ? character.bio_my : character.bio_en;
  const testamentLabel =
    character.testament === "OT" ? t("oldTestament") : t("newTestament");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/characters">&larr; {t("backToCharacters")}</Link>
      </Button>

      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
          {character.name_en.charAt(0)}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{name}</h1>
          {secondaryName && (
            <p className="mt-0.5 text-muted-foreground">{secondaryName}</p>
          )}
          {character.testament && (
            <Badge variant="secondary" className="mt-2">
              {testamentLabel}
            </Badge>
          )}
        </div>
      </div>

      {/* Biography */}
      {bio && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{t("biography")}</h2>
          <div className="whitespace-pre-line leading-relaxed text-muted-foreground">
            {bio}
          </div>
        </section>
      )}

      {/* Key Verses */}
      {verses.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("keyVerses")}</h2>
          <div className="space-y-3">
            {verses.map((verse) => {
              const bookName =
                locale === "my" && verse.books?.name_my
                  ? verse.books.name_my
                  : verse.books?.name_en ?? "";
              return (
                <div key={verse.id} className="rounded-lg border p-4">
                  <p className="mb-1 text-sm font-medium text-primary">
                    {bookName} {verse.chapter_number}:{verse.verse_number}
                  </p>
                  <p className="leading-relaxed text-muted-foreground">
                    {verse.text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
