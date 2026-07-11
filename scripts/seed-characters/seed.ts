#!/usr/bin/env npx tsx
/**
 * Bible Characters Seed Script
 * =============================
 *
 * Generates ~50 major Bible characters using Google Gemini (JSON mode)
 * and upserts them into the `characters` table.
 *
 * Usage:
 *   npm run db:seed-characters
 *
 * Environment variables required (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GEMINI_API_KEY
 *
 * This script is idempotent -- uses upsert on slug.
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { CHARACTERS, type CharacterEntry } from "./character-list.js";

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
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
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

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Generate character data via Gemini
// ---------------------------------------------------------------------------

type GeneratedCharacter = {
  name_my: string;
  description_en: string;
  description_my: string;
  bio_en: string;
  bio_my: string;
  key_verses: string[]; // e.g. ["Genesis 1:27", "Genesis 2:7"]
};

async function generateCharacterData(
  genai: GoogleGenAI,
  entry: CharacterEntry
): Promise<GeneratedCharacter> {
  const prompt = `You are a Bible scholar and Myanmar language expert. Generate data for the Bible character "${entry.name}" from the ${entry.testament === "OT" ? "Old" : "New"} Testament.

Return a JSON object with these exact fields:
- "name_my": The character's name in Myanmar/Burmese script (use the traditional Myanmar Bible name)
- "description_en": A one-line tagline about the character in English (max 100 characters)
- "description_my": The same tagline in Myanmar/Burmese
- "bio_en": A 2-3 paragraph biography in English (plain text, no markdown)
- "bio_my": The same biography in Myanmar/Burmese
- "key_verses": An array of 3-5 key Bible verse references associated with this character (format: "BookName Chapter:Verse", e.g. "Genesis 1:27")

Use standard English book names for verse references (Genesis, Exodus, etc.).
For Myanmar text, use natural Myanmar language appropriate for a Bible study context.`;

  const response = await genai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";
  try {
    return JSON.parse(text) as GeneratedCharacter;
  } catch {
    throw new Error(
      `Failed to parse Gemini JSON for "${entry.name}": ${text.slice(0, 200)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Resolve verse references to IDs
// ---------------------------------------------------------------------------

// Map of common book name variations to a canonical short form for matching
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
    // Parse "BookName Chapter:Verse"
    const match = ref.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (!match) {
      console.warn(`    Could not parse verse reference: "${ref}"`);
      continue;
    }

    const [, bookNameRaw, chapterStr, verseStr] = match;
    const bookName = BOOK_NAME_MAP[bookNameRaw.toLowerCase()] ?? bookNameRaw;
    const chapter = parseInt(chapterStr, 10);
    const verse = parseInt(verseStr, 10);

    // Find the book (try name_en match)
    const { data: books } = await supabase
      .from("books")
      .select("id")
      .ilike("name_en", bookName)
      .limit(1);

    if (!books || books.length === 0) {
      console.warn(`    Book not found: "${bookName}" (from ref "${ref}")`);
      continue;
    }

    // Find the verse
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
  console.log("=== Bible Characters Seed ===\n");

  await loadEnv();
  const supabase = getSupabaseClient();
  const genai = getGeminiClient();

  console.log(`Characters to process: ${CHARACTERS.length}\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < CHARACTERS.length; i++) {
    const entry = CHARACTERS[i];
    const slug = toSlug(entry.name);
    console.log(`[${i + 1}/${CHARACTERS.length}] ${entry.name} (${slug})`);

    try {
      // Generate content via Gemini
      console.log("  Generating content via Gemini...");
      const data = await generateCharacterData(genai, entry);

      // Resolve verse references to IDs
      console.log(`  Resolving ${data.key_verses.length} verse references...`);
      const verseIds = await resolveVerseIds(supabase, data.key_verses);
      console.log(`  Resolved ${verseIds.length}/${data.key_verses.length} verses`);

      // Upsert into characters table
      const { error } = await supabase.from("characters").upsert(
        {
          name_en: entry.name,
          name_my: data.name_my,
          slug,
          description_en: data.description_en,
          description_my: data.description_my,
          bio_en: data.bio_en,
          bio_my: data.bio_my,
          testament: entry.testament,
          key_verse_ids: verseIds,
          status: "published",
        },
        { onConflict: "slug" }
      );

      if (error) {
        throw new Error(`Supabase upsert failed: ${error.message}`);
      }

      console.log("  Done.\n");
      success++;
    } catch (err) {
      console.error(`  ERROR: ${err}\n`);
      failed++;
    }

    // Rate limit delay: 1 second between Gemini calls
    if (i < CHARACTERS.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
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
