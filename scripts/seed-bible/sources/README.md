# sources/

Raw source files for Bible translations that are NOT downloaded automatically
by `download.ts` (which caches USFX downloads in `.data/`).

Drop files here and a matching parser/seeder in the pipeline turns them into
`translations` / `books` / `verses` rows.

- `mizo.sql` — Mizo Bible dump provided by the owner (any name is fine; tell
  the seeder which file). Planned: parse → seed as a new translation alongside
  KJV/Judson/MGB.

Note: files here are committed to git (like `supabase/seed.sql`) unless they
are enormous — if a file exceeds ~100 MB, gitignore it and document where the
original lives.
