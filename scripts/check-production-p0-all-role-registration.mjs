#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PREVIOUS_CHECKER_BLOB = '6cf81bdb7f598eb7f45792b4169bf480611083b7';
const DECISION_BFF = 'apps/web/app/api/auth/organization-join-requests/[applicationId]/decision/route.ts';
const RUNNER = 'scripts/production-p0-all-role-registration.sh';
const EMPLOYEE_REPLAY_OVERLAY = 'scripts/p0-employee-join-replay-contract-overlay.py';

function fail(message) {
  console.error(`P0_ALL_ROLE_CHECKER_OVERLAY_ERROR=${String(message)
    .toUpperCase()
    .replace(/[^A-Z0-9_=|:-]/g, '_')
    .slice(0, 300)}`);
  process.exit(1);
}

const bff = readFileSync(DECISION_BFF, 'utf8');
for (const marker of [
  "const notificationDelivered = notification?.status === 'SENT';",
  "code: 'REGISTRATION_DECISION_NOTIFICATION_PENDING'",
  "if (payload.replayed === true) return json({ ...payload, correlationId }, 200);",
  "return json({ ...payload, notificationDelivered, correlationId }, 200);",
]) {
  if (!bff.includes(marker)) fail(`durable decision BFF marker missing: ${marker}`);
}
if (bff.includes('let notificationDelivered = false;')) {
  fail('legacy synchronous decision notification marker remains');
}

const runner = readFileSync(RUNNER, 'utf8');
const replayOverlay = readFileSync(EMPLOYEE_REPLAY_OVERLAY, 'utf8');
for (const marker of [
  'python3 scripts/p0-employee-join-replay-contract-overlay.py "$tmp"',
  'P0_ALL_ROLE_EMPLOYEE_JOIN_REPLAY_PUBLIC_CONTRACT=PASS',
]) {
  if (!runner.includes(marker)) fail(`employee replay runner marker missing: ${marker}`);
}
for (const marker of [
  "p.get('nextAction') != 'LOGIN'",
  "p.get('replayed') is not True",
  "or 'notificationDelivered' in p",
  "p.get('notificationDelivered') is not True",
  'P0_ALL_ROLE_EMPLOYEE_JOIN_REPLAY_PUBLIC_CONTRACT=PASS',
]) {
  if (!replayOverlay.includes(marker)) fail(`employee replay overlay marker missing: ${marker}`);
}

const replayDir = mkdtempSync(path.join(tmpdir(), 'pc-p0-employee-replay-overlay-'));
const replayFixture = path.join(replayDir, 'executor.sh');
const freshDecisionAssertion = `if p.get('status') != 'ACTIVATED' or p.get('nextAction') != 'LOGIN' or p.get('replayed') is not False or p.get('notificationDelivered') is not True:\n    raise SystemExit(1)\n`;
const staleReplayAssertion = `if p.get('status') != 'ACTIVATED' or p.get('replayed') is not True or p.get('notificationDelivered') is not False:\n    raise SystemExit(1)\n`;
try {
  writeFileSync(replayFixture, `${freshDecisionAssertion}${staleReplayAssertion}`, {
    encoding: 'utf8',
    mode: 0o700,
  });
  const overlayResult = spawnSync('python3', [EMPLOYEE_REPLAY_OVERLAY, replayFixture], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (overlayResult.status !== 0) {
    fail(`employee replay overlay execution failed: ${overlayResult.stderr.trim()}`);
  }
  if (!overlayResult.stdout.includes('P0_ALL_ROLE_EMPLOYEE_JOIN_REPLAY_PUBLIC_CONTRACT=PASS')) {
    fail('employee replay overlay success marker missing');
  }
  const replayPatched = readFileSync(replayFixture, 'utf8');
  if (replayPatched.includes(staleReplayAssertion)) {
    fail('stale employee replay assertion remains');
  }
  for (const marker of [
    "p.get('status') != 'ACTIVATED'",
    "p.get('nextAction') != 'LOGIN'",
    "p.get('replayed') is not True",
    "or 'notificationDelivered' in p",
  ]) {
    if (!replayPatched.includes(marker)) fail(`patched employee replay assertion missing: ${marker}`);
  }
  if (!replayPatched.includes(freshDecisionAssertion)) {
    fail('fresh employee join delivery assertion was not preserved');
  }
} finally {
  rmSync(replayDir, { recursive: true, force: true });
}

const blob = spawnSync('git', ['cat-file', 'blob', PREVIOUS_CHECKER_BLOB], {
  encoding: 'utf8',
});
if (blob.status !== 0 || !blob.stdout) {
  fail('previous checker blob unavailable');
}
const actualBlob = spawnSync('git', ['hash-object', '--stdin'], {
  input: blob.stdout,
  encoding: 'utf8',
});
if (actualBlob.status !== 0 || actualBlob.stdout.trim() !== PREVIOUS_CHECKER_BLOB) {
  fail('previous checker blob mismatch');
}

const oldLine =
  "const decisionNotification = decisionBff.indexOf('let notificationDelivered = false;', decisionErrorPassthrough);";
const newLine =
  "const decisionNotification = decisionBff.indexOf(\"const notificationDelivered = notification?.status === 'SENT';\", decisionErrorPassthrough);";
const count = blob.stdout.split(oldLine).length - 1;
if (count !== 1) fail(`checker patch cardinality=${count}`);

const patched = blob.stdout.replace(oldLine, newLine);
const dir = mkdtempSync(path.join(tmpdir(), 'pc-p0-all-role-checker-overlay-'));
const target = path.join(dir, 'checker.mjs');
try {
  writeFileSync(target, patched, { encoding: 'utf8', mode: 0o700 });
  const result = spawnSync(process.execPath, [target], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log('P0_ALL_ROLE_DURABLE_DECISION_CHECKER_COMPATIBILITY=PASS');
  console.log('P0_ALL_ROLE_EMPLOYEE_JOIN_REPLAY_CHECKER=PASS');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
