# Codex Cloud preparation

Start with `thetnaingmizo/myanmarbible-web`. Flutter native/device builds remain
outside this initial setup. Current Codex Cloud can select multiple repositories,
but the parent workspace's shared `docs/` is outside both Git repos and is not
automatically included.

## Configuration without backend access

1. Settings → Codex Cloud → Environments → Create environment.
2. Select the web GitHub repo and connect GitHub if prompted. The local working
   branch inspected on 2026-10-01 was `v3-redesign`, commit `a1350e7`; choose the
   intended current base explicitly instead of assuming the GitHub default.
   These preparation files must be committed and pushed to the selected branch
   before cloud can obtain them.
3. Request Node 22 LTS (22.18+), Bash, and the locked dependencies using
   `bash scripts/codex/install.sh` from this repo's root. `npm ci` includes the
   Supabase CLI and native SQLite dependency; Linux may need compiler/Python
   tools if a native prebuilt binary is unavailable.
4. Enable package-manager network access. Allow `fonts.googleapis.com` and
   `fonts.gstatic.com` for the existing `next/font/google` build. If an install
   download fails, inspect its exact host before adding it to the allowlist.
5. Run `bash scripts/codex/verify.sh` in the clean checkout. It intentionally
   refuses local env files and uses invalid backend placeholders. Passing checks
   establishes compilation and unit-test compatibility, not a usable full stack.
6. Review the setup report. Keep the environment unpublished until cloud checks
   and the development-backend decision are complete.

## Runtime decision still required

Choose one before testing database-backed pages:

- A separate, existing hosted **development** Supabase project with this repo's
  schema and appropriate test data. Supply its URL and publishable key in the
  environment settings and allow that exact HTTPS host. Do not use the production
  project. Migrations/seeding need a separate explicit decision.
- An isolated Supabase Docker stack **inside the cloud VM**, if its container
  runtime is supported and verified there. `npm run db:start` needs a Docker API;
  installing the CLI alone is insufficient. Do not reset an existing stack.

Never point cloud at `http://127.0.0.1:54321` expecting it to reach the Mac.
The preparation scripts do not start, create, migrate, reset, or seed a backend.

For runtime, use real development values for `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy anon fallback is supported).
`NEXT_PUBLIC_APP_URL` must match the chosen preview origin for sign-in callbacks;
configure that origin in development Auth settings before testing OAuth.
Then start with `npm run dev -- --hostname 0.0.0.0`, check an actual HTTP response,
and verify Bible data, guest/auth flows, and backend-backed routes.

AI has two paths: the web Gemini client reads `GEMINI_API_KEY`, while the Ask UI
calls the shared Supabase `ai-chat` Edge Function. A web Gemini key alone does
not configure that function. Leave AI credentials unset in the initial setup;
any later runtime test needs development-only access and a cost decision.
Use cloud environment variables or network secrets appropriate to each SDK;
do not commit credentials or copy this Mac's `.env.local`.

## Verification scope

Local clean-checkout results are recorded below after running the scripts.
No actual Codex Cloud environment has been created, published, or tested by this
preparation. No production backend or paid service is required for these checks.

Verified on 2026-10-01 in a temporary checkout of `a1350e7` plus these scripts,
without local env files, using macOS / Node 22.23.1 / npm 10.9.8:

- Both scripts passed Bash syntax checks; the install script installed 925 locked
  packages. Existing dependency deprecation notices remain.
- All 5 existing unit tests passed. ESLint: 0 errors, 10 existing warnings.
- Production build and its TypeScript check passed. The first build attempt
  failed to download Google Fonts under restricted networking; rerunning with
  network access succeeded. Existing `metadataBase` warning remains.
- Verification correctly refused a checkout containing `.env.local`.
- Existing Mac `supabase_*_myanmarbible-web` containers were running; Auth health
  at `http://127.0.0.1:54321/auth/v1/health` returned HTTP 200. No web listener on
  port 3000. No backend data was changed or used by the compilation checks.

Linux native dependency installation, cloud network policy, and runtime flows
remain unverified until an actual cloud setup runs.

## Parallel work and merge plan

The fastest first step is a backend-free web environment. Cloud owns independent
web changes, unit tests, lint, and builds; use explicit test doubles for any task
that needs simulated backend responses. The build placeholders are not mocks
and cannot make database-backed pages function. The Mac owns real Supabase
integration, browser/OAuth checks, and Flutter native/device checks. Run those
after reviewing cloud diffs, one integration batch at a time to limit Mac load.
Current official cloud docs list computer/browser use as unsupported; keep
interactive browser acceptance on the Mac.

OpenAI documents cloud VMs and service installation, but the current official
cloud guide does **not** establish a supported Docker daemon or Supabase Docker
workflow. Do not claim Docker is supported or unsupported based only on that
omission. In a cloud setup, first check `docker version` and `docker info`, then
image downloads, service startup, health, storage, and restart behavior on a
fresh isolated VM. Only after that should a cloud-local backend be recommended.
The install script deliberately does not attempt this. Supabase requires a
Docker-compatible runtime; the CLI alone cannot replace it.

An isolated hosted development Supabase project is the simpler later option
for cloud data access: it needs an existing project, matching migrations and
safe test data, URL/key access, allowed hosts, and Auth callback configuration.
Use one schema owner and avoid concurrent schema edits against a shared dev DB.
Supabase currently offers a Free plan with 2 active projects, 500 MB database
size, and inactivity pausing; eligibility and data size have not been checked.
Additional projects on paid plans can incur compute charges. Confirm account
capacity and costs before creating anything; no service was created here.
See [Supabase pricing](https://supabase.com/pricing).

For each cloud chat, specify the repo, common base commit, unique feature branch,
files/features it owns, and checks required. Keep simultaneous assignments in
different areas (for example reader text versus podcast presentation); serialize
shared layout, auth, package/lockfile, and migration changes. Each result should
be a separate PR to the agreed integration branch, with its verification scope
and any mocked behavior stated. Review and merge one PR at a time, update the
next branch from that integration branch, rerun relevant checks, and perform
Mac integration before release. Pull merged GitHub changes into the local repo;
do not overwrite local working files with copied cloud folders.

The Flutter repo has independent history and requires its own branches/PRs.
Keep schema changes in this web repo, and pair related web/app PRs with an
explicit compatible migration order. Supply relevant shared specs in each task
or intentionally commit a scoped copy; cloud cannot fetch the untracked parent
`docs/` folder from GitHub. No CI or deployment changes are part of this setup.

Official references:
- [OpenAI cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments)
- [Supabase local development](https://supabase.com/docs/guides/local-development)
