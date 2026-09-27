-- ============================================================
-- AI verse study (3.0 M15): Explain styles, "why they differ"
-- comparisons, and editor-reviewed daily reflections.
-- All three are generated once and cached for everyone.
-- ============================================================

-- ------------------------------------------------------------
-- Explanations come in styles: standard, short, kids.
-- ------------------------------------------------------------
alter table public.ai_verse_explanations add column style text not null default 'standard'
  check (style in ('standard', 'short', 'kids'));
alter table public.ai_verse_explanations
  drop constraint ai_verse_explanations_translation_id_book_number_chapter_nu_key;
create unique index ai_verse_explanations_key on public.ai_verse_explanations
  (translation_id, book_number, chapter_number, verse_start, verse_end, lang, style, model, prompt_version);

-- ------------------------------------------------------------
-- Why translations differ, for one verse in 2–3 Bibles.
-- `translations` is the sorted list of translation codes, e.g. 'bcl,kjv,mizo'.
-- ------------------------------------------------------------
create table public.ai_verse_comparisons (
  id uuid primary key default gen_random_uuid(),
  book_number smallint not null,
  chapter_number smallint not null,
  verse_number smallint not null,
  translations text not null,
  lang text not null,                  -- note language: 'my' | 'en'
  model text not null,
  prompt_version int not null,
  content jsonb not null,              -- {summary, differences: [{phrases: {code: text}, note}]}
  created_at timestamptz not null default now(),
  unique (book_number, chapter_number, verse_number, translations, lang, model, prompt_version)
);
alter table public.ai_verse_comparisons enable row level security;
create policy "Comparisons are readable by everyone" on public.ai_verse_comparisons for select using (true);

-- ------------------------------------------------------------
-- Daily reflections on the Verse of the Day. Precomputed by
-- scripts/generate-reflections.ts; the app only ever sees rows an
-- editor has reviewed (admin → AI reflections).
-- ------------------------------------------------------------
create table public.daily_reflections (
  id uuid primary key default gen_random_uuid(),
  book_number smallint not null,
  chapter_number smallint not null,
  verse_number smallint not null,
  lang text not null,                  -- 'my' | 'en'
  content jsonb not null,              -- {title, body, reflect, prayer, verses: [{n, book, chapter, verse}], cited}
  model text not null,
  prompt_version int not null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (book_number, chapter_number, verse_number, lang)
);
alter table public.daily_reflections enable row level security;
create policy "Reviewed reflections are readable by everyone" on public.daily_reflections for select
  using (reviewed_at is not null);
create policy "Admins manage reflections" on public.daily_reflections
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
