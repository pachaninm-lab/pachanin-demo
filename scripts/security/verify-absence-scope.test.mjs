import { strict as assert } from 'node:assert';
import test from 'node:test';

import { isExcluded, outsideOccurrences } from './verify-absence-scope.mjs';

const read = (map) => (path) => (Object.prototype.hasOwnProperty.call(map, path) ? map[path] : null);

/**
 * The register, the scope manifests and these scripts carry every pattern as
 * data. Counting them would make every condition look violated and the gate
 * would be switched off within a day.
 */
test('the files that carry the patterns as data are not counted as uses', () => {
  assert.equal(isExcluded('docs/security/asvs-applicability-decisions.json', []), true);
  assert.equal(isExcluded('docs/platform-v7/autopilot/scopes/x.json', []), true);
  assert.equal(isExcluded('scripts/security/verify-absence-scope.mjs', []), true);
  assert.equal(isExcluded('apps/web/app/layout.tsx', []), false);
});

/** A test naming a hazard is proving it is refused, not performing it. */
test('tests and specs are not counted as uses', () => {
  assert.equal(isExcluded('apps/api/test/industrial/a.e2e-spec.ts', []), true);
  assert.equal(isExcluded('apps/web/tests/unit/a.test.ts', []), true);
  assert.equal(isExcluded('apps/api/src/a.spec.ts', []), true);
  assert.equal(isExcluded('apps/api/src/a.ts', []), false);
});

test('files under the condition roots are not counted, since that is what the matrix already checks', () => {
  assert.equal(isExcluded('apps/api/src/deep/a.ts', ['apps/api/src']), true);
  assert.equal(isExcluded('apps/api/src', ['apps/api/src']), true);
  assert.equal(isExcluded('apps/api/scripts/a.mjs', ['apps/api/src']), false);
  assert.equal(isExcluded('apps/api/srcfoo/a.ts', ['apps/api/src']), false,
    'a root must match a path segment, not a string prefix');
});

test('an occurrence outside the roots is found, case-insensitively', () => {
  const files = ['apps/api/src/a.ts', 'apps/api/scripts/b.mjs', 'apps/web/c.ts'];
  const hits = outsideOccurrences('queryRawUnsafe', ['apps/api/src'], files, read({
    'apps/api/src/a.ts': 'clean',
    'apps/api/scripts/b.mjs': 'await prisma.$QUERYRAWUNSAFE(sql)',
    'apps/web/c.ts': 'nothing here',
  }));
  assert.deepEqual(hits, ['apps/api/scripts/b.mjs']);
});

test('a pattern that occurs nowhere outside the roots reports nothing', () => {
  const hits = outsideOccurrences('eval(', ['apps/api/src'], ['apps/api/src/a.ts', 'apps/web/b.ts'], read({
    'apps/api/src/a.ts': 'eval(x)',
    'apps/web/b.ts': 'safe',
  }));
  assert.deepEqual(hits, []);
});

test('an unreadable file is skipped rather than throwing', () => {
  assert.deepEqual(outsideOccurrences('x', [], ['missing.ts'], read({})), []);
});
