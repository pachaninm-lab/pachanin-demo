#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-staff-unavailable-diagnostic.yml';
const scriptPath = 'scripts/production-p0-staff-unavailable-diagnostic.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/p0-staff-unavailable-diagnostic-4556.json';
const checkerPath = 'scripts/check-production-p0-staff-unavailable-diagnostic.mjs';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

function fail(message) { throw new Error(`P0_STAFF_UNAVAILABLE_DIAGNOSTIC:${message}`); }
function requireAll(label, source, needles) {
  for (const needle of needles) if (!source.includes(needle)) fail(`${label} missing ${needle}`);
}

requireAll('workflow', workflow, [
  'issue_comment:',
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "github.event.comment.body == '/production p0-staff-unavailable-diagnose deployed-runtime'",
  'bash scripts/production-p0-staff-unavailable-diagnostic.sh',
]);

requireAll('script', script, [
  "COMMAND='/production p0-staff-unavailable-diagnose deployed-runtime'",
  "WINDOW_START='2026-08-23T12:05:00Z'",
  "WINDOW_END='2026-08-23T12:15:00Z'",
  "PRODUCTION_MUTATION='NONE'",
  'git merge-base --is-ancestor "$DEPLOYED_SHA" "$TARGET_SHA"',
  'scripts/security/*',
  "docker exec -i \"$web_id\" /nodejs/bin/node --input-type=commonjs -",
  "docker exec -i \"$api_id\" /nodejs/bin/node --input-type=commonjs -",
  "await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')",
  "has_table_privilege(current_user,'auth.staff_assignments','SELECT')",
  'CEREMONY_LOGIN_SUCCESS',
  'CEREMONY_MFA_SUCCESS',
  'staff_capabilities_transport_failure',
  'API_PRISMA_ERROR_MARKERS',
  'API_PERMISSION_ERROR_MARKERS',
  'raw logs: \\`NOT_PUBLISHED\\`',
  'production mutation: \\`NONE\\`',
]);

for (const forbidden of [
  'docker compose up', 'docker restart', 'docker rm', 'docker stop',
  'UPDATE auth.', 'DELETE FROM auth.', 'INSERT INTO auth.', 'TRUNCATE ',
  '/production p0-first-customer', '/production registration-matrix',
]) {
  if (script.includes(forbidden)) fail(`script contains forbidden mutator ${forbidden}`);
}

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('scope schema mismatch');
if (scope.issue !== 4556 || scope.releaseIssue !== 3072) fail('scope authority mismatch');
if (scope.branch !== 'diag/p0-staff-unavailable-4556' || scope.status !== 'active') fail('scope branch/status mismatch');
if (scope.authorityBaseExactMain !== '829eb17b0df96ea55155fc71cca436f8b6862d67') fail('scope exact-main mismatch');
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) fail('scope hosting/cost mismatch');
const expected = [workflowPath, scopePath, checkerPath, scriptPath].sort();
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify(expected)) fail('scope allowed paths mismatch');
const b = scope.boundaries || {};
for (const key of ['registrationOnly','readOnlyProductionDiagnostic']) if (b[key] !== true) fail(`boundary must be true: ${key}`);
for (const key of ['credentialOutput','rawLogOutput','loginOrSessionMutation','passwordResetOrRecovery','mfaMutation','roleOrMembershipMutation','databaseMutation','deploymentMutation','dnsMutation','sshPinMutation']) {
  if (b[key] !== false) fail(`boundary must be false: ${key}`);
}
if (b.newRecurringCostRub !== 0) fail('scope recurring cost mismatch');
console.log('production P0 staff unavailable diagnostic contract PASS');
