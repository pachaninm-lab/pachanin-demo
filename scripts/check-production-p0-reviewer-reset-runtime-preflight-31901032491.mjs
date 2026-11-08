#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-runtime-preflight-31901032491.yml';
const scriptPath = 'scripts/production-p0-reviewer-reset-runtime-preflight-31901032491.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-runtime-preflight-31901032491.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-runtime-preflight-31901032491-3785.json';
const command = '/production p0-reviewer-reset-runtime-preflight 31901032491 current-main';
const resetRevision = '056ed4461dafb5e7dab2efc9ea5a0d5877523169';
const allowed = [workflowPath, scriptPath, checkerPath, scopePath];

const read = (p) => fs.readFileSync(p, 'utf8');
const workflow = read(workflowPath);
const script = read(scriptPath);
const scope = JSON.parse(read(scopePath));
const failures = [];
const need = (where, text, token) => { if (!text.includes(token)) failures.push(`${where}: missing ${token}`); };
const deny = (where, text, re) => { if (re.test(text)) failures.push(`${where}: forbidden ${re}`); };

for (const token of [
  'pull_request:', 'issue_comment:', 'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  'github.actor == github.repository_owner', 'github.triggering_actor == github.repository_owner',
  `github.event.comment.body == '${command}'`, "needs.contract.result == 'success'",
  `node ${checkerPath}`, `bash -n ${scriptPath}`, `bash ${scriptPath}`,
]) need('workflow', workflow, token);
for (const p of allowed) need('workflow', workflow, `      - '${p}'`);
for (const re of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, re);

for (const token of [
  `COMMAND='${command}'`, `RESET_REVISION='${resetRevision}'`,
  'default_transaction_read_only=on', 'AUTH_MAIL_RUNTIME_AND_DB_CONTRACT_READY',
  'AUTH_MAIL_CRYPTO_RUNTIME_INVALID', 'AUTH_MAIL_PRODUCER_EXECUTE_MISSING',
  'PUBLIC_SITE_ORIGIN_INVALID', 'PRODUCTION_MUTATION=NONE',
  "'pc_auth_mail_enqueue_authority'", 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)',
  'AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE', 'AUTH_MAIL_OUTBOX_KEYRING_DIR',
]) need('script', script, token);
for (const re of [
  /password-reset\/request/, /password-reset\/confirm/, /\bcurl\s/, /INSERT INTO/, /UPDATE\s+auth\./i,
  /DELETE\s+FROM/i, /TRUNCATE/i, /docker\s+(restart|stop|rm|compose\s+up)/,
]) deny('script', script, re);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push('scope schema mismatch');
if (scope.branch !== 'diag/p0-reviewer-reset-runtime-preflight-31901032491-3785' || scope.status !== 'active') failures.push('scope branch/status mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072 || scope.sourceRun !== 31901032491 || scope.sourceRevision !== resetRevision) failures.push('scope authority mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowed].sort())) failures.push('scope paths mismatch');
const b = scope.boundaries || {};
for (const key of ['databaseMutation','identityMutation','passwordMutation','mfaMutation','sessionMutation','resetReplay','mailSend','deploymentMutation','containerLifecycleMutation','piiOutput','credentialOutput','rawLogOutput']) {
  if (b[key] !== false) failures.push(`scope boundary ${key}`);
}
if (b.productionMutation !== 'NONE' || b.databaseReadOnly !== true || b.ownerOnly !== true || b.exactMainGuard !== true || b.newRecurringCostRub !== 0) failures.push('scope core boundary mismatch');

const syntax = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' });
if (syntax.status !== 0) failures.push(`bash syntax failed: ${syntax.stderr.trim().slice(0, 200)}`);

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = diff.stdout.trim().split('\n').filter(Boolean).sort();
  if (diff.status !== 0 || JSON.stringify(changed) !== JSON.stringify([...allowed].sort())) failures.push(`PR scope mismatch: ${JSON.stringify(changed)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: reviewer reset runtime preflight is owner-only, exact-revision, read-only, secret-safe, and mutation-free.');
