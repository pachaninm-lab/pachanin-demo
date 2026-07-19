#!/usr/bin/env bash
set -euo pipefail

TARGET_SHA="${1:-$(git rev-parse HEAD)}"

echo "→ preflight checks"

if [ -f "./scripts/audit-fgis-deploy-readiness.mjs" ]; then
  node ./scripts/audit-fgis-deploy-readiness.mjs
else
  echo "↷ skip audit-fgis-deploy-readiness (file not found)"
fi

if [ -f "./scripts/check-production-hosting-authority.mjs" ]; then
  node ./scripts/check-production-hosting-authority.mjs
fi

echo "→ production authority"
echo "  domain: https://процент-агро.рф"
echo "  platform: REG.RU virtual server"
echo "  recorded IPv4: 195.19.12.120 (verify DNS before access)"
echo "  runtime: Caddy + Docker Compose"
echo "  target Git SHA: ${TARGET_SHA}"

echo "→ deployment boundary"
echo "  This script does not open SSH sessions and does not modify production."
echo "  Merge/build success is not deployment proof."
echo "  Follow docs/ops/virtual-server-production-runbook.md."
echo "  Require the running container OCI revision to equal ${TARGET_SHA}."
echo "  Then run docs/ops/vps-post-deploy-checklist.md against the live domain."

echo "✓ preflight complete; virtual-server deployment remains pending until verified"
