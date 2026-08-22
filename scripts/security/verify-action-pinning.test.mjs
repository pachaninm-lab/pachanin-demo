import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = 'scripts/security/verify-action-pinning.mjs';
const SHA = '0'.repeat(40);

function fixture({ workflows, ceiling }) {
  const root = mkdtempSync(join(tmpdir(), 'action-pin-'));
  const dir = join(root, 'workflows');
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(workflows)) {
    writeFileSync(join(dir, name), body);
  }
  const baseline = join(root, 'baseline.json');
  writeFileSync(baseline, JSON.stringify({ schemaVersion: 1, maxFloatingReferences: ceiling, pinnedReferences: 0 }));
  return { root, dir, baseline };
}

function run(f) {
  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, ACTION_PIN_WORKFLOW_DIR: f.dir, ACTION_PIN_BASELINE: f.baseline },
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

function withFixture(options, assertion) {
  const f = fixture(options);
  try {
    assertion(run(f));
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
}

test('references at the baseline pass', () => {
  withFixture({
    workflows: { 'a.yml': 'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v4\n' },
    ceiling: 1,
  }, ({ status, out }) => {
    assert.equal(status, 0);
    assert.match(out, /ACTION_PINNING: WITHIN_BASELINE/u);
  });
});

test('a floating branch fails even when under the ceiling', () => {
  withFixture({
    workflows: { 'a.yml': 'jobs:\n  x:\n    steps:\n      - uses: aquasecurity/trivy-action@master\n' },
    ceiling: 500,
  }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /floating branch reference aquasecurity\/trivy-action@master/u);
  });
});

test('@main and @HEAD are treated as floating branches too', () => {
  for (const ref of ['some/action@main', 'some/action@HEAD']) {
    withFixture({
      workflows: { 'a.yml': `jobs:\n  x:\n    steps:\n      - uses: ${ref}\n` },
      ceiling: 500,
    }, ({ status, out }) => {
      assert.equal(status, 1);
      assert.match(out, /floating branch reference/u);
    });
  }
});

test('adding an unpinned action above the ceiling fails', () => {
  withFixture({
    workflows: { 'a.yml': 'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n' },
    ceiling: 1,
  }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /floating references rose from 1 to 2/u);
  });
});

test('a SHA-pinned action does not count against the ceiling', () => {
  withFixture({
    workflows: { 'a.yml': `jobs:\n  x:\n    steps:\n      - uses: actions/checkout@${SHA}\n      - uses: actions/setup-node@${SHA}\n` },
    ceiling: 0,
  }, ({ status, out }) => {
    assert.equal(status, 0);
    assert.match(out, /pinned to commit SHA {3}2/u);
  });
});

test('local actions are not treated as third-party references', () => {
  withFixture({
    workflows: { 'a.yml': 'jobs:\n  x:\n    steps:\n      - uses: ./.github/actions/local\n' },
    ceiling: 0,
  }, ({ status, out }) => {
    assert.equal(status, 0);
    assert.match(out, /local actions {10}1/u);
  });
});

test('replacing a floating tag with a SHA is reported as slack to tighten', () => {
  withFixture({
    workflows: { 'a.yml': `jobs:\n  x:\n    steps:\n      - uses: actions/checkout@${SHA}\n` },
    ceiling: 3,
  }, ({ status, out }) => {
    assert.equal(status, 0);
    assert.match(out, /floating references fell to 0/u);
  });
});

test('an unreadable baseline fails closed', () => {
  const f = fixture({ workflows: { 'a.yml': 'jobs: {}\n' }, ceiling: 0 });
  try {
    rmSync(f.baseline);
    const { status, out } = run(f);
    assert.equal(status, 1);
    assert.match(out, /cannot read baseline/u);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('a malformed baseline ceiling fails closed', () => {
  const f = fixture({ workflows: { 'a.yml': 'jobs: {}\n' }, ceiling: 0 });
  try {
    writeFileSync(f.baseline, JSON.stringify({ maxFloatingReferences: -3 }));
    const { status, out } = run(f);
    assert.equal(status, 1);
    assert.match(out, /not a non-negative integer/u);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
