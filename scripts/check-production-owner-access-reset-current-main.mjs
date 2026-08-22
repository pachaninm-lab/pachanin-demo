#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-owner-access-reset-current-main.yml';
const runnerPath = 'scripts/production-owner-access-reset-current-main.sh';
const migrationPath = 'apps/api/prisma/migrations/20260822111500_p0_owner_access_password_reset_subject/migration.sql';
const scopePath = 'docs/platform-v7/autopilot/scopes/owner-access-password-ready-3785.json';
const genericRunnerPath = 'scripts/production-p0-reviewer-password-reset-request.sh';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const genericRunner = fs.readFileSync(genericRunnerPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const command = '/production owner-access-reset current-main';
const branch = 'fix/owner-access-password-ready-3785';
const authorityBase = '1df1e55d4596c0bfe1ffa957f4d821bdcb26b5cb';
const ownerRunnerBlob = '8c7f039e88668d7c0d8e12e9fc4ddad8b937c771';
const genericRunnerBlob = '7a586ded1b40ab3812335b351d0e8cc519020aa4';
const allowedPaths = [workflowPath, migrationPath, scopePath, 'scripts/check-production-owner-access-reset-current-main.mjs', runnerPath];

function fail(message) {
  throw new Error(`OWNER_ACCESS_RESET_CONTRACT:${message}`);
}

function requireAll(label, text, needles) {
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${label} missing ${needle}`);
  }
}

function rejectAll(label, text, needles) {
  for (const needle of needles) {
    if (text.includes(needle)) fail(`${label} contains forbidden ${needle}`);
  }
}

function requireCount(label, text, needle, expected) {
  const count = text.split(needle).length - 1;
  if (count !== expected) fail(`${label} cardinality ${JSON.stringify(needle)} expected ${expected}, got ${count}`);
}

function gitBlobSha1(text) {
  const body = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
}

if (gitBlobSha1(genericRunner) !== genericRunnerBlob) fail('generic reset runner changed');
requireAll('generic runner', genericRunner, [
  "COMMAND='/production p0-reviewer-reset-request current-main'",
  'auth.staff_reviewer_password_reset_subject()',
  "counts.join('|') !== '1|1|1|1|1|0|0|0'",
]);
rejectAll('generic runner', genericRunner, [
  'staff_owner_access_password_reset_subject',
  'OWNER_ACCESS_RESET_ALREADY_REQUESTED',
]);

if (gitBlobSha1(runner) !== ownerRunnerBlob) fail('owner runner blob mismatch');
requireAll('owner runner', runner, [
  `COMMAND='${command}'`,
  "DEFAULT_HOST='195.19.12.120'",
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "RELEASE_ISSUE_NUMBER='3072'",
  'StrictHostKeyChecking=yes',
  'UserKnownHostsFile="$known_hosts"',
  "to_regprocedure('auth.staff_owner_access_password_reset_subject()')",
  'auth.staff_owner_access_password_reset_subject() AS reviewer_email',
  "counts.join('|') !== '1|1|1|1|1|1|0|0'",
  "printf 'pc-owner-access-reset-v1:%s' \"$target_sha\" | sha256sum",
  "WHERE message_kind = 'PASSWORD_RESET'",
  'OWNER_ACCESS_RESET_ALREADY_REQUESTED',
  "mutation_state='NORMAL_RESET_REQUEST_POSSIBLE_UNPROVEN'",
  "mutation_state='NORMAL_PASSWORD_RESET_REQUEST_ONLY'",
  'PRODUCTION_MUTATION=%s',
  'API / Web / auth-mail worker revision parity',
  '[[ "$api_revision" == "$target_sha" && "$web_revision" == "$target_sha" && "$worker_revision" == "$target_sha" ]]',
  '[[ "$api_revision" == "$TARGET_SHA" && "$web_revision" == "$TARGET_SHA" && "$worker_revision" == "$TARGET_SHA" ]]',
  'printf \'{"email":"%s","locale":"ru"}\' "$reviewer_email" > "$request_body"',
  'P0_OWNER_ACCESS_PASSWORD_RESET_REQUEST=PASS',
]);
requireCount('owner runner', runner, 'auth.staff_owner_access_password_reset_subject()', 2);
requireCount('owner runner', runner, '--data-binary "@$request_body"', 1);
requireCount('owner runner', runner, '$live_base/api/auth/forgot-password', 1);
rejectAll('owner runner', runner, [
  'python3',
  'text.replace(',
  'scripts/production-p0-reviewer-password-reset-request.sh',
  'NONE_OR_NORMAL_RESET_REQUEST_ONLY',
  'StrictHostKeyChecking=no',
  'UserKnownHostsFile=/dev/null',
  'PC_P0_REVIEWER_EMAIL',
  'PC_P0_REVIEWER_PASSWORD',
  'PC_P0_REVIEWER_TOTP',
  'decryptAuthMailEnvelope',
  'payload_ciphertext',
  'passwordHash =',
  'mfa_secret_ciphertext =',
  'UPDATE public."users"',
  'INSERT INTO public."users"',
  'DELETE FROM public."users"',
  'docker restart',
  'docker rm',
  'docker compose up',
]);
if (/gh issue comment[\s\S]{0,1600}\$reviewer_email/.test(runner)) {
  fail('owner email can reach issue comments');
}

requireAll('migration', migration, [
  'CREATE OR REPLACE FUNCTION auth.staff_owner_access_password_reset_subject()',
  'RETURNS text',
  'SECURITY DEFINER',
  'STABLE',
  'SET search_path = pg_catalog, pg_temp',
  'SET row_security = on',
  'FROM auth.staff_reviewer_preflight() preflight',
  'CROSS JOIN auth.staff_reviewer_login_readiness() readiness',
  'v_active_owner_count <> 1',
  'v_usable_reviewer_count <> 1',
  'v_assignment_ready_count <> 1',
  'v_active_identity_ready_count <> 1',
  'v_membership_ready_count <> 1',
  'v_password_ready_count <> 1',
  'v_mfa_enrolled_ready_count <> 0',
  'v_login_ready_count <> 0',
  "assignment.role = 'PLATFORM_OWNER'",
  "subject.\"passwordHash\" ~ '^\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}$'",
  'subject."mfaEnabled" = false',
  'credential.credential_version > 0',
  'credential.locked_until IS NULL OR credential.locked_until <= now()',
  'credential.mfa_enabled = false',
  'credential.mfa_secret_ciphertext IS NULL',
  'credential.mfa_key_version IS NULL',
  "membership.\"id\" = 'membership_pc_reviewer_internal_v1'",
  "membership.\"organizationId\" = 'org_pc_internal_platform_v1'",
  "organization.\"status\" = 'VERIFIED'",
  "USING ERRCODE = '23514'",
  'ALTER FUNCTION auth.staff_owner_access_password_reset_subject() OWNER TO pc_staff_authority',
  'REVOKE ALL ON FUNCTION auth.staff_owner_access_password_reset_subject() FROM PUBLIC',
  'GRANT EXECUTE ON FUNCTION auth.staff_owner_access_password_reset_subject() TO pc_staff_runtime',
  "REVOKE ALL ON FUNCTION auth.staff_owner_access_password_reset_subject() FROM %I",
  "function.proconfig @> ARRAY['search_path=pg_catalog, pg_temp']::text[]",
  "function.proconfig @> ARRAY['row_security=on']::text[]",
  'pc_staff_runtime must remain table-free',
  'pc_staff_authority must remain read-only',
]);
requireCount('migration marker clear', migration, "'app.staff_reviewer_password_reset_scope',\n    '',\n    true", 2);
rejectAll('migration', migration, [
  'CREATE OR REPLACE FUNCTION auth.staff_reviewer_password_reset_subject()',
  'SET row_security = off',
  'UPDATE public."users"',
  'INSERT INTO public."users"',
  'DELETE FROM public."users"',
  'UPDATE auth.credential_states',
  'INSERT INTO auth.credential_states',
  'DELETE FROM auth.credential_states',
]);

requireAll('workflow', workflow, [
  'pull_request:',
  'issue_comment:',
  'types: [created]',
  'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  "github.event.comment.author_association == 'OWNER'",
  'github.event.comment.performed_via_github_app.id == 1144995',
  `github.event.comment.body == '${command}'`,
  'persist-credentials: false',
  'fetch-depth: 0',
  `[[ "$(git hash-object "$owner_script")" == '${ownerRunnerBlob}' ]]`,
  'node scripts/check-production-owner-access-reset-current-main.mjs',
  'bash -n "$owner_script"',
  'bash "$owner_script"',
  'git rev-parse origin/main',
  'repos/$GITHUB_REPOSITORY/commits/main',
  'cancel-in-progress: false',
]);
rejectAll('workflow', workflow, [
  'workflow_dispatch:',
  'schedule:',
  'pull_request_target:',
  'push:',
  'python3',
  'RUNNER_TEMP/owner-access-reset.sh',
  'text.replace(',
  'PC_P0_REVIEWER_EMAIL',
  'PC_P0_REVIEWER_PASSWORD',
  'PC_P0_REVIEWER_TOTP',
  'StrictHostKeyChecking=no',
  'UserKnownHostsFile=/dev/null',
]);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('scope schema mismatch');
if (scope.branch !== branch || scope.status !== 'active') fail('scope branch/status mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) fail('scope issue authority mismatch');
if (scope.authorityBaseExactMain !== authorityBase) fail('scope authority base mismatch');
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) {
  fail('scope hosting/cost boundary mismatch');
}
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowedPaths].sort())) {
  fail('scope allowedPaths mismatch');
}
const boundary = scope.boundaries || {};
for (const key of [
  'registrationOnly', 'reviewerOwnerAccessOnly', 'ownerOrTrustedConnectorTriggerOnly',
  'exactMainGuard', 'exactRuntimeParity',
]) {
  if (boundary[key] !== true) fail(`scope boundary must be true: ${key}`);
}
for (const key of [
  'pullRequestProductionMutation', 'directPasswordWrite', 'directMfaWrite',
  'roleOrTenantMutation', 'reviewerIdentityOutput', 'credentialOutput',
  'authMailPayloadDecryption', 'sshHostKeyBypass', 'dnsMutation', 'deploymentMutation',
]) {
  if (boundary[key] !== false) fail(`scope boundary must be false: ${key}`);
}
if (boundary.newRecurringCostRub !== 0) fail('scope recurring cost must be zero');

console.log('production owner-access reset current-main contract PASS');
