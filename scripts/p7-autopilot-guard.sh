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
apps/web/components/v7r/PlatformV7IntelligenceStrip.tsx
apps/web/i18n/public-entry-messages.ts
apps/web/i18n/public-landing-copy.ts
apps/web/i18n/public-login-copy.ts
apps/web/i18n/request.ts
apps/web/tests/platform-v7-public-entry-links.test.ts
apps/web/tests/setup.ts
apps/web/tests/unit/platformV7CanonicalDealWorkspace.test.ts
apps/web/tests/unit/platformV7LoginRoleHandoff.test.ts
apps/web/tests/unit/platformV7LoginSecurityBoundary.test.ts
apps/web/tests/unit/platformV7PublicRegistrationPatch.test.ts
apps/web/tests/unit/platformV7RootWorkEntry.test.ts
apps/web/tests/unit/platformV7RuntimeEntryCockpit.test.ts
apps/web/tests/unit/platformV7SingleEntryLogin.test.ts
apps/web/tests/unit/platformV7VisibleEntry.test.ts
apps/web/tests/unit/productEntryM31.test.tsx
scripts/p7-autopilot-guard.sh'

PUBLIC_AUTH_FIX_SCOPE='apps/web/app/layout.tsx
apps/web/app/api/auth/login/route.ts
apps/web/app/api/auth/mfa-login/route.ts
apps/web/app/api/auth/mfa-login/cancel/route.ts
apps/web/app/platform-v7/forgot-password/ForgotPasswordFormClient.tsx
apps/web/app/platform-v7/forgot-password/page.tsx
apps/web/app/platform-v7/layout.tsx
apps/web/app/platform-v7/page.tsx
apps/web/app/platform-v7/template.tsx
apps/web/app/platform-v7/login/LoginFormClient.tsx
apps/web/app/platform-v7/login/page.tsx
apps/web/app/platform-v7/login/template.tsx
apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx
apps/web/components/platform-v7/PlatformV7ProtectedTemplateRuntime.tsx
apps/web/components/platform-v7/PlatformV7TemplateSwitch.tsx
apps/web/components/platform-v7/PublicLocaleLink.tsx
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
apps/web/tests/unit/platformV7RootWorkEntry.test.ts
apps/web/tests/unit/platformV7SingleEntryLogin.test.ts
apps/web/tests/unit/productEntryM31.test.tsx
scripts/p7-autopilot-guard.sh'

PUBLIC_LCP_FIX_SCOPE='apps/web/app/pc-public-entry/**
apps/web/app/layout.tsx
apps/web/app/platform-v7/_styles/**
apps/web/app/platform-v7/forgot-password/page.tsx
apps/web/app/platform-v7/layout.tsx
apps/web/app/platform-v7/login/layout.tsx
apps/web/app/platform-v7/page.tsx
apps/web/app/platform-v7/template.tsx
apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx
apps/web/components/platform-v7/PublicLocaleLink.tsx
apps/web/components/v7r/PlatformV7IntelligenceStrip.tsx
apps/web/next.config.js
apps/web/tests/unit/platformV7PublicLayoutSplit.test.ts
scripts/p7-autopilot-guard.sh'

STAFF_CONTROL_CENTER_TEMPLATE_SCOPE='apps/web/app/layout.tsx
apps/web/app/platform-v7/layout.tsx
apps/web/app/platform-v7/template.tsx'

CONTROLLED_TEST_ACCESS_SCOPE='apps/web/app/api/platform-v7/cabinet-lock-login/route.ts
apps/web/app/auth/me/route.ts
apps/web/app/staff/[...path]/route.ts
apps/web/tests/unit/platformV7ControlledTestAccess.test.ts
docs/platform-v7/security/test-access-operations.md
scripts/p7-autopilot-guard.sh'

OWNER_ACCESS_CENTER_SCOPE='apps/web/app/platform-v7/staff/**
apps/web/components/platform-v7/staff/**
apps/web/i18n/owner-access-center-messages.ts
apps/web/lib/platform-v7/staff-access-task-catalog.ts
apps/web/tests/unit/platformV7OwnerAccessCenterTaskUx.test.ts
apps/web/tests/unit/platformV7StaffControlCenterInitialRender.test.ts
scripts/p7-autopilot-guard.sh'


DESIGN_SYSTEM_V8_SCOPE='packages/design-system-v8/**
packages/design-tokens/**
apps/web/components/transaction-ux/**
apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx
apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx
apps/web/app/platform-v7/driver/field/page.tsx
apps/web/app/platform-v7/elevator/page.tsx
apps/web/app/platform-v7/lab/page.tsx
apps/web/app/platform-v7/surveyor/page.tsx
apps/web/package.json
apps/web/tsconfig.json
apps/web/next.config.js
apps/web/tests/unit/designSystemV8Architecture.test.ts
package.json
pnpm-lock.yaml
scripts/check-design-system-v8.mjs
.github/workflows/design-system-v8.yml
scripts/p7-autopilot-guard.sh'

DESIGN_SYSTEM_V8_ACTIVE=0

RUSSIAN_DEFAULT_LOCALE_SCOPE='apps/web/app/platform-v7/staff/page.tsx
apps/web/components/platform-v7/HeaderLanguageSwitch.tsx
apps/web/i18n/request.ts
apps/web/tests/unit/platformV7I18nRequestLocaleGuard.test.ts
apps/web/tests/unit/platformV7LanguageReloadGuard.test.ts
scripts/p7-autopilot-guard.sh'

TEST_ORGANIZATIONS_SCOPE='apps/api/src/modules/deals/canonical-test-deal.seed.ts
apps/web/app/platform-v7/staff/**
apps/web/app/staff/[...path]/route.ts
apps/web/components/platform-v7/staff/**
apps/web/lib/platform-v7/controlled-test-organizations.ts
apps/web/lib/platform-v7/verified-session.ts
apps/web/tests/unit/platformV7ControlledTestOrganization*.test.ts
apps/web/tests/unit/platformV7OwnerAccessCenterTaskUx.test.ts
scripts/p7-autopilot-guard.sh'

if [ "${GITHUB_HEAD_REF:-}" = "agent/harden-platform-v7-public-entry" ] || [ "${GITHUB_HEAD_REF:-}" = "fix/public-entry-human-copy" ] || [ "${GITHUB_HEAD_REF:-}" = "fix/landing-hero-support" ] || [ "${GITHUB_HEAD_REF:-}" = "fix/login-human-grade-ui" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$PUBLIC_ENTRY_SCOPE")
fi

# The Staff Control Center is a separate privileged control plane. Its exact
# server layout and template bypass are reviewed with the staff branch so
# generic business shell hydration and DOM-mutating guards cannot enter
# /platform-v7/staff.
if [ "${GITHUB_HEAD_REF:-}" = "feat/platform-v7-staff-control-center" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$STAFF_CONTROL_CENTER_TEMPLATE_SCOPE")
fi

# The owner access redesign is isolated to the privileged staff surface,
# server-owned task catalogue, translations, and its focused regression tests.
if [ "${GITHUB_HEAD_REF:-}" = "design/owner-access-center-task-ux" ] || printf '%s\n' "$DIFF_FILES" | grep -qx 'apps/web/components/platform-v7/staff/OwnerAccessCenter.tsx'; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$OWNER_ACCESS_CENTER_SCOPE")
fi

# Controlled test access is isolated to the server login gate, the gated
# self-hosted fixture endpoints, tests and its operations document.
if [ "${GITHUB_HEAD_REF:-}" = "fix/controlled-test-access" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$CONTROLLED_TEST_ACCESS_SCOPE")
fi

# The controlled test organization network binds the twelve owner cabinets to
# an explicit server-owned organization catalogue and one canonical test deal.
if [ "${GITHUB_HEAD_REF:-}" = "fix/test-organizations-all-cabinets" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$TEST_ORGANIZATIONS_SCOPE")
fi

# A clean Platform V7 URL must always resolve to Russian; EN/ZH remain explicit
# language choices and must not be restored from stale browser persistence.
if [ "${GITHUB_HEAD_REF:-}" = "fix/platform-v7-russian-default-locale" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$RUSSIAN_DEFAULT_LOCALE_SCOPE")
fi

# Pull-request workflows can check out refs/pull/<n>/merge and expose an empty or
# synthetic branch variable. The unique encrypted MFA ticket file is therefore
# also used as a deterministic, reviewable signature for this exact auth scope.
if [ "${GITHUB_HEAD_REF:-}" = "fix/public-auth-server-authority" ] || [ "${GITHUB_HEAD_REF:-}" = "fix/login-human-grade-ui" ] || printf '%s\n' "$DIFF_FILES" | grep -qx 'apps/web/lib/server/mfa-login-ticket.ts'; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$PUBLIC_AUTH_FIX_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "fix/public-entry-lcp-css-boundary" ] || [ "${GITHUB_HEAD_REF:-}" = "fix/login-human-grade-ui" ] || printf '%s\n' "$DIFF_FILES" | grep -qx 'apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx'; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$PUBLIC_LCP_FIX_SCOPE")
fi


if [ "${GITHUB_HEAD_REF:-}" = "codex/design-system-v8-industrial" ] || [ "${P7_DESIGN_SYSTEM_V8_SCOPE:-}" = "1" ]; then
  DESIGN_SYSTEM_V8_ACTIVE=1
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$DESIGN_SYSTEM_V8_SCOPE")
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

FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\.json$|\.env|.*\.pem$|.*\.key$)'

if printf '%s\n' "$DIFF_FILES" | grep -E "$FORBIDDEN_ALWAYS"; then
  echo "Forbidden path changed for platform-v7 autopilot."
  exit 1
fi


if printf '%s\n' "$DIFF_FILES" | grep -qx 'pnpm-lock.yaml'; then
  if [ "$DESIGN_SYSTEM_V8_ACTIVE" != "1" ]; then
    echo "pnpm-lock.yaml changed outside the approved Design System v8 workspace migration."
    exit 1
  fi
  for manifest in package.json apps/web/package.json packages/design-system-v8/package.json packages/design-tokens/package.json; do
    if ! printf '%s\n' "$DIFF_FILES" | grep -qx "$manifest"; then
      echo "pnpm-lock.yaml requires the Design System v8 manifest set; missing $manifest."
      exit 1
    fi
  done
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
