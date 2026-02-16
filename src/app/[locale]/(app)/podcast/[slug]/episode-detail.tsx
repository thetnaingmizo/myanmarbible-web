"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Episode = {
  id: string;
  slug: string;
  title_en: string;
  title_my: string | null;
  description_en: string | null;
  description_my: string | null;
  audio_url: string;
  duration_seconds: number | null;
  image_url: string | null;
  tags: string[] | null;
  published_at: string | null;
};

type Props = {
  episode: Episode;
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function EpisodeDetail({ episode }: Props) {
  const locale = useLocale();
  const t = useTranslations("Podcast");

  const title =
    locale === "my" && episode.title_my ? episode.title_my : episode.title_en;
  const secondaryTitle = locale === "my" ? episode.title_en : episode.title_my;
  const description =
    locale === "my" && episode.description_my
      ? episode.description_my
      : episode.description_en;

  const formattedDate = episode.published_at
    ? new Date(episode.published_at).toLocaleDateString(
        locale === "my" ? "my-MM" : "en-US",
        { year: "numeric", month: "long", day: "numeric" }
      )
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/podcast">&larr; {t("backToPodcast")}</Link>
      </Button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        {secondaryTitle && (
          <p className="mt-1 text-muted-foreground">{secondaryTitle}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {formattedDate && (
            <span className="text-sm text-muted-foreground">
              {t("publishedOn")} {formattedDate}
            </span>
          )}
          {episode.duration_seconds != null && (
            <Badge variant="outline">
              {t("duration")}: {formatDuration(episode.duration_seconds)}
            </Badge>
          )}
          {episode.tags?.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Audio player */}
      <section className="mb-8">
        <audio controls className="w-full" src={episode.audio_url}>
          {t("audioPlaceholder")}
        </audio>
      </section>

      {/* Description */}
      {description && (
        <section className="whitespace-pre-line leading-relaxed text-muted-foreground">
          {description}
        </section>
      )}
    </div>
  );
}
