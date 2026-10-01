#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

# Run in a clean checkout: Next loads these files even when shell variables exist.
for file in .env .env.local .env.production .env.production.local; do
  if [[ -f "$file" ]]; then
    printf 'Refusing credential-free verification with %s present. Use a clean checkout.\n' "$file" >&2
    exit 1
  fi
done

# Compilation only. These placeholders provide no access to a real backend.
export NEXT_PUBLIC_SUPABASE_URL=https://cloud-build-placeholder.invalid
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=cloud-build-placeholder
export NEXT_PUBLIC_APP_URL=http://localhost:3000
unset NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SECRET_KEY SUPABASE_SERVICE_ROLE_KEY GEMINI_API_KEY
export NEXT_TELEMETRY_DISABLED=1

npm test
npm run lint
npm run build

