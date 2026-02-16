import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getLessons, getLessonBySlug, getLessonVerses } from "@/lib/lessons/queries";
import { LessonDetail } from "./lesson-detail";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function LessonPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const lesson = await getLessonBySlug(slug);
  if (!lesson) notFound();

  const [verses, allLessons] = await Promise.all([
    getLessonVerses(lesson.key_verse_ids ?? []),
    getLessons(),
  ]);

  // Find previous and next lessons by sort_order
  const currentIndex = allLessons.findIndex((l) => l.slug === slug);
  const previousLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  return (
    <LessonDetail
      lesson={lesson}
      verses={verses}
      previousLesson={previousLesson}
      nextLesson={nextLesson}
    />
  );
}
