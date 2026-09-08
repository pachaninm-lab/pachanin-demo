#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A verdict that changed without anybody deciding it should.
 *
 * Every other gate in this directory asks whether one control is still there.
 * None of them asks the question that actually went wrong: did the matrix as a
 * whole say something different today than it said yesterday, and did anyone
 * mean it to?
 *
 * V8.2.4 is why this exists. Its decision rested on an ABSENT_IN_TREE condition
 * with the pattern `geoip`, meaning "no adaptive control reads location as an
 * access input". A merge that added product analytics wrote `'$geoip_disable':
 * true` into a web module - a line that switches geolocation OFF - and the
 * substring matched. The condition stopped holding, the decision was rejected,
 * and the requirement fell from FAIL to NOT_ASSESSED: a verdict quietly left
 * the matrix, from a pull request that touched no security file and named no
 * requirement. Nothing failed. It was found by hand, weeks later, by comparing
 * two runs that happened to still be on disk.
 *
 * 105 of the current decisions use ABSENT_IN_TREE, and a broad single-word
 * absence pattern is exactly this fragile. The failure mode is not that the
 * scanner is wrong - it is that no run is compared to any other, so the matrix
 * has no memory and the drift has nowhere to show up.
 *
 * So the matrix gets a memory. docs/security/asvs-verdict-baseline.json records
 * the applicability and status this repository has agreed each of the 345
 * requirements holds, plus the exact set of decisions currently being rejected.
 * Any divergence fails and names the requirement.
 *
 * Improvements fail too, and that is deliberate. A gate that only fires on
 * regressions still lets a verdict move without a human reading it, and "we got
 * better" is a claim that should be written down by whoever is making it. The
 * remedy is one line - `--write` regenerates the file - so the cost is a
 * deliberate acknowledgement, which is the whole product.
 */

export const BASELINE_PATH = 'docs/security/asvs-verdict-baseline.json';
export const BASELINE_SCHEMA = 'pc-crop.asvs-verdict-baseline.v1';

/**
 * `--write` cannot invent the reason a decision is rejected, so it writes this
 * and the gate refuses it. Regenerating therefore leaves the build red until
 * somebody replaces the sentinel with an actual sentence - which is the point:
 * a rejection is a verdict that left the matrix, and it must not become a
 * silent line in a generated file.
 */
export const UNACKNOWLEDGED = 'UNACKNOWLEDGED - describe why this rejection is open and what closes it';

/**
 * Reading the matrix the build step already wrote, rather than rebuilding it,
 * keeps this gate honest in a way a second build could not: it judges the exact
 * artifact that is uploaded as evidence, so the file in the bundle and the file
 * that was checked cannot differ.
 */
export function parseCsvRow(line) {
  const fields = [];
  let index = 0;
  while (index < line.length) {
    if (line[index] !== '"') throw new Error('ASVS matrix field is not quoted');
    index += 1;
    let value = '';
    let closed = false;
    while (index < line.length) {
      if (line[index] === '"') {
        if (line[index + 1] === '"') { value += '"'; index += 2; continue; }
        index += 1;
        closed = true;
        break;
      }
      value += line[index];
      index += 1;
    }
    if (!closed) throw new Error('ASVS matrix field is unterminated');
    fields.push(value);
    if (index === line.length) break;
    if (line[index] !== ',') throw new Error('ASVS matrix row is malformed');
    index += 1;
  }
  return fields;
}

export function readMatrixVerdicts(csv) {
  const lines = String(csv ?? '').split('\n').filter((line) => line.length > 0);
  if (lines.length < 2) throw new Error('ASVS matrix is empty');
  const headers = parseCsvRow(lines[0]);
  const idAt = headers.indexOf('requirement_id');
  const applicabilityAt = headers.indexOf('applicability');
  const statusAt = headers.indexOf('status');
  if (idAt < 0 || applicabilityAt < 0 || statusAt < 0) {
    throw new Error('ASVS matrix is missing requirement_id, applicability or status');
  }

  const verdicts = {};
  for (const line of lines.slice(1)) {
    const row = parseCsvRow(line);
    const id = row[idAt];
    if (!/^V\d+\.\d+\.\d+$/u.test(id)) throw new Error(`ASVS matrix row has no requirement id: ${line.slice(0, 60)}`);
    if (verdicts[id]) throw new Error(`ASVS matrix repeats ${id}`);
    verdicts[id] = `${row[applicabilityAt]}/${row[statusAt]}`;
  }
  return verdicts;
}

/**
 * A rejection is a decision the tree no longer supports. It has to be in the
 * baseline - otherwise the only way to keep the gate green would be to delete
 * the decision, which loses the finding - but it must never be a quiet entry.
 * Each one carries the problems that caused it, they are compared verbatim, and
 * main() prints every standing rejection on every run whether or not anything
 * changed.
 */
export function rejectionKey(entry) {
  const id = String(entry?.requirementId ?? '');
  const problems = (Array.isArray(entry?.problems) ? entry.problems : []).map((p) => String(p)).sort();
  return `${id} :: ${problems.join(' | ')}`;
}

function classify(before, after) {
  const [, wasStatus] = before.split('/');
  const [, isStatus] = after.split('/');
  if (wasStatus === 'PASS' && isStatus !== 'PASS') return 'REGRESSION';
  if (wasStatus === 'NOT_APPLICABLE' && isStatus === 'NOT_ASSESSED') return 'REGRESSION';
  if (isStatus === 'NOT_ASSESSED' && wasStatus !== 'NOT_ASSESSED') return 'EVIDENCE_ROT';
  if (isStatus === 'PASS' && wasStatus !== 'PASS') return 'IMPROVEMENT';
  return 'CHANGED';
}

export function compareVerdicts({ baseline, verdicts, rejected }) {
  const baselineVerdicts = baseline?.verdicts ?? {};
  const drift = [];
  const added = [];
  const removed = [];

  for (const [id, after] of Object.entries(verdicts)) {
    const before = baselineVerdicts[id];
    if (before === undefined) { added.push(id); continue; }
    if (before !== after) drift.push({ requirementId: id, kind: classify(before, after), before, after });
  }
  for (const id of Object.keys(baselineVerdicts)) {
    if (verdicts[id] === undefined) removed.push(id);
  }

  const baselineRejections = new Set((baseline?.rejectedDecisions ?? []).map(rejectionKey));
  const liveRejections = new Set((rejected ?? []).map(rejectionKey));
  const newRejections = [...liveRejections].filter((key) => !baselineRejections.has(key));
  const clearedRejections = [...baselineRejections].filter((key) => !liveRejections.has(key));

  drift.sort((left, right) => left.requirementId.localeCompare(right.requirementId, 'en'));
  return {
    requirements: Object.keys(verdicts).length,
    drift,
    added: added.sort(),
    removed: removed.sort(),
    newRejections: newRejections.sort(),
    clearedRejections: clearedRejections.sort(),
    standingRejections: [...liveRejections].filter((key) => baselineRejections.has(key)).sort(),
    ok: drift.length === 0
      && added.length === 0
      && removed.length === 0
      && newRejections.length === 0
      && clearedRejections.length === 0,
  };
}

/**
 * The baseline is malformed rather than merely different when it cannot be read
 * as a baseline at all. That is a separate failure from drift: an empty or
 * truncated file would otherwise report 345 additions and read like an
 * unrelated catastrophe.
 */
export function validateBaseline(baseline) {
  const problems = [];
  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) {
    return ['baseline is not an object'];
  }
  if (baseline.schemaVersion !== BASELINE_SCHEMA) problems.push(`schemaVersion is not ${BASELINE_SCHEMA}`);
  const verdicts = baseline.verdicts;
  if (!verdicts || typeof verdicts !== 'object' || Array.isArray(verdicts)) {
    problems.push('verdicts is not an object');
  } else if (Object.keys(verdicts).length === 0) {
    problems.push('verdicts is empty');
  }
  if (!Array.isArray(baseline.rejectedDecisions)) problems.push('rejectedDecisions is not an array');
  else {
    for (const entry of baseline.rejectedDecisions) {
      if (!/^V\d+\.\d+\.\d+$/u.test(String(entry?.requirementId ?? ''))) {
        problems.push('a recorded rejection has no requirement id');
      }
      if (!Array.isArray(entry?.problems) || entry.problems.length === 0) {
        problems.push(`recorded rejection ${entry?.requirementId} records no problem`);
      }
      const acknowledged = String(entry?.acknowledged ?? '').trim();
      if (!acknowledged || acknowledged.startsWith('UNACKNOWLEDGED')) {
        problems.push(`recorded rejection ${entry?.requirementId} is not acknowledged`);
      }
    }
  }
  return problems;
}

export function buildBaseline({ verdicts, rejected, summary, previous = null }) {
  const previousAcknowledgement = new Map(
    (previous?.rejectedDecisions ?? []).map((entry) => [String(entry?.requirementId ?? ''), String(entry?.acknowledged ?? '')]),
  );
  return {
    schemaVersion: BASELINE_SCHEMA,
    standard: 'OWASP ASVS',
    standardVersion: summary?.standardVersion ?? null,
    sourceCommit: summary?.sourceCommit ?? null,
    note: 'Agreed applicability/status for every requirement. Regenerate with '
      + '`node scripts/security/verify-asvs-verdict-baseline.mjs <asvs-out-dir> --write` '
      + 'in the same change that moves a verdict, so a verdict never moves unread.',
    statusCounts: summary?.statusCounts ?? null,
    applicabilityCounts: summary?.applicabilityCounts ?? null,
    rejectedDecisions: (rejected ?? []).map((entry) => ({
      requirementId: entry.requirementId,
      problems: entry.problems,
      acknowledged: previousAcknowledgement.get(entry.requirementId) || UNACKNOWLEDGED,
    })),
    verdicts,
  };
}

function main(argv) {
  const write = argv.includes('--write');
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const outDir = resolve(positional[0] ?? 'artifacts/ip-clean-room/security/asvs');

  let csv;
  let summary;
  try {
    csv = readFileSync(resolve(outDir, 'ASVS_MATRIX.csv'), 'utf8');
    summary = JSON.parse(readFileSync(resolve(outDir, 'ASVS_SUMMARY.json'), 'utf8'));
  } catch (error) {
    console.error(`ASVS evidence not found in ${outDir}: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Run scripts/security/build-asvs-matrix.mjs first - this gate judges the artifact that build wrote.');
    return 1;
  }

  const verdicts = readMatrixVerdicts(csv);
  const rejected = summary.rejectedDecisions ?? [];

  if (write) {
    let previous = null;
    try { previous = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')); } catch { previous = null; }
    const next = buildBaseline({ verdicts, rejected, summary, previous });
    writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    console.log(`ASVS verdict baseline written: ${Object.keys(verdicts).length} requirements, ${next.rejectedDecisions.length} standing rejection(s)`);
    return 0;
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch (error) {
    console.error(`ASVS verdict baseline unreadable at ${BASELINE_PATH}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  const malformed = validateBaseline(baseline);
  if (malformed.length > 0) {
    console.error(`ASVS verdict baseline is malformed at ${BASELINE_PATH}:`);
    for (const problem of malformed) console.error(`  ${problem}`);
    return 1;
  }

  const result = compareVerdicts({ baseline, verdicts, rejected });
  console.log(`ASVS verdict baseline: ${result.requirements} requirements compared against ${BASELINE_PATH}`);
  for (const key of result.standingRejections) {
    console.log(`  STANDING REJECTION ${key}`);
  }

  if (result.ok) {
    console.log('Every verdict is the one this repository agreed to.');
    return 0;
  }

  for (const entry of result.drift) {
    console.error(`  ${entry.kind} ${entry.requirementId}: ${entry.before} -> ${entry.after}`);
  }
  for (const id of result.added) console.error(`  UNBASELINED ${id}: in the matrix, absent from the baseline`);
  for (const id of result.removed) console.error(`  MISSING ${id}: in the baseline, absent from the matrix`);
  for (const key of result.newRejections) console.error(`  NEW REJECTION ${key}`);
  for (const key of result.clearedRejections) console.error(`  CLEARED REJECTION ${key}`);

  console.error('\nA verdict moved. If the change was intended, regenerate the baseline in this same change:');
  console.error(`  node scripts/security/verify-asvs-verdict-baseline.mjs ${positional[0] ?? 'artifacts/ip-clean-room/security/asvs'} --write`);
  console.error('If it was not intended, something unrelated changed what a decision measures - that is the bug.');
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
