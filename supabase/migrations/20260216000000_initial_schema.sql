-- MyanmarBible AI - Initial Database Schema
-- Enable required extensions
create extension if not exists "vector" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- ============================================================
-- ENUMS
-- ============================================================
create type public.user_role as enum ('user', 'admin');
create type public.content_status as enum ('draft', 'published', 'archived');
create type public.difficulty_level as enum ('easy', 'medium', 'hard');
create type public.question_status as enum ('pending', 'approved', 'rejected');
create type public.message_role as enum ('user', 'assistant', 'system');

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role public.user_role not null default 'user',
  denomination text,
  preferred_locale text not null default 'my',
  preferred_translation_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- BIBLE DATA
-- ============================================================
create table public.translations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,         -- e.g., 'judson', 'kjv'
  name_en text not null,
  name_my text,
  language text not null,            -- 'my' or 'en'
  is_default boolean not null default false,
  is_licensed boolean not null default false,
  license_info text,
  source_url text,
  created_at timestamptz not null default now()
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  translation_id uuid not null references public.translations(id) on delete cascade,
  book_number smallint not null,      -- 1-66
  name_en text not null,
  name_my text,
  abbreviation_en text not null,
  abbreviation_my text,
  testament text not null check (testament in ('OT', 'NT')),
  chapter_count smallint not null,
  created_at timestamptz not null default now(),
  unique (translation_id, book_number)
);

create table public.verses (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_number smallint not null,
  verse_number smallint not null,
  text text not null,
  text_search tsvector generated always as (to_tsvector('simple', text)) stored,
  created_at timestamptz not null default now(),
  unique (book_id, chapter_number, verse_number)
);

create index idx_verses_text_search on public.verses using gin (text_search);
create index idx_verses_book_chapter on public.verses (book_id, chapter_number);

-- ============================================================
-- VERSE EMBEDDINGS (for RAG)
-- ============================================================
create table public.verse_embeddings (
  id uuid primary key default gen_random_uuid(),
  verse_id uuid not null references public.verses(id) on delete cascade unique,
  embedding extensions.vector(768) not null,
  model text not null default 'gemini-embedding-001',
  created_at timestamptz not null default now()
);

create index idx_verse_embeddings_vector on public.verse_embeddings
  using ivfflat (embedding extensions.vector_cosine_ops) with (lists = 100);

-- ============================================================
-- CHAT
-- ============================================================
create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_chat_conversations_user on public.chat_conversations (user_id, updated_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  verse_references jsonb,            -- [{book, chapter, verse, text}]
  token_count int,
  created_at timestamptz not null default now()
);

create index idx_chat_messages_conversation on public.chat_messages (conversation_id, created_at);

-- ============================================================
-- VERSE CATEGORIES & COLLECTIONS
-- ============================================================
create table public.verse_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_my text,
  description_en text,
  description_my text,
  icon text,
  sort_order int not null default 0,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.verse_collections (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.verse_categories(id) on delete set null,
  slug text not null unique,
  title_en text not null,
  title_my text,
  description_en text,
  description_my text,
  verse_ids uuid[] not null default '{}',
  image_url text,
  status public.content_status not null default 'draft',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CHARACTERS
-- ============================================================
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_my text,
  description_en text,
  description_my text,
  bio_en text,
  bio_my text,
  key_verse_ids uuid[] not null default '{}',
  image_url text,
  testament text check (testament in ('OT', 'NT')),
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- LESSONS
-- ============================================================
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_my text,
  summary_en text,
  summary_my text,
  content_en text,                   -- Markdown
  content_my text,                   -- Markdown
  key_verse_ids uuid[] not null default '{}',
  image_url text,
  status public.content_status not null default 'draft',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TRIVIA
-- ============================================================
create table public.trivia_questions (
  id uuid primary key default gen_random_uuid(),
  question_en text not null,
  question_my text,
  options_en jsonb not null,          -- ["opt1", "opt2", "opt3", "opt4"]
  options_my jsonb,
  correct_index smallint not null,
  explanation_en text,
  explanation_my text,
  difficulty public.difficulty_level not null default 'medium',
  category text,
  verse_reference text,
  is_ai_generated boolean not null default false,
  status public.question_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.trivia_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score int not null,
  total_questions int not null,
  difficulty public.difficulty_level not null,
  category text,
  completed_at timestamptz not null default now()
);

create index idx_trivia_scores_user on public.trivia_scores (user_id, completed_at desc);
create index idx_trivia_scores_leaderboard on public.trivia_scores (score desc, completed_at);

-- ============================================================
-- COMMUNITY Q&A
-- ============================================================
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  slug text not null unique,
  title_en text not null,
  title_my text,
  body_en text,
  body_my text,
  answer_en text,
  answer_my text,
  answered_by uuid references auth.users(id) on delete set null,
  upvote_count int not null default 0,
  status public.question_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- BLOG
-- ============================================================
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  slug text not null unique,
  title_en text not null,
  title_my text,
  excerpt_en text,
  excerpt_my text,
  content_en text,                   -- Markdown
  content_my text,                   -- Markdown
  image_url text,
  tags text[] not null default '{}',
  status public.content_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_blog_posts_published on public.blog_posts (published_at desc) where status = 'published';

-- ============================================================
-- PODCAST
-- ============================================================
create table public.podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_my text,
  description_en text,
  description_my text,
  audio_url text not null,
  duration_seconds int,
  image_url text,
  tags text[] not null default '{}',
  status public.content_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- BOOKMARKS
-- ============================================================
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  verse_id uuid not null references public.verses(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, verse_id)
);

create index idx_bookmarks_user on public.bookmarks (user_id, created_at desc);

-- ============================================================
-- TESTIMONIALS
-- ============================================================
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_title text,
  author_avatar_url text,
  content_en text not null,
  content_my text,
  rating smallint check (rating between 1 and 5),
  is_featured boolean not null default false,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now()
);

-- ============================================================
-- FAQS
-- ============================================================
create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question_en text not null,
  question_my text,
  answer_en text not null,
  answer_my text,
  sort_order int not null default 0,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now()
);

-- ============================================================
-- SITE SETTINGS
-- ============================================================
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger to tables that have it
create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.chat_conversations
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.verse_collections
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.characters
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.lessons
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.questions
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.blog_posts
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.site_settings
  for each row execute function public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Profiles
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Translations (public read)
alter table public.translations enable row level security;

create policy "Translations are viewable by everyone"
  on public.translations for select using (true);

create policy "Only admins can manage translations"
  on public.translations for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Books (public read)
alter table public.books enable row level security;

create policy "Books are viewable by everyone"
  on public.books for select using (true);

create policy "Only admins can manage books"
  on public.books for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Verses (public read)
alter table public.verses enable row level security;

create policy "Verses are viewable by everyone"
  on public.verses for select using (true);

create policy "Only admins can manage verses"
  on public.verses for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Verse embeddings (service role only via API, no direct user access)
alter table public.verse_embeddings enable row level security;

create policy "Embeddings readable by authenticated users"
  on public.verse_embeddings for select using (auth.role() = 'authenticated');

-- Chat conversations (user-scoped)
alter table public.chat_conversations enable row level security;

create policy "Users can view own conversations"
  on public.chat_conversations for select using (auth.uid() = user_id);

create policy "Users can create own conversations"
  on public.chat_conversations for insert with check (auth.uid() = user_id);

create policy "Users can update own conversations"
  on public.chat_conversations for update using (auth.uid() = user_id);

create policy "Users can delete own conversations"
  on public.chat_conversations for delete using (auth.uid() = user_id);

-- Chat messages (user-scoped via conversation)
alter table public.chat_messages enable row level security;

create policy "Users can view own messages"
  on public.chat_messages for select using (
    exists (select 1 from public.chat_conversations where id = conversation_id and user_id = auth.uid())
  );

create policy "Users can create messages in own conversations"
  on public.chat_messages for insert with check (
    exists (select 1 from public.chat_conversations where id = conversation_id and user_id = auth.uid())
  );

-- Verse categories (public read for published)
alter table public.verse_categories enable row level security;

create policy "Published verse categories are viewable"
  on public.verse_categories for select using (status = 'published');

create policy "Admins can manage verse categories"
  on public.verse_categories for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Verse collections (public read for published)
alter table public.verse_collections enable row level security;

create policy "Published verse collections are viewable"
  on public.verse_collections for select using (status = 'published');

create policy "Admins can manage verse collections"
  on public.verse_collections for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Characters (public read for published)
alter table public.characters enable row level security;

create policy "Published characters are viewable"
  on public.characters for select using (status = 'published');

create policy "Admins can manage characters"
  on public.characters for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Lessons (public read for published)
alter table public.lessons enable row level security;

create policy "Published lessons are viewable"
  on public.lessons for select using (status = 'published');

create policy "Admins can manage lessons"
  on public.lessons for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Trivia questions (published ones are public)
alter table public.trivia_questions enable row level security;

create policy "Approved trivia questions are viewable"
  on public.trivia_questions for select using (status = 'approved');

create policy "Admins can manage trivia questions"
  on public.trivia_questions for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Trivia scores (user-scoped + leaderboard read)
alter table public.trivia_scores enable row level security;

create policy "Trivia scores are viewable by everyone"
  on public.trivia_scores for select using (true);

create policy "Users can create own trivia scores"
  on public.trivia_scores for insert with check (auth.uid() = user_id);

-- Questions (public read for approved)
alter table public.questions enable row level security;

create policy "Approved questions are viewable"
  on public.questions for select using (status = 'approved');

create policy "Users can submit questions"
  on public.questions for insert with check (auth.uid() = user_id);

create policy "Admins can manage questions"
  on public.questions for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Blog posts (public read for published)
alter table public.blog_posts enable row level security;

create policy "Published blog posts are viewable"
  on public.blog_posts for select using (status = 'published');

create policy "Admins can manage blog posts"
  on public.blog_posts for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Podcast episodes (public read for published)
alter table public.podcast_episodes enable row level security;

create policy "Published podcast episodes are viewable"
  on public.podcast_episodes for select using (status = 'published');

create policy "Admins can manage podcast episodes"
  on public.podcast_episodes for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Bookmarks (user-scoped)
alter table public.bookmarks enable row level security;

create policy "Users can view own bookmarks"
  on public.bookmarks for select using (auth.uid() = user_id);

create policy "Users can create own bookmarks"
  on public.bookmarks for insert with check (auth.uid() = user_id);

create policy "Users can delete own bookmarks"
  on public.bookmarks for delete using (auth.uid() = user_id);

-- Testimonials (public read for published)
alter table public.testimonials enable row level security;

create policy "Published testimonials are viewable"
  on public.testimonials for select using (status = 'published');

create policy "Admins can manage testimonials"
  on public.testimonials for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- FAQs (public read for published)
alter table public.faqs enable row level security;

create policy "Published FAQs are viewable"
  on public.faqs for select using (status = 'published');

create policy "Admins can manage FAQs"
  on public.faqs for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Site settings (public read)
alter table public.site_settings enable row level security;

create policy "Site settings are viewable by everyone"
  on public.site_settings for select using (true);

create policy "Admins can manage site settings"
  on public.site_settings for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- HELPER FUNCTION: Vector similarity search
-- ============================================================
create or replace function public.match_verses(
  query_embedding extensions.vector(768),
  match_threshold float default 0.5,
  match_count int default 10
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
  select
    v.id as verse_id,
    v.book_id,
    v.chapter_number,
    v.verse_number,
    v.text,
    1 - (ve.embedding <=> query_embedding) as similarity
  from public.verse_embeddings ve
  join public.verses v on v.id = ve.verse_id
  where 1 - (ve.embedding <=> query_embedding) > match_threshold
  order by ve.embedding <=> query_embedding
  limit match_count;
$$;
