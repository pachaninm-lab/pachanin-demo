#!/bin/bash
set -e

echo "→ preflight checks"

if [ -f "./scripts/audit-fgis-deploy-readiness.mjs" ]; then
  node ./scripts/audit-fgis-deploy-readiness.mjs
else
  echo "↷ skip audit-fgis-deploy-readiness (file not found)"
fi

echo "→ deploy"

# Production is deployed by the Netlify Git integration on push to main
# (see netlify.toml). There is no manual CLI deploy step.
echo "↷ Push to 'main' to trigger the Netlify production deploy."

echo "✓ preflight complete"
