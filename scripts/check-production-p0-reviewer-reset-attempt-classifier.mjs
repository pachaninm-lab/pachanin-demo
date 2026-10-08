#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-attempt-classifier.yml';
const runnerPath = 'scripts/production-p0-reviewer-reset-attempt-classifier.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-attempt-classifier.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-attempt-classifier-3785.json';
const autopilotPath = 'docs/platform-v7/autopilot/autopilot-state.json';
const branch = 'diag/p0-reviewer-reset-attempt-classifier-3785';
const command = '/production p0-reviewer-reset-attempt-classify 31706325376 current-main';
const authHashRuntimeCommand = '/production p0-auth-hash-runtime-classify current-main';
const authHashImpactCommand = '/production p0-auth-hash-impact-classify current-main';
const sourceRun = 31706325376;
const sourceRevision = '7c768ad7c54523837b06999a8f69bdffe2a840db';
const attemptSince = '2026-08-13T13:43:10Z';
const attemptUntil = '2026-08-13T13:43:26Z';
const allowedPaths = [workflowPath, runnerPath, checkerPath, scopePath];

const read = (path) => fs.readFileSync(path, 'utf8');
const files = {
  workflow: read(workflowPath),
  runner: read(runnerPath),
  checker: read(checkerPath),
  scope: read(scopePath),
  autopilot: read(autopilotPath),
};
const failures = [];

const requireToken = (name, token) => {
  if (!files[name].includes(token)) failures.push(`${name}: missing ${JSON.stringify(token)}`);
};
const forbid = (name, pattern) => {
  if (pattern.test(files[name])) failures.push(`${name}: forbidden ${pattern}`);
};
const sameStringSet = (actual, expected) => (
  Array.isArray(actual)
  && actual.every((value) => typeof value === 'string')
  && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
);

for (const path of allowedPaths) requireToken('workflow', `      - '${path}'`);
for (const token of [
  'name: Production P0 Reviewer Reset and Auth-Hash Safety Classifier',
  'pull_request:',
  'issue_comment:',
  'permissions:\n  contents: read',
  "github.event.issue.number == 3072",
  'github.event.comment.user.login == github.repository_owner',
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  `github.event.comment.body == '${command}'`,
  `github.event.comment.body == '${authHashRuntimeCommand}'`,
  `github.event.comment.body == '${authHashImpactCommand}'`,
  "github.event_name == 'pull_request'",
  'needs.contract.result == \'success\'',
  'persist-credentials: false',
  'fetch-depth: 0',
  `node ${checkerPath}`,
  `bash -n ${runnerPath}`,
  `bash ${runnerPath}`,
  'PC_REVIEWER_RESET_ATTEMPT_COMMAND: ${{ github.event.comment.body }}',
  'PC_PROD_SSH_HOST_FINGERPRINT: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}',
  'issues: write',
]) requireToken('workflow', token);

const commandOccurrences = files.workflow.split(command).length - 1;
if (commandOccurrences !== 2) failures.push(`workflow: expected command twice, found ${commandOccurrences}`);
const authHashRuntimeCommandOccurrences = files.workflow.split(authHashRuntimeCommand).length - 1;
if (authHashRuntimeCommandOccurrences !== 2) {
  failures.push(`workflow: expected auth-hash runtime command twice, found ${authHashRuntimeCommandOccurrences}`);
}
const authHashImpactCommandOccurrences = files.workflow.split(authHashImpactCommand).length - 1;
if (authHashImpactCommandOccurrences !== 2) {
  failures.push(`workflow: expected auth-hash impact command twice, found ${authHashImpactCommandOccurrences}`);
}
const secretNames = [...files.workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]);
const allowedSecrets = [
  'PC_PROD_HOST',
  'PC_PROD_SSH_USER',
  'PC_PROD_SSH_PORT',
  'PC_PROD_SSH_KEY',
  'PC_PROD_SSH_PRIVATE_KEY',
  'VPS_SSH_KEY',
  'PC_PROD_SSH_HOST_FINGERPRINT',
];
if (!sameStringSet([...new Set(secretNames)], allowedSecrets)) failures.push('workflow: protected secret allowlist mismatch');
for (const pattern of [
  /workflow_dispatch:/,
  /schedule:/,
  /\bpush:/,
  /actions\/upload-artifact/,
  /PC_P0_REVIEWER_(?:EMAIL|PASSWORD|TOTP)/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
]) forbid('workflow', pattern);

for (const token of [
  "DEFAULT_HOST='195.19.12.120'",
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "RELEASE_ISSUE_NUMBER='3072'",
  `ATTEMPT_COMMAND='${command}'`,
  `AUTH_HASH_RUNTIME_COMMAND='${authHashRuntimeCommand}'`,
  `AUTH_HASH_IMPACT_COMMAND='${authHashImpactCommand}'`,
  `SOURCE_RUN_ID='${sourceRun}'`,
  `ATTEMPT_SINCE='${attemptSince}'`,
  `ATTEMPT_UNTIL='${attemptUntil}'`,
  `SOURCE_REVISION='${sourceRevision}'`,
  "classifier_mode='RESET_ATTEMPT'",
  "classifier_mode='AUTH_HASH_RUNTIME'",
  "classifier_mode='AUTH_HASH_IMPACT'",
  '[[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]',
  'git merge-base --is-ancestor "$SOURCE_REVISION" "$TARGET_SHA"',
  'git merge-base --is-ancestor "$active_revision" "$TARGET_SHA"',
  '[[ -z "$(git status --porcelain=v1)" ]]',
  'for attempt in 1 2 3; do',
  '/usr/bin/ssh-keyscan -T 10 -p "$port" "$host"',
  'StrictHostKeyChecking=yes',
  'UserKnownHostsFile="$known_hosts"',
  "if [[ \"$classifier_mode\" == 'AUTH_HASH_RUNTIME' ]]; then",
  "stage='REMOTE_AUTH_HASH_RUNTIME_CLASSIFICATION'",
  "SOURCE_REVISION = sys.argv[1]",
  "SAFE_SECRET = re.compile(r'^[A-Za-z0-9._~+/=-]{32,512}$')",
  "'docker', 'compose', '--project-directory'",
  "command.extend(['config', '--format', 'json'])",
  "'com.docker.compose.project.config_files'",
  "'com.docker.compose.project.working_dir'",
  "'AUTH_TOKEN_PEPPER'",
  "'AUTH_HASH_SECRET'",
  "entry.name.startswith('.env.')",
  "re.search(r'(^|[._-])auth([._-]|$)', entry.name, re.IGNORECASE)",
  "purpose_names = ('AUTH_OPAQUE_TOKEN_DIGEST_KEY', 'JWT_SECRET', 'MFA_ENCRYPTION_KEY')",
  "recovery_class = 'REUSE_AUTH_TOKEN_PEPPER'",
  "recovery_class = 'MIGRATE_LEGACY_AUTH_HASH_SECRET'",
  "recovery_class = 'REPROJECT_COMPOSE_AUTHORITY'",
  "recovery_class = 'NO_EXISTING_AUTHORITY'",
  "recovery_class = 'PURPOSE_CONFLICT'",
  "recovery_class = 'AMBIGUOUS_OR_UNSAFE'",
  "'AUTH_HASH_RUNTIME'",
  "'ACTIVE_RUNTIME_DRIFT'",
  "protected AUTH_TOKEN_PEPPER file cardinality:",
  "protected legacy AUTH_HASH_SECRET file cardinality:",
  "candidate purpose separation from opaque/JWT/MFA keys:",
  "protected value / file path / hash / length exposure: \\`NONE\\`",
  "raw Docker / Compose / filesystem output: \\`NOT_PUBLISHED\\`",
  "if [[ \"$classifier_mode\" == 'AUTH_HASH_IMPACT' ]]; then",
  "docker exec -i \"$api_id\" /nodejs/bin/node --input-type=commonjs - \"$classifier_mode\" \"$attempt_since\" \"$attempt_until\" <<'NODE'",
  "const [classifierMode, attemptSince, attemptUntil] = process.argv.slice(2)",
  "default_transaction_read_only=on",
  "current_setting('transaction_read_only') = 'on'",
  "has_table_privilege(current_user, 'auth.login_throttles', 'SELECT')",
  "has_table_privilege(current_user, 'auth.registration_applications', 'SELECT')",
  "has_table_privilege(current_user, 'auth.registration_public_attempts', 'SELECT')",
  "has_table_privilege(current_user, 'auth.organization_invitations', 'SELECT')",
  "has_table_privilege(current_user, 'auth.organization_membership_command_events', 'SELECT')",
  "has_table_privilege(current_user, 'auth.mfa_recovery_challenges', 'SELECT')",
  "EXISTS (SELECT 1 FROM auth.login_throttles) AS login_rows",
  "failures > 0 OR locked_until > now()",
  "EXISTS (SELECT 1 FROM auth.registration_applications) AS registration_rows",
  "status NOT IN ('REJECTED', 'ACTIVATED', 'EXPIRED', 'CANCELLED')",
  "EXISTS (SELECT 1 FROM auth.registration_public_attempts) AS registration_attempt_rows",
  "EXISTS (SELECT 1 FROM auth.organization_invitations) AS invitation_rows",
  "EXISTS (SELECT 1 FROM auth.organization_membership_command_events) AS membership_event_rows",
  "EXISTS (SELECT 1 FROM auth.mfa_recovery_challenges) AS mfa_recovery_rows",
  "compatibilityClass = 'RUNTIME_AUTHORITY_STATE_CHANGED'",
  "compatibilityClass = 'LIVE_GENERIC_HASH_STATE_PRESENT'",
  "compatibilityClass = 'HISTORICAL_GENERIC_HASH_STATE_PRESENT'",
  "SAFE_EMPTY_PERSISTED_GENERIC_HASH_STATE",
  "AUTH_TRANSACTION|READ_ONLY",
  "AUTH_HASH_IMPACT_DB",
  "bounded auth-key provisioning gate:",
  "database row / identity / hash / count exposure: \\`NONE\\`",
  "session, client-IP and audit hashes are not validation authority: \\`EXCLUDED_FROM_COMPATIBILITY_GATE\\`",
  "docker ps -q --filter 'label=com.docker.compose.service=web'",
  'docker ps -aq',
  'project_web_output="$(docker ps -aq',
  'mapfile -t project_web_ids <<< "$project_web_output"',
  "--filter 'label=com.docker.compose.service=api'",
  'org.opencontainers.image.revision',
  '[[ "$web_revision" == "$api_revision" ]]',
  "printf 'ACTIVE_REVISION|%s\\n' \"$active_revision\"",
  'source_revision="$1"',
  'historical_web_ids',
  'candidate_started_at="$(docker inspect --format \'{{ .State.StartedAt }}\' "$candidate_id")"',
  'candidate_finished_at="$(docker inspect --format \'{{ .State.FinishedAt }}\' "$candidate_id")"',
  '[[ "$candidate_started_at" == 0001-01-01T00:00:00* ]]',
  'candidate_started_epoch <= attempt_until_epoch',
  'candidate_finished_epoch >= attempt_since_epoch',
  "remote_source_cardinality='ZERO'",
  "remote_source_cardinality='ONE'",
  "remote_source_cardinality='MULTIPLE'",
  'ATTEMPT_REMOTE_FAILURE|%s|%s|%s|%s',
  "log_source='HISTORICAL_CONTAINER'",
  "log_source='UNAVAILABLE_AFTER_EXACT_RELEASE'",
  'historical_web_id="${historical_web_ids[0]}"',
  'process.env.STAFF_DATABASE_URL',
  'process.env.AUTH_DATABASE_URL',
  'process.env.DATABASE_URL',
  "current_user = 'pc_staff_runtime'",
  "NOT has_table_privilege(current_user, 'public.users', 'SELECT')",
  "NOT has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT')",
  'auth.staff_reviewer_preflight()',
  'auth.staff_reviewer_login_readiness()',
  'auth.staff_reviewer_password_reset_subject()',
  "readiness.join('|') !== '1|1|1|1|1|0|0|0'",
  "has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT')",
  "has_table_privilege(current_user, 'auth.audit_events', 'SELECT')",
  'auth.resolve_password_reset_subject($1)',
  'process.env.AUTH_TOKEN_PEPPER',
  "metadata->>'accountHash' = $4",
  'RESET_ATTEMPT_BINDING',
  'db_output="$(',
  'FROM auth.password_reset_challenges',
  'FROM auth.audit_events',
  "user_id = $1 AND reason = 'CHALLENGE_ISSUED'",
  "user_id = $1 AND reason = 'COOLDOWN_ACTIVE'",
  "reason = 'DELIVERY_BOUNDARY_REJECTED'",
  "reason = 'UNIVERSAL_NON_ELIGIBLE'",
  "'ATTEMPT_EVIDENCE_AMBIGUOUS'",
  'issued + cooldown + boundary + noneligible + other > 1',
  "action = 'auth.password_reset.request'",
  'created_at >= $2::timestamptz',
  'created_at <= $3::timestamptz',
  "status = 'PENDING' AND expires_at > now()",
  'RESET_ATTEMPT_DB',
  "grep -F 'password_reset_delivery_result'",
  "grep -F 'password_reset_request_accepted_without_delivery'",
  "grep -F 'password_reset_request_api_failure'",
  "grep -F 'password_reset_request_transport_failure'",
  "grep -F 'password_reset_request_configuration_error'",
  'docker logs --since "$attempt_since" --until "$attempt_until" "$historical_web_id"',
  'web_logs="$(docker logs --since "$attempt_since" --until "$attempt_until" "$historical_web_id" 2>&1)"',
  '[[ "$(docker inspect --format \'{{ index .Config.Labels "org.opencontainers.image.revision" }}\' "$historical_web_id")" == "$source_revision" ]]',
  "remote_substage='TERMINAL_LOG_READ'",
  "remote_substage='TERMINAL_LOG_UNAVAILABLE'",
  "remote_substage='TERMINAL_LOG_BINDING'",
  "remote_substage='UNBOUND_CONFIGURATION_EVENT'",
  '\\"accountHash\\":\\"$reviewer_web_hash\\"',
  'reviewer_correlation',
  'unset bound_line reviewer_correlation',
  "reason_class='SMTP_AUTH_REJECTED'",
  "reason_class='SMTP_RECIPIENT_OR_POLICY'",
  "reason_class='SMTP_TEMPORARY'",
  "reason_class='SMTP_TIMEOUT'",
  "reason_class='SMTP_DNS_FAILURE'",
  "reason_class='SMTP_CONNECTION_REFUSED'",
  "reason_class='SMTP_TLS_FAILURE'",
  "reason_class='RESEND_AUTH_REJECTED'",
  "reason_class='RESEND_RATE_LIMIT'",
  "reason_class='RESEND_UPSTREAM'",
  "reason_class='MAIL_CHANNEL_NOT_CONFIGURED'",
  "configuration_class='API_MISSING'",
  "configuration_class='DELIVERY_BOUNDARY_MISSING'",
  "configuration_class='MAIL_MISSING'",
  "configuration_class='MULTIPLE_MISSING'",
  "attempt_class='WEB_CONFIGURATION_REJECTED'",
  "attempt_class='DELIVERY_EVENT_WITHOUT_DURABLE_MATCH'",
  "attempt_class='DELIVERY_BOUNDARY_REJECTED'",
  "attempt_class='COOLDOWN_ACTIVE_NO_NEW_DELIVERY'",
  "attempt_class='BEFORE_POST_OR_NO_DURABLE_EFFECT'",
  "attempt_class='DURABLE_CHALLENGE_CREATED_LOG_UNAVAILABLE'",
  "attempt_class='DURABLE_COOLDOWN_ACTIVE_LOG_UNAVAILABLE'",
  "attempt_class='DURABLE_DELIVERY_BOUNDARY_REJECTED_LOG_UNAVAILABLE'",
  "attempt_class='DURABLE_REVIEWER_NON_ELIGIBLE_LOG_UNAVAILABLE'",
  "attempt_class='DURABLE_OTHER_AUDIT_LOG_UNAVAILABLE'",
  "attempt_class='NO_DURABLE_RESET_EFFECT_LOG_UNAVAILABLE'",
  "terminal_count='NA'",
  "delivered_class='UNAVAILABLE'",
  "'NA|NA|NA|NA|NA|NA'",
  "'UNAVAILABLE|UNAVAILABLE|UNAVAILABLE|UNAVAILABLE|UNAVAILABLE|UNAVAILABLE'",
  'web_ids_after',
  'api_ids_after',
  '[[ "${web_ids_after[0]}" == "$active_web_id" && "${api_ids_after[0]}" == "$api_id" ]]',
  '[[ "$(docker inspect --format \'{{ index .Config.Labels "org.opencontainers.image.revision" }}\' "$active_web_id")" == "$active_revision" ]]',
  'RESET_ATTEMPT_LOG|PASS',
  'RESET_REPLAY|NONE',
  'MAIL_SENT_BY_CLASSIFIER|NO',
  'PRODUCTION_MUTATION|NONE',
  'historical Web log source:',
  'Web cardinalities classify historical events only:',
  'active production API/Web revision:',
  'fresh reset challenge slot clear:',
  'reset authorized now: \\`NO_CURRENT_MAIL_PATH_AND_SMTP_IMAP_NOT_REPROVEN\\`',
  'configuration-error event cardinality:',
  'configuration class:',
  'reviewer identity / account hash / correlation id exposure: \\\`NONE\\\`',
  'reset token / hash / user-id output: \\\`NONE\\\`',
  'raw database/runtime output: \\\`NOT_PUBLISHED\\\`',
  'new recurring cost: \\\`0 RUB\\\`',
]) requireToken('runner', token);

for (const pattern of [
  /set\s+-[^\n]*x/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
  /sshpass/i,
  /docker\s+(?:compose|restart|stop|kill|rm|rmi|update|run|start|create)\b/,
  /\bpsql\b/,
  /\b(?:curl|wget)\b/,
  /\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_".]+\s+SET|DELETE\s+FROM|ALTER\s+(?:TABLE|SCHEMA|ROLE|DATABASE|FUNCTION)|CREATE\s+(?:TABLE|SCHEMA|ROLE|DATABASE|FUNCTION)|DROP\s+(?:TABLE|SCHEMA|ROLE|DATABASE|FUNCTION)|TRUNCATE\s+|GRANT\s+|REVOKE\s+|SET\s+ROLE\b)/i,
  /\$executeRaw(?:Unsafe)?\b/,
  /source\s+[^\n]*\.env/,
  /\bprintenv\b/,
  /\/proc\/(?:[0-9]+|\$[^/]+)\/environ/,
  /PC_P0_REVIEWER_(?:EMAIL|PASSWORD|TOTP)/,
  /EXPECTED_DEPLOYED_SHA/,
  /process\.stdout\.write\([^\n]*(?:reviewer_email|email|token_hash|userId|user_id|accountHash|correlationId)/i,
  /printf[^\n]*(?:binding_marker|reviewer_web_hash|reviewer_api_hash|reviewer_correlation|bound_line|web_logs|db_output)/,
  /gh issue comment[\s\S]{0,1600}(?:\$email|\$userId|\$reviewer_email|\$output|\$reason\b|\$delivery_line)/,
  /gh issue comment[\s\S]{0,1600}(?:\$reviewer_web_hash|\$reviewer_api_hash|\$reviewer_correlation|\$binding_marker|\$db_output|\$web_logs)/,
  /gh issue comment[\s\S]{0,1600}(?:\$historical_web_id|\$candidate_id|\$project_web_ids|\$historical_web_ids)/,
  /docker logs[^\n]*(?:--tail\s+all|--follow|-f\b)/,
  /docker logs[\s\S]{0,160}\|\| true/,
  /candidate_revision=[^\n]*\|\| true/,
]) forbid('runner', pattern);

const dockerExecCount = (files.runner.match(/docker exec\b/g) ?? []).length;
if (dockerExecCount !== 1) failures.push(`runner: expected exactly one read-only docker exec, found ${dockerExecCount}`);
const dockerLogsCount = (files.runner.match(/docker logs\b/g) ?? []).length;
if (dockerLogsCount !== 1) failures.push(`runner: production logs must be captured exactly once, found ${dockerLogsCount} reads`);
const historicalGateIndex = files.runner.indexOf('if [[ "$log_source" == \'HISTORICAL_CONTAINER\' ]]; then');
const dockerLogsIndex = files.runner.indexOf('docker logs --since "$attempt_since" --until "$attempt_until" "$historical_web_id"');
const unavailableIndex = files.runner.indexOf("remote_substage='TERMINAL_LOG_UNAVAILABLE'");
if (historicalGateIndex < 0 || dockerLogsIndex <= historicalGateIndex || unavailableIndex <= dockerLogsIndex) {
  failures.push('runner: historical log read is not confined to the explicit historical-source branch');
}
if (/mapfile[^\n]*<\s*<\(docker ps -aq/.test(files.runner)) {
  failures.push('runner: historical container discovery must not hide docker ps failure in process substitution');
}
const zeroStartIndex = files.runner.indexOf('[[ "$candidate_started_at" == 0001-01-01T00:00:00* ]]');
const startEpochIndex = files.runner.indexOf('candidate_started_epoch="$(date -u -d "$candidate_started_at" +%s)"');
if (zeroStartIndex < 0 || startEpochIndex <= zeroStartIndex) {
  failures.push('runner: never-started source containers must be skipped before timestamp conversion');
}

const shellSyntax = spawnSync('bash', ['-n', runnerPath], { encoding: 'utf8' });
if (shellSyntax.status !== 0) failures.push(`runner: bash syntax invalid: ${shellSyntax.stderr.trim()}`);
const nodeBlocks = [...files.runner.matchAll(/<<'NODE'\n([\s\S]*?)\nNODE/g)];
if (nodeBlocks.length !== 1) failures.push(`runner: expected one embedded Node block, found ${nodeBlocks.length}`);
else {
  const nodeSyntax = spawnSync('node', ['--check', '-'], { input: nodeBlocks[0][1], encoding: 'utf8' });
  if (nodeSyntax.status !== 0) failures.push(`runner: embedded Node syntax invalid: ${nodeSyntax.stderr.trim()}`);

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-auth-hash-impact-classifier-'));
  try {
    const prismaModule = path.join(fixtureRoot, 'node_modules', '@prisma', 'client');
    fs.mkdirSync(prismaModule, { recursive: true });
    fs.writeFileSync(path.join(prismaModule, 'index.js'), `
class PrismaClient {
  constructor(options) {
    const url = String(options?.datasources?.db?.url || '');
    if (!url.includes('default_transaction_read_only')) throw new Error('fixture read-only URL missing');
  }
  async $transaction(callback, options) {
    if (options?.isolationLevel !== 'Serializable') throw new Error('fixture isolation mismatch');
    return callback({
      $queryRawUnsafe: async (sql) => {
        if (sql.includes("current_setting('transaction_read_only')")) {
          return [{
            read_only: true, no_super: true, no_bypass: true, no_inherit: true,
            auth_usage: true, login_select: true, registration_select: true,
            attempt_select: true, invitation_select: true,
            membership_event_select: true, mfa_recovery_select: true,
          }];
        }
        if (sql.includes('EXISTS (SELECT 1 FROM auth.login_throttles)')) {
          return [{
            login_rows: false, active_login_rows: false,
            registration_rows: false, live_registration_rows: false,
            registration_attempt_rows: false, invitation_rows: false,
            live_invitation_rows: false, membership_event_rows: false,
            mfa_recovery_rows: false, live_mfa_recovery_rows: false,
          }];
        }
        throw new Error('fixture unexpected query');
      },
    });
  }
  async $disconnect() {}
}
module.exports = { PrismaClient };
`);
    const fixture = spawnSync(
      'node', ['--input-type=commonjs', '-', 'AUTH_HASH_IMPACT', attemptSince, attemptUntil],
      {
        input: nodeBlocks[0][1],
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_PATH: path.join(fixtureRoot, 'node_modules'),
          AUTH_DATABASE_URL: 'postgresql://auth:fixture@db.invalid:5432/auth',
          DATABASE_URL: 'postgresql://deal:fixture@db.invalid:5432/deal',
          AUTH_TOKEN_PEPPER: '',
          AUTH_OPAQUE_TOKEN_DIGEST_KEY: '2'.repeat(96),
        },
      },
    );
    const expected = [
      'AUTH_DATASOURCE|PASS',
      'AUTH_PRINCIPAL|PASS',
      'AUTH_TRANSACTION|READ_ONLY',
      [
        'AUTH_HASH_IMPACT_DB', 'PASS', 'MISSING', 'READY',
        ...Array(10).fill('ZERO'),
        'SAFE_EMPTY_PERSISTED_GENERIC_HASH_STATE', 'NONE',
      ].join('|'),
    ].join('\n');
    if (fixture.status !== 0 || fixture.stdout.trim() !== expected || fixture.stderr.trim()) {
      failures.push(`runner: embedded Node read-only impact fixture failed: ${fixture.stdout.trim()} ${fixture.stderr.trim()}`);
    }
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}
const pythonBlocks = [...files.runner.matchAll(/<<'PY'\n([\s\S]*?)\nPY/g)];
if (pythonBlocks.length !== 1) failures.push(`runner: expected one embedded Python block, found ${pythonBlocks.length}`);
else {
  const pythonSyntax = spawnSync('python3', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], {
    input: pythonBlocks[0][1],
    encoding: 'utf8',
  });
  if (pythonSyntax.status !== 0) failures.push(`runner: embedded Python syntax invalid: ${pythonSyntax.stderr.trim()}`);
  const pythonRootGuard = "if os.geteuid() != 0:\n        fail('NOT_ROOT')";
  if (!pythonBlocks[0][1].includes(pythonRootGuard)) {
    failures.push('runner: embedded Python production root guard missing');
  }
  const pythonProtectedFileGuard = (
    'info.st_uid == 0 and info.st_gid == 0 and stat.S_IMODE(info.st_mode) == 0o600'
  );
  if (!pythonBlocks[0][1].includes(pythonProtectedFileGuard)) {
    failures.push('runner: embedded Python root-owned protected-file guard missing');
  }
  for (const pattern of [
    /\b(?:open|os\.open)\([^\n]*(?:['\"](?:w|a|x|\+)[^'\"]*['\"]|O_(?:WRONLY|RDWR|CREAT|TRUNC|APPEND))/,
    /\bos\.(?:remove|unlink|rename|replace|chmod|chown|mkdir|makedirs|rmdir)\b/,
    /\bshutil\.(?:copy|copy2|copyfile|move|rmtree)\b/,
    /\btempfile\b/,
    /['\"]docker['\"][^\n]{0,200}['\"](?:up|down|restart|stop|kill|rm|rmi|update|run|start|create|pull|build|prune)['\"]/,
    /print\([^\n]*(?:production_directory|compose_files|assignments|candidate_value|pepper_value|legacy_value|active_values|compose_values|purpose_values)/,
    /hashlib|sha(?:256|512)\s*\(/,
  ]) {
    if (pattern.test(pythonBlocks[0][1])) failures.push(`runner: embedded Python forbidden ${pattern}`);
  }

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-auth-hash-runtime-classifier-'));
  try {
    const fixtureBin = path.join(fixtureRoot, 'bin');
    const fixtureProduction = path.join(fixtureRoot, 'production');
    fs.mkdirSync(fixtureBin);
    fs.mkdirSync(fixtureProduction);
    const fixtureCompose = path.join(fixtureProduction, 'compose.yml');
    fs.writeFileSync(fixtureCompose, 'services:\n  api:\n    image: fixture-api\n  web:\n    image: fixture-web\n');
    fs.chmodSync(fixtureCompose, 0o600);

    const legacySecret = '1'.repeat(96);
    const opaqueSecret = '2'.repeat(96);
    const jwtSecret = '3'.repeat(96);
    const mfaSecret = '4'.repeat(96);
    const legacyFile = path.join(fixtureProduction, '.env');
    fs.writeFileSync(legacyFile, `AUTH_HASH_SECRET=${legacySecret}\n`);
    fs.chmodSync(legacyFile, 0o600);

    const labels = (revision) => ({
      'com.docker.compose.project': 'pc-fixture',
      'com.docker.compose.project.working_dir': fixtureProduction,
      'com.docker.compose.project.config_files': fixtureCompose,
      'org.opencontainers.image.revision': revision,
    });
    const activeEnv = [
      `AUTH_OPAQUE_TOKEN_DIGEST_KEY=${opaqueSecret}`,
      `JWT_SECRET=${jwtSecret}`,
      `MFA_ENCRYPTION_KEY=${mfaSecret}`,
    ];
    const documents = {
      'web-active': [{ Config: { Labels: labels('5b57f4b13de5f1d2f9175032bca1fd1dc8ec84c4'), Env: [] } }],
      'api-active': [{ Config: { Labels: labels('5b57f4b13de5f1d2f9175032bca1fd1dc8ec84c4'), Env: activeEnv } }],
      'api-source': [{ Config: { Labels: labels(sourceRevision), Env: activeEnv } }],
    };
    const composeConfig = { services: { api: { environment: Object.fromEntries(activeEnv.map((line) => line.split('=', 2))) } } };
    const mockDocker = path.join(fixtureBin, 'docker');
    fs.writeFileSync(mockDocker, `#!/usr/bin/env bash
set -Eeuo pipefail
case "\${1:-}" in
  version) printf 'fixture\\n' ;;
  ps)
    joined=" $* "
    if [[ "$joined" == *'com.docker.compose.service=web'* ]]; then
      printf 'web-active\\n'
    elif [[ "\${2:-}" == '-aq' ]]; then
      printf 'api-source\\napi-active\\n'
    else
      printf 'api-active\\n'
    fi
    ;;
  inspect)
    case "\${2:-}" in
      web-active) printf '%s\\n' '${JSON.stringify(documents['web-active'])}' ;;
      api-active) printf '%s\\n' '${JSON.stringify(documents['api-active'])}' ;;
      api-source) printf '%s\\n' '${JSON.stringify(documents['api-source'])}' ;;
      *) exit 91 ;;
    esac
    ;;
  compose) printf '%s\\n' '${JSON.stringify(composeConfig)}' ;;
  *) exit 92 ;;
esac
`);
    fs.chmodSync(mockDocker, 0o700);
    const fixtureSource = pythonBlocks[0][1].replace(
      pythonProtectedFileGuard,
      'info.st_uid == os.getuid() and info.st_gid == os.getgid() and stat.S_IMODE(info.st_mode) == 0o600',
    );
    const fixtureProgram = [
      'import os',
      'os.geteuid = lambda: 0',
      `exec(compile(${JSON.stringify(fixtureSource)}, '<auth-hash-runtime-fixture>', 'exec'))`,
      '',
    ].join('\n');
    const fixture = spawnSync('python3', ['-', sourceRevision], {
      input: fixtureProgram,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${fixtureBin}:${process.env.PATH}` },
    });
    const expected = [
      'AUTH_HASH_RUNTIME',
      'PASS',
      '5b57f4b13de5f1d2f9175032bca1fd1dc8ec84c4',
      'MISSING',
      'ONE',
      'MISSING',
      'MISSING',
      'ZERO',
      'NONE',
      'ONE',
      'READY',
      'PASS',
      'MIGRATE_LEGACY_AUTH_HASH_SECRET',
      'NONE',
    ].join('|');
    if (fixture.status !== 0 || fixture.stdout.trim() !== expected || fixture.stderr.trim()) {
      failures.push(`runner: embedded Python legacy-authority fixture failed: ${fixture.stdout.trim()} ${fixture.stderr.trim()}`);
    }
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}
const argvProbe = spawnSync('node', ['--input-type=commonjs', '-', 'AUTH_HASH_IMPACT', attemptSince, attemptUntil], {
  input: `const expected=${JSON.stringify(['AUTH_HASH_IMPACT', attemptSince, attemptUntil])}; if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(expected)) process.exit(1);`,
  encoding: 'utf8',
});
if (argvProbe.status !== 0) failures.push('runner: stdin argv binding probe failed');

try {
  const scope = JSON.parse(files.scope);
  if (!sameStringSet(scope.allowedPaths, allowedPaths)) failures.push('scope: allowedPaths mismatch');
  if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
      || scope.branch !== branch
      || scope.status !== 'active'
      || scope.operationalStatus !== 'P0_REVIEWER_RESET_ATTEMPT_AUTH_HASH_RUNTIME_AND_IMPACT_READ_ONLY_CLASSIFIER'
      || scope.issue !== 3785
      || scope.releaseIssue !== 3072
      || scope.sourceRun !== sourceRun
      || scope.sourceRevision !== sourceRevision
      || scope.attemptSinceUtc !== attemptSince
      || scope.attemptUntilUtc !== attemptUntil
      || scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY') failures.push('scope: metadata mismatch');
  const expectedBoundaries = {
    productionMutation: 'NONE',
    databaseMutation: false,
    identityMutation: false,
    passwordMutation: false,
    credentialMutation: false,
    mfaMutation: false,
    sessionMutation: false,
    resetReplay: false,
    mailSend: false,
    databaseReadOnly: true,
    logReadOnly: true,
    protectedRuntimeFileReadOnly: true,
    runtimeBusinessBehaviorChange: false,
    securityGateDisabled: false,
    piiOutput: false,
    credentialOutput: false,
    rawLogOutput: false,
    ownerOnly: true,
    exactMainGuard: true,
    newRecurringCostRub: 0,
  };
  for (const [key, value] of Object.entries(expectedBoundaries)) {
    if (scope.boundaries?.[key] !== value) failures.push(`scope: boundary mismatch for ${key}`);
  }
  if (!Array.isArray(scope.acceptance) || scope.acceptance.length < 18) failures.push('scope: acceptance contract incomplete');
} catch (error) {
  failures.push(`scope: invalid JSON: ${error.message}`);
}

try {
  const autopilot = JSON.parse(files.autopilot);
  const authorized = autopilot.approvedConcurrentScopes?.[branch];
  if (!sameStringSet(authorized, allowedPaths)) failures.push('autopilot: exact concurrent scope authorization missing or mismatched');
} catch (error) {
  failures.push(`autopilot: invalid JSON: ${error.message}`);
}

if (failures.length) {
  console.error('Production P0 reviewer reset and auth-hash safety classifier contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('PASS: reviewer reset and auth-hash runtime/impact classifiers are owner-only, exact-main/dynamic-active/source-revision guarded and read-only; they cannot replay reset, send mail, disclose identity/secret material or mutate production.');
