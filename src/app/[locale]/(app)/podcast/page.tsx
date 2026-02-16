import { setRequestLocale } from "next-intl/server";
import { getPodcastEpisodes } from "@/lib/podcast/queries";
import { PodcastList } from "./podcast-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PodcastPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const episodes = await getPodcastEpisodes();

  // Extract unique tags from all episodes
  const allTags = Array.from(
    new Set(episodes.flatMap((e) => e.tags ?? []))
  ).sort();

  return <PodcastList episodes={episodes} allTags={allTags} />;
}
