/**
 * Quick verification script to check seeded Bible data.
 * Usage: npx tsx scripts/seed-bible/verify.ts
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");

// Load env
const envPath = path.resolve(projectRoot, ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const value = t.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log("=== Bible Data Verification ===\n");

  const { data: translations } = await sb
    .from("translations")
    .select("id, code, name_en");

  if (!translations || translations.length === 0) {
    console.log("No translations found. Run: npm run db:seed-bible");
    return;
  }

  for (const t of translations) {
    const { count: bCount } = await sb
      .from("books")
      .select("*", { count: "exact", head: true })
      .eq("translation_id", t.id);

    // Get book ids for this translation
    const { data: books } = await sb
      .from("books")
      .select("id")
      .eq("translation_id", t.id);

    const bookIds = (books || []).map((b) => b.id);

    let vCount = 0;
    if (bookIds.length > 0) {
      const { count } = await sb
        .from("verses")
        .select("*", { count: "exact", head: true })
        .in("book_id", bookIds);
      vCount = count || 0;
    }

    console.log(`${t.code} (${t.name_en}): ${bCount} books, ${vCount} verses`);

    // Sample: Genesis 1:1
    const { data: genBook } = await sb
      .from("books")
      .select("id, name_en")
      .eq("translation_id", t.id)
      .eq("book_number", 1)
      .single();

    if (genBook) {
      const { data: verse } = await sb
        .from("verses")
        .select("text")
        .eq("book_id", genBook.id)
        .eq("chapter_number", 1)
        .eq("verse_number", 1)
        .single();

      if (verse) {
        console.log(`  Genesis 1:1 -> ${verse.text.substring(0, 120)}...`);
      }
    }
  }

  console.log("\nVerification complete.");
}

main().catch(console.error);
