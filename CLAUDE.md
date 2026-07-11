# myanmarbible-web (Next.js)

Myanmar Bible website AND the source of truth for the shared Supabase backend.
Part of a two-repo workspace — read `../CLAUDE.md` first. The Flutter app
(`../myanmarbible-app`) consumes this project's database, so treat schema changes
to `translations`, `books`, `verses`, `profiles` as cross-project changes.

## Stack & run

- Next.js 16 (App Router) + next-intl (`en`/`my`), Tailwind, shadcn-style
  components. `npm run dev` → http://localhost:3000.
- Local Supabase: `npm run db:start` (API :54321, db :54322, Studio :54323),
  `npm run db:reset` re-applies migrations + seeds. After schema changes run
  `npm run db:gen-types` to refresh `src/types/database.ts`.
- Seeding: `npm run db:seed-bible` (KJV + Judson, ~60.8k verses; `supabase/seed.sql`
  is a 42 MB generated dump — never open/edit it by hand), plus
  `db:seed-characters|lessons|blog|podcast|questions` and
  `db:generate-embeddings` for the chat/verse-finder vectors.

## Conventions

- Bible routes: `/[locale]/bible/[bookId]/[chapter]` where `bookId` is a
  per-translation **UUID**, not a slug.
- Auth-gated routes: verse-finder, trivia, chat, bookmarks, settings, profile.
- `enable_anonymous_sign_ins = true` in `supabase/config.toml` must stay on —
  the Flutter app's guest login depends on it.
- Features live under `src/` per the App Router; content features: blog,
  characters, lessons, podcast, questions, trivia (trivia table currently empty).
