-- Question Votes table for per-user upvote tracking
create table public.question_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index idx_question_votes_question on public.question_votes (question_id);

-- RLS
alter table public.question_votes enable row level security;
create policy "Users can view own votes" on public.question_votes for select using (auth.uid() = user_id);
create policy "Users can vote" on public.question_votes for insert with check (auth.uid() = user_id);
create policy "Users can unvote" on public.question_votes for delete using (auth.uid() = user_id);

-- Trigger to keep upvote_count in sync
create or replace function update_question_upvote_count() returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.questions set upvote_count = upvote_count + 1 where id = NEW.question_id;
  elsif TG_OP = 'DELETE' then
    update public.questions set upvote_count = upvote_count - 1 where id = OLD.question_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger trg_question_votes_count
  after insert or delete on public.question_votes
  for each row execute function update_question_upvote_count();
