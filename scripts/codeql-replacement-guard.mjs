#!/usr/bin/env node
/**
 * Fail-closed proof that the CodeQL replacement is exactly a replacement.
 *
 * A one-for-one swap of a security control is only safe if it can be shown to
 * be one. Every way this could quietly go wrong has a check here, and each is
 * fatal rather than a warning:
 *
 *   - the corrected query silently not running, leaving the control absent;
 *   - both queries running, so the original finding comes back and the
 *     replacement looks broken;
 *   - the exclusion widening beyond the single replaced rule, dropping other
 *     security queries with it;
 *   - upstream moving underneath the fork, so the local correction is applied
 *     to a query that no longer matches what it was derived from.
 *
 * Usage:
 *   node scripts/codeql-replacement-guard.mjs selection <resolved-queries.json>
 *   node scripts/codeql-replacement-guard.mjs sarif <results.sarif>
 *   node scripts/codeql-replacement-guard.mjs drift <installed-packs.json>
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = JSON.parse(
  readFileSync(join(ROOT, 'codeql/insufficient-password-hash-corrected/upstream.lock.json'), 'utf8'),
);

const REPLACED = LOCK.replacedRuleId;
const REPLACEMENT = LOCK.replacementRuleId;

const failures = [];
const notes = [];

function check(condition, message) {
  if (condition) notes.push(`ok   ${message}`);
  else failures.push(`FAIL ${message}`);
}

function read(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    failures.push(`FAIL cannot read ${path}: ${error.message}`);
    return null;
  }
}

/** The resolved query list must be the standard suite, minus one, plus one. */
function selection(path) {
  const resolved = read(path);
  if (!resolved) return;
  const queries = Array.isArray(resolved) ? resolved : Object.keys(resolved);
  const text = queries.join('\n');

  check(queries.length > 50, `standard suite is loaded (${queries.length} queries resolved)`);
  check(
    !queries.some((q) => /Security\/CWE-916\/InsufficientPasswordHash\.ql$/.test(q)),
    `the replaced built-in query does not run (${REPLACED})`,
  );
  const replacements = queries.filter((q) => /InsufficientPasswordHashCorrected\.ql$/.test(q));
  check(replacements.length === 1, `the corrected query runs exactly once (found ${replacements.length})`);

  // The control must still be present in some form: never zero.
  check(
    replacements.length + queries.filter((q) => /InsufficientPasswordHash\.ql$/.test(q)).length >= 1,
    'the CWE-916 password-hashing control is present',
  );

  // Other security families must survive the exclusion.
  for (const family of ['CWE-079', 'CWE-089', 'CWE-078', 'CWE-022', 'CWE-327']) {
    check(text.includes(family), `other security queries retained: ${family}`);
  }
}

/** `path/to/file.ts:12:34`, or as much of it as the SARIF carries. */
function describeLocation(location) {
  const physical = location?.physicalLocation;
  const uri = physical?.artifactLocation?.uri ?? 'unknown';
  const region = physical?.region;
  if (!region?.startLine) return uri;
  return `${uri}:${region.startLine}${region.startColumn ? `:${region.startColumn}` : ''}`;
}

/** The product SARIF must show the correction took effect, and nothing else. */
function sarif(path) {
  const doc = read(path);
  if (!doc) return;
  const runs = doc.runs ?? [];
  // A query supplied by the workflow rather than by the bundled pack is
  // described in `tool.extensions`, not in `tool.driver.rules`. Looking only at
  // the driver reported the replacement rule as missing while its own result
  // was sitting in the same document.
  const rules = runs.flatMap((run) => [
    ...(run.tool?.driver?.rules ?? []),
    ...(run.tool?.extensions ?? []).flatMap((extension) => extension.rules ?? []),
  ]);
  const results = runs.flatMap((run) => run.results ?? []);
  const ruleIds = new Set(rules.map((rule) => rule.id));

  check(ruleIds.has(REPLACEMENT), `the replacement rule is present in SARIF (${REPLACEMENT})`);
  check(!ruleIds.has(REPLACED), `the replaced rule is absent from SARIF (${REPLACED})`);

  const replacement = rules.find((rule) => rule.id === REPLACEMENT);
  if (replacement) {
    const properties = replacement.properties ?? {};
    check(
      String(properties['security-severity'] ?? '') === '8.1',
      `security severity is unchanged (8.1, saw ${properties['security-severity']})`,
    );
    check(
      (properties.tags ?? []).includes('external/cwe/cwe-916'),
      'CWE-916 tag is unchanged',
    );
    check((properties.tags ?? []).includes('security'), 'security tag is unchanged');
  }

  const corrected = results.filter((result) => result.ruleId === REPLACEMENT);
  check(
    corrected.length === 0,
    `the corrected control reports no product findings (saw ${corrected.length})`,
  );
  // A residual finding is the one outcome that needs to be diagnosable from the
  // job log alone: the SARIF lives in an artifact, and "a finding somewhere in
  // this file" is not enough to tell a real defect from a barrier that does not
  // reach the shape the product actually uses. Print the whole path.
  for (const result of corrected) {
    notes.push(`     residual finding: ${result.message?.text ?? '(no message)'}`);
    for (const location of result.locations ?? []) {
      notes.push(`       at ${describeLocation(location)}`);
    }
    result.codeFlows?.forEach((flow, flowIndex) => {
      flow.threadFlows?.forEach((thread) => {
        notes.push(`       flow ${flowIndex + 1}:`);
        for (const step of thread.locations ?? []) {
          const message = step.location?.message?.text ?? '';
          notes.push(`         ${describeLocation(step.location)}${message ? ` — ${message}` : ''}`);
        }
      });
    });
  }
}

/**
 * Map a fixture line to the function that encloses it.
 *
 * A case is named by the function containing the flow's *source*, not its sink:
 * several cases deliberately share one digest site, so the sink does not
 * identify a case while the source always does.
 */
function enclosingFunction(source, line) {
  const lines = source.split('\n');
  let name = null;
  for (let index = 0; index < line && index < lines.length; index += 1) {
    const declaration = /^(?:async\s+)?function\s+([A-Za-z0-9_$]+)/.exec(lines[index]);
    if (declaration) name = declaration[1];
  }
  return name;
}

/** The `#select` rows of a `.expected` file, as the case ids they belong to. */
function reportedCases(expectedPath, fixturePath) {
  const rows = [];
  let expected;
  let fixture;
  try {
    expected = readFileSync(join(ROOT, expectedPath), 'utf8');
    fixture = readFileSync(join(ROOT, fixturePath), 'utf8');
  } catch (error) {
    failures.push(`FAIL cannot read fixture expectations: ${error.message}`);
    return rows;
  }
  const body = expected.slice(expected.indexOf('#select'));
  for (const line of body.split('\n')) {
    if (!line.startsWith('|')) continue;
    // Every location in a row looks like `file.js:startLine:startCol:endLine:endCol`.
    // The first is the alert element, the second is the source.
    const locations = [...line.matchAll(/([\w.\-]+\.js):(\d+):\d+:\d+:\d+/g)];
    if (locations.length < 2) {
      failures.push(`FAIL unparseable #select row in ${expectedPath}: ${line.slice(0, 80)}`);
      continue;
    }
    const sourceLine = Number(locations[1][2]);
    const fn = enclosingFunction(fixture, sourceLine);
    rows.push({ fn, sourceLine });
  }
  return rows;
}

/**
 * The findings must be exactly the set the manifest declares — no more, no less.
 *
 * Comparing counts would pass a run in which one case stopped alerting while
 * another started, which is precisely the regression a barrier edit causes.
 */
function expectations() {
  const manifest = read(join(ROOT, 'codeql/insufficient-password-hash-corrected/expectations.json'));
  if (!manifest) return;

  const byFixture = new Map();
  for (const testCase of manifest.cases) {
    if (!byFixture.has(testCase.fixture)) byFixture.set(testCase.fixture, []);
    byFixture.get(testCase.fixture).push(testCase);
    check(
      Boolean(testCase.id && testCase.function && testCase.rationale),
      `case ${testCase.id ?? '(unnamed)'} declares an id, a function and a reason`,
    );
    check(
      testCase.ruleId === REPLACEMENT,
      `case ${testCase.id} names the replacement rule (${testCase.ruleId ?? 'none'})`,
    );
  }

  const ids = manifest.cases.map((testCase) => testCase.id);
  check(new Set(ids).size === ids.length, `case ids are unique (${ids.length} cases)`);

  for (const [fixture, cases] of byFixture) {
    // The expectation file lives beside the fixture and is the only one there,
    // so it is found rather than derived from a naming convention.
    const dir = `codeql/insufficient-password-hash-corrected/${dirname(fixture)}`;
    const siblings = readdirSync(join(ROOT, dir)).filter((name) => name.endsWith('.expected'));
    if (siblings.length !== 1) {
      failures.push(`FAIL expected exactly one .expected file in ${dir}, found ${siblings.length}`);
      continue;
    }
    const reported = reportedCases(
      `${dir}/${siblings[0]}`,
      `codeql/insufficient-password-hash-corrected/${fixture}`,
    );

    const reportedFns = new Set(reported.map((row) => row.fn));
    const wanted = new Set(cases.filter((c) => c.expectedFinding).map((c) => c.function));

    for (const testCase of cases) {
      const found = reportedFns.has(testCase.function);
      check(
        found === testCase.expectedFinding,
        `${testCase.id}: ${testCase.expectedFinding ? 'reported' : 'silent'} as declared` +
          (found === testCase.expectedFinding ? '' : ` (saw ${found ? 'a finding' : 'none'})`),
      );
      // The lines are pinned from the CLI's own output, so a flow that moves to
      // a different source inside the same function is a change, not a detail.
      const actual = reported
        .filter((row) => row.fn === testCase.function)
        .map((row) => row.sourceLine)
        .sort((a, b) => a - b);
      const declaredLines = [...(testCase.sourceLines ?? [])].sort((a, b) => a - b);
      check(
        actual.join(',') === declaredLines.join(','),
        `${testCase.id}: source lines are [${declaredLines}]` +
          (actual.join(',') === declaredLines.join(',') ? '' : ` (saw [${actual}])`),
      );
    }

    // An undeclared finding is as much a failure as a missing one: it means the
    // query started reporting something nobody wrote a reason for.
    const declared = new Set(cases.map((c) => c.function));
    const undeclared = reported.filter((row) => row.fn === null || !declared.has(row.fn));
    check(
      undeclared.length === 0,
      `every finding in ${fixture} belongs to a declared case` +
        (undeclared.length === 0
          ? ''
          : ` (${undeclared.map((row) => `line ${row.sourceLine} → ${row.fn ?? 'no function'}`).join(', ')})`),
    );

    notes.push(
      `     ${fixture}: ${reported.length} finding(s), ${wanted.size} declared as expected`,
    );
  }
}

/** Upstream must still be the version the fork was derived from. */
function drift(path) {
  const installed = read(path);
  if (!installed) return;
  const text = JSON.stringify(installed);
  const expected = LOCK.queriesPack;

  check(
    text.includes(expected.version),
    `upstream ${expected.name} is still ${expected.version} (re-review the fork if this moves)`,
  );
  check(text.includes(expected.name), `upstream pack ${expected.name} is installed`);
}

const [mode, path] = process.argv.slice(2);
// `expectations` reads the manifest and the fixtures beside it, so it takes no
// file argument; the other modes are handed an artifact produced by the CLI.
if (!mode || (!path && mode !== 'expectations')) {
  console.error(
    'usage: codeql-replacement-guard.mjs <selection|sarif|drift> <file> | expectations',
  );
  process.exit(2);
}

if (mode === 'selection') selection(path);
else if (mode === 'sarif') sarif(path);
else if (mode === 'drift') drift(path);
else if (mode === 'expectations') expectations();
else {
  console.error(`unknown mode: ${mode}`);
  process.exit(2);
}

for (const note of notes) console.log(note);
for (const failure of failures) console.error(failure);
if (failures.length) {
  console.error(`\n${failures.length} replacement guarantee(s) violated in mode "${mode}"`);
  process.exit(1);
}
console.log(`\nreplacement guarantees hold (${mode})`);
