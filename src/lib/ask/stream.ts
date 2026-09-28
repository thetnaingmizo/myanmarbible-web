"use client";

import { createClient } from "@/lib/supabase/client";

// Client for the shared `ai-chat` edge function (Server-Sent Events).
// Events: meta {verses, remaining, conversationId} · delta {text} ·
// done {text, cited, stopped} · reference {book, chapter, verse} ·
// crisis {message} · error {code}. Errors before streaming come back as JSON.

export type ChatVerse = { n: number; verseId: string; book: number; chapter: number; verse: number; label: string; text: string };
export type AskError = "unauthorized" | "daily_limit" | "global_cap" | "ai_disabled" | "generation_failed" | "server_error" | "bad_request";

export type ChatHandlers = {
  onMeta?: (m: { verses: ChatVerse[]; remaining: number | null; conversationId: string }) => void;
  onDelta?: (text: string) => void;
  onDone?: (d: { text: string; cited: number[]; stopped?: boolean }) => void;
  onReference?: (r: { book: number; chapter: number; verse?: number }) => void;
  onCrisis?: (message: string) => void;
  onError?: (code: AskError) => void;
};

const KNOWN: AskError[] = ["unauthorized", "daily_limit", "global_cap", "ai_disabled", "generation_failed", "server_error", "bad_request"];
const norm = (code: unknown): AskError =>
  code === "not_signed_in" ? "unauthorized" : KNOWN.includes(code as AskError) ? (code as AskError) : "server_error";

async function authHeaders() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    apikey: (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    "Content-Type": "application/json",
  };
}

const endpoint = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`;

/** Streams one answer. Resolves when the stream ends; abort with the signal. */
export async function askStream(
  body: { message: string; translationId: string; lang: "my" | "en"; conversationId?: string | null },
  h: ChatHandlers,
  signal?: AbortSignal
) {
  const headers = await authHeaders();
  if (!headers) return h.onError?.("unauthorized");
  let res: Response;
  try {
    res = await fetch(endpoint(), { method: "POST", headers, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name !== "AbortError") h.onError?.("server_error");
    return;
  }
  if (!res.headers.get("content-type")?.includes("text/event-stream")) {
    const j = await res.json().catch(() => ({}));
    return h.onError?.(norm(j.error));
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const event = /^event: (.+)$/m.exec(chunk)?.[1];
      const raw = /^data: (.*)$/m.exec(chunk)?.[1];
      if (!event || raw == null) continue;
      const data = JSON.parse(raw);
      if (event === "meta") h.onMeta?.(data);
      else if (event === "delta") h.onDelta?.(data.text);
      else if (event === "done") h.onDone?.(data);
      else if (event === "reference") h.onReference?.(data);
      else if (event === "crisis") h.onCrisis?.(data.message);
      else if (event === "error") h.onError?.(norm(data.code));
    }
  }
}

/** Topic search by meaning (free; generous daily limit). */
export async function topicSearch(message: string, translationId: string, lang: "my" | "en") {
  const headers = await authHeaders();
  if (!headers) return { error: "unauthorized" as AskError, verses: [] };
  try {
    const res = await fetch(endpoint(), {
      method: "POST",
      headers,
      body: JSON.stringify({ message, translationId, lang, mode: "verses" }),
    });
    if (res.headers.get("content-type")?.includes("text/event-stream")) {
      // A typed reference or crisis message comes back as an event even here.
      const text = await res.text();
      const event = /^event: (.+)$/m.exec(text)?.[1];
      const raw = /^data: (.*)$/m.exec(text)?.[1];
      return { event, data: raw ? JSON.parse(raw) : null, verses: [] };
    }
    const j = await res.json();
    if (!res.ok) return { error: norm(j.error), verses: [] };
    return { verses: (j.verses ?? []) as { book: number; chapter: number; verse: number; similarity: number }[] };
  } catch {
    return { error: "server_error" as AskError, verses: [] };
  }
}

/** "[V2]" numbers cited in text, in first-seen order (matches the function's citedIndexes). */
export function citedOrder(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\[V(\d{1,2})\]/g)) {
    const n = Number(m[1]);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}
