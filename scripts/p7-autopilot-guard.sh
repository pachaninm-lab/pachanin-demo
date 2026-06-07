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

ALLOWED_INFRA='^(AGENTS\.md|docs/platform-v7/execution-queue\.md|docs/platform-v7/autopilot/.*|scripts/p7-autopilot-guard\.sh|scripts/p7-agent-runner\.sh|scripts/p7-autopilot-dispatcher\.mjs|scripts/p7-autopilot-scope-cleaner\.mjs|\.github/workflows/automerge\.yml|\.github/workflows/ci\.yml|\.github/workflows/platform-v7-autopilot-guard\.yml|\.github/workflows/platform-v7-autopilot-generated-merge\.yml|\.github/workflows/platform-v7-autopilot-loop\.yml|\.github/workflows/platform-v7-agent-runner\.yml|\.github/workflows/platform-v7-generated-pr-cleanup\.yml|\.github/workflows/platform-v7-autopilot-watchdog\.yml|\.github/workflows/platform-v7-safe-merge\.yml|\.github/ISSUE_TEMPLATE/platform-v7-agent-run\.md)$'

FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\.json$|pnpm-lock\.yaml$|\.env|.*\.pem$|.*\.key$)'

if printf '%s\n' "$DIFF_FILES" | grep -E "$FORBIDDEN_ALWAYS"; then
  echo "Forbidden path changed for platform-v7 autopilot."
  exit 1
fi

SCOPE_RESULT=$(DIFF_FILES="$DIFF_FILES" node - <<'JS'
const fs = require('fs');

const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
const files = String(process.env.DIFF_FILES || '').split(/\r?\n/).map((file) => file.trim()).filter(Boolean);
const allowedCurrent = Array.isArray(state.allowedCurrentScope) ? state.allowedCurrentScope : [];
const allowedInfra = /^(AGENTS\.md|docs\/platform-v7\/execution-queue\.md|docs\/platform-v7\/autopilot\/.+|scripts\/p7-autopilot-guard\.sh|scripts\/p7-agent-runner\.sh|scripts\/p7-autopilot-dispatcher\.mjs|scripts\/p7-autopilot-scope-cleaner\.mjs|\.github\/workflows\/automerge\.yml|\.github\/workflows\/ci\.yml|\.github\/workflows\/platform-v7-autopilot-guard\.yml|\.github\/workflows\/platform-v7-autopilot-generated-merge\.yml|\.github\/workflows\/platform-v7-autopilot-loop\.yml|\.github\/workflows\/platform-v7-agent-runner\.yml|\.github\/workflows\/platform-v7-generated-pr-cleanup\.yml|\.github\/workflows\/platform-v7-autopilot-watchdog\.yml|\.github\/workflows\/platform-v7-safe-merge\.yml|\.github\/ISSUE_TEMPLATE\/platform-v7-agent-run\.md)$/;

function normalizePath(input) {
  return String(input ?? '').trim().replace(/\\/g, '/').replace(/\/+$/g, '');
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegExp(glob) {
  const normalized = normalizePath(glob);
  let pattern = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];
    if (character === '*' && next === '*') {
      pattern += '.*';
      index += 1;
    } else if (character === '*') {
      pattern += '[^/]*';
    } else {
      pattern += escapeRegExp(character);
    }
  }
  return new RegExp(`^${pattern}$`);
}

function scopeMatches(allowedEntry, candidate) {
  const allowed = normalizePath(allowedEntry);
  const file = normalizePath(candidate);
  if (!allowed || !file) return false;
  if (allowed === file) return true;
  if (allowed.includes('*')) return globToRegExp(allowed).test(file);
  return file.startsWith(`${allowed}/`);
}

const disallowed = files.filter((file) => !allowedInfra.test(file) && !allowedCurrent.some((scope) => scopeMatches(scope, file)));
if (disallowed.length > 0) {
  process.stdout.write(disallowed.join('\n'));
  process.exitCode = 1;
}
JS
) || true

if [ -n "$SCOPE_RESULT" ]; then
  echo "Files outside current autopilot scope:"
  printf '%s\n' "$SCOPE_RESULT"
  echo "Allowed current scope from $STATE_FILE:"
  printf '%s\n' "$ALLOWED_CURRENT"
  exit 1
fi

echo "Scope guard passed."

node scripts/p7-autopilot-agent-engine-audit-guard.mjs

STAGE5_TESTS=(
  "tests/unit/platformV7RuntimeServerActions.test.ts"
  "tests/unit/platformV7RuntimeIntegration.test.ts"
  "tests/unit/platformV7RuntimeFinalQa.test.ts"
)

SHOULD_RUN_STAGE5_QA=false
for test_file in "${STAGE5_TESTS[@]}"; do
  if [ -f "apps/web/${test_file}" ]; then
    SHOULD_RUN_STAGE5_QA=true
  fi
done

if [ "$SHOULD_RUN_STAGE5_QA" = "true" ]; then
  echo "Running platform-v7 Stage 5 runtime QA tests from autopilot guard."
  pnpm --filter @pc/web exec vitest run "${STAGE5_TESTS[@]}"
fi
