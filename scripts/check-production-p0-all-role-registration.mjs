#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PREVIOUS_CHECKER_BLOB = '6cf81bdb7f598eb7f45792b4169bf480611083b7';
const DECISION_BFF = 'apps/web/app/api/auth/organization-join-requests/[applicationId]/decision/route.ts';

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
} finally {
  rmSync(dir, { recursive: true, force: true });
}
