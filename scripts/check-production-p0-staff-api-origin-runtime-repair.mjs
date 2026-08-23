#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-staff-api-origin-runtime-repair.yml';
const scriptPath = 'scripts/production-p0-staff-api-origin-runtime-repair.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/p0-staff-api-origin-runtime-repair-4559.json';
const checkerPath = 'scripts/check-production-p0-staff-api-origin-runtime-repair.mjs';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

function fail(message) { throw new Error(`P0_STAFF_API_ORIGIN_RUNTIME_REPAIR:${message}`); }
function requireAll(label, source, needles) {
  for (const needle of needles) if (!source.includes(needle)) fail(`${label} missing ${needle}`);
}

requireAll('workflow', workflow, [
  'issue_comment:',
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "github.event.comment.body == '/production p0-staff-api-origin-repair current-runtime'",
  'bash scripts/production-p0-staff-api-origin-runtime-repair.sh',
  'Reject concurrent production mutation workflows',
  'isStrictStaleQueuedIssueComment',
  'github.rest.actions.cancelWorkflowRun',
  'github.rest.actions.getWorkflowRun',
  "'STALE_REREAD_FAILED'",
  "'STALE_RECHECK_BECAME_ACTIVE_OR_CHANGED'",
  "'ACTIVE_OR_NONSTALE_PRODUCTION_RUN'",
  'Cancellation API failed for stale queued run',
  'exact re-read confirms unchanged strict stale queued ghost',
  'if (active.length) core.setFailed',
]);

const cancelIndex = workflow.indexOf('github.rest.actions.cancelWorkflowRun');
const rereadIndex = workflow.indexOf('github.rest.actions.getWorkflowRun');
if (cancelIndex < 0 || rereadIndex < 0 || rereadIndex <= cancelIndex) {
  fail('stale queued cancellation must be followed by exact workflow re-read');
}
if (!workflow.includes('if (isStrictStaleQueuedIssueComment(reread))')) {
  fail('failed cancellation may be ignored only after strict stale queued re-verification');
}
if (!workflow.includes("String(run.head_sha || '') !== String(context.sha || '')")) {
  fail('stale queued exception must never match the current repair SHA');
}

requireAll('script', script, [
  "COMMAND='/production p0-staff-api-origin-repair current-runtime'",
  "CANONICAL_ORIGIN='http://api:3001'",
  "PRODUCTION_MUTATION='WEB_ONLY_API_ORIGIN_OVERRIDE_AND_RECREATE'",
  'git merge-base --is-ancestor "$DEPLOYED_SHA" "$TARGET_SHA"',
  "git show \"$DEPLOYED_SHA:apps/web/lib/server/server-api-origin.ts\"",
  "const COMPOSE_INTERNAL_API_ORIGIN = 'http://api:3001';",
  '.pc-staff-api-origin.override.yml',
  'API_URL: http://api:3001',
  'config --format json',
  "candidate_class=\"$(classify_json_origin \"$tmp/candidate.json\")\"",
  '[[ "$candidate_class" == CANONICAL ]]',
  "candidate_image_id=\"$(docker image inspect --format '{{.Id}}' \"$candidate_image_ref\" 2>/dev/null)\"",
  '[[ "$candidate_image_id" == "$web_image_id" ]]',
  'up -d --no-deps --no-build --pull never web',
  'cmp -s "$tmp/nonweb.before" "$tmp/nonweb.after"',
  '[[ "${api_after[0]}" == "$api_id" ]]',
  "await p('/auth/me','AUTH_STATUS')",
  "await p('/staff/capabilities/me','CAP_STATUS')",
  '[[ "$auth_status" == 401 && "$cap_status" == 401 ]]',
  'ACTIVE_BEFORE=',
  'COMPOSE_BEFORE=',
  'ACTIVE_AFTER=',
  'secrets / API origin value / protected paths / container IDs / raw logs: \\`NOT_PUBLISHED\\`',
]);

if ((script.match(/up -d --no-deps --no-build --pull never web/g) || []).length !== 2) {
  fail('expected exactly one repair and one rollback Web-only compose up');
}

for (const forbidden of [
  '\ndocker pull ', '\ndocker build ', '\ndocker restart ', '\ndocker stop ', '\ndocker rm ',
  '\ndocker compose down', '\ndocker compose pull', '\ndocker compose build',
  'UPDATE auth.', 'DELETE FROM auth.', 'INSERT INTO auth.', 'TRUNCATE ',
  'docker exec -i "$api_id"',
]) {
  if (script.includes(forbidden)) fail(`script contains forbidden mutation ${JSON.stringify(forbidden)}`);
}

for (const forbiddenOutput of [
  'echo "$API_URL"', "printf '%s\\n' \"$API_URL\"", 'env |', 'printenv API_URL', 'docker inspect "$web_id"',
]) {
  if (script.includes(forbiddenOutput)) fail(`script may expose protected runtime data: ${forbiddenOutput}`);
}

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('scope schema mismatch');
if (scope.issue !== 4559 || scope.releaseIssue !== 3072) fail('scope authority mismatch');
if (scope.branch !== 'fix/p0-staff-api-origin-runtime-4559' || scope.status !== 'active') fail('scope branch/status mismatch');
if (scope.authorityBaseExactMain !== '328c89877f3d26e2828816846d1132f7a5cabfd8') fail('scope exact-main mismatch');
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) fail('scope hosting/cost mismatch');
const expected = [workflowPath, scopePath, checkerPath, scriptPath].sort();
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify(expected)) fail('scope allowed paths mismatch');
const b = scope.boundaries || {};
for (const key of ['registrationOnly','ownerCommandOnly','webOnlyRuntimeMutation']) if (b[key] !== true) fail(`boundary must be true: ${key}`);
for (const key of ['apiMutation','databaseMutation','migrationMutation','passwordOrRecoveryMutation','mfaMutation','sessionMutation','roleOrMembershipMutation','dnsMutation','caddyMutation','sshPinMutation','imageBuildOrPull','credentialOutput','rawApiOriginOutput','protectedPathOutput','containerIdOutput']) {
  if (b[key] !== false) fail(`boundary must be false: ${key}`);
}
if (b.newRecurringCostRub !== 0) fail('scope recurring cost mismatch');

console.log('production P0 staff API origin runtime repair contract PASS');