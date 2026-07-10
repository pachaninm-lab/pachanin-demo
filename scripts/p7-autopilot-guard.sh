#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${BASE_REF:-origin/main}"
HEAD_REF="${HEAD_REF:-HEAD}"
STATE_FILE="docs/platform-v7/autopilot/autopilot-state.json"

if git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  if ! git merge-base "$BASE_REF" "$HEAD_REF" >/dev/null 2>&1; then
    git fetch --unshallow origin main 2>/dev/null || git fetch origin main
  fi
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

BANK_BASIS_MIGRATION_SCOPE='packages/domain-core/**
pnpm-workspace.yaml
deno-proxy/**'

if [ "${GITHUB_HEAD_REF:-}" = "p7-bank-basis-state-machine" ] || [ "${P7_BANK_BASIS_MIGRATION_SCOPE:-}" = "1" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$BANK_BASIS_MIGRATION_SCOPE")
fi

INDUSTRIAL_ONE_DEAL_SCOPE='apps/api/src/modules/deals/**
apps/web/app/platform-v7/login/page.tsx
apps/web/app/api/auth/login/route.ts
apps/web/app/api/proxy/[...path]/route.ts
apps/web/components/platform-v7/CanonicalDealWorkspace.tsx
apps/web/components/platform-v7/RoleIntentDashboard.tsx
apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx
apps/web/lib/platform-v7/verified-session.ts
apps/web/tests/unit/platformV7VerifiedSession.test.ts
apps/web/tests/unit/platformV7CanonicalDealWorkspace.test.ts'

if [ "${GITHUB_HEAD_REF:-}" = "industrial-one-deal-foundation" ] || [ "${P7_INDUSTRIAL_ONE_DEAL_SCOPE:-}" = "1" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$INDUSTRIAL_ONE_DEAL_SCOPE")
fi

FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\.json$|pnpm-lock\.yaml$|\.env|.*\.pem$|.*\.key$)'

if printf '%s\n' "$DIFF_FILES" | grep -E "$FORBIDDEN_ALWAYS"; then
  echo "Forbidden path changed for platform-v7 autopilot."
  exit 1
fi

SCOPE_RESULT=$(DIFF_FILES="$DIFF_FILES" ALLOWED_CURRENT="$ALLOWED_CURRENT" node - <<'JS'
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
const files = String(process.env.DIFF_FILES || '').split(/\r?\n/).map((file) => file.trim()).filter(Boolean);
const allowedCurrent = String(process.env.ALLOWED_CURRENT || '').split(/\r?\n/).map((file) => file.trim()).filter(Boolean);
const allowedInfra = /^(AGENTS\.md|docs\/platform-v7\/execution-queue\.md|docs\/platform-v7\/autopilot\/.+|scripts\/p7-autopilot-guard\.sh|scripts\/p7-agent-runner\.sh|scripts\/p7-autopilot-dispatcher\.mjs|scripts\/p7-autopilot-scope-cleaner\.mjs|\.github\/workflows\/automerge\.yml|\.github\/workflows\/ci\.yml|\.github\/workflows\/web-unit\.yml|\.github\/workflows\/platform-v7-autopilot-guard\.yml|\.github\/workflows\/platform-v7-autopilot-generated-merge\.yml|\.github\/workflows\/platform-v7-autopilot-loop\.yml|\.github\/workflows\/platform-v7-agent-runner\.yml|\.github\/workflows\/platform-v7-generated-pr-cleanup\.yml|\.github\/workflows\/platform-v7-autopilot-watchdog\.yml|\.github\/workflows\/platform-v7-safe-merge\.yml|\.github\/ISSUE_TEMPLATE\/platform-v7-agent-run\.md)$/;

function normalizePath(input) { return String(input ?? '').trim().replace(/\\/g, '/').replace(/\/+$/g, ''); }
function escapeRegExp(input) { return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function globToRegExp(glob) {
  const normalized = normalizePath(glob);
  let pattern = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];
    if (character === '*' && next === '*') { pattern += '.*'; index += 1; }
    else if (character === '*') pattern += '[^/]*';
    else pattern += escapeRegExp(character);
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
  echo "Allowed current scope from $STATE_FILE plus explicit branch overrides when applicable:"
  printf '%s\n' "$ALLOWED_CURRENT"
  exit 1
fi

echo "Scope guard passed."
