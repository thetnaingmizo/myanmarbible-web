# MyanmarBible web

Next.js 16 / React 19 website. This repository also owns the Supabase migrations
and seeds consumed by the separate `antaresbyte/myanmarbible-app` Flutter repo.
Read `CLAUDE.md` for project conventions. Parent workspace files and shared
`../docs/` are not part of this Git repository; do not assume they exist in cloud.

## Cloud setup and checks

- Use Node 22 LTS, version 22.18 or newer.
- Install: `bash scripts/codex/install.sh`.
- Credential-free checks in a clean checkout: `bash scripts/codex/verify.sh`.
  This runs tests, lint, and compilation with nonfunctional backend placeholders.
  It does not verify authentication, database data, or AI features.
- See `docs/codex-cloud.md` for configuration and the remaining runtime setup.
- Never use the production backend for cloud development. Do not copy local
  credentials, reset databases, seed data, generate paid AI content, or deploy
  functions as part of dependency installation.
- `localhost` in cloud refers to that cloud VM, not the developer's Mac.

