#!/usr/bin/env npx tsx
/**
 * Generate verse embeddings (Gemini) for RAG
 * ==========================================
 *
 * Stores 768-d `gemini-embedding-001` vectors in `verse_embeddings`.
 * Idempotent: verses that already have an embedding are skipped.
 *
 * Usage:
 *   npx tsx scripts/generate-embeddings.ts --estimate          # free: token + cost estimate only
 *   npx tsx scripts/generate-embeddings.ts --limit 1000        # paid: first 1,000 missing verses
 *   npx tsx scripts/generate-embeddings.ts --only judson       # one translation
 *   npx tsx scripts/generate-embeddings.ts --max-usd 1.50      # stop before spending more (default 1.50)
 *
 * Fixes over the first version (docs/research/ai-stack-audit-2026-09.md):
 * - pages through all verses (PostgREST returns at most 1,000 rows per request)
 * - strips U+200B (zero-width space) from Burmese text before embedding
 * - uses the Bible's own book names (Burmese for Burmese Bibles)
 * - taskType RETRIEVAL_DOCUMENT (queries use RETRIEVAL_QUERY)
 * - retries with backoff; stops at --max-usd; reports measured tokens + cost
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 100; // max texts per embed request
const PAGE = 1000; // PostgREST max rows
// Worst-case price per 1M input tokens (Gemini Embedding 2 is $0.20; 001 was $0.15).
const USD_PER_M_TOKENS = 0.2;
// Tokens are counted with the chat model's tokenizer (free); pad for any difference.
const COUNT_MODEL = "gemini-3.1-flash-lite";

async function loadEnv(): Promise<void> {
  const { readFileSync, existsSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  for (const f of [".env.local", ".env"]) {
    const p = resolve(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf-8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      const k = t.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
    }
    return;
  }
}

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

interface VerseRow {
  id: string;
  text: string;
}

const ZWSP = /​/g;

/** Every row of a query, 1,000 at a time. */
async function all<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** Missing verses with the text to embed: "<book> c:v — text" in the Bible's own language. */
async function versesToEmbed(sb: SupabaseClient, only?: string): Promise<{ id: string; input: string }[]> {
  const translations = await all<{ id: string; code: string; language: string }>((a, b) =>
    sb.from("translations").select("id, code, language").order("code").range(a, b),
  );
  const picked = translations.filter((t) => !only || t.code === only);
  if (only && picked.length === 0) throw new Error(`No translation with code ${only}`);

  const have = new Set(
    (await all<{ verse_id: string }>((a, b) => sb.from("verse_embeddings").select("verse_id").order("verse_id").range(a, b))).map(
      (e) => e.verse_id,
    ),
  );

  const out: { id: string; input: string }[] = [];
  for (const t of picked) {
    const books = await all<{ id: string; book_number: number; name_en: string; name_my: string | null }>((a, b) =>
      sb.from("books").select("id, book_number, name_en, name_my").eq("translation_id", t.id).order("book_number").range(a, b),
    );
    for (const book of books) {
      const name = ((t.language === "my" ? book.name_my : null) ?? book.name_en).replace(ZWSP, "");
      const verses = await all<VerseRow & { chapter_number: number; verse_number: number }>((a, b) =>
        sb
          .from("verses")
          .select("id, text, chapter_number, verse_number")
          .eq("book_id", book.id)
          .order("chapter_number")
          .order("verse_number")
          .range(a, b),
      );
      for (const v of verses) {
        // Empty = joined into an earlier verse (e.g. Judson John 3:36); nothing to embed.
        if (have.has(v.id) || !v.text.trim()) continue;
        out.push({ id: v.id, input: `${name} ${v.chapter_number}:${v.verse_number} — ${v.text.replace(ZWSP, "").trim()}` });
      }
    }
    console.log(`  ${t.code}: ${out.length} verses queued so far`);
  }
  return out;
}

async function countTokens(ai: GoogleGenAI, texts: string[]): Promise<number> {
  const r = await ai.models.countTokens({ model: COUNT_MODEL, contents: texts.join("\n") });
  return r.totalTokens ?? 0;
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const retryable = /429|500|502|503|504|RESOURCE_EXHAUSTED|UNAVAILABLE|fetch failed/i.test(msg);
      if (!retryable || attempt >= 3) throw new Error(`${label}: ${msg}`);
      const wait = 2000 * attempt * attempt;
      console.warn(`  ${label} failed (${msg.slice(0, 80)}), retry ${attempt} in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

function args() {
  const a = process.argv.slice(2);
  const val = (flag: string) => {
    const i = a.indexOf(flag);
    return i >= 0 ? a[i + 1] : undefined;
  };
  return {
    only: val("--only")?.toLowerCase(),
    limit: val("--limit") ? Number(val("--limit")) : undefined,
    maxUsd: val("--max-usd") ? Number(val("--max-usd")) : 1.5,
    estimate: a.includes("--estimate"),
  };
}

async function main() {
  const { only, limit, maxUsd, estimate } = args();
  await loadEnv();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const ai = new GoogleGenAI({ apiKey });
  const sb = getSupabase();

  console.log("=== Verse embeddings ===");
  let queue = await versesToEmbed(sb, only);
  if (limit) queue = queue.slice(0, limit);
  console.log(`To embed: ${queue.length} verses`);
  if (queue.length === 0) return;

  if (estimate) {
    // Free: count tokens on a spread-out sample and extrapolate.
    const step = Math.max(1, Math.floor(queue.length / 600));
    const sample = queue.filter((_, i) => i % step === 0).map((q) => q.input);
    const tokens = await countTokens(ai, sample);
    const perVerse = tokens / sample.length;
    const total = perVerse * queue.length;
    console.log(
      `Estimate: ~${Math.round(perVerse)} tokens/verse × ${queue.length} = ~${(total / 1e6).toFixed(2)}M tokens → ` +
        `$${((total / 1e6) * USD_PER_M_TOKENS).toFixed(3)} (at $${USD_PER_M_TOKENS}/1M, worst case). ` +
        `+30% tokenizer margin: $${((total * 1.3) / 1e6 * USD_PER_M_TOKENS).toFixed(3)}`,
    );
    return;
  }

  let tokens = 0;
  let done = 0;
  const started = Date.now();
  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE);
    const batchTokens = await withRetry(() => countTokens(ai, batch.map((b) => b.input)), "countTokens");
    if (((tokens + batchTokens) / 1e6) * USD_PER_M_TOKENS > maxUsd) {
      console.log(`Stopping: next batch would pass --max-usd $${maxUsd}.`);
      break;
    }
    const res = await withRetry(
      () =>
        ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: batch.map((b) => b.input),
          config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_DOCUMENT" },
        }),
      `embed batch ${i}`,
    );
    const vectors = res.embeddings ?? [];
    if (vectors.length !== batch.length) throw new Error(`Batch ${i}: got ${vectors.length} vectors for ${batch.length} verses`);
    const { error } = await sb.from("verse_embeddings").upsert(
      batch.map((b, k) => ({ verse_id: b.id, embedding: JSON.stringify(vectors[k].values), model: EMBEDDING_MODEL })),
      { onConflict: "verse_id" },
    );
    if (error) throw new Error(`Batch ${i} insert: ${error.message}`);
    tokens += batchTokens;
    done += batch.length;
    if ((i / BATCH_SIZE) % 20 === 0 || i + BATCH_SIZE >= queue.length) {
      console.log(`  ${done}/${queue.length} · ${(tokens / 1e6).toFixed(3)}M tokens · $${((tokens / 1e6) * USD_PER_M_TOKENS).toFixed(4)}`);
    }
  }
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`Done: ${done} verses, ${tokens} tokens, ~$${((tokens / 1e6) * USD_PER_M_TOKENS).toFixed(4)} (worst-case price), ${secs}s`);
}

main().catch((e) => {
  console.error("Fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
