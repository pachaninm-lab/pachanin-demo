#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${BASE_REF:-origin/main}"
HEAD_REF="${HEAD_REF:-HEAD}"
STATE_FILE="docs/platform-v7/autopilot/autopilot-state.json"
REGISTRATION_ROLLOVER_BRANCH="fix/p0-registration-authority-rollover-4637"
OWNER_AUDIT_LOCK_BRANCH="fix/p0-owner-control-plane-audit-lock-4698"
POST_REGISTRATION_PROGRESS_BRANCH="docs/pc-crop-post-registration-progress-4997"
INVENTORY_RESERVATION_BRANCH="feat/pc-crop-inventory-reservation-authority-4997"
AUCTION_INVENTORY_BRANCH="feat/pc-crop-auction-inventory-authority-4997"
W1_PRODUCTION_ACCEPTANCE_BRANCH="ops/pc-crop-w1-production-acceptance-4997"
SCOPE_GOVERNANCE_BRANCH="governance/pc-crop-post-registration-progress-scope-4997"
INVENTORY_SCOPE_GOVERNANCE_BRANCH="governance/pc-crop-inventory-reservation-scope-4997"
PUBLIC_HOME_SCOPE_GOVERNANCE_BRANCH="governance/public-home-role-clarity-scope-20260905"
PUBLIC_HOME_IMPLEMENTATION_BRANCH="feat/public-home-role-clarity-20260905"
PUBLIC_HOME_GOVERNANCE_MANIFEST="docs/platform-v7/autopilot/scopes/governance-public-home-role-clarity-scope-20260905.json"
PUBLIC_HOME_IMPLEMENTATION_MANIFEST="docs/platform-v7/autopilot/scopes/public-home-role-clarity-20260905.json"
POISON_ISOLATION_SCOPE_GOVERNANCE_BRANCH="governance/production-like-outbox-poison-isolation-scope-3793"
POISON_ISOLATION_IMPLEMENTATION_BRANCH="fix/production-like-outbox-poison-isolation-3793"
OWNER_HANDOFF_IMPLEMENTATION_BRANCH="fix/owner-handoff-product-host-20260908"
QWEN_FAILED_EVIDENCE_BRANCH="fix/local-qwen-failed-review-evidence-20260912"
KIND_MINIO_IMAGE_SOURCE_BRANCH="fix/kind-minio-image-source-20260912"
GITLEAKS_RELEASE_ATTESTATION_BRANCH="fix/gitleaks-release-authority-attestation-20260912"
FINAL_PUBLIC_HOME_BRANCH="agent/platform-v7-strategic-rebuild-v3"
FINAL_PUBLIC_MARKET_BRANCH="p0/farmer-public-market-teaser-20260913"
FINAL_PUBLIC_REGISTRATION_BRANCH="fix/public-registration-final-copy-4916"
FINAL_PUBLIC_HOW_BRANCH="fix/public-deal-journey-10of10-current-main-20260808"
FINAL_PUBLIC_PRODUCT_COPY_BRANCH="agent/platform-v7-product-copy"
FINAL_PUBLIC_RELEASE_BRANCH="ops/production-full-stack-release-v1"
FINAL_PUBLIC_GOVERNANCE_BRANCH="governance/final-public-experience-v1-20260919"
POISON_ISOLATION_MANIFEST="docs/platform-v7/autopilot/scopes/production-like-outbox-poison-isolation-3793.json"
NEXT_SECURITY_PATCH_BRANCH="security/pc-crop-next-15-5-24-4997"
INDUSTRIAL_DIAGNOSTIC_GOVERNANCE_BRANCH="governance/industrial-load-diagnostics-20260919"
INDUSTRIAL_DIAGNOSTIC_BRANCH="test/industrial-load-diagnostics-20260919"
IR20_BINDING_PREREQUISITE_BRANCH="governance/ir20-binding-immutable-scope-20260919"
IR20_BINDING_IMPLEMENTATION_BRANCH="ops/ir20-api-database-binding-20260919"
PRODUCT_BANK_COPY_BRANCH="bank/deep-visible-copy-guard-20260924"
PRODUCT_ZSN_SOURCE_BRANCH="fgis/zsn-public-document-source-lock-20260924"
PRODUCT_NEXT_ACTION_BRANCH="ux/first-customer-next-action-unknown-20260924"
PRODUCT_DEAL_COMMAND_BRANCH="ux/deal-command-unknown-20260925"
PUBLIC_REGISTRATION_PARTICIPATION_BRANCH="fix/public-registration-participation-choice-20260923"
PRODUCTION_MOBILE_HANDOFF_BRANCH="fix/production-mobile-controller-handoff-20260927"
READINESS_QUEUE_JOB_GATE_BRANCH="fix/readiness-queue-job-gate-20260927"
READINESS_DEFAULT_BRANCH_PUSH_GATE_BRANCH="fix/readiness-default-branch-push-gate-20260929"
PRODUCT_BUYER_HOME_BRANCH="ux/buyer-first-customer-home-20260925"
PRODUCT_BANK_HOME_BRANCH="bank/first-customer-home-20260926"
PRODUCT_BANK_HOME_ADMISSION_BRANCH="governance/product-bank-home-admission-20260926"
PUBLIC_WEBKIT_I18N_BRANCH="fix/public-webkit-i18n-route-lifecycle-20260927"
PUBLIC_LOGIN_LOCALE_BRANCH="fix/public-login-register-locale-20260928"
PRODUCT_BUYER_ADMISSION_BRANCH="governance/product-buyer-home-admission-20260925"
PRODUCT_SCOPE_ADMISSION_BRANCH="governance/product-bank-fgis-ux-source-admission-20260924"
PRODUCT_DEAL_RUNTIME_BRANCH="ux/deal-runtime-unknown-20260929"
PRODUCT_DEAL_RUNTIME_ADMISSION_BRANCH="governance/product-deal-runtime-admission-20260929"
CURRENT_BRANCH="${GITHUB_HEAD_REF:-}"

is_immutable_scope_branch() {
  case "$1" in
    "$PRODUCT_DEAL_RUNTIME_BRANCH"|"$PRODUCT_DEAL_RUNTIME_ADMISSION_BRANCH") return 0 ;;
    "fix/gekta-docker-diagnostic-route-20260927"|"fix/gekta-web-release-recovery-20260927"|"fix/gekta-answer-copy-20260927"|"fix/gekta-han-stream-20260927"|"fix/gekta-qwen35-guard-argv-form-20260928" ) return 0 ;;
    "$IR20_BINDING_PREREQUISITE_BRANCH"|"$IR20_BINDING_IMPLEMENTATION_BRANCH"|"$INDUSTRIAL_DIAGNOSTIC_GOVERNANCE_BRANCH"|"$INDUSTRIAL_DIAGNOSTIC_BRANCH"|"$PRODUCT_BANK_COPY_BRANCH"|"$PRODUCT_ZSN_SOURCE_BRANCH"|"$PRODUCT_NEXT_ACTION_BRANCH"|"$PRODUCT_DEAL_COMMAND_BRANCH"|"$PUBLIC_REGISTRATION_PARTICIPATION_BRANCH"|"$PRODUCTION_MOBILE_HANDOFF_BRANCH"|"$READINESS_QUEUE_JOB_GATE_BRANCH"|"$READINESS_DEFAULT_BRANCH_PUSH_GATE_BRANCH"|"$PRODUCT_BUYER_HOME_BRANCH"|"$PRODUCT_BANK_HOME_BRANCH"|"$PRODUCT_BANK_HOME_ADMISSION_BRANCH"|"$PUBLIC_WEBKIT_I18N_BRANCH"|"$PUBLIC_LOGIN_LOCALE_BRANCH"|"$PRODUCT_BUYER_ADMISSION_BRANCH"|"$PRODUCT_SCOPE_ADMISSION_BRANCH") return 0 ;;
    "$REGISTRATION_ROLLOVER_BRANCH"|"$OWNER_AUDIT_LOCK_BRANCH"|"$POST_REGISTRATION_PROGRESS_BRANCH"|"$INVENTORY_RESERVATION_BRANCH"|"$AUCTION_INVENTORY_BRANCH"|"$W1_PRODUCTION_ACCEPTANCE_BRANCH"|"$SCOPE_GOVERNANCE_BRANCH"|"$INVENTORY_SCOPE_GOVERNANCE_BRANCH"|"$PUBLIC_HOME_SCOPE_GOVERNANCE_BRANCH"|"$PUBLIC_HOME_IMPLEMENTATION_BRANCH"|"$POISON_ISOLATION_SCOPE_GOVERNANCE_BRANCH"|"$POISON_ISOLATION_IMPLEMENTATION_BRANCH"|"$OWNER_HANDOFF_IMPLEMENTATION_BRANCH"|"$QWEN_FAILED_EVIDENCE_BRANCH"|"$KIND_MINIO_IMAGE_SOURCE_BRANCH"|"$GITLEAKS_RELEASE_ATTESTATION_BRANCH"|"$FINAL_PUBLIC_HOME_BRANCH"|"$FINAL_PUBLIC_MARKET_BRANCH"|"$FINAL_PUBLIC_REGISTRATION_BRANCH"|"$FINAL_PUBLIC_HOW_BRANCH"|"$FINAL_PUBLIC_PRODUCT_COPY_BRANCH"|"$FINAL_PUBLIC_RELEASE_BRANCH"|"$FINAL_PUBLIC_GOVERNANCE_BRANCH") return 0 ;;
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
  # Protected branches resolve scope exclusively from the immutable base.
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

# The W1 release may append only the two reviewed static-label findings. The
# trusted-base guard, not the implementation branch, owns this exception bound.
if [ "$CURRENT_BRANCH" = "$W1_PRODUCTION_ACCEPTANCE_BRANCH" ] && printf '%s\n' "$DIFF_FILES" | grep -Fxq '.gitleaksignore'; then
  P7_EXCEPTION_BASE="$BASE_REF" P7_EXCEPTION_HEAD="$HEAD_REF" node - <<'JS'
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const read = ref => execFileSync('git', ['show', `${ref}:.gitleaksignore`], { encoding: 'utf8' });
const baseline = read(process.env.P7_EXCEPTION_BASE);
const head = read(process.env.P7_EXCEPTION_HEAD);
const approvedAppend = "\n# False positive: static PC_W1_API_DIGEST_VERIFIED output field name in W1 controller history.\n# Exact commit/path/rule/line only; these strings never contained a credential.\n25f4fa23451d9b2fd58ff60ba9badfc063055796:.github/workflows/pc-crop-w1-production-acceptance.yml:generic-api-key:391\nba4e7b26a34f95ebc5636c6a18785a6a2d63b0b1:.github/workflows/pc-crop-w1-production-acceptance.yml:generic-api-key:395\n";
assert.equal(head, baseline + approvedAppend, 'W1 historical scan exceptions must be the exact approved append; existing entries and all other findings remain protected');
JS
fi

# This repair may only synchronize the release-authority assertion with reviewed
# entries in .gitleaksignore. Each accepted transformation is bound by the trusted
# base; the implementation cannot weaken the test or authorize new exceptions.
if [ "$CURRENT_BRANCH" = "$GITLEAKS_RELEASE_ATTESTATION_BRANCH" ] && printf '%s\n' "$DIFF_FILES" | grep -Fxq 'apps/tai/tests/test_gitleaks_release_authority.py'; then
  P7_ATTESTATION_BASE="$BASE_REF" P7_ATTESTATION_HEAD="$HEAD_REF" node - <<'JS'
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = 'apps/tai/tests/test_gitleaks_release_authority.py';
const read = ref => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' });
const baseline = read(process.env.P7_ATTESTATION_BASE);
const head = read(process.env.P7_ATTESTATION_HEAD);
const currentBaselineBlob = 'e589046fc52daf8a3632f70b6879543934be56ff';
const treeEntry = (ref, file) => execFileSync('git', ['ls-tree', ref, '--', file], { encoding: 'utf8' }).trim();
const baselineBlob = execFileSync('git', ['rev-parse', `${process.env.P7_ATTESTATION_BASE}:${path}`], { encoding: 'utf8' }).trim();
if (baselineBlob === currentBaselineBlob) {
  assert.equal(treeEntry(process.env.P7_ATTESTATION_BASE, path), `100644 blob ${currentBaselineBlob}\t${path}`, 'Gitleaks release attestation baseline must be the exact accepted regular file');
  assert.equal(treeEntry(process.env.P7_ATTESTATION_HEAD, path), `100644 blob 404e172449f53c01369ef974a50079d6f6967d56\t${path}`, 'Gitleaks release attestation head must be the exact two-fingerprint regular-file repair');
  const acceptedInputs = {
    '.gitleaksignore': '5c151dc1a2b5329fb2d4feb1fd0c1713bbef96db',
    'apps/tai/release-source-manifest.json': '35f96ccc7fe332ddd90454eeee19853ba0612b71',
  };
  for (const [file, blob] of Object.entries(acceptedInputs)) {
    for (const ref of [process.env.P7_ATTESTATION_BASE, process.env.P7_ATTESTATION_HEAD]) {
      assert.equal(treeEntry(ref, file), `100644 blob ${blob}\t${file}`, `Gitleaks release attestation input must remain the exact accepted regular file: ${file}`);
    }
  }
  const currentAnchor =
    '        "db4f0a50b8df0a5e1045d3b9dc6a6fdc9d2806b0:"\n' +
    '        "apps/web/tests/unit/platformV7RootWorkEntry.test.ts:generic-api-key:1018",\n';
  const twoExistingFingerprints =
    '        "2dbd66d9bf258113272825d7b082b20e3b15a2b6:"\n' +
    '        "docs/platform-v7/autopilot/autopilot-state.json:generic-api-key:2713",\n' +
    '        "3b76d0f3473b986b6354aaac528994f7ac343df2:"\n' +
    '        "apps/api/src/modules/service-marketplace/service-marketplace.contract.spec.ts:"\n' +
    '        "generic-api-key:17",\n';
  assert.equal(baseline.split(currentAnchor).length - 1, 1, 'Gitleaks release attestation current anchor must occur exactly once');
  assert.equal(head, baseline.replace(currentAnchor, currentAnchor + twoExistingFingerprints), 'Gitleaks release attestation repair must add exactly two existing fingerprints and preserve every existing byte and assertion');
} else {
// Preserve the historical four-fingerprint transformation and its negative gates.
const insertAfterCommodity =
  '        "generic-api-key:11",\n';
const serviceMarketplace =
  '        "8c08a3d3764b616f919a1e73828643dff95db5d4:"\n' +
  '        "apps/api/src/modules/service-marketplace/service-marketplace.contract.spec.ts:"\n' +
  '        "generic-api-key:11",\n';
const insertAfterSdiz =
  '        ".github/workflows/pc-crop-08f-sync-main.yml:generic-api-key:126",\n';
const finalReviewedEntries =
  '        "bcc5ba620f5e8cfec4e540c4b9fab4e236393c63:"\n' +
  '        "apps/web/tests/unit/platformV7RootWorkEntry.test.ts:generic-api-key:227",\n' +
  '        "25f4fa23451d9b2fd58ff60ba9badfc063055796:"\n' +
  '        ".github/workflows/pc-crop-w1-production-acceptance.yml:generic-api-key:391",\n' +
  '        "ba4e7b26a34f95ebc5636c6a18785a6a2d63b0b1:"\n' +
  '        ".github/workflows/pc-crop-w1-production-acceptance.yml:generic-api-key:395",\n';
const replaceExactlyOnce = (value, anchor, replacement, label) => {
  assert.equal(value.split(anchor).length - 1, 1, `Gitleaks release attestation ${label} anchor must occur exactly once`);
  return value.replace(anchor, replacement);
};
let expected = replaceExactlyOnce(
  baseline,
  insertAfterCommodity,
  insertAfterCommodity + serviceMarketplace,
  'commodity-profile',
);
expected = replaceExactlyOnce(
  expected,
  insertAfterSdiz,
  insertAfterSdiz + finalReviewedEntries,
  'SDIZ',
);
assert.equal(head, expected, 'Gitleaks release attestation repair must add exactly four reviewed fingerprints and preserve every existing assertion');
}
JS
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
  APPROVED_BRANCH_SCOPE=$(BASE_REF="$BASE_REF" HEAD_REF="$HEAD_REF" STATE_FILE="$STATE_FILE" GITHUB_HEAD_REF="$CURRENT_BRANCH" PUBLIC_HOME_SCOPE_GOVERNANCE_BRANCH="$PUBLIC_HOME_SCOPE_GOVERNANCE_BRANCH" PUBLIC_HOME_IMPLEMENTATION_BRANCH="$PUBLIC_HOME_IMPLEMENTATION_BRANCH" PUBLIC_HOME_GOVERNANCE_MANIFEST="$PUBLIC_HOME_GOVERNANCE_MANIFEST" PUBLIC_HOME_IMPLEMENTATION_MANIFEST="$PUBLIC_HOME_IMPLEMENTATION_MANIFEST" POISON_ISOLATION_SCOPE_GOVERNANCE_BRANCH="$POISON_ISOLATION_SCOPE_GOVERNANCE_BRANCH" POISON_ISOLATION_IMPLEMENTATION_BRANCH="$POISON_ISOLATION_IMPLEMENTATION_BRANCH" POISON_ISOLATION_MANIFEST="$POISON_ISOLATION_MANIFEST" node - <<'JS'
const { execFileSync } = require('node:child_process');

const baseRef = String(process.env.BASE_REF || '').trim();
const stateFile = String(process.env.STATE_FILE || '').trim();
const branch = String(process.env.GITHUB_HEAD_REF || '').trim();
const publicHomeGovernanceBranch = String(process.env.PUBLIC_HOME_SCOPE_GOVERNANCE_BRANCH || '').trim();
const publicHomeImplementationBranch = String(process.env.PUBLIC_HOME_IMPLEMENTATION_BRANCH || '').trim();
const publicHomeGovernanceManifest = String(process.env.PUBLIC_HOME_GOVERNANCE_MANIFEST || '').trim();
const publicHomeImplementationManifest = String(process.env.PUBLIC_HOME_IMPLEMENTATION_MANIFEST || '').trim();
const poisonIsolationScopeGovernanceBranch = String(process.env.POISON_ISOLATION_SCOPE_GOVERNANCE_BRANCH || '').trim();
const poisonIsolationImplementationBranch = String(process.env.POISON_ISOLATION_IMPLEMENTATION_BRANCH || '').trim();
const poisonIsolationManifest = String(process.env.POISON_ISOLATION_MANIFEST || '').trim();
if (!baseRef || !stateFile || !branch) {
  throw new Error('P7_IMMUTABLE_SCOPE: immutable scope inputs are required');
}

// These bounded recovery routes are owned by the accepted base guard.
// Candidate state and manifests cannot widen their exact path sets.
const gektaRecoveryScopes = {
  "fix/gekta-qwen35-guard-argv-form-20260928": [
    ".github/workflows/gekta-qwen35-4b-model-host-candidate.yml",
    "scripts/gekta-qwen35-4b-model-host-candidate.py"
  ],
  "fix/gekta-docker-diagnostic-route-20260927": [
    ".github/workflows/production-docker-headroom-diagnostic.yml"
  ],
  "fix/gekta-web-release-recovery-20260927": [
    "scripts/production-web-remote-entrypoint.sh",
    "scripts/production-web-exact-sha.sh",
    "scripts/check-production-web-hardening.mjs"
  ],
  "fix/gekta-answer-copy-20260927": [
    "apps/web/app/api/agro-chat/route.ts",
    "apps/web/lib/platform-v7/public-assistant-knowledge.ts",
    "apps/web/tests/unit/publicFarmerStarterQuestions.test.ts"
  ],
  "fix/gekta-han-stream-20260927": [
    "apps/api/src/modules/ai-insights/restricted-public-qwen.service.ts",
    "apps/api/src/modules/ai-insights/restricted-public-qwen.service.spec.ts",
    "apps/api/src/modules/ai-insights/restricted-public-qwen.stream.spec.ts",
    "apps/api/src/modules/ai-insights/restricted-public-qwen.stream-gate.spec.ts",
    "apps/api/src/modules/ai-insights/restricted-public-qwen.stream-gate.ts",
    "apps/web/lib/platform-v7/assistant-relevance-router.ts",
    "apps/web/tests/unit/taiSemanticRelevanceRouter.test.ts",
    "apps/web/app/api/agro-chat/route.ts",
    "apps/web/tests/unit/platformV7AgroChatModelFirstRoute.test.ts"
  ]
};
let scopes;
if (Object.hasOwn(gektaRecoveryScopes, branch)) {
  scopes = gektaRecoveryScopes[branch];
} else if (branch === publicHomeGovernanceBranch) {
  scopes = [publicHomeGovernanceManifest, publicHomeImplementationManifest];
} else if (branch === publicHomeImplementationBranch) {
  let manifest;
  try {
    const raw = execFileSync('git', ['show', `${baseRef}:${publicHomeImplementationManifest}`], { encoding: 'utf8' });
    manifest = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`P7_IMMUTABLE_SCOPE: cannot load accepted public-home manifest: ${message}`);
  }
  if (manifest.schemaVersion !== 'platform-v7.concurrent-scope.v1' || manifest.status !== 'active' || manifest.branch !== publicHomeImplementationBranch) {
    throw new Error('P7_IMMUTABLE_SCOPE: accepted public-home manifest identity is invalid');
  }
  scopes = manifest.allowedPaths;
} else if (branch === poisonIsolationScopeGovernanceBranch) {
  scopes = [poisonIsolationManifest, 'scripts/p7-autopilot-guard.sh', 'scripts/p7-autopilot-guard.test.mjs'];
} else if (branch === poisonIsolationImplementationBranch) {
  let manifest;
  try {
    const raw = execFileSync('git', ['show', `${baseRef}:${poisonIsolationManifest}`], { encoding: 'utf8' });
    manifest = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`P7_IMMUTABLE_SCOPE: cannot load accepted poison-isolation manifest: ${message}`);
  }
  if (manifest.schemaVersion !== 'platform-v7.concurrent-scope.v1' || manifest.status !== 'active' || manifest.branch !== poisonIsolationImplementationBranch) {
    throw new Error('P7_IMMUTABLE_SCOPE: accepted poison-isolation manifest identity is invalid');
  }
  scopes = manifest.allowedPaths;
} else {
  let state;
  try {
    const raw = execFileSync('git', ['show', `${baseRef}:${stateFile}`], { encoding: 'utf8' });
    state = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`P7_IMMUTABLE_SCOPE: cannot load ${baseRef}:${stateFile}: ${message}`);
  }
  scopes = state.approvedConcurrentScopes?.[branch];

  // These are separate phases on existing trusted-base-routed refs. The guard
  // repair itself keeps its three-path scope and cannot admit metadata source.
  if (branch === "governance/pc-crop-post-registration-progress-scope-4997" || branch === "fix/gitleaks-release-authority-attestation-20260912") {
    const assert = require('node:assert/strict');
    const { isDeepStrictEqual } = require('node:util');
    const requiredPurpose = {
  "owner": "ACCOUNT_2_PRODUCT",
  "purpose": "Bounded critical-path renewal of the existing trusted three-path guard ref for a separately admitted exact metadata-only repair of the expired internal landing-package exception; close the existing no-publish metadata blocker without renewing its expiry or changing application/licensing/provenance truth.",
  "authorityBaseExactMain": "7a90199a40a86cdc129f804780a8f2635cf0bccb",
  "implementationBranch": "governance/pc-crop-post-registration-progress-scope-4997",
  "allowedPaths": [
    "scripts/p7-autopilot-guard.sh",
    "scripts/p7-autopilot-guard.test.mjs",
    ".github/workflows/platform-v7-autopilot-guard.yml"
  ],
  "futureMetadataAdmissionBranch": "governance/pc-crop-post-registration-progress-scope-4997",
  "futureMetadataImplementationBranch": "fix/gitleaks-release-authority-attestation-20260912",
  "requiredTruthBoundaries": [
    "The current full-head #5744 native SBOM/IP run36794727081/job110155435088 fails because the preexisting apps/landing/package.json metadata exception expired on2026-09-30. Original IP program#4459 and the existing exception require a separately authorized metadata-only addition of license=UNLICENSED; the package already remains private=true.",
    "This purpose-only prerequisite admits no landing implementation or metadata file and changes no primary/global/R1.2/approvedConcurrentScopes/old admissions/progress. Publish a separate trusted guard repair within the already accepted three-path scope only after actual independent review, all current gates and ordinary expected-full-SHA acceptance of this purpose.",
    "The later guard must define distinct state-only admission and exact two-file metadata implementation phases on the already registered trusted-guard and Gitleaks refs. Existing native trusted-base routing remains unchanged; no workflow/IP waiver. Preserve the original one-file Gitleaks attestation phase and add only the separately accepted exact metadata pair to that existing branch scope. Source scope and exact baseline/candidate blobs must come from accepted trusted base; candidate-owned state/guard cannot grant authority.",
    "Permit only apps/landing/package.json100644 c80706ce0a424d57b2f7687bc0f4306f5c88a434→e693a061ea6d42a9c62cc1ab8350c3af904265a4 (one license field, all scripts/dependencies/private/name/other bytes preserved) and docs/ip/internal-package-metadata-exceptions.json100644872689ef5215d2b92429c465159fbf794259cc9f→c3eb22c2f4fc9ec3105e0203b7990de3b88dc345 (remove only that completed exception; schema/effective date preserved).",
    "Preserve the general apps/landing prohibition and every old security/attestation gate. Permit the exact metadata pair only in its separately accepted phase on the existing trusted Gitleaks ref, with exact baseline/head blobs and regular modes; reject mixed metadata/test/runtime edits, other manifest fields, expiry extension, stale or altered exceptions, source self-expansion and baseline/mode drift using real Git fixtures.",
    "Accept the guard before the separate state-only exact-content source admission; accept that admission before publishing either metadata file. Metadata/private-package checks do not prove proprietary authorship, third-party rights, human assignments, full IP/security completion or production acceptance.",
    "Keep the sole BANK continuation220/workspace0b9 window held. Preserve the immutable #5744 test candidate while the distinct metadata prerequisite uses the same existing trusted source ref under separate source admission and fresh PR review. After accepted metadata normalization, restore the original one-file #5744 repair on actual current main and renew every review/CI/readiness result before bounded exact-current-main canonical REG.RU web release and actual OCI/live/downstream evidence."
  ],
  "forbiddenAuthority": [
    "Landing page/runtime/component/script/dependency changes or general landing access",
    "Exception expiry extension, CI/security/license/scanner weakening or required-check override",
    "Direct metadata source admission in this purpose or later guard PR; source-owned mutable scope authority",
    "CORE/API/DB/provider/money/role/session/model or human legal/provenance authority",
    "Forced/automatic merge, stale review transfer, new recurring costs or false production/whole-block PASS"
  ],
  "teamHubDependency": "#5744 native IP metadata expiry blocker36794727081; original#4459 metadata baseline; held BANK critical path/window5916270228"
};
    const metadataTemplate = {
  "owner": "ACCOUNT_2_PRODUCT",
  "purpose": "Normalize only the already-private internal landing package license metadata and remove its completed exception; no application, dependency, publication or legal-rights change.",
  "implementationBranch": "fix/gitleaks-release-authority-attestation-20260912",
  "allowedPaths": [
    "apps/landing/package.json",
    "docs/ip/internal-package-metadata-exceptions.json"
  ],
  "preservedAttestationPaths": [
    "apps/tai/tests/test_gitleaks_release_authority.py"
  ],
  "exactMetadataFiles": [
    {
      "path": "apps/landing/package.json",
      "mode": "100644",
      "baselineBlob": "c80706ce0a424d57b2f7687bc0f4306f5c88a434",
      "candidateBlob": "e693a061ea6d42a9c62cc1ab8350c3af904265a4"
    },
    {
      "path": "docs/ip/internal-package-metadata-exceptions.json",
      "mode": "100644",
      "baselineBlob": "872689ef5215d2b92429c465159fbf794259cc9f",
      "candidateBlob": "c3eb22c2f4fc9ec3105e0203b7990de3b88dc345"
    }
  ],
  "requiredTruthBoundaries": [
    "Only add license=UNLICENSED to the existing private=true manifest and remove exactly its completed metadata exception; every other manifest byte and register schema/effective date remains unchanged.",
    "Source authority comes only from separately accepted base purpose, guard and state-only admission. The implementation cannot modify state, guard, workflow, scope or publishable-package authority.",
    "The existing attestation ref has distinct test-only and metadata-only phases. Preserve the original test path and its exact fingerprint guard; reject mixed metadata/test changes.",
    "Preserve the general landing prohibition, all existing CI/security/attestation checks, provenance and third-party/human legal remainder. No expiry extension or proprietary ownership claim.",
    "Fresh whole-head independent review, native private-package/IP/security/source checks and manual full-expected-SHA readiness/merge required; current-main REG.RU release remains a separate acceptance."
  ],
  "forbiddenAuthority": [
    "Landing runtime/pages/components/scripts/dependencies or any other manifest field",
    "Expired-exception renewal, new exception or publishable-package authorization",
    "Source-owned scope, CI/security/readiness weakening, forced/automatic merge",
    "CORE/API/DB/money/provider/role/session/model or human legal/provenance authority"
  ],
  "teamHubDependency": "#5744 IP expiry blocker36794727081; original IP#4459; BANK hold5916270228; purpose#5749"
};
    const metadataKey = "landing-package-metadata-20261001";
    const metadataPaths = metadataTemplate.allowedPaths;
    const originalTestScope = metadataTemplate.preservedAttestationPaths;
    const combinedScope = [...originalTestScope, ...metadataPaths];
    const headRef = String(process.env.HEAD_REF || 'HEAD');
    const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
    const readState = ref => execFileSync('git', ['show', `${ref}:${stateFile}`], { encoding: 'utf8' });
    const treeEntry = (ref, file) => git(['ls-tree', ref, '--', file]);
    const regularBlob = (ref, file, blob) => assert.equal(treeEntry(ref, file), `100644 blob ${blob}\t${file}`, `LANDING_METADATA_EXACT_FILE:${ref}:${file}`);
    const regularState = ref => assert.match(treeEntry(ref, stateFile), /^100644 blob [0-9a-f]{40}\t/u, 'LANDING_METADATA_STATE_FILE_MODE');
    const makeAdmission = authorityBaseExactMain => ({ ...metadataTemplate, authorityBaseExactMain });
    const changes = git(['diff', '--no-renames', '--name-status', `${baseRef}...${headRef}`])
      .split('\n').filter(Boolean).map(line => line.split('\t')).sort((a, b) => a[1].localeCompare(b[1], 'en'));
    // Historical explicit base-owned state scopes keep their original behavior.
    // This new admission exists only after its separate purpose was accepted.
    const admissionPhase = branch === "governance/pc-crop-post-registration-progress-scope-4997" && changes.some(change => change[1] === stateFile) &&
      Object.hasOwn(state.coordinationAdmissions || {}, "landing-package-metadata-guard-purpose-20261001");
    const metadataPhase = branch === "fix/gitleaks-release-authority-attestation-20260912" && changes.some(change => metadataPaths.includes(change[1]));
    if (admissionPhase || metadataPhase) {
      if (!isDeepStrictEqual(state.coordinationAdmissions?.["landing-package-metadata-guard-purpose-20261001"], requiredPurpose) ||
          !isDeepStrictEqual(state.approvedConcurrentScopes?.["governance/pc-crop-post-registration-progress-scope-4997"], requiredPurpose.allowedPaths)) {
        throw new Error('LANDING_METADATA_TRUSTED_PURPOSE_MISMATCH');
      }
      const baseSha = git(['rev-parse', `${baseRef}^{commit}`]);
      if (git(['merge-base', baseRef, headRef]) !== baseSha) throw new Error('LANDING_METADATA_BASE_NOT_ANCESTOR');
      regularState(baseRef);
      regularState(headRef);
      if (admissionPhase) {
        if (Object.hasOwn(state.coordinationAdmissions || {}, metadataKey)) throw new Error('LANDING_METADATA_ADMISSION_ALREADY_PRESENT');
        if (!isDeepStrictEqual(state.approvedConcurrentScopes?.["fix/gitleaks-release-authority-attestation-20260912"], originalTestScope)) throw new Error('LANDING_METADATA_ORIGINAL_ATTESTATION_SCOPE_MISMATCH');
        if (!isDeepStrictEqual(changes, [['M', stateFile]])) throw new Error('LANDING_METADATA_ADMISSION_DIFF_SCOPE');
        for (const file of metadataTemplate.exactMetadataFiles) {
          regularBlob(baseRef, file.path, file.baselineBlob);
          regularBlob(headRef, file.path, file.baselineBlob);
        }
        const expected = structuredClone(state);
        expected.approvedConcurrentScopes["fix/gitleaks-release-authority-attestation-20260912"] = combinedScope;
        expected.coordinationAdmissions[metadataKey] = makeAdmission(baseSha);
        assert.equal(readState(baseRef), `${JSON.stringify(state, null, 2)}\n`, 'LANDING_METADATA_CANONICAL_BASE_STATE');
        assert.equal(readState(headRef), `${JSON.stringify(expected, null, 2)}\n`, 'LANDING_METADATA_ADMISSION_STATE_MUTATION');
        scopes = [stateFile];
      } else {
        const accepted = state.coordinationAdmissions?.[metadataKey];
        const origin = accepted?.authorityBaseExactMain;
        if (typeof origin !== 'string' || !/^[0-9a-f]{40}$/u.test(origin) ||
            !isDeepStrictEqual(accepted, makeAdmission(origin)) ||
            !isDeepStrictEqual(scopes, combinedScope)) throw new Error('LANDING_METADATA_ACCEPTED_ADMISSION_MISMATCH');
        try {
          if (git(['merge-base', origin, baseRef]) !== origin) throw new Error('not ancestor');
        } catch {
          throw new Error('LANDING_METADATA_ADMISSION_ORIGIN_NOT_ANCESTOR');
        }
        regularState(origin);
        const authorityBase = JSON.parse(readState(origin));
        if (!isDeepStrictEqual(authorityBase.coordinationAdmissions?.["landing-package-metadata-guard-purpose-20261001"], requiredPurpose) ||
            !isDeepStrictEqual(authorityBase.approvedConcurrentScopes?.["governance/pc-crop-post-registration-progress-scope-4997"], requiredPurpose.allowedPaths) ||
            !isDeepStrictEqual(authorityBase.approvedConcurrentScopes?.["fix/gitleaks-release-authority-attestation-20260912"], originalTestScope) ||
            Object.hasOwn(authorityBase.coordinationAdmissions || {}, metadataKey)) throw new Error('LANDING_METADATA_ADMISSION_ORIGIN_INVALID');
        const expectedChanges = metadataPaths.map(file => ['M', file]).sort((a, b) => a[1].localeCompare(b[1], 'en'));
        if (!isDeepStrictEqual(changes, expectedChanges)) throw new Error('LANDING_METADATA_IMPLEMENTATION_DIFF_SCOPE');
        for (const file of metadataTemplate.exactMetadataFiles) {
          regularBlob(origin, file.path, file.baselineBlob);
          regularBlob(baseRef, file.path, file.baselineBlob);
          regularBlob(headRef, file.path, file.candidateBlob);
        }
        assert.equal(readState(headRef), readState(baseRef), 'LANDING_METADATA_IMPLEMENTATION_STATE_MUTATION');
        scopes = [...metadataPaths];
      }
    }
  }

  if (branch === 'ux/deal-runtime-unknown-20260929' ||
      branch === 'governance/product-deal-runtime-admission-20260929') {
    const { isDeepStrictEqual } = require('node:util');
    const implementationBranch = 'ux/deal-runtime-unknown-20260929';
    const admissionBranch = 'governance/product-deal-runtime-admission-20260929';
    const coordinationKey = 'deal-runtime-unknown-20260929';
    const paths = [
      'apps/web/components/transaction-ux/TransactionDealWorkspace.tsx',
      'apps/web/tests/unit/transactionDealWorkspaceRecovery.test.tsx',
      'apps/web/tests/unit/transactionUxV8Migration.test.ts',
      '.github/workflows/ci.yml',
      'docs/platform-v7/qa/web-unit-coverage-registry.json',
    ];
    const requiredRenewal = {
      "owner": "ACCOUNT_1_EXECUTION",
      "purpose": "Renew the existing accepted-base three-path PRODUCT guard ref only to admit the actual production-resolved Deal UNKNOWN recovery repair after the tsconfig/Vitest binding mismatch; no runtime source in this prerequisite.",
      "authorityBaseExactMain": "e94482fecf13ecbf94569f92cfb01fab8b61521d",
      "implementationBranch": "governance/pc-crop-post-registration-progress-scope-4997",
      "allowedPaths": [
        "scripts/p7-autopilot-guard.sh",
        "scripts/p7-autopilot-guard.test.mjs",
        ".github/workflows/platform-v7-autopilot-guard.yml"
      ],
      "requiredTruthBoundaries": [
        "The accepted main already restricts this guard ref to exactly these three regular files. This state-only record renews its bounded purpose; it does not alter global scope, approvedConcurrentScopes, R1.2 or any existing admission.",
        "Preserve the existing trusted-base workflow routes and all old negative checks. Register a separate bounded Deal-runtime source branch and its later state-only admission with exact path, base, file-mode and self-expansion rejection; do not broaden #5720.",
        "The intended runtime target is apps/web/components/transaction-ux/TransactionDealWorkspace.tsx; the regression must resolve the module actually used by the protected Deal route, not assume the generic Vitest @ alias matches Next.",
        "No runtime or test path is admitted by this prerequisite or by the guard PR itself. Obtain separate exact-main state-only source admission after the guard is independently reviewed, all substantive CI passes and its expected-SHA merge completes.",
        "Preserve the existing transaction-ux design, App Shell, tsconfig aliases, server-owned role/auth/tenant/Deal/command authority and mounted UNKNOWN with exact-attempt receipt verification and GET-only recovery. No independent review may be supplied by the implementation author.",
        "#5720 remains parked and its detached-component test PASS is not delivery evidence. Preserve the single held release window; production and #5714/model-host mutation stay blocked until the actual runtime repair is accepted."
      ],
      "forbiddenAuthority": [
        "Runtime source, tests, state or scope manifests in the three-path guard PR; direct runtime admission in this state-only prerequisite",
        "Global scope, existing admissions, CI/security/readiness thresholds, branch protection or independent-review policy weakening",
        "Backend/API/DB/role/tenant/idempotency/payment/provider/FGIS authority, design replacement, alias removal, new recurring cost or production mutation"
      ],
      "teamHubDependency": "#5469 dependency 5887083491; checkpoint 5887212388; source-operator CLAIM 5887350938; ACCOUNT_2_PRODUCT independent review"
    };
    if (!isDeepStrictEqual(state.coordinationAdmissions?.['deal-runtime-binding-guard-reuse-20260929'], requiredRenewal) ||
        !isDeepStrictEqual(state.approvedConcurrentScopes?.[requiredRenewal.implementationBranch], requiredRenewal.allowedPaths)) {
      throw new Error('DEAL_RUNTIME_GUARD_RENEWAL_MISMATCH');
    }
    const headRef = String(process.env.HEAD_REF || 'HEAD');
    const baseSha = execFileSync('git', ['rev-parse', `${baseRef}^{commit}`], { encoding: 'utf8' }).trim();
    const mergeBase = execFileSync('git', ['merge-base', baseRef, headRef], { encoding: 'utf8' }).trim();
    if (mergeBase !== baseSha) throw new Error('DEAL_RUNTIME_BASE_NOT_ANCESTOR');
    const readState = (ref) => execFileSync('git', ['show', `${ref}:${stateFile}`], { encoding: 'utf8' });
    const fileMode = (ref, file) => execFileSync('git', ['ls-tree', ref, '--', file], { encoding: 'utf8' }).split(' ')[0];
    const fields = execFileSync('git', ['diff', '--no-renames', '--name-status', '-z', `${baseRef}...${headRef}`], { encoding: 'utf8' }).split('\0');
    if (fields.pop() !== '' || fields.length % 2 !== 0) throw new Error('DEAL_RUNTIME_DIFF_METADATA_INVALID');
    const changes = [];
    for (let index = 0; index < fields.length; index += 2) changes.push([fields[index], fields[index + 1]]);
    const makeAdmission = (authorityBaseExactMain) => ({
      owner: 'ACCOUNT_1_EXECUTION',
      purpose: 'Repair UNKNOWN command recovery in the existing production-resolved TransactionDealWorkspace and prove the same runtime binding without changing its approved design.',
      authorityBaseExactMain,
      implementationBranch,
      allowedPaths: paths,
      requiredTruthBoundaries: [
        'The trusted-base guard admits exactly the runtime component, its production-resolved behavior regression and the existing transaction-ux migration regression plus their exact CI invocation and coverage-registry wiring; candidate state cannot widen scope.',
        'Preserve the transaction-ux design, facade and tsconfig aliases; exercise the module resolved by the protected Deal route rather than the detached platform-v7 component.',
        'Lost or unverifiable command responses remain UNKNOWN with the original attempt identity, no fresh command replay and GET-only recovery; only an exact-attempt server receipt establishes a known outcome.',
        'Cover actual RU/EN/zh-CN recovery states and preserve migration binding, shell, server-owned role/auth/tenant/action authority and accessibility assertions.',
        'Require fresh exact-head author audit, independent review and all substantive CI/readiness before normal expected-SHA merge; source evidence is not REG.RU live acceptance.',
        'The existing ci.yml invocation must execute both recovery and migration regressions without losing any prior test or changing workflow behavior; the coverage registry may only remove the migration test exclusion.',
      ],
      forbiddenAuthority: [
        'Candidate state, scope, guard, unrelated workflow, alias, facade or design replacement',
        'Backend/API/DB/role/tenant/idempotency/payment/provider/FGIS authority or production/model-host mutation',
        'CI/security/readiness weakening, independent-review impersonation, forced merge or new recurring cost',
      ],
      teamHubDependency: '#5469 runtime binding dependency5887083491; migration regression5887595513; guard-purpose renewal #5721',
    });
    const localePurposeKey = 'deal-destination-locale-guard-purpose-20261001';
    const localeAdmissionKey = 'deal-destination-locale-20261001';
    if (Object.hasOwn(state.coordinationAdmissions || {}, localePurposeKey)) {
      const requiredLocalePurpose = {
      "owner": "ACCOUNT_1_EXECUTION",
      "presentationContributor": "ACCOUNT_2_PRODUCT",
      "purpose": "Renew the existing accepted three-path PRODUCT guard ref for separately admitted RU/EN/ZH presentation on the actual protected Deal destination, resolving #5735 destination-language finding without changing command or server authority.",
      "authorityBaseExactMain": "2d0db1af028b9d9d17d5a1e84a4dbe86ec990d68",
      "implementationBranch": "governance/pc-crop-post-registration-progress-scope-4997",
      "allowedPaths": [
            "scripts/p7-autopilot-guard.sh",
            "scripts/p7-autopilot-guard.test.mjs",
            ".github/workflows/platform-v7-autopilot-guard.yml"
      ],
      "futureAdmissionBranch": "governance/product-deal-runtime-admission-20260929",
      "futureImplementationBranch": "ux/deal-runtime-unknown-20260929",
      "futureAdditionalSourcePaths": [
            "apps/web/app/platform-v7/deals/[id]/execution/page.tsx",
            "apps/web/components/platform-v7/DealCommandForm.tsx",
            "apps/web/i18n/transaction-deal-copy.ts",
            "packages/design-system-v8/src/components.tsx"
      ],
      "reviewedPrivatePayload": {
            "sha256": "6666012b47c9179f132149d010d13284309d7fe5ec2689373dba18ccdcc4024e",
            "sourceComments": [
                  5908067884,
                  5908071391
            ],
            "authorAuditComment": 5908085804,
            "independentPrivateReviewComment": 5916309103
      },
      "requiredTruthBoundaries": [
            "This one-file purpose record admits no runtime, test, workflow or new source path. Global/current/R1.2 scopes, approvedConcurrentScopes, every existing admission, progress and maturity remain unchanged.",
            "After this purpose is independently reviewed and accepted, use the existing already admitted three-path guard ref for a separate trusted-base literal guard repair and adversarial tests. Preserve all existing admission phases, metadata/attestation routes and trusted-base plus PR-head defense.",
            "The guard must define a separate exact state-only extension phase on the existing Deal-runtime admission ref. Preserve the full original five-path runtime scope and add only the four listed paths in a later independently reviewed accepted state. Candidate-owned state or a manifest cannot grant implementation authority.",
            "Publish no Deal locale source before the separately accepted guard and state-only source extension. Use the existing production-resolved transaction-ux workspace and NextIntl request locale; keep the facade, tsconfig mapping, shell and approved design.",
            "Preserve all original UNKNOWN attempt identity, immutable request fingerprint, draft/review/focus state, exact server role/tenant/Deal/action permissions, CSRF, GET-only recovery and duplicate command prevention. Locale changes affect presentation only.",
            "The captured six-file private payload and its bounded review are support, not current-head CI, admission, native account approval, full browser acceptance or production evidence. Obtain fresh independent whole-source review, author audit and every applicable CI/security/readiness gate after actual adoption.",
            "Preserve original source authors and canonical CORE ownership. Queue the shared guard writer and any main/release action after the current Gekta owner window; do not overwrite another owner's ref or issue a competing deployment command.",
            "Require normal expected-full-SHA manual merges and exact-current-main REG.RU OCI/container/live acceptance followed by the ordinary authorized bank queue to the same Deal in RU/EN/ZH. Public or seeded fixture evidence does not close protected bank, 13-cabinet or provider acceptance."
      ],
      "forbiddenAuthority": [
            "Direct runtime/test/source admission, permission-vector changes or another owner's branch mutation in this purpose PR",
            "Backend/API/DB/RLS/tenant/role/session/command/payment/provider/FGIS or legal authority",
            "Design or App Shell replacement, duplicate Deal core, alias removal, business-status or external-success inference",
            "CI/security/readiness/independent-review weakening, fake PASS, forced/automatic merge, production/model mutation or new recurring cost"
      ],
      "teamHubDependency": "#5735 P2 thread4142098743; source5908067884/5908071391; private review5916309103; #5699; current Gekta next window5924684608"
};
      if (!isDeepStrictEqual(state.coordinationAdmissions[localePurposeKey], requiredLocalePurpose)) {
        throw new Error('DEAL_LOCALE_PURPOSE_MISMATCH');
      }
      const additionalPaths = [
      "apps/web/app/platform-v7/deals/[id]/execution/page.tsx",
      "apps/web/components/platform-v7/DealCommandForm.tsx",
      "apps/web/i18n/transaction-deal-copy.ts",
      "packages/design-system-v8/src/components.tsx"
];
      const sourcePaths = [
      "apps/web/components/transaction-ux/TransactionDealWorkspace.tsx",
      "apps/web/tests/unit/transactionDealWorkspaceRecovery.test.tsx",
      "apps/web/app/platform-v7/deals/[id]/execution/page.tsx",
      "apps/web/components/platform-v7/DealCommandForm.tsx",
      "apps/web/i18n/transaction-deal-copy.ts",
      "packages/design-system-v8/src/components.tsx"
];
      const extendedPaths = [...paths, ...additionalPaths];
      const pins = [
      [
            "apps/web/components/transaction-ux/TransactionDealWorkspace.tsx",
            "6f980ea5c83dc9776d51fe01b6f33bf21704a037",
            "be57e8931fc5a056ed59039d9bf0da6f98aeb6fe"
      ],
      [
            "apps/web/tests/unit/transactionDealWorkspaceRecovery.test.tsx",
            "4cf04d22287002bf90888847153bfe9759d8e1fd",
            "1c669249fcf4451bc0655f506d975edc069fe81c"
      ],
      [
            "apps/web/app/platform-v7/deals/[id]/execution/page.tsx",
            "699ae74d30128e72ccad0a4559ad40944b3ecda8",
            "2099bb5fcd731368ffccecd096ebb10320379257"
      ],
      [
            "apps/web/components/platform-v7/DealCommandForm.tsx",
            "7bde1116c8e84e2f253da69431d867ceaa90663d",
            "aba1af6c10dbbee0cee25cb13bdbce40145024a2"
      ],
      [
            "apps/web/i18n/transaction-deal-copy.ts",
            null,
            "4db89dfdec3f5f871760461a60dd2f89194329a1"
      ],
      [
            "packages/design-system-v8/src/components.tsx",
            "3f95e51e99858debcd3f784e5b77b05be9619ccd",
            "3f29bfef940801667273f066a02d34f20c2be8b5"
      ]
];
      const priorAdmission = state.coordinationAdmissions?.[coordinationKey];
      const priorBase = priorAdmission?.authorityBaseExactMain;
      if (typeof priorBase !== 'string' || !/^[0-9a-f]{40}$/u.test(priorBase) ||
          !isDeepStrictEqual(priorAdmission, makeAdmission(priorBase))) {
        throw new Error('DEAL_LOCALE_PRIOR_ADMISSION_MISMATCH');
      }
      const makeLocaleAdmission = (authorityBaseExactMain) => ({
        owner: 'ACCOUNT_1_EXECUTION',
        presentationContributor: 'ACCOUNT_2_PRODUCT',
        sourceOwnerRetained: 'ACCOUNT_1_EXECUTION',
        purpose: 'Apply only the already reviewed RU/EN/ZH protected Deal presentation payload while preserving canonical UNKNOWN recovery and server authority.',
        authorityBaseExactMain,
        implementationBranch,
        allowedPaths: extendedPaths,
        exactSourcePaths: sourcePaths,
        exactSourcePins: pins,
        reviewedPrivatePayloadSha256: '6666012b47c9179f132149d010d13284309d7fe5ec2689373dba18ccdcc4024e',
        requiredTruthBoundaries: [
          'Presentation only; actual route/locale/workspace/form and stable metadata labels. Original command controls, owner, identity, UNKNOWN/fingerprint, CSRF and permissions remain canonical.',
          'The original five-path scope and all old records remain intact. This locale phase permits exactly the six pinned source/test files; it does not permit workflow, registry, generated inventory or scope changes.',
          'No private source review transfers to an adopted SHA. Fresh whole-head nonauthor review, owner audit, native CI/security/readiness, expected-SHA merge and exact REG.RU protected acceptance remain required.',
        ],
        forbiddenAuthority: ['API/DB/role/tenant/money/provider/FGIS authority', 'Source-owned scope or guard changes', 'CI/security/readiness or review weakening', 'False live or external success'],
      });
      const inventoryPurposeKey = 'deal-locale-generated-inventory-guard-purpose-20261001';
      const inventoryAdmissionKey = 'deal-locale-generated-inventory-20261001';
      const generatedPaths = ['docs/security/cryptographic-inventory.json', 'docs/security/CRYPTOGRAPHIC_INVENTORY.md'];
      const completionPaths = [...extendedPaths, ...generatedPaths];
      const requiredInventoryPurpose = {
        "owner": "ACCOUNT_1_EXECUTION",
        "presentationContributor": "ACCOUNT_2_PRODUCT",
        "sourceOwnerRetained": "ACCOUNT_1_EXECUTION",
        "purpose": "Add a separate trusted generated-inventory completion phase for the already admitted immutable six-file Deal locale payload, after native SBOM discovery identified one newly scanned catalog file.",
        "authorityBaseExactMain": "4f5d03b833f0064b4538aae751d74f17e6d67c88",
        "implementationBranch": "governance/pc-crop-post-registration-progress-scope-4997",
        "allowedPaths": [
          "scripts/p7-autopilot-guard.sh",
          "scripts/p7-autopilot-guard.test.mjs",
          ".github/workflows/platform-v7-autopilot-guard.yml"
        ],
        "futureAdmissionBranch": "governance/product-deal-runtime-admission-20260929",
        "futureImplementationBranch": "ux/deal-runtime-unknown-20260929",
        "futureGeneratedPaths": [
          "docs/security/cryptographic-inventory.json",
          "docs/security/CRYPTOGRAPHIC_INVENTORY.md"
        ],
        "trustedGenerator": {
          "path": "scripts/security/discover-cryptography.mjs",
          "blob": "6a5751eb031a514bcf7f26893c0003e6013107aa"
        },
        "immutableLocaleSourcePins": [
          [
            "apps/web/components/transaction-ux/TransactionDealWorkspace.tsx",
            "6f980ea5c83dc9776d51fe01b6f33bf21704a037",
            "be57e8931fc5a056ed59039d9bf0da6f98aeb6fe"
          ],
          [
            "apps/web/tests/unit/transactionDealWorkspaceRecovery.test.tsx",
            "4cf04d22287002bf90888847153bfe9759d8e1fd",
            "1c669249fcf4451bc0655f506d975edc069fe81c"
          ],
          [
            "apps/web/app/platform-v7/deals/[id]/execution/page.tsx",
            "699ae74d30128e72ccad0a4559ad40944b3ecda8",
            "2099bb5fcd731368ffccecd096ebb10320379257"
          ],
          [
            "apps/web/components/platform-v7/DealCommandForm.tsx",
            "7bde1116c8e84e2f253da69431d867ceaa90663d",
            "aba1af6c10dbbee0cee25cb13bdbce40145024a2"
          ],
          [
            "apps/web/i18n/transaction-deal-copy.ts",
            null,
            "4db89dfdec3f5f871760461a60dd2f89194329a1"
          ],
          [
            "packages/design-system-v8/src/components.tsx",
            "3f95e51e99858debcd3f784e5b77b05be9619ccd",
            "3f29bfef940801667273f066a02d34f20c2be8b5"
          ]
        ],
        "nativeFailureEvidence": {
          "pr": 5757,
          "head": "6d41a54b2d7d8581fc3d9a67cf72cefbbb2fa2cc",
          "workflowRun": 36822141734,
          "job": 110239819384,
          "observedScannedFiles": 2294,
          "baselineScannedFiles": 2293
        },
        "requiredTruthBoundaries": [
          "Purpose only: append one record and preserve every prior state value/byte, primary/current/global/R1.2 permissions, every scope vector and admission, CORE ownership and official 5/100 progress. No new source or generated output is admitted here.",
          "After separate purpose acceptance, use only the already admitted three-path trusted guard lane for a separately reviewed guard/test repair. Preserve all old phases, exact six locale source pins/modes, required audit/review/CI/security/readiness and metadata/attestation defenses.",
          "Then separately accept exactly one metadata co-admission record and append only the two listed generated paths after all nine existing runtime paths. Preserve the immutable original locale admission record and all six source blobs. No runtime or generated output in this state phase.",
          "The new completion phase must bind a genuine accepted guard base and verify its ancestry, unchanged state, exactly six admitted source changes plus both regular generated files, trusted accepted-base generator bytes/mode, full committed source blob/mode enumeration, attributable ancestor source-tree equality and byte-exact regenerated JSON/Markdown. Treat candidate application blobs as text; never execute candidate code.",
          "The six-file presentation payload stays immutable. No arbitrary extra source, test, registry/workflow, source-owned guard/scope or crypto exclusion is granted. The existing protected route assertion receives a separate compatibility repair in its already admitted PRODUCT test lane, retaining actual canonical identity and command authority checks.",
          "Every adopted current head requires fresh independent whole-diff review, author audit, all applicable native gates and ordinary expected-full-SHA merge. Unit/static/fixture/native acceptance is not actual REG.RU/provider/Founder13 production proof."
        ],
        "forbiddenAuthority": [
          "API/DB/role/tenant/money/provider/FGIS/model authority",
          "General generated documentation or source scope",
          "Security/readiness/coverage/review weakening or forced/automatic merge",
          "Fake source/history/producer metadata or live/external PASS"
        ],
        "teamHubDependency": "#5469 owner-priority decision5925195179; accepted locale purpose5754/guard5755/admission5756; native source5757"
      };
      const requireInventoryPurpose = () => {
        if (!isDeepStrictEqual(state.coordinationAdmissions?.[inventoryPurposeKey], requiredInventoryPurpose)) {
          throw new Error('DEAL_LOCALE_INVENTORY_PURPOSE_MISMATCH');
        }
      };
      const makeInventoryAdmission = (authorityBaseExactMain) => ({
        owner: 'ACCOUNT_1_EXECUTION',
        presentationContributor: 'ACCOUNT_2_PRODUCT',
        sourceOwnerRetained: 'ACCOUNT_1_EXECUTION',
        purpose: 'Complete the immutable six-file Deal locale transition with only its byte-exact trusted generated cryptographic inventory pair.',
        authorityBaseExactMain,
        implementationBranch,
        allowedPaths: completionPaths,
        retainedLocaleAdmissionKey: localeAdmissionKey,
        exactSourcePins: pins,
        exactGeneratedPaths: generatedPaths,
        trustedGenerator: { path: 'scripts/security/discover-cryptography.mjs', mode: '100644', blob: '6a5751eb031a514bcf7f26893c0003e6013107aa' },
        requiredTruthBoundaries: [
          'Separate completion phase only. Preserve every old record and the immutable six source blobs; append only the two generated paths after the existing nine paths.',
          'Unchanged state and exactly six source transitions plus both regular generated files; no arbitrary source, workflow, registry, guard or scope mutation.',
          'Use only the unchanged pinned accepted-base generator and committed application blobs as text. Verify full source enumeration, modes, attributable ancestor/source-tree equality, and byte-exact JSON/Markdown reproduction.',
          'Fresh whole-head independent review, separate owner audit, all applicable native CI/security/readiness and ordinary full-expected-SHA merge remain mandatory. No protected/live/provider/Founder13 acceptance is inferred.',
        ],
        forbiddenAuthority: ['API/DB/role/tenant/money/provider/FGIS/model authority', 'General source or generated-output permissions', 'Candidate-code execution during regeneration', 'CI/security/review/readiness weakening or false live/external PASS'],
      });
      const completionAdmitted = Object.hasOwn(state.coordinationAdmissions || {}, inventoryAdmissionKey);
      if (branch === admissionBranch && Object.hasOwn(state.coordinationAdmissions || {}, localeAdmissionKey) &&
          Object.hasOwn(state.coordinationAdmissions || {}, inventoryPurposeKey)) {
        requireInventoryPurpose();
        if (completionAdmitted) throw new Error('DEAL_LOCALE_INVENTORY_ALREADY_ADMITTED');
        const retained = state.coordinationAdmissions[localeAdmissionKey];
        const retainedBase = retained?.authorityBaseExactMain;
        if (typeof retainedBase !== 'string' || !/^[0-9a-f]{40}$/u.test(retainedBase) ||
            !isDeepStrictEqual(retained, makeLocaleAdmission(retainedBase)) ||
            !isDeepStrictEqual(state.approvedConcurrentScopes?.[implementationBranch], extendedPaths)) {
          throw new Error('DEAL_LOCALE_INVENTORY_PRIOR_ADMISSION_MISMATCH');
        }
        try {
          execFileSync('git', ['merge-base', '--is-ancestor', retainedBase, baseRef], { stdio: 'pipe' });
          execFileSync('git', ['merge-base', '--is-ancestor', priorBase, baseRef], { stdio: 'pipe' });
        } catch { throw new Error('DEAL_LOCALE_INVENTORY_PRIOR_BASE_NOT_ANCESTOR'); }
        if (!isDeepStrictEqual(changes, [['M', stateFile]])) throw new Error('DEAL_LOCALE_INVENTORY_ADMISSION_DIFF_SCOPE');
        if ([baseRef, headRef].some((ref) => fileMode(ref, stateFile) !== '100644')) throw new Error('DEAL_LOCALE_INVENTORY_ADMISSION_FILE_MODE');
        const expected = structuredClone(state);
        expected.approvedConcurrentScopes[implementationBranch] = completionPaths;
        expected.coordinationAdmissions[inventoryAdmissionKey] = makeInventoryAdmission(baseSha);
        if (!isDeepStrictEqual(JSON.parse(readState(headRef)), expected)) throw new Error('DEAL_LOCALE_INVENTORY_ADMISSION_STATE_MUTATION');
        // Only these two insertions may change accepted state bytes. Comparing
        // parsed values alone would admit old-record reordering, reserialization
        // and duplicate keys whose final value happens to match the old state.
        const renderEntry = (key, value) => JSON.stringify({ [key]: value }, null, 2)
          .slice(2, -2).split('\n').map((line) => '  ' + line).join('\n');
        const baseText = readState(baseRef);
        const oldVector = renderEntry(implementationBranch, extendedPaths);
        const stateEnd = '\n  }\n}\n';
        if (Object.keys(state).at(-1) !== 'coordinationAdmissions' ||
            Object.keys(state.coordinationAdmissions).length === 0 ||
            !baseText.endsWith(stateEnd) || baseText.split(oldVector).length !== 2) {
          throw new Error('DEAL_LOCALE_INVENTORY_ADMISSION_TEXT_BASE');
        }
        let expectedText = baseText.replace(oldVector, renderEntry(implementationBranch, completionPaths));
        expectedText = expectedText.slice(0, -stateEnd.length) + ',\n' +
          renderEntry(inventoryAdmissionKey, makeInventoryAdmission(baseSha)) + stateEnd;
        if (!isDeepStrictEqual(JSON.parse(expectedText), expected)) throw new Error('DEAL_LOCALE_INVENTORY_ADMISSION_TEXT_BASE');
        if (readState(headRef) !== expectedText) throw new Error('DEAL_LOCALE_INVENTORY_ADMISSION_TEXT_MUTATION');
        scopes = [stateFile];
      } else if (branch === admissionBranch) {
        if (Object.hasOwn(state.coordinationAdmissions || {}, localeAdmissionKey)) {
          throw new Error('DEAL_LOCALE_ADMISSION_ALREADY_PRESENT');
        }
        if (!isDeepStrictEqual(state.approvedConcurrentScopes?.[implementationBranch], paths)) {
          throw new Error('DEAL_LOCALE_PRIOR_SCOPE_MISMATCH');
        }
        if (!isDeepStrictEqual(changes, [['M', stateFile]])) throw new Error('DEAL_LOCALE_ADMISSION_DIFF_SCOPE');
        if ([baseRef, headRef].some((ref) => fileMode(ref, stateFile) !== '100644')) {
          throw new Error('DEAL_LOCALE_ADMISSION_FILE_MODE');
        }
        const expected = structuredClone(state);
        expected.approvedConcurrentScopes[implementationBranch] = extendedPaths;
        expected.coordinationAdmissions[localeAdmissionKey] = makeLocaleAdmission(baseSha);
        if (!isDeepStrictEqual(JSON.parse(readState(headRef)), expected)) {
          throw new Error('DEAL_LOCALE_ADMISSION_STATE_MUTATION');
        }
        scopes = [stateFile];
      } else {
        const accepted = state.coordinationAdmissions?.[localeAdmissionKey];
        const acceptedBase = accepted?.authorityBaseExactMain;
        if (typeof acceptedBase !== 'string' || !/^[0-9a-f]{40}$/u.test(acceptedBase) ||
            !isDeepStrictEqual(accepted, makeLocaleAdmission(acceptedBase)) ||
            !isDeepStrictEqual(state.approvedConcurrentScopes?.[implementationBranch], completionAdmitted ? completionPaths : extendedPaths)) {
          throw new Error('DEAL_LOCALE_ACCEPTED_ADMISSION_MISMATCH');
        }
        try {
          execFileSync('git', ['merge-base', '--is-ancestor', acceptedBase, baseRef], { stdio: 'pipe' });
          execFileSync('git', ['merge-base', '--is-ancestor', priorBase, baseRef], { stdio: 'pipe' });
        } catch {
          throw new Error('DEAL_LOCALE_ADMISSION_BASE_NOT_ANCESTOR');
        }
        if (readState(headRef) !== readState(baseRef)) throw new Error('DEAL_LOCALE_IMPLEMENTATION_STATE_MUTATION');
        if (completionAdmitted) {
          requireInventoryPurpose();
          const inventoryAdmission = state.coordinationAdmissions[inventoryAdmissionKey];
          const inventoryBase = inventoryAdmission?.authorityBaseExactMain;
          if (typeof inventoryBase !== 'string' || !/^[0-9a-f]{40}$/u.test(inventoryBase) ||
              !isDeepStrictEqual(inventoryAdmission, makeInventoryAdmission(inventoryBase))) {
            throw new Error('DEAL_LOCALE_INVENTORY_ACCEPTED_ADMISSION_MISMATCH');
          }
          try { execFileSync('git', ['merge-base', '--is-ancestor', inventoryBase, baseRef], { stdio: 'pipe' }); }
          catch { throw new Error('DEAL_LOCALE_INVENTORY_BASE_NOT_ANCESTOR'); }
          for (const file of generatedPaths) {
            if ([baseRef, headRef].some((ref) => fileMode(ref, file) !== '100644')) throw new Error('DEAL_LOCALE_INVENTORY_OUTPUT_MODE:' + file);
          }
        }
        const expectedChanges = pins.map(([file, oldBlob]) => [oldBlob === null ? 'A' : 'M', file]);
        if (completionAdmitted) expectedChanges.push(...generatedPaths.map((file) => ['M', file]));
        const sorted = (items) => [...items].sort((left, right) => left[1].localeCompare(right[1], 'en'));
        if (!isDeepStrictEqual(sorted(changes), sorted(expectedChanges))) throw new Error('DEAL_LOCALE_IMPLEMENTATION_DIFF_SCOPE');
        for (const [file, oldBlob, newBlob] of pins) {
          const treeEntry = (ref) => execFileSync('git', ['ls-tree', ref, '--', file], { encoding: 'utf8' }).trim();
          const before = treeEntry(baseRef);
          const after = treeEntry(headRef);
          if ((oldBlob === null ? before !== '' : before !== `100644 blob ${oldBlob}\t${file}`) ||
              after !== `100644 blob ${newBlob}\t${file}`) {
            throw new Error('DEAL_LOCALE_SOURCE_PIN_OR_MODE_MISMATCH:' + file);
          }
        }
        if (completionAdmitted) {
          const pinnedGenerator = 'scripts/security/discover-cryptography.mjs';
          if ([baseRef, headRef].some((ref) => fileMode(ref, pinnedGenerator) !== '100644' ||
              execFileSync('git', ['rev-parse', ref + ':' + pinnedGenerator], { encoding: 'utf8' }).trim() !== '6a5751eb031a514bcf7f26893c0003e6013107aa')) {
            throw new Error('DEAL_LOCALE_INVENTORY_GENERATOR_PIN_OR_MODE');
          }
        const generatorPath = 'scripts/security/discover-cryptography.mjs';
        if (!['100644', '100755'].includes(fileMode(baseRef, generatorPath)) ||
            fileMode(headRef, generatorPath) !== fileMode(baseRef, generatorPath) ||
            execFileSync('git', ['show', `${baseRef}:${generatorPath}`], { encoding: 'utf8' }) !==
              execFileSync('git', ['show', `${headRef}:${generatorPath}`], { encoding: 'utf8' })) {
          throw new Error('DEAL_RUNTIME_GENERATOR_NOT_TRUSTED');
        }
        // No checkout, import or execution of candidate code. The child imports
        // only the accepted generator; candidate application blobs are text data.
        execFileSync(process.execPath, ['--input-type=module', '-'], {
          env: { ...process.env, DEAL_INVENTORY_BASE: baseRef, DEAL_INVENTORY_HEAD: headRef },
          timeout: 120_000,
          maxBuffer: 4 * 1024 * 1024,
          input: String.raw`
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
const base = process.env.DEAL_INVENTORY_BASE;
const head = process.env.DEAL_INVENTORY_HEAD;
const generatorPath = 'scripts/security/discover-cryptography.mjs';
const jsonPath = 'docs/security/cryptographic-inventory.json';
const mdPath = 'docs/security/CRYPTOGRAPHIC_INVENTORY.md';
const git = (args, options = {}) => execFileSync('git', args, {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options,
});
const read = (ref, file) => git(['show', ref + ':' + file]);
const markdown = read(head, mdPath);
const attribution = /^Source SHA: \x60([0-9a-f]{40})\x60$/mu.exec(markdown);
if (!attribution) throw new Error('DEAL_RUNTIME_GENERATED_SOURCE_IDENTITY');
const source = attribution[1];
try { git(['merge-base', '--is-ancestor', source, head]); }
catch { throw new Error('DEAL_RUNTIME_GENERATED_SOURCE_NOT_ANCESTOR'); }
const generator = read(base, generatorPath);
if (read(head, generatorPath) !== generator || read(source, generatorPath) !== generator) {
  throw new Error('DEAL_RUNTIME_GENERATOR_NOT_TRUSTED');
}
function sourceTree(ref) {
  const entries = git(['ls-tree', '-r', '-z', ref, '--', 'apps', 'packages']).split('\0').filter(Boolean);
  const selected = [];
  for (const entry of entries) {
    const parsed = /^(\d{6}) (blob|commit) ([0-9a-f]{40})\t([\s\S]+)$/u.exec(entry);
    if (!parsed) throw new Error('DEAL_RUNTIME_GENERATED_TREE_METADATA');
    const [, mode, kind, oid, file] = parsed;
    if (!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(file) || file.startsWith('apps/landing/') ||
        /(?:\.(?:spec|test)\.[cm]?[jt]sx?$)|(?:(?:^|\/)(?:tests?|__tests__)\/)/u.test(file)) continue;
    let contentOid = oid;
    if (mode === '120000' && file === 'apps/web/apps/web/middleware.ts') {
      // One pre-existing compatibility alias is followed by the canonical
      // scanner. Resolve this exact immutable link through Git, never the host
      // filesystem, and include its target blob in source-attribution equality.
      const baselineLink = git(['ls-tree', base, '--', file]);
      const target = 'apps/web/middleware.ts';
      const targetEntry = /^(100644|100755) blob ([0-9a-f]{40})\t/u.exec(git(['ls-tree', ref, '--', target]));
      if (baselineLink !== git(['ls-tree', ref, '--', file]) ||
          read(ref, file) !== '../../middleware.ts' || !targetEntry) {
        throw new Error('DEAL_RUNTIME_GENERATED_ALIAS_MISMATCH');
      }
      contentOid = targetEntry[2];
    } else if (kind !== 'blob' || !['100644', '100755'].includes(mode)) {
      throw new Error('DEAL_RUNTIME_GENERATED_NONREGULAR_SOURCE');
    }
    if (/[\r\n\t]/u.test(file)) throw new Error('DEAL_RUNTIME_GENERATED_TREE_METADATA');
    selected.push([file, mode, oid, contentOid]);
  }
  return selected.sort((a, b) => Buffer.compare(Buffer.from(a[0]), Buffer.from(b[0])));
}
const entries = sourceTree(head);
if (!entries.length || !isDeepStrictEqual(sourceTree(source), entries)) {
  throw new Error('DEAL_RUNTIME_GENERATED_SOURCE_TREE_MISMATCH');
}
const blobs = git(['cat-file', '--batch'], {
  input: entries.map((entry) => entry[3]).join('\n') + '\n', encoding: null,
});
let offset = 0;
const contents = new Map();
const decoder = new TextDecoder('utf-8', { fatal: true });
for (const [file, , , oid] of entries) {
  const end = blobs.indexOf(10, offset);
  const header = end >= 0 ? /^([0-9a-f]{40}) blob (\d+)$/u.exec(blobs.subarray(offset, end).toString('ascii')) : null;
  const size = header ? Number(header[2]) : -1;
  if (!header || header[1] !== oid || !Number.isSafeInteger(size) || size < 0 || size > 16 * 1024 * 1024 ||
      end + 1 + size >= blobs.length || blobs[end + 1 + size] !== 10) {
    throw new Error('DEAL_RUNTIME_GENERATED_BLOB_METADATA');
  }
  offset = end + 1;
  contents.set(file, decoder.decode(blobs.subarray(offset, offset + size)));
  offset += size + 1;
}
if (offset !== blobs.length) throw new Error('DEAL_RUNTIME_GENERATED_BLOB_TRAILING_DATA');
const trusted = await import('data:text/javascript;base64,' + Buffer.from(generator).toString('base64'));
const inventory = trusted.buildInventory({ files: entries.map(([file]) => file), readFile: (file) => contents.get(file) });
if (read(head, jsonPath) !== JSON.stringify(inventory, null, 2) + '\n' ||
    markdown !== trusted.renderMarkdown(inventory, { sourceSha: source })) {
  throw new Error('DEAL_RUNTIME_GENERATED_OUTPUT_MISMATCH');
}
`,
        });
        }
        scopes = completionAdmitted ? [...sourcePaths, ...generatedPaths] : sourcePaths;
      }
    } else if (branch === admissionBranch) {
      if (Object.hasOwn(state.approvedConcurrentScopes || {}, implementationBranch) ||
          Object.hasOwn(state.coordinationAdmissions || {}, coordinationKey)) {
        throw new Error('DEAL_RUNTIME_ADMISSION_ALREADY_PRESENT');
      }
      if (!isDeepStrictEqual(changes, [['M', stateFile]])) throw new Error('DEAL_RUNTIME_ADMISSION_DIFF_SCOPE');
      if ([baseRef, headRef].some((ref) => fileMode(ref, stateFile) !== '100644')) {
        throw new Error('DEAL_RUNTIME_ADMISSION_FILE_MODE');
      }
      const expected = structuredClone(state);
      expected.approvedConcurrentScopes[implementationBranch] = paths;
      expected.coordinationAdmissions[coordinationKey] = makeAdmission(baseSha);
      if (!isDeepStrictEqual(JSON.parse(readState(headRef)), expected)) {
        throw new Error('DEAL_RUNTIME_ADMISSION_STATE_MUTATION');
      }
      scopes = [stateFile];
    } else {
      const admission = state.coordinationAdmissions?.[coordinationKey];
      const admissionBase = admission?.authorityBaseExactMain;
      if (typeof admissionBase !== 'string' || !/^[0-9a-f]{40}$/u.test(admissionBase) ||
          !isDeepStrictEqual(admission, makeAdmission(admissionBase)) ||
          !isDeepStrictEqual(scopes, paths)) {
        throw new Error('DEAL_RUNTIME_ACCEPTED_ADMISSION_MISMATCH');
      }
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', admissionBase, baseRef], { stdio: 'pipe' });
      } catch {
        throw new Error('DEAL_RUNTIME_ADMISSION_BASE_NOT_ANCESTOR');
      }
      if (readState(headRef) !== readState(baseRef)) throw new Error('DEAL_RUNTIME_IMPLEMENTATION_STATE_MUTATION');
      // This accepted-base rule grants no additional source path. Only the exact
      // generated inventory pair may follow an admitted runtime change, and only
      // after verification from committed blobs with the trusted-base generator.
      const generatedPaths = ['docs/security/cryptographic-inventory.json', 'docs/security/CRYPTOGRAPHIC_INVENTORY.md'];
      const generatedChanges = changes.filter(([, file]) => generatedPaths.includes(file));
      const implementationPaths = [...paths, ...generatedPaths];
      for (const [status, file] of changes) {
        if (!implementationPaths.includes(file) || !['A', 'M'].includes(status) || (status === 'A' && file !== paths[1])) {
          throw new Error('DEAL_RUNTIME_IMPLEMENTATION_DIFF_SCOPE');
        }
        const before = fileMode(baseRef, file);
        if (fileMode(headRef, file) !== '100644' || (status === 'M' ? before !== '100644' : before !== '')) {
          throw new Error('DEAL_RUNTIME_IMPLEMENTATION_FILE_MODE');
        }
      }
      if (generatedChanges.length) {
        if (generatedChanges.length !== generatedPaths.length ||
            !generatedPaths.every((file) => generatedChanges.some(([status, changed]) => status === 'M' && changed === file)) ||
            !changes.some(([status, file]) => status === 'M' && file === paths[0])) {
          throw new Error('DEAL_RUNTIME_GENERATED_PAIR_REQUIRES_RUNTIME');
        }
        const generatorPath = 'scripts/security/discover-cryptography.mjs';
        if (!['100644', '100755'].includes(fileMode(baseRef, generatorPath)) ||
            fileMode(headRef, generatorPath) !== fileMode(baseRef, generatorPath) ||
            execFileSync('git', ['show', `${baseRef}:${generatorPath}`], { encoding: 'utf8' }) !==
              execFileSync('git', ['show', `${headRef}:${generatorPath}`], { encoding: 'utf8' })) {
          throw new Error('DEAL_RUNTIME_GENERATOR_NOT_TRUSTED');
        }
        // No checkout, import or execution of candidate code. The child imports
        // only the accepted generator; candidate application blobs are text data.
        execFileSync(process.execPath, ['--input-type=module', '-'], {
          env: { ...process.env, DEAL_INVENTORY_BASE: baseRef, DEAL_INVENTORY_HEAD: headRef },
          timeout: 120_000,
          maxBuffer: 4 * 1024 * 1024,
          input: String.raw`
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
const base = process.env.DEAL_INVENTORY_BASE;
const head = process.env.DEAL_INVENTORY_HEAD;
const generatorPath = 'scripts/security/discover-cryptography.mjs';
const jsonPath = 'docs/security/cryptographic-inventory.json';
const mdPath = 'docs/security/CRYPTOGRAPHIC_INVENTORY.md';
const git = (args, options = {}) => execFileSync('git', args, {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options,
});
const read = (ref, file) => git(['show', ref + ':' + file]);
const markdown = read(head, mdPath);
const attribution = /^Source SHA: \x60([0-9a-f]{40})\x60$/mu.exec(markdown);
if (!attribution) throw new Error('DEAL_RUNTIME_GENERATED_SOURCE_IDENTITY');
const source = attribution[1];
try { git(['merge-base', '--is-ancestor', source, head]); }
catch { throw new Error('DEAL_RUNTIME_GENERATED_SOURCE_NOT_ANCESTOR'); }
const generator = read(base, generatorPath);
if (read(head, generatorPath) !== generator || read(source, generatorPath) !== generator) {
  throw new Error('DEAL_RUNTIME_GENERATOR_NOT_TRUSTED');
}
function sourceTree(ref) {
  const entries = git(['ls-tree', '-r', '-z', ref, '--', 'apps', 'packages']).split('\0').filter(Boolean);
  const selected = [];
  for (const entry of entries) {
    const parsed = /^(\d{6}) (blob|commit) ([0-9a-f]{40})\t([\s\S]+)$/u.exec(entry);
    if (!parsed) throw new Error('DEAL_RUNTIME_GENERATED_TREE_METADATA');
    const [, mode, kind, oid, file] = parsed;
    if (!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(file) || file.startsWith('apps/landing/') ||
        /(?:\.(?:spec|test)\.[cm]?[jt]sx?$)|(?:(?:^|\/)(?:tests?|__tests__)\/)/u.test(file)) continue;
    let contentOid = oid;
    if (mode === '120000' && file === 'apps/web/apps/web/middleware.ts') {
      // One pre-existing compatibility alias is followed by the canonical
      // scanner. Resolve this exact immutable link through Git, never the host
      // filesystem, and include its target blob in source-attribution equality.
      const baselineLink = git(['ls-tree', base, '--', file]);
      const target = 'apps/web/middleware.ts';
      const targetEntry = /^(100644|100755) blob ([0-9a-f]{40})\t/u.exec(git(['ls-tree', ref, '--', target]));
      if (baselineLink !== git(['ls-tree', ref, '--', file]) ||
          read(ref, file) !== '../../middleware.ts' || !targetEntry) {
        throw new Error('DEAL_RUNTIME_GENERATED_ALIAS_MISMATCH');
      }
      contentOid = targetEntry[2];
    } else if (kind !== 'blob' || !['100644', '100755'].includes(mode)) {
      throw new Error('DEAL_RUNTIME_GENERATED_NONREGULAR_SOURCE');
    }
    if (/[\r\n\t]/u.test(file)) throw new Error('DEAL_RUNTIME_GENERATED_TREE_METADATA');
    selected.push([file, mode, oid, contentOid]);
  }
  return selected.sort((a, b) => Buffer.compare(Buffer.from(a[0]), Buffer.from(b[0])));
}
const entries = sourceTree(head);
if (!entries.length || !isDeepStrictEqual(sourceTree(source), entries)) {
  throw new Error('DEAL_RUNTIME_GENERATED_SOURCE_TREE_MISMATCH');
}
const blobs = git(['cat-file', '--batch'], {
  input: entries.map((entry) => entry[3]).join('\n') + '\n', encoding: null,
});
let offset = 0;
const contents = new Map();
const decoder = new TextDecoder('utf-8', { fatal: true });
for (const [file, , , oid] of entries) {
  const end = blobs.indexOf(10, offset);
  const header = end >= 0 ? /^([0-9a-f]{40}) blob (\d+)$/u.exec(blobs.subarray(offset, end).toString('ascii')) : null;
  const size = header ? Number(header[2]) : -1;
  if (!header || header[1] !== oid || !Number.isSafeInteger(size) || size < 0 || size > 16 * 1024 * 1024 ||
      end + 1 + size >= blobs.length || blobs[end + 1 + size] !== 10) {
    throw new Error('DEAL_RUNTIME_GENERATED_BLOB_METADATA');
  }
  offset = end + 1;
  contents.set(file, decoder.decode(blobs.subarray(offset, offset + size)));
  offset += size + 1;
}
if (offset !== blobs.length) throw new Error('DEAL_RUNTIME_GENERATED_BLOB_TRAILING_DATA');
const trusted = await import('data:text/javascript;base64,' + Buffer.from(generator).toString('base64'));
const inventory = trusted.buildInventory({ files: entries.map(([file]) => file), readFile: (file) => contents.get(file) });
if (read(head, jsonPath) !== JSON.stringify(inventory, null, 2) + '\n' ||
    markdown !== trusted.renderMarkdown(inventory, { sourceSha: source })) {
  throw new Error('DEAL_RUNTIME_GENERATED_OUTPUT_MISMATCH');
}
`,
        });
        scopes = implementationPaths;
      }
      // These two paths are evidence wiring, not general workflow authority.
      // Derive the only permitted delta from the trusted base, never the candidate.
      const readFileAt = (ref, file) => execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8' });
      const ciFile = paths[3];
      const registryFile = paths[4];
      const command = 'pnpm --filter @pc/web exec vitest run ';
      const testArguments = 'tests/unit/transactionDealWorkspaceRecovery.test.tsx tests/unit/transactionUxV8Migration.test.ts ';
      const baseCi = readFileAt(baseRef, ciFile);
      const alreadyWired = baseCi.includes(command + testArguments);
      if (baseCi.split(command).length !== 2 ||
          (!alreadyWired && (baseCi.includes('tests/unit/transactionDealWorkspaceRecovery.test.tsx') ||
            baseCi.includes('tests/unit/transactionUxV8Migration.test.ts')))) {
        throw new Error('DEAL_RUNTIME_CI_BASE_MISMATCH');
      }
      const expectedCi = alreadyWired ? baseCi : baseCi.replace(command, command + testArguments);
      if (readFileAt(headRef, ciFile) !== expectedCi || fileMode(headRef, paths[1]) !== '100644') {
        throw new Error('DEAL_RUNTIME_CI_WIRING_MISMATCH');
      }
      const baseRegistry = JSON.parse(readFileAt(baseRef, registryFile));
      if (!Array.isArray(baseRegistry.exclusions)) throw new Error('DEAL_RUNTIME_CI_REGISTRY_BASE_MISMATCH');
      const removed = baseRegistry.exclusions.filter((entry) => entry.file === paths[2]);
      if (removed.length > 1 || (!alreadyWired && removed.length !== 1)) {
        throw new Error('DEAL_RUNTIME_CI_REGISTRY_BASE_MISMATCH');
      }
      const expectedRegistry = structuredClone(baseRegistry);
      expectedRegistry.exclusions = expectedRegistry.exclusions.filter((entry) => entry.file !== paths[2]);
      if (readFileAt(headRef, registryFile) !== `${JSON.stringify(expectedRegistry, null, 2)}\n`) {
        throw new Error('DEAL_RUNTIME_CI_REGISTRY_MUTATION');
      }
    }
  }

  if (branch === 'governance/pc-crop-inventory-reservation-scope-4997') {
    // The already-admitted writer lane may extend the buyer slice only by this
    // reviewed route composition and rendered acceptance trio. Preserve every
    // unrelated state byte and bind the new coordination record to trusted main.
    const { isDeepStrictEqual } = require('node:util');
    const headRef = String(process.env.HEAD_REF || 'HEAD');
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const candidate = JSON.parse(execFileSync('git', ['show', `${headRef}:${statePath}`], { encoding: 'utf8' }));
    const key = 'ux-buyer-first-customer-route-20260927-coordination';
    const implementationBranch = 'ux/buyer-first-customer-home-20260925';
    const originalKey = 'ux-buyer-first-customer-home-20260925-coordination';
    const buyerScopeChanged = !isDeepStrictEqual(
      candidate.approvedConcurrentScopes?.[implementationBranch],
      state.approvedConcurrentScopes?.[implementationBranch],
    ) || !isDeepStrictEqual(
      candidate.coordinationAdmissions?.[originalKey]?.allowedPaths,
      state.coordinationAdmissions?.[originalKey]?.allowedPaths,
    );
    const trustedAdmissions = state.coordinationAdmissions || {};
    const candidateAdmissions = candidate.coordinationAdmissions || {};
    const routeRecordAlreadyAdmitted = Object.hasOwn(trustedAdmissions, key);
    if (routeRecordAlreadyAdmitted &&
        (!Object.hasOwn(candidateAdmissions, key) ||
         !isDeepStrictEqual(candidateAdmissions[key], trustedAdmissions[key]))) {
      throw new Error('BUYER_ROUTE_ADMISSION_STATE_MUTATION');
    }
    const routeRecordAdded = !routeRecordAlreadyAdmitted && Object.hasOwn(candidateAdmissions, key);
    if (buyerScopeChanged || routeRecordAdded) {
      const originalPaths = [
        'apps/web/components/platform-v7/FirstCustomerWorkspace.tsx',
        'apps/web/components/platform-v7/FirstCustomerWorkspace.module.css',
        'apps/web/tests/unit/designSystemV8MoneyRoles.test.ts',
        'apps/web/tests/unit/platformV7BuyerFirstCustomerUx.test.tsx',
        'docs/platform-v7/autopilot/scopes/buyer-first-customer-home-20260925.json',
      ];
      const additions = [
        'apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx',
        'apps/web/tests/unit/platformV7RoleIntentDashboard.test.ts',
        'apps/web/tests/e2e/platform-v7-canonical-visual-evidence.spec.ts',
      ];
      if (!isDeepStrictEqual(state.approvedConcurrentScopes?.[implementationBranch], originalPaths) ||
          !isDeepStrictEqual(state.coordinationAdmissions?.[originalKey]?.allowedPaths, originalPaths)) {
        throw new Error('BUYER_ROUTE_TRUSTED_BASE_SCOPE_MISMATCH');
      }
      const paths = [...originalPaths.slice(0, -1), ...additions, originalPaths.at(-1)];
      const expected = structuredClone(state);
      expected.approvedConcurrentScopes[implementationBranch] = paths;
      expected.coordinationAdmissions[originalKey].allowedPaths = paths;
      expected.coordinationAdmissions[key] = {
        owner: 'ACCOUNT_2_PRODUCT',
        purpose: 'Render the admitted server-scoped buyer home at the verified buyer root and prove the actual route across RU/EN/ZH and desktop/mobile browsers.',
        authorityBaseExactMain: execFileSync('git', ['rev-parse', baseRef], { encoding: 'utf8' }).trim(),
        implementationBranch,
        allowedPaths: additions,
        requiredTruthBoundaries: [
          'Only the server-verified buyer root renders its server page; other role roots and the controlled owner preview remain separate.',
          'A real authenticated buyer route is checked in RU/EN/ZH on desktop and mobile; component source tests alone do not prove rendering.',
          'Buyer queue order stays navigation, with UNKNOWN required action and no bank or regulatory finality.',
        ],
        forbiddenAuthority: [
          'API/backend/domain/DB/RLS/tenant/role/session or priority authority',
          'other role root or public route behavior',
          'CI/security/readiness gate weakening',
        ],
        teamHubDependency: '#5610 exact-head P1 route composition review; Team Hub #5469',
      };
      if (!isDeepStrictEqual(candidate, expected)) throw new Error('BUYER_ROUTE_ADMISSION_STATE_MUTATION');
    }
  }

  if (branch === 'governance/product-buyer-home-admission-20260925') {
    const { isDeepStrictEqual } = require('node:util');
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const headRef = String(process.env.HEAD_REF || 'HEAD');
    const implementationBranch = 'ux/buyer-first-customer-home-20260925';
    const coordinationKey = 'ux-buyer-first-customer-home-20260925-coordination';
    const paths = [
      'apps/web/components/platform-v7/FirstCustomerWorkspace.tsx',
      'apps/web/components/platform-v7/FirstCustomerWorkspace.module.css',
      'apps/web/tests/unit/designSystemV8MoneyRoles.test.ts',
      'apps/web/tests/unit/platformV7BuyerFirstCustomerUx.test.tsx',
      'docs/platform-v7/autopilot/scopes/buyer-first-customer-home-20260925.json',
    ];
    if (Object.hasOwn(state.approvedConcurrentScopes || {}, implementationBranch) ||
        Object.hasOwn(state.coordinationAdmissions || {}, coordinationKey)) {
      throw new Error('PRODUCT_BUYER_ADMISSION_ALREADY_PRESENT');
    }
    const candidate = JSON.parse(execFileSync('git', ['show', `${headRef}:${statePath}`], { encoding: 'utf8' }));
    const expected = structuredClone(state);
    if (!expected.coordinationAdmissions) expected.coordinationAdmissions = {};
    const baseSha = execFileSync('git', ['rev-parse', baseRef], { encoding: 'utf8' }).trim();
    expected.approvedConcurrentScopes[implementationBranch] = paths;
    expected.coordinationAdmissions[coordinationKey] = {
      owner: 'ACCOUNT_2_PRODUCT',
      purpose: 'Buyer first-customer production-home information architecture and visual hierarchy from existing scoped server facts; one vertical after seller, not full 13-role acceptance.',
      authorityBaseExactMain: baseSha,
      implementationBranch,
      allowedPaths: paths,
      requiredTruthBoundaries: [
        'Buyer shows only server-scoped organization, identity and Deal queue facts; list recency never becomes required next action, amount or deadline.',
        'UNKNOWN next action, empty, forbidden and degraded remain explicit; no demo/static deal or fake bank/provider/FGIS status.',
        'RU/EN/ZH, mobile, focus and seller plus other six role regressions stay covered; owner-controlled showroom does not gain customer authority.',
        'Buyer source changes start only after the accepted immutable guard prerequisite and this state-only admission are merged.',
      ],
      forbiddenAuthority: [
        'homepage/public implementation or parallel App Shell/design system',
        'API/backend/domain/DB/RLS/tenant/role/priority or money/provider/FGIS finality',
        'CI/security/readiness gate weakening',
      ],
      teamHubDependency: '#5372 inventory comment 5833248230; #5604 guard prerequisite; PUBLIC #5559 main serialization; #5535 CORE next-action dependency',
    };
    if (!isDeepStrictEqual(candidate, expected)) throw new Error('PRODUCT_BUYER_ADMISSION_STATE_MUTATION');
    const diff = execFileSync('git', ['diff', '--no-renames', '--name-status', `${baseRef}...${headRef}`], { encoding: 'utf8' }).trim();
    if (diff !== `M\t${statePath}`) throw new Error('PRODUCT_BUYER_ADMISSION_DIFF_SCOPE');
    scopes = [statePath];
  }

  if (branch === 'governance/product-bank-home-admission-20260926') {
    const { isDeepStrictEqual } = require('node:util');
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const headRef = String(process.env.HEAD_REF || 'HEAD');
    const implementationBranch = 'bank/first-customer-home-20260926';
    const coordinationKey = 'bank-first-customer-home-20260926-coordination';
    const paths = [
      'apps/web/components/platform-v7/FirstCustomerWorkspace.tsx',
      'apps/web/components/platform-v7/FirstCustomerWorkspace.module.css',
      'apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx',
      'apps/web/tests/unit/designSystemV8MoneyRoles.test.ts',
      'apps/web/tests/unit/platformV7RoleIntentDashboard.test.ts',
      'apps/web/tests/e2e/platform-v7-canonical-visual-evidence.spec.ts',
      'docs/platform-v7/autopilot/scopes/bank-first-customer-home-20260926.json',
    ];
    if (Object.hasOwn(state.approvedConcurrentScopes || {}, implementationBranch) ||
        Object.hasOwn(state.coordinationAdmissions || {}, coordinationKey)) {
      throw new Error('PRODUCT_BANK_HOME_ADMISSION_ALREADY_PRESENT');
    }
    const candidate = JSON.parse(execFileSync('git', ['show', `${headRef}:${statePath}`], { encoding: 'utf8' }));
    const expected = structuredClone(state);
    if (!expected.coordinationAdmissions) expected.coordinationAdmissions = {};
    const baseSha = execFileSync('git', ['rev-parse', baseRef], { encoding: 'utf8' }).trim();
    expected.approvedConcurrentScopes[implementationBranch] = paths;
    expected.coordinationAdmissions[coordinationKey] = {
      owner: 'ACCOUNT_2_PRODUCT',
      purpose: 'Bank first-customer production-home hierarchy from existing server-scoped Deal navigation; no bank operation, provider or settlement authority.',
      authorityBaseExactMain: baseSha,
      implementationBranch,
      allowedPaths: paths,
      requiredTruthBoundaries: [
        'The bank Deal queue is navigation, not a BankOperation read, provider binding, release decision, payment instruction or external bank confirmation.',
        'UNKNOWN next action, empty, forbidden and degraded remain explicit; no demo amounts, concrete provider or settlement finality.',
        'RU/EN/ZH, mobile, focus, buyer/seller and other role regressions remain covered; owner-controlled showroom does not gain customer authority.',
        'Ordinary verified bank root mounts the server-scoped bank workspace; owner-controlled preview keeps precedence and other roles do not inherit bank access.',
        'Bank source changes start only after the trusted immutable guard prerequisite and this state-only admission are merged.',
      ],
      forbiddenAuthority: [
        'API/backend/domain/DB/RLS/tenant/role/BankOperation/IntegrationBinding/provider/payment authority',
        'homepage/public implementation or parallel App Shell/design system',
        'CI/security/readiness gate weakening or production PASS claim',
      ],
      teamHubDependency: '#5469 comment 5842845723; CORE #5525; external #5530; buyer #5610 review; P0 release serialization',
    };
    if (!isDeepStrictEqual(candidate, expected)) throw new Error('PRODUCT_BANK_HOME_ADMISSION_STATE_MUTATION');
    const diff = execFileSync('git', ['diff', '--no-renames', '--name-status', `${baseRef}...${headRef}`], { encoding: 'utf8' }).trim();
    if (diff !== `M\t${statePath}`) throw new Error('PRODUCT_BANK_HOME_ADMISSION_DIFF_SCOPE');
    scopes = [statePath];
  }

  const bankMoneyPurposeKey = 'bank-release-currency-amount-guard-purpose-20261001';
  const bankMoneyAdmissionKey = 'bank-release-currency-amount-20261001';
  const bankMoneySourceBranch = 'bank/deep-visible-copy-guard-20260924';
  const bankMoneyAdmissionBranch = 'governance/product-bank-fgis-ux-source-admission-20260924';
  const bankMoneyPhase = [bankMoneySourceBranch, bankMoneyAdmissionBranch].includes(branch) &&
    Object.hasOwn(state.coordinationAdmissions || {}, bankMoneyPurposeKey);
  if (bankMoneyPhase) {
    const { isDeepStrictEqual } = require('node:util');
    const requiredPurpose = {
  "owner": "ACCOUNT_1_EXECUTION",
  "presentationContributor": "ACCOUNT_2_PRODUCT",
  "sourceOwnerRetained": "ACCOUNT_2_PRODUCT",
  "purpose": "Renew the accepted three-path trusted guard lane for a separately admitted immutable four-file BANK read-only currency and selected-operation amount consistency repair.",
  "authorityBaseExactMain": "a569b4775c484530f670c07dc0c668ac2615a287",
  "implementationBranch": "governance/pc-crop-post-registration-progress-scope-4997",
  "allowedPaths": [
    "scripts/p7-autopilot-guard.sh",
    "scripts/p7-autopilot-guard.test.mjs",
    ".github/workflows/platform-v7-autopilot-guard.yml"
  ],
  "futureAdmissionBranch": "governance/product-bank-fgis-ux-source-admission-20260924",
  "futureImplementationBranch": "bank/deep-visible-copy-guard-20260924",
  "retainedAdmissionKey": "bank-deep-visible-copy-guard-20260924-coordination",
  "retainedSourceScope": [
    "apps/web/app/platform-v7/bank/escrow/page.tsx",
    "apps/web/app/platform-v7/bank/factoring/page.tsx",
    "apps/web/app/platform-v7/bank/release-safety/page.tsx",
    "apps/web/app/platform-v7/profile/page.tsx",
    "apps/web/tests/unit/bankReleaseSafetyRoute.test.tsx",
    "apps/web/tests/unit/platformV7DeepBankDealCopyGuard.test.ts",
    "docs/platform-v7/autopilot/scopes/bank-deep-visible-copy-guard-20260924.json"
  ],
  "futureAdditionalSourcePaths": [
    "apps/web/lib/bank-release-server.ts",
    "apps/web/tests/unit/bankReleaseServer.test.ts"
  ],
  "immutableSourcePins": [
    [
      "apps/web/lib/bank-release-server.ts",
      "870a839e7087ef1114d805d818220471027c89fb",
      "6ae431216dce41f07d6c73a8b3fe4231bd4c540d"
    ],
    [
      "apps/web/tests/unit/bankReleaseServer.test.ts",
      "698b609d3d3ee2a60bcbe491e7b8137807b261e6",
      "fe1c8bc089be2b409ad65837a4ba3985edbfb619"
    ],
    [
      "apps/web/app/platform-v7/bank/release-safety/page.tsx",
      "55f1572c14283fb2b69153adba6cbe13622fd387",
      "b67a3452e05ad97082ccfbcc0c4975302cb62df9"
    ],
    [
      "apps/web/tests/unit/bankReleaseSafetyRoute.test.tsx",
      "68382969c3b8f1bb8912a1c514fd71882470cf95",
      "630599ff7ff0ca4338445fc8bba50d61cf07f4f6"
    ]
  ],
  "requiredSourceMode": "100644",
  "scopeManifest": {
    "path": "docs/platform-v7/autopilot/scopes/bank-deep-visible-copy-guard-20260924.json",
    "baselineBlob": "c7a015a9449578df7fbd325aae81f2d3795a4523",
    "mode": "100644",
    "permittedTransformation": "Preserve all other bytes and metadata; append the two admitted paths after the original seven allowedPaths and bind authorityBaseExactMain to the genuine accepted co-admission guard base."
  },
  "reviewedPrivatePayload": {
    "comment": 5917883797,
    "bytes": 22121,
    "sha256": "3d3bd96794171e61e1531c8ef3b13c1157ff389c7d979adf8d600944c819432b",
    "privateCurrentTests": {
      "candidatePass": 81,
      "baselinePass": 61,
      "baselineFail": 20,
      "nativePostgresqlOrProviderPass": false
    }
  },
  "requiredTruthBoundaries": [
    "Purpose only: append this one record with exact old-state byte preservation. No primary/global/R1.2 scope, approvedConcurrentScopes, existing admission, source, workflow, progress or ownership change.",
    "After separate acceptance, use only the already admitted three-path trusted guard lane for a distinct exact state-only co-admission and immutable source phase. Retain every prior guard phase, review/security/readiness defense and existing Deal locale admissions and generated-inventory phase.",
    "The later state-only phase preserves all seven BANK paths and every original admission byte/value, appends only bank-release-server.ts and bankReleaseServer.test.ts after that prefix, adds one literal ACCOUNT_2_PRODUCT-owned co-record bound to actual accepted guard main, and rejects arbitrary permission/owner/progress/base changes, duplicate keys or reserialization.",
    "Only after separately accepted state, the original BANK source ref may carry the four exact old/new source blobs plus its one already admitted exact transformed manifest, all regular100644. No scope state, guard, workflow, other source or arbitrary metadata can ride with this immutable phase.",
    "Preserve canonical typed GET-only Deal workspace, exact Deal/tenant/participant identity, server-owned permissions, all existing payout prerequisites/callback/outbox evidence and UNKNOWN external reconciliation. Selected RESERVE and RELEASE must agree with canonical Deal amount and currency; discrepancies require manual review and cannot establish request readiness or RELEASED.",
    "Render the canonical persisted currency in RU/EN/ZH without substituting RUB, hiding selected-operation amount conflicts or mutating financial facts. No release, reserve, callback, provider, integration-binding, settlement, ledger or regulatory authority is granted to this consumer projection.",
    "The complete four-file payload is immutable; currency-only or page-only adoption leaves amount conflicts unprotected. Unit response/render doubles and private review are not native PostgreSQL, authenticated browser, provider, Founder13 or REG.RU acceptance.",
    "Preserve original source authors and ACCOUNT_2_PRODUCT source ownership plus canonical CORE/API authority. Use a bounded Team Hub continuation decision on the original source ref, normal history-preserving updates, fresh full current-head independent nonauthor review, separate owner audit, all native CI/security/readiness and ordinary expected-full-SHA merge."
  ],
  "forbiddenAuthority": [
    "API/DB/RLS/role/tenant/auth/session/command/money/provider/FGIS/legal/model authority",
    "Arbitrary source, scope or generated-document permissions",
    "Changes to original admissions, source authors, ownership or official5/100 progress",
    "CI/security/readiness/review weakening, fake evidence, forced/automatic merge or live/provider acceptance inference"
  ],
  "teamHubDependency": "#5469 owner-priority decision5925195179; canonical BANK #5525 complete immutable source5917883797; exact current consumer source/read-only evidence; original BANK scope/claim retained"
};
    const priorTemplate = {
  "owner": "ACCOUNT_2_PRODUCT",
  "purpose": "Presentation-only bank/deal copy guard and negative release safety wording; no provider or payment finality.",
  "authorityBaseExactMain": "5d2fb28c0957b7c03928102b2a4ec353a49b3f79",
  "implementationBranch": "bank/deep-visible-copy-guard-20260924",
  "allowedPaths": [
    "apps/web/app/platform-v7/bank/escrow/page.tsx",
    "apps/web/app/platform-v7/bank/factoring/page.tsx",
    "apps/web/app/platform-v7/bank/release-safety/page.tsx",
    "apps/web/app/platform-v7/profile/page.tsx",
    "apps/web/tests/unit/bankReleaseSafetyRoute.test.tsx",
    "apps/web/tests/unit/platformV7DeepBankDealCopyGuard.test.ts",
    "docs/platform-v7/autopilot/scopes/bank-deep-visible-copy-guard-20260924.json"
  ],
  "requiredTruthBoundaries": [
    "Preserve the forbidden money-finality and demo vocabulary guard, including absence of the removed operator execution queue source.",
    "A recorded release request is not external execution; unresolved outcome requires same-operation reconciliation before retry.",
    "RU/EN/ZH bank copy does not attribute a concrete provider or claim factoring, release or debit finality."
  ],
  "forbiddenAuthority": [
    "API/DB/settlement/ledger/provider/callback or money-finality authority",
    "tenant/role/session authority",
    "CI/security gate weakening"
  ],
  "teamHubDependency": "#5565; Team Hub #5469 scope correction 5818641448"
};
    const originalPaths = [
  "apps/web/app/platform-v7/bank/escrow/page.tsx",
  "apps/web/app/platform-v7/bank/factoring/page.tsx",
  "apps/web/app/platform-v7/bank/release-safety/page.tsx",
  "apps/web/app/platform-v7/profile/page.tsx",
  "apps/web/tests/unit/bankReleaseSafetyRoute.test.tsx",
  "apps/web/tests/unit/platformV7DeepBankDealCopyGuard.test.ts",
  "docs/platform-v7/autopilot/scopes/bank-deep-visible-copy-guard-20260924.json"
];
    const additionalPaths = ['apps/web/lib/bank-release-server.ts', 'apps/web/tests/unit/bankReleaseServer.test.ts'];
    const completedPaths = [...originalPaths, ...additionalPaths];
    const pins = [
  [
    "apps/web/lib/bank-release-server.ts",
    "870a839e7087ef1114d805d818220471027c89fb",
    "6ae431216dce41f07d6c73a8b3fe4231bd4c540d"
  ],
  [
    "apps/web/tests/unit/bankReleaseServer.test.ts",
    "698b609d3d3ee2a60bcbe491e7b8137807b261e6",
    "fe1c8bc089be2b409ad65837a4ba3985edbfb619"
  ],
  [
    "apps/web/app/platform-v7/bank/release-safety/page.tsx",
    "55f1572c14283fb2b69153adba6cbe13622fd387",
    "b67a3452e05ad97082ccfbcc0c4975302cb62df9"
  ],
  [
    "apps/web/tests/unit/bankReleaseSafetyRoute.test.tsx",
    "68382969c3b8f1bb8912a1c514fd71882470cf95",
    "630599ff7ff0ca4338445fc8bba50d61cf07f4f6"
  ]
];
    const manifestPath = 'docs/platform-v7/autopilot/scopes/bank-deep-visible-copy-guard-20260924.json';
    const manifestBlob = 'c7a015a9449578df7fbd325aae81f2d3795a4523';
    const priorKey = 'bank-deep-visible-copy-guard-20260924-coordination';
    const headRef = String(process.env.HEAD_REF || 'HEAD');
    const baseSha = execFileSync('git', ['rev-parse', `${baseRef}^{commit}`], { encoding: 'utf8' }).trim();
    const read = (ref, file) => execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    const entry = (ref, file) => execFileSync('git', ['ls-tree', ref, '--', file], { encoding: 'utf8' }).trim();
    const mode = (ref, file) => entry(ref, file).split(' ')[0];
    if (!isDeepStrictEqual(state.coordinationAdmissions[bankMoneyPurposeKey], requiredPurpose) ||
        !isDeepStrictEqual(state.approvedConcurrentScopes?.[requiredPurpose.implementationBranch], requiredPurpose.allowedPaths)) {
      throw new Error('BANK_MONEY_PURPOSE_MISMATCH');
    }
    if (execFileSync('git', ['merge-base', baseRef, headRef], { encoding: 'utf8' }).trim() !== baseSha) {
      throw new Error('BANK_MONEY_BASE_NOT_ANCESTOR');
    }
    const prior = state.coordinationAdmissions?.[priorKey];
    const priorBase = prior?.authorityBaseExactMain;
    if (typeof priorBase !== 'string' || !/^[0-9a-f]{40}$/u.test(priorBase) ||
        !isDeepStrictEqual(prior, { ...priorTemplate, authorityBaseExactMain: priorBase })) {
      throw new Error('BANK_MONEY_PRIOR_ADMISSION_MISMATCH');
    }
    try { execFileSync('git', ['merge-base', '--is-ancestor', priorBase, baseRef], { stdio: 'pipe' }); }
    catch { throw new Error('BANK_MONEY_PRIOR_BASE_NOT_ANCESTOR'); }
    const fields = execFileSync('git', ['diff', '--no-renames', '--name-status', '-z', `${baseRef}...${headRef}`], { encoding: 'utf8' }).split('\0');
    if (fields.pop() !== '' || fields.length % 2 !== 0) throw new Error('BANK_MONEY_DIFF_METADATA_INVALID');
    const changes = [];
    for (let i = 0; i < fields.length; i += 2) changes.push([fields[i], fields[i + 1]]);
    const makeBankMoneyAdmission = (authorityBaseExactMain) => ({
      owner: 'ACCOUNT_2_PRODUCT', sourceOwnerRetained: 'ACCOUNT_2_PRODUCT', canonicalApiOwnerRetained: 'ACCOUNT_1_EXECUTION',
      purpose: 'Apply only the immutable four-file read-only BANK currency and selected-operation amount consistency payload plus its exact existing scope-manifest update.',
      authorityBaseExactMain, implementationBranch: bankMoneySourceBranch,
      allowedPaths: completedPaths, retainedAdmissionKey: priorKey, exactSourcePins: pins,
      exactManifestPath: manifestPath, baselineManifestBlob: manifestBlob,
      reviewedPrivatePayloadSha256: '3d3bd96794171e61e1531c8ef3b13c1157ff389c7d979adf8d600944c819432b',
      requiredTruthBoundaries: [
        'Preserve the seven-path prefix and every old admission byte/value. Append only two read-only web source/test paths; no server, provider, money mutation or legal authority.',
        'The source phase requires all four immutable100644 source transitions and only the exact accepted-manifest path/base transformation, unchanged state and genuine accepted-base ancestry.',
        'Preserve canonical GET-only Deal/tenant/participant permissions, UNKNOWN external outcome and all callback/outbox prerequisites. Currency/selected RESERVE and RELEASE amount conflicts cannot establish readiness or RELEASED.',
        'Fresh independent full current-head review, separate owner audit, every substantive native CI/security/readiness gate and ordinary expected-full-SHA merge remain mandatory. Private unit doubles are not PostgreSQL/browser/provider/Founder13/REG.RU acceptance.',
      ],
      forbiddenAuthority: ['API/DB/RLS/role/tenant/session/command/money/provider/FGIS/legal/model authority', 'Arbitrary source/scope/metadata changes', 'CI/security/readiness/review weakening or fake acceptance'],
    });
    const admitted = Object.hasOwn(state.coordinationAdmissions || {}, bankMoneyAdmissionKey);
    if (branch === bankMoneyAdmissionBranch) {
      if (admitted) throw new Error('BANK_MONEY_ALREADY_ADMITTED');
      if (!isDeepStrictEqual(state.approvedConcurrentScopes?.[bankMoneySourceBranch], originalPaths)) throw new Error('BANK_MONEY_PRIOR_SCOPE_MISMATCH');
      if ([baseRef, headRef].some((ref) => mode(ref, stateFile) !== '100644')) throw new Error('BANK_MONEY_ADMISSION_MODE');
      if (!isDeepStrictEqual(changes, [['M', stateFile]])) throw new Error('BANK_MONEY_ADMISSION_DIFF_SCOPE');
      const expected = structuredClone(state);
      expected.approvedConcurrentScopes[bankMoneySourceBranch] = completedPaths;
      expected.coordinationAdmissions[bankMoneyAdmissionKey] = makeBankMoneyAdmission(baseSha);
      const candidateText = read(headRef, stateFile);
      if (!isDeepStrictEqual(JSON.parse(candidateText), expected)) throw new Error('BANK_MONEY_ADMISSION_STATE_MUTATION');
      const render = (key, value) => JSON.stringify({ [key]: value }, null, 2).slice(2, -2).split('\n').map((line) => '  ' + line).join('\n');
      const baseText = read(baseRef, stateFile), end = '\n  }\n}\n';
      const oldVector = render(bankMoneySourceBranch, originalPaths);
      if (Object.keys(state).at(-1) !== 'coordinationAdmissions' || !baseText.endsWith(end) || baseText.split(oldVector).length !== 2) throw new Error('BANK_MONEY_ADMISSION_TEXT_BASE');
      let exact = baseText.replace(oldVector, render(bankMoneySourceBranch, completedPaths));
      exact = exact.slice(0, -end.length) + ',\n' + render(bankMoneyAdmissionKey, makeBankMoneyAdmission(baseSha)) + end;
      if (!isDeepStrictEqual(JSON.parse(exact), expected)) throw new Error('BANK_MONEY_ADMISSION_TEXT_BASE');
      if (candidateText !== exact) throw new Error('BANK_MONEY_ADMISSION_TEXT_MUTATION');
      scopes = [stateFile];
    } else {
      const admission = state.coordinationAdmissions?.[bankMoneyAdmissionKey];
      const authority = admission?.authorityBaseExactMain;
      if (!admitted || typeof authority !== 'string' || !/^[0-9a-f]{40}$/u.test(authority) ||
          !isDeepStrictEqual(admission, makeBankMoneyAdmission(authority)) ||
          !isDeepStrictEqual(state.approvedConcurrentScopes?.[bankMoneySourceBranch], completedPaths)) throw new Error('BANK_MONEY_ACCEPTED_ADMISSION_MISMATCH');
      try { execFileSync('git', ['merge-base', '--is-ancestor', authority, baseRef], { stdio: 'pipe' }); }
      catch { throw new Error('BANK_MONEY_ADMISSION_BASE_NOT_ANCESTOR'); }
      if (read(headRef, stateFile) !== read(baseRef, stateFile)) throw new Error('BANK_MONEY_SOURCE_STATE_MUTATION');
      for (const [file, before, after] of pins) {
        if (entry(baseRef, file) !== `100644 blob ${before}\t${file}` || entry(headRef, file) !== `100644 blob ${after}\t${file}`) throw new Error('BANK_MONEY_SOURCE_PIN_OR_MODE:' + file);
      }
      if (entry(baseRef, manifestPath) !== `100644 blob ${manifestBlob}\t${manifestPath}` || mode(headRef, manifestPath) !== '100644') throw new Error('BANK_MONEY_MANIFEST_PIN_OR_MODE');
      const manifestBase = read(baseRef, manifestPath);
      const manifest = JSON.parse(manifestBase);
      const renderManifestPaths = (paths) => JSON.stringify({ allowedPaths: paths }, null, 2).slice(2, -2);
      const oldManifestVector = renderManifestPaths(originalPaths);
      const authorityEntry = '  "authorityBaseExactMain": ' + JSON.stringify(manifest.authorityBaseExactMain);
      if (manifestBase.split(oldManifestVector).length !== 2 || manifestBase.split(authorityEntry).length !== 2) throw new Error('BANK_MONEY_MANIFEST_TEXT_BASE');
      const exactManifest = manifestBase.replace(oldManifestVector, renderManifestPaths(completedPaths))
        .replace(authorityEntry, '  "authorityBaseExactMain": ' + JSON.stringify(authority));
      if (read(headRef, manifestPath) !== exactManifest) throw new Error('BANK_MONEY_MANIFEST_TEXT_MUTATION');
      const sort = (rows) => [...rows].sort((a, b) => a[1].localeCompare(b[1], 'en'));
      const expectedChanges = [...pins.map(([file]) => ['M', file]), ['M', manifestPath]];
      if (!isDeepStrictEqual(sort(changes), sort(expectedChanges))) throw new Error('BANK_MONEY_SOURCE_DIFF_SCOPE');
      scopes = completedPaths;
    }
  }

  if (branch === 'governance/product-bank-fgis-ux-source-admission-20260924' && !bankMoneyPhase) {
    const { isDeepStrictEqual } = require('node:util');
    const headRef = String(process.env.HEAD_REF || 'HEAD');
    const candidate = JSON.parse(execFileSync('git', ['show', `${headRef}:${stateFile}`], { encoding: 'utf8' }));
    const expected = new Map([
      ['bank/deep-visible-copy-guard-20260924', {
        key: 'bank-deep-visible-copy-guard-20260924-coordination',
        purpose: 'Presentation-only bank/deal copy guard and negative release safety wording; no provider or payment finality.',
        requiredTruthBoundaries: [
          'Preserve the forbidden money-finality and demo vocabulary guard, including absence of the removed operator execution queue source.',
          'A recorded release request is not external execution; unresolved outcome requires same-operation reconciliation before retry.',
          'RU/EN/ZH bank copy does not attribute a concrete provider or claim factoring, release or debit finality.',
        ],
        forbiddenAuthority: [
          'API/DB/settlement/ledger/provider/callback or money-finality authority',
          'tenant/role/session authority',
          'CI/security gate weakening',
        ],
        teamHubDependency: '#5565; Team Hub #5469 scope correction 5818641448',
        paths: [
          'apps/web/app/platform-v7/bank/escrow/page.tsx',
          'apps/web/app/platform-v7/bank/factoring/page.tsx',
          'apps/web/app/platform-v7/bank/release-safety/page.tsx',
          'apps/web/app/platform-v7/profile/page.tsx',
          'apps/web/tests/unit/bankReleaseSafetyRoute.test.tsx',
          'apps/web/tests/unit/platformV7DeepBankDealCopyGuard.test.ts',
          'docs/platform-v7/autopilot/scopes/bank-deep-visible-copy-guard-20260924.json',
        ],
      }],
      ['fgis/zsn-public-document-source-lock-20260924', {
        key: 'fgis-zsn-public-document-source-lock-20260924-coordination',
        purpose: 'Lock public operator-linked EFGIS ZSN document identity and PDF bytes as provenance only.',
        requiredTruthBoundaries: [
          'Pin official public operator-linked PDF identity, 906732-byte payload and SHA-256; title/year are not an API contract version.',
          'Keep historical government-system registry v1 byte-immutable and mutation capability disabled.',
          'Do not claim organization access, credentials, signature, legal acceptance, delegated access, live mutation or E2E.',
        ],
        forbiddenAuthority: [
          'FGIS credentials/API write/signature/legal finality',
          'government registry v1 mutation',
          'CI/security gate weakening',
        ],
        teamHubDependency: '#5532; Team Hub #5469 scope correction 5818641448',
        paths: [
          '.github/workflows/pc-crop-zsn-source-lock.yml',
          'docs/platform-v7/crop-platform/efgis-zsn-api-document.source-lock.json',
          'docs/platform-v7/crop-platform/efgis-zsn-api-document.source-lock.schema.json',
          'scripts/pc-crop-zsn/verify-source-lock.mjs',
          'scripts/pc-crop-zsn/verify-source-lock.test.mjs',
          'docs/platform-v7/autopilot/scopes/fgis-zsn-public-document-source-lock-20260924.json',
        ],
      }],
      ['ux/first-customer-next-action-unknown-20260924', {
        key: 'ux-first-customer-next-action-unknown-20260924-coordination',
        purpose: 'Keep recency-sorted first customer queues as navigation for seven roles while server priority is absent.',
        requiredTruthBoundaries: [
          'Buyer, bank, logistics, driver, elevator, lab and surveyor must display UNKNOWN primary next action until accepted server-derived priority.',
          'RU/EN/ZH and keyboard-visible in-page queue navigation remain available; server-scoped item links are preserved.',
          'Owner-controlled showroom navigation and seller fail-closed behavior stay intact.',
        ],
        forbiddenAuthority: [
          'API/DB/tenant/role/priority authority',
          'bank/FGIS/provider/settlement finality',
          'CI/security gate weakening',
        ],
        teamHubDependency: '#5535; Team Hub #5469 scope correction 5818641448',
        paths: [
          'apps/web/components/platform-v7/FirstCustomerWorkspace.tsx',
          'apps/web/tests/unit/designSystemV8MoneyRoles.test.ts',
          'apps/web/tests/unit/sellerExecutionPolish.test.tsx',
          'docs/platform-v7/autopilot/scopes/first-customer-next-action-unknown-20260924.json',
        ],
      }],
    ]);
    const baseline = structuredClone(state);
    if (!baseline.coordinationAdmissions) baseline.coordinationAdmissions = {};
    const baseSha = execFileSync('git', ['rev-parse', baseRef], { encoding: 'utf8' }).trim();
    const priorAdmissionsAccepted = [...expected].every(([implementationBranch, { key }]) =>
      Object.hasOwn(state.approvedConcurrentScopes, implementationBranch) &&
      Object.hasOwn(state.coordinationAdmissions || {}, key));
    const previousWebkitAccepted =
      Object.hasOwn(state.approvedConcurrentScopes, 'fix/public-webkit-i18n-route-lifecycle-20260927') &&
      Object.hasOwn(state.coordinationAdmissions || {}, 'public-webkit-i18n-route-lifecycle-20260927');
    if (priorAdmissionsAccepted && previousWebkitAccepted) {
      const implementationBranch = 'fix/public-login-register-locale-20260928';
      const key = 'public-login-register-locale-20260928';
      const paths = [
        'apps/web/app/platform-v7/login/LoginFormClient.tsx',
        'apps/web/app/platform-v7/login/page.tsx',
        'apps/web/tests/e2e/platform-v7-production-i18n-acceptance.spec.ts',
      ];
      if (Object.hasOwn(state.approvedConcurrentScopes, implementationBranch) ||
          Object.hasOwn(state.coordinationAdmissions || {}, key)) {
        throw new Error('PRODUCT_LOGIN_LOCALE_ADMISSION_ALREADY_PRESENT');
      }
      const changes = execFileSync('git', ['diff', '--no-renames', '--name-status', `${baseRef}...${headRef}`], { encoding: 'utf8' }).trim();
      if (changes !== `M\t${stateFile}`) throw new Error('PRODUCT_LOGIN_LOCALE_ADMISSION_DIFF_SCOPE');
      const modes = [baseRef, headRef].map((ref) =>
        execFileSync('git', ['ls-tree', ref, '--', stateFile], { encoding: 'utf8' }).split(' ')[0]);
      if (modes.some((mode) => mode !== '100644')) throw new Error('PRODUCT_LOGIN_LOCALE_ADMISSION_FILE_MODE');
      baseline.approvedConcurrentScopes[implementationBranch] = paths;
      baseline.coordinationAdmissions[key] = {
        owner: 'ACCOUNT_2_PRODUCT',
        purpose: 'Preserve RU/EN/ZH on the existing Login to Register link and verify the real mobile click path after the exact-live locale-loss failure.',
        authorityBaseExactMain: baseSha,
        implementationBranch,
        allowedPaths: paths,
        requiredTruthBoundaries: [
          'Only the three exact paths from trusted base state are admitted; candidate state, manifests and guards cannot expand implementation authority.',
          'Pass the existing getLocale/canonicalPublicLocale result from the Login server page to LoginFormClient as a bounded RU/EN/ZH presentation prop; do not add client locale hooks or providers to the lean Login entry, and keep authentication, MFA, session, redirect authority and register-page behavior unchanged.',
          'Preserve all eight public routes, EN/ZH localization, RU homepage design gates, ten viewport-locale combinations, zero pageerror, response success, Chinese typography, mobile target geometry and horizontal reflow assertions.',
          'Assert the exact localized Register href, real user navigation, resulting HTML locale and zero page errors; do not replace the click with direct navigation or weaken locale assertions.',
          'Source and local tests do not establish live acceptance; require exact-head independent review and complete CI, then exact-main release and live mobile/i18n on the deployed OCI revision.',
        ],
        forbiddenAuthority: [
          'Candidate-owned state or scope extension in the implementation PR',
          'Backend/API/DB/role/tenant/authentication/bank/provider/FGIS authority or root-layout, middleware, locale-provider, homepage and register-page changes',
          'CI/security/readiness weakening, fabricated acceptance or automatic merge',
        ],
        teamHubDependency: '#2198 locale-loss evidence 5866099139; Team Hub #5469',
      };
      if (!isDeepStrictEqual(candidate, baseline)) throw new Error('PRODUCT_LOGIN_LOCALE_ADMISSION_STATE_MUTATION');
    } else if (priorAdmissionsAccepted) {
      const implementationBranch = 'fix/public-webkit-i18n-route-lifecycle-20260927';
      const key = 'public-webkit-i18n-route-lifecycle-20260927';
      const paths = ['apps/web/tests/e2e/platform-v7-production-i18n-acceptance.spec.ts'];
      if (Object.hasOwn(state.approvedConcurrentScopes, implementationBranch) ||
          Object.hasOwn(state.coordinationAdmissions || {}, key)) {
        throw new Error('PRODUCT_WEBKIT_ADMISSION_ALREADY_PRESENT');
      }
      baseline.approvedConcurrentScopes[implementationBranch] = paths;
      baseline.coordinationAdmissions[key] = {
        owner: 'ACCOUNT_2_PRODUCT',
        purpose: 'Isolate public production i18n route navigation in a fresh page lifecycle and verify realistic login-to-register navigation after the measured WebKit EN 320 ChunkLoadError.',
        authorityBaseExactMain: baseSha,
        acceptedGuardPr: 5669,
        acceptedGuardMerge: baseSha,
        implementationBranch,
        allowedPaths: paths,
        requiredTruthBoundaries: [
          'The accepted trusted-base immutable guard and both PR entry points permit this implementation ref only the exact browser test path; candidate state cannot expand it.',
          'Preserve all eight public routes, EN/ZH localization, RU homepage design gates, ten viewport-locale combinations, zero pageerror, response success, Chinese typography, mobile target geometry and horizontal reflow assertions.',
          'Use an independent page lifecycle for each direct public route and a separate real user click from login to register at 320 px; do not dismiss an actual click-path product error as test harness noise.',
          'The previous WebKit EN 320 ChunkLoadError is unresolved until Chromium and WebKit exact-deployed-OCI live production i18n acceptance passes; source CI alone does not establish production acceptance.',
          'Do not broaden to BANKS, FGIS, provider credentials, backend/runtime/locale product code, other tests or release workflow in this one-file implementation.',
        ],
        forbiddenAuthority: [
          'Candidate-owned state or scope extension in the implementation PR',
          'Product code/API/DB/tenant/role/bank/provider/FGIS mutation',
          'CI/security/readiness weakening, fabricated acceptance or automatic merge',
        ],
        teamHubDependency: '#5666; accepted guard #5669; Team Hub #5469',
      };
      if (!isDeepStrictEqual(candidate, baseline)) throw new Error('PRODUCT_WEBKIT_ADMISSION_STATE_MUTATION');
    } else for (const [implementationBranch, { key, paths, purpose, requiredTruthBoundaries, forbiddenAuthority, teamHubDependency }] of expected) {
      if (Object.hasOwn(state.approvedConcurrentScopes, implementationBranch) ||
          Object.hasOwn(state.coordinationAdmissions || {}, key)) {
        throw new Error('PRODUCT_SCOPE_ADMISSION_ALREADY_PRESENT');
      }
      if (!isDeepStrictEqual(candidate.approvedConcurrentScopes?.[implementationBranch], paths)) {
        throw new Error(`PRODUCT_SCOPE_ADMISSION_PATH_MISMATCH:${implementationBranch}`);
      }
      const record = candidate.coordinationAdmissions?.[key];
      const exactRecord = {
        owner: 'ACCOUNT_2_PRODUCT', purpose, authorityBaseExactMain: baseSha,
        implementationBranch, allowedPaths: paths, requiredTruthBoundaries,
        forbiddenAuthority, teamHubDependency,
      };
      if (!isDeepStrictEqual(record, exactRecord)) {
        throw new Error(`PRODUCT_SCOPE_ADMISSION_COORDINATION_MISMATCH:${implementationBranch}`);
      }
      baseline.approvedConcurrentScopes[implementationBranch] = paths;
      baseline.coordinationAdmissions[key] = record;
    }
    if (!isDeepStrictEqual(candidate, baseline)) throw new Error('PRODUCT_SCOPE_ADMISSION_STATE_MUTATION');
  }

  if (branch === 'governance/industrial-load-diagnostics-20260919' || branch === 'test/industrial-load-diagnostics-20260919') {
    const { isDeepStrictEqual } = require('node:util');
    const governance = 'governance/industrial-load-diagnostics-20260919';
    const diagnostic = 'test/industrial-load-diagnostics-20260919';
    const governancePaths = [
      'docs/platform-v7/autopilot/autopilot-state.json',
      'docs/platform-v7/execution-queue.md',
      'docs/platform-v7/autopilot/prompts/current-codex-task.md',
      'docs/platform-v7/autopilot/prompts/current-review-task.md',
      'scripts/p7-autopilot-guard.sh',
      'scripts/p7-autopilot-guard.test.mjs',
      '.github/workflows/platform-v7-autopilot-guard.yml',
    ];
    const diagnosticPaths = ['apps/api/test/industrial/load-proof.e2e-spec.ts'];
    const expected = branch === governance ? governancePaths : diagnosticPaths;
    const baseline = structuredClone(state);
    if (branch === governance && scopes === undefined) {
      // Owner authorization in the 2026-09-19 session permits this atomic
      // seven-file repair. This is NOT a claim of prior machine admission.
      // The initial candidate is reviewed/tested without privileged execution.
      const sha = execFileSync('git', ['rev-parse', baseRef], { encoding: 'utf8' }).trim();
      const blob = execFileSync('git', ['rev-parse', `${baseRef}:${stateFile}`], { encoding: 'utf8' }).trim();
      if (sha !== 'fe50e24d202bcd22d72dd15e4dc58f9ddc491331' || blob !== 'ea92fc5f636efaf147ddeee34f81428cdd69a925' ||
          Object.hasOwn(state.approvedConcurrentScopes, diagnostic)) {
        throw new Error('INDUSTRIAL_DIAGNOSTIC_BOOTSTRAP_BASE_MISMATCH');
      }
      baseline.approvedConcurrentScopes[governance] = governancePaths;
      baseline.approvedConcurrentScopes[diagnostic] = diagnosticPaths;
      scopes = governancePaths;
    }
    if (!isDeepStrictEqual(scopes, expected)) throw new Error('INDUSTRIAL_DIAGNOSTIC_ACCEPTED_SCOPE_MISMATCH');
    const headRef = String(process.env.HEAD_REF || 'HEAD');
    const candidate = JSON.parse(execFileSync('git', ['show', `${headRef}:${stateFile}`], { encoding: 'utf8' }));
    if (!isDeepStrictEqual(candidate, baseline)) throw new Error('INDUSTRIAL_DIAGNOSTIC_STATE_MUTATION');
    const changes = execFileSync('git', ['diff', '--no-renames', '--name-status', `${baseRef}...${headRef}`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    for (const change of changes) {
      const [status, file, extra] = change.split('\t');
      if (status !== 'M' || extra || !expected.includes(file)) throw new Error('INDUSTRIAL_DIAGNOSTIC_DIFF_SCOPE');
      const modes = [baseRef, headRef].map(ref => execFileSync('git', ['ls-tree', ref, '--', file], { encoding: 'utf8' }).split(' ')[0]);
      if (!['100644', '100755'].includes(modes[0]) || modes[0] !== modes[1]) throw new Error('INDUSTRIAL_DIAGNOSTIC_FILE_MODE');
    }
  }

  if (branch === 'governance/final-public-experience-v1-20260919') {
    const { isDeepStrictEqual } = require('node:util');
    const headRef = String(process.env.HEAD_REF || 'HEAD');
    const changes = execFileSync('git', ['diff', '--no-renames', '--name-status', `${baseRef}...${headRef}`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    for (const change of changes) {
      const [status, file] = change.split('\t');
      if (status !== 'M') throw new Error('P7_IMMUTABLE_SCOPE: public governance permits modifications only');
      const modes = [baseRef, headRef].map((ref) => execFileSync('git', ['ls-tree', ref, '--', file], { encoding: 'utf8' }).split(' ')[0]);
      if (!['100644', '100755'].includes(modes[0]) || modes[0] !== modes[1]) {
        throw new Error('P7_IMMUTABLE_SCOPE: public governance requires unchanged regular-file modes');
      }
    }
    const candidate = JSON.parse(execFileSync('git', ['show', `${headRef}:${stateFile}`], { encoding: 'utf8' }));
    const baseline = JSON.parse(JSON.stringify(state));
    for (const admittedBranch of ['agent/platform-v7-strategic-rebuild-v3', 'fix/public-registration-final-copy-4916']) {
      if (candidate.approvedConcurrentScopes) delete candidate.approvedConcurrentScopes[admittedBranch];
      if (baseline.approvedConcurrentScopes) delete baseline.approvedConcurrentScopes[admittedBranch];
    }
    if (!isDeepStrictEqual(candidate, baseline)) {
      throw new Error('P7_IMMUTABLE_SCOPE: public governance cannot alter its own or unrelated state authority');
    }
  }

  // Final Public branches transition to trusted-base state admission through a separate
  // governance PR. Until that state entry lands, use only the already-merged
  // base-owned manifest. Never read scope authority from the PR head.
  if (!Array.isArray(scopes) || scopes.length === 0) {
    const finalPublicStaticScopeByBranch = new Map([
      ['agent/platform-v7-product-copy', ['apps/web/tests/unit/platformV7HomepageProductCopy.test.ts']],
      ['ops/production-full-stack-release-v1', [
        'scripts/check-production-full-stack-release.mjs',
        'scripts/production-full-stack-live-acceptance.sh',
      ]],
    ]);
    const staticScope = finalPublicStaticScopeByBranch.get(branch);
    if (staticScope) {
      scopes = staticScope;
    } else {
      const finalPublicManifestByBranch = new Map([
        ['agent/platform-v7-strategic-rebuild-v3', 'docs/platform-v7/autopilot/scopes/platform-v7-strategic-rebuild-v3.json'],
        ['p0/farmer-public-market-teaser-20260913', 'docs/platform-v7/autopilot/scopes/farmer-public-market-teaser-20260913.json'],
        ['fix/public-registration-final-copy-4916', 'docs/platform-v7/autopilot/scopes/public-registration-final-copy-4916.json'],
        ['fix/public-deal-journey-10of10-current-main-20260808', 'docs/platform-v7/autopilot/scopes/public-deal-journey-10of10-20260808.json'],
      ]);
      const manifestPath = finalPublicManifestByBranch.get(branch);
      if (manifestPath) {
      let manifest;
      try {
        const raw = execFileSync('git', ['show', `${baseRef}:${manifestPath}`], { encoding: 'utf8' });
        manifest = JSON.parse(raw);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`P7_IMMUTABLE_SCOPE: cannot load accepted Final Public manifest: ${message}`);
      }
      if (manifest?.branch !== branch || manifest?.status !== 'active' || !Array.isArray(manifest?.allowedPaths) || manifest.allowedPaths.length === 0) {
        throw new Error('P7_IMMUTABLE_SCOPE: accepted Final Public manifest identity is invalid');
      }
        scopes = manifest.allowedPaths;
      }
    }
  }
}

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
  APPROVED_BRANCH_SCOPE=$(GITHUB_HEAD_REF="$CURRENT_BRANCH" P7_SCOPE_BASE_REF="$BASE_REF" P7_SCOPE_HEAD_REF="$HEAD_REF" node - <<'JS'
const fs = require('fs');
const { execFileSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');
const branch = String(process.env.GITHUB_HEAD_REF || '').trim();
const state = JSON.parse(branch === 'security/pc-crop-next-15-5-24-4997'
  ? execFileSync('git', ['show', `${process.env.P7_SCOPE_HEAD_REF}:docs/platform-v7/autopilot/autopilot-state.json`], { encoding: 'utf8' })
  : fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
let scopes = branch ? state.approvedConcurrentScopes?.[branch] : undefined;
if (branch === 'security/pc-crop-next-15-5-24-4997') {
  const expected = ['.github/workflows/platform-v7-autopilot-guard.yml', '.github/workflows/sbom-scan.yml', 'apps/web/package.json', 'package.json', 'pnpm-lock.yaml',
    'docs/platform-v7/autopilot/autopilot-state.json',
    'scripts/p7-autopilot-guard.sh', 'scripts/p7-autopilot-guard.test.mjs'];
  // The owner authorized this combined governance/security repair on 2026-09-09
  // after separate governance #5196 was blocked by the vulnerable base itself.
  // Bootstrap is bound to that exact base state; it is not a generic fallback.
  let accepted;
  try {
    accepted = JSON.parse(execFileSync('git', ['show', `${process.env.P7_SCOPE_BASE_REF}:docs/platform-v7/autopilot/autopilot-state.json`], { encoding: 'utf8' }));
  } catch {
    throw new Error('NEXT_SECURITY_PATCH_ACCEPTED_SCOPE_MISSING');
  }
  const acceptedScope = accepted.approvedConcurrentScopes?.[branch];
  if (!Array.isArray(acceptedScope)) {
    const blob = execFileSync('git', ['rev-parse', `${process.env.P7_SCOPE_BASE_REF}:docs/platform-v7/autopilot/autopilot-state.json`], { encoding: 'utf8' }).trim();
    if (blob !== '571d2821ac3c371d548e51e747ea8111a436dab8') {
      throw new Error('NEXT_SECURITY_PATCH_ACCEPTED_SCOPE_MISSING');
    }
    accepted.approvedConcurrentScopes[branch] = [...expected];
  } else if (JSON.stringify([...acceptedScope].sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error('NEXT_SECURITY_PATCH_ACCEPTED_SCOPE_MISSING');
  }
  if (!Array.isArray(scopes) || JSON.stringify([...scopes].sort()) !== JSON.stringify(expected.sort())) {
    throw new Error('NEXT_SECURITY_PATCH_SCOPE_MISMATCH');
  }
  // No modification of other branches, global scope or state is authorized.
  if (!isDeepStrictEqual(state, accepted)) throw new Error('NEXT_SECURITY_PATCH_STATE_MUTATION');
  scopes = expected;
}
if (Array.isArray(scopes)) {
  for (const file of scopes) console.log(file);
}
JS
  )
fi

if is_immutable_scope_branch "$CURRENT_BRANCH"; then
  # Discard every legacy hardcoded or diff-triggered scope expansion above.
  ALLOWED_CURRENT="$APPROVED_BRANCH_SCOPE"
elif [ "$CURRENT_BRANCH" = "$NEXT_SECURITY_PATCH_BRANCH" ]; then
  # Owner-authorized 2026-09-09 dependency repair uses only its explicit paths.
  ALLOWED_CURRENT="$APPROVED_BRANCH_SCOPE"
elif [ -n "$APPROVED_BRANCH_SCOPE" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$APPROVED_BRANCH_SCOPE")
fi

if is_immutable_scope_branch "$CURRENT_BRANCH" || [ "$CURRENT_BRANCH" = "$NEXT_SECURITY_PATCH_BRANCH" ]; then
  SOURCE_CONTROLLED_SCOPE=''
else
  SOURCE_CONTROLLED_SCOPE=$(GITHUB_HEAD_REF="${GITHUB_HEAD_REF:-}" node scripts/p7-source-controlled-scope.mjs)
fi

if [ -n "$SOURCE_CONTROLLED_SCOPE" ]; then
  ALLOWED_CURRENT=$(printf '%s\n%s\n' "$ALLOWED_CURRENT" "$SOURCE_CONTROLLED_SCOPE")
fi

if is_immutable_scope_branch "$CURRENT_BRANCH" && [ "$CURRENT_BRANCH" != "$SCOPE_GOVERNANCE_BRANCH" ] && [ "$CURRENT_BRANCH" != "$INVENTORY_SCOPE_GOVERNANCE_BRANCH" ] && [ "$CURRENT_BRANCH" != "$PUBLIC_HOME_SCOPE_GOVERNANCE_BRANCH" ] && [ "$CURRENT_BRANCH" != "$POISON_ISOLATION_SCOPE_GOVERNANCE_BRANCH" ] && [ "$CURRENT_BRANCH" != "$FINAL_PUBLIC_GOVERNANCE_BRANCH" ] && [ "$CURRENT_BRANCH" != "$INDUSTRIAL_DIAGNOSTIC_GOVERNANCE_BRANCH" ] && [ "$CURRENT_BRANCH" != "$IR20_BINDING_PREREQUISITE_BRANCH" ] && [ "$CURRENT_BRANCH" != "$PRODUCT_SCOPE_ADMISSION_BRANCH" ] && [ "$CURRENT_BRANCH" != "$PRODUCT_BUYER_ADMISSION_BRANCH" ] && [ "$CURRENT_BRANCH" != "$PRODUCT_BANK_HOME_ADMISSION_BRANCH" ] && [ "$CURRENT_BRANCH" != "$PRODUCT_DEAL_RUNTIME_ADMISSION_BRANCH" ]; then
  MUTABLE_SCOPE_AUTHORITIES=$(printf '%s\n' "$DIFF_FILES" | grep -E '^(AGENTS\.md|docs/platform-v7/autopilot/|scripts/p7-autopilot-guard\.sh$|scripts/p7-autopilot-guard\.test\.mjs$|scripts/p7-source-controlled-scope\.mjs$|\.github/workflows/platform-v7-autopilot-guard\.yml$|\.github/workflows/automerge\.yml$)' || true)
  # These manifests document the exact accepted path sets. They are not scope
  # authority: only approvedConcurrentScopes from the trusted base is used.
  case "$CURRENT_BRANCH" in
    "$PRODUCT_BANK_COPY_BRANCH") PRODUCT_SCOPE_MANIFEST='docs/platform-v7/autopilot/scopes/bank-deep-visible-copy-guard-20260924.json' ;;
    "$PRODUCT_ZSN_SOURCE_BRANCH") PRODUCT_SCOPE_MANIFEST='docs/platform-v7/autopilot/scopes/fgis-zsn-public-document-source-lock-20260924.json' ;;
    "$PRODUCT_NEXT_ACTION_BRANCH") PRODUCT_SCOPE_MANIFEST='docs/platform-v7/autopilot/scopes/first-customer-next-action-unknown-20260924.json' ;;
    "$PUBLIC_REGISTRATION_PARTICIPATION_BRANCH") PRODUCT_SCOPE_MANIFEST='docs/platform-v7/autopilot/scopes/public-registration-participation-choice-20260923.json' ;;
    "$PRODUCTION_MOBILE_HANDOFF_BRANCH") PRODUCT_SCOPE_MANIFEST='docs/platform-v7/autopilot/scopes/production-mobile-controller-handoff-20260927.json' ;;
    "$READINESS_QUEUE_JOB_GATE_BRANCH") PRODUCT_SCOPE_MANIFEST='docs/platform-v7/autopilot/scopes/readiness-queue-job-gate-20260927.json' ;;
    "$READINESS_DEFAULT_BRANCH_PUSH_GATE_BRANCH") PRODUCT_SCOPE_MANIFEST='docs/platform-v7/autopilot/scopes/readiness-default-branch-push-gate-20260929.json' ;;
    "$PRODUCT_BUYER_HOME_BRANCH") PRODUCT_SCOPE_MANIFEST='docs/platform-v7/autopilot/scopes/buyer-first-customer-home-20260925.json' ;;
    "$PRODUCT_BANK_HOME_BRANCH") PRODUCT_SCOPE_MANIFEST='docs/platform-v7/autopilot/scopes/bank-first-customer-home-20260926.json' ;;
    *) PRODUCT_SCOPE_MANIFEST='' ;;
  esac
  if [ -n "$PRODUCT_SCOPE_MANIFEST" ]; then
    PRODUCT_MANIFEST_BASE_SCOPE="$APPROVED_BRANCH_SCOPE" PRODUCT_MANIFEST_PATH="$PRODUCT_SCOPE_MANIFEST" \
      PRODUCT_MANIFEST_BRANCH="$CURRENT_BRANCH" PRODUCT_MANIFEST_HEAD="$HEAD_REF" node - <<'JS'
const { execFileSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');
const branch = process.env.PRODUCT_MANIFEST_BRANCH;
const path = process.env.PRODUCT_MANIFEST_PATH;
const head = process.env.PRODUCT_MANIFEST_HEAD;
const acceptedPaths = process.env.PRODUCT_MANIFEST_BASE_SCOPE.split(/\r?\n/u).filter(Boolean);
if (!acceptedPaths.includes(path)) throw new Error('PRODUCT_MANIFEST_NOT_ACCEPTED_IN_BASE');
const raw = execFileSync('git', ['show', `${head}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 });
const manifest = JSON.parse(raw);
if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object' ||
    manifest.schemaVersion !== 'platform-v7.concurrent-scope.v1' ||
    manifest.status !== 'active' || manifest.branch !== branch ||
    !isDeepStrictEqual(manifest.allowedPaths, acceptedPaths)) {
  throw new Error('PRODUCT_MANIFEST_BASE_SCOPE_MISMATCH');
}
JS
    MUTABLE_SCOPE_AUTHORITIES=$(printf '%s\n' "$MUTABLE_SCOPE_AUTHORITIES" | grep -Fxv "$PRODUCT_SCOPE_MANIFEST" || true)
  fi
  if [ "$CURRENT_BRANCH" = "$QWEN_FAILED_EVIDENCE_BRANCH" ]; then
    # This diagnostic regression file is still subject to exact base-approved scope.
    MUTABLE_SCOPE_AUTHORITIES=$(printf '%s\n' "$MUTABLE_SCOPE_AUTHORITIES" | grep -Fxv 'docs/platform-v7/autopilot/verify-pr-review-gate.test.mjs' || true)
  fi
  if [ "$CURRENT_BRANCH" = "$READINESS_QUEUE_JOB_GATE_BRANCH" ] && printf '%s\n' "$MUTABLE_SCOPE_AUTHORITIES" | grep -Fxq '.github/workflows/automerge.yml'; then
    # This one workflow authority may move the same concurrency lease beneath
    # the existing event gate. Reject every other byte change against trusted base.
    READINESS_BASE_REF="$BASE_REF" READINESS_HEAD_REF="$HEAD_REF" node - <<'JS'
const { execFileSync } = require('node:child_process');
const path = '.github/workflows/automerge.yml';
const read = ref => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 128 * 1024 });
const base = read(process.env.READINESS_BASE_REF);
const head = read(process.env.READINESS_HEAD_REF);
const workflowLease = `# Serial publication prevents an older evaluator overwriting a newer result.
concurrency:
  group: repo-engineering-readiness
  cancel-in-progress: false
  queue: max

`;
const anchor = `         github.event.workflow_run.name != 'Independent Octopus Review'))\n`;
const gatedLease = `    # A job that fails the event gate must not occupy the global publication
    # queue. Keep admitted evaluations serialized at the job boundary.
    concurrency:
      group: repo-engineering-readiness
      cancel-in-progress: false
      queue: max
`;
if (base.split(workflowLease).length !== 2 || base.split(anchor).length !== 2) {
  throw new Error('READINESS_TRUSTED_BASE_SHAPE_INVALID');
}
const expected = base.replace(workflowLease, '').replace(anchor, `${anchor}${gatedLease}`);
if (head !== expected) throw new Error('READINESS_QUEUE_CHANGE_EXCEEDS_EXACT_TRANSFORM');
JS
    MUTABLE_SCOPE_AUTHORITIES=$(printf '%s\n' "$MUTABLE_SCOPE_AUTHORITIES" | grep -Fxv '.github/workflows/automerge.yml' || true)
  fi
  if [ "$CURRENT_BRANCH" = "$READINESS_DEFAULT_BRANCH_PUSH_GATE_BRANCH" ] && printf '%s\n' "$MUTABLE_SCOPE_AUTHORITIES" | grep -Fxq '.github/workflows/automerge.yml'; then
    # A push to the default branch has no open pull request: the evaluator only
    # re-scores already merged heads. This one workflow authority may exclude
    # such workflow_run events from the unchanged job gate. Every other byte
    # change against the trusted base is rejected.
    READINESS_BASE_REF="$BASE_REF" READINESS_HEAD_REF="$HEAD_REF" node - <<'JS'
const { execFileSync } = require('node:child_process');
const path = '.github/workflows/automerge.yml';
const read = ref => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 128 * 1024 });
const base = read(process.env.READINESS_BASE_REF);
const head = read(process.env.READINESS_HEAD_REF);
const anchor = `         github.event.workflow_run.name != 'Independent Octopus Review'))\n`;
const gated = `         github.event.workflow_run.name != 'Independent Octopus Review' &&
         !(github.event.workflow_run.event == 'push' &&
           github.event.workflow_run.head_branch == github.event.repository.default_branch)))\n`;
if (base.split(anchor).length !== 2) throw new Error('READINESS_DEFAULT_BRANCH_TRUSTED_BASE_SHAPE_INVALID');
if (head !== base.replace(anchor, gated)) throw new Error('READINESS_DEFAULT_BRANCH_PUSH_CHANGE_EXCEEDS_EXACT_TRANSFORM');
JS
    MUTABLE_SCOPE_AUTHORITIES=$(printf '%s\n' "$MUTABLE_SCOPE_AUTHORITIES" | grep -Fxv '.github/workflows/automerge.yml' || true)
  fi
  if [ -n "$MUTABLE_SCOPE_AUTHORITIES" ]; then
    echo "Mutable scope authority changed on a PC-CROP immutable-scope implementation branch:"
    printf '%s\n' "$MUTABLE_SCOPE_AUTHORITIES"
    exit 1
  fi
fi

if [ "$CURRENT_BRANCH" = "$NEXT_SECURITY_PATCH_BRANCH" ] || [ "${GITHUB_HEAD_REF:-}" = "agent/ir-sec-transitive-runtime-remediation" ] || [ "${GITHUB_HEAD_REF:-}" = "agent/ir-sec-opentelemetry-220" ] || [ "${GITHUB_HEAD_REF:-}" = "agent/ir-sec-next-15-5-16-final" ] || [ "${GITHUB_HEAD_REF:-}" = "claude/tai-production-attestation-gizgzh" ] || [ "${GITHUB_HEAD_REF:-}" = "fix/security-brace-expansion-5-0-8" ] || [ "${GITHUB_HEAD_REF:-}" = "identity-rls-3670" ]; then
  FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\.json$|\.env|.*\.pem$|.*\.key$)'
else
  FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\.json$|pnpm-lock\.yaml$|\.env|.*\.pem$|.*\.key$)'
fi

FORBIDDEN_FILES=$(printf '%s\n' "$DIFF_FILES" | grep -E "$FORBIDDEN_ALWAYS" || true)

# The exact pair has already passed accepted-base purpose/admission, complete
# diff and immutable blob/mode validation. Every other landing path stays banned.
if [ "$CURRENT_BRANCH" = "$GITLEAKS_RELEASE_ATTESTATION_BRANCH" ] && printf '%s\n' "$DIFF_FILES" | grep -Fxq 'apps/landing/package.json'; then
  FORBIDDEN_FILES=$(printf '%s\n' "$FORBIDDEN_FILES" | grep -Fxv 'apps/landing/package.json' || true)
fi

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

if is_immutable_scope_branch "$CURRENT_BRANCH" || [ "$CURRENT_BRANCH" = "$NEXT_SECURITY_PATCH_BRANCH" ]; then
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
