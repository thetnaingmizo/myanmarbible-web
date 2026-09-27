#!/usr/bin/env npx tsx
/**
 * Bible Data Seed Script
 * ======================
 *
 * Downloads Bible translations from eBible.org in USFX XML format,
 * parses them, and seeds the Supabase database.
 *
 * Usage:
 *   npm run db:seed-bible              # Seed all translations (Judson + KJV)
 *   npm run db:seed-bible -- --only judson   # Seed only Myanmar Judson
 *   npm run db:seed-bible -- --only kjv      # Seed only KJV
 *   npm run db:seed-bible -- --only judson --prune  # …and delete verses the source no longer has
 *   npm run db:seed-bible -- --download-only # Download & parse without DB insert
 *
 * Environment variables required (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Downloaded files are cached in scripts/seed-bible/.data/
 * Delete that folder to force re-download.
 *
 * This script is idempotent -- safe to re-run anytime.
 * It uses upsert (ON CONFLICT) so existing data is updated, not duplicated.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { TRANSLATIONS, type TranslationSource } from "./config.js";
import { downloadAndExtractUsfx } from "./download.js";
import { parseLocalSqlite } from "./parse-local-sqlite.js";
import { parseUsfxFile } from "./parse-usfx.js";
import { seedTranslation } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Load .env.local (so scripts work outside of Next.js)
// ---------------------------------------------------------------------------

async function loadEnv(): Promise<void> {
  const { readFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const { PROJECT_ROOT } = await import("./config.js");

  // Try .env.local first, then .env
  for (const envFile of [".env.local", ".env"]) {
    const envPath = resolve(PROJECT_ROOT, envFile);
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        // Only set if not already in environment (env vars take precedence)
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      console.log(`Loaded environment from ${envFile}`);
      return;
    }
  }

  console.warn(
    "Warning: No .env.local or .env file found. " +
    "Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
  );
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliOptions {
  only: string | null; // Filter to a specific translation code
  downloadOnly: boolean; // Only download + parse, skip DB seeding
  prune: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = { only: null, downloadOnly: false, prune: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--only" && args[i + 1]) {
      options.only = args[i + 1].toLowerCase();
      i++;
    }
    if (args[i] === "--download-only") {
      options.downloadOnly = true;
    }
    // Delete verses of the seeded translation that the source doesn't have
    // (e.g. after replacing a translation's text with a different edition).
    if (args[i] === "--prune") {
      options.prune = true;
    }
  }

  return options;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log("=== Myanmar Bible - Bible Data Seed ===\n");

  const options = parseArgs();
  await loadEnv();

  // Filter translations if --only is specified
  let translations: TranslationSource[] = TRANSLATIONS;
  if (options.only) {
    translations = TRANSLATIONS.filter((t) => t.code === options.only);
    if (translations.length === 0) {
      const available = TRANSLATIONS.map((t) => t.code).join(", ");
      console.error(`Error: Unknown translation "${options.only}". Available: ${available}`);
      process.exit(1);
    }
  }

  console.log(
    `Translations to process: ${translations.map((t) => t.code).join(", ")}\n`
  );

  for (const translation of translations) {
    console.log(`--- ${translation.nameEn} (${translation.code}) ---`);

    let parseResult;
    if (translation.localSqlite) {
      // Local SQLite source (e.g. the Mizo Bible) — nothing to download.
      console.log("\n[1/3] Local SQLite source, no download needed.");
      console.log("\n[2/3] Parsing local SQLite database...");
      parseResult = parseLocalSqlite(
        path.join(__dirname, translation.localSqlite.file),
        translation.localSqlite.table,
        { mergedVerseMarkers: translation.localSqlite.mergedVerseMarkers }
      );
    } else {
      // Step 1: Download
      console.log("\n[1/3] Downloading USFX from eBible.org...");
      const xmlPath = await downloadAndExtractUsfx(translation);

      // Step 2: Parse
      console.log("\n[2/3] Parsing USFX XML...");
      parseResult = await parseUsfxFile(xmlPath);
    }

    // Step 3: Seed DB
    if (options.downloadOnly) {
      console.log("\n[3/3] Skipping DB seed (--download-only mode).");
    } else {
      console.log("\n[3/3] Seeding database...");
      await seedTranslation(translation, parseResult, { prune: options.prune });
    }

    console.log(`--- ${translation.nameEn} done ---\n`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`=== All done in ${elapsed}s ===`);
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
