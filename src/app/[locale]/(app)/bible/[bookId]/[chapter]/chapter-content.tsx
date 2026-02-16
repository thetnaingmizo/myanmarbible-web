"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Bookmark, Copy, Share2 } from "lucide-react";
import { toggleBookmark } from "@/lib/bookmarks/actions";
import { shareVerse, copyVerseToClipboard } from "@/lib/share/utils";

type Verse = {
  id: string;
  verse_number: number;
  text: string;
};

type Props = {
  verses: Verse[];
  bookName: string;
  chapterNumber: number;
  userId: string | null;
  bookmarkedVerseIds: string[];
};

export function ChapterContent({
  verses,
  bookName,
  chapterNumber,
  userId,
  bookmarkedVerseIds: initialBookmarkedIds,
}: Props) {
  const t = useTranslations("Bookmarks");
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set(initialBookmarkedIds));
  const [isToggling, setIsToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelectedVerseId(null);
      }
    }
    if (selectedVerseId) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [selectedVerseId]);

  function handleVerseClick(verseId: string) {
    setSelectedVerseId(selectedVerseId === verseId ? null : verseId);
    setCopied(false);
  }

  async function handleBookmarkToggle(verseId: string) {
    if (!userId || isToggling) return;
    setIsToggling(true);
    try {
      const isBookmarked = bookmarkedIds.has(verseId);
      await toggleBookmark(userId, verseId, isBookmarked);
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (isBookmarked) {
          next.delete(verseId);
        } else {
          next.add(verseId);
        }
        return next;
      });
    } catch {
      // Silently fail
    } finally {
      setIsToggling(false);
    }
  }

  async function handleCopy(verse: Verse) {
    const reference = `${bookName} ${chapterNumber}:${verse.verse_number}`;
    const ok = await copyVerseToClipboard(verse.text, reference);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleShare(verse: Verse) {
    const reference = `${bookName} ${chapterNumber}:${verse.verse_number}`;
    await shareVerse(verse.text, reference);
  }

  return (
    <div className="space-y-1 leading-relaxed">
      {verses.map((verse) => {
        const isSelected = selectedVerseId === verse.id;
        const isBookmarked = bookmarkedIds.has(verse.id);

        return (
          <span key={verse.id} className="relative inline">
            <sup className="mr-1 text-xs font-bold text-muted-foreground">
              {verse.verse_number}
            </sup>
            <span
              className={`cursor-pointer rounded-sm transition-colors ${
                isSelected
                  ? "bg-primary/10"
                  : isBookmarked
                    ? "bg-yellow-100/50 dark:bg-yellow-900/20"
                    : "hover:bg-accent"
              }`}
              onClick={() => handleVerseClick(verse.id)}
            >
              {verse.text}{" "}
            </span>

            {/* Action popover */}
            {isSelected && (
              <span
                ref={popoverRef}
                className="absolute bottom-full left-0 z-10 mb-1 inline-flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
                onClick={(e) => e.stopPropagation()}
              >
                {userId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 gap-1 px-2 text-xs ${isBookmarked ? "text-primary" : "text-muted-foreground"}`}
                    onClick={() => handleBookmarkToggle(verse.id)}
                    disabled={isToggling}
                  >
                    <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? "fill-current" : ""}`} />
                    {isBookmarked ? t("bookmarked") : t("bookmark")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                  onClick={() => handleCopy(verse)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? t("copied") : t("copyVerse")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                  onClick={() => handleShare(verse)}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {t("shareVerse")}
                </Button>
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
