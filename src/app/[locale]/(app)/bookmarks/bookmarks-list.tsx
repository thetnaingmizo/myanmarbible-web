"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { BookmarkCard } from "./bookmark-card";

type Bookmark = {
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
  bookmarks: Bookmark[];
  userId: string;
};

export function BookmarksList({ bookmarks: initialBookmarks, userId }: Props) {
  const t = useTranslations("Bookmarks");
  const [search, setSearch] = useState("");
  const [bookmarks, setBookmarks] = useState(initialBookmarks);

  const filtered = useMemo(() => {
    if (!search.trim()) return bookmarks;
    const q = search.toLowerCase();
    return bookmarks.filter((b) => {
      if (!b.verses) return false;
      return (
        b.verses.text.toLowerCase().includes(q) ||
        (b.verses.books?.name_en.toLowerCase().includes(q) ?? false) ||
        (b.verses.books?.name_my?.includes(search.trim()) ?? false)
      );
    });
  }, [bookmarks, search]);

  function handleRemove(bookmarkId: string) {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("description")}</p>
      </div>

      {bookmarks.length > 0 && (
        <div className="mb-6">
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-80"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {t("noBookmarks")}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              userId={userId}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
