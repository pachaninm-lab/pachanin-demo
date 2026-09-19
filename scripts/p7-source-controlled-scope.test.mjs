import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const resolver = path.resolve('scripts/p7-source-controlled-scope.mjs');

function withDirectory(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-scope-'));
  try {
    return callback(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function write(directory, name, value) {
  fs.writeFileSync(
    path.join(directory, name),
    typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`,
  );
}

function run(directory, branch = 'agent/example') {
  return spawnSync(process.execPath, [resolver], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      GITHUB_HEAD_REF: branch,
      P7_SCOPE_DIRECTORY: directory,
    },
    encoding: 'utf8',
  });
}

function manifest(branch, overrides = {}) {
  return {
    schemaVersion: 'platform-v7.concurrent-scope.v1',
    branch,
    status: 'active',
    allowedPaths: ['z/**', 'a.ts'],
    ...overrides,
  };
}

test('returns one active exact-branch scope deterministically', () => withDirectory((directory) => {
  write(directory, 'other.json', manifest('agent/other'));
  write(directory, 'match.json', manifest('agent/example'));
  const result = run(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'a.ts\nz/**\n');
}));

test('returns no scope when the branch has no manifest', () => withDirectory((directory) => {
  write(directory, 'other.json', manifest('agent/other'));
  const result = run(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
}));

test('fails closed on duplicate exact-branch manifests', () => withDirectory((directory) => {
  write(directory, 'one.json', manifest('agent/example'));
  write(directory, 'two.json', manifest('agent/example'));
  const result = run(directory);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate manifests/u);
}));

test('fails closed on inactive matching scope', () => withDirectory((directory) => {
  write(directory, 'match.json', manifest('agent/example', { status: 'closed' }));
  const result = run(directory);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not active/u);
}));

test('fails closed on malformed JSON anywhere in the governed directory', () => withDirectory((directory) => {
  write(directory, 'match.json', manifest('agent/example'));
  write(directory, 'broken.json', '{not-json');
  const result = run(directory);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /malformed JSON/u);
}));

test('fails closed on unsafe or duplicate allowed paths', () => withDirectory((directory) => {
  write(directory, 'unsafe.json', manifest('agent/example', {
    allowedPaths: ['apps/api/**', '../escape'],
  }));
  const unsafe = run(directory);
  assert.notEqual(unsafe.status, 0);
  assert.match(unsafe.stderr, /unsafe allowed path/u);

  fs.rmSync(path.join(directory, 'unsafe.json'));
  write(directory, 'duplicate.json', manifest('agent/example', {
    allowedPaths: ['apps/api/**', 'apps/api/**'],
  }));
  const duplicate = run(directory);
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /duplicate allowedPaths/u);
}));
