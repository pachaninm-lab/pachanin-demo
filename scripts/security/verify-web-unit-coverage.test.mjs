import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  auditCoverage,
  discoverTestFiles,
  executedTestFiles,
} from './verify-web-unit-coverage.mjs';

/**
 * The gate's own behaviour, checked against synthetic inputs rather than the
 * repository, so these cases still mean the same thing in a year when the real
 * numbers have moved.
 */

const UNIT = 'apps/web/tests/unit';
const kinds = (result) => result.problems.map((problem) => problem.kind);

test('a new test file that CI does not run and the registry does not name fails the gate', () => {
  const result = auditCoverage({
    discovered: [`${UNIT}/a.test.ts`, `${UNIT}/brandNew.spec.ts`],
    executed: [`${UNIT}/a.test.ts`],
    registry: { exclusions: [] },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(kinds(result), ['UNACCOUNTED_TEST_FILE']);
  assert.deepEqual(result.problems[0].files, [`${UNIT}/brandNew.spec.ts`]);
});

test('the same file passes once CI runs it', () => {
  const result = auditCoverage({
    discovered: [`${UNIT}/a.test.ts`, `${UNIT}/brandNew.spec.ts`],
    executed: [`${UNIT}/a.test.ts`, `${UNIT}/brandNew.spec.ts`],
    registry: { exclusions: [] },
  });
  assert.equal(result.ok, true, JSON.stringify(result.problems));
});

test('or once it is registered with a real reason', () => {
  const result = auditCoverage({
    discovered: [`${UNIT}/a.test.ts`, `${UNIT}/brandNew.spec.ts`],
    executed: [`${UNIT}/a.test.ts`],
    registry: {
      exclusions: [{
        file: `${UNIT}/brandNew.spec.ts`,
        reason: 'Red at inventory time; classified under the follow-up issue before it can run.',
      }],
    },
  });
  assert.equal(result.ok, true, JSON.stringify(result.problems));
});

test('a blank or token reason is a hidden exclusion and is refused', () => {
  for (const reason of ['', '   ', 'legacy', 'skip for now']) {
    const result = auditCoverage({
      discovered: [`${UNIT}/a.test.ts`],
      executed: [],
      registry: { exclusions: [{ file: `${UNIT}/a.test.ts`, reason }] },
    });
    assert.equal(result.ok, false, `reason ${JSON.stringify(reason)} should not pass`);
    assert.ok(kinds(result).includes('UNJUSTIFIED_EXCLUSION'));
  }
});

test('an exclusion for a file that no longer exists is reported, so the registry cannot rot', () => {
  const result = auditCoverage({
    discovered: [`${UNIT}/a.test.ts`],
    executed: [`${UNIT}/a.test.ts`],
    registry: {
      exclusions: [{ file: `${UNIT}/deleted.test.ts`, reason: 'This file was removed but its entry stayed behind.' }],
    },
  });
  assert.equal(result.ok, false);
  assert.ok(kinds(result).includes('STALE_EXCLUSION'));
});

test('a file both executed and excluded is refused, because one of the two is a lie', () => {
  const result = auditCoverage({
    discovered: [`${UNIT}/a.test.ts`],
    executed: [`${UNIT}/a.test.ts`],
    registry: { exclusions: [{ file: `${UNIT}/a.test.ts`, reason: 'Claims to be excluded while CI runs it.' }] },
  });
  assert.equal(result.ok, false);
  assert.ok(kinds(result).includes('EXCLUDED_BUT_EXECUTED'));
});

test('CI naming a file that is not in the tree is reported', () => {
  const result = auditCoverage({
    discovered: [`${UNIT}/a.test.ts`],
    executed: [`${UNIT}/a.test.ts`, `${UNIT}/renamedAway.test.ts`],
    registry: { exclusions: [] },
  });
  assert.equal(result.ok, false);
  assert.ok(kinds(result).includes('EXECUTED_BUT_MISSING'));
});

test('discovery takes test and spec files in both extensions, and nothing else', () => {
  const discovered = discoverTestFiles([
    `${UNIT}/a.test.ts`,
    `${UNIT}/b.test.tsx`,
    `${UNIT}/c.spec.ts`,
    `${UNIT}/d.spec.tsx`,
    `${UNIT}/helpers/fixture.ts`,
    `${UNIT}/README.md`,
    'apps/web/tests/e2e/e.spec.ts',
    'apps/api/src/x.spec.ts',
  ]);
  assert.deepEqual(discovered, [
    `${UNIT}/a.test.ts`, `${UNIT}/b.test.tsx`, `${UNIT}/c.spec.ts`, `${UNIT}/d.spec.tsx`,
  ]);
});

test('the executed list is read from the workflow, not restated', () => {
  const workflow = [
    'jobs:',
    '  web-unit:',
    '    steps:',
    '      - run: pnpm --filter @pc/web exec vitest run tests/unit/one.test.ts tests/unit/two.spec.ts',
  ].join('\n');
  assert.deepEqual(executedTestFiles(workflow), [`${UNIT}/one.test.ts`, `${UNIT}/two.spec.ts`]);
});

test('a path merely mentioned in the workflow does not count as being run', () => {
  const workflow = [
    '      # tests/unit/mentioned.test.ts was removed from this step in 2026',
    '      - run: pnpm --filter @pc/web exec vitest run tests/unit/real.test.ts',
    '      - run: cat tests/unit/alsoNotRun.spec.ts',
  ].join('\n');
  assert.deepEqual(executedTestFiles(workflow), [`${UNIT}/real.test.ts`]);
});

/**
 * The repository is checked too, but only for the properties that must hold
 * whatever the counts are - so this file does not need editing every time a
 * test is added or a registry entry is retired.
 */
test('the real repository is in one of the two accounted states', () => {
  const tracked = execFileSync('git', ['ls-files', UNIT], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const discovered = discoverTestFiles(tracked);
  assert.ok(discovered.length > 500, `expected the real unit tree, saw ${discovered.length} files`);

  const executed = executedTestFiles(readFileSync('.github/workflows/ci.yml', 'utf8'));
  assert.ok(executed.length > 0, 'the workflow must still name the files web-unit runs');

  const registry = JSON.parse(readFileSync('docs/platform-v7/qa/web-unit-coverage-registry.json', 'utf8'));
  const result = auditCoverage({ discovered, executed, registry });
  assert.deepEqual(result.problems, [], JSON.stringify(result.problems, null, 2).slice(0, 4000));
});

test('the four files #4786 found are executed, never excluded', () => {
  const registry = JSON.parse(readFileSync('docs/platform-v7/qa/web-unit-coverage-registry.json', 'utf8'));
  const excluded = new Set((registry.exclusions ?? []).map((entry) => entry.file));
  const executed = new Set(executedTestFiles(readFileSync('.github/workflows/ci.yml', 'utf8')));
  for (const name of [
    'platformV7ControlledTestOrganizations.test.ts',
    'platformV7BrowserAcceptanceRepairs.test.ts',
    'platformV7FinalAcceptanceContract.test.ts',
    'platformV7LogisticsDriverBoundary.test.ts',
  ]) {
    const file = `${UNIT}/${name}`;
    assert.ok(!excluded.has(file), `${name} must not be excluded`);
    assert.ok(executed.has(file), `${name} must be executed by CI`);
  }
});
