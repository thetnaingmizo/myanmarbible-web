-- Highlights and notes on the website (founder decision 2026-09-28, Q3).
-- One row per user + verse. Phones keep their markers on the device in 3.0;
-- syncing the two is a later feature. Deleting the account (auth.users)
-- deletes these rows.

create table public.web_markers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  verse_id uuid not null references public.verses (id) on delete cascade,
  -- The app's five named highlights; null = no highlight.
  highlight text check (highlight in ('promise', 'prayer', 'teaching', 'warning', 'remember')),
  note text check (char_length(note) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, verse_id),
  -- A row only exists while it holds something.
  check (highlight is not null or nullif(btrim(note), '') is not null)
);

create index web_markers_user_updated on public.web_markers (user_id, updated_at desc);

alter table public.web_markers enable row level security;

create policy "Users read own markers" on public.web_markers
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users add own markers" on public.web_markers
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users change own markers" on public.web_markers
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users delete own markers" on public.web_markers
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.touch_web_marker()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger web_markers_touch before update on public.web_markers
  for each row execute function public.touch_web_marker();
