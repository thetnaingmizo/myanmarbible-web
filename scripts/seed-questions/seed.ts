#!/usr/bin/env npx tsx
/**
 * Bible Questions Seed Script
 * ============================
 *
 * Generates ~15 Bible Q&As using Google Gemini (JSON mode)
 * and upserts them into the `questions` table.
 *
 * Usage:
 *   npm run db:seed-questions
 *
 * Environment variables required (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GEMINI_API_KEY
 *
 * This script is idempotent -- uses upsert on slug.
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { QUESTIONS, type QuestionEntry } from "./question-list.js";

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

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Generate question data via Gemini
// ---------------------------------------------------------------------------

type GeneratedQuestion = {
  title_my: string;
  body_en: string;
  body_my: string;
  answer_en: string;
  answer_my: string;
};

async function generateQuestionData(
  genai: GoogleGenAI,
  entry: QuestionEntry
): Promise<GeneratedQuestion> {
  const prompt = `You are a Bible scholar and Myanmar language expert. Generate content for a Bible Q&A entry with the question: "${entry.title}"

Return a JSON object with these exact fields:
- "title_my": The question title in Myanmar/Burmese script
- "body_en": A 2-3 sentence expanded version of the question providing context in English (max 100 words)
- "body_my": The same body in Myanmar/Burmese
- "answer_en": A detailed biblical answer in English (3-4 paragraphs, ~300 words). Use markdown formatting. Include relevant Bible verse references inline (e.g. John 3:16). Be thorough yet accessible.
- "answer_my": The same answer in Myanmar/Burmese (~300 words)

Use standard English book names for verse references. Keep the total response compact.`;

  const response = await genai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      // Thinking tokens count toward maxOutputTokens on 3.x; keep room for the JSON.
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
    body_en: (parsed.body_en as string) ?? "",
    body_my: (parsed.body_my as string) ?? "",
    answer_en: (parsed.answer_en as string) ?? "",
    answer_my: (parsed.answer_my as string) ?? "",
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();
  console.log("=== Bible Questions Seed ===\n");

  await loadEnv();
  const supabase = getSupabaseClient();
  const genai = getGeminiClient();

  console.log(`Questions to process: ${QUESTIONS.length}\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < QUESTIONS.length; i++) {
    const entry = QUESTIONS[i];
    const slug = toSlug(entry.title);
    console.log(`[${i + 1}/${QUESTIONS.length}] ${entry.title} (${slug})`);

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
        const data = await generateQuestionData(genai, entry);

        const { error } = await supabase.from("questions").upsert(
          {
            title_en: entry.title,
            title_my: data.title_my,
            slug,
            body_en: data.body_en,
            body_my: data.body_my,
            answer_en: data.answer_en,
            answer_my: data.answer_my,
            status: "approved",
            upvote_count: 0,
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

    // 3-second delay between questions to avoid rate limits
    if (i < QUESTIONS.length - 1) {
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
