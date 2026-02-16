"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useVerseFinderStore, type ResponseLanguage, type VerseResult } from "@/lib/verse-finder/store";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownContent } from "@/components/markdown-content";
import { VerseCard } from "./verse-card";
import { SuggestedTopics } from "./suggested-topics";
import { Search, Loader2 } from "lucide-react";

type Props = {
  userId: string;
  defaultLanguage: ResponseLanguage;
};

export function VerseFinderWindow({ userId, defaultLanguage }: Props) {
  const t = useTranslations("VerseFinder");
  const [input, setInput] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);

  const {
    results,
    explanation,
    isSearching,
    error,
    responseLanguage,
    setResults,
    appendExplanation,
    setIsSearching,
    setError,
    setResponseLanguage,
    toggleBookmark,
    clearResults,
  } = useVerseFinderStore();

  // Initialize response language from profile preference
  useEffect(() => {
    setResponseLanguage(defaultLanguage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fetch full verse details by IDs from Supabase + check bookmark state */
  async function fetchVerseDetails(verseIds: string[]): Promise<VerseResult[]> {
    if (verseIds.length === 0) return [];
    const supabase = createClient();

    // Fetch verse data and bookmarks in parallel
    const [versesRes, bookmarksRes] = await Promise.all([
      supabase
        .from("verses")
        .select("id, book_id, chapter_number, verse_number, text")
        .in("id", verseIds),
      supabase
        .from("bookmarks")
        .select("verse_id")
        .eq("user_id", userId)
        .in("verse_id", verseIds),
    ]);

    if (!versesRes.data || versesRes.data.length === 0) return [];

    // Fetch book names
    const bookIds = [...new Set(versesRes.data.map((v) => v.book_id))];
    const { data: books } = await supabase
      .from("books")
      .select("id, name_en, name_my")
      .in("id", bookIds);

    const bookMap = new Map(books?.map((b) => [b.id, b]) || []);
    const bookmarkedIds = new Set(
      bookmarksRes.data?.map((b) => b.verse_id) || []
    );

    return versesRes.data.map((v) => {
      const book = bookMap.get(v.book_id);
      return {
        verseId: v.id,
        book: book?.name_en || "Unknown",
        chapter: v.chapter_number,
        verse: v.verse_number,
        text: v.text,
        isBookmarked: bookmarkedIds.has(v.id),
      };
    });
  }

  async function handleSearch(text?: string) {
    const searchText = (text || input).trim();
    if (!searchText || isSearching) return;

    setInput(searchText);
    clearResults();
    setIsSearching(true);

    try {
      const response = await fetch("/api/v1/verse-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchText,
          responseLanguage,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Search failed");
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "meta") {
              if (event.verses && event.verses.length > 0) {
                const ids = event.verses.map((v: { verseId: string }) => v.verseId);
                const verseDetails = await fetchVerseDetails(ids);
                setResults(verseDetails);
              }
            } else if (event.type === "text") {
              appendExplanation(event.content);
            } else if (event.type === "error") {
              setError(event.message);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorMessage"));
    } finally {
      setIsSearching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  }

  function handleTopicSelect(topic: string) {
    setInput(topic);
    handleSearch(topic);
  }

  const isEmpty = results.length === 0 && !explanation && !isSearching && !error;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <div className="flex-1" />
        {/* Language toggle */}
        <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
          {(["auto", "en", "my"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setResponseLanguage(lang)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                responseLanguage === lang
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(lang === "auto" ? "languageAuto" : lang === "en" ? "languageEn" : "languageMy")}
            </button>
          ))}
        </div>
      </div>

      {/* Search input */}
      <div className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholder")}
            disabled={isSearching}
            className="flex-1"
          />
          <Button
            onClick={() => handleSearch()}
            disabled={!input.trim() || isSearching}
            size="icon"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto px-4 py-6" ref={resultsRef}>
        <div className="mx-auto max-w-3xl">
          {isEmpty ? (
            <div className="mb-8 mt-8">
              <div className="mb-8 text-center">
                <h2 className="mb-2 text-2xl font-bold">{t("title")}</h2>
                <p className="text-muted-foreground">{t("placeholder")}</p>
              </div>
              <SuggestedTopics onSelect={handleTopicSelect} />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Searching indicator */}
              {isSearching && !explanation && (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{t("searching")}</span>
                </div>
              )}

              {/* AI Explanation */}
              {explanation && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                    {t("aiExplanation")}
                  </h3>
                  <div className="text-sm leading-relaxed">
                    <MarkdownContent content={explanation} />
                    {isSearching && (
                      <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current align-middle" />
                    )}
                  </div>
                </div>
              )}

              {/* Verse cards */}
              {results.length > 0 && (
                <div className="space-y-3">
                  {results.map((verse) => (
                    <VerseCard
                      key={verse.verseId}
                      verse={verse}
                      userId={userId}
                      onToggleBookmark={toggleBookmark}
                    />
                  ))}
                </div>
              )}

              {/* No results */}
              {!isSearching && results.length === 0 && !explanation && !error && (
                <p className="py-8 text-center text-muted-foreground">
                  {t("noResults")}
                </p>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
