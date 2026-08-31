#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-auth-mail-db-preflight-v2-parsefix-31981767179.yml';
const wrapperPath = 'scripts/production-p0-auth-mail-db-preflight-v2-parsefix-31981767179.sh';
const checkerPath = 'scripts/check-production-p0-auth-mail-db-preflight-v2-parsefix-31981767179.mjs';
const sourcePath = 'scripts/production-p0-auth-mail-db-preflight-v2-31981767179.sh';
const branch = 'fix/p0-auth-mail-db-preflight-v2-parsefix-3785';
const command = '/production p0-auth-mail-db-preflight-v2-parsefix 31981767179 current-main';
const expectedChanged = [workflowPath, wrapperPath, checkerPath].sort();

const workflow = fs.readFileSync(workflowPath, 'utf8');
const wrapper = fs.readFileSync(wrapperPath, 'utf8');
const source = fs.readFileSync(sourcePath, 'utf8');
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
  `bash -n ${wrapperPath}`,
  `bash ${wrapperPath}`,
  "PRODUCTION_MUTATION_ALLOWED: 'false'",
  "PC_IS_PRODUCTION: 'true'",
]) need('workflow', workflow, token);
for (const path of expectedChanged) need('workflow', workflow, `      - '${path}'`);
for (const regex of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, regex);

for (const token of [
  `COMMAND='${command}'`,
  `SOURCE='${sourcePath}'`,
  "[[ \"${PRODUCTION_MUTATION_ALLOWED:-false}\" == 'false' ]]",
  "[[ \"${PC_IS_PRODUCTION:-false}\" == 'true' ]]",
  "COMMAND='/production p0-auth-mail-db-preflight-v2 31981767179 current-main'",
  'set +e\\noutput=\\"$(ssh ',
  'if output=\\"$(ssh ',
  ')\\"; then\\n  ssh_rc=0\\nelse\\n  ssh_rc=$?\\nfi\\n\\nremote_marker=',
  'exec bash "$TMP"',
]) need('wrapper', wrapper, token);

for (const token of [
  "COMMAND='/production p0-auth-mail-db-preflight-v2 31981767179 current-main'",
  "set +e\noutput=\"$(ssh ",
  ")\"\nssh_rc=$?\nset -e\n\nremote_marker=",
  "DB_FAILURE|",
  "REMOTE_STAGE|",
  "PRODUCTION_MUTATION=NONE",
]) need('source', source, token);

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
]) deny('wrapper', wrapper, regex);

if ((wrapper.match(/text\.replace\(old, new, 1\)/g) || []).length !== 1) failures.push('wrapper: deterministic replacement loop missing');
if (!wrapper.includes("if count != 1:")) failures.push('wrapper: exact source-shape guard missing');
if (!wrapper.includes("bash -n \"$TMP\"")) failures.push('wrapper: patched script syntax validation missing');

const syntax = spawnSync('bash', ['-n', wrapperPath], { encoding: 'utf8' });
if (syntax.status !== 0) failures.push(`bash syntax failed: ${String(syntax.stderr).slice(0, 200)}`);

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
console.log('PASS: parsefix changes only the diagnostic shell error-capture semantics, preserves the previously validated read-only production DB preflight, remains owner-bound/exact-main, and cannot replay reset/mail/deploy or mutate production.');
