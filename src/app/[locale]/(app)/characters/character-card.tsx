import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";

type Character = {
  id: string;
  name_en: string;
  name_my: string | null;
  slug: string;
  description_en: string | null;
  description_my: string | null;
  testament: string | null;
  image_url: string | null;
};

type Props = {
  character: Character;
};

export function CharacterCard({ character }: Props) {
  const locale = useLocale();
  const t = useTranslations("Characters");

  const name = locale === "my" && character.name_my ? character.name_my : character.name_en;
  const description =
    locale === "my" && character.description_my
      ? character.description_my
      : character.description_en;

  const testamentLabel =
    character.testament === "OT" ? t("oldTestament") : t("newTestament");

  return (
    <Link
      href={`/characters/${character.slug}`}
      className="group flex flex-col rounded-lg border p-4 transition-colors hover:bg-accent"
    >
      {/* Avatar */}
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
        {character.name_en.charAt(0)}
      </div>

      {/* Name */}
      <h3 className="font-semibold leading-tight group-hover:text-primary">
        {name}
      </h3>
      {locale !== "my" && character.name_my && (
        <p className="mt-0.5 text-sm text-muted-foreground">{character.name_my}</p>
      )}

      {/* Description */}
      {description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {/* Testament badge */}
      {character.testament && (
        <div className="mt-auto pt-3">
          <Badge variant="secondary">{testamentLabel}</Badge>
        </div>
      )}
    </Link>
  );
}
