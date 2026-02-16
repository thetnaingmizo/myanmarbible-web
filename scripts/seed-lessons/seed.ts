#!/usr/bin/env npx tsx
/**
 * Bible Lessons Seed Script
 * ==========================
 *
 * Generates ~20 Bible study lessons using Google Gemini (JSON mode)
 * and upserts them into the `lessons` table.
 *
 * Usage:
 *   npm run db:seed-lessons
 *
 * Environment variables required (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GEMINI_API_KEY
 *
 * Prerequisites:
 *   - Bible data must be seeded first (npm run db:seed-bible)
 *
 * This script is idempotent -- uses upsert on slug.
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { LESSONS, type LessonEntry } from "./lesson-list.js";

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------

async function loadEnv(): Promise<void> {
  const { readFileSync, existsSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(__dirname, "../..");

  for (const envFile of [".env.local", ".env"]) {
    const envPath = resolve(projectRoot, envFile);
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      console.log(`Loaded environment from ${envFile}`);
      return;
    }
  }
  console.warn("Warning: No .env.local or .env file found.");
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Copy .env.example to .env.local and fill in the values."
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }
  return new GoogleGenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Generate lesson data via Gemini
// ---------------------------------------------------------------------------

type GeneratedLesson = {
  title_my: string;
  summary_en: string;
  summary_my: string;
  content_en: string;
  content_my: string;
  key_verses: string[];
};

async function generateLessonData(
  genai: GoogleGenAI,
  entry: LessonEntry
): Promise<GeneratedLesson> {
  const prompt = `You are a Bible scholar and Myanmar language expert. Generate content for a Bible study lesson titled "${entry.title}" (Lesson ${entry.sortOrder} of 20 in a sequential Bible study series).

Return a JSON object with these exact fields:
- "title_my": The lesson title in Myanmar/Burmese script (short)
- "summary_en": A 2-sentence summary in English (max 150 words)
- "summary_my": The same summary in Myanmar/Burmese (max 150 words)
- "content_en": A 3-paragraph lesson in English (plain text, no markdown, max 400 words). Include key teachings and practical application.
- "content_my": The same lesson in Myanmar/Burmese (max 400 words)
- "key_verses": An array of 3-4 key Bible verse references (format: "BookName Chapter:Verse", e.g. "Genesis 1:1")

Use standard English book names. Keep the total response compact.`;

  const response = await genai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
    },
  });

  const text = response.text ?? "";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `Failed to parse Gemini JSON for "${entry.title}": ${text.slice(0, 200)}`
    );
  }

  return {
    title_my: (parsed.title_my as string) ?? "",
    summary_en: (parsed.summary_en as string) ?? "",
    summary_my: (parsed.summary_my as string) ?? "",
    content_en: (parsed.content_en as string) ?? "",
    content_my: (parsed.content_my as string) ?? "",
    key_verses: Array.isArray(parsed.key_verses) ? parsed.key_verses : [],
  };
}

// ---------------------------------------------------------------------------
// Resolve verse references to IDs
// ---------------------------------------------------------------------------

const BOOK_NAME_MAP: Record<string, string> = {
  "genesis": "Genesis",
  "exodus": "Exodus",
  "leviticus": "Leviticus",
  "numbers": "Numbers",
  "deuteronomy": "Deuteronomy",
  "joshua": "Joshua",
  "judges": "Judges",
  "ruth": "Ruth",
  "1 samuel": "1 Samuel",
  "2 samuel": "2 Samuel",
  "1 kings": "1 Kings",
  "2 kings": "2 Kings",
  "1 chronicles": "1 Chronicles",
  "2 chronicles": "2 Chronicles",
  "ezra": "Ezra",
  "nehemiah": "Nehemiah",
  "esther": "Esther",
  "job": "Job",
  "psalms": "Psalms",
  "psalm": "Psalms",
  "proverbs": "Proverbs",
  "ecclesiastes": "Ecclesiastes",
  "song of solomon": "Song of Solomon",
  "song of songs": "Song of Solomon",
  "isaiah": "Isaiah",
  "jeremiah": "Jeremiah",
  "lamentations": "Lamentations",
  "ezekiel": "Ezekiel",
  "daniel": "Daniel",
  "hosea": "Hosea",
  "joel": "Joel",
  "amos": "Amos",
  "obadiah": "Obadiah",
  "jonah": "Jonah",
  "micah": "Micah",
  "nahum": "Nahum",
  "habakkuk": "Habakkuk",
  "zephaniah": "Zephaniah",
  "haggai": "Haggai",
  "zechariah": "Zechariah",
  "malachi": "Malachi",
  "matthew": "Matthew",
  "mark": "Mark",
  "luke": "Luke",
  "john": "John",
  "acts": "Acts",
  "romans": "Romans",
  "1 corinthians": "1 Corinthians",
  "2 corinthians": "2 Corinthians",
  "galatians": "Galatians",
  "ephesians": "Ephesians",
  "philippians": "Philippians",
  "colossians": "Colossians",
  "1 thessalonians": "1 Thessalonians",
  "2 thessalonians": "2 Thessalonians",
  "1 timothy": "1 Timothy",
  "2 timothy": "2 Timothy",
  "titus": "Titus",
  "philemon": "Philemon",
  "hebrews": "Hebrews",
  "james": "James",
  "1 peter": "1 Peter",
  "2 peter": "2 Peter",
  "1 john": "1 John",
  "2 john": "2 John",
  "3 john": "3 John",
  "jude": "Jude",
  "revelation": "Revelation",
  "revelations": "Revelation",
};

async function resolveVerseIds(
  supabase: ReturnType<typeof createClient>,
  references: string[]
): Promise<string[]> {
  const ids: string[] = [];

  for (const ref of references) {
    const match = ref.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (!match) {
      console.warn(`    Could not parse verse reference: "${ref}"`);
      continue;
    }

    const [, bookNameRaw, chapterStr, verseStr] = match;
    const bookName = BOOK_NAME_MAP[bookNameRaw.toLowerCase()] ?? bookNameRaw;
    const chapter = parseInt(chapterStr, 10);
    const verse = parseInt(verseStr, 10);

    const { data: books } = await supabase
      .from("books")
      .select("id")
      .ilike("name_en", bookName)
      .limit(1);

    if (!books || books.length === 0) {
      console.warn(`    Book not found: "${bookName}" (from ref "${ref}")`);
      continue;
    }

    const { data: verses } = await supabase
      .from("verses")
      .select("id")
      .eq("book_id", books[0].id)
      .eq("chapter_number", chapter)
      .eq("verse_number", verse)
      .limit(1);

    if (verses && verses.length > 0) {
      ids.push(verses[0].id);
    } else {
      console.warn(`    Verse not found: ${bookName} ${chapter}:${verse}`);
    }
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();
  console.log("=== Bible Lessons Seed ===\n");

  await loadEnv();
  const supabase = getSupabaseClient();
  const genai = getGeminiClient();

  console.log(`Lessons to process: ${LESSONS.length}\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < LESSONS.length; i++) {
    const entry = LESSONS[i];
    const slug = toSlug(entry.title);
    console.log(`[${i + 1}/${LESSONS.length}] ${entry.title} (${slug})`);

    const maxAttempts = 3;
    let succeeded = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          const backoff = attempt * 5000; // 5s, 10s
          console.log(`  Retry attempt ${attempt} (waiting ${backoff / 1000}s)...`);
          await new Promise((r) => setTimeout(r, backoff));
        }
        console.log("  Generating content via Gemini...");
        const data = await generateLessonData(genai, entry);

        console.log(`  Resolving ${data.key_verses.length} verse references...`);
        const verseIds = await resolveVerseIds(supabase, data.key_verses);
        console.log(`  Resolved ${verseIds.length}/${data.key_verses.length} verses`);

        const { error } = await supabase.from("lessons").upsert(
          {
            title_en: entry.title,
            title_my: data.title_my,
            slug,
            summary_en: data.summary_en,
            summary_my: data.summary_my,
            content_en: data.content_en,
            content_my: data.content_my,
            key_verse_ids: verseIds,
            sort_order: entry.sortOrder,
            status: "published",
          },
          { onConflict: "slug" }
        );

        if (error) {
          throw new Error(`Supabase upsert failed: ${error.message}`);
        }

        console.log("  Done.\n");
        success++;
        succeeded = true;
        break;
      } catch (err) {
        const isRateLimit = String(err).includes("429") || String(err).includes("RESOURCE_EXHAUSTED");
        console.error(`  ERROR (attempt ${attempt}): ${err}`);
        if (isRateLimit && attempt < maxAttempts) {
          console.log("  Rate limited — will retry with backoff...");
        }
        if (attempt === maxAttempts) {
          console.error("");
        }
      }
    }

    if (!succeeded) {
      failed++;
    }

    // 3-second delay between lessons to avoid rate limits
    if (i < LESSONS.length - 1) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`=== Done in ${elapsed}s — ${success} succeeded, ${failed} failed ===`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
