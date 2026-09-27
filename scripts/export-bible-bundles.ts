#!/usr/bin/env npx tsx
/**
 * Export each Bible as one gzip'd JSON bundle into Storage (3.0 M18)
 * ===================================================================
 *
 * Bucket `bibles`, object `<translation_id>.json.gz`. Format 1:
 *   { format: 1, translation_id, generated_at,           // newest verse edit included
 *     books: [BookModel JSON…],
 *     verses: [[id, bookIndex, chapter, verse, text]…] } // bookIndex into books
 * The app downloads it in one request, then fetches any verse edited after
 * generated_at. Re-run after ingesting a Bible (edits are picked up anyway).
 *
 * Usage:
 *   npx tsx scripts/export-bible-bundles.ts                # all translations, local stack
 *   npx tsx scripts/export-bible-bundles.ts --only judson
 *   npx tsx scripts/export-bible-bundles.ts --remote       # allow a non-local URL
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(): void {
  for (const f of [".env.local", ".env"]) {
    let text: string;
    try {
      text = readFileSync(resolve(root, f), "utf-8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      const k = t.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
    }
    return;
  }
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
  if (!/127\.0\.0\.1|localhost/.test(url) && !process.argv.includes("--remote")) {
    throw new Error(`Refusing to write to ${url} without --remote`);
  }
  const only = (() => {
    const i = process.argv.indexOf("--only");
    return i >= 0 ? process.argv[i + 1] : null;
  })();
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  let q = db.from("translations").select("id, code");
  if (only) q = q.eq("code", only);
  const { data: translations, error } = await q;
  if (error) throw error;

  for (const t of translations ?? []) {
    const { data: books, error: be } = await db
      .from("books")
      .select("id, translation_id, book_number, name_en, name_my, abbreviation_en, abbreviation_my, testament, chapter_count")
      .eq("translation_id", t.id)
      .order("book_number", { ascending: true });
    if (be) throw be;
    const index = new Map((books ?? []).map((b, i) => [b.id as string, i]));
    const verses: [string, number, number, number, string][] = [];
    let newest = "1970-01-01T00:00:00Z";
    for (const b of books ?? []) {
      for (let from = 0; ; from += 1000) {
        const { data: page, error: ve } = await db
          .from("verses")
          .select("id, chapter_number, verse_number, text, updated_at")
          .eq("book_id", b.id)
          .order("chapter_number", { ascending: true })
          .order("verse_number", { ascending: true })
          .range(from, from + 999);
        if (ve) throw ve;
        for (const v of page ?? []) {
          verses.push([v.id, index.get(b.id)!, v.chapter_number, v.verse_number, v.text]);
          if (v.updated_at && v.updated_at > newest) newest = v.updated_at;
        }
        if ((page ?? []).length < 1000) break;
      }
    }
    const json = JSON.stringify({ format: 1, translation_id: t.id, generated_at: newest, books, verses });
    const gz = gzipSync(Buffer.from(json, "utf-8"), { level: 9 });
    const { error: ue } = await db.storage
      .from("bibles")
      .upload(`${t.id}.json.gz`, gz, { contentType: "application/gzip", upsert: true, cacheControl: "3600" });
    if (ue) throw ue;
    console.log(
      `  ${t.code}: ${books?.length} books, ${verses.length} verses · ${(json.length / 1e6).toFixed(1)}M chars → ${(gz.length / 1e6).toFixed(2)} MB gzip`,
    );
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
