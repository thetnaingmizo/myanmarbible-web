#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

# The existing test runner uses Node's built-in TypeScript stripping.
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 18)) { console.error("Use Node 22.18+ (recommended: Node 22 LTS)."); process.exit(1); }'
npm ci --no-audit --no-fund

