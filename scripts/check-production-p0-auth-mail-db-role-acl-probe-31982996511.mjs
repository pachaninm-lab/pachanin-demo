#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-auth-mail-db-role-acl-probe-31982996511.yml';
const scriptPath = 'scripts/production-p0-auth-mail-db-role-acl-probe-31982996511.sh';
const checkerPath = 'scripts/check-production-p0-auth-mail-db-role-acl-probe-31982996511.mjs';
const branch = 'fix/p0-auth-mail-db-role-acl-probe-3785';
const command = '/production p0-auth-mail-db-role-acl-probe 31982996511 current-main';
const expectedChanged = [workflowPath, scriptPath, checkerPath].sort();

const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const failures = [];
const need = (where, text, token) => { if (!text.includes(token)) failures.push(`${where}: missing ${token}`); };
const deny = (where, text, regex) => { if (regex.test(text)) failures.push(`${where}: forbidden ${regex}`); };

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
for (const regex of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, regex);

for (const token of [
  `COMMAND='${command}'`,
  "[[ \"${PRODUCTION_MUTATION_ALLOWED:-false}\" == 'false' ]]",
  "[[ \"${PC_IS_PRODUCTION:-false}\" == 'true' ]]",
  "SET TRANSACTION READ ONLY",
  "current_setting('transaction_read_only')",
  "CASE current_user",
  "CASE session_user",
  "WHEN 'pc_auth_runtime' THEN 'PC_AUTH_RUNTIME'",
  "WHEN 'pc_app' THEN 'PC_APP'",
  "has_schema_privilege(current_user, 'auth', 'USAGE')",
  "has_function_privilege(",
  "'EXECUTE'",
  "ROLE_ACL|",
  "PROBE_ERROR|",
  "PROBE_EVIDENCE|",
  "raw DB role / DB URL / credentials / query errors / PII: \\`NOT_PUBLISHED\\`",
  "reset replay / mail send / deployment: \\`NONE\\`",
  "production mutation: \\`NONE\\`",
  "StrictHostKeyChecking=yes",
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
  /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|REVOKE|TRUNCATE|COPY)\b\s+/i,
  /current_user\s+AS\s+(user|role|current_user)/i,
  /session_user\s+AS\s+(user|role|session_user)/i,
]) deny('script', script, regex);

const syntax = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' });
if (syntax.status !== 0) failures.push(`bash syntax failed: ${String(syntax.stderr).slice(0, 300)}`);

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  if (process.env.GITHUB_HEAD_REF !== branch) failures.push(`PR branch mismatch ${process.env.GITHUB_HEAD_REF || 'missing'}`);
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = String(diff.stdout).trim().split('\n').filter(Boolean).sort();
  if (diff.status !== 0 || JSON.stringify(changed) !== JSON.stringify(expectedChanged)) failures.push(`PR scope mismatch ${JSON.stringify(changed)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: owner-bound exact-main role/ACL probe is read-only, publishes only classified DB principal/privilege evidence, preserves host pinning, and cannot reset, send mail, deploy, migrate, grant privileges, or mutate production.');
