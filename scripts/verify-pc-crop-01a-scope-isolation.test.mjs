import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const resolver = path.join(root, 'scripts/p7-source-controlled-scope.mjs');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/pc-crop-01a.yml'), 'utf8');
const verifier = fs.readFileSync(path.join(root, 'scripts/verify-pc-crop-01a.mjs'), 'utf8');

function withScopeDirectory(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-crop-01a-scope-'));
  try {
    return callback(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function writeManifest(directory, name, value) {
  fs.writeFileSync(
    path.join(directory, name),
    typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`,
  );
}

function manifest(overrides = {}) {
  return {
    schemaVersion: 'platform-v7.concurrent-scope.v1',
    branch: 'authorized/ip-metadata',
    status: 'active',
    allowedPaths: ['packages/domain-core/package.json', 'docs/ip/**'],
    ...overrides,
  };
}

function resolveScope(directory) {
  return spawnSync(process.execPath, [resolver], {
    cwd: root,
    env: {
      ...process.env,
      GITHUB_HEAD_REF: 'authorized/ip-metadata',
      P7_SCOPE_DIRECTORY: directory,
    },
    encoding: 'utf8',
  });
}

test('workflow delegates the complete diff to the central guard without a branch bypass', () => {
  assert.match(workflow, /GITHUB_HEAD_REF: \$\{\{ github\.head_ref \}\}/u);
  assert.match(workflow, /BASE_REF: origin\/main/u);
  assert.match(workflow, /HEAD_REF: HEAD/u);
  assert.match(workflow, /bash scripts\/p7-autopilot-guard\.sh/u);
  assert.match(workflow, /node --test scripts\/verify-pc-crop-01a-scope-isolation\.test\.mjs/u);
  assert.doesNotMatch(workflow, /git update-ref/u);
  assert.doesNotMatch(workflow, /pc-crop-01b4-private-bff-live-registry/u);
  assert.doesNotMatch(workflow, /pc-crop-01b4-postmerge-remediation/u);
  assert.doesNotMatch(workflow, /continue-on-error/u);
});

test('foundation verifier keeps frozen invariants and no longer claims unrelated paths', () => {
  assert.match(verifier, /const ownedDiff = diff\.filter\(\(path\) => EXPECTED_PATHS\.has\(path\)\)/u);
  assert.match(verifier, /externalScopeAuthority: 'CENTRAL_P7_AUTOPILOT_GUARD'/u);
  assert.match(verifier, /PC_PROFILE_VERSION_IMMUTABLE/u);
  assert.match(verifier, /PC_PROFILE_EFFECTIVE_OVERLAP/u);
  assert.doesNotMatch(verifier, /isSuccessorOwnedPath/u);
  assert.doesNotMatch(verifier, /files outside exact foundation or declared successor scope/u);
});

test('one active exact-branch scope resolves deterministic IP metadata paths', () => withScopeDirectory((directory) => {
  writeManifest(directory, 'scope.json', manifest());
  const result = resolveScope(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'docs/ip/**\npackages/domain-core/package.json\n');
}));

test('malformed, duplicate, inactive and unsafe scopes all fail closed', () => {
  const cases = [
    {
      name: 'malformed',
      setup(directory) { writeManifest(directory, 'scope.json', '{not-json'); },
      expected: /malformed JSON/u,
    },
    {
      name: 'duplicate manifests',
      setup(directory) {
        writeManifest(directory, 'one.json', manifest());
        writeManifest(directory, 'two.json', manifest());
      },
      expected: /duplicate manifests/u,
    },
    {
      name: 'inactive',
      setup(directory) { writeManifest(directory, 'scope.json', manifest({ status: 'closed' })); },
      expected: /not active/u,
    },
    {
      name: 'unsafe',
      setup(directory) { writeManifest(directory, 'scope.json', manifest({ allowedPaths: ['../escape'] })); },
      expected: /unsafe allowed path/u,
    },
    {
      name: 'duplicate paths',
      setup(directory) {
        writeManifest(directory, 'scope.json', manifest({
          allowedPaths: ['docs/ip/**', 'docs/ip/**'],
        }));
      },
      expected: /duplicate allowedPaths/u,
    },
  ];

  for (const scenario of cases) {
    withScopeDirectory((directory) => {
      scenario.setup(directory);
      const result = resolveScope(directory);
      assert.notEqual(result.status, 0, scenario.name);
      assert.match(result.stderr, scenario.expected, scenario.name);
    });
  }
});
