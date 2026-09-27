"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Bible, Book } from "@/lib/bible/data";
import { PassagePicker } from "./passage-picker";

/** Search-field-looking entry to the passage picker (book list pages). */
export function PassageJump({ bible, books }: { bible: Bible; books: Book[] }) {
  const t = useTranslations("Bible");
  const router = useRouter();
  return (
    <PassagePicker
      bible={bible}
      books={books}
      current={{ bookNumber: 0, chapter: 0 }}
      label={t("passageHint")}
      onGo={(bookId, ch, verse) => router.push(`/bible/${bookId}/${ch}${verse ? `?v=${verse}` : ""}`)}
      trigger={
        <button
          type="button"
          className="flex h-12 w-full items-center gap-3 rounded-full border border-line bg-surface px-5 text-left text-ink-3 hover:border-maroon/40"
        >
          <Search className="size-5" aria-hidden />
          {t("passageHint")}
        </button>
      }
    />
  );
}
