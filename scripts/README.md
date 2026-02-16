# Scripts

All scripts live under `scripts/` and are run via `npx tsx`. They are **excluded from the main tsconfig** and use their own direct imports (no `@/` aliases).

## Quick Reference

| Command | Description | Time | Requires |
|---------|-------------|------|----------|
| `npm run db:seed-bible` | Seed Judson + KJV translations | ~2 min | Supabase |
| `npm run db:seed-bible -- --only judson` | Seed Myanmar Judson only | ~1 min | Supabase |
| `npm run db:seed-bible -- --only kjv` | Seed KJV only | ~1 min | Supabase |
| `npm run db:seed-bible -- --download-only` | Download & parse only (no DB) | ~30s | None |
| `npm run db:seed-bible:verify` | Verify seeded Bible data | ~5s | Supabase |
| `npm run db:seed-characters` | Generate & seed ~50 Bible characters | ~3-5 min | Supabase + Gemini |
| `npm run db:seed-questions` | Generate & seed ~15 Bible Q&As | ~2-3 min | Supabase + Gemini |
| `npm run db:generate-embeddings` | Generate verse embeddings | ~30 min | Supabase + Gemini |
| `npm run db:generate-embeddings -- --only judson` | Embeddings for Judson only | ~15 min | Supabase + Gemini |
| `npm run db:generate-embeddings -- --only kjv` | Embeddings for KJV only | ~15 min | Supabase + Gemini |

## Prerequisites

All scripts read environment variables from `.env.local` (or `.env` fallback):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
GEMINI_API_KEY=<your-gemini-api-key>          # For seed-characters, seed-questions & generate-embeddings
```

Get local Supabase keys with:
```bash
npx supabase status
```

## Recommended Seed Order

Run these in order after a fresh `npm run db:reset`:

```bash
# 1. Seed Bible translations, books, and verses
npm run db:seed-bible

# 2. Verify the Bible data looks correct
npm run db:seed-bible:verify

# 3. Seed Bible characters (needs Bible data for verse lookups)
npm run db:seed-characters

# 4. Seed Bible Q&As (bilingual questions & answers)
npm run db:seed-questions

# 5. Generate verse embeddings (needed for AI Verse Finder / RAG)
npm run db:generate-embeddings
```

## Shared Patterns

All scripts follow the same conventions:

- **Environment loading**: Manual `.env.local` parsing (no dotenv dependency)
- **Supabase client**: Direct `@supabase/supabase-js` with service-role key (bypasses RLS)
- **Idempotent**: All use upsert (ON CONFLICT) — safe to re-run anytime
- **Path resolution**: Uses `fileURLToPath(import.meta.url)` + `dirname()` to find project root
- **Progress logging**: Console output with step counts and timing

## Directory Structure

```
scripts/
  README.md                      # This file
  generate-embeddings.ts         # Verse embedding generator
  seed-bible/
    README.md                    # Detailed seed-bible docs
    .gitignore                   # Ignores .data/ download cache
    .data/                       # Downloaded USFX XML files (gitignored)
    index.ts                     # Entry point & CLI
    config.ts                    # Translations, 66 books, constants
    download.ts                  # Downloads USFX ZIP from eBible.org
    parse-usfx.ts                # Parses USFX XML into verses
    seed.ts                      # Upserts translations/books/verses
    verify.ts                    # Quick DB verification
  seed-characters/
    README.md                    # Detailed seed-characters docs
    character-list.ts            # Static list of ~50 characters
    seed.ts                      # Gemini generation + DB upsert
  seed-questions/
    question-list.ts             # Static list of ~15 Bible questions
    seed.ts                      # Gemini generation + DB upsert
```

## Adding a New Seed Script

1. Create `scripts/seed-<name>/` directory
2. Follow the env-loading pattern from existing scripts
3. Use `createClient()` from `@supabase/supabase-js` directly (not the app's `src/lib/supabase/` wrappers)
4. Make it idempotent with upsert
5. Add an npm script in `package.json` under `"scripts"`: `"db:seed-<name>": "npx tsx scripts/seed-<name>/seed.ts"`
6. Update this README
