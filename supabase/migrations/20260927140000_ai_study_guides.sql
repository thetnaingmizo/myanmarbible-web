-- ============================================================
-- AI study guides (3.0 M16, A12): a timed outline for a group on
-- one passage. Generated once per passage + audience + length +
-- language and shared, like explanations. Prayers (A13) are never
-- stored on the server — they live in the user's on-phone journal.
-- ============================================================
create table public.ai_study_guides (
  id uuid primary key default gen_random_uuid(),
  translation_id uuid not null references public.translations(id) on delete cascade,
  book_number smallint not null,
  chapter_number smallint not null,
  verse_start smallint not null,
  verse_end smallint not null,
  audience text not null check (audience in ('cell', 'youth', 'sunday', 'personal')),
  minutes smallint not null check (minutes in (30, 45, 60)),
  lang text not null,                  -- 'my' | 'en'
  model text not null,
  prompt_version int not null,
  content jsonb not null,              -- {sections: [...], verses: [{n, book, chapter, verse}]}
  created_at timestamptz not null default now(),
  unique (translation_id, book_number, chapter_number, verse_start, verse_end, audience, minutes, lang, model, prompt_version)
);
alter table public.ai_study_guides enable row level security;
create policy "Study guides are readable by everyone" on public.ai_study_guides for select using (true);
