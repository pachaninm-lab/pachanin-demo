#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * A test file that exists but never runs is worse than one that does not exist.
 *
 * The absent one is honestly absent. The present one reads as a guarantee,
 * sits in the repository looking checkable, and is checked by nothing - so the
 * contract it states can drift away from the code with nothing to notice. That
 * is what #4786 found: four files were red on a clean main, and among the
 * assertions quietly not running was "uses cryptographically signed and
 * isolated cabinet sessions for every protected role".
 *
 * The cause was structural rather than accidental. The web-unit step names the
 * files it runs one by one, so adding a test file to the repository does not
 * add it to CI, and nothing anywhere compares the two lists.
 *
 * This gate compares them. Every discovered unit test file must either be
 * executed by CI or be named in the exclusion registry with a reason. A file
 * that is in neither is the failure case, because that is precisely the state
 * nobody could see before.
 */

const WORKFLOW = '.github/workflows/ci.yml';
const REGISTRY = 'docs/platform-v7/qa/web-unit-coverage-registry.json';
const TEST_DIRECTORY = 'apps/web/tests/unit';
const TEST_FILE = /\.(?:test|spec)\.tsx?$/u;

/** Every tracked unit test file, by repository path. */
export function discoverTestFiles(tracked) {
  return tracked
    .filter((path) => path.startsWith(`${TEST_DIRECTORY}/`))
    .filter((path) => TEST_FILE.test(path))
    .sort();
}

/**
 * The files CI actually runs, read from the workflow rather than restated.
 *
 * Restating them here would recreate the original defect one level up: two
 * lists that can disagree, with nothing comparing them.
 */
export function executedTestFiles(workflowText) {
  const found = new Set();
  for (const line of workflowText.split('\n')) {
    // Only what a vitest invocation actually names. Matching the whole file
    // would count a path mentioned in a comment or an artifact comment as a
    // file being run, which is the same class of mistake this gate exists to
    // catch - one level up.
    if (!/\bvitest\s+run\b/u.test(line)) continue;
    for (const match of line.matchAll(/tests\/unit\/[A-Za-z0-9._/-]+\.(?:test|spec)\.tsx?/gu)) {
      found.add(`apps/web/${match[0]}`);
    }
  }
  return [...found].sort();
}

/**
 * Compare the three lists and report every way they can disagree.
 *
 * Each disagreement is reported rather than the first one, so a contributor
 * sees the whole picture in one run instead of peeling it off one CI cycle at
 * a time.
 */
export function auditCoverage({ discovered, executed, registry }) {
  const discoveredSet = new Set(discovered);
  const executedSet = new Set(executed);
  const excluded = registry.exclusions ?? [];
  const excludedByFile = new Map(excluded.map((entry) => [entry.file, entry]));

  const problems = [];

  const unaccounted = discovered.filter((file) => !executedSet.has(file) && !excludedByFile.has(file));
  if (unaccounted.length > 0) {
    problems.push({
      kind: 'UNACCOUNTED_TEST_FILE',
      detail: 'test files that CI does not run and the registry does not name',
      files: unaccounted,
    });
  }

  const bothWays = discovered.filter((file) => executedSet.has(file) && excludedByFile.has(file));
  if (bothWays.length > 0) {
    problems.push({
      kind: 'EXCLUDED_BUT_EXECUTED',
      detail: 'files excluded from CI that CI runs anyway - the registry is describing something untrue',
      files: bothWays,
    });
  }

  const vanished = excluded.map((entry) => entry.file).filter((file) => !discoveredSet.has(file));
  if (vanished.length > 0) {
    problems.push({
      kind: 'STALE_EXCLUSION',
      detail: 'registry entries for files that no longer exist',
      files: vanished,
    });
  }

  const unjustified = excluded
    .filter((entry) => !entry.reason || String(entry.reason).trim().length < 20)
    .map((entry) => entry.file);
  if (unjustified.length > 0) {
    problems.push({
      kind: 'UNJUSTIFIED_EXCLUSION',
      detail: 'exclusions without a concrete reason; a blank reason is a hidden exclusion',
      files: unjustified,
    });
  }

  const missingFromCi = executed.filter((file) => !discoveredSet.has(file));
  if (missingFromCi.length > 0) {
    problems.push({
      kind: 'EXECUTED_BUT_MISSING',
      detail: 'CI names files that are not in the tree, so the step is silently running less than it lists',
      files: missingFromCi,
    });
  }

  return {
    discovered: discovered.length,
    executed: executed.length,
    excluded: excluded.length,
    problems,
    ok: problems.length === 0,
  };
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', TEST_DIRECTORY], { encoding: 'utf8' }).split('\n').filter(Boolean);
}

function main() {
  const discovered = discoverTestFiles(trackedFiles());
  const executed = executedTestFiles(readFileSync(WORKFLOW, 'utf8'));
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  const result = auditCoverage({ discovered, executed, registry });

  console.log(
    `web-unit coverage: ${result.discovered} test files · ${result.executed} executed · ${result.excluded} excluded`,
  );

  if (result.ok) {
    console.log('Every unit test file is either executed by CI or registered with a reason.');
    return 0;
  }

  for (const problem of result.problems) {
    console.error(`\n${problem.kind}: ${problem.detail}`);
    for (const file of problem.files.slice(0, 40)) console.error(`  ${file}`);
    if (problem.files.length > 40) console.error(`  ... and ${problem.files.length - 40} more`);
  }
  console.error(
    '\nA unit test file must be run by CI or carry a registered reason why it is not.'
    + `\nAdd it to the web-unit step in ${WORKFLOW}, or register it in ${REGISTRY}.`,
  );
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
