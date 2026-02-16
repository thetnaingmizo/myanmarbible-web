import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";

type Lesson = {
  id: string;
  slug: string;
  title_en: string;
  title_my: string | null;
  summary_en: string | null;
  summary_my: string | null;
  sort_order: number;
  image_url: string | null;
};

type Props = {
  lesson: Lesson;
};

export function LessonCard({ lesson }: Props) {
  const locale = useLocale();
  const t = useTranslations("Lessons");

  const title = locale === "my" && lesson.title_my ? lesson.title_my : lesson.title_en;
  const summary =
    locale === "my" && lesson.summary_my
      ? lesson.summary_my
      : lesson.summary_en;

  return (
    <Link
      href={`/lessons/${lesson.slug}`}
      className="group flex flex-col rounded-lg border p-4 transition-colors hover:bg-accent"
    >
      {/* Lesson number badge */}
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="secondary" className="shrink-0">
          {t("lesson")} {lesson.sort_order}
        </Badge>
      </div>

      {/* Title */}
      <h3 className="font-semibold leading-tight group-hover:text-primary">
        {title}
      </h3>
      {locale !== "my" && lesson.title_my && (
        <p className="mt-0.5 text-sm text-muted-foreground">{lesson.title_my}</p>
      )}

      {/* Summary */}
      {summary && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {summary}
        </p>
      )}
    </Link>
  );
}
