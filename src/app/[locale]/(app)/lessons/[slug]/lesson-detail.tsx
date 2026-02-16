import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Lesson = {
  id: string;
  slug: string;
  title_en: string;
  title_my: string | null;
  summary_en: string | null;
  summary_my: string | null;
  content_en: string | null;
  content_my: string | null;
  sort_order: number;
  key_verse_ids: string[] | null;
  image_url: string | null;
};

type LessonSummary = {
  slug: string;
  title_en: string;
  title_my: string | null;
  sort_order: number;
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
  lesson: Lesson;
  verses: Verse[];
  previousLesson: LessonSummary | null;
  nextLesson: LessonSummary | null;
};

export function LessonDetail({ lesson, verses, previousLesson, nextLesson }: Props) {
  const locale = useLocale();
  const t = useTranslations("Lessons");

  const title = locale === "my" && lesson.title_my ? lesson.title_my : lesson.title_en;
  const secondaryTitle = locale === "my" ? lesson.title_en : lesson.title_my;
  const content = locale === "my" && lesson.content_my ? lesson.content_my : lesson.content_en;

  const getPrevNextTitle = (l: LessonSummary) =>
    locale === "my" && l.title_my ? l.title_my : l.title_en;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/lessons">&larr; {t("backToLessons")}</Link>
      </Button>

      {/* Header */}
      <div className="mb-6">
        <Badge variant="secondary" className="mb-3">
          {t("lesson")} {lesson.sort_order}
        </Badge>
        <h1 className="text-2xl font-bold">{title}</h1>
        {secondaryTitle && (
          <p className="mt-1 text-muted-foreground">{secondaryTitle}</p>
        )}
      </div>

      {/* Content */}
      {content && (
        <section className="mb-8">
          <div className="whitespace-pre-line leading-relaxed text-muted-foreground">
            {content}
          </div>
        </section>
      )}

      {/* Key Verses */}
      {verses.length > 0 && (
        <section className="mb-8">
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

      {/* Previous / Next navigation */}
      {(previousLesson || nextLesson) && (
        <nav className="flex items-stretch gap-3 border-t pt-6">
          {previousLesson ? (
            <Link
              href={`/lessons/${previousLesson.slug}`}
              className="flex flex-1 flex-col rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <span className="text-xs text-muted-foreground">
                &larr; {t("previousLesson")}
              </span>
              <span className="mt-1 text-sm font-medium">
                {getPrevNextTitle(previousLesson)}
              </span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
          {nextLesson ? (
            <Link
              href={`/lessons/${nextLesson.slug}`}
              className="flex flex-1 flex-col rounded-lg border p-4 text-right transition-colors hover:bg-accent"
            >
              <span className="text-xs text-muted-foreground">
                {t("nextLesson")} &rarr;
              </span>
              <span className="mt-1 text-sm font-medium">
                {getPrevNextTitle(nextLesson)}
              </span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </nav>
      )}
    </div>
  );
}
