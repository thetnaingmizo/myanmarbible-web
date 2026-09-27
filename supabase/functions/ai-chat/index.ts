// AI Bible assistant for the app and the website (Server-Sent Events).
//
// POST { message, translationId, lang: "my" | "en", conversationId?, mode?, tradition? }
// mode "verses": semantic verse search only (topic results) — no answer, no quota.
// with the user's JWT (guests included).
//
// Order of work, cheapest first:
//   1. a typed reference ("ယော ၃:၁၆")  → `reference` event, no AI, no quota
//   2. someone who may be in danger     → `crisis` event (fixed text), no AI, no quota
//   3. take one quota turn (per-user daily limit + global daily $ cap)
//   4. retrieve up to 8 verses of the reader's Bible (vector, keyword fallback)
//   5. stream the answer; the model may only POINT to verses as [V1]..[V8],
//      never quote or invent Scripture; unknown citations are removed
//   6. log real tokens + cost, save the conversation
//
// Events: meta {verses, remaining, conversationId} · delta {text} ·
//         done {text, cited, usage} · reference {...} · crisis {message} · error {code}
import { GoogleGenAI, HarmBlockThreshold, HarmCategory, ThinkingLevel } from "npm:@google/genai@1";
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";
import { citedIndexes, isRunaway, stripInvalidCitations } from "../_shared/citations.ts";
import { ReferenceParser } from "../_shared/reference.ts";
import { crisisMessage, isCrisis } from "../_shared/safety.ts";

const CHAT_MODEL = "gemini-3.1-flash-lite";
const EMBEDDING_MODEL = "gemini-embedding-001";
// USD per 1M tokens (paid tier). Output includes thinking tokens.
const PRICE_IN = 0.25;
const PRICE_OUT = 1.5;
const PRICE_EMBED = 0.2;
const MAX_MESSAGE = 1000;
const HISTORY = 6;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `You are the Bible study helper inside the Myanmar Bible app.

How you answer:
- Ground every point in the Bible verses given to you as [V1]..[V8]. Cite them inline exactly like "[V2]".
- NEVER quote, paraphrase at length, or invent Scripture. The app shows the real verse text from its own
  database; you only point to verses. Do not cite verses that are not in the list.
- If the verses given don't answer the question, say so briefly and answer only what you can support.
- Be humble and honest when unsure. Present mainstream Christian understanding; where churches differ
  (e.g. baptism, end times, spiritual gifts), say that churches differ and outline the main views fairly.
- You are a tool, not a person: no name, no persona, never say you pray for someone or have feelings.
- Pastoral questions: be gentle and practical, and encourage talking with a pastor or trusted believer.
- Keep answers short: 2–5 short paragraphs or a short list. Plain text, no headings, no tables.`;

// A15: the reader may say which church they belong to; answers then add
// that church's usual view where churches differ (still fair to others).
const TRADITIONS = {
  baptist: "Baptist",
  catholic: "Roman Catholic",
  anglican: "Anglican",
  methodist: "Methodist",
  presbyterian: "Presbyterian",
  pentecostal: "Pentecostal / Assemblies of God",
  adventist: "Seventh-day Adventist",
  lutheran: "Lutheran",
  evangelical: "Evangelical / non-denominational",
} as const;

const LANG = {
  my: "Always answer in Myanmar (Burmese), natural everyday Unicode Burmese. Keep book names in Burmese.",
  en: "Always answer in English.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!url || !publicKey || !dbUrl || !geminiKey) return json({ error: "server_misconfigured" }, 500);
  if (!jwt) return json({ error: "unauthorized" }, 401);

  // The user's own client: RLS and auth.uid() apply (quota is per user).
  const userDb = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: auth, error: authError } = await userDb.auth.getUser(jwt);
  const user = auth?.user;
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  let body: {
    message?: string;
    translationId?: string;
    lang?: string;
    conversationId?: string;
    mode?: string;
    tradition?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const message = (body.message ?? "").trim();
  const lang: "my" | "en" = body.lang === "en" ? "en" : "my";
  if (!message || message.length > MAX_MESSAGE || !body.translationId) return json({ error: "bad_request" }, 400);

  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  // Closed here unless the answer stream took ownership of the connection.
  let streaming = false;
  try {
    const books = await sql<{ book_number: number; chapter_count: number; name_en: string; name_my: string | null; abbreviation_en: string; abbreviation_my: string | null }[]>`
      select book_number, chapter_count, name_en, name_my, abbreviation_en, abbreviation_my
      from public.books where translation_id = ${body.translationId} order by book_number`;
    if (books.length === 0) return json({ error: "unknown_translation" }, 400);

    // 1. A reference is a jump, not a question.
    const parser = new ReferenceParser(
      books.map((b) => ({
        number: b.book_number,
        chapterCount: b.chapter_count,
        names: [b.name_en, b.name_my, b.abbreviation_en, b.abbreviation_my].filter((n): n is string => !!n),
      })),
    );
    const ref = parser.parse(message);
    if (ref) return sse(async (send) => send("reference", { book: ref.book.number, chapter: ref.chapter, verse: ref.verse }));

    // 2. Crisis: a fixed, caring answer — never generated, never counted.
    if (isCrisis(message)) return sse(async (send) => send("crisis", { message: crisisMessage(lang) }));

    // Topic search: verses only. One embedding (~$0.000002), no quota; the
    // app shows the real verse text from its own database.
    if (body.mode === "verses") {
      // No question is taken, but the off switch, the global cap and a
      // generous per-person limit still apply.
      const { error: freeError } = await userDb.rpc("check_ai_free_call", { p_kind: "verses", p_per_day: 200 });
      if (freeError) {
        const code = ["daily_limit", "global_cap", "ai_disabled"].find((c) => freeError.message.includes(c)) ?? "quota_error";
        return json({ error: code, verses: [] }, 429);
      }
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const emb = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: message.replace(/\u200B/g, ""),
        config: { outputDimensionality: 768, taskType: "RETRIEVAL_QUERY" },
      });
      const vector = emb.embeddings?.[0]?.values;
      const found = vector
        ? await sql`
            select b.book_number as book, v.chapter_number as chapter, v.verse_number as verse, m.similarity
            from public.match_verses(${JSON.stringify(vector)}::extensions.vector, 0.3, 24, ${body.translationId}) m
            join public.verses v on v.id = m.verse_id join public.books b on b.id = v.book_id`
        : [];
      await sql`insert into public.ai_usage (user_id, kind, model, input_tokens, cost_usd)
                values (${user.id}, 'verses', ${EMBEDDING_MODEL}, ${Math.ceil(message.length / 2)}, ${(Math.ceil(message.length / 2) * PRICE_EMBED) / 1e6})`;
      return json({ verses: found.map((f) => ({ book: f.book, chapter: f.chapter, verse: f.verse, similarity: Number(f.similarity) })) });
    }

    // 3. Quota (atomic, per user + global daily $ cap).
    const { data: remaining, error: quotaError } = await userDb.rpc("consume_ai_quota");
    if (quotaError) {
      const code = ["daily_limit", "global_cap", "ai_disabled", "not_signed_in"].find((c) => quotaError.message.includes(c)) ?? "quota_error";
      return json({ error: code }, code === "not_signed_in" ? 401 : 429);
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const [translation] = await sql`select language from public.translations where id = ${body.translationId}`;
    const burmese = translation?.language === "my";
    const bookName = (n: number) => {
      const b = books.find((x) => x.book_number === n);
      return ((burmese ? b?.name_my : null) ?? b?.name_en ?? `${n}`).replace(/​/g, "");
    };

    // 4. Retrieval in the reader's Bible.
    const clean = message.replace(/​/g, "");
    let embedTokens = 0;
    let verses: { id: string; book: number; chapter: number; verse: number; text: string }[] = [];
    try {
      const emb = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: clean,
        config: { outputDimensionality: 768, taskType: "RETRIEVAL_QUERY" },
      });
      embedTokens = Math.ceil(clean.length / 2); // no usage metadata for embeddings; generous estimate
      const vector = emb.embeddings?.[0]?.values;
      if (vector) {
        verses = await sql`
          select v.id, b.book_number as book, v.chapter_number as chapter, v.verse_number as verse, v.text
          from public.match_verses(${JSON.stringify(vector)}::extensions.vector, 0.3, 8, ${body.translationId}) m
          join public.verses v on v.id = m.verse_id join public.books b on b.id = v.book_id`;
      }
    } catch (e) {
      console.error("retrieval (vector) failed", e);
    }
    if (verses.length < 3) {
      const words = clean.split(/\s+/).filter((w) => w.length >= 2).slice(0, 3);
      for (const w of words) {
        const more = await sql`
          select s.verse_id as id, b.book_number as book, s.chapter_number as chapter, s.verse_number as verse, s.text
          from public.search_verses_text(${w}, ${body.translationId}, 4) s join public.books b on b.id = s.book_id`;
        for (const m of more) if (!verses.some((v) => v.id === m.id) && verses.length < 8) verses.push(m as typeof verses[number]);
      }
    }
    const numbered = verses.map((v, i) => ({
      n: i + 1,
      verseId: v.id,
      book: v.book,
      chapter: v.chapter,
      verse: v.verse,
      label: `${bookName(v.book)} ${v.chapter}:${v.verse}`,
      text: v.text.replace(/​/g, ""),
    }));

    // Conversation: the client's id only if it is theirs; history from the DB, never from the client.
    let conversationId = body.conversationId ?? null;
    if (conversationId) {
      const owned = await sql`select 1 from public.chat_conversations where id = ${conversationId} and user_id = ${user.id}`;
      if (owned.length === 0) conversationId = null;
    }
    if (!conversationId) {
      const [c] = await sql`insert into public.chat_conversations (user_id, title) values (${user.id}, ${message.slice(0, 60)}) returning id`;
      conversationId = c.id as string;
    }
    const history = (
      await sql<{ role: "user" | "assistant"; content: string }[]>`
        select role, content from public.chat_messages where conversation_id = ${conversationId}
        order by created_at desc limit ${HISTORY}`
    ).reverse();

    const context = numbered.length
      ? numbered.map((v) => `[V${v.n}] ${v.label}: ${v.text}`).join("\n")
      : "(No verses found for this question.)";

    const church = TRADITIONS[body.tradition as keyof typeof TRADITIONS];
    const tradition = church
      ? `\nThe reader belongs to a ${church} church. Where churches differ, give their church's usual view clearly and ` +
        `still mention the other main views fairly. Do not present one church's view as the only Christian view.`
      : "";

    // A question that got no answer is given back.
    const refund = () => sql`update public.ai_quota set turns = greatest(turns - 1, 0)
                             where user_id = ${user.id} and day = public.ai_today()`;

    streaming = true;
    return sse(async (send) => {
      await send("meta", { conversationId, remaining, verses: numbered });
      let text = "";
      let usage = { input: 0, output: 0 };
      let stopped = false;
      const stream = await ai.models.generateContentStream({
        model: CHAT_MODEL,
        contents: [
          ...history.map((h) => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })),
          { role: "user", parts: [{ text: `Verses you may cite:\n${context}\n\nQuestion: ${message}` }] },
        ],
        config: {
          systemInstruction: `${SYSTEM}\n\n${LANG[lang]}${tradition}`,
          maxOutputTokens: lang === "my" ? 1200 : 700,
          temperature: 0.4,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          safetySettings: [
            HarmCategory.HARM_CATEGORY_HARASSMENT,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          ].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE })),
        },
      });
      for await (const chunk of stream) {
        const t = chunk.text ?? "";
        if (t) {
          text += t;
          await send("delta", { text: t });
        }
        const u = chunk.usageMetadata;
        if (u) usage = { input: u.promptTokenCount ?? 0, output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) };
        if (isRunaway(text)) {
          stopped = true;
          break; // looping output: stop paying for it
        }
      }

      const finalText = stripInvalidCitations(text, numbered.length).trim();
      const cited = citedIndexes(finalText, numbered.length);
      const cost = (usage.input * PRICE_IN + usage.output * PRICE_OUT + embedTokens * PRICE_EMBED) / 1e6;
      await sql`insert into public.ai_usage (user_id, kind, model, input_tokens, output_tokens, cost_usd)
                values (${user.id}, 'chat', ${CHAT_MODEL}, ${usage.input + embedTokens}, ${usage.output}, ${cost})`;
      const refs = cited.map((n) => numbered[n - 1]).map((v) => ({ book: v.book, chapter: v.chapter, verse: v.verse, verseId: v.verseId }));
      await sql`insert into public.chat_messages (conversation_id, role, content, token_count) values
                (${conversationId}, 'user', ${message}, ${usage.input})`;
      await sql`insert into public.chat_messages (conversation_id, role, content, verse_references, token_count) values
                (${conversationId}, 'assistant', ${finalText}, ${sql.json(refs)}, ${usage.output})`;
      await sql`update public.chat_conversations set updated_at = now() where id = ${conversationId}`;
      await send("done", { text: finalText, cited, stopped, usage: { ...usage, costUsd: Number(cost.toFixed(6)) } });
    }, () => sql.end(), refund);
  } catch (e) {
    console.error("ai-chat failed", e);
    streaming = false;
    return json({ error: "server_error" }, 500);
  } finally {
    if (!streaming) await sql.end();
  }
});

/** Runs [work] as a Server-Sent Events response. [cleanup] runs after it. */
function sse(
  work: (send: (event: string, data: unknown) => Promise<void>) => Promise<void>,
  cleanup?: () => Promise<void> | void,
  onFail?: () => Promise<unknown>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = async (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        await work(send);
      } catch (e) {
        console.error("ai-chat stream failed", e);
        // Provider errors never leak to the client.
        await send("error", { code: "generation_failed" });
        try {
          await onFail?.();
        } catch (e2) {
          console.error("ai-chat refund failed", e2);
        }
      } finally {
        await cleanup?.();
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
