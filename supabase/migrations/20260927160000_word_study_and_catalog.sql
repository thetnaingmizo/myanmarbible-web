-- ============================================================
-- 3.0 M17: original-language word study (A04) and the Bible
-- catalogue behind the Downloads screen (P11, P12).
-- ============================================================

-- ------------------------------------------------------------
-- Lexicon: STEPBible TBESG (Greek) + TBESH (Hebrew) brief lexicons,
-- CC BY 4.0 (STEPBible.org), keyed by extended Strong's numbers
-- ("G3439", "H7462B"). Loaded by scripts/seed-original-words.ts.
-- gloss_my is an AI draft until an editor reviews it (admin).
-- ------------------------------------------------------------
create table public.lexicon (
  strong text primary key,
  lemma text not null,
  translit text,
  pos text,                             -- e.g. 'G:A', 'H:V'
  gloss text,                           -- short English gloss
  definition text,                      -- plain text, trimmed
  gloss_my text,
  gloss_my_status text check (gloss_my_status in ('ai_draft', 'reviewed')),
  gloss_my_updated_at timestamptz
);
alter table public.lexicon enable row level security;
create policy "Lexicon is readable by everyone" on public.lexicon for select using (true);
create policy "Admins edit the lexicon" on public.lexicon for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ------------------------------------------------------------
-- Tagged original text: STEPBible TAGNT (Greek NT) + TAHOT (Hebrew
-- OT), CC BY 4.0, one row per word, English versification.
-- ------------------------------------------------------------
create table public.original_words (
  book_number smallint not null,
  chapter_number smallint not null,
  verse_number smallint not null,
  position smallint not null,
  word text not null,                   -- as written (Greek / Hebrew)
  translit text,
  gloss text,                           -- English translation in context
  strong text,                          -- main extended Strong's number
  morph text,
  primary key (book_number, chapter_number, verse_number, position)
);
create index idx_original_words_strong on public.original_words (strong);
alter table public.original_words enable row level security;
create policy "Original words are readable by everyone" on public.original_words for select using (true);

-- Where a word occurs: total count and the first [lim] references.
create or replace function public.word_occurrences(p_strong text, lim int default 60)
returns table (total bigint, book_number smallint, chapter_number smallint, verse_number smallint)
language sql stable as $$
  with v as (
    select distinct book_number, chapter_number, verse_number
    from public.original_words where strong = p_strong
  )
  select (select count(*) from v), book_number, chapter_number, verse_number
  from v order by book_number, chapter_number, verse_number limit lim
$$;

-- How each Bible renders a word in one verse (AI, validated phrases).
create table public.ai_word_renderings (
  id uuid primary key default gen_random_uuid(),
  strong text not null,
  book_number smallint not null,
  chapter_number smallint not null,
  verse_number smallint not null,
  position smallint not null,           -- which occurrence in the verse
  translations text not null,           -- sorted codes, e.g. 'judson,kjv,mizo'
  model text not null,
  prompt_version int not null,
  content jsonb not null,               -- {phrases: {code: text}}
  created_at timestamptz not null default now(),
  unique (strong, book_number, chapter_number, verse_number, position, translations, model, prompt_version)
);
alter table public.ai_word_renderings enable row level security;
create policy "Word renderings are readable by everyone" on public.ai_word_renderings for select using (true);

-- ------------------------------------------------------------
-- Bible catalogue (features/02): every Bible the app can offer.
-- A source is 'ready' when a translation with the same code exists
-- on the server; otherwise people can request it (curated catalogue
-- only — requests show in the admin, users never add sources).
-- ------------------------------------------------------------
create table public.translation_sources (
  code text primary key,                -- = translations.code once ingested
  name_local text not null,
  name_en text not null,
  language text not null,               -- ISO 639-3 or app code
  language_group text not null check (language_group in ('myanmar', 'chin', 'kachin', 'karen', 'other')),
  scope text not null check (scope in ('full', 'nt', 'portion')),
  approx_mb numeric(5, 1),
  license text,
  source text,                          -- e.g. 'eBible.org myajvb'
  availability text not null default 'ingestable'
    check (availability in ('ingestable', 'needs_permission')),
  note text,
  sort_order int not null default 100
);
alter table public.translation_sources enable row level security;
create policy "Catalogue is readable by everyone" on public.translation_sources for select using (true);
create policy "Admins manage the catalogue" on public.translation_sources
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create table public.translation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_code text not null references public.translation_sources(code) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, source_code)
);
alter table public.translation_requests enable row level security;
create policy "Users request Bibles as themselves" on public.translation_requests for insert
  to authenticated with check (user_id = auth.uid());
create policy "Users see their own requests" on public.translation_requests for select using (user_id = auth.uid());
create policy "Admins see all requests" on public.translation_requests for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- The catalogue as the app sees it: status and request counts.
create or replace view public.translation_catalog with (security_invoker = true) as
  select s.*,
         t.id as translation_id,
         case when t.id is not null then 'ready' else s.availability end as status
  from public.translation_sources s
  left join public.translations t on t.code = s.code;

-- Facts from docs/research/myanmar-ethnic-bibles.md (verified 2026-07-11).
insert into public.translation_sources
  (code, name_local, name_en, language, language_group, scope, approx_mb, license, source, availability, note, sort_order) values
  -- judson: the text is the Common Language Bible (launch audit); licence to be confirmed by the founder.
  ('judson', 'မြန်မာ သမ္မာကျမ်းစာ', 'Judson Myanmar Bible', 'my', 'myanmar', 'full', 5.6, null, 'Myanmar Bible', 'ingestable', null, 1),
  ('myajvb', 'ယုဒသန် ကျမ်းစာ (၁၈၄၀)', 'Judson Bible 1840', 'mya', 'myanmar', 'full', 5.0, 'Public domain', 'eBible.org myajvb', 'ingestable', null, 2),
  ('kjv', 'King James Version', 'King James Version', 'en', 'other', 'full', 4.0, 'Public domain', 'Myanmar Bible', 'ingestable', null, 90),
  ('mizo', 'Pathian Lehkhabu Thianghlim', 'Mizo Bible', 'lus', 'chin', 'full', 4.0, null, 'Mizo Go Bible', 'ingestable', null, 10),
  ('hltmcsb', 'Matupi Chin Standard Bible', 'Matu Chin Bible', 'hlt', 'chin', 'full', 4.0,
     'CC BY-SA 4.0 in Myanmar · public domain elsewhere', 'eBible.org hltmcsb', 'ingestable', null, 11),
  ('cekak', 'Asang Khongca Bible', 'Eastern Khumi Chin Bible', 'cek', 'chin', 'full', 4.0, 'Public domain', 'eBible.org cekak', 'ingestable', null, 12),
  ('cth', 'Thai Phum Holy Bible', 'Thaiphum Chin Bible', 'cth', 'chin', 'full', 4.0,
     'CC BY-SA 4.0 in Myanmar · public domain elsewhere', 'eBible.org cth', 'ingestable', null, 13),
  ('tczchongthu', 'Pathen Lekhabu Theng', 'Thado Chin (Chongthu) Bible', 'tcz', 'chin', 'full', 4.0, 'CC BY-SA 4.0',
     'eBible.org tczchongthu', 'ingestable', 'Draft — work in progress', 14),
  ('csy', 'Tinaung Takluem', 'Siyin Chin New Testament', 'csy', 'chin', 'nt', 1.2, 'CC BY-SA 4.0', 'eBible.org csy', 'ingestable', null, 15),
  ('dao', 'Dai Cangcim Kthai', 'Daai Chin New Testament', 'dao', 'chin', 'nt', 1.2, 'CC BY 4.0', 'eBible.org dao', 'ingestable', null, 16),
  ('cnh', 'Hakha Common Language Bible', 'Hakha Chin Bible', 'cnh', 'chin', 'full', null, '© Bible Society of Myanmar',
     'Bible Society of Myanmar', 'needs_permission', null, 17),
  ('ctd', 'Tedim Bible', 'Tedim Chin Bible', 'ctd', 'chin', 'full', null, '© Bible Society of Myanmar',
     'Bible Society of Myanmar', 'needs_permission', null, 18),
  ('kac', 'Jinghpaw Common Language Bible', 'Kachin (Jinghpaw) Bible', 'kac', 'kachin', 'full', null, '© Bible Society of Myanmar',
     'Bible Society of Myanmar', 'needs_permission', null, 30),
  ('ksw', 'Sgaw Karen Common Bible', 'S''gaw Karen Bible', 'ksw', 'karen', 'full', null, '© Bible Society of Myanmar',
     'Bible Society of Myanmar', 'needs_permission', null, 40),
  ('rki', 'ဓမ္မသစ်ကျမ်း (ရခိုင်)', 'Rakhine New Testament', 'rki', 'other', 'nt', 1.5, 'CC BY-SA 4.0', 'eBible.org rki', 'ingestable', null, 60),
  ('tvn', 'ဓမ္မသစ်ကျမ်း (ထားဝယ်)', 'Tavoyan (Dawei) New Testament', 'tvn', 'other', 'nt', 1.5, 'CC BY-SA 4.0', 'eBible.org tvn', 'ingestable', null, 61),
  ('dnv', 'ဓမ္မသစ်ကျမ်း (ဓနု)', 'Danu New Testament', 'dnv', 'other', 'nt', 1.5, 'CC BY-SA 4.0', 'eBible.org dnv', 'ingestable', null, 62);
