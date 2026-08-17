#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-auth-mail-db-semantic-postverify-v4-3785.yml';
const scriptPath = 'scripts/production-p0-auth-mail-db-semantic-postverify-v4-3785.sh';
const checkerPath = 'scripts/check-production-p0-auth-mail-db-semantic-postverify-v4-3785.mjs';
const branch = 'fix/p0-auth-mail-db-semantic-postverify-v4-3785';
const command = '/production p0-auth-mail-db-semantic-postverify-v4 31996401705 current-main';
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
  "EVIDENCE_RUN='31996401705'",
  "EVIDENCE_COMMENT='5312046784'",
  "EVIDENCE_SHA='b67f6b740bd0f000c91ffb87a76cb3c104cc90d3'",
  "[[ \"${PRODUCTION_MUTATION_ALLOWED:-false}\" == 'false' ]]",
  "[[ \"${PC_IS_PRODUCTION:-false}\" == 'true' ]]",
  "LOCAL_STAGE='EVIDENCE_CHAIN'",
  "git diff --quiet \"$EVIDENCE_SHA\" \"$CURRENT_MAIN\" -- apps/api/prisma/migrations",
  "LOCAL_STAGE='SEMANTIC_DB_POSTVERIFY'",
  "REMOTE_STAGE='SEMANTIC_RUNTIME'",
  "await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')",
  "current_setting('transaction_read_only')",
  'pg_catalog.pg_roles',
  'pg_catalog.pg_auth_members',
  'pg_catalog.pg_namespace',
  'pg_catalog.pg_proc',
  'pg_catalog.pg_class',
  'pg_catalog.aclexplode',
  'pg_catalog.has_schema_privilege',
  'pg_catalog.has_function_privilege',
  'pg_catalog.has_table_privilege',
  'pg_catalog.has_sequence_privilege',
  "known.has(r.e)",
  'r.rolsuper || r.rolbypassrls || r.rolcreatedb || r.rolcreaterole || r.rolreplication || r.rolinherit',
  'Number(r.memberships)!==0',
  "owner_name='pc_auth_mail_enqueue_authority'",
  "cfg='search_path=pg_catalog, auth, pg_temp'",
  "cfg='row_security=on'",
  "SEMANTIC_POSTVERIFY|PASS",
  "PASS_SEMANTIC_PRINCIPAL",
  "PRODUCTION_DB_MUTATION|NONE",
  "API_WEB_RESTART|NONE",
  "PASSWORD_RESET|NONE",
  "MAIL_SEND|NONE",
]) need('script', script, token);

for (const regex of [
  /password-reset\/request/i,
  /forgot-password/i,
  /password-reset\/confirm/i,
  /\bcurl\b/,
  /\bwget\b/,
  /\bpsql\b/,
  /\bGRANT\s+/i,
  /\bREVOKE\s+/i,
  /\bALTER\s+(?:ROLE|TABLE|FUNCTION|SCHEMA)\b/i,
  /\bCREATE\s+(?:ROLE|TABLE|FUNCTION|SCHEMA)\b/i,
  /\bDROP\s+(?:ROLE|TABLE|FUNCTION|SCHEMA)\b/i,
  /['"]migrate['"]\s*,\s*['"]deploy['"]/i,
  /\bmigrate\s+deploy\b/i,
  /\bmigrate\s+resolve\b/i,
  /\bmigrate\s+reset\b/i,
  /\bdb\s+execute\b/i,
  /docker\s+(restart|stop|rm|kill|pause|unpause|update)\b/i,
  /docker\s+compose\s+(up|down|restart|rm|pull|run)\b/i,
  /docker\s+exec[^\n]*(?:\bbash\b|\bsh\b)/i,
]) deny('script', script, regex);

const executeCalls = script.match(/\$executeRawUnsafe\s*\(/g) || [];
if (executeCalls.length !== 1) failures.push(`script: expected exactly one executeRawUnsafe site, got ${executeCalls.length}`);
const queryCalls = script.match(/\$queryRawUnsafe\s*\(/g) || [];
if (queryCalls.length !== 3) failures.push(`script: expected exactly three queryRawUnsafe sites, got ${queryCalls.length}`);
if ((script.match(/SET TRANSACTION READ ONLY/g) || []).length !== 1) failures.push('script: read-only transaction guard count drifted');
if (/DATABASE_URL/.test(script)) failures.push('script: DATABASE_URL must not be read or published');
if (!script.includes('raw DB role / role digest / DB URL / credentials / SQL errors / PII: \\`NOT_PUBLISHED\\`')) failures.push('script: sanitized identity boundary missing');

const syntax = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' });
if (syntax.status !== 0) failures.push(`bash syntax failed: ${String(syntax.stderr).slice(0, 500)}`);

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
console.log('PASS: semantic auth-mail DB postverify v4 is owner-bound, exact-main guarded, anchored to immutable migration evidence, fail-closed on migration drift, verifies the active API principal by semantic PostgreSQL role and least-privilege ACL invariants under a transaction READ ONLY, publishes no raw identity or credentials, and cannot replay reset/mail/deploy or mutate production.');
