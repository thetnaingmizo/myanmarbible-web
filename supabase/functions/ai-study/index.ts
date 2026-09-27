// AI verse study for the app (JSON, not streamed): explain a verse, or say
// why Bibles word a verse differently. Both are generated once and cached for
// everyone; only a cache miss takes one of the caller's daily questions.
//
// POST { mode: "explain", translationId, book, chapter, verse, verseEnd?, lang, style? }
//   → { cached, remaining, content: {background, meaning, life, verses: [{n, book, chapter, verse}], cited} }
// POST { mode: "differ", translationIds: [2–3], book, chapter, verse, lang }
//   → { cached, remaining, content: {summary, differences: [{phrases: {code: text}, note}]} }
// Errors: { error } — unauthorized · bad_request · not_found · daily_limit · global_cap · ai_disabled ·
//         generation_failed · server_error
//
// The model never writes Scripture: the app shows verse text from its own
// database. Explanations may only point to verses given as [V1]..[Vn];
// differences must name phrases that are exact pieces of each verse text.
import { GoogleGenAI, HarmBlockThreshold, HarmCategory, ThinkingLevel, Type } from "npm:@google/genai@1";
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";
import { citedIndexes, stripInvalidCitations } from "../_shared/citations.ts";
import { stripZwsp, validDifferences } from "../_shared/differ.ts";

const MODEL = "gemini-3.1-flash-lite";
const PRICE_IN = 0.25; // USD per 1M tokens; output includes thinking
const PRICE_OUT = 1.5;
const EXPLAIN_VERSION = 1;
const DIFFER_VERSION = 3;
const MAX_RANGE = 5;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const RULES = `You work inside the Myanmar Bible app.
- NEVER quote, paraphrase at length, or invent Scripture. The app shows the real verse text; you only explain.
- Present mainstream Christian understanding. Where churches differ, say so briefly and fairly.
- You are a tool, not a person: no name, no persona, never say you pray for someone.
- Plain text only: no markdown, no headings, no lists.`;

const LANG = {
  my: "Write in Myanmar (Burmese): natural, everyday Unicode Burmese. Keep book names in Burmese.",
  en: "Write in English.",
};

const STYLE = {
  standard: "background: 1–2 sentences. meaning: 2–3 sentences. life: one short, gentle question for the reader.",
  short: "Very short. background: 1 sentence. meaning: 1–2 sentences. life: one short question.",
  kids: "For children aged 8–12: short sentences, simple everyday words, a friendly tone. background: 1 sentence. meaning: 2 sentences. life: one simple question.",
};

const SAFETY = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }));

type Body = {
  mode?: string;
  translationId?: string;
  translationIds?: string[];
  book?: number;
  chapter?: number;
  verse?: number;
  verseEnd?: number;
  lang?: string;
  style?: string;
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

  const userDb = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: auth, error: authError } = await userDb.auth.getUser(jwt);
  const user = auth?.user;
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const lang: "my" | "en" = body.lang === "en" ? "en" : "my";
  const { book, chapter, verse } = body;
  if (![book, chapter, verse].every((n) => Number.isInteger(n) && n! > 0)) return json({ error: "bad_request" }, 400);

  const remainingNow = async () => {
    const { data } = await userDb.rpc("ai_quota_left");
    return typeof data === "number" ? data : null;
  };
  /** Takes one daily question; returns an error response when none is left. */
  const takeQuota = async (): Promise<{ remaining: number } | Response> => {
    const { data, error } = await userDb.rpc("consume_ai_quota");
    if (!error) return { remaining: data as number };
    const code = ["daily_limit", "global_cap", "ai_disabled", "not_signed_in"].find((c) => error.message.includes(c)) ?? "quota_error";
    return json({ error: code }, code === "not_signed_in" ? 401 : 429);
  };

  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  /** One JSON generation; logs real tokens + cost. */
  const generate = async (
    kind: string,
    system: string,
    prompt: string,
    schema: object,
    maxOutputTokens: number,
    thinkingLevel = ThinkingLevel.LOW,
  ) => {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: system,
        maxOutputTokens,
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: schema,
        thinkingConfig: { thinkingLevel },
        safetySettings: SAFETY,
      },
    });
    const u = res.usageMetadata;
    const input = u?.promptTokenCount ?? 0;
    const output = (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0);
    const cost = (input * PRICE_IN + output * PRICE_OUT) / 1e6;
    await sql`insert into public.ai_usage (user_id, kind, model, input_tokens, output_tokens, cost_usd)
              values (${user.id}, ${kind}, ${MODEL}, ${input}, ${output}, ${cost})`;
    try {
      return JSON.parse(res.text ?? "");
    } catch {
      return null; // cut off at maxOutputTokens or not JSON
    }
  };

  try {
    if (body.mode === "explain") {
      const translationId = body.translationId;
      const end = Math.max(verse!, body.verseEnd ?? verse!);
      const style = body.style === "short" || body.style === "kids" ? body.style : "standard";
      if (!translationId || end - verse! >= MAX_RANGE) return json({ error: "bad_request" }, 400);

      const [cached] = await sql`
        select content from public.ai_verse_explanations
        where translation_id = ${translationId} and book_number = ${book!} and chapter_number = ${chapter!}
          and verse_start = ${verse!} and verse_end = ${end} and lang = ${lang} and style = ${style}
          and model = ${MODEL} and prompt_version = ${EXPLAIN_VERSION}`;
      if (cached) return json({ cached: true, remaining: await remainingNow(), content: cached.content });

      const [bk] = await sql`
        select b.id, t.language, coalesce(case when t.language = 'my' then b.name_my end, b.name_en) as name
        from public.books b join public.translations t on t.id = b.translation_id
        where b.translation_id = ${translationId} and b.book_number = ${book!}`;
      if (!bk) return json({ error: "not_found" }, 404);
      // The passage, then its neighbours, then related verses elsewhere.
      const passage = await sql<{ id: string; chapter: number; verse: number; text: string }[]>`
        select id, chapter_number as chapter, verse_number as verse, text from public.verses
        where book_id = ${bk.id} and chapter_number = ${chapter!} and verse_number between ${verse! - 4} and ${end + 4}
        order by verse_number`;
      const target = passage.filter((v) => v.verse >= verse! && v.verse <= end);
      if (target.length === 0) return json({ error: "not_found" }, 404);

      const quota = await takeQuota();
      if (quota instanceof Response) return quota;

      const related = await sql<{ book: number; chapter: number; verse: number; text: string; name: string }[]>`
        select b.book_number as book, m.chapter_number as chapter, m.verse_number as verse, m.text,
               coalesce(case when ${bk.language} = 'my' then b.name_my end, b.name_en) as name
        from public.verse_embeddings ve,
             public.match_verses(ve.embedding, 0.55, 12, ${translationId}) m
        join public.books b on b.id = m.book_id
        where ve.verse_id = ${target[0].id}
          and not (b.book_number = ${book!} and m.chapter_number = ${chapter!})
        limit 4`;
      const name = stripZwsp(bk.name as string);
      const numbered = [
        ...target,
        ...passage.filter((v) => !target.includes(v)),
      ].map((v) => ({ book: book!, chapter: v.chapter, verse: v.verse, text: v.text, name }))
        .concat(related.map((r) => ({ ...r, name: stripZwsp(r.name) })))
        .map((v, i) => ({ ...v, n: i + 1, label: `${v.name} ${v.chapter}:${v.verse}` }));
      const range = end > verse! ? `${name} ${chapter}:${verse}–${end}` : `${name} ${chapter}:${verse}`;
      const context = numbered.map((v) => `[V${v.n}] ${v.label}: ${stripZwsp(v.text)}`).join("\n");

      const out = await generate(
        "explain",
        `${RULES}\n- Cite the verses you rely on inline exactly like "[V2]", only from the list given.\n${LANG[lang]}\n${STYLE[style]}`,
        `Explain ${range} (given as ${target.map((v) => `[V${numbered.find((x) => x.chapter === v.chapter && x.verse === v.verse)!.n}]`).join(" ")}).\n` +
          `background = the setting (who, when, why). meaning = what it says and means. life = a question to take into today.\n\n` +
          `Verses you may cite:\n${context}`,
        {
          type: Type.OBJECT,
          properties: { background: { type: Type.STRING }, meaning: { type: Type.STRING }, life: { type: Type.STRING } },
          required: ["background", "meaning", "life"],
        },
        lang === "my" ? 1400 : 800,
      );
      if (!out?.meaning) return json({ error: "generation_failed" }, 502);
      const clean = (s: unknown) => (typeof s === "string" ? stripInvalidCitations(s, numbered.length).trim() : "");
      const fields = { background: clean(out.background), meaning: clean(out.meaning), life: clean(out.life) };
      const content = {
        ...fields,
        verses: numbered.map((v) => ({ n: v.n, book: v.book, chapter: v.chapter, verse: v.verse })),
        cited: citedIndexes(`${fields.background} ${fields.meaning} ${fields.life}`, numbered.length),
      };
      await sql`
        insert into public.ai_verse_explanations
          (translation_id, book_number, chapter_number, verse_start, verse_end, lang, style, model, prompt_version, content)
        values (${translationId}, ${book!}, ${chapter!}, ${verse!}, ${end}, ${lang}, ${style}, ${MODEL}, ${EXPLAIN_VERSION}, ${sql.json(content)})
        on conflict do nothing`;
      return json({ cached: false, remaining: quota.remaining, content });
    }

    if (body.mode === "differ") {
      const ids = [...new Set(body.translationIds ?? [])].slice(0, 3);
      if (ids.length < 2) return json({ error: "bad_request" }, 400);
      const rows = await sql<{ code: string; name: string; language: string; text: string }[]>`
        select t.code, t.name_en as name, t.language, v.text
        from public.translations t
        join public.books b on b.translation_id = t.id and b.book_number = ${book!}
        join public.verses v on v.book_id = b.id and v.chapter_number = ${chapter!} and v.verse_number = ${verse!}
        where t.id = any(${ids}::uuid[])`;
      if (rows.length < 2) return json({ error: "not_found" }, 404);
      const texts = Object.fromEntries(rows.map((r) => [r.code.toLowerCase(), stripZwsp(r.text).trim()]));
      const key = Object.keys(texts).sort().join(",");

      const [cached] = await sql`
        select content from public.ai_verse_comparisons
        where book_number = ${book!} and chapter_number = ${chapter!} and verse_number = ${verse!}
          and translations = ${key} and lang = ${lang} and model = ${MODEL} and prompt_version = ${DIFFER_VERSION}`;
      if (cached) return json({ cached: true, remaining: await remainingNow(), content: cached.content });

      const quota = await takeQuota();
      if (quota instanceof Response) return quota;

      const out = await generate(
        "differ",
        `${RULES}\n${LANG[lang]}`,
        `The same Bible verse in ${rows.length} translations:\n` +
          rows.map((r) => `${r.code.toLowerCase()} (${r.name}, language ${r.language}): ${texts[r.code.toLowerCase()]}`).join("\n") +
          `\n\nFind the 1–3 differences a careful reader would most want explained: places where the translations ` +
          `bring out a different MEANING or EMPHASIS (for example "charity" vs "love", or "repent" ` +
          `vs "turn back to God"). Skip spelling, punctuation, word order, and places where they mean the same thing. ` +
          `For each difference, give the phrase from EACH translation, copied character-for-character from the text above ` +
          `(a short phrase, not the whole verse), and a note of 1–2 sentences. The note must say accurately what each ` +
          `translation's phrase means, which translations agree with each other, and why translators differ (word-for-word ` +
          `vs meaning-based, or an original Greek/Hebrew word with more than one sense). Refer to translations by their code ` +
          `in capitals. Then a one-sentence summary. Be fair: do not call any translation wrong.`,
        {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            differences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  phrases: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { code: { type: Type.STRING }, phrase: { type: Type.STRING } },
                      required: ["code", "phrase"],
                    },
                  },
                  note: { type: Type.STRING },
                },
                required: ["phrases", "note"],
              },
            },
          },
          required: ["summary", "differences"],
        },
        lang === "my" ? 2400 : 1600,
        ThinkingLevel.MEDIUM,
      );
      if (!out || typeof out.summary !== "string") return json({ error: "generation_failed" }, 502);
      const content = { summary: out.summary.trim(), differences: validDifferences(out.differences, texts) };
      await sql`
        insert into public.ai_verse_comparisons
          (book_number, chapter_number, verse_number, translations, lang, model, prompt_version, content)
        values (${book!}, ${chapter!}, ${verse!}, ${key}, ${lang}, ${MODEL}, ${DIFFER_VERSION}, ${sql.json(content)})
        on conflict do nothing`;
      return json({ cached: false, remaining: quota.remaining, content });
    }

    return json({ error: "bad_request" }, 400);
  } catch (e) {
    console.error("ai-study failed", e);
    return json({ error: "server_error" }, 500);
  } finally {
    await sql.end();
  }
});
