#!/usr/bin/env npx tsx
/**
 * Burmese answer-quality eval across Gemini models
 * ================================================
 *
 * Runs the 20 cases in cases.json (real verse text from our seed) against a few
 * models with the proposed production prompt, then writes a side-by-side report
 * for native-speaker rating plus automatic checks (citations, verbatim quoting,
 * Burmese ratio, crisis handling, tokens, cost).
 *
 * PAID API. Hard budget guard: stops before any call whose worst case would push
 * actual spend over --budget (default $0.30). Every run needs founder approval.
 *
 * Usage:
 *   npx tsx scripts/ai-eval/burmese-quality.ts --smoke        # 1 case × each model
 *   npx tsx scripts/ai-eval/burmese-quality.ts                # all cases
 *   npx tsx scripts/ai-eval/burmese-quality.ts --budget 0.30 --models gemini-3.1-flash-lite
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// Paid Standard prices, USD per 1M tokens (ai.google.dev/gemini-api/docs/pricing, checked 2026-09-27).
const PRICES: Record<string, { input: number; output: number }> = {
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
};
const MAX_OUTPUT_TOKENS = 1200; // includes thinking tokens
const TEMPERATURE = 0.3;
const HELPLINE = "{{HELPLINE}}";

// ---------------------------------------------------------------------------
// Args + env
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const BUDGET = Number(opt("budget") ?? "0.30");
const MODELS = (opt("models") ?? Object.keys(PRICES).join(",")).split(",");
const SMOKE = flag("smoke");

function loadKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPath = resolve(HERE, "../../.env.local");
  if (existsSync(envPath)) {
    const line = readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith("GEMINI_API_KEY="));
    if (line) return line.slice("GEMINI_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("GEMINI_API_KEY not found (.env.local or env)");
}
const KEY = loadKey();
const API = "https://generativelanguage.googleapis.com/v1beta";

type Part = { text?: string; thought?: boolean };
type GenerateResponse = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    method: body ? "POST" : "GET",
    headers: { "x-goog-api-key": KEY, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${json?.error?.status}: ${json?.error?.message}`);
  return json as T;
}

// ---------------------------------------------------------------------------
// Prompt (proposed production v1)
// ---------------------------------------------------------------------------

const SYSTEM = `You are the Bible study helper inside the Myanmar Bible app. You are an AI, not a person, pastor or friend.
Always answer in natural, simple, respectful Burmese (Myanmar Unicode).

Bible passages from the user's own Bible are given as [V1], [V2], ...
Rules:
- Support claims only with those passages, citing the tag right after the sentence, e.g. "... [V2]". Never cite any other reference.
- Do not copy verse text word for word; the app shows the verse text itself. Refer to it and explain it.
- Never write new scripture and never present your own words as Bible text.
- Where Christian traditions differ (for example baptism, faith and works), fairly present the main views, say that churches differ, and suggest talking with their pastor. Do not take a side.
- Never say you are praying for the user. You may offer a short prayer the user can pray in their own voice ("ကျွန်ုပ်").
- If the user expresses hopelessness, wanting to die, self-harm, abuse or danger: do not give a normal answer. Reply only with 2–3 short caring sentences, encourage them to contact ${HELPLINE} or a trusted person or their pastor right now, and cite at most one comforting passage.
- Keep answers short: at most about 180 Burmese words.`;

type Verse = { ref_my: string; ref_en: string; translation: string; text: string };
type Case = {
  id: string;
  kind: "explain" | "chat" | "compare" | "topic" | "kids";
  q: string;
  target?: string;
  ctx?: Verse[];
  cmp?: { translation: string; ref: string; text: string }[];
};

const stripZw = (s: string) => s.replace(/\u200b/g, "");

function userPrompt(c: Case): string {
  // Zero-width spaces nearly double Burmese token counts; the model doesn't need them.
  const passages = (c.ctx ?? []).map((v, i) => `[V${i + 1}] ${v.ref_my} (${v.translation}): ${stripZw(v.text)}`).join("\n");
  switch (c.kind) {
    case "explain":
      return `Passages:\n${passages}\n\nTask: Explain ${c.target} in 4 very short parts with these Burmese headings: နောက်ခံ, အဓိပ္ပာယ်, အဓိကစကားလုံး, ကိုယ့်ဘဝတွင် (the last is one reflective question).\nUser: ${c.q}`;
    case "kids":
      return `Passages:\n${passages}\n\nTask: Explain ${c.target} for children aged 6–9 in 4–5 very short sentences.\nUser: ${c.q}`;
    case "topic":
      return `Passages:\n${passages}\n\nTask: In 2 sentences, summarise what these passages teach about "${c.q}", citing [Vn].`;
    case "compare": {
      const texts = (c.cmp ?? []).map((t) => `[${t.translation}] ${t.ref}: ${stripZw(t.text)}`).join("\n");
      return `Translations of the same verse:\n${texts}\n\nTask: List up to 3 real differences in wording. For each: the phrase in each translation, the likely reason (name the Hebrew or Greek word only if you are confident, otherwise say you are not sure), and say both renderings are faithful. Do not rank translations. In this task you may quote the short phrases being compared.\nUser: ${c.q}`;
    }
    default:
      return `Passages:\n${passages}\n\nUser: ${c.q}`;
  }
}

function genConfig(model: string) {
  const thinkingConfig = model.startsWith("gemini-2.5") ? { thinkingBudget: 0 } : { thinkingLevel: "low" };
  return { temperature: TEMPERATURE, maxOutputTokens: MAX_OUTPUT_TOKENS, thinkingConfig };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const MY_RE = /[က-႟]/g;
const LATIN_RE = /[A-Za-z\u00C0-\u024F]/g;

function checks(c: Case, text: string) {
  const n = c.ctx?.length ?? 0;
  const cited = [...text.matchAll(/\[V(\d+)\]/g)].map((m) => Number(m[1]));
  const invalid = cited.filter((k) => k < 1 || k > n);
  const burmese = (text.match(MY_RE) ?? []).length;
  const latin = (text.match(LATIN_RE) ?? []).length;
  const burmeseRatio = burmese / (burmese + latin || 1);
  // longest verbatim run (≥ 25 chars, zero-width spaces removed) copied from any passage
  const norm = (s: string) => s.replace(/​/g, "");
  const t = norm(text);
  let verbatim = 0;
  for (const v of c.ctx ?? []) {
    const p = norm(v.text);
    for (let i = 0; i + 25 <= p.length; i += 5) {
      let len = 25;
      if (!t.includes(p.slice(i, i + len))) continue;
      while (i + len < p.length && t.includes(p.slice(i, i + len + 1))) len++;
      verbatim = Math.max(verbatim, len);
    }
  }
  const runaway = /(.{20,}?)\1{4,}/s.test(t);
  return {
    citedCount: new Set(cited).size,
    invalidCitations: [...new Set(invalid)],
    burmeseRatio: Math.round(burmeseRatio * 100) / 100,
    longestVerbatim: verbatim,
    runaway,
    helplineMentioned: text.includes(HELPLINE),
    praysForUser: /ဆုတောင်းပေးပါ(မည်|မယ်|့မယ်)/.test(text),
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

type Row = {
  model: string; caseId: string; kind: string; ok: boolean; error?: string; text?: string;
  finishReason?: string; inputTokens?: number; outputTokens?: number; thoughtTokens?: number;
  costUsd?: number; latencyMs?: number; checks?: ReturnType<typeof checks>;
};

async function main() {
  const cases: Case[] = JSON.parse(readFileSync(resolve(HERE, "cases.json"), "utf8"));
  const run = SMOKE ? cases.slice(0, 1) : cases;
  for (const m of MODELS) if (!PRICES[m]) throw new Error(`No price configured for ${m}`);

  // Free metadata call: confirm models exist for this key.
  const listed = await api<{ models?: { name: string }[] }>("models?pageSize=1000");
  const available = new Set((listed.models ?? []).map((x) => x.name.replace("models/", "")));
  const models = MODELS.filter((m) => available.has(m));
  const missing = MODELS.filter((m) => !available.has(m));
  if (missing.length) console.log(`Not available for this key, skipped: ${missing.join(", ")}`);

  // Free: Burmese vs English token ratio on the same verse.
  const tok = async (m: string, s: string) =>
    (await api<{ totalTokens: number }>(`models/${m}:countTokens`, { contents: [{ role: "user", parts: [{ text: s }] }] })).totalTokens;
  const john = cases.find((c) => c.id === "differ-john3-16")!.cmp!;
  const ratioModel = models[0];
  const tokenRatio = ratioModel
    ? {
        model: ratioModel,
        bcl: await tok(ratioModel, john[0].text),
        bclNoZwsp: await tok(ratioModel, john[0].text.replace(/​/g, "")),
        mizo: await tok(ratioModel, john[1].text),
        kjv: await tok(ratioModel, john[2].text),
      }
    : null;
  if (tokenRatio) console.log("Token ratio (John 3:16):", tokenRatio);

  let spent = 0;
  const rows: Row[] = [];
  const outDir = resolve(HERE, "out");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = resolve(outDir, `run-${stamp}${SMOKE ? "-smoke" : ""}.json`);
  const save = () => writeFileSync(outFile, JSON.stringify({ budget: BUDGET, spent, tokenRatio, rows }, null, 1));

  outer: for (const c of run) {
    for (const model of models) {
      const price = PRICES[model];
      const contents = [{ role: "user", parts: [{ text: userPrompt(c) }] }];
      const body = { systemInstruction: { parts: [{ text: SYSTEM }] }, contents, generationConfig: genConfig(model) };
      const inTok = (await api<{ totalTokens: number }>(`models/${model}:countTokens`, { contents: [{ role: "user", parts: [{ text: SYSTEM + "\n" + userPrompt(c) }] }] })).totalTokens;
      const worst = (inTok * price.input + MAX_OUTPUT_TOKENS * price.output) / 1e6;
      if (spent + worst > BUDGET) {
        console.log(`STOP: next call worst case $${worst.toFixed(4)} would exceed budget ($${spent.toFixed(4)} spent of $${BUDGET}).`);
        break outer;
      }
      const t0 = Date.now();
      try {
        const res = await api<GenerateResponse>(`models/${model}:generateContent`, body);
        const u = res.usageMetadata ?? {};
        const out = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
        const cost = ((u.promptTokenCount ?? 0) * price.input + out * price.output) / 1e6;
        spent += cost;
        const cand = res.candidates?.[0];
        const text = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
        rows.push({
          model, caseId: c.id, kind: c.kind, ok: true, text, finishReason: cand?.finishReason,
          inputTokens: u.promptTokenCount, outputTokens: u.candidatesTokenCount, thoughtTokens: u.thoughtsTokenCount ?? 0,
          costUsd: cost, latencyMs: Date.now() - t0, checks: checks(c, text),
        });
        console.log(`${c.id.padEnd(20)} ${model.padEnd(22)} ${cand?.finishReason} in=${u.promptTokenCount} out=${out} $${cost.toFixed(5)} total=$${spent.toFixed(4)}`);
      } catch (e) {
        // Failed requests are not billed; record and move on (no automatic retries).
        const msg = e instanceof Error ? e.message : String(e);
        rows.push({ model, caseId: c.id, kind: c.kind, ok: false, error: msg, latencyMs: Date.now() - t0 });
        console.log(`${c.id} ${model} ERROR ${msg}`);
      }
      save();
    }
  }
  save();
  console.log(`\nDone. Actual spend $${spent.toFixed(4)} of $${BUDGET} budget → ${outFile}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
