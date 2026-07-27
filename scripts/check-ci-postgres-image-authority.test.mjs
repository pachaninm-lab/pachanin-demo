import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  checkManifests,
  checkText,
  collectScannedFiles,
  loadManifests,
  runCheck,
} from './check-ci-postgres-image-authority.mjs';

const MIRROR = 'ghcr.io/pachaninm-lab/ci-postgres';
const DIGEST = 'sha256:33f923b05f64ca54ac4401c01126a6b92afe839a0aa0a52bc5aeb5cc958e5f20';
const ALLOWED = new Set([`${MIRROR}@${DIGEST}`]);

function manifest(overrides = {}) {
  return {
    file: '.github/container-images/postgres-16.v1.json',
    manifest: {
      logical_name: 'postgres-16',
      mirrored_repository: MIRROR,
      mirrored_digest: DIGEST,
      upstream_digest: DIGEST,
      verification_status: 'VERIFIED',
      source_run_id: '30247846635',
      ...overrides,
    },
  };
}

// The six fixtures the migration must satisfy, positive first.

test('GHCR reference pinned by a verified digest passes', () => {
  assert.deepEqual(checkText('w.yml', `        image: ${MIRROR}@${DIGEST}`, ALLOWED), []);
});

test('GHCR reference on a mutable tag fails, and says so precisely', () => {
  const failures = checkText('w.yml', `        image: ${MIRROR}:16`, ALLOWED);
  assert.equal(failures.length, 1);
  // Naming the real defect matters: this *is* the mirror, wrongly pinned.
  assert.match(failures[0], /is the mirror but is pinned by a mutable tag, not a digest/);
  assert.doesNotMatch(failures[0], /is not the repository mirror/);
});

test('a digest under the mirror that no manifest verifies still fails', () => {
  const failures = checkText('w.yml', `        image: ${MIRROR}@sha256:${'a'.repeat(64)}`, ALLOWED);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /does not match any verified manifest digest/);
});

test('Docker Hub tag fails', () => {
  const failures = checkText('w.yml', '        image: postgres:16', ALLOWED);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /is not the repository mirror/);
});

test('an empty digest fails', () => {
  const failures = checkManifests([manifest({ mirrored_digest: '' })]);
  assert.ok(failures.some((f) => /mirrored_digest is empty/.test(f)));
});

test('another repository fails even when digest-pinned', () => {
  const failures = checkText('w.yml', `        image: ghcr.io/someone-else/postgres@${DIGEST}`, ALLOWED);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /is not the repository mirror/);
});

test('historical documentation outside the runtime scope does not false-fail', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-pg-authority-'));
  fs.mkdirSync(path.join(root, 'docs', 'ops'), { recursive: true });
  fs.mkdirSync(path.join(root, 'workflows'), { recursive: true });
  // A dated incident record naming the old image must stay readable as written.
  fs.writeFileSync(
    path.join(root, 'docs', 'ops', 'incident.md'),
    'On 2026-07-27 `docker pull postgres:16` timed out against registry-1.docker.io.\n',
  );
  fs.writeFileSync(path.join(root, 'workflows', 'ok.yml'), `        image: ${MIRROR}@${DIGEST}\n`);

  const scanned = [{ dir: path.join(root, 'workflows'), extensions: ['.yml'] }];
  const files = collectScannedFiles(scanned, new Set());

  assert.equal(files.length, 1);
  assert.ok(!files[0].endsWith('incident.md'));
});

// Beyond the six: the properties that make the guard fail closed rather than vacuous.

test('a direct Docker Hub reference is named even in a shell script', () => {
  const failures = checkText('s.sh', 'docker pull docker.io/library/postgres:16', ALLOWED);
  assert.ok(failures.some((f) => /direct Docker Hub PostgreSQL reference/.test(f)));
});

test('a manifest still awaiting verification blocks consumers', () => {
  const failures = checkManifests([manifest({ verification_status: 'PENDING_MIRROR_VERIFICATION' })]);
  assert.ok(failures.some((f) => /verification_status must be VERIFIED/.test(f)));
});

test('VERIFIED without the run that proved it is refused', () => {
  const failures = checkManifests([manifest({ source_run_id: null })]);
  assert.ok(failures.some((f) => /requires the run that proved it/.test(f)));
});

test('a mirror whose digest drifted from upstream is refused', () => {
  const failures = checkManifests([manifest({ upstream_digest: `sha256:${'f'.repeat(64)}` })]);
  assert.ok(failures.some((f) => /does not equal upstream_digest/.test(f)));
});

test('an empty manifest set is a refusal, not a pass', () => {
  assert.ok(checkManifests([]).some((f) => /no pinned image manifest found/.test(f)));
});

test('the repository it guards actually passes', () => {
  assert.deepEqual(runCheck(), []);
});

test('every committed manifest is verified and self-consistent', () => {
  const manifests = loadManifests();
  assert.equal(manifests.length, 3);
  assert.deepEqual(checkManifests(manifests), []);
});
