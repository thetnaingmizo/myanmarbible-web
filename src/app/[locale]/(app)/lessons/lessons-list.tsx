"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { LessonCard } from "./lesson-card";

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
  lessons: Lesson[];
};

export function LessonsList({ lessons }: Props) {
  const t = useTranslations("Lessons");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return lessons;
    const q = search.toLowerCase();
    return lessons.filter(
      (l) =>
        l.title_en.toLowerCase().includes(q) ||
        (l.title_my && l.title_my.includes(search.trim())) ||
        (l.summary_en && l.summary_en.toLowerCase().includes(q)) ||
        (l.summary_my && l.summary_my.includes(search.trim()))
    );
  }, [lessons, search]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("description")}</p>
      </div>

      <div className="mb-6">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-80"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {t("noLessons")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      )}
    </div>
  );
}
