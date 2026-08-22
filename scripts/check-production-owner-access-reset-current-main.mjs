#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-owner-access-reset-current-main.yml';
const runnerPath = 'scripts/production-owner-access-reset-current-main.sh';
const migrationPath = 'apps/api/prisma/migrations/20260822111500_p0_owner_access_password_reset_subject/migration.sql';
const scopePath = 'docs/platform-v7/autopilot/scopes/owner-access-password-ready-3785.json';
const genericRunnerPath = 'scripts/production-p0-reviewer-password-reset-request.sh';
const drRehearsalPath = 'scripts/platform-v7-database-dr-rehearsal.sh';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const genericRunner = fs.readFileSync(genericRunnerPath, 'utf8');
const drRehearsal = fs.readFileSync(drRehearsalPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const command = '/production owner-access-reset current-main';
const branch = 'fix/owner-access-password-ready-3785';
const authorityBase = '1df1e55d4596c0bfe1ffa957f4d821bdcb26b5cb';
const ownerRunnerBlob = 'dc935137db10c2ce36081a3af6275a743cbb42da';
const genericRunnerBlob = '7a586ded1b40ab3812335b351d0e8cc519020aa4';
const allowedPaths = [workflowPath, migrationPath, scopePath, 'scripts/check-production-owner-access-reset-current-main.mjs', drRehearsalPath, runnerPath];

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
if (!runner.startsWith('#!/usr/bin/env bash\nset -euo pipefail\n')) {
  fail('owner runner must not inherit ERR traps into command substitutions');
}
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
  'correlation_id="$(cat /proc/sys/kernel/random/uuid)"',
  "--noproxy '*'",
  '--resolve "$live_domain:443:$live_ip"',
  "WHERE message_kind = 'PASSWORD_RESET'",
  "mutation_state='NORMAL_RESET_REQUEST_POSSIBLE_UNPROVEN'",
  "mutation_state='NORMAL_PASSWORD_RESET_REQUEST_ONLY'",
  "production_mutation='NORMAL_RESET_REQUEST_POSSIBLE_UNPROVEN'",
  "production_mutation='NORMAL_PASSWORD_RESET_REQUEST_ONLY'",
  'PRODUCTION_MUTATION=%s',
  'local rc="${1:-$prior_rc}"',
  'trap - ERR',
  'set +e',
  'remote_rc=$?',
  'publish_failure "$remote_rc"',
  'guard_runtime_unchanged()',
  '[[ "${current_web_ids[0]}" == "$web_id" ]]',
  '[[ "${current_api_ids[0]}" == "$api_id" ]]',
  '[[ "${current_worker_ids[0]}" == "$worker_id" ]]',
  "const authDatabaseUrl = String(process.env.AUTH_DATABASE_URL || '').trim();",
  "const authTokenPepper = String(process.env.AUTH_TOKEN_PEPPER || '').trim();",
  "principal.user_name !== 'pc_auth_runtime'",
  "has_table_privilege(current_user, 'auth.login_throttles', 'SELECT')",
  'SET TRANSACTION READ ONLY',
  'FROM auth.login_throttles',
  'WHERE account_hash = $1',
  ".update(`account:${email}`, 'utf8')",
  "fail('P0_LOGIN_THROTTLE_ACTIVE')",
  'SUBJECT|${email}|THROTTLE|UNLOCKED',
  "const code = /^P0_[A-Z0-9_]{4,92}$/.test(raw) ? raw : 'P0_REVIEWER_RESET_DB_FAILURE';",
  "process.stderr.write('AUTH_MAIL_OUTBOX_PROBE_FAILED\\n')",
  'API / Web / auth-mail worker revision parity',
  '[[ "$api_revision" == "$target_sha" && "$web_revision" == "$target_sha" && "$worker_revision" == "$target_sha" ]]',
  '[[ "$api_revision" == "$TARGET_SHA" && "$web_revision" == "$TARGET_SHA" && "$worker_revision" == "$TARGET_SHA" ]]',
  'printf \'{"email":"%s","locale":"ru"}\' "$reviewer_email" > "$request_body"',
  'P0_OWNER_ACCESS_PASSWORD_RESET_REQUEST=PASS',
]);
requireCount('owner runner', runner, 'auth.staff_owner_access_password_reset_subject()', 2);
requireCount('owner runner', runner, 'cat /proc/sys/kernel/random/uuid', 1);
requireCount('owner runner', runner, 'curl --disable', 2);
requireCount('owner runner', runner, "--noproxy '*'", 2);
requireCount('owner runner', runner, '--resolve "$live_domain:443:$live_ip"', 2);
requireCount('owner runner', runner, 'guard_runtime_unchanged', 3);
requireCount('owner runner', runner, "printf 'PRODUCTION_MUTATION=%s\\n'", 3);
requireCount('owner runner', runner, 'FROM auth.login_throttles', 1);
requireCount('owner runner', runner, 'WHERE account_hash = $1', 1);
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
  'pc-owner-access-reset-v1:',
  'OWNER_ACCESS_RESET_ALREADY_REQUESTED',
  'existing_marker=',
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
  'UPDATE auth.login_throttles',
  'INSERT INTO auth.login_throttles',
  'DELETE FROM auth.login_throttles',
]);
if (/gh issue comment[\s\S]{0,1600}\$reviewer_email/.test(runner)) {
  fail('owner email can reach issue comments');
}
if (/process\.(?:stdout|stderr)\.write\([^\n]*(?:accountHash|authTokenPepper)/.test(runner)) {
  fail('auth account hash or pepper can reach remote output');
}
const durableFailureBranch = runner.indexOf('if [[ "$outbox_status" != \'SENT\' || "$outbox_sent" != \'1\' ]]');
const durableFailureComment = runner.indexOf('gh issue comment "$RELEASE_ISSUE_NUMBER"', durableFailureBranch);
const durableFailurePublished = runner.indexOf('result_published=1', durableFailureComment);
const durableFailureExit = runner.indexOf('exit 1', durableFailurePublished);
if (!(durableFailureBranch >= 0 && durableFailureComment > durableFailureBranch
      && durableFailurePublished > durableFailureComment && durableFailureExit > durableFailurePublished)) {
  fail('durable failure evidence must publish before suppressing fallback publication');
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
  'subject."mfaSecret" IS NULL',
  'subject."mfaBackup" IS NULL',
  'credential.credential_version > 0',
  'credential.locked_until IS NULL OR credential.locked_until <= now()',
  'credential.mfa_enabled = false',
  'credential.mfa_secret_ciphertext IS NULL',
  'credential.mfa_key_version IS NULL',
  'credential.mfa_backup_hashes IS NULL',
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
  "function.prosrc !~* '\\m(INSERT|UPDATE|DELETE|TRUNCATE|MERGE|CALL|EXECUTE)\\M'",
  "pg_catalog.set_config('app.staff_admission_scope', '', true)",
  "pg_catalog.set_config('app.staff_admission_decision', '', true)",
  'pc_staff_runtime must remain table-free',
  "has_any_column_privilege('pc_staff_runtime', table_name, 'UPDATE')",
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
  'UPDATE auth.login_throttles',
  'INSERT INTO auth.login_throttles',
  'DELETE FROM auth.login_throttles',
]);
const ownerFunction = migration.match(
  /CREATE OR REPLACE FUNCTION auth\.staff_owner_access_password_reset_subject\(\)[\s\S]*?AS \$function\$\n([\s\S]*?)\n\$function\$;/,
);
if (!ownerFunction) fail('owner subject body is not statically extractable');
if (/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|MERGE|CALL|EXECUTE)\b/i.test(ownerFunction[1])) {
  fail('owner subject body contains a write or dynamic execution statement');
}

requireAll('DR rehearsal', drRehearsal, [
  "'auth.staff_owner_access_password_reset_subject()'",
  'GRANT EXECUTE ON FUNCTION auth.staff_owner_access_password_reset_subject() TO pc_staff_runtime;',
  'REVOKE ALL ON FUNCTION auth.staff_owner_access_password_reset_subject() FROM one_deal_staff;',
  'RESTORE_OWNER_ACCESS_SUBJECT_PROOF=',
  "owner.rolname = 'pc_staff_authority'",
  "function.prosrc !~* '\\m(INSERT|UPDATE|DELETE|TRUNCATE|MERGE|CALL|EXECUTE)\\M'",
  "has_function_privilege(\n    'pc_staff_runtime',\n    'auth.staff_owner_access_password_reset_subject()',\n    'EXECUTE'",
  'restored owner-access subject proof bounded-definer:staff-runtime-execute:other-runtime-deny',
  '[[ "$RESTORE_OWNER_ACCESS_SUBJECT_PROOF" != "1:1:1" ]]',
]);
if (/GRANT EXECUTE ON FUNCTION auth\.staff_owner_access_password_reset_subject\(\) TO one_deal_/.test(drRehearsal)) {
  fail('DR rehearsal grants owner subject to an isolated non-production runtime');
}

requireAll('workflow', workflow, [
  'pull_request:',
  'issue_comment:',
  'types: [created]',
  'github.event.issue.number == 3072',
  "github.event.action == 'created'",
  'github.run_attempt == 1',
  'github.event.comment.user.login == github.repository_owner',
  "github.event.comment.author_association == 'OWNER'",
  'github.event.comment.performed_via_github_app.id == 1144995',
  `github.event.comment.body == '${command}'`,
  'persist-credentials: false',
  'fetch-depth: 0',
  `[[ "$(git hash-object "$owner_script")" == '${ownerRunnerBlob}' ]]`,
  `'${drRehearsalPath}'`,
  'node scripts/check-production-owner-access-reset-current-main.mjs',
  'bash -n "$owner_script"',
  'bash "$owner_script"',
  'git rev-parse origin/main',
  'repos/$GITHUB_REPOSITORY/commits/main',
  '[[ "$GITHUB_EVENT_NAME" == \'issue_comment\' ]]',
  '[[ "$GITHUB_RUN_ATTEMPT" == \'1\' ]]',
  'jq -e \'.action == "created"\' "$GITHUB_EVENT_PATH"',
  'gh api --paginate --slurp',
  'issues/3072/comments?per_page=100',
  '[[ "$command_ids" == "$COMMENT_ID" ]]',
  'cancel-in-progress: false',
]);
requireCount('workflow', workflow, 'github.run_attempt == 1', 2);
requireCount('workflow', workflow, 'gh api --paginate --slurp', 1);
requireCount('workflow', workflow, '[[ "$command_ids" == "$COMMENT_ID" ]]', 1);
const provenanceStep = workflow.indexOf('- name: Verify owner command provenance and exact main');
const executeStep = workflow.indexOf('- name: Execute static password-ready owner-access flow');
const firstProductionSecret = workflow.indexOf('PC_PROD_SSH_KEY: ${{ secrets.PC_PROD_SSH_KEY }}');
if (!(provenanceStep >= 0 && executeStep > provenanceStep && firstProductionSecret > executeStep)) {
  fail('production secrets must be injected only after command provenance passes');
}
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
  'exactMainGuard', 'exactRuntimeParity', 'runtimeIdentityStable', 'singleAttemptNoRerun',
  'singleAuthorizedCommandComment', 'pinnedHttpsEndpoint',
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
