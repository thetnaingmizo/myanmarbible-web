-- ============================================================
-- AI backend for the 3.0 app and the website (M13)
-- - fair per-user daily quota + a global daily spend cap (kill switch)
-- - usage log with real token counts and cost
-- - cache for "explain this verse"
-- - reports on AI answers (feed the admin review queue)
-- - faster, per-translation verse retrieval (HNSW + filter)
-- - Burmese keyword search that ignores zero-width spaces (pg_trgm)
-- ============================================================

create extension if not exists pg_trgm with schema extensions;

-- ------------------------------------------------------------
-- Settings (single row): limits and the global daily cap.
-- ------------------------------------------------------------
create table public.ai_settings (
  id boolean primary key default true check (id),
  turns_per_day_user int not null default 10,
  turns_per_day_guest int not null default 3,
  daily_cap_usd numeric(10, 4) not null default 5.00,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.ai_settings default values;

alter table public.ai_settings enable row level security;
create policy "Admins manage AI settings" on public.ai_settings
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ------------------------------------------------------------
-- Usage: one row per AI call, with measured tokens and cost.
-- ------------------------------------------------------------
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,                      -- 'chat' | 'explain' | ...
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,    -- includes thinking tokens
  cost_usd numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);
create index idx_ai_usage_day on public.ai_usage (created_at);
create index idx_ai_usage_user_day on public.ai_usage (user_id, created_at);

alter table public.ai_usage enable row level security;
create policy "Users read their own AI usage" on public.ai_usage for select using (user_id = auth.uid());
create policy "Admins read AI usage" on public.ai_usage for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Turns counted against the daily quota (one per question, Myanmar time).
create table public.ai_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  turns int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_quota enable row level security;
create policy "Users read their own quota" on public.ai_quota for select using (user_id = auth.uid());

-- Myanmar has no DST: UTC+6:30. Quotas reset at local midnight.
create or replace function public.ai_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Yangon')::date $$;

-- Atomically takes one turn for the caller. Returns the turns left today,
-- or raises: 'ai_disabled', 'daily_limit', 'global_cap', 'not_signed_in'.
create or replace function public.consume_ai_quota()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.ai_settings;
  uid uuid := auth.uid();
  is_guest boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  lim int;
  used int;
  spent numeric;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from public.ai_settings where id;
  if not s.enabled then raise exception 'ai_disabled'; end if;

  select coalesce(sum(cost_usd), 0) into spent
    from public.ai_usage where created_at >= (public.ai_today()::timestamp at time zone 'Asia/Yangon');
  if spent >= s.daily_cap_usd then raise exception 'global_cap'; end if;

  lim := case when is_guest then s.turns_per_day_guest else s.turns_per_day_user end;
  insert into public.ai_quota (user_id, day, turns) values (uid, public.ai_today(), 0)
    on conflict (user_id, day) do nothing;
  select turns into used from public.ai_quota where user_id = uid and day = public.ai_today() for update;
  if used >= lim then raise exception 'daily_limit'; end if;
  update public.ai_quota set turns = turns + 1 where user_id = uid and day = public.ai_today();
  return lim - used - 1;
end;
$$;
revoke all on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated;

-- Turns left today without taking one (for the composer's quota line).
create or replace function public.ai_quota_left()
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.ai_settings;
  is_guest boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  used int;
begin
  if auth.uid() is null then return 0; end if;
  select * into s from public.ai_settings where id;
  select coalesce(turns, 0) into used from public.ai_quota where user_id = auth.uid() and day = public.ai_today();
  return greatest(0, (case when is_guest then s.turns_per_day_guest else s.turns_per_day_user end) - coalesce(used, 0));
end;
$$;
grant execute on function public.ai_quota_left() to authenticated;

-- ------------------------------------------------------------
-- Cache: "explain this verse" answers, shared by everyone.
-- ------------------------------------------------------------
create table public.ai_verse_explanations (
  id uuid primary key default gen_random_uuid(),
  translation_id uuid not null references public.translations(id) on delete cascade,
  book_number smallint not null,
  chapter_number smallint not null,
  verse_start smallint not null,
  verse_end smallint not null,
  lang text not null,                  -- answer language: 'my' | 'en'
  model text not null,
  prompt_version int not null,
  content jsonb not null,              -- {text, cited: [..]}
  created_at timestamptz not null default now(),
  unique (translation_id, book_number, chapter_number, verse_start, verse_end, lang, model, prompt_version)
);
alter table public.ai_verse_explanations enable row level security;
create policy "Explanations are readable by everyone" on public.ai_verse_explanations for select using (true);

-- ------------------------------------------------------------
-- Reports on AI answers (wrong, harmful, not biblical...).
-- ------------------------------------------------------------
create table public.ai_answer_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  question text not null,
  answer text not null,
  reason text not null,                -- 'wrong' | 'harmful' | 'not_biblical' | 'other'
  comment text,
  cited jsonb,
  model text,
  status public.feedback_status not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now()
);
create index idx_ai_answer_reports_status on public.ai_answer_reports (status, created_at desc);
alter table public.ai_answer_reports enable row level security;
create policy "Users report AI answers as themselves" on public.ai_answer_reports for insert
  to authenticated with check (user_id = auth.uid());
create policy "Admins manage AI answer reports" on public.ai_answer_reports
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ------------------------------------------------------------
-- Retrieval: HNSW (works on an empty or growing table, unlike
-- ivfflat built empty) and filtering to one translation.
-- ------------------------------------------------------------
drop index if exists public.idx_verse_embeddings_vector;
create index idx_verse_embeddings_hnsw on public.verse_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

drop function if exists public.match_verses(extensions.vector, float, int);
create or replace function public.match_verses(
  query_embedding extensions.vector(768),
  match_threshold float default 0.5,
  match_count int default 10,
  filter_translation_id uuid default null
)
returns table (
  verse_id uuid,
  book_id uuid,
  chapter_number smallint,
  verse_number smallint,
  text text,
  similarity float
)
language sql stable
set search_path = extensions, public
as $$
  select v.id, v.book_id, v.chapter_number, v.verse_number, v.text,
         1 - (ve.embedding <=> query_embedding) as similarity
  from public.verse_embeddings ve
  join public.verses v on v.id = ve.verse_id
  join public.books b on b.id = v.book_id
  where (filter_translation_id is null or b.translation_id = filter_translation_id)
    and 1 - (ve.embedding <=> query_embedding) > match_threshold
  order by ve.embedding <=> query_embedding
  limit match_count;
$$;

-- ------------------------------------------------------------
-- Keyword search that works for Burmese: 92% of Burmese verses
-- carry U+200B between syllables, so compare without them.
-- ------------------------------------------------------------
alter table public.verses
  add column text_norm text generated always as (lower(replace(text, chr(8203), ''))) stored;
create index idx_verses_text_norm_trgm on public.verses using gin (text_norm extensions.gin_trgm_ops);

create or replace function public.search_verses_text(
  q text,
  filter_translation_id uuid default null,
  match_count int default 20
)
returns table (verse_id uuid, book_id uuid, chapter_number smallint, verse_number smallint, text text)
language sql stable
set search_path = extensions, public
as $$
  select v.id, v.book_id, v.chapter_number, v.verse_number, v.text
  from public.verses v
  join public.books b on b.id = v.book_id
  where v.text_norm like '%' || replace(replace(replace(lower(replace(q, chr(8203), '')), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    and (filter_translation_id is null or b.translation_id = filter_translation_id)
  order by b.book_number, v.chapter_number, v.verse_number
  limit match_count;
$$;
