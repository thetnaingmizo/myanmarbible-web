#!/usr/bin/env npx tsx
/**
 * Podcast Episodes Seed Script
 * ==========================
 *
 * Generates ~12 podcast episodes using Google Gemini (JSON mode)
 * and upserts them into the `podcast_episodes` table.
 *
 * Usage:
 *   npm run db:seed-podcast
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
import { EPISODES, type EpisodeEntry } from "./episode-list.js";

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
// Generate episode data via Gemini
// ---------------------------------------------------------------------------

type GeneratedEpisode = {
  title_my: string;
  description_en: string;
  description_my: string;
  tags: string[];
};

async function generateEpisodeData(
  genai: GoogleGenAI,
  entry: EpisodeEntry
): Promise<GeneratedEpisode> {
  const prompt = `You are a Bible scholar and Myanmar language expert. Generate content for a podcast episode titled "${entry.title}".

Return a JSON object with these exact fields:
- "title_my": The episode title in Myanmar/Burmese script
- "description_en": A detailed episode description in English (3-4 paragraphs, 200-300 words). Describe what topics are covered.
- "description_my": The same description in Myanmar/Burmese
- "tags": An array of 2-3 English tags (lowercase, e.g. "genesis", "old testament", "creation")

Make the description engaging and informative.`;

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
    description_en: (parsed.description_en as string) ?? "",
    description_my: (parsed.description_my as string) ?? "",
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();
  console.log("=== Podcast Episodes Seed ===\n");

  await loadEnv();
  const supabase = getSupabaseClient();
  const genai = getGeminiClient();

  console.log(`Episodes to process: ${EPISODES.length}\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < EPISODES.length; i++) {
    const entry = EPISODES[i];
    const slug = toSlug(entry.title);
    // Stagger published_at dates: most recent first, 7 days apart
    const publishedAt = new Date();
    publishedAt.setDate(publishedAt.getDate() - i * 7);
    // Random duration between 10-30 minutes
    const durationSeconds = Math.floor(Math.random() * (1800 - 600 + 1)) + 600;

    console.log(`[${i + 1}/${EPISODES.length}] ${entry.title} (${slug})`);

    const maxAttempts = 3;
    let succeeded = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          const backoff = attempt * 5000;
          console.log(`  Retry attempt ${attempt} (waiting ${backoff / 1000}s)...`);
          await new Promise((r) => setTimeout(r, backoff));
        }
        console.log("  Generating content via Gemini...");
        const data = await generateEpisodeData(genai, entry);

        const { error } = await supabase.from("podcast_episodes").upsert(
          {
            title_en: entry.title,
            title_my: data.title_my,
            slug,
            description_en: data.description_en,
            description_my: data.description_my,
            audio_url: `https://placeholder.myanmarbible.com/podcast/${slug}.mp3`,
            duration_seconds: durationSeconds,
            tags: data.tags,
            status: "published",
            published_at: publishedAt.toISOString(),
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
        const isRateLimit =
          String(err).includes("429") || String(err).includes("RESOURCE_EXHAUSTED");
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

    // 3-second delay between episodes to avoid rate limits
    if (i < EPISODES.length - 1) {
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
