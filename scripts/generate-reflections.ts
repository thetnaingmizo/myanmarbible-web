#!/usr/bin/env npx tsx
/**
 * Generate Today reflections (3.0 A11) for upcoming Verses of the Day
 * ===================================================================
 *
 * Writes drafts into `daily_reflections`; the app shows a reflection only
 * after an editor approves it (admin → AI reflections). Idempotent: verses
 * that already have a reflection in that language are skipped.
 *
 * The Verse of the Day list and rotation are read from the app
 * (../myanmarbible-app/lib/features/today/verse_of_the_day.dart), so both
 * always agree on which verse falls on which day.
 *
 * Usage:
 *   npx tsx scripts/generate-reflections.ts --days 14 --langs my,en --max-usd 0.06
 *   npx tsx scripts/generate-reflections.ts --days 1 --langs my --limit 2        # cheap first test
 *   npx tsx scripts/generate-reflections.ts --days 14 --dry-run                  # free: list the verses only
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { citedIndexes, isRunaway, stripInvalidCitations } from "../supabase/functions/_shared/citations";

const MODEL = "gemini-3.1-flash-lite";
const PRICE_IN = 0.25; // USD per 1M tokens; output includes thinking
const PRICE_OUT = 1.5;
const PROMPT_VERSION = 1;
const BIBLE = { my: "judson", en: "kjv" } as const;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

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

type Ref = { book: number; chapter: number; verse: number };

/** The app's Verse of the Day list, in order. */
function votdList(): Ref[] {
  const dart = readFileSync(
    arg("votd", resolve(root, "../myanmarbible-app/lib/features/today/verse_of_the_day.dart"))!,
    "utf-8",
  );
  const list = [...dart.matchAll(/\(book: (\d+), chapter: (\d+), verse: (\d+)\)/g)].map((m) => ({
    book: +m[1],
    chapter: +m[2],
    verse: +m[3],
  }));
  if (list.length < 30) throw new Error(`Verse of the Day list not found (got ${list.length})`);
  return list;
}

/** Same rotation as verseOfTheDay() in the app, for a Myanmar calendar day. */
function verseFor(list: Ref[], day: Date): Ref {
  const days = Math.round((Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) - Date.UTC(2026, 0, 1)) / 864e5);
  return list[((days % list.length) + list.length) % list.length];
}

const SYSTEM = `You write the short daily reflection under the Verse of the Day in the Myanmar Bible app.
- NEVER quote, paraphrase at length, or invent Scripture. The app shows the real verse text; you only reflect on it.
- Cite the verses you rely on inline exactly like "[V2]", only from the list given.
- Mainstream, denomination-neutral Christian understanding. Warm, simple, honest; no clichés, no preaching at the reader.
- You are a tool, not a person: no name, no persona, never say you pray for the reader.
- Plain text only: no markdown.
Fields:
- title: one short line (at most 10 words) naming the main thought.
- body: 2–3 short sentences on what the verse means for daily life, with citations.
- reflect: one gentle question for the reader to think about today.
- prayer: 1–2 sentences the READER can pray, in the first person ("I", "me"), ending with "Amen".`;

const LANG = {
  my: `Write in Myanmar (Burmese): natural, everyday Unicode Burmese. End the prayer with "အာမင်။"`,
  en: "Write in English.",
};

async function main() {
  loadEnv();
  const days = Number(arg("days", "14"));
  const langs = (arg("langs", "my,en") ?? "").split(",").filter((l): l is "my" | "en" => l === "my" || l === "en");
  const limit = Number(arg("limit", "1000"));
  const maxUsd = Number(arg("max-usd", "0.06"));
  const dryRun = process.argv.includes("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
  if (!/127\.0\.0\.1|localhost/.test(url) && !process.argv.includes("--remote")) {
    throw new Error(`Refusing to write to ${url} without --remote (local stack only by default)`);
  }
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const list = votdList();
  // Myanmar calendar day (UTC+6:30), like the app on a phone in Myanmar.
  const today = new Date(Date.now() + 6.5 * 3600e3);
  const queue: { day: string; ref: Ref; lang: "my" | "en" }[] = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(today.getTime() + d * 864e5);
    const ref = verseFor(list, day);
    for (const lang of langs) queue.push({ day: day.toISOString().slice(0, 10), ref, lang });
  }

  const ai = dryRun ? null : new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  if (!dryRun && !process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  let spent = 0;
  let made = 0;

  for (const { day, ref, lang } of queue) {
    if (made >= limit) break;
    const { data: existing } = await db
      .from("daily_reflections")
      .select("id")
      .match({ book_number: ref.book, chapter_number: ref.chapter, verse_number: ref.verse, lang })
      .maybeSingle();
    const label = `${day} ${ref.book} ${ref.chapter}:${ref.verse} ${lang}`;
    if (existing) {
      console.log(`  ${label} · exists`);
      continue;
    }
    if (dryRun) {
      console.log(`  ${label} · would generate`);
      continue;
    }
    if (spent >= maxUsd) {
      console.log(`Stopping: spent $${spent.toFixed(4)} ≥ --max-usd ${maxUsd}`);
      break;
    }

    const { data: t } = await db.from("translations").select("id").eq("code", BIBLE[lang]).single();
    const { data: books } = await db.from("books").select("id, book_number, name_en, name_my").eq("translation_id", t!.id);
    const name = (n: number) => {
      const b = books!.find((x) => x.book_number === n);
      return ((lang === "my" ? b?.name_my : null) ?? b?.name_en ?? `${n}`).replace(/​/g, "");
    };
    const bookId = books!.find((b) => b.book_number === ref.book)!.id;
    const { data: target } = await db
      .from("verses")
      .select("id, text")
      .match({ book_id: bookId, chapter_number: ref.chapter, verse_number: ref.verse })
      .single();
    // Related verses by meaning, from the verse's stored embedding (no embedding call).
    const { data: emb } = await db.from("verse_embeddings").select("embedding").eq("verse_id", target!.id).maybeSingle();
    const { data: related } = emb
      ? await db.rpc("match_verses", {
          query_embedding: emb.embedding,
          match_threshold: 0.55,
          match_count: 6,
          filter_translation_id: t!.id,
        })
      : { data: [] };
    const others = (related ?? []).filter((r: { verse_id: string }) => r.verse_id !== target!.id).slice(0, 5);
    const numbered = [
      { ...ref, text: target!.text as string },
      ...others.map((r: { book_id: string; chapter_number: number; verse_number: number; text: string }) => ({
        book: books!.find((b) => b.id === r.book_id)!.book_number,
        chapter: r.chapter_number,
        verse: r.verse_number,
        text: r.text,
      })),
    ].map((v, i) => ({ ...v, n: i + 1 }));
    const context = numbered
      .map((v) => `[V${v.n}] ${name(v.book)} ${v.chapter}:${v.verse}: ${v.text.replace(/​/g, "")}`)
      .join("\n");

    const res = await ai!.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: `Today's verse is [V1].\n\nVerses you may cite:\n${context}` }] }],
      config: {
        systemInstruction: `${SYSTEM}\n${LANG[lang]}`,
        maxOutputTokens: lang === "my" ? 1400 : 800,
        temperature: 0.5,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            body: { type: Type.STRING },
            reflect: { type: Type.STRING },
            prayer: { type: Type.STRING },
          },
          required: ["title", "body", "reflect", "prayer"],
        },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    const u = res.usageMetadata;
    const input = u?.promptTokenCount ?? 0;
    const output = (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0);
    const cost = (input * PRICE_IN + output * PRICE_OUT) / 1e6;
    spent += cost;
    await db.from("ai_usage").insert({ kind: "reflection", model: MODEL, input_tokens: input, output_tokens: output, cost_usd: cost });

    let out: Record<string, string> | null = null;
    try {
      out = JSON.parse(res.text ?? "");
    } catch {
      out = null;
    }
    if (!out?.body || isRunaway(res.text ?? "")) {
      console.log(`  ${label} · FAILED (unparseable), $${cost.toFixed(5)}`);
      continue;
    }
    const clean = (s: string) => stripInvalidCitations(s ?? "", numbered.length).trim();
    const fields = { title: clean(out.title), body: clean(out.body), reflect: clean(out.reflect), prayer: clean(out.prayer) };
    const content = {
      ...fields,
      verses: numbered.map((v) => ({ n: v.n, book: v.book, chapter: v.chapter, verse: v.verse })),
      cited: citedIndexes(`${fields.title} ${fields.body} ${fields.reflect}`, numbered.length),
    };
    const { error } = await db.from("daily_reflections").insert({
      book_number: ref.book,
      chapter_number: ref.chapter,
      verse_number: ref.verse,
      lang,
      content,
      model: MODEL,
      prompt_version: PROMPT_VERSION,
    });
    if (error) throw error;
    made++;
    console.log(`  ${label} · ${input} in / ${output} out · $${cost.toFixed(5)} · “${fields.title}”`);
  }
  console.log(`Done: ${made} reflections, ~$${spent.toFixed(4)}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
