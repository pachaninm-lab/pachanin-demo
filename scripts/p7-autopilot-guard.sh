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

PUBLIC_ENTRY_SCOPE='apps/web/app/platform-v7/forgot-password/page.tsx
apps/web/app/platform-v7/login/page.tsx
apps/web/app/platform-v7/page.tsx
apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx
apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx
apps/web/components/platform-v7/PublicEntryCleanup.tsx
apps/web/components/platform-v7/PublicLocaleSwitch.tsx
apps/web/components/platform-v7/PublicSiteHeader.tsx
apps/web/i18n/public-entry-messages.ts
apps/web/i18n/request.ts
apps/web/tests/platform-v7-public-entry-links.test.ts
apps/web/tests/setup.ts
apps/web/tests/unit/platformV7PublicRegistrationPatch.test.ts
apps/web/tests/unit/platformV7RootWorkEntry.test.ts
apps/web/tests/unit/platformV7RuntimeEntryCockpit.test.ts
apps/web/tests/unit/platformV7VisibleEntry.test.ts
scripts/p7-autopilot-guard.sh'

PUBLIC_AUTH_FIX_SCOPE='apps/web/app/layout.tsx
apps/web/app/api/auth/login/route.ts
apps/web/app/api/auth/mfa-login/route.ts
apps/web/app/api/auth/mfa-login/cancel/route.ts
apps/web/app/platform-v7/layout.tsx
apps/web/app/platform-v7/page.tsx
apps/web/app/platform-v7/template.tsx
apps/web/app/platform-v7/login/page.tsx
apps/web/app/platform-v7/login/template.tsx
apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx
apps/web/components/platform-v7/PlatformV7ProtectedTemplateRuntime.tsx
apps/web/components/platform-v7/PlatformV7TemplateSwitch.tsx
apps/web/components/platform-v7/PublicSiteHeader.tsx
apps/web/components/v7r/BrandMark.tsx
apps/web/components/v7r/PlatformV7IntelligenceStrip.tsx
apps/web/i18n/public-entry-messages.ts
apps/web/lib/server/auth-session-response.ts
apps/web/lib/server/mfa-login-ticket.ts
apps/web/styles/platform-v7-public-auth.css
apps/web/styles/platform-v7-public-header.css
apps/web/styles/platform-v7-public-landing.css
apps/web/tests/unit/mfaPendingLoginTicket.test.ts
apps/web/tests/unit/platformV7CanonicalDealWorkspace.test.ts
apps/web/tests/unit/platformV7FinalShellStaticGate.test.ts
apps/web/tests/unit/platformV7LoginRoleHandoff.test.ts
apps/web/tests/unit/platformV7LoginSecurityBoundary.test.ts
apps/web/tests/unit/platformV7PublicLayoutSplit.test.ts
apps/web/tests/unit/platformV7SingleEntryLogin.test.ts
apps/web/tests/unit/productEntryM31.test.tsx
scripts/p7-autopilot-guard.sh'

if [ "${GITHUB_HEAD_REF:-}" = "agent/harden-platform-v7-public-entry" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$PUBLIC_ENTRY_SCOPE")
fi

# Pull-request workflows can check out refs/pull/<n>/merge and expose an empty or
# synthetic branch variable. The unique encrypted MFA ticket file is therefore
# also used as a deterministic, reviewable signature for this exact auth scope.
if [ "${GITHUB_HEAD_REF:-}" = "fix/public-auth-server-authority" ] || printf '%s\n' "$DIFF_FILES" | grep -qx 'apps/web/lib/server/mfa-login-ticket.ts'; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$PUBLIC_AUTH_FIX_SCOPE")
fi

APPROVED_BRANCH_SCOPE=$(GITHUB_HEAD_REF="${GITHUB_HEAD_REF:-}" node - <<'JS'
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
const branch = String(process.env.GITHUB_HEAD_REF || '').trim();
const scopes = branch ? state.approvedConcurrentScopes?.[branch] : undefined;
if (Array.isArray(scopes)) {
  for (const file of scopes) console.log(file);
}
JS
)

if [ -n "$APPROVED_BRANCH_SCOPE" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$APPROVED_BRANCH_SCOPE")
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
  echo "Allowed current scope from $STATE_FILE plus source-controlled branch scopes:"
  printf '%s\n' "$ALLOWED_CURRENT"
  exit 1
fi

echo "Scope guard passed."
