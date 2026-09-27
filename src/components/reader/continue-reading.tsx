"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { lastReadSnapshot } from "./settings";

const noop = () => () => {};

/** "Continue reading · ယော ၃" from this browser's last chapter. */
export function ContinueReading() {
  const t = useTranslations("Bible");
  const last = useSyncExternalStore(noop, lastReadSnapshot, () => null);
  if (!last) return null;
  return (
    <Link
      href={`/bible/${last.bookId}/${last.chapter}`}
      className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 hover:bg-sunk"
    >
      <span className="grid size-11 place-items-center rounded-full bg-maroon-tint text-maroon">
        <BookOpen className="size-5" aria-hidden />
      </span>
      <span className="flex-1">
        <span className="block text-sm text-ink-3">{t("continueReading")}</span>
        <span className="block font-semibold text-ink">{last.label}</span>
      </span>
      <ChevronRight className="size-5 text-ink-3" aria-hidden />
    </Link>
  );
}
