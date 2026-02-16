import { setRequestLocale } from "next-intl/server";
import { getLessons } from "@/lib/lessons/queries";
import { LessonsList } from "./lessons-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LessonsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const lessons = await getLessons();

  return <LessonsList lessons={lessons} />;
}
