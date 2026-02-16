#!/usr/bin/env npx tsx
/**
 * Generate verse embeddings using Google Gemini
 * ==============================================
 *
 * Processes all verses (or a specific translation) and stores
 * 768-dimensional embeddings in the verse_embeddings table.
 *
 * Usage:
 *   npx tsx scripts/generate-embeddings.ts                  # All translations
 *   npx tsx scripts/generate-embeddings.ts --only judson    # Only Judson
 *   npx tsx scripts/generate-embeddings.ts --only kjv       # Only KJV
 *
 * The script is idempotent — it skips verses that already have embeddings.
 * Uses batched embedding requests (max 100 texts per API call).
 *
 * Rate limiting: Gemini embedding API allows ~1500 RPM for free tier.
 * We add small delays between batches to stay well within limits.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 100; // Gemini supports up to 100 texts per batch request
const DELAY_BETWEEN_BATCHES_MS = 200;

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------

async function loadEnv(): Promise<void> {
  const { readFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = await import("node:path").then((p) =>
    p.dirname(fileURLToPath(import.meta.url))
  );
  const projectRoot = resolve(__dirname, "..");

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
}

// ---------------------------------------------------------------------------
// Supabase + Gemini clients
// ---------------------------------------------------------------------------

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// Fetch verses needing embeddings
// ---------------------------------------------------------------------------

interface VerseRow {
  id: string;
  text: string;
  chapter_number: number;
  verse_number: number;
  book_id: string;
  book_name: string;
}

async function getVersesWithoutEmbeddings(
  supabase: SupabaseClient,
  translationCode?: string
): Promise<VerseRow[]> {
  // Get all verses that don't yet have embeddings
  // We need book context for better embedding quality
  let query = supabase
    .from("verses")
    .select(
      `
      id,
      text,
      chapter_number,
      verse_number,
      book_id,
      books!inner(name_en, translation_id, translations!inner(code))
    `
    )
    .order("book_id")
    .order("chapter_number")
    .order("verse_number");

  if (translationCode) {
    query = query.eq("books.translations.code", translationCode);
  }

  // Fetch all verses first
  const { data: allVerses, error: versesError } = await query;
  if (versesError) throw new Error(`Failed to fetch verses: ${versesError.message}`);
  if (!allVerses || allVerses.length === 0) return [];

  // Fetch existing embedding verse_ids
  const { data: existingEmbeddings, error: embError } = await supabase
    .from("verse_embeddings")
    .select("verse_id");
  if (embError) throw new Error(`Failed to fetch embeddings: ${embError.message}`);

  const existingIds = new Set((existingEmbeddings || []).map((e) => e.verse_id));

  // Filter to only verses without embeddings
  const verses: VerseRow[] = [];
  for (const v of allVerses) {
    if (existingIds.has(v.id)) continue;
    const book = v.books as unknown as { name_en: string };
    verses.push({
      id: v.id,
      text: v.text,
      chapter_number: v.chapter_number,
      verse_number: v.verse_number,
      book_id: v.book_id,
      book_name: book.name_en,
    });
  }

  return verses;
}

// ---------------------------------------------------------------------------
// Generate embeddings in batches
// ---------------------------------------------------------------------------

async function generateAndStoreEmbeddings(
  genai: GoogleGenAI,
  supabase: SupabaseClient,
  verses: VerseRow[]
): Promise<void> {
  console.log(`\n  Processing ${verses.length} verses in batches of ${BATCH_SIZE}...`);

  let processed = 0;
  let errors = 0;

  for (let i = 0; i < verses.length; i += BATCH_SIZE) {
    const batch = verses.slice(i, i + BATCH_SIZE);

    // Prepare texts with context for better embeddings
    const texts = batch.map(
      (v) => `${v.book_name} ${v.chapter_number}:${v.verse_number} - ${v.text}`
    );

    try {
      // Use Gemini batch embedding
      const result = await genai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: texts,
        config: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
        },
      });

      const embeddings = result.embeddings;
      if (!embeddings || embeddings.length !== batch.length) {
        console.error(`    Batch ${i}: expected ${batch.length} embeddings, got ${embeddings?.length ?? 0}`);
        errors += batch.length;
        continue;
      }

      // Store in database
      const rows = batch.map((v, idx) => ({
        verse_id: v.id,
        embedding: JSON.stringify(embeddings[idx].values),
        model: EMBEDDING_MODEL,
      }));

      const { error: insertError } = await supabase
        .from("verse_embeddings")
        .upsert(rows, { onConflict: "verse_id" });

      if (insertError) {
        console.error(`    Batch ${i} insert error: ${insertError.message}`);
        errors += batch.length;
        continue;
      }

      processed += batch.length;
    } catch (err) {
      console.error(`    Batch ${i} API error:`, err instanceof Error ? err.message : err);
      errors += batch.length;
    }

    // Progress
    const pct = Math.min(100, Math.round(((i + batch.length) / verses.length) * 100));
    if (i % (BATCH_SIZE * 10) === 0 || i + BATCH_SIZE >= verses.length) {
      console.log(`    Progress: ${pct}% (${processed} embedded, ${errors} errors)`);
    }

    // Rate limit delay
    if (i + BATCH_SIZE < verses.length) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  console.log(`\n  Done: ${processed} embedded, ${errors} errors.`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): { only?: string } {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--only" && args[i + 1]) {
      return { only: args[i + 1].toLowerCase() };
    }
  }
  return {};
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();
  console.log("=== Generate Verse Embeddings ===\n");

  const { only } = parseArgs();
  await loadEnv();

  const supabase = getSupabase();
  const genai = getGenAI();

  if (only) {
    console.log(`Filtering to translation: ${only}`);
  }

  const verses = await getVersesWithoutEmbeddings(supabase, only);

  if (verses.length === 0) {
    console.log("All verses already have embeddings. Nothing to do.");
  } else {
    console.log(`Found ${verses.length} verses without embeddings.`);
    await generateAndStoreEmbeddings(genai, supabase, verses);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
