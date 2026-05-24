#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${BASE_REF:-origin/main}"
HEAD_REF="${HEAD_REF:-HEAD}"

if git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  DIFF_FILES=$(git diff --name-only "$BASE_REF...$HEAD_REF")
else
  DIFF_FILES=$(git diff --name-only "HEAD~1...$HEAD_REF")
fi

echo "platform-v7 autopilot guard"
echo "Changed files:"
printf '%s\n' "$DIFF_FILES"

FORBIDDEN_PATHS='^(apps/landing/|apps/web/app/platform-v7/|apps/web/components/platform-v7/|apps/web/components/v7r/|apps/web/lib/platform-v7/adapters/|apps/web/lib/platform-v7/ai/|package-lock\.json$)'

if printf '%s\n' "$DIFF_FILES" | grep -E "$FORBIDDEN_PATHS"; then
  echo "Forbidden path changed for PR 5.1 autopilot scope."
  exit 1
fi

ALLOWED='^(apps/web/lib/platform-v7/runtime/application-service\.ts|apps/web/lib/platform-v7/runtime/application-service-types\.ts|apps/web/tests/unit/platformV7RuntimeApplicationServices\.test\.ts|docs/platform-v7/execution-queue\.md|docs/platform-v7/autopilot/.*|scripts/p7-autopilot-guard\.sh|\.github/workflows/platform-v7-autopilot-guard\.yml)$'

DISALLOWED=$(printf '%s\n' "$DIFF_FILES" | grep -Ev "$ALLOWED" || true)
if [ -n "$DISALLOWED" ]; then
  echo "Files outside PR 5.1 autopilot scope:"
  printf '%s\n' "$DISALLOWED"
  exit 1
fi

echo "Scope guard passed."
