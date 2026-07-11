-- ============================================================
-- VERSE CONTENT VERSIONING
-- Every verse edit bumps updated_at (millisecond precision), so
-- clients can fetch only what changed since their last sync.
-- ============================================================

alter table public.verses
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_verses_updated_at on public.verses (updated_at);

create or replace function public.touch_verses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_verses_updated_at on public.verses;
create trigger trg_verses_updated_at
  before update on public.verses
  for each row
  when (old.text is distinct from new.text)
  execute function public.touch_verses_updated_at();

-- ============================================================
-- VERSE FEEDBACK
-- Users report missing/incorrect verses from the app or web;
-- admins review in the admin panel and fix the verse.
-- Reference fields are denormalized so the report stays readable
-- even if the verse row is re-seeded.
-- ============================================================

create type public.feedback_status as enum ('pending', 'applied', 'rejected');

create table public.verse_feedback (
  id uuid primary key default gen_random_uuid(),
  verse_id uuid references public.verses(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  translation_code text not null,
  book_name text not null,
  book_number smallint not null,
  chapter_number smallint not null,
  verse_number smallint not null,
  -- verse text as the reporter saw it
  original_text text not null,
  -- optional corrected text proposed by the reporter
  suggested_text text,
  comment text,
  status public.feedback_status not null default 'pending',
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_verse_feedback_status on public.verse_feedback (status, created_at desc);

alter table public.verse_feedback enable row level security;

-- Any signed-in user (including anonymous/guest sessions) can file feedback
-- as themselves.
create policy "Users can file verse feedback"
  on public.verse_feedback for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can view their own feedback"
  on public.verse_feedback for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can view all feedback"
  on public.verse_feedback for select
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update feedback"
  on public.verse_feedback for update
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
