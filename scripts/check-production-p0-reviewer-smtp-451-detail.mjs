#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-smtp-451-detail.yml';
const runnerPath = 'scripts/production-p0-reviewer-smtp-451-detail.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-smtp-451-detail-4136.json';
const sourcePath = 'scripts/production-p0-reviewer-smtp-stage-probe.sh';
const sourceBlob = 'd4fade37d316e15e9d1bc33fa2fde89929f7db55';
const command = '/production p0-reviewer-smtp-451-detail current-main';
const branch = 'diag/p0-reviewer-smtp-451-detail-4136';
const allowed = [workflowPath, runnerPath, 'scripts/check-production-p0-reviewer-smtp-451-detail.mjs', scopePath];

const workflow = fs.readFileSync(workflowPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');
const source = fs.readFileSync(sourcePath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
const failures = [];
const need = (where, text, token) => { if (!text.includes(token)) failures.push(`${where}: missing ${token}`); };
const deny = (where, text, re) => { if (re.test(text)) failures.push(`${where}: forbidden ${re}`); };

for (const token of [
  'pull_request:', 'issue_comment:', 'github.event.issue.number == 3072',
  "github.event.comment.author_association == 'OWNER'", 'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner', `github.event.comment.body == '${command}'`,
  'needs.contract.outputs.target_sha', `bash ${runnerPath}`,
]) need('workflow', workflow, token);
for (const p of allowed) need('workflow', workflow, `      - '${p}'`);
for (const re of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, re);

for (const token of [
  `COMMAND='${command}'`, `SOURCE_BLOB='${sourceBlob}'`, 'PC_REVIEWER_SMTP_451_DETAIL_VALIDATE_ONLY',
  "ENHANCED_STATUS='NONE'", "REASON_CLASS='NONE'", 'UNCLASSIFIED_451', 'RATE_LIMIT',
  'GREYLIST_TEMPORARY', 'ANTI_ABUSE_POLICY', 'DESTINATION_ROUTING_TEMPFAIL', 'RECIPIENT_TEMPFAIL',
  'TEMPORARY_POLICY', "compile(source, '<probe.py>', 'exec')", 'remains pre-DATA',
  'FORBIDDEN_PROBE_OPERATION', "'api/auth/forgot-password'", 'bash "$TMP"',
]) need('runner', runner, token);
for (const re of [/password-reset\/request/i, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('runner', runner, re);

const hash = spawnSync('git', ['hash-object', sourcePath], { encoding: 'utf8' });
if (hash.status !== 0 || hash.stdout.trim() !== sourceBlob) failures.push('source stage-probe blob mismatch');
need('source', source, "COMMAND='/production p0-reviewer-smtp-stage-probe current-main'");
need('source', source, "f'RCPT TO:<{recipient}>'");
need('source', source, "sock.sendall(b'RSET\\r\\n')");
if (/sock\.sendall\(b['"]DATA/i.test(source)) failures.push('source unexpectedly sends literal DATA');

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push('scope schema mismatch');
if (scope.branch !== branch || scope.status !== 'active') failures.push('scope branch/status mismatch');
if (scope.issue !== 4136 || scope.registrationMatrixIssue !== 3785 || scope.releaseIssue !== 3072) failures.push('scope authority mismatch');
if (scope.sourceBlob !== sourceBlob) failures.push('scope source blob mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowed].sort())) failures.push('scope allowed paths mismatch');
const b = scope.boundaries || {};
for (const [key, expected] of Object.entries({
  productionMutation: 'NONE', databaseMutation: false, passwordResetRequest: false, mailSend: false,
  smtpDataCommand: false, reviewerIdentityOutput: false, rawProtocolOutput: false, credentialOutput: false,
  ownerOnly: true, exactMainGuard: true, newRecurringCostRub: 0,
})) if (b[key] !== expected) failures.push(`scope boundary ${key} mismatch`);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-smtp-451-detail-'));
try {
  const proc = spawnSync('bash', [runnerPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      RUNNER_TEMP: dir,
      PC_REVIEWER_SMTP_451_DETAIL_COMMAND: command,
      PC_REVIEWER_SMTP_451_DETAIL_VALIDATE_ONLY: '1',
    },
  });
  if (proc.status !== 0) failures.push(`transformed wrapper validation failed: ${proc.stderr.trim().slice(0, 500)}`);
  if (!proc.stdout.includes('PASS: transformed reviewer SMTP 451 detail wrapper validated')) failures.push('transformed wrapper PASS sentinel missing');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = diff.stdout.trim().split('\n').filter(Boolean).sort();
  if (diff.status !== 0 || JSON.stringify(changed) !== JSON.stringify([...allowed].sort())) failures.push(`PR scope mismatch: ${JSON.stringify(changed)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: reviewer SMTP 451 detail is source-blob pinned, enhanced-status classified, raw-response private, and cannot send DATA or replay reset.');
