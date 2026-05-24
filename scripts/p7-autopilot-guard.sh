#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${BASE_REF:-origin/main}"
HEAD_REF="${HEAD_REF:-HEAD}"
STATE_FILE="docs/platform-v7/autopilot/autopilot-state.json"

if git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  DIFF_FILES=$(git diff --name-only "$BASE_REF...$HEAD_REF")
else
  DIFF_FILES=$(git diff --name-only "HEAD~1...$HEAD_REF")
fi

echo "platform-v7 autopilot guard"
echo "Changed files:"
printf '%s\n' "$DIFF_FILES"

if [ -z "$DIFF_FILES" ]; then
  echo "No changed files."
  exit 0
fi

if [ ! -f "$STATE_FILE" ]; then
  echo "Missing autopilot state file: $STATE_FILE"
  exit 1
fi

ALLOWED_CURRENT=$(node - <<'JS'
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
for (const file of state.allowedCurrentScope || []) console.log(file);
JS
)

ALLOWED_INFRA='^(AGENTS\.md|docs/platform-v7/execution-queue\.md|docs/platform-v7/autopilot/.*|scripts/p7-autopilot-guard\.sh|scripts/p7-agent-runner\.sh|scripts/p7-autopilot-dispatcher\.mjs|\.github/workflows/platform-v7-autopilot-guard\.yml|\.github/workflows/platform-v7-autopilot-loop\.yml|\.github/workflows/platform-v7-agent-runner\.yml|\.github/ISSUE_TEMPLATE/platform-v7-agent-run\.md)$'

FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\.json$|pnpm-lock\.yaml$|\.env|.*\.pem$|.*\.key$)'

if printf '%s\n' "$DIFF_FILES" | grep -E "$FORBIDDEN_ALWAYS"; then
  echo "Forbidden path changed for platform-v7 autopilot."
  exit 1
fi

DISALLOWED=''
while IFS= read -r file; do
  [ -z "$file" ] && continue
  allowed=false
  if printf '%s\n' "$ALLOWED_CURRENT" | grep -Fx "$file" >/dev/null 2>&1; then
    allowed=true
  fi
  if printf '%s\n' "$file" | grep -E "$ALLOWED_INFRA" >/dev/null 2>&1; then
    allowed=true
  fi
  if [ "$allowed" != "true" ]; then
    DISALLOWED="${DISALLOWED}${file}\n"
  fi
done <<< "$DIFF_FILES"

if [ -n "$DISALLOWED" ]; then
  echo "Files outside current autopilot scope:"
  printf '%b' "$DISALLOWED"
  echo "Allowed current scope from $STATE_FILE:"
  printf '%s\n' "$ALLOWED_CURRENT"
  exit 1
fi

echo "Scope guard passed."
