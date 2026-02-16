"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Bookmark, Copy, Share2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { shareVerse, copyVerseToClipboard } from "@/lib/share/utils";

type BookmarkData = {
  id: string;
  verse_id: string;
  note: string | null;
  created_at: string;
  verses: {
    id: string;
    verse_number: number;
    chapter_number: number;
    text: string;
    book_id: string;
    books: { id: string; name_en: string; name_my: string | null } | null;
  } | null;
};

type Props = {
  bookmark: BookmarkData;
  userId: string;
  onRemove: (bookmarkId: string) => void;
};

export function BookmarkCard({ bookmark, userId, onRemove }: Props) {
  const locale = useLocale();
  const t = useTranslations("Bookmarks");
  const [isRemoving, setIsRemoving] = useState(false);
  const [copied, setCopied] = useState(false);

  const verse = bookmark.verses;
  if (!verse) return null;

  const bookName =
    locale === "my" && verse.books?.name_my
      ? verse.books.name_my
      : verse.books?.name_en ?? "";
  const reference = `${bookName} ${verse.chapter_number}:${verse.verse_number}`;

  async function handleRemove() {
    if (isRemoving) return;
    setIsRemoving(true);
    try {
      const supabase = createClient();
      await supabase
        .from("bookmarks")
        .delete()
        .eq("id", bookmark.id)
        .eq("user_id", userId);
      onRemove(bookmark.id);
    } catch {
      setIsRemoving(false);
    }
  }

  async function handleCopy() {
    const ok = await copyVerseToClipboard(verse!.text, reference);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleShare() {
    await shareVerse(verse!.text, reference);
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-primary">
          {reference}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            title={t("copyVerse")}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleShare}
            title={t("shareVerse")}
          >
            <Share2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            title={t("goToBible")}
          >
            <Link href={`/bible/${verse.book_id}/${verse.chapter_number}`}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
            onClick={handleRemove}
            disabled={isRemoving}
          >
            <Bookmark className="h-3.5 w-3.5 fill-current" />
            {t("removeBookmark")}
          </Button>
        </div>
      </div>
      <p className="mt-1 leading-relaxed text-muted-foreground">
        {verse.text}
      </p>
      {copied && (
        <p className="mt-1 text-xs text-primary">{t("copied")}</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {t("addedOn")} {new Date(bookmark.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
