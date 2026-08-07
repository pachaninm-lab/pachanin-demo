#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  workflow: '.github/workflows/tai-owner-partial-deployment-recovery-command.yml',
  recovery: 'scripts/tai-partial-deployment-recovery.sh',
  checker: 'scripts/check-tai-partial-deployment-recovery.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/tai-runner-partial-deploy-recovery-20260807.json',
};
const workflow = readFileSync(paths.workflow, 'utf8');
const recovery = readFileSync(paths.recovery, 'utf8');
const scope = JSON.parse(readFileSync(paths.scope, 'utf8'));
const violations = [];
const requireFragment = (source, fragment, label) => {
  if (!source.includes(fragment)) violations.push(`${label}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (source, pattern, label) => {
  if (pattern.test(source)) violations.push(label);
};

for (const fragment of [
  'name: TAI Owner Partial Deployment Recovery',
  'issue_comment:',
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai recover-partial-deploy current-main'",
  'COMMENTER: ${{ github.event.comment.user.login }}',
  'ACTOR: ${{ github.actor }}',
  'TRIGGERING_ACTOR: ${{ github.triggering_actor }}',
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  'actions/workflows/production-full-stack-exact-sha.yml/runs?branch=main&status=success&per_page=100',
  "'Validate full-stack release contract'",
  "'Migrate, deploy API and web, verify live intake'",
  "host=\"$(trim \"${SSH_HOST_SECRET:-$DEFAULT_HOST}\")\"",
  "[[ \"$expected\" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]",
  'ssh-keyscan -T 10',
  'StrictHostKeyChecking=yes',
  'scripts/tai-partial-deployment-recovery.sh',
  'partial-deploy-recovery.json',
  'TAI_PARTIAL_DEPLOYMENT_RECOVERY=PASS',
  "context='TAI Partial Deployment Recovery'",
  'gh issue comment 3365',
  '- production mutation: `BOUNDED_ORPHAN_RECOVERY_ONLY`',
]) requireFragment(workflow, fragment, paths.workflow);

for (const fragment of [
  'RECOVERY_REQUIRES_NEWER_CURRENT_MAIN',
  'PLATFORM_RUNTIME_AUTHORITY_AMBIGUOUS',
  'WEB_NOT_EXACT_CURRENT_MAIN',
  'API_NOT_EXACT_CURRENT_MAIN',
  'PARTIAL_TAI_RUNTIME_AUTHORITY_AMBIGUOUS',
  'PARTIAL_TAI_USER_INVALID',
  'PARTIAL_TAI_ROOTFS_INVALID',
  'PARTIAL_TAI_PUBLIC_PORT_INVALID',
  'PARTIAL_DEPLOYMENT_STATE_AUTHORITY_AMBIGUOUS',
  "rows['PREVIOUS_TAI'] != '0'",
  'ROLLBACK_ABSENT_SNAPSHOTS_MISSING',
  'TAI_RUNTIME_ROLE_PRIVILEGE_INVALID',
  'TAI_RUNTIME_ROLE_SCOPE_INVALID',
  "relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'",
  'healthDiagnostic',
  "probe('/health/live')",
  "probe('/health/ready')",
  "probe('/health/runtime')",
  '"${dc_current[@]}" rm -f -s -v tai',
  'REASSIGN OWNED BY ${ROLE_NAME} TO ${DB_ADMIN};',
  'DROP OWNED BY ${ROLE_NAME};',
  'DROP ROLE IF EXISTS ${ROLE_NAME};',
  "schemaRollback':'FORWARD_ONLY_IDEMPOTENT'",
  "'apiWebMutation':False",
  "'permanentModelAdmissionMutation':False",
  "'passed':True",
  'TAI_PARTIAL_DEPLOYMENT_RECOVERY=PASS',
]) requireFragment(recovery, fragment, paths.recovery);

forbid(workflow, /continue-on-error:\s*true/mu, `${paths.workflow}: continue-on-error is forbidden`);
forbid(workflow, /pull_request_target:/u, `${paths.workflow}: pull_request_target is forbidden`);
forbid(recovery, /docker\s+compose[^\n]+\bdown\b/iu, `${paths.recovery}: full Compose shutdown is forbidden`);
forbid(recovery, /\bdocker\s+(?:rm|stop|kill)\b/iu, `${paths.recovery}: direct broad container removal is forbidden`);
forbid(recovery, /set\s+-[^\n]*x/iu, `${paths.recovery}: shell tracing is forbidden`);
forbid(recovery, /TAI_MODEL_BEARER_TOKEN|AI_ASSISTANT_API_KEY/u, `${paths.recovery}: credential names must not be inspected or emitted`);
forbid(recovery, /INSERT\s+INTO\s+(?:public[.])?tai_model_admission/iu, `${paths.recovery}: permanent admission mutation is forbidden`);
forbid(recovery, /DROP\s+(?:TABLE|SCHEMA|DATABASE)\b/iu, `${paths.recovery}: schema/data destructive DDL is forbidden`);
forbid(recovery, /\brm\s+-rf\b/iu, `${paths.recovery}: recursive deletion is forbidden`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${paths.scope}: invalid schemaVersion`);
if (scope.branch !== 'fix/tai-orphan-deploy-recovery-20260807') violations.push(`${paths.scope}: branch mismatch`);
if (scope.baselineExactMain !== '810bcf47ecafec8c51c741429b21586567563a6d') violations.push(`${paths.scope}: baseline mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) violations.push(`${paths.scope}: hosting/cost boundary mismatch`);
const expected = Object.values(paths).sort();
const allowed = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(expected) !== JSON.stringify(allowed)) violations.push(`${paths.scope}: allowedPaths mismatch`);

if (violations.length) {
  console.error('TAI partial deployment recovery contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI partial deployment recovery contract PASS: owner-only exact-main authority can recover only one bounded first-time orphan TAI materialization, publish sanitized diagnostics, preserve API/Web and forward-only schema state, and fail closed on ambiguity.');
