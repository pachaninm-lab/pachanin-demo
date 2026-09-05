#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${BASE_REF:-origin/main}"
HEAD_REF="${HEAD_REF:-HEAD}"
STATE_FILE="docs/platform-v7/autopilot/autopilot-state.json"
REGISTRATION_ROLLOVER_BRANCH="fix/p0-registration-authority-rollover-4637"
OWNER_AUDIT_LOCK_BRANCH="fix/p0-owner-control-plane-audit-lock-4698"
POST_REGISTRATION_PROGRESS_BRANCH="docs/pc-crop-post-registration-progress-4997"
INVENTORY_RESERVATION_BRANCH="feat/pc-crop-inventory-reservation-authority-4997"
SCOPE_GOVERNANCE_BRANCH="governance/pc-crop-post-registration-progress-scope-4997"
INVENTORY_SCOPE_GOVERNANCE_BRANCH="governance/pc-crop-inventory-reservation-scope-4997"
CURRENT_BRANCH="${GITHUB_HEAD_REF:-}"

is_immutable_scope_branch() {
  case "$1" in
    "$REGISTRATION_ROLLOVER_BRANCH"|"$OWNER_AUDIT_LOCK_BRANCH"|"$POST_REGISTRATION_PROGRESS_BRANCH"|"$INVENTORY_RESERVATION_BRANCH"|"$SCOPE_GOVERNANCE_BRANCH"|"$INVENTORY_SCOPE_GOVERNANCE_BRANCH") return 0 ;;
    *) return 1 ;;
  esac
}

if git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  if ! git merge-base "$BASE_REF" "$HEAD_REF" >/dev/null 2>&1; then
    git fetch --unshallow origin main 2>/dev/null || git fetch origin main
  fi
  if is_immutable_scope_branch "$CURRENT_BRANCH"; then
    DIFF_FILES=$(git diff --no-renames --name-only "$BASE_REF...$HEAD_REF")
  else
    DIFF_FILES=$(git diff --name-only "$BASE_REF...$HEAD_REF")
  fi
else
  if is_immutable_scope_branch "$CURRENT_BRANCH"; then
    DIFF_FILES=$(git diff --no-renames --name-only "HEAD~1...$HEAD_REF")
  else
    DIFF_FILES=$(git diff --name-only "HEAD~1...$HEAD_REF")
  fi
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

if is_immutable_scope_branch "$CURRENT_BRANCH"; then
  # The scope for these protected branches is resolved exclusively
  # from the immutable base commit below, never from the
  # pull request's working tree or the globally active implementation scope.
  ALLOWED_CURRENT=''
else
  ALLOWED_CURRENT=$(node - <<'JS'
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
for (const file of state.allowedCurrentScope || []) console.log(file);
JS
  )
fi

if [ "${GITHUB_HEAD_REF:-}" = "agent/pc-crop-00-governance-foundation" ]; then
  PC_CROP_GOVERNANCE_SCOPE='.github/workflows/pc-crop-governance.yml
docs/platform-v7/crop-platform/**
package.json
scripts/verify-pc-crop-governance.mjs
scripts/p7-autopilot-guard.sh'
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$PC_CROP_GOVERNANCE_SCOPE")
fi

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
apps/web/components/platform-v7/ChatSupportWidget.tsx
apps/web/components/platform-v7/PublicSiteHeader.tsx
apps/web/components/v7r/ApprovedHeaderLogo.tsx
apps/web/components/v7r/BrandMark.tsx
apps/web/components/v7r/brand-logo-asset.ts
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
apps/web/components/v7r/brand-logo-asset.ts
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

PUBLIC_HOME_TYPOGRAPHY_SCOPE='apps/web/app/platform-v7/page.tsx
apps/web/styles/platform-v7-public-typography.css
apps/web/tests/unit/platformV7PublicTypography.test.ts
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

INDUSTRIAL_SECURITY_GATE_SCOPE='.github/workflows/security-quality-gate.yml
docs/platform-v7/autopilot/check-security-release-gate.mjs
docs/platform-v7/autopilot/evaluate-pnpm-audit.mjs
docs/platform-v7/autopilot/security-exceptions.json
docs/platform-v7/autopilot/security-exceptions.schema.json
docs/platform-v7/autopilot/security-release-scope.json
docs/platform-v7/autopilot/semgrep-security.yml
infra/docker/Dockerfile.api
infra/docker/Dockerfile.web
infra/docker/Dockerfile.worker
packages/integration-sdk/src/adapters/mfa.adapter.ts
scripts/p7-autopilot-guard.sh'

TRANSITIVE_RUNTIME_REMEDIATION_SCOPE='package.json
pnpm-lock.yaml
apps/api/prisma/migrations/20260723182500_public_organization_intake_correlation_return_contract/**
docs/platform-v7/autopilot/security-exceptions.json
scripts/p7-autopilot-guard.sh'

OPENTELEMETRY_REMEDIATION_SCOPE='apps/api/package.json
apps/api/src/tracing.ts
apps/api/src/telemetry-config.ts
apps/api/src/telemetry-config.spec.ts
pnpm-lock.yaml
docs/platform-v7/autopilot/security-exceptions.json
scripts/p7-autopilot-guard.sh'

NEXT15_REMEDIATION_SCOPE='apps/web/**
pnpm-lock.yaml
docs/platform-v7/autopilot/security-exceptions.json
scripts/p7-autopilot-guard.sh'

IMMUTABLE_RELEASE_AUTHORITY_SCOPE='.github/workflows/immutable-release-authority-acceptance.yml
.github/workflows/outbox-worker-topology-acceptance.yml
infra/docker/Dockerfile.api
infra/docker/Dockerfile.migrations
infra/docker/Dockerfile.web
infra/docker/runtime-inventory.json
infra/helm/grainflow/**
infra/release/**
scripts/release/**
scripts/security/build-runtime-security-manifest.mjs
scripts/p7-autopilot-guard.sh'

IR_RUNTIME_IMAGE_SCOPE='infra/docker/Dockerfile.api
infra/docker/Dockerfile.outbox-worker
infra/helm/grainflow/templates/web-deployment.yaml
scripts/release/build-exact-head-images.sh
scripts/release/materialize-prisma-client.mjs
scripts/p7-autopilot-guard.sh'

EXACT_MAIN_LIVE_EVIDENCE_SCOPE='.github/workflows/indexnow-submit.yml
.github/workflows/security-abuse-evidence.yml
.github/workflows/seo-live-smoke.yml
apps/web/tests/unit/exactMainLiveEvidenceContract.test.ts
docs/platform-v7/autopilot/exact-main-live-evidence-2659.md
scripts/indexnow-submit.mjs
scripts/security/capture-base-security-jobs.mjs
scripts/write-deploy-evidence.mjs
scripts/p7-autopilot-guard.sh'

PUBLIC_REGISTRATION_FINAL_COPY_SCOPE='apps/api/src/modules/auth/consent-policy.spec.ts
apps/api/src/modules/auth/consent-policy.ts
apps/api/src/modules/auth/gekta-registration.spec.ts
apps/api/src/modules/auth/organization-invitation.service.spec.ts
apps/web/app/platform-v7/invitation/InvitationAcceptClient.tsx
apps/web/app/platform-v7/mfa-recovery/MfaRecoveryClient.tsx
apps/web/app/platform-v7/mfa-recovery/page.tsx
apps/web/app/platform-v7/oferta/page.tsx
apps/web/app/platform-v7/privacy/page.tsx
apps/web/app/platform-v7/register/RegisterFormClient.tsx
apps/web/app/platform-v7/register/RegisterFormClientPublic.tsx
apps/web/app/platform-v7/terms/page.tsx
apps/web/tests/unit/platformV7FinalAcceptanceContract.test.ts
apps/web/tests/unit/platformV7PublicLegalRecoveryCopy.test.ts
docs/platform-v7/autopilot/scopes/public-registration-final-copy-4916.json
scripts/p7-autopilot-guard.sh'

if [ "${GITHUB_HEAD_REF:-}" = "agent/harden-platform-v7-public-entry" ] || [ "${GITHUB_HEAD_REF:-}" = "fix/public-entry-human-copy" ] || [ "${GITHUB_HEAD_REF:-}" = "fix/landing-hero-support" ] || [ "${GITHUB_HEAD_REF:-}" = "fix/login-human-grade-ui" ] || [ "${GITHUB_HEAD_REF:-}" = "fix/exact-approved-header-logo" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$PUBLIC_ENTRY_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "fix/public-registration-final-copy-4916" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$PUBLIC_REGISTRATION_FINAL_COPY_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "agent/public-home-typography" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$PUBLIC_HOME_TYPOGRAPHY_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "feat/platform-v7-staff-control-center" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$STAFF_CONTROL_CENTER_TEMPLATE_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "design/owner-access-center-task-ux" ] || printf '%s\n' "$DIFF_FILES" | grep -qx 'apps/web/components/platform-v7/staff/OwnerAccessCenter.tsx'; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$OWNER_ACCESS_CENTER_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "fix/controlled-test-access" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$CONTROLLED_TEST_ACCESS_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "fix/test-organizations-all-cabinets" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$TEST_ORGANIZATIONS_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "fix/platform-v7-russian-default-locale" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$RUSSIAN_DEFAULT_LOCALE_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "fix/public-auth-server-authority" ] || [ "${GITHUB_HEAD_REF:-}" = "fix/login-human-grade-ui" ] || printf '%s\n' "$DIFF_FILES" | grep -qx 'apps/web/lib/server/mfa-login-ticket.ts'; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$PUBLIC_AUTH_FIX_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "fix/public-entry-lcp-css-boundary" ] || [ "${GITHUB_HEAD_REF:-}" = "fix/login-human-grade-ui" ] || printf '%s\n' "$DIFF_FILES" | grep -qx 'apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx'; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$PUBLIC_LCP_FIX_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "agent/industrial-readiness-v1-security-gates-v2" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$INDUSTRIAL_SECURITY_GATE_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "agent/ir-sec-transitive-runtime-remediation" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$TRANSITIVE_RUNTIME_REMEDIATION_SCOPE")
fi

BRACE_EXPANSION_5_0_9_SCOPE='package.json
pnpm-lock.yaml
docs/platform-v7/autopilot/security-exceptions.json'

if [ "${GITHUB_HEAD_REF:-}" = "fix/security-brace-expansion-5-0-8" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$BRACE_EXPANSION_5_0_9_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "agent/ir-sec-opentelemetry-220" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$OPENTELEMETRY_REMEDIATION_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "agent/ir-sec-next-15-5-16-final" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$NEXT15_REMEDIATION_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "ir/immutable-release-authority-2652" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$IMMUTABLE_RELEASE_AUTHORITY_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "ir/runtime-images-2664" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$IR_RUNTIME_IMAGE_SCOPE")
fi

if [ "${GITHUB_HEAD_REF:-}" = "fix/exact-main-live-evidence-2659" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$EXACT_MAIN_LIVE_EVIDENCE_SCOPE")
fi

if is_immutable_scope_branch "$CURRENT_BRANCH"; then
  APPROVED_BRANCH_SCOPE=$(BASE_REF="$BASE_REF" STATE_FILE="$STATE_FILE" GITHUB_HEAD_REF="$CURRENT_BRANCH" node - <<'JS'
const { execFileSync } = require('node:child_process');

const baseRef = String(process.env.BASE_REF || '').trim();
const stateFile = String(process.env.STATE_FILE || '').trim();
const branch = String(process.env.GITHUB_HEAD_REF || '').trim();
if (!baseRef || !stateFile || !branch) {
  throw new Error('P7_IMMUTABLE_SCOPE: immutable scope inputs are required');
}

let state;
try {
  const raw = execFileSync('git', ['show', `${baseRef}:${stateFile}`], { encoding: 'utf8' });
  state = JSON.parse(raw);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`P7_IMMUTABLE_SCOPE: cannot load ${baseRef}:${stateFile}: ${message}`);
}

const scopes = state.approvedConcurrentScopes?.[branch];
if (!Array.isArray(scopes) || scopes.length === 0) {
  throw new Error(`P7_IMMUTABLE_SCOPE: no immutable approved scope for ${branch}`);
}

const normalized = scopes.map((entry, index) => {
  if (typeof entry !== 'string') {
    throw new Error(`P7_IMMUTABLE_SCOPE: scope[${index}] is not a string`);
  }
  const value = entry.trim().replace(/\/+$/u, '');
  if (!value || value.includes('\\') || value === '..' || value.startsWith('../') || value.includes('/../')) {
    throw new Error(`P7_IMMUTABLE_SCOPE: unsafe path ${JSON.stringify(entry)}`);
  }
  return value;
});
if (new Set(normalized).size !== normalized.length) {
  throw new Error('P7_IMMUTABLE_SCOPE: duplicate immutable approved paths');
}
process.stdout.write(`${normalized.join('\n')}\n`);
JS
  )
else
  APPROVED_BRANCH_SCOPE=$(GITHUB_HEAD_REF="$CURRENT_BRANCH" node - <<'JS'
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
const branch = String(process.env.GITHUB_HEAD_REF || '').trim();
const scopes = branch ? state.approvedConcurrentScopes?.[branch] : undefined;
if (Array.isArray(scopes)) {
  for (const file of scopes) console.log(file);
}
JS
  )
fi

if is_immutable_scope_branch "$CURRENT_BRANCH"; then
  # Discard every legacy hardcoded or diff-triggered scope expansion above.
  # This branch receives exactly the immutable base-approved entries and no
  # union with global, legacy, or branch-local authorities.
  ALLOWED_CURRENT="$APPROVED_BRANCH_SCOPE"
elif [ -n "$APPROVED_BRANCH_SCOPE" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$APPROVED_BRANCH_SCOPE")
fi

if is_immutable_scope_branch "$CURRENT_BRANCH"; then
  SOURCE_CONTROLLED_SCOPE=''
else
  SOURCE_CONTROLLED_SCOPE=$(GITHUB_HEAD_REF="${GITHUB_HEAD_REF:-}" node scripts/p7-source-controlled-scope.mjs)
fi

if [ -n "$SOURCE_CONTROLLED_SCOPE" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$SOURCE_CONTROLLED_SCOPE")
fi

if is_immutable_scope_branch "$CURRENT_BRANCH" && [ "$CURRENT_BRANCH" != "$SCOPE_GOVERNANCE_BRANCH" ] && [ "$CURRENT_BRANCH" != "$INVENTORY_SCOPE_GOVERNANCE_BRANCH" ]; then
  MUTABLE_SCOPE_AUTHORITIES=$(printf '%s\n' "$DIFF_FILES" | grep -E '^(AGENTS\.md|docs/platform-v7/autopilot/|scripts/p7-autopilot-guard\.sh$|scripts/p7-source-controlled-scope\.mjs$|\.github/workflows/platform-v7-autopilot-guard\.yml$)' || true)
  if [ -n "$MUTABLE_SCOPE_AUTHORITIES" ]; then
    echo "Mutable scope authority changed on a PC-CROP immutable-scope implementation branch:"
    printf '%s\n' "$MUTABLE_SCOPE_AUTHORITIES"
    exit 1
  fi
fi

if [ "${GITHUB_HEAD_REF:-}" = "agent/ir-sec-transitive-runtime-remediation" ] || [ "${GITHUB_HEAD_REF:-}" = "agent/ir-sec-opentelemetry-220" ] || [ "${GITHUB_HEAD_REF:-}" = "agent/ir-sec-next-15-5-16-final" ] || [ "${GITHUB_HEAD_REF:-}" = "claude/tai-production-attestation-gizgzh" ] || [ "${GITHUB_HEAD_REF:-}" = "fix/security-brace-expansion-5-0-8" ] || [ "${GITHUB_HEAD_REF:-}" = "identity-rls-3670" ]; then
  # Lockfile exemptions are granted per branch by the owner, never self-issued.
  # identity-rls-3670: owner-directed P0 registration/RLS closure requires the
  # actual nanoid HIGH-advisory remediation; package.json and pnpm-lock.yaml
  # remain bounded by the source-controlled branch scope below.
  # fix/security-brace-expansion-5-0-8: owner instruction of 2026-08-03 to raise
  # brace-expansion to 5.0.9 and socket.io-parser to 4.2.7, both HIGH advisories
  # against the production tree. A resolution bump cannot be expressed without
  # pnpm-lock.yaml, and the owner declined a formal exception in favour of the
  # fix. Scoped below to package.json and pnpm-lock.yaml only.
  # claude/tai-production-attestation-gizgzh: owner instruction of 2026-07-26 to
  # remove Netlify in full, which requires dropping @netlify/plugin-nextjs from
  # package.json and pnpm-lock.yaml together — package.json alone would break
  # `pnpm install --frozen-lockfile`.
  FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\.json$|\.env|.*\.pem$|.*\.key$)'
else
  FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\.json$|pnpm-lock\.yaml$|\.env|.*\.pem$|.*\.key$)'
fi

FORBIDDEN_FILES=$(printf '%s\n' "$DIFF_FILES" | grep -E "$FORBIDDEN_ALWAYS" || true)

if [ "${GITHUB_HEAD_REF:-}" = "agent/tai-ap-14d7-live-remediation" ]; then
  TAI_PUBLIC_CA_PATHS='^(apps/tai/tai/trust/russian_trusted_root_ca\.pem|apps/tai/tai/trust/russian_trusted_sub_ca_2024\.pem)$'
  FORBIDDEN_FILES=$(
    printf '%s\n' "$FORBIDDEN_FILES" \
      | grep -Ev "$TAI_PUBLIC_CA_PATHS" \
      || true
  )
  while IFS=' ' read -r expected_fingerprint certificate_path; do
    actual_fingerprint=$(
      openssl x509 -in "$certificate_path" -outform DER \
        | sha256sum \
        | cut -d' ' -f1
    )
    if [ "$actual_fingerprint" != "$expected_fingerprint" ]; then
      echo "Audited public CA fingerprint mismatch: $certificate_path"
      exit 1
    fi
  done <<'TAI_PUBLIC_CA_CERTIFICATES'
d26d2d0231b7c39f92cc738512ba54103519e4405d68b5bd703e9788ca8ecf31 apps/tai/tai/trust/russian_trusted_root_ca.pem
2155785036c900dbb5f1bb2a1569c80c55595bd6bf94867a29bbddbc7d88a3f2 apps/tai/tai/trust/russian_trusted_sub_ca_2024.pem
TAI_PUBLIC_CA_CERTIFICATES
fi

if [ -n "$FORBIDDEN_FILES" ]; then
  printf '%s\n' "$FORBIDDEN_FILES"
  echo "Forbidden path changed for platform-v7 autopilot."
  exit 1
fi

if is_immutable_scope_branch "$CURRENT_BRANCH"; then
  P7_EXACT_APPROVED_SCOPE=1
else
  P7_EXACT_APPROVED_SCOPE=0
fi

SCOPE_RESULT=$(DIFF_FILES="$DIFF_FILES" ALLOWED_CURRENT="$ALLOWED_CURRENT" P7_EXACT_APPROVED_SCOPE="$P7_EXACT_APPROVED_SCOPE" node - <<'JS'
const files = String(process.env.DIFF_FILES || '').split(/\r?\n/).map((file) => file.trim()).filter(Boolean);
const allowedCurrent = String(process.env.ALLOWED_CURRENT || '').split(/\r?\n/).map((file) => file.trim()).filter(Boolean);
const exactApprovedScope = process.env.P7_EXACT_APPROVED_SCOPE === '1';
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
function exactScopeMatches(allowedEntry, candidate) {
  const allowed = normalizePath(allowedEntry);
  const file = normalizePath(candidate);
  if (!allowed || !file) return false;
  if (allowed.includes('*')) return globToRegExp(allowed).test(file);
  return allowed === file;
}
const disallowed = files.filter((file) => {
  const approved = allowedCurrent.some((scope) => (
    exactApprovedScope ? exactScopeMatches(scope, file) : scopeMatches(scope, file)
  ));
  return exactApprovedScope ? !approved : !allowedInfra.test(file) && !approved;
});
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
