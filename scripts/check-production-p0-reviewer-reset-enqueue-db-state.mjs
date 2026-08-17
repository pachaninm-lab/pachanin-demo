#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-enqueue-db-state.yml';
const scriptPath = 'scripts/production-p0-reviewer-reset-enqueue-db-state.sh';
const remotePath = 'scripts/production-p0-reviewer-reset-enqueue-db-state-remote.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-enqueue-db-state.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-enqueue-db-state-3785.json';
const migrationPath = 'apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql';
const command = '/production p0-reviewer-reset-enqueue-db-state current-main';
const branch = 'fix/p0-reviewer-reset-enqueue-db-state-remote-script-3785';
const allowed = [workflowPath, scriptPath, remotePath, checkerPath, scopePath];
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const remote = fs.readFileSync(remotePath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
const migration = fs.readFileSync(migrationPath, 'utf8');
const failures = [];
const need = (where, text, token) => { if (!text.includes(token)) failures.push(`${where}: missing ${token}`); };
const deny = (where, text, regex) => { if (regex.test(text)) failures.push(`${where}: forbidden ${regex}`); };

for (const token of [
  'pull_request:', 'issue_comment:', 'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  "github.event.comment.author_association == 'OWNER'",
  'github.event.comment.performed_via_github_app.id == 1144995',
  `github.event.comment.body == '${command}'`,
  "needs.contract.result == 'success'",
  `node ${checkerPath}`,
  `bash -n ${scriptPath}`,
  `bash -n ${remotePath}`,
  `bash ${scriptPath}`,
]) need('workflow', workflow, token);
for (const path of allowed) need('workflow', workflow, `      - '${path}'`);
for (const regex of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, regex);

for (const token of [
  `COMMAND='${command}'`,
  "MIGRATION_NAME='20260812010000_p0_industrial_auth_mail_outbox'",
  `MIGRATION_PATH='${migrationPath}'`,
  "MIGRATION_DATASOURCE_FIX_SHA='1762b4a22a99d786a971e78cbe16ec1f74bb5a74'",
  "FUNCTION_SIG='auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)'",
  `REMOTE_SCRIPT='${remotePath}'`,
  "LOCAL_STAGE='AUTHORITY'",
  "LOCAL_STAGE='REMOTE_DB_STATE'",
  'bash -n "$REMOTE_SCRIPT"',
  ' < "$REMOTE_SCRIPT"',
  'customer/user rows: \\`NOT_READ\\`',
  'production mutation: \\`NONE\\`',
]) need('script', script, token);

for (const token of [
  "REMOTE_STAGE='ACTIVE_RUNTIME'",
  "REMOTE_STAGE='COMPOSE_AUTHORITY'",
  "REMOTE_STAGE='DB_TARGET_PARITY'",
  "REMOTE_STAGE='API_CATALOG_QUERY'",
  "REMOTE_STAGE='MIGRATION_METADATA_QUERY'",
  "REMOTE_STAGE='COMPLETE'",
  "ACTIVE_REVISION",
  "API_WEB_REVISION_PARITY",
  "MAIN_DB_TARGET_PARITY",
  "AUTH_DB_TARGET_PARITY",
  "API_QUERY_CLASS",
  "API_PRODUCER_PRINCIPAL",
  "AUTH_SCHEMA_EXISTS",
  "MAIL_OUTBOX_EXISTS",
  "ENQUEUE_FUNCTION_EXISTS",
  "API_AUTH_SCHEMA_USAGE",
  "API_ENQUEUE_EXECUTE",
  "MIGRATION_QUERY_CLASS",
  "AUTH_MAIL_OUTBOX_MIGRATION",
  "MIGRATION_AUTH_FUNCTION_EXISTS",
  "MIGRATION_AUTH_TABLE_EXISTS",
  'SELECT migration_name,',
  'to_regprocedure($1) IS NOT NULL AS enqueue_function',
  "has_function_privilege(current_user,to_regprocedure($1),'EXECUTE')",
  'PRODUCTION_MUTATION=NONE',
]) need('remote', remote, token);

for (const [where, text] of [['script', script], ['remote', remote]]) {
  for (const regex of [
    /password-reset\/request/, /forgot-password/, /password-reset\/confirm/,
    /\bcurl\s/, /\bpsql\b/, /prisma\s+migrate/, /prisma\s+db\s+execute/,
    /docker\s+(restart|stop|rm|kill|run)/, /docker\s+compose[^\n]*(up|down|restart)/,
    /\$executeRaw\b/, /\$executeRawUnsafe\b/,
    /INSERT\s+INTO\s+(auth|public)\./i, /UPDATE\s+(auth|public)\./i,
    /DELETE\s+FROM\s+(auth|public)\./i, /TRUNCATE\s+(auth|public)\./i,
    /ALTER\s+(TABLE|ROLE|FUNCTION|SCHEMA)/i, /CREATE\s+(TABLE|ROLE|FUNCTION|SCHEMA)/i,
    /DROP\s+(TABLE|ROLE|FUNCTION|SCHEMA)/i,
  ]) deny(where, text, regex);
}

for (const token of [
  'CREATE OR REPLACE FUNCTION auth.enqueue_mail_outbox(',
  'REVOKE ALL ON FUNCTION auth.enqueue_mail_outbox(',
  'GRANT EXECUTE ON FUNCTION auth.enqueue_mail_outbox(',
]) need('migration', migration, token);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push('scope schema mismatch');
if (scope.branch !== branch || scope.status !== 'active') failures.push('scope identity mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) failures.push('scope authority mismatch');
if (scope.migrationName !== '20260812010000_p0_industrial_auth_mail_outbox') failures.push('scope migration mismatch');
if (scope.functionSignature !== 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)') failures.push('scope function mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowed].sort())) failures.push('scope paths mismatch');
const b = scope.boundaries || {};
for (const key of ['databaseMutation','identityMutation','passwordMutation','mfaMutation','sessionMutation','resetReplay','mailSend','deploymentMutation','containerLifecycleMutation','productionFilesystemMutation','piiOutput','credentialOutput','rawDbErrorOutput','customerRowRead']) {
  if (b[key] !== false) failures.push(`scope boundary ${key}`);
}
if (b.databaseRead !== true || b.catalogReadOnly !== true || b.migrationMetadataReadOnly !== true || b.productionMutation !== 'NONE' || b.ownerOnly !== true || b.exactMainGuard !== true || b.activeApiPrincipalProbe !== true || b.migrationAuthorityProbe !== true || b.remotePayloadSyntaxChecked !== true || b.newRecurringCostRub !== 0) {
  failures.push('scope core boundary mismatch');
}
const acceptanceText = JSON.stringify(scope.acceptance || []);
for (const phrase of [
  'same DATABASE_URL principal as the active API',
  'exact enqueue function and EXECUTE privilege',
  'only the named _prisma_migrations row',
  'no customer or user rows',
  'remote payload is a separate versioned shell script syntax-checked by CI',
]) {
  if (!acceptanceText.includes(phrase)) failures.push(`scope acceptance missing: ${phrase}`);
}

for (const path of [scriptPath, remotePath]) {
  const syntax = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
  if (syntax.status !== 0) failures.push(`${path} syntax failed: ${String(syntax.stderr).slice(0, 500)}`);
}
if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = String(diff.stdout).trim().split('\n').filter(Boolean).sort();
  const outOfScope = changed.filter((file) => !allowed.includes(file));
  if (diff.status !== 0 || changed.length === 0 || outOfScope.length) failures.push(`PR scope mismatch ${JSON.stringify(changed)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: enqueue DB state classifier is owner-bound, exact-main guarded, catalog/migration-metadata read-only, active-API-principal aware, migration-authority aware, customer-row-free, reset-free, mail-free and mutation-free; remote payload is independently syntax-checked.');
