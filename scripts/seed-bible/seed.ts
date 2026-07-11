/**
 * Seed the Supabase database with parsed Bible data.
 *
 * Inserts into: translations, books, verses
 *
 * Idempotent: uses upsert (ON CONFLICT) so it can be safely re-run.
 * Existing verse text will be updated if the source data changed.
 */

import { createClient } from "@supabase/supabase-js";
import { INSERT_BATCH_SIZE, BOOKS, type TranslationSource } from "./config.js";
import type { ParseResult, ParsedVerse } from "./parse-usfx.js";

// ---------------------------------------------------------------------------
// Supabase client (service role, bypasses RLS)
// ---------------------------------------------------------------------------

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n" +
      "For local development: copy .env.example to .env.local and fill in the values.\n" +
      "Run `npx supabase status` to get your local keys."
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Seed translation
// ---------------------------------------------------------------------------

async function upsertTranslation(
  supabase: ReturnType<typeof createClient>,
  source: TranslationSource
): Promise<string> {
  console.log(`  Upserting translation: ${source.code} (${source.nameEn})`);

  const { data, error } = await supabase
    .from("translations")
    .upsert(
      {
        code: source.code,
        name_en: source.nameEn,
        name_my: source.nameMy,
        language: source.language,
        is_default: source.isDefault,
        is_licensed: false,
        license_info: source.licenseInfo,
        source_url: source.sourceUrl,
      },
      { onConflict: "code" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to upsert translation ${source.code}: ${error.message}`);
  }

  console.log(`  Translation ${source.code} -> id: ${data.id}`);
  return data.id;
}

// ---------------------------------------------------------------------------
// Seed books
// ---------------------------------------------------------------------------

interface BookIdMap {
  [bookNumber: number]: string; // bookNumber -> uuid
}

async function upsertBooks(
  supabase: ReturnType<typeof createClient>,
  translationId: string,
  parseResult: ParseResult
): Promise<BookIdMap> {
  console.log(`  Upserting ${parseResult.books.length} books...`);

  const bookIdMap: BookIdMap = {};

  // Build book rows from parsed data (use actual chapter counts from data)
  const bookRows = parseResult.books.map((pb) => ({
    translation_id: translationId,
    book_number: pb.meta.bookNumber,
    name_en: pb.meta.nameEn,
    name_my: pb.meta.nameMy,
    abbreviation_en: pb.meta.abbreviationEn,
    abbreviation_my: pb.meta.abbreviationMy,
    testament: pb.meta.testament,
    chapter_count: pb.maxChapter,
  }));

  // Upsert in batches
  for (let i = 0; i < bookRows.length; i += INSERT_BATCH_SIZE) {
    const batch = bookRows.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase
      .from("books")
      .upsert(batch, { onConflict: "translation_id,book_number" });

    if (error) {
      throw new Error(`Failed to upsert books batch ${i}: ${error.message}`);
    }
  }

  // Fetch back all book ids for this translation
  const { data: allBooks, error: fetchError } = await supabase
    .from("books")
    .select("id, book_number")
    .eq("translation_id", translationId);

  if (fetchError) {
    throw new Error(`Failed to fetch books: ${fetchError.message}`);
  }

  for (const book of allBooks || []) {
    bookIdMap[book.book_number] = book.id;
  }

  console.log(`  Books upserted: ${Object.keys(bookIdMap).length}`);
  return bookIdMap;
}

// ---------------------------------------------------------------------------
// Seed verses
// ---------------------------------------------------------------------------

async function upsertVerses(
  supabase: ReturnType<typeof createClient>,
  bookIdMap: BookIdMap,
  parseResult: ParseResult
): Promise<void> {
  // Flatten all verses from all books
  const allVerses: ParsedVerse[] = parseResult.books.flatMap((b) => b.verses);
  console.log(`  Upserting ${allVerses.length} verses in batches of ${INSERT_BATCH_SIZE}...`);

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < allVerses.length; i += INSERT_BATCH_SIZE) {
    const batch = allVerses.slice(i, i + INSERT_BATCH_SIZE);

    const rows = batch
      .map((v) => {
        const bookId = bookIdMap[v.bookNumber];
        if (!bookId) {
          skipped++;
          return null;
        }
        return {
          book_id: bookId,
          chapter_number: v.chapter,
          verse_number: v.verse,
          text: v.text,
        };
      })
      .filter(Boolean);

    if (rows.length === 0) continue;

    const { error } = await supabase
      .from("verses")
      .upsert(rows as NonNullable<(typeof rows)[0]>[], {
        onConflict: "book_id,chapter_number,verse_number",
      });

    if (error) {
      throw new Error(
        `Failed to upsert verses batch at offset ${i}: ${error.message}`
      );
    }

    inserted += rows.length;

    // Progress indicator
    if ((i / INSERT_BATCH_SIZE) % 10 === 0 || i + INSERT_BATCH_SIZE >= allVerses.length) {
      const pct = Math.min(100, Math.round(((i + batch.length) / allVerses.length) * 100));
      console.log(`    Progress: ${pct}% (${inserted} verses inserted)`);
    }
  }

  console.log(`  Verses done: ${inserted} inserted, ${skipped} skipped.`);
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

export async function seedTranslation(
  source: TranslationSource,
  parseResult: ParseResult
): Promise<void> {
  const supabase = getSupabaseClient();

  console.log(`\nSeeding "${source.nameEn}" (${source.code})...`);

  // 1. Upsert translation record
  const translationId = await upsertTranslation(supabase, source);

  // 2. Upsert books
  const bookIdMap = await upsertBooks(supabase, translationId, parseResult);

  // 3. Upsert verses
  await upsertVerses(supabase, bookIdMap, parseResult);

  console.log(`Seeding "${source.nameEn}" complete.\n`);
}
