"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Props = {
  bookId: string;
  chapterCount: number;
  translationId: string;
};

export function ChapterGrid({ bookId, chapterCount, translationId }: Props) {
  const t = useTranslations("Bible");

  const chapters = Array.from({ length: chapterCount }, (_, i) => i + 1);

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-muted-foreground">
        {t("chapter")}
      </h2>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {chapters.map((ch) => (
          <Link
            key={ch}
            href={`/bible/${bookId}/${ch}?t=${translationId}`}
            className="flex h-12 items-center justify-center rounded-lg border text-sm font-medium transition-colors hover:bg-accent"
          >
            {ch}
          </Link>
        ))}
      </div>
    </div>
  );
}
