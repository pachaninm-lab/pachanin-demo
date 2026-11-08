import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifySourceParity } from './verify-api-schema-source-parity.mjs';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'pc-schema-source-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync('/usr/bin/git', args, { cwd: dir, encoding: 'utf8',
      env: { PATH: '/usr/bin:/bin', LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
        GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' } });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const write = (path, text) => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const commit = () => {
    git('add', '-A'); git('commit', '-qm', 'fixture');
    const sha = git('rev-parse', 'HEAD');
    git('update-ref', 'refs/remotes/origin/main', sha);
    return sha;
  };
  git('init', '-q', '-b', 'main');
  write('apps/api/prisma/schema.prisma', 'model Fixture { id String @id }\n');
  write('apps/api/prisma/migrations/20260101000000_fixture/migration.sql', 'SELECT 1;\n');
  write('infra/postgres/bootstrap.sql', 'SELECT 2;\n');
  write('apps/api/src/feature.ts', 'export const feature = 1;\n');
  const baseline = commit();
  write('apps/api/src/feature.ts', 'export const feature = 2;\n');
  let target = commit();
  const check = () => verifySourceParity({ repository: dir, baseline, target });
  const change = (path, text) => { write(path, text); target = commit(); };
  const mutate = callback => { callback(); target = commit(); };
  return { dir, git, write, commit, baseline, check, change, mutate, get target() { return target; } };
}

function held(receipt, code) {
  assert.equal(receipt.result, 'HOLD');
  assert.equal(receipt.reason, code);
  assert.equal(receipt.source_parity, 'NOT_PROVEN');
  assert.equal(receipt.database_compatibility, 'NOT_PROVEN');
  assert.equal(receipt.deployment_authorized, false);
}

test('real Git API source change proves source equality only and leaves refs/index untouched', t => {
  const f = fixture(t);
  const refs = f.git('show-ref');
  const result = f.check();
  assert.equal(result.result, 'SOURCE_PARITY_ONLY');
  assert.equal(result.source_parity, 'IDENTICAL');
  assert.equal(result.schema_entries, 3);
  assert.match(result.schema_manifest_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.runtime_baseline_binding, 'CALLER_REQUIRED_NOT_PROVEN');
  assert.equal(result.database_compatibility, 'NOT_PROVEN');
  assert.equal(result.deployment_authorized, false);
  assert.equal(result.checkout_worktree, 'NOT_ATTESTED');
  assert.equal(f.git('status', '--porcelain'), '');
  assert.equal(f.git('show-ref'), refs);
});

for (const [name, path, text] of [
  ['changed migration', 'apps/api/prisma/migrations/20260101000000_fixture/migration.sql', 'SELECT 9;'],
  ['new migration', 'apps/api/prisma/migrations/20260201000000_new/migration.sql', 'SELECT 1;'],
  ['changed schema', 'apps/api/prisma/schema.prisma', 'model Different { id String @id }'],
  ['external SQL', 'infra/postgres/bootstrap.sql', 'ALTER ROLE fixture NOLOGIN;'],
  ['new uppercase SQL with a newline name', 'infra/extra\nprivate.SQL', 'SELECT 3;'],
  ['non-SQL authority under Prisma root', 'apps/api/prisma/migration_lock.toml', 'provider="postgresql"'],
]) {
  test(`rejects ${name}`, t => {
    const f = fixture(t); f.change(path, text); held(f.check(), 'SCHEMA_SOURCE_CHANGED');
  });
}

test('rejects deleted external SQL', t => {
  const f = fixture(t);
  f.mutate(() => rmSync(join(f.dir, 'infra/postgres/bootstrap.sql')));
  held(f.check(), 'SCHEMA_SOURCE_CHANGED');
});
test('rejects an executable-mode SQL change', t => {
  const f = fixture(t);
  f.mutate(() => chmodSync(join(f.dir, 'infra/postgres/bootstrap.sql'), 0o755));
  held(f.check(), 'SCHEMA_MODE_NOT_REGULAR');
});
test('rejects a symlink replacing protected SQL', t => {
  const f = fixture(t);
  f.mutate(() => {
    rmSync(join(f.dir, 'infra/postgres/bootstrap.sql'));
    symlinkSync('/outside/source.sql', join(f.dir, 'infra/postgres/bootstrap.sql'));
  });
  held(f.check(), 'SCHEMA_MODE_NOT_REGULAR');
});
test('rejects missing schema even if other files remain', t => {
  const f = fixture(t);
  f.mutate(() => rmSync(join(f.dir, 'apps/api/prisma/schema.prisma')));
  held(f.check(), 'PRISMA_SCHEMA_MISSING');
});
test('rejects missing complete migration set', t => {
  const f = fixture(t);
  f.mutate(() => rmSync(join(f.dir, 'apps/api/prisma/migrations'), { recursive: true }));
  held(f.check(), 'MIGRATION_SET_MISSING');
});
test('rejects target/main drift', t => {
  const f = fixture(t); f.git('update-ref', 'refs/remotes/origin/main', f.baseline);
  held(f.check(), 'CURRENT_MAIN_MISMATCH');
});
test('rejects a different checkout', t => {
  const f = fixture(t); f.git('checkout', '-q', '--detach', f.baseline);
  held(f.check(), 'CHECKOUT_TARGET_MISMATCH');
});
for (const [name, path] of [['tracked', 'apps/api/src/feature.ts'], ['untracked', 'unreviewed.txt']]) {
  test(`does not attest ${name} working files from committed-tree equality`, t => {
    const f = fixture(t); f.write(path, 'dirty');
    const receipt = f.check();
    assert.equal(receipt.result, 'SOURCE_PARITY_ONLY');
    assert.equal(receipt.checkout_worktree, 'NOT_ATTESTED');
    assert.equal(receipt.deployment_authorized, false);
  });
}
for (const flag of ['--assume-unchanged', '--skip-worktree']) {
  test(`does not mistake ${flag} for working-tree proof`, t => {
    const f = fixture(t);
    f.git('update-index', flag, 'apps/api/prisma/schema.prisma');
    f.write('apps/api/prisma/schema.prisma', 'dirty working schema');
    const receipt = f.check();
    assert.equal(receipt.result, 'SOURCE_PARITY_ONLY');
    assert.equal(receipt.checkout_worktree, 'NOT_ATTESTED');
    assert.equal(receipt.database_compatibility, 'NOT_PROVEN');
    assert.equal(receipt.deployment_authorized, false);
  });
}
test('does not execute a repository-local fsmonitor hook', t => {
  const f = fixture(t);
  f.git('config', 'core.fsmonitor', '.git/fsmonitor-canary');
  writeFileSync(join(f.dir, '.git/fsmonitor-canary'), '#!/bin/sh\ntouch .git/fsmonitor-executed\nprintf "0\\0"\n', { mode: 0o755 });
  assert.equal(f.check().result, 'SOURCE_PARITY_ONLY');
  assert.equal(existsSync(join(f.dir, '.git/fsmonitor-executed')), false);
});
test('does not execute attribute clean filters', t => {
  const f = fixture(t);
  f.change('.gitattributes', 'apps/api/prisma/schema.prisma filter=review\n');
  f.git('config', 'filter.review.clean', 'touch .git/filter-executed; cat');
  f.write('apps/api/prisma/schema.prisma', 'changed working tree bytes');
  assert.equal(f.check().result, 'SOURCE_PARITY_ONLY');
  assert.equal(existsSync(join(f.dir, '.git/filter-executed')), false);
});
test('missing promisor object cannot launch a transport or lazy fetch', t => {
  const f = fixture(t);
  const tree = f.git('rev-parse', `${f.baseline}^{tree}`);
  writeFileSync(join(f.dir, '.git/lazy-fetch-canary'), '#!/bin/sh\ntouch .git/lazy-fetch-executed\nexit 1\n', { mode: 0o755 });
  f.git('config', 'extensions.partialClone', 'origin');
  f.git('config', 'remote.origin.promisor', 'true');
  f.git('config', 'remote.origin.url', 'ext::.git/lazy-fetch-canary');
  f.git('config', 'protocol.ext.allow', 'always');
  rmSync(join(f.dir, '.git/objects', tree.slice(0, 2), tree.slice(2)));
  held(f.check(), 'GIT_OBSERVATION_FAILED');
  assert.equal(existsSync(join(f.dir, '.git/lazy-fetch-executed')), false);
});
test('rejects an unrelated baseline commit with the same schema', t => {
  const f = fixture(t);
  f.git('checkout', '-q', '--orphan', 'unrelated');
  f.write('unrelated.txt', 'other history');
  const other = f.commit();
  f.git('checkout', '-q', 'main');
  f.git('update-ref', 'refs/remotes/origin/main', f.target);
  held(verifySourceParity({ repository: f.dir, baseline: other, target: f.target }), 'GIT_OBSERVATION_FAILED');
});
test('replacement refs cannot hide changed schema', t => {
  const f = fixture(t);
  f.change('apps/api/prisma/schema.prisma', 'changed schema');
  f.git('replace', f.target, f.baseline);
  held(f.check(), 'SCHEMA_SOURCE_CHANGED');
});
test('rejects a submodule which could conceal schema authorities', t => {
  const f = fixture(t);
  mkdirSync(join(f.dir, 'hidden'));
  f.git('update-index', '--add', '--cacheinfo', `160000,${f.baseline},hidden`);
  f.git('commit', '-qm', 'submodule');
  f.git('update-ref', 'refs/remotes/origin/main', f.git('rev-parse', 'HEAD'));
  held(verifySourceParity({ repository: f.dir, baseline: f.baseline, target: f.git('rev-parse', 'HEAD') }), 'SUBMODULE_NOT_ADMITTED');
});
test('rejects option-like refs and abbreviated commits', t => {
  const f = fixture(t);
  for (const baseline of ['main', f.baseline.slice(0, 7), '--upload-pack=secret', f.baseline.toUpperCase()]) {
    held(verifySourceParity({ repository: f.dir, baseline, target: f.target }), 'EXACT_COMMIT_REQUIRED');
  }
});
test('cannot use a blob as a commit', t => {
  const f = fixture(t);
  const blob = f.git('rev-parse', 'HEAD:apps/api/prisma/schema.prisma');
  held(verifySourceParity({ repository: f.dir, baseline: blob, target: f.target }), 'GIT_OBSERVATION_FAILED');
});
test('missing repository has a fixed non-sensitive failure result', () => {
  const receipt = verifySourceParity({ repository: '/missing/private-dsn-canary', baseline: 'a'.repeat(40), target: 'b'.repeat(40) });
  held(receipt, 'GIT_OBSERVATION_FAILED');
  assert.equal(JSON.stringify(receipt).includes('private-dsn-canary'), false);
});
