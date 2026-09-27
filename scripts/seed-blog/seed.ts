#!/usr/bin/env npx tsx
/**
 * Blog Posts Seed Script
 * ==========================
 *
 * Generates ~15 blog posts using Google Gemini (JSON mode)
 * and upserts them into the `blog_posts` table.
 *
 * Usage:
 *   npm run db:seed-blog
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
import { BLOG_POSTS, type BlogPostEntry } from "./post-list.js";

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
// Generate blog post data via Gemini
// ---------------------------------------------------------------------------

type GeneratedBlogPost = {
  title_my: string;
  excerpt_en: string;
  excerpt_my: string;
  content_en: string;
  content_my: string;
  tags: string[];
};

async function generateBlogPostData(
  genai: GoogleGenAI,
  entry: BlogPostEntry
): Promise<GeneratedBlogPost> {
  const prompt = `You are a Bible scholar, Christian writer, and Myanmar language expert. Generate content for a blog post titled "${entry.title}".

Return a JSON object with these exact fields:
- "title_my": The blog post title in Myanmar/Burmese script
- "excerpt_en": A 2-sentence excerpt/summary in English (max 100 words)
- "excerpt_my": The same excerpt in Myanmar/Burmese
- "content_en": A full blog post in English using Markdown formatting (use ## headings, bullet lists, blockquotes for Bible verses, bold for emphasis). Should be 400-600 words with practical application.
- "content_my": The same blog post in Myanmar/Burmese using Markdown formatting
- "tags": An array of 2-3 English tags (lowercase, e.g. "prayer", "faith", "old testament")

Make the content engaging, biblically accurate, and practical for everyday Christian life.`;

  const response = await genai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      // Thinking tokens count toward maxOutputTokens on 3.x; keep room for the JSON.
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      maxOutputTokens: 8192,
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
    excerpt_en: (parsed.excerpt_en as string) ?? "",
    excerpt_my: (parsed.excerpt_my as string) ?? "",
    content_en: (parsed.content_en as string) ?? "",
    content_my: (parsed.content_my as string) ?? "",
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();
  console.log("=== Blog Posts Seed ===\n");

  await loadEnv();
  const supabase = getSupabaseClient();
  const genai = getGeminiClient();

  console.log(`Posts to process: ${BLOG_POSTS.length}\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < BLOG_POSTS.length; i++) {
    const entry = BLOG_POSTS[i];
    const slug = toSlug(entry.title);
    // Stagger published_at dates: most recent first, 3 days apart
    const publishedAt = new Date();
    publishedAt.setDate(publishedAt.getDate() - i * 3);

    console.log(`[${i + 1}/${BLOG_POSTS.length}] ${entry.title} (${slug})`);

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
        const data = await generateBlogPostData(genai, entry);

        const { error } = await supabase.from("blog_posts").upsert(
          {
            title_en: entry.title,
            title_my: data.title_my,
            slug,
            excerpt_en: data.excerpt_en,
            excerpt_my: data.excerpt_my,
            content_en: data.content_en,
            content_my: data.content_my,
            tags: data.tags,
            status: "published",
            published_at: publishedAt.toISOString(),
            author_id: null,
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

    // 3-second delay between posts to avoid rate limits
    if (i < BLOG_POSTS.length - 1) {
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
