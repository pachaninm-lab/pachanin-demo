#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-auth-durable.yml';
const runnerPath = 'scripts/production-p0-reviewer-reset-auth-durable.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-auth-durable.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-auth-durable-3785.json';
const branch = 'fix/p0-reviewer-reset-auth-datasource-3785';
const files = Object.fromEntries([
  ['workflow', workflowPath], ['runner', runnerPath], ['checker', checkerPath], ['scope', scopePath],
].map(([key, path]) => [key, fs.readFileSync(path, 'utf8')]));
const failures = [];
const requireToken = (name, token) => {
  if (!files[name].includes(token)) failures.push(`${name}: missing ${JSON.stringify(token)}`);
};
const requirePattern = (name, pattern, label) => {
  if (!pattern.test(files[name])) failures.push(`${name}: missing ${label}`);
};
const forbid = (name, pattern) => {
  if (pattern.test(files[name])) failures.push(`${name}: forbidden ${pattern}`);
};

for (const token of [
  'name: Production P0 Reviewer Reset Auth Datasource Durable Diagnostic',
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  "github.event.comment.body == '/production p0-reviewer-reset-auth-durable-diagnose 31648675850 31648772066'",
  'persist-credentials: false',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'PC_REVIEWER_RESET_AUTH_DURABLE_COMMAND: ${{ github.event.comment.body }}',
  `node ${checkerPath}`,
  `bash -n ${runnerPath}`,
]) requireToken('workflow', token);
requirePattern(
  'workflow',
  /^\s*run:\s*bash\s+scripts\/production-p0-reviewer-reset-auth-durable\.sh\s*$/m,
  'exact diagnose runner invocation',
);

for (const token of [
  "COMMAND='/production p0-reviewer-reset-auth-durable-diagnose 31648675850 31648772066'",
  "FIRST_RUN_ID='31648675850'",
  "SECOND_RUN_ID='31648772066'",
  "FIRST_SINCE='2026-08-12T22:51:40Z'",
  "FIRST_UNTIL='2026-08-12T22:52:30Z'",
  "SECOND_SINCE='2026-08-12T22:53:10Z'",
  "SECOND_UNTIL='2026-08-12T22:54:05Z'",
  "EXPECTED_DEPLOYED_SHA='d2dd7972105cc59002263455b5ae0eb8d8f2d386'",
  'git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$TARGET_SHA"',
  'for attempt in 1 2 3; do',
  'StrictHostKeyChecking=yes',
  'UserKnownHostsFile="$known_hosts"',
  "docker ps -q --filter 'label=com.docker.compose.service=web'",
  "--filter 'label=com.docker.compose.service=api'",
  'org.opencontainers.image.revision',
  "process.env.STAFF_DATABASE_URL",
  "process.env.AUTH_DATABASE_URL",
  "process.env.DATABASE_URL",
  "if (!dealUrl || authUrl === dealUrl) fail('AUTH_DATABASE_URL_NOT_ISOLATED')",
  "authDb = new PrismaClient({ datasources: { db: { url: authUrl } } })",
  "NOT rolsuper AS no_super",
  "NOT rolbypassrls AS no_bypass",
  "NOT rolinherit AS no_inherit",
  "has_schema_privilege(current_user, 'auth', 'USAGE')",
  "has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT')",
  "has_table_privilege(current_user, 'auth.audit_events', 'SELECT')",
  "to_regprocedure('auth.resolve_password_reset_subject(text)')",
  'SELECT user_id FROM auth.resolve_password_reset_subject($1)',
  'FROM auth.password_reset_challenges',
  'FROM auth.audit_events',
  "reason = 'CHALLENGE_ISSUED'",
  "reason = 'COOLDOWN_ACTIVE'",
  "status = 'PENDING' AND expires_at > now()",
  'AUTH_DATASOURCE|PASS',
  'AUTH_PRINCIPAL|PASS',
  'RESET_AUTH_DURABLE',
  'PRODUCTION_MUTATION|NONE',
  'fresh reset safe now:',
  'reviewer identity exposure: \\`NONE\\`',
  'token/hash/user-id output: \\`NONE\\`',
  'auth/reset request replay: \\`NONE\\`',
  'raw database/runtime output: \\`NOT_PUBLISHED\\`',
]) requireToken('runner', token);

for (const pattern of [
  /const\s+authUrl\s*=\s*String\(process\.env\.DATABASE_URL/,
  /set\s+-[^\n]*x/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
  /sshpass/i,
  /docker\s+(?:compose|restart|stop|kill|rm|rmi|update|run|start|create)\b/,
  /\bpsql\b/,
  /\b(?:curl|wget)\b/,
  /source\s+[^\n]*\.env/,
  /\bprintenv\b/,
  /\/proc\/[0-9$]+\/environ/,
  /process\.stdout\.write\([^\n]*(?:reviewer_email|email|token_hash|userId|user_id|authUrl|staffUrl|dealUrl)/i,
  /gh\s+issue\s+comment[^\n]*(?:email|token|passwordHash|totp|authUrl|staffUrl|dealUrl)/i,
  /\$(?:executeRaw|executeRawUnsafe)\b/,
  /\b(?:staffDb|authDb)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\b/,
  /(?:^|[`;'"\n])\s*(?:INSERT\s+INTO|UPDATE\s+(?:auth|public)\.|DELETE\s+FROM|ALTER\s+(?:TABLE|ROLE|SCHEMA|DATABASE)|CREATE\s+(?:TABLE|ROLE|SCHEMA|DATABASE)|DROP\s+(?:TABLE|ROLE|SCHEMA|DATABASE)|TRUNCATE\s+(?:TABLE\s+)?|GRANT\b|REVOKE\b|SET\s+ROLE\b)/im,
]) forbid('runner', pattern);

const shellSyntax = spawnSync('bash', ['-n', runnerPath], { encoding: 'utf8' });
if (shellSyntax.status !== 0) failures.push(`runner: bash syntax invalid: ${shellSyntax.stderr.trim()}`);
const nodeMatch = files.runner.match(/<<'NODE'\n([\s\S]*?)\nNODE/);
if (!nodeMatch) failures.push('runner: embedded Node block missing');
else {
  const nodeSyntax = spawnSync('node', ['--check', '-'], { input: nodeMatch[1], encoding: 'utf8' });
  if (nodeSyntax.status !== 0) failures.push(`runner: embedded Node syntax invalid: ${nodeSyntax.stderr.trim()}`);
}

try {
  const scope = JSON.parse(files.scope);
  const expectedPaths = [workflowPath, scopePath, checkerPath, runnerPath].sort();
  if (JSON.stringify([...(scope.allowedPaths ?? [])].sort()) !== JSON.stringify(expectedPaths)) failures.push('scope: allowedPaths mismatch');
  if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
      || scope.branch !== branch
      || scope.status !== 'active'
      || scope.operationalStatus !== 'P0_REVIEWER_RESET_AUTH_DATASOURCE_DURABLE_DIAGNOSTIC'
      || scope.issue !== 3785
      || scope.releaseIssue !== 3072
      || scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY'
      || scope.boundaries?.productionMutation !== 'NONE'
      || scope.boundaries?.databaseMutation !== false
      || scope.boundaries?.identityMutation !== false
      || scope.boundaries?.passwordMutation !== false
      || scope.boundaries?.credentialMutation !== false
      || scope.boundaries?.sessionMutation !== false
      || scope.boundaries?.mfaMutation !== false
      || scope.boundaries?.runtimeBusinessBehaviorChange !== false
      || scope.boundaries?.securityGateDisabled !== false
      || scope.boundaries?.piiOutput !== false
      || scope.boundaries?.credentialOutput !== false
      || scope.boundaries?.ownerOnly !== true
      || scope.boundaries?.exactMainGuard !== true
      || scope.boundaries?.newRecurringCostRub !== 0) failures.push('scope: metadata mismatch');
} catch (error) {
  failures.push(`scope: invalid JSON: ${error.message}`);
}

if (failures.length) {
  console.error('Production P0 reviewer reset auth-datasource durable diagnostic contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('PASS: reviewer reset auth-datasource durable diagnostic is owner-only, exact-main/deployed guarded, AUTH_DATABASE_URL-bound, aggregate-only and read-only.');
