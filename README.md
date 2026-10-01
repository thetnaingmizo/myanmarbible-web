# MyanmarBible AI

AI-powered bilingual (Myanmar/English) Bible study web application.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict mode)
- **UI**: React 19, Tailwind CSS v4, shadcn/ui
- **Database**: Supabase (PostgreSQL + Auth)
- **AI**: Google Gemini (`@google/genai`)
- **i18n**: next-intl (locales: `my` default, `en`)
- **State**: Zustand (client stores), Zod (validation)

## Features

| Feature | Route | Auth | Description |
|---------|-------|------|-------------|
| Bible Browser | `/bible` | Public | Browse translations, books, chapters, verses |
| Bible Characters | `/characters` | Public | ~50 character profiles with bios and key verses |
| AI Chat | `/chat` | Login | Ask Bible questions, get AI-powered answers |
| Verse Finder | `/verse-finder` | Login | Find verses by topic/emotion with AI |
| Bible Trivia | `/trivia` | Login | AI-generated quiz with leaderboard |

## Getting Started

For credential-free cloud preparation, verification scripts, and the development
backend decision, see [Codex Cloud setup](docs/codex-cloud.md).

### Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Google Gemini API key

### Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY

# Start local Supabase
npm run db:start

# Apply migrations
npm run db:reset

# Seed data (in order)
npm run db:seed-bible
npm run db:seed-characters
npm run db:generate-embeddings    # Optional, needed for AI features

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/
    layout.tsx                        # Root layout (minimal shell)
    [locale]/
      layout.tsx                      # Locale layout (fonts, header, footer)
      page.tsx                        # Landing page
      (auth)/                         # Login, register, forgot-password
      (app)/                          # Main features
        bible/                        # Bible browser
        characters/                   # Bible characters
        chat/                         # AI chat
        trivia/                       # Bible trivia
        verse-finder/                 # AI verse finder
        profile/                      # User profile
        settings/                     # User settings
      (admin)/admin/                  # Admin panel
    api/
      auth/callback/                  # OAuth callback
      v1/                             # API routes (Flutter-compatible)
  components/
    ui/                               # shadcn/ui primitives
    header.tsx, footer.tsx, ...       # App shell components
  lib/
    auth/                             # Auth actions & session helper
    bible/queries.ts                  # Bible data queries
    characters/queries.ts             # Character queries
    gemini/                           # AI client & feature logic
    supabase/                         # Supabase clients (browser/server/service)
    chat/, trivia/, verse-finder/     # Feature stores & types
  i18n/                               # next-intl config
  proxy.ts                            # Next.js 16 proxy (replaces middleware)
  types/database.ts                   # Auto-generated Supabase types
messages/
  en.json                             # English translations
  my.json                             # Myanmar translations
scripts/                              # See scripts/README.md
  seed-bible/                         # Bible data seeder
  seed-characters/                    # Character profile seeder
  generate-embeddings.ts              # Verse embedding generator
supabase/
  migrations/                         # SQL migrations
```

## Key Architecture Decisions

### Proxy instead of Middleware
Next.js 16 uses `src/proxy.ts` instead of `middleware.ts`. It combines:
- next-intl locale routing
- Supabase session refresh
- Route protection (auth + admin role checks)

### API Design
- Public APIs: `/api/v1/*` (no locale prefix, Flutter-compatible)
- Admin APIs: `/api/admin/v1/*`
- Response format: `apiSuccess(data, meta)` / `apiError(code, message, status)`

### Supabase Clients
- `client.ts` — Browser-side (client components)
- `server.ts` — Server-side (RSC, server actions)
- `service.ts` — Service-role (bypasses RLS, admin operations)

### i18n
- Default locale: `my` (Myanmar)
- Route structure: `/[locale]/...`
- Translation files: `messages/en.json`, `messages/my.json`
- Server: `getTranslations("Namespace")`, Client: `useTranslations("Namespace")`

### Database Conventions
- Testament values: `"OT"` / `"NT"` (not "old"/"new") — enforced by CHECK constraints
- Content status: `"draft"` | `"published"` | `"archived"` (enum `content_status`)
- All tables use UUID primary keys
- Timestamps: `created_at`, `updated_at` with defaults

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run db:start` | Start local Supabase |
| `npm run db:stop` | Stop local Supabase |
| `npm run db:reset` | Reset DB & apply migrations |
| `npm run db:gen-types` | Regenerate TypeScript types from DB |
| `npm run db:seed-bible` | Seed Bible translations & verses |
| `npm run db:seed-bible:verify` | Verify seeded Bible data |
| `npm run db:seed-characters` | Generate & seed Bible characters |
| `npm run db:generate-embeddings` | Generate verse embeddings for RAG |

See [scripts/README.md](scripts/README.md) for detailed script documentation.
