import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";

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

export function EpisodeCard({ episode }: Props) {
  const locale = useLocale();
  const t = useTranslations("Podcast");

  const title =
    locale === "my" && episode.title_my ? episode.title_my : episode.title_en;
  const description =
    locale === "my" && episode.description_my
      ? episode.description_my
      : episode.description_en;

  const formattedDate = episode.published_at
    ? new Date(episode.published_at).toLocaleDateString(
        locale === "my" ? "my-MM" : "en-US",
        { year: "numeric", month: "short", day: "numeric" }
      )
    : null;

  return (
    <Link
      href={`/podcast/${episode.slug}`}
      className="group flex flex-col rounded-lg border p-4 transition-colors hover:bg-accent"
    >
      {/* Title */}
      <h3 className="font-semibold leading-tight group-hover:text-primary">
        {title}
      </h3>
      {locale !== "my" && episode.title_my && (
        <p className="mt-0.5 text-sm text-muted-foreground">
          {episode.title_my}
        </p>
      )}

      {/* Description excerpt */}
      {description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {/* Duration + Tags + Date */}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        {episode.duration_seconds != null && (
          <Badge variant="outline" className="text-xs">
            {formatDuration(episode.duration_seconds)}
          </Badge>
        )}
        {episode.tags?.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs">
            {tag}
          </Badge>
        ))}
        {formattedDate && (
          <span className="ml-auto text-xs text-muted-foreground">
            {formattedDate}
          </span>
        )}
      </div>
    </Link>
  );
}
