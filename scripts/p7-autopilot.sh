#!/usr/bin/env bash
set -euo pipefail

# Runs platform-v7 PR 5.1 autopilot checks locally or in CI.
# The guard keeps the PR inside the approved application-service scope.

bash scripts/p7-autopilot-guard.sh

if command -v pnpm >/dev/null 2>&1; then
  pnpm install --frozen-lockfile
  pnpm run typecheck
  pnpm test
else
  npm install --ignore-scripts --no-audit --no-fund
  npm run typecheck
  npm test
fi

echo "platform-v7 autopilot checks completed"
