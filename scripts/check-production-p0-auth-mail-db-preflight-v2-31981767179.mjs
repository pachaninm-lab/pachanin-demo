#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-auth-mail-db-preflight-v2-31981767179.yml';
const scriptPath = 'scripts/production-p0-auth-mail-db-preflight-v2-31981767179.sh';
const checkerPath = 'scripts/check-production-p0-auth-mail-db-preflight-v2-31981767179.mjs';
const branch = 'fix/p0-auth-mail-db-preflight-v2-3785';
const command = '/production p0-auth-mail-db-preflight-v2 31981767179 current-main';
const migration = '20260812010000_p0_industrial_auth_mail_outbox';
const functionSig = 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)';
const expectedOwner = 'pc_auth_mail_enqueue_authority';
const expectedChanged = [workflowPath, scriptPath, checkerPath].sort();

const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const failures = [];
const need = (where, text, token) => {
  if (!text.includes(token)) failures.push(`${where}: missing ${token}`);
};
const deny = (where, text, regex) => {
  if (regex.test(text)) failures.push(`${where}: forbidden ${regex}`);
};

for (const token of [
  'pull_request:',
  'issue_comment:',
  'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  "github.event.comment.author_association == 'OWNER'",
  'github.event.comment.performed_via_github_app.id == 1144995',
  `github.event.comment.body == '${command}'`,
  "needs.contract.result == 'success'",
  `node ${checkerPath}`,
  `bash -n ${scriptPath}`,
  `bash ${scriptPath}`,
  "PRODUCTION_MUTATION_ALLOWED: 'false'",
  "PC_IS_PRODUCTION: 'true'",
]) need('workflow', workflow, token);
for (const path of expectedChanged) need('workflow', workflow, `      - '${path}'`);
for (const regex of [
  /workflow_dispatch:/,
  /schedule:/,
  /\bpush:/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
]) deny('workflow', workflow, regex);

for (const token of [
  `COMMAND='${command}'`,
  `MIGRATION_NAME='${migration}'`,
  `FUNCTION_SIG='${functionSig}'`,
  `EXPECTED_OWNER='${expectedOwner}'`,
  "[[ \"${PRODUCTION_MUTATION_ALLOWED:-false}\" == 'false' ]]",
  "[[ \"${PC_IS_PRODUCTION:-false}\" == 'true' ]]",
  "LOCAL_STAGE='AUTHORITY'",
  "LOCAL_STAGE='SSH_INPUT'",
  "LOCAL_STAGE='HOST_PIN'",
  "LOCAL_STAGE='REMOTE_PREFLIGHT'",
  "LOCAL_STAGE='REMOTE_DB_READ'",
  "REMOTE_STAGE='API_INVENTORY'",
  "REMOTE_STAGE='PRISMA_CLIENT'",
  "REMOTE_STAGE='DB_NODE'",
  "REMOTE_STAGE='CONSISTENCY_CHECK'",
  "REMOTE_STAGE='COMPLETE'",
  "docker ps -q --filter 'label=com.docker.compose.service=api'",
  "docker exec \"$id\" node -e \"require.resolve('@prisma/client')\"",
  "docker exec -i \"$id\" node -",
  "await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')",
  "current_setting('transaction_read_only') = 'on'",
  "stage = 'CATALOG_BASE'",
  "stage = 'FUNCTION_META'",
  "stage = 'ACL'",
  "stage = 'MIGRATION_HISTORY'",
  `pg_catalog.to_regprocedure('${functionSig}')`,
  "pg_catalog.to_regnamespace('auth')::oid",
  "pg_catalog.to_regclass('public.\"_prisma_migrations\"')::oid",
  "pg_catalog.pg_get_userbyid(p.proowner)",
  `= '${expectedOwner}'`,
  'pg_catalog.has_schema_privilege',
  'pg_catalog.has_function_privilege',
  'pg_catalog.has_table_privilege',
  "WHEN 'pc_auth_runtime' THEN 'PC_AUTH_RUNTIME'",
  "WHEN 'one_deal_auth' THEN 'ONE_DEAL_AUTH'",
  "WHEN 'app_auth' THEN 'APP_AUTH'",
  "WHEN 'app_service' THEN 'APP_SERVICE'",
  "WHEN 'pc_app' THEN 'PC_APP'",
  `WHERE migration_name = '${migration}'`,
  'DB_FAILURE|',
  'DB_EVIDENCE|',
  'DB SQLSTATE class',
  'migration/schema consistency',
  "printf 'PRODUCTION_MUTATION=NONE\\n'",
  'READ_ONLY_DB_PREFLIGHT_V2=PASS',
]) need('script', script, token);

for (const regex of [
  /password-reset\/request/i,
  /forgot-password/i,
  /password-reset\/confirm/i,
  /\bcurl\b/,
  /\bwget\b/,
  /\bpsql\b/,
  /\bprisma\s+migrate\b/i,
  /docker\s+(restart|stop|rm|kill|pause|unpause)\b/i,
  /docker\s+compose\s+(up|down|restart|rm|pull)\b/i,
  /docker\s+exec[^\n]*(?:\bbash\b|\bsh\b)/i,
  /\bDATABASE_URL\b/,
  /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|REVOKE|TRUNCATE|COPY)\b\s+/i,
]) deny('script', script, regex);

const executeCalls = script.match(/\$executeRawUnsafe\s*\(/g) || [];
if (executeCalls.length !== 1) failures.push(`script: expected exactly one executeRawUnsafe call, got ${executeCalls.length}`);
const queryCalls = script.match(/\$queryRawUnsafe\s*\(/g) || [];
if (queryCalls.length !== 5) failures.push(`script: expected exactly five queryRawUnsafe calls, got ${queryCalls.length}`);
if (!script.includes("await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');")) failures.push('script: transaction is not forced READ ONLY before reads');
if (!script.includes("const result = await prisma.$transaction(async (tx) => {")) failures.push('script: Prisma reads are not transaction-bounded');
if (!script.includes("process.stdout.write(`DB_FAILURE|${safeStage}|${kind}|${sqlstate}\\n`);")) failures.push('script: sanitized DB failure classifier missing');
if (!script.includes("schema_state='DRIFT'")) failures.push('script: migration/schema drift classification missing');
if (!script.includes("schema_state='CONSISTENT'")) failures.push('script: consistent contract classification missing');
if (!script.includes("schema_state='MIGRATION_HISTORY_UNREADABLE'")) failures.push('script: unreadable migration-history classification missing');

const syntax = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' });
if (syntax.status !== 0) failures.push(`bash syntax failed: ${String(syntax.stderr).slice(0, 200)}`);

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  if (process.env.GITHUB_HEAD_REF !== branch) failures.push(`PR branch mismatch ${process.env.GITHUB_HEAD_REF || 'missing'}`);
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = String(diff.stdout).trim().split('\n').filter(Boolean).sort();
  if (diff.status !== 0 || JSON.stringify(changed) !== JSON.stringify(expectedChanged)) {
    failures.push(`PR scope mismatch ${JSON.stringify(changed)}`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log('PASS: v2 auth-mail DB preflight is owner-bound, exact-main guarded, pinned-host, transaction-read-only, stage-classifies sanitized Prisma/SQLSTATE failures, verifies migration/schema/function owner/runtime ACL through active API runtimes, and cannot replay reset/mail/deploy or mutate production.');
