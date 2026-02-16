import { setRequestLocale } from "next-intl/server";
import { getCharacters } from "@/lib/characters/queries";
import { CharactersList } from "./characters-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CharactersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const characters = await getCharacters();

  return <CharactersList characters={characters} />;
}
