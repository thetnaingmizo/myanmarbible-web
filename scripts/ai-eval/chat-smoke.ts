#!/usr/bin/env npx tsx
/**
 * Paid smoke test for the local `ai-chat` edge function (3 questions + a
 * 4th that must be refused by the guest quota). ~$0.01. Local stack only.
 *
 *   npx tsx scripts/ai-eval/chat-smoke.ts <publishable-key> <translation-id>
 */
const API = "http://127.0.0.1:54321";
const [key, translationId] = process.argv.slice(2);
if (!key || !translationId) throw new Error("usage: chat-smoke.ts <publishable-key> <translation-id>");
if (!API.includes("127.0.0.1")) throw new Error("local only");

const QUESTIONS: { message: string; lang: "my" | "en" }[] = [
  { message: "စိုးရိမ်ပူပန်နေတဲ့အခါ ကျမ်းစာက ဘာပြောလဲ", lang: "my" },
  { message: "ဘုရားသခင်သည် လူသားကို အဘယ်ကြောင့် ချစ်သနည်း", lang: "my" },
  { message: "Should Christians be baptized as babies or as adults?", lang: "en" },
];

async function guestToken(): Promise<string> {
  const r = await fetch(`${API}/auth/v1/signup`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: "{}" });
  return (await r.json()).access_token;
}

async function ask(jwt: string, message: string, lang: string) {
  const r = await fetch(`${API}/functions/v1/ai-chat`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message, translationId, lang }),
  });
  if (!r.headers.get("content-type")?.includes("event-stream")) return { status: r.status, body: await r.text() };
  const events: Record<string, unknown[]> = {};
  for (const block of (await r.text()).split("\n\n")) {
    const ev = /^event: (.+)$/m.exec(block)?.[1];
    const data = /^data: (.+)$/m.exec(block)?.[1];
    if (ev && data) (events[ev] ??= []).push(JSON.parse(data));
  }
  return { status: r.status, events };
}

async function main() {
  const jwt = await guestToken();
  let total = 0;
  for (const q of QUESTIONS) {
    const res = await ask(jwt, q.message, q.lang);
    if (!("events" in res)) {
      console.log(`\n### ${q.message}\n  HTTP ${res.status} ${res.body}`);
      continue;
    }
    const meta = res.events.meta?.[0] as { verses: { n: number; label: string }[]; remaining: number };
    const done = res.events.done?.[0] as { text: string; cited: number[]; stopped: boolean; usage: { input: number; output: number; costUsd: number } };
    if (!done) {
      console.log(`\n### ${q.message}\n  events: ${JSON.stringify(res.events)}`);
      continue;
    }
    total += done.usage.costUsd;
    const bad = done.cited.filter((n) => n < 1 || n > meta.verses.length);
    console.log(`\n### ${q.message}  (quota left ${meta.remaining})`);
    console.log(`  verses: ${meta.verses.map((v) => `[V${v.n}] ${v.label}`).join(" · ")}`);
    console.log(`  cited: ${done.cited.map((n) => `V${n}`).join(", ") || "none"}${bad.length ? `  INVALID: ${bad}` : ""}${done.stopped ? "  (stopped: runaway)" : ""}`);
    console.log(`  usage: in ${done.usage.input} / out ${done.usage.output} tokens · $${done.usage.costUsd}`);
    console.log(`  answer:\n${done.text.split("\n").map((l) => `    ${l}`).join("\n")}`);
  }
  const fourth = await ask(jwt, "What is grace?", "en");
  console.log(`\n### 4th guest question → ${"events" in fourth ? "STREAMED (quota not enforced!)" : `HTTP ${fourth.status} ${fourth.body}`}`);
  console.log(`\nTotal measured cost: $${total.toFixed(5)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
