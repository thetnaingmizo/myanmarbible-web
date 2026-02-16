"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Bookmark } from "lucide-react";
import type { VerseResult } from "@/lib/verse-finder/store";

type Props = {
  verse: VerseResult;
  userId: string;
  onToggleBookmark: (verseId: string) => void;
};

export function VerseCard({ verse, userId, onToggleBookmark }: Props) {
  const t = useTranslations("VerseFinder");
  const [isToggling, setIsToggling] = useState(false);

  async function handleToggleBookmark() {
    if (isToggling) return;
    setIsToggling(true);

    try {
      const supabase = createClient();

      if (verse.isBookmarked) {
        await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", userId)
          .eq("verse_id", verse.verseId);
      } else {
        await supabase.from("bookmarks").insert({
          user_id: userId,
          verse_id: verse.verseId,
        });
      }

      onToggleBookmark(verse.verseId);
    } catch {
      // Silently fail — bookmark state will be stale but not disruptive
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-primary">
          {verse.book} {verse.chapter}:{verse.verse}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleBookmark}
          disabled={isToggling}
          className={`h-8 gap-1 text-xs ${verse.isBookmarked ? "text-primary" : "text-muted-foreground"}`}
        >
          <Bookmark
            className={`h-3.5 w-3.5 ${verse.isBookmarked ? "fill-current" : ""}`}
          />
          {verse.isBookmarked ? t("bookmarked") : t("bookmark")}
        </Button>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {verse.text}
      </p>
    </div>
  );
}
