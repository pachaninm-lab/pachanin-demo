#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-incident-diagnostic.yml';
const runnerPath = 'scripts/production-p0-reviewer-reset-incident-diagnostic.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-incident-diagnostic.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-incident-diagnostic-3785.json';
const branch = 'diag/p0-reviewer-reset-durable-mutation-3785';
const files = Object.fromEntries([
  ['workflow', workflowPath], ['runner', runnerPath], ['checker', checkerPath], ['scope', scopePath],
].map(([key, path]) => [key, fs.readFileSync(path, 'utf8')]));
const failures = [];
const requireToken = (name, token) => {
  if (!files[name].includes(token)) failures.push(`${name}: missing ${JSON.stringify(token)}`);
};
const forbid = (name, pattern) => {
  if (pattern.test(files[name])) failures.push(`${name}: forbidden ${pattern}`);
};

for (const token of [
  'name: Production P0 Reviewer Reset Durable Incident Diagnostic',
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  "github.event.comment.body == '/production p0-reviewer-reset-durable-diagnose 31648675850 31648772066'",
  'persist-credentials: false',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'PC_REVIEWER_RESET_INCIDENT_COMMAND: ${{ github.event.comment.body }}',
  `node ${checkerPath}`,
  `bash -n ${runnerPath}`,
  `bash ${runnerPath}`,
]) requireToken('workflow', token);

for (const token of [
  "COMMAND='/production p0-reviewer-reset-durable-diagnose 31648675850 31648772066'",
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
  'docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - "$first_since" "$first_until" "$second_since" "$second_until" <<\'NODE\'',
  "process.env.STAFF_DATABASE_URL",
  "process.env.DATABASE_URL",
  "current_user = 'pc_staff_runtime'",
  "auth.staff_reviewer_login_readiness()",
  "auth.staff_reviewer_password_reset_subject()",
  "auth.resolve_password_reset_subject($1)",
  "has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT')",
  "has_table_privilege(current_user, 'auth.audit_events', 'SELECT')",
  "FROM auth.password_reset_challenges",
  "FROM auth.audit_events",
  "reason = 'CHALLENGE_ISSUED'",
  "reason = 'COOLDOWN_ACTIVE'",
  "status = 'PENDING' AND expires_at > now()",
  "RESET_DURABLE",
  'PRODUCTION_MUTATION|NONE',
  'fresh reset safe now:',
  'reviewer identity exposure: \\`NONE\\`',
  'token/hash/user-id output: \\`NONE\\`',
  'auth/reset request replay: \\`NONE\\`',
  'raw database/runtime output: \\`NOT_PUBLISHED\\`',
]) requireToken('runner', token);

for (const pattern of [
  /set\s+-[^\n]*x/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
  /sshpass/i,
  /docker\s+(?:compose|restart|stop|kill|rm|rmi|update|run|start|create)\b/,
  /\bpsql\b/,
  /\b(?:curl|wget)\b/,
  /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\s+(?:INTO|TABLE|SCHEMA|ROLE|DATABASE|FROM)?\b/i,
  /source\s+[^\n]*\.env/,
  /\bprintenv\b/,
  /\/proc\/[0-9$]+\/environ/,
  /process\.stdout\.write\([^\n]*(?:reviewer_email|email|token_hash|userId|user_id)/i,
  /\/nodejs\/bin\/node --input-type=commonjs -- "\$first_since"/,
]) forbid('runner', pattern);

const shellSyntax = spawnSync('bash', ['-n', runnerPath], { encoding: 'utf8' });
if (shellSyntax.status !== 0) failures.push(`runner: bash syntax invalid: ${shellSyntax.stderr.trim()}`);
const nodeMatch = files.runner.match(/<<'NODE'\n([\s\S]*?)\nNODE/);
if (!nodeMatch) failures.push('runner: embedded Node block missing');
else {
  const nodeSyntax = spawnSync('node', ['--check', '-'], { input: nodeMatch[1], encoding: 'utf8' });
  if (nodeSyntax.status !== 0) failures.push(`runner: embedded Node syntax invalid: ${nodeSyntax.stderr.trim()}`);
}

const argvProbe = spawnSync(
  'node',
  ['--input-type=commonjs', '-', 'first', 'firstUntil', 'second', 'secondUntil'],
  {
    input: "const expected=['first','firstUntil','second','secondUntil']; if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(expected)) process.exit(1);",
    encoding: 'utf8',
  },
);
if (argvProbe.status !== 0) failures.push('runner: stdin argv binding probe failed');

try {
  const scope = JSON.parse(files.scope);
  const expectedPaths = [workflowPath, scopePath, checkerPath, runnerPath].sort();
  if (JSON.stringify([...(scope.allowedPaths ?? [])].sort()) !== JSON.stringify(expectedPaths)) failures.push('scope: allowedPaths mismatch');
  if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
      || scope.branch !== branch
      || scope.status !== 'active'
      || scope.operationalStatus !== 'P0_REVIEWER_RESET_DURABLE_MUTATION_DIAGNOSTIC'
      || scope.issue !== 3785
      || scope.releaseIssue !== 3072
      || scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY'
      || scope.boundaries?.productionMutation !== 'NONE'
      || scope.boundaries?.databaseMutation !== false
      || scope.boundaries?.deploymentMutation !== false
      || scope.boundaries?.credentialMutation !== false
      || scope.boundaries?.sessionMutation !== false
      || scope.boundaries?.mfaMutation !== false
      || scope.boundaries?.piiOutput !== false
      || scope.boundaries?.credentialOutput !== false
      || scope.boundaries?.ownerOnly !== true
      || scope.boundaries?.exactMainGuard !== true
      || scope.boundaries?.newRecurringCostRub !== 0) failures.push('scope: metadata mismatch');
  if (scope.incident?.firstRunId !== 31648675850
      || scope.incident?.secondRunId !== 31648772066
      || scope.incident?.firstSinceUtc !== '2026-08-12T22:51:40Z'
      || scope.incident?.firstUntilUtc !== '2026-08-12T22:52:30Z'
      || scope.incident?.secondSinceUtc !== '2026-08-12T22:53:10Z'
      || scope.incident?.secondUntilUtc !== '2026-08-12T22:54:05Z'
      || scope.incident?.deployedRevision !== 'd2dd7972105cc59002263455b5ae0eb8d8f2d386') failures.push('scope: incident binding mismatch');
} catch (error) {
  failures.push(`scope: invalid JSON: ${error.message}`);
}

if (failures.length) {
  console.error('Production P0 reviewer reset durable incident diagnostic contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('PASS: durable reviewer reset incident diagnostic is owner-only, exact-main/deployed guarded, aggregate-only and read-only; it cannot replay reset, disclose identity/token material or mutate production.');
