// AI verse study for the app (JSON, not streamed): explain a verse, or say
// why Bibles word a verse differently. Both are generated once and cached for
// everyone; only a cache miss takes one of the caller's daily questions.
//
// POST { mode: "explain", translationId, book, chapter, verse, verseEnd?, lang, style? }
//   → { cached, remaining, content: {background, meaning, life, verses: [{n, book, chapter, verse}], cited} }
// POST { mode: "differ", translationIds: [2–3], book, chapter, verse, lang }
//   → { cached, remaining, content: {summary, differences: [{phrases: {code: text}, note}]} }
// POST { mode: "guide", translationId, book, chapter, verse, verseEnd, audience, minutes, lang }
//   → { cached, remaining, content: {sections: [{kind, minutes, text?, points?, questions?}], verses} }
// POST { mode: "prayer", translationId, topic, details?, lang }
//   → { remaining, content: {prayer, verses, basis} } — never cached or stored (private)
//   → { crisis: true } when someone may be in danger (free, no AI)
// POST { mode: "word", strong, position, book, chapter, verse, translationIds: [1–3] }
//   → { cached, remaining, content: {phrases: {code: text}}, glossMy, glossMyStatus }
//     how each Bible renders one original-language word here (phrases validated
//     against the real text) + a Burmese gloss drafted once per word
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
import { locate, stripZwsp, validDifferences } from "../_shared/differ.ts";
import { fitMinutes } from "../_shared/guide.ts";
import { isCrisis } from "../_shared/safety.ts";

const MODEL = "gemini-3.1-flash-lite";
const PRICE_IN = 0.25; // USD per 1M tokens; output includes thinking
const PRICE_OUT = 1.5;
const EXPLAIN_VERSION = 1;
const DIFFER_VERSION = 3;
const GUIDE_VERSION = 1;
const WORD_VERSION = 1;
const EMBEDDING_MODEL = "gemini-embedding-001";
const PRICE_EMBED = 0.2;
const MAX_GUIDE_VERSES = 40;

const AUDIENCE = {
  cell: "a home cell group of adults (mixed ages, some new believers)",
  youth: "a youth group (ages 14–22)",
  sunday: "a Sunday school class of adults",
  personal: "one person studying alone",
} as const;

const TOPICS = {
  family: "my family",
  health: "health and healing",
  worry: "worry and anxiety",
  thanks: "thanksgiving",
  forgiveness: "forgiveness",
  guidance: "guidance for a decision",
  other: "something on my heart",
} as const;
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
  audience?: string;
  minutes?: number;
  topic?: string;
  details?: string;
  strong?: string;
  position?: number;
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
  if (body.mode !== "prayer" && ![book, chapter, verse].every((n) => Number.isInteger(n) && n! > 0)) {
    return json({ error: "bad_request" }, 400);
  }

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

    if (body.mode === "guide") {
      const translationId = body.translationId;
      const end = Math.max(verse!, body.verseEnd ?? verse!);
      const audience = (Object.keys(AUDIENCE) as (keyof typeof AUDIENCE)[]).find((a) => a === body.audience) ?? "cell";
      const minutes = [30, 45, 60].includes(body.minutes ?? 0) ? body.minutes! : 45;
      if (!translationId || end - verse! >= MAX_GUIDE_VERSES) return json({ error: "bad_request" }, 400);

      const [cached] = await sql`
        select content from public.ai_study_guides
        where translation_id = ${translationId} and book_number = ${book!} and chapter_number = ${chapter!}
          and verse_start = ${verse!} and verse_end = ${end} and audience = ${audience} and minutes = ${minutes}
          and lang = ${lang} and model = ${MODEL} and prompt_version = ${GUIDE_VERSION}`;
      if (cached) return json({ cached: true, remaining: await remainingNow(), content: cached.content });

      const [bk] = await sql`
        select b.id, t.language, coalesce(case when t.language = 'my' then b.name_my end, b.name_en) as name
        from public.books b join public.translations t on t.id = b.translation_id
        where b.translation_id = ${translationId} and b.book_number = ${book!}`;
      if (!bk) return json({ error: "not_found" }, 404);
      const passage = await sql<{ id: string; verse: number; text: string }[]>`
        select id, verse_number as verse, text from public.verses
        where book_id = ${bk.id} and chapter_number = ${chapter!} and verse_number between ${verse!} and ${end}
        order by verse_number`;
      if (passage.length === 0) return json({ error: "not_found" }, 404);

      const quota = await takeQuota();
      if (quota instanceof Response) return quota;

      const related = await sql<{ book: number; chapter: number; verse: number; text: string; name: string }[]>`
        select b.book_number as book, m.chapter_number as chapter, m.verse_number as verse, m.text,
               coalesce(case when ${bk.language} = 'my' then b.name_my end, b.name_en) as name
        from public.verse_embeddings ve,
             public.match_verses(ve.embedding, 0.55, 12, ${translationId}) m
        join public.books b on b.id = m.book_id
        where ve.verse_id = ${passage[Math.floor(passage.length / 2)].id}
          and not (b.book_number = ${book!} and m.chapter_number = ${chapter!})
        limit 4`;
      const name = stripZwsp(bk.name as string);
      const numbered = [
        ...passage.map((v) => ({ book: book!, chapter: chapter!, verse: v.verse, text: v.text, name })),
        ...related.map((r) => ({ ...r, name: stripZwsp(r.name) })),
      ].map((v, i) => ({ ...v, n: i + 1, label: `${v.name} ${v.chapter}:${v.verse}` }));
      const range = end > verse! ? `${name} ${chapter}:${verse}–${end}` : `${name} ${chapter}:${verse}`;
      const context = numbered.map((v) => `[V${v.n}] ${v.label}: ${stripZwsp(v.text)}`).join("\n");

      const out = await generate(
        "guide",
        `${RULES}\n- Cite the verses you rely on inline exactly like "[V2]", only from the list given.\n` +
          `- This is an OUTLINE for a leader, not a sermon: short prompts and questions, never long teaching.\n${LANG[lang]}`,
        `Make a ${minutes}-minute Bible study on ${range} for ${AUDIENCE[audience]}.\n` +
          `Sections (give each a number of minutes; together they must fill ${minutes} minutes, including reading the passage aloud):\n` +
          `- opening: one warm-up question anyone can answer (not about the Bible yet).\n` +
          `- passageMinutes: minutes to read the passage aloud (the app shows the real text).\n` +
          `- explore: 3 short observations about what the passage says, each citing its verse.\n` +
          `- discuss: 4–5 open discussion questions, from understanding to personal.\n` +
          `- apply: one concrete thing to do this week.\n` +
          `- pray: a short guide for group prayer (topics, not a written prayer).\n\n` +
          `Verses you may cite:\n${context}`,
        {
          type: Type.OBJECT,
          properties: {
            opening: { type: Type.OBJECT, properties: { minutes: { type: Type.INTEGER }, text: { type: Type.STRING } }, required: ["minutes", "text"] },
            passageMinutes: { type: Type.INTEGER },
            explore: {
              type: Type.OBJECT,
              properties: { minutes: { type: Type.INTEGER }, points: { type: Type.ARRAY, items: { type: Type.STRING } } },
              required: ["minutes", "points"],
            },
            discuss: {
              type: Type.OBJECT,
              properties: { minutes: { type: Type.INTEGER }, questions: { type: Type.ARRAY, items: { type: Type.STRING } } },
              required: ["minutes", "questions"],
            },
            apply: { type: Type.OBJECT, properties: { minutes: { type: Type.INTEGER }, text: { type: Type.STRING } }, required: ["minutes", "text"] },
            pray: { type: Type.OBJECT, properties: { minutes: { type: Type.INTEGER }, text: { type: Type.STRING } }, required: ["minutes", "text"] },
          },
          required: ["opening", "passageMinutes", "explore", "discuss", "apply", "pray"],
        },
        lang === "my" ? 2600 : 1600,
      );
      if (!out?.discuss?.questions?.length) return json({ error: "generation_failed" }, 502);
      const clean = (s: unknown) => (typeof s === "string" ? stripInvalidCitations(s, numbered.length).trim() : "");
      const list = (a: unknown, max: number) => (Array.isArray(a) ? a.map(clean).filter(Boolean).slice(0, max) : []);
      const fitted = fitMinutes(
        [out.opening?.minutes, out.passageMinutes, out.explore?.minutes, out.discuss?.minutes, out.apply?.minutes, out.pray?.minutes],
        minutes,
      );
      const content = {
        minutes,
        sections: [
          { kind: "opening", minutes: fitted[0], text: clean(out.opening?.text) },
          { kind: "passage", minutes: fitted[1] },
          { kind: "explore", minutes: fitted[2], points: list(out.explore?.points, 5) },
          { kind: "discuss", minutes: fitted[3], questions: list(out.discuss?.questions, 6) },
          { kind: "apply", minutes: fitted[4], text: clean(out.apply?.text) },
          { kind: "pray", minutes: fitted[5], text: clean(out.pray?.text) },
        ],
        verses: numbered.map((v) => ({ n: v.n, book: v.book, chapter: v.chapter, verse: v.verse })),
      };
      await sql`
        insert into public.ai_study_guides
          (translation_id, book_number, chapter_number, verse_start, verse_end, audience, minutes, lang, model, prompt_version, content)
        values (${translationId}, ${book!}, ${chapter!}, ${verse!}, ${end}, ${audience}, ${minutes}, ${lang}, ${MODEL},
                ${GUIDE_VERSION}, ${sql.json(content)})
        on conflict do nothing`;
      return json({ cached: false, remaining: quota.remaining, content });
    }

    if (body.mode === "prayer") {
      const translationId = body.translationId;
      const topic = (Object.keys(TOPICS) as (keyof typeof TOPICS)[]).find((t) => t === body.topic) ?? "other";
      const details = (body.details ?? "").trim().slice(0, 300);
      if (!translationId) return json({ error: "bad_request" }, 400);
      // Someone in danger gets help, not a generated prayer.
      if (details && isCrisis(details)) return json({ crisis: true });

      const quota = await takeQuota();
      if (quota instanceof Response) return quota;

      const query = stripZwsp(`${TOPICS[topic]} ${details}`);
      const emb = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: query,
        config: { outputDimensionality: 768, taskType: "RETRIEVAL_QUERY" },
      });
      const embedTokens = Math.ceil(query.length / 2);
      await sql`insert into public.ai_usage (user_id, kind, model, input_tokens, cost_usd)
                values (${user.id}, 'prayer', ${EMBEDDING_MODEL}, ${embedTokens}, ${(embedTokens * PRICE_EMBED) / 1e6})`;
      const vector = emb.embeddings?.[0]?.values;
      const found = vector
        ? await sql<{ book: number; chapter: number; verse: number; text: string; name: string }[]>`
            select b.book_number as book, m.chapter_number as chapter, m.verse_number as verse, m.text,
                   coalesce(case when t.language = 'my' then b.name_my end, b.name_en) as name
            from public.match_verses(${JSON.stringify(vector)}::extensions.vector, 0.3, 6, ${translationId}) m
            join public.books b on b.id = m.book_id join public.translations t on t.id = b.translation_id`
        : [];
      const numbered = found.map((v, i) => ({ ...v, n: i + 1, label: `${stripZwsp(v.name)} ${v.chapter}:${v.verse}` }));
      const context = numbered.map((v) => `[V${v.n}] ${v.label}: ${stripZwsp(v.text)}`).join("\n");

      // The details are sent to the model to write the prayer and are never stored.
      const out = await generate(
        "prayer",
        `${RULES}\n${LANG[lang]}`,
        `Write a short prayer (4–6 sentences) that the READER will pray, in the first person ("I", "me", "my"), ` +
          `addressed to God, about: ${TOPICS[topic]}.` +
          (details ? ` What they shared: "${details}".` : "") +
          ` Simple, honest, warm words; no preaching. End with "${lang === "my" ? "ယေရှု၏ နာမတော်အားဖြင့် ဆုတောင်းပါ၏။ အာမင်။" : "In Jesus' name, Amen."}"\n` +
          `Base it on 1–3 of these verses and list their numbers in "basis" (do not quote them, do not write [Vn] in the prayer).\n\n` +
          `Verses:\n${context || "(none)"}`,
        {
          type: Type.OBJECT,
          properties: { prayer: { type: Type.STRING }, basis: { type: Type.ARRAY, items: { type: Type.INTEGER } } },
          required: ["prayer", "basis"],
        },
        lang === "my" ? 1200 : 700,
      );
      if (!out?.prayer) return json({ error: "generation_failed" }, 502);
      const given: number[] = Array.isArray(out.basis) ? out.basis.map((x: unknown) => Number(x)) : [];
      const basis = [...new Set(given)]
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= numbered.length)
        .slice(0, 3);
      return json({
        remaining: quota.remaining,
        content: {
          prayer: stripInvalidCitations(String(out.prayer), 0).trim(),
          verses: numbered.map((v) => ({ n: v.n, book: v.book, chapter: v.chapter, verse: v.verse })),
          basis,
        },
      });
    }

    if (body.mode === "word") {
      const strong = body.strong ?? "";
      const position = body.position ?? 0;
      const ids = [...new Set(body.translationIds ?? [])].slice(0, 3);
      if (!/^[GH]\d{4}[A-Za-z]?$/.test(strong) || !Number.isInteger(position) || ids.length === 0) {
        return json({ error: "bad_request" }, 400);
      }
      const [lex] = await sql`select strong, lemma, translit, gloss, definition, gloss_my, gloss_my_status from public.lexicon where strong = ${strong}`;
      if (!lex) return json({ error: "not_found" }, 404);
      const rows = await sql<{ code: string; name: string; language: string; text: string }[]>`
        select t.code, t.name_en as name, t.language, v.text
        from public.translations t
        join public.books b on b.translation_id = t.id and b.book_number = ${book!}
        join public.verses v on v.book_id = b.id and v.chapter_number = ${chapter!} and v.verse_number = ${verse!}
        where t.id = any(${ids}::uuid[])`;
      if (rows.length === 0) return json({ error: "not_found" }, 404);
      const texts = Object.fromEntries(rows.map((r) => [r.code.toLowerCase(), stripZwsp(r.text).trim()]));
      const key = Object.keys(texts).sort().join(",");

      const [cached] = await sql`
        select content from public.ai_word_renderings
        where strong = ${strong} and book_number = ${book!} and chapter_number = ${chapter!} and verse_number = ${verse!}
          and position = ${position} and translations = ${key} and model = ${MODEL} and prompt_version = ${WORD_VERSION}`;
      if (cached && lex.gloss_my) {
        return json({ cached: true, remaining: await remainingNow(), content: cached.content, glossMy: lex.gloss_my, glossMyStatus: lex.gloss_my_status });
      }

      const quota = await takeQuota();
      if (quota instanceof Response) return quota;

      const original = await sql<{ position: number; word: string; gloss: string; strong: string }[]>`
        select position, word, gloss, strong from public.original_words
        where book_number = ${book!} and chapter_number = ${chapter!} and verse_number = ${verse!} order by position`;
      const out = await generate(
        "word",
        `${RULES}`,
        `Original-language verse, word by word (word = English gloss): ` +
          original.map((w) => `${w.word}=${w.gloss}${w.position === position ? " ◀" : ""}`).join(" ") +
          `\n\nThe word marked ◀ is ${lex.lemma} (${lex.translit}, Strong's ${strong}), meaning "${lex.gloss}".\n` +
          `The same verse in these Bibles:\n` +
          rows.map((r) => `${r.code.toLowerCase()} (${r.name}): ${texts[r.code.toLowerCase()]}`).join("\n") +
          `\n\nFor each Bible, give the short phrase that translates the marked word (this occurrence only — the same ` +
          `word may appear elsewhere in the verse), copied character-for-character ` +
          `from its text above (leave it out if that Bible has no clear equivalent). Then give glossMy: what the word ` +
          `${lex.lemma} itself means ("${lex.gloss}"), in natural Myanmar (Burmese), 1–5 words like a dictionary gloss — ` +
          `only the word's own meaning, not the other words of this verse, not a sentence.`,
        {
          type: Type.OBJECT,
          properties: {
            phrases: {
              type: Type.ARRAY,
              items: { type: Type.OBJECT, properties: { code: { type: Type.STRING }, phrase: { type: Type.STRING } }, required: ["code", "phrase"] },
            },
            glossMy: { type: Type.STRING },
          },
          required: ["phrases", "glossMy"],
        },
        700,
      );
      if (!out) return json({ error: "generation_failed" }, 502);
      const phrases: Record<string, string> = {};
      for (const p of Array.isArray(out.phrases) ? out.phrases : []) {
        const code = typeof p?.code === "string" ? p.code.toLowerCase() : "";
        const found = texts[code] && typeof p?.phrase === "string" ? locate(texts[code], stripZwsp(p.phrase)) : null;
        if (found && !phrases[code]) phrases[code] = found;
      }
      const content = { phrases };
      await sql`
        insert into public.ai_word_renderings
          (strong, book_number, chapter_number, verse_number, position, translations, model, prompt_version, content)
        values (${strong}, ${book!}, ${chapter!}, ${verse!}, ${position}, ${key}, ${MODEL}, ${WORD_VERSION}, ${sql.json(content)})
        on conflict do nothing`;
      // The Burmese gloss is drafted once per word; editors review it in the admin.
      let glossMy = lex.gloss_my as string | null;
      let glossMyStatus = lex.gloss_my_status as string | null;
      const drafted = typeof out.glossMy === "string" ? out.glossMy.trim().slice(0, 80) : "";
      if (!glossMy && drafted) {
        await sql`update public.lexicon set gloss_my = ${drafted}, gloss_my_status = 'ai_draft', gloss_my_updated_at = now()
                  where strong = ${strong} and gloss_my is null`;
        glossMy = drafted;
        glossMyStatus = "ai_draft";
      }
      return json({ cached: false, remaining: quota.remaining, content, glossMy, glossMyStatus });
    }

    return json({ error: "bad_request" }, 400);
  } catch (e) {
    console.error("ai-study failed", e);
    return json({ error: "server_error" }, 500);
  } finally {
    await sql.end();
  }
});
