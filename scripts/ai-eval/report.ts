#!/usr/bin/env npx tsx
/**
 * Build a side-by-side HTML report from a burmese-quality run.
 *
 * Usage: npx tsx scripts/ai-eval/report.ts scripts/ai-eval/out/run-<stamp>.json
 * Writes <run>.html next to it. No API calls.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const runPath = process.argv[2];
if (!runPath) throw new Error("Pass the run JSON path");

type Checks = { citedCount: number; invalidCitations: number[]; burmeseRatio: number; longestVerbatim: number; runaway: boolean; praysForUser: boolean };
type Row = {
  model: string; caseId: string; ok: boolean; text?: string; error?: string; finishReason?: string;
  outputTokens?: number; thoughtTokens?: number; costUsd?: number; latencyMs?: number; checks?: Checks;
};
type Run = {
  spent: number; budget: number; rows: Row[];
  tokenRatio?: { model: string; bcl: number; bclNoZwsp: number; mizo: number; kjv: number } | null;
};

const run = JSON.parse(readFileSync(runPath, "utf8")) as Run;
const cases = JSON.parse(readFileSync(resolve(HERE, "cases.json"), "utf8")) as { id: string; kind: string; q: string; target?: string }[];
const models: string[] = [...new Set<string>(run.rows.map((r) => r.model))];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const flags = (r: Row) => {
  if (!r.ok) return `<span class="bad">error</span>`;
  const c = r.checks!;
  const out: string[] = [];
  if (r.finishReason !== "STOP") out.push(`<span class="bad">${r.finishReason}</span>`);
  if (c.invalidCitations.length) out.push(`<span class="bad">invalid cites ${c.invalidCitations.join(",")}</span>`);
  if (c.longestVerbatim >= 40) out.push(`<span class="warn">copied ${c.longestVerbatim} chars</span>`);
  if (c.burmeseRatio < 0.8) out.push(`<span class="warn">Burmese ${c.burmeseRatio}</span>`);
  if (c.runaway) out.push(`<span class="bad">repeating</span>`);
  if (c.praysForUser) out.push(`<span class="bad">prays for user</span>`);
  out.push(`<span>${c.citedCount} cited · ${r.outputTokens}+${r.thoughtTokens} tok · $${(r.costUsd ?? 0).toFixed(5)} · ${((r.latencyMs ?? 0) / 1000).toFixed(1)}s</span>`);
  return out.join(" ");
};

const totals = models.map((m) => {
  const rs = run.rows.filter((r) => r.model === m && r.ok);
  const sum = (k: "costUsd" | "outputTokens" | "latencyMs") => rs.reduce((a, r) => a + (r[k] ?? 0), 0);
  return { m, n: rs.length, cost: sum("costUsd"), avgOut: Math.round(sum("outputTokens") / (rs.length || 1)), avgLat: sum("latencyMs") / (rs.length || 1) / 1000,
    invalid: rs.filter((r) => r.checks?.invalidCitations.length).length, copied: rs.filter((r) => (r.checks?.longestVerbatim ?? 0) >= 40).length };
});

const html = `<!doctype html><html lang="my"><head><meta charset="utf-8"><title>Burmese AI quality run</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&family=Noto+Sans+Myanmar:wght@400;600&display=swap">
<style>
:root{--paper:#FBF8F3;--ink:#1F1815;--ink2:#5B4F48;--line:#E4DACD;--maroon:#882C2C;--bad:#B3261E;--warn:#8A5A0B}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--paper:#15110F;--ink:#F2EAE2;--ink2:#C9BDB3;--line:#3A2F2A;--maroon:#E8A396;--bad:#F2B8B5;--warn:#E7C77F}}
body{margin:0;background:var(--paper);color:var(--ink);font-family:Figtree,"Noto Sans Myanmar",system-ui,sans-serif;padding:24px 16px}
main{max-width:1500px;margin:0 auto}h1{font-size:26px;margin:0 0 8px}p{color:var(--ink2)}
table{border-collapse:collapse;width:100%;margin:12px 0 28px}td,th{border:1px solid var(--line);padding:10px;vertical-align:top;text-align:left;font-size:14px}
.case{margin:28px 0 8px;font-size:18px;color:var(--maroon)}.q{font-family:"Noto Sans Myanmar";font-size:15px;line-height:1.8}
.grid{display:grid;grid-template-columns:repeat(${Math.max(models.length, 1)},minmax(0,1fr));gap:12px}
.cell{border:1px solid var(--line);border-radius:12px;padding:12px;overflow-wrap:anywhere}.cell h3{margin:0 0 6px;font-size:13px}
.ans{white-space:pre-wrap;font-family:"Noto Sans Myanmar";font-size:15px;line-height:1.85}.meta{font-size:12px;color:var(--ink2);margin-top:8px;display:flex;flex-wrap:wrap;gap:8px}
.bad{color:var(--bad);font-weight:700}.warn{color:var(--warn);font-weight:700}
@media (max-width:800px){.grid{grid-template-columns:1fr}}
</style></head><body><main>
<h1>Burmese AI quality run</h1>
<p>Spent $${run.spent.toFixed(4)} of $${run.budget} budget. Rate each answer for Burmese naturalness, faithfulness to the cited verses, and theological balance (1–5).</p>
${run.tokenRatio ? `<p>Tokens for John 3:16 (${run.tokenRatio.model}): Burmese ${run.tokenRatio.bcl} · without zero-width spaces ${run.tokenRatio.bclNoZwsp} · Mizo ${run.tokenRatio.mizo} · KJV ${run.tokenRatio.kjv}</p>` : ""}
<table><tr><th>Model</th><th>Answers</th><th>Cost</th><th>Avg output tokens</th><th>Avg latency</th><th>Invalid citations</th><th>Copied verse text</th></tr>
${totals.map((t) => `<tr><td>${t.m}</td><td>${t.n}</td><td>$${t.cost.toFixed(4)}</td><td>${t.avgOut}</td><td>${t.avgLat.toFixed(1)}s</td><td>${t.invalid}</td><td>${t.copied}</td></tr>`).join("")}</table>
${cases.filter((c) => run.rows.some((r) => r.caseId === c.id)).map((c) => `
<h2 class="case">${esc(c.id)} · ${esc(c.kind)}</h2><div class="q">${esc(c.target ? c.target + " — " : "")}${esc(c.q)}</div>
<div class="grid">${models.map((m) => {
  const r = run.rows.find((x) => x.caseId === c.id && x.model === m);
  if (!r) return `<div class="cell"><h3>${m}</h3>not run</div>`;
  return `<div class="cell"><h3>${m}</h3><div class="ans">${esc((r.ok ? r.text : r.error) ?? "")}</div><div class="meta">${flags(r)}</div></div>`;
}).join("")}</div>`).join("")}
</main></body></html>`;

const outPath = runPath.replace(/\.json$/, ".html");
writeFileSync(outPath, html);
console.log(outPath);
