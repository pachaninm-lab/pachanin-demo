import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

/**
 * The out-of-scope boundary of the PC-CROP-01B.3 gate, exercised rather than
 * described.
 *
 * The gate fires on any pull request touching apps/api/src/app.module.ts. That
 * root module is a shared dependency: a change must rerun 01B.3 acceptance but
 * must not make this historical slice claim ownership of every unrelated file
 * in the pull request. Bounded scope therefore applies only when one of the
 * commodity-profile command implementation files changes. The scope directory
 * remains admitted for genuine 01B.3 changes, preserving the #4765 resolution.
 *
 * The exception is deliberately narrow, and this file exists to prove it stayed
 * narrow. A regex written to let one thing through is exactly the kind of change
 * that quietly lets more through than intended, so the cases below are mostly
 * negative: a .ts file placed INSIDE the scope directory, a nested path under
 * it, a scope-looking file in a neighbouring directory and an ordinary source
 * file all have to stay blocked.
 *
 * The pattern is read out of the workflow rather than restated here. A copy
 * would prove this file self-consistent and say nothing about the gate.
 */

const root = path.resolve(import.meta.dirname, '..');
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/pc-crop-01b3.yml'),
  'utf8',
);

function gatePattern() {
  const match = workflow.match(/grep -Ev '([^']+)'/u);
  assert.ok(match, 'the out-of-scope check is no longer a single-quoted grep -Ev');
  return match[1];
}

/**
 * Runs the gate's own expression the way the gate runs it: grep -Ev over the
 * changed-file list, where any surviving line is an out-of-scope file and a
 * zero exit status therefore means the pull request is refused.
 */
function outOfScope(changedFiles) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-crop-01b3-'));
  try {
    const list = path.join(directory, 'changed-files.txt');
    fs.writeFileSync(list, `${[...changedFiles].sort().join('\n')}\n`);
    const result = spawnSync('grep', ['-Ev', gatePattern(), list], { encoding: 'utf8' });
    return result.stdout.split('\n').filter(Boolean);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const IN_CONTOUR = [
  '.github/workflows/pc-crop-01b3.yml',
  // The gate's own boundary test, admitted on the same principle as its own
  // workflow file: a gate's definition and the proof of its definition belong
  // to the contour it governs. Without this the change could not be reviewed,
  // because the gate fires on its own workflow and would refuse the pull
  // request that carries its test.
  'scripts/verify-pc-crop-01b3-scope-boundary.test.mjs',
  'apps/api/src/app.module.ts',
  'apps/api/src/modules/commodity-profiles/commodity-profile-transaction-command.service.ts',
  'apps/api/src/modules/commodity-profiles/commodity-profile-transaction-command.service.spec.ts',
  'apps/api/src/modules/commodity-profiles/commodity-profiles.module.ts',
  'apps/api/src/modules/commodity-profiles/commodity-profiles.module.spec.ts',
  'apps/api/src/modules/commodity-profiles/postgresql-commodity-profile-transaction.port.ts',
  'apps/api/src/modules/commodity-profiles/postgresql-commodity-profile-transaction.port.spec.ts',
  'apps/api/src/modules/commodity-profiles/postgresql-commodity-profile-transaction.integration.spec.ts',
];

test('the contour it governs is still admitted in full', () => {
  assert.deepEqual(outOfScope(IN_CONTOUR), []);
});

test('shared root-module changes rerun acceptance without claiming unrelated files', () => {
  assert.match(
    workflow,
    /if \[ ! -s "\$EVIDENCE_DIR\/slice-files\.txt" \]; then\n\s*printf '%s\\n' 'SHARED_INFRASTRUCTURE_ONLY'/u,
  );
  assert.match(
    workflow,
    /grep -E '\^apps\/api\/src\/modules\/commodity-profiles\//u,
  );
});

test('a source-controlled scope file is admitted, which is the deadlock this resolves', () => {
  assert.deepEqual(
    outOfScope([
      'apps/api/src/app.module.ts',
      'docs/platform-v7/autopilot/scopes/mfa-husk-removal-4688.json',
    ]),
    [],
  );
});

test('an ordinary source file is still refused', () => {
  // The property the whole gate exists for. If this ever passes, the exception
  // has stopped being an exception.
  assert.deepEqual(
    outOfScope([
      'apps/api/src/app.module.ts',
      'apps/api/src/modules/auth/auth.service.ts',
    ]),
    ['apps/api/src/modules/auth/auth.service.ts'],
  );
});

test('a code file placed inside the scope directory is still refused', () => {
  // The sneakiest shape, and the reason the exception ends in \\.json rather
  // than matching the directory: a .ts file under the admitted path would
  // otherwise be executable code entering through a governance door.
  assert.deepEqual(
    outOfScope([
      'apps/api/src/app.module.ts',
      'docs/platform-v7/autopilot/scopes/payload.ts',
    ]),
    ['docs/platform-v7/autopilot/scopes/payload.ts'],
  );
});

test('a nested path under the scope directory is still refused', () => {
  // The character class admits no slash, so the exception is one flat directory
  // rather than a subtree.
  assert.deepEqual(
    outOfScope([
      'apps/api/src/app.module.ts',
      'docs/platform-v7/autopilot/scopes/nested/anything.json',
    ]),
    ['docs/platform-v7/autopilot/scopes/nested/anything.json'],
  );
});

test('a scope-looking JSON outside the scope directory is still refused', () => {
  // autopilot-state.json is the neighbouring governance file and carries the
  // approved-scope map itself. It is not admitted here.
  assert.deepEqual(
    outOfScope([
      'apps/api/src/app.module.ts',
      'docs/platform-v7/autopilot/autopilot-state.json',
    ]),
    ['docs/platform-v7/autopilot/autopilot-state.json'],
  );
});

test('a path that merely ends with the scope directory is still refused', () => {
  // The pattern is anchored at both ends, so a prefix cannot be forged.
  assert.deepEqual(
    outOfScope([
      'apps/api/src/app.module.ts',
      'vendor/docs/platform-v7/autopilot/scopes/forged.json',
    ]),
    ['vendor/docs/platform-v7/autopilot/scopes/forged.json'],
  );
});

test('the workflow still refuses a pull request that carries an out-of-scope file', () => {
  // Binds the assertion to the gate's reaction, not only to the pattern: a
  // surviving line has to reach an exit, or the pattern above is decorative.
  assert.match(workflow, /PC-CROP-01B\.3 contains out-of-scope files:/u);
  assert.match(workflow, /cat "\$EVIDENCE_DIR\/out-of-scope\.txt" >&2\n\s*exit 1/u);
});
