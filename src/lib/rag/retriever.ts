import { createClient } from "@/lib/supabase/server";
import { genai, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "@/lib/gemini/client";

export interface RetrievedVerse {
  verseId: string;
  bookId: string;
  chapterNumber: number;
  verseNumber: number;
  text: string;
  similarity: number;
  // Populated after joining with books table
  bookNameEn?: string;
  bookNameMy?: string;
}

/**
 * Retrieve relevant Bible verses for a given query using
 * vector similarity search (pgvector) with keyword fallback.
 */
export async function retrieveVerses(
  query: string,
  options: {
    matchCount?: number;
    matchThreshold?: number;
    translationId?: string;
    language?: "en" | "my";
  } = {}
): Promise<RetrievedVerse[]> {
  const { matchCount = 8, matchThreshold = 0.3, translationId, language } = options;

  // When filtering by language, over-fetch to ensure enough results after filtering
  const fetchCount = language ? matchCount * 3 : matchCount;

  // 1. Generate embedding for the query
  const embeddingResult = await genai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: query.replace(/\u200B/g, ""),
    // Verses are embedded as RETRIEVAL_DOCUMENT; queries must use RETRIEVAL_QUERY.
    config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_QUERY" },
  });

  const queryEmbedding = embeddingResult.embeddings?.[0]?.values;
  if (!queryEmbedding) {
    console.error("Failed to generate query embedding");
    return [];
  }

  // 2. Vector similarity search via match_verses function
  const supabase = await createClient();
  const { data: vectorResults, error: vectorError } = await supabase.rpc(
    "match_verses",
    {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: matchThreshold,
      match_count: fetchCount,
      // Filter in the database (one translation) instead of after the fact.
      filter_translation_id: translationId,
    }
  );

  if (vectorError) {
    console.error("Vector search error:", vectorError.message);
  }

  let results: RetrievedVerse[] = (vectorResults || []).map((r: {
    verse_id: string;
    book_id: string;
    chapter_number: number;
    verse_number: number;
    text: string;
    similarity: number;
  }) => ({
    verseId: r.verse_id,
    bookId: r.book_id,
    chapterNumber: r.chapter_number,
    verseNumber: r.verse_number,
    text: r.text,
    similarity: r.similarity,
  }));

  // 3. If vector search returned few results, supplement with keyword search
  if (results.length < 3) {
    const keywordResults = await keywordSearch(query, matchCount - results.length);
    // Merge, avoiding duplicates
    const existingIds = new Set(results.map((r) => r.verseId));
    for (const kr of keywordResults) {
      if (!existingIds.has(kr.verseId)) {
        results.push(kr);
      }
    }
  }

  // 4. Filter by translation or language if specified
  if ((translationId || language) && results.length > 0) {
    const bookIds = [...new Set(results.map((r) => r.bookId))];
    const { data: books } = await supabase
      .from("books")
      .select("id, translation_id")
      .in("id", bookIds);

    if (books && translationId) {
      const validBookIds = new Set(
        books.filter((b) => b.translation_id === translationId).map((b) => b.id)
      );
      results = results.filter((r) => validBookIds.has(r.bookId));
    } else if (books && language) {
      // Look up which translations match the target language
      const translationIds = [...new Set(books.map((b) => b.translation_id))];
      const { data: translations } = await supabase
        .from("translations")
        .select("id, language")
        .in("id", translationIds);

      if (translations) {
        const langTranslationIds = new Set(
          translations.filter((t) => t.language === language).map((t) => t.id)
        );
        const validBookIds = new Set(
          books.filter((b) => langTranslationIds.has(b.translation_id)).map((b) => b.id)
        );
        results = results.filter((r) => validBookIds.has(r.bookId));
      }
    }

    // After language/translation filtering, trim to matchCount
    results = results.slice(0, matchCount);
  }

  // 5. Enrich with book names
  if (results.length > 0) {
    const bookIds = [...new Set(results.map((r) => r.bookId))];
    const { data: books } = await supabase
      .from("books")
      .select("id, name_en, name_my")
      .in("id", bookIds);

    if (books) {
      const bookMap = new Map(books.map((b) => [b.id, b]));
      for (const r of results) {
        const book = bookMap.get(r.bookId);
        if (book) {
          r.bookNameEn = book.name_en;
          r.bookNameMy = book.name_my ?? undefined;
        }
      }
    }
  }

  return results;
}

/**
 * Fallback keyword search using PostgreSQL full-text search.
 */
async function keywordSearch(
  query: string,
  limit: number
): Promise<RetrievedVerse[]> {
  if (limit <= 0) return [];

  const supabase = await createClient();

  // Use ilike for simple keyword matching
  const { data, error } = await supabase
    .from("verses")
    .select("id, book_id, chapter_number, verse_number, text")
    .ilike("text", `%${query}%`)
    .limit(limit);

  if (error || !data) return [];

  return data.map((v) => ({
    verseId: v.id,
    bookId: v.book_id,
    chapterNumber: v.chapter_number,
    verseNumber: v.verse_number,
    text: v.text,
    similarity: 0.1, // Low similarity score for keyword matches
  }));
}

/**
 * Format retrieved verses into a context string for the LLM.
 */
export function formatVersesAsContext(verses: RetrievedVerse[]): string {
  if (verses.length === 0) return "";

  return verses
    .map((v) => {
      const ref = `${v.bookNameEn || "Unknown"} ${v.chapterNumber}:${v.verseNumber}`;
      return `[${ref}] ${v.text}`;
    })
    .join("\n");
}
