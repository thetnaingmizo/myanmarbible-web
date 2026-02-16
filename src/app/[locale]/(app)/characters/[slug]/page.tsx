import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getCharacterBySlug, getCharacterVerses } from "@/lib/characters/queries";
import { CharacterDetail } from "./character-detail";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function CharacterPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const character = await getCharacterBySlug(slug);
  if (!character) notFound();

  const verses = await getCharacterVerses(character.key_verse_ids ?? []);

  return <CharacterDetail character={character} verses={verses} />;
}
