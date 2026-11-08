#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-auth-mail-db-preflight-31980524957.yml';
const scriptPath = 'scripts/production-p0-auth-mail-db-preflight-31980524957.sh';
const checkerPath = 'scripts/check-production-p0-auth-mail-db-preflight-31980524957.mjs';
const branch = 'fix/p0-auth-mail-db-preflight-31980524957-3785';
const command = '/production p0-auth-mail-db-preflight 31980524957 current-main';
const migration = '20260812010000_p0_industrial_auth_mail_outbox';
const functionSig = 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)';
const expectedOwner = 'pc_auth_mail_enqueue_authority';
const allowed = [workflowPath, scriptPath, checkerPath];
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
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
  `bash ${scriptPath}`,
  "PRODUCTION_MUTATION_ALLOWED: 'false'",
  "PC_IS_PRODUCTION: 'true'",
]) need('workflow', workflow, token);
for (const path of allowed) need('workflow', workflow, `      - '${path}'`);
for (const regex of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, regex);

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
  "REMOTE_STAGE='DB_QUERY'",
  "REMOTE_STAGE='CONSISTENCY_CHECK'",
  "REMOTE_STAGE='COMPLETE'",
  "docker ps -q --filter 'label=com.docker.compose.service=api'",
  "docker exec \"$id\" node -e \"require.resolve('@prisma/client')\"",
  "docker exec -i \"$id\" node -",
  "await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')",
  `pg_catalog.to_regprocedure('${functionSig}')`,
  "pg_catalog.pg_get_userbyid(p.proowner)",
  `= '${expectedOwner}'`,
  "pg_catalog.has_schema_privilege",
  "pg_catalog.has_function_privilege",
  "pg_catalog.has_table_privilege",
  "WHEN 'pc_auth_runtime' THEN 'PC_AUTH_RUNTIME'",
  "WHEN 'one_deal_auth' THEN 'ONE_DEAL_AUTH'",
  "WHEN 'app_auth' THEN 'APP_AUTH'",
  "WHEN 'app_service' THEN 'APP_SERVICE'",
  "WHEN 'pc_app' THEN 'PC_APP'",
  `WHERE migration_name = '${migration}'`,
  "migration/schema consistency",
  "DB_EVIDENCE|",
  "API_RUNTIME_COUNT|",
  "printf 'PRODUCTION_MUTATION=NONE\\n'",
  "DB URL / credentials / raw query errors / PII: \\`NOT_PUBLISHED\\`",
  "reset replay / mail send / deployment: \\`NONE\\`",
  "production mutation: \\`NONE\\`",
  "READ_ONLY_DB_PREFLIGHT=PASS",
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
  /\bcitext\b/i,
  /\buuid_oid\b/i,
  /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|REVOKE|TRUNCATE|COPY)\b\s+/i,
]) deny('script', script, regex);

const executeCalls = script.match(/\$executeRawUnsafe\s*\(/g) || [];
if (executeCalls.length !== 1) failures.push(`script: expected exactly one executeRawUnsafe call, got ${executeCalls.length}`);
const queryCalls = script.match(/\$queryRawUnsafe\s*\(/g) || [];
if (queryCalls.length !== 2) failures.push(`script: expected exactly two queryRawUnsafe calls, got ${queryCalls.length}`);
if (!script.includes("await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');")) failures.push('script: transaction is not forced READ ONLY before catalog reads');
if (!script.includes("const result = await prisma.$transaction(async (tx) => {")) failures.push('script: Prisma reads are not transaction-bounded');
if (!script.includes(".catch(() => { process.exitCode = 41; })")) failures.push('script: raw Prisma errors may escape the sanitizer boundary');
if (!script.includes("schema_state='DRIFT'")) failures.push('script: migration/schema drift classification missing');
if (!script.includes("schema_state='CONSISTENT'")) failures.push('script: consistent contract classification missing');
if (!script.includes("schema_state='MIGRATION_HISTORY_UNREADABLE'")) failures.push('script: unreadable migration-history classification missing');

const syntax = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' });
if (syntax.status !== 0) failures.push(`bash syntax failed: ${String(syntax.stderr).slice(0, 200)}`);

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  if (process.env.GITHUB_HEAD_REF !== branch) failures.push(`PR branch mismatch ${process.env.GITHUB_HEAD_REF || 'missing'}`);
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = String(diff.stdout).trim().split('\n').filter(Boolean).sort();
  const expected = [...allowed].sort();
  if (diff.status !== 0 || JSON.stringify(changed) !== JSON.stringify(expected)) failures.push(`PR scope mismatch ${JSON.stringify(changed)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: auth-mail DB preflight is owner-bound, exact-main guarded, pinned-host, transaction-read-only, verifies the exact 12-argument migration contract plus owner/runtime EXECUTE, reads migration history when permitted, classifies schema drift, publishes sanitized evidence only, and cannot replay reset/mail/deploy or mutate production.');
