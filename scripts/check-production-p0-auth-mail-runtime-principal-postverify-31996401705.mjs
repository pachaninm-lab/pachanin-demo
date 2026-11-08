#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-auth-mail-runtime-principal-postverify-31996401705.yml';
const scriptPath = 'scripts/production-p0-auth-mail-runtime-principal-postverify-31996401705.sh';
const checkerPath = 'scripts/check-production-p0-auth-mail-runtime-principal-postverify-31996401705.mjs';
const branch = 'fix/p0-auth-mail-runtime-principal-postverify-31996401705-3785';
const command = '/production p0-auth-mail-runtime-principal-postverify 31996401705 current-main';
const baseline = 'b67f6b740bd0f000c91ffb87a76cb3c104cc90d3';
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
  'persist-credentials: false',
]) need('workflow', workflow, token);
for (const path of allowed) need('workflow', workflow, `      - '${path}'`);
for (const regex of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, regex);

for (const token of [
  `COMMAND='${command}'`,
  `BASELINE_SHA='${baseline}'`,
  "UPSTREAM_COMMENT_ID='5312046784'",
  "EXPECTED_OWNER='pc_auth_mail_enqueue_authority'",
  "[[ \"${PRODUCTION_MUTATION_ALLOWED:-false}\" == 'false' ]]",
  "[[ \"${PC_IS_PRODUCTION:-false}\" == 'true' ]]",
  'git merge-base --is-ancestor "$BASELINE_SHA" "$CURRENT_MAIN"',
  'git diff --name-only "$BASELINE_SHA..$CURRENT_MAIN"',
  "LOCAL_STAGE='UPSTREAM_EVIDENCE'",
  "LOCAL_STAGE='CAPABILITY_POSTVERIFY'",
  "REMOTE_STAGE='DB_CAPABILITY_READ'",
  "REMOTE_STAGE='POST_INVARIANTS'",
  "await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')",
  "current_setting('transaction_read_only')",
  'current_user::text = session_user::text',
  'pg_catalog.pg_auth_members',
  'rolsuper', 'rolbypassrls', 'rolcreatedb', 'rolcreaterole', 'rolreplication', 'rolinherit',
  "pg_catalog.has_schema_privilege(current_user, oid, 'USAGE')",
  "pg_catalog.has_table_privilege(current_user, oid, 'SELECT')",
  'pg_catalog.aclexplode',
  'relrowsecurity', 'relforcerowsecurity',
  'pg_catalog.oidvectortypes',
  'pg_catalog.has_function_privilege(current_user, p.oid, \'EXECUTE\')',
  'p.prosecdef', 'p.proconfig',
  'SAFE_CUSTOM_APPLICATION_PRINCIPAL',
  'successor DB preflight: \\`PASS\\`',
  'AUTH_MAIL_DB_PREFLIGHT=PASS_SAFE_CAPABILITY_PRINCIPAL',
  'PRODUCTION_DB_MUTATION=NONE',
  'API_WEB_MUTATION=NONE',
  'RESET_REPLAY=NONE',
  'MAIL_SEND=NONE',
  'API_WEB_RESTART=NONE',
  'raw DB role / role digest / DB URL / credentials / raw DB errors / PII',
]) need('script', script, token);

for (const regex of [
  /password-reset\/request/i,
  /forgot-password/i,
  /password-reset\/confirm/i,
  /\bcurl\b/,
  /\bwget\b/,
  /\bpsql\b/,
  /\bdb\s+execute\b/i,
  /\bmigrate\s+deploy\b/i,
  /\bmigrate\s+resolve\b/i,
  /\bmigrate\s+reset\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bALTER\s+(ROLE|TABLE|FUNCTION)\b/i,
  /\bCREATE\s+(ROLE|TABLE|FUNCTION)\b/i,
  /\bDROP\s+(ROLE|TABLE|FUNCTION)\b/i,
  /docker\s+(restart|stop|rm|kill|pause|unpause|update)\b/i,
  /docker\s+compose\s+(up|down|restart|rm|pull|run)\b/i,
  /docker\s+exec[^\n]*(?:\bbash\b|\bsh\b)/i,
  /set\s+-x/,
  /StrictHostKeyChecking=no/,
]) deny('script', script, regex);

const executeCalls = script.match(/\$executeRawUnsafe\s*\(/g) || [];
if (executeCalls.length !== 1) failures.push(`script: expected exactly one executeRawUnsafe site, got ${executeCalls.length}`);
const queryCalls = script.match(/\$queryRawUnsafe\s*\(/g) || [];
if (queryCalls.length !== 2) failures.push(`script: expected exactly two queryRawUnsafe sites, got ${queryCalls.length}`);
if (!script.includes("- DB preflight: `BLOCK`")) failures.push('script: upstream false-block evidence is not pinned');
if (!script.includes("- effective API runtime DB role: `OTHER`")) failures.push('script: upstream OTHER classification is not pinned');
if (!script.includes("- API/Web/database mutation: `NONE`")) failures.push('script: upstream no-mutation evidence is not pinned');

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
console.log('PASS: runtime-principal postverify is owner-bound, exact-main guarded, pinned to the prior read-only BLOCK caused only by an opaque role label, permits only read-only catalog queries from the deployed API runtime, classifies the principal by least-privilege capabilities instead of its raw name, verifies RLS/function/public-ACL invariants, preserves runtime identity/restart state, publishes only sanitized evidence, and cannot reset, send mail, deploy, restart, or mutate PostgreSQL.');
