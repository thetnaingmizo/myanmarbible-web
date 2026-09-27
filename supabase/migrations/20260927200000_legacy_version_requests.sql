-- ============================================================
-- Bibles v2.1 users had that 3.0 can't offer yet (features/02 step 5).
-- The upgrade screen files one row per missing Bible, so the admin can
-- see which to add first (replaces guessing from old analytics).
-- ============================================================
create table public.legacy_version_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  short_name text not null,             -- v2.1 Version.shortName, e.g. 'CHINKJV'
  long_name text,
  preset_name text,                     -- v2.1 catalogue id, e.g. 'cfm-chinkjv'
  locale text,
  created_at timestamptz not null default now(),
  unique (user_id, short_name)
);
alter table public.legacy_version_requests enable row level security;
create policy "Users file their own legacy Bibles" on public.legacy_version_requests for insert
  to authenticated with check (user_id = auth.uid());
-- Needed for insert … on conflict do nothing (the app files each Bible once).
create policy "Users see their own legacy Bibles" on public.legacy_version_requests for select
  using (user_id = auth.uid());
create policy "Admins see legacy Bible requests" on public.legacy_version_requests for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
