#!/bin/bash
set -e

echo "→ preflight checks"

if [ -f "./scripts/audit-fgis-deploy-readiness.mjs" ]; then
  node ./scripts/audit-fgis-deploy-readiness.mjs
else
  echo "↷ skip audit-fgis-deploy-readiness (file not found)"
fi

echo "→ vercel deploy"

if command -v vercel >/dev/null 2>&1; then
  vercel --prod
else
  echo "✗ vercel CLI not installed"
  exit 1
fi

echo "✓ pilot deploy complete"
