-- ============================================================
-- AI cost safety (3.0 release prep)
-- ============================================================

-- Spend must outlive the account: with ON DELETE CASCADE, someone could use
-- their questions, delete the (guest) account and repeat, and the global
-- daily cap would never see that spend.
alter table public.ai_usage drop constraint ai_usage_user_id_fkey;
alter table public.ai_usage add constraint ai_usage_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- Guard for calls that don't take a question (topic search by meaning):
-- respects the off switch and the global daily cap, and allows [p_per_day]
-- such calls per person per day. Raises the same codes as consume_ai_quota.
create or replace function public.check_ai_free_call(p_kind text, p_per_day int)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.ai_settings;
  day_start timestamptz := public.ai_today()::timestamp at time zone 'Asia/Yangon';
  spent numeric;
  used int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into s from public.ai_settings where id;
  if not s.enabled then raise exception 'ai_disabled'; end if;
  select coalesce(sum(cost_usd), 0) into spent from public.ai_usage where created_at >= day_start;
  if spent >= s.daily_cap_usd then raise exception 'global_cap'; end if;
  select count(*) into used from public.ai_usage
    where user_id = auth.uid() and kind = p_kind and created_at >= day_start;
  if used >= p_per_day then raise exception 'daily_limit'; end if;
end;
$$;
revoke all on function public.check_ai_free_call(text, int) from public, anon;
grant execute on function public.check_ai_free_call(text, int) to authenticated;

-- Security-definer functions must not resolve names through the caller's
-- search_path (Supabase advisor: function_search_path_mutable).
alter function public.handle_new_user() set search_path = public;
alter function public.update_question_upvote_count() set search_path = public;

-- Only signed-in users need their quota (signed out it just returned 0).
revoke all on function public.ai_quota_left() from public, anon;
grant execute on function public.ai_quota_left() to authenticated;
