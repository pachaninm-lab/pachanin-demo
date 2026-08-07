#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/tai-owner-incomplete-deployment-recovery.yml';
const scriptPath = 'scripts/tai-incomplete-deployment-recovery.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/tai-incomplete-deployment-recovery-20260807.json';
const workflow = readFileSync(workflowPath, 'utf8');
const script = readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(readFileSync(scopePath, 'utf8'));
const violations = [];

const requireFragment = (source, path, fragment) => {
  if (!source.includes(fragment)) violations.push(`${path}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (source, path, pattern, message) => {
  if (pattern.test(source)) violations.push(`${path}: ${message}`);
};

for (const fragment of [
  'name: TAI Owner Incomplete Deployment Recovery',
  'issue_comment:',
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai recover-incomplete-deployment current-main'",
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  "'Production Full-Stack Exact-SHA Release'",
  "'Validate full-stack release contract'",
  "'Migrate, deploy API and web, verify live intake'",
  'SSH_HOST_FINGERPRINT_SECRET:',
  'ssh-keyscan -T 10',
  "'set -Eeuo pipefail; [[ \"$(id -u)\" -eq 0 ]]; docker version >/dev/null; docker compose version >/dev/null; echo ROOT_SSH_AUTH_OK'",
  'scripts/tai-incomplete-deployment-recovery.sh',
  'incomplete-tai-recovery.json',
  "schemaVersion !== 'tai.incomplete-deployment-recovery.v1'",
  "context='TAI Incomplete Deployment Recovery'",
  'production deployment started: `false`',
]) requireFragment(workflow, workflowPath, fragment);

for (const fragment of [
  "readonly ENV_FILE='/etc/transparent-price/tai-agro-os.env'",
  "readonly LOCK_FILE='/run/lock/pc-tai-release-controller.lock'",
  "TAI_RESTRICTED_ACTIVATION_SHA",
  "MUTATION_STARTED",
  "ROLLED_BACK",
  "CURRENT_TAI_IS_HEALTHY",
  "CURRENT_WEB_EXACT_MAIN_MISSING",
  "CURRENT_API_EXACT_MAIN_MISSING",
  "ROLE_CREATED",
  "pg_stat_activity",
  "non_tai.count",
  "REASSIGN OWNED BY ${ROLE_NAME} TO ${DB_ADMIN};",
  "DROP OWNED BY ${ROLE_NAME};",
  "DROP ROLE ${ROLE_NAME};",
  "touch \"$STATE_ROOT/ROLLED_BACK\"",
  "'schemaVersion':'tai.incomplete-deployment-recovery.v1'",
  "'newRecurringCostRub':0",
]) requireFragment(script, scriptPath, fragment);

forbid(workflow, workflowPath, /pull_request_target:/u, 'pull_request_target is forbidden');
forbid(workflow, workflowPath, /continue-on-error:\s*true/mu, 'continue-on-error success laundering is forbidden');
forbid(workflow, workflowPath, /StrictHostKeyChecking=no/u, 'unverified SSH host identity is forbidden');
forbid(workflow, workflowPath, /workflow_dispatch:/u, 'recovery must remain owner issue-command only');
forbid(script, scriptPath, /DROP\s+ROLE\s+IF\s+EXISTS/iu, 'silent role-drop authority is forbidden');
forbid(script, scriptPath, /rm\s+-rf\s+\/var\/lib\/pc-release-authority/iu, 'broad release-authority deletion is forbidden');

if (scope?.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${scopePath}: schema mismatch`);
if (scope?.branch !== 'fix/tai-incomplete-deployment-recovery-20260807') violations.push(`${scopePath}: branch mismatch`);
if (scope?.baselineExactMain !== '810bcf47ecafec8c51c741429b21586567563a6d') violations.push(`${scopePath}: baseline mismatch`);
const allowed = new Set(scope?.allowedPaths || []);
for (const path of [workflowPath, scriptPath, 'scripts/check-tai-incomplete-deployment-recovery.mjs', scopePath]) {
  if (!allowed.has(path)) violations.push(`${scopePath}: allowedPaths missing ${path}`);
}
if (allowed.size !== 4) violations.push(`${scopePath}: recovery scope must contain exactly four paths`);

if (violations.length) {
  console.error('TAI incomplete deployment recovery contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI incomplete deployment recovery contract PASS: exact-main owner authority, exact full-stack prerequisite, pinned root transport, bounded failed-state restoration and least-privilege role cleanup remain fail-closed.');
