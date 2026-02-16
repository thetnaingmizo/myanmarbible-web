import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getPodcastEpisodeBySlug } from "@/lib/podcast/queries";
import { EpisodeDetail } from "./episode-detail";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function PodcastEpisodePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const episode = await getPodcastEpisodeBySlug(slug);
  if (!episode) notFound();

  return <EpisodeDetail episode={episode} />;
}
