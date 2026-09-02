#!/usr/bin/env node
// Supply-chain ratchet for GitHub Actions references.
//
// The programme requires every third-party action to be pinned to an immutable
// commit SHA. That is not the current state, and pinning ~1000 references in one
// change would be exactly the kind of sweeping migration the programme forbids.
//
// This gate does the part that can be enforced honestly today:
//   1. a floating BRANCH reference (@master, @main, @HEAD) always fails - it is
//      the worst class, since the referenced code can change with no change here;
//   2. the number of floating references may never rise above the recorded
//      baseline, so the debt can shrink but never grow.
//
// It does not claim the repository is pinned. Run with --update-baseline after a
// slice that genuinely reduces the count.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOW_DIR = process.env.ACTION_PIN_WORKFLOW_DIR ?? '.github/workflows';
const BASELINE_PATH = process.env.ACTION_PIN_BASELINE ?? 'docs/security/supply-chain-action-baseline.json';
const UPDATE = process.argv.includes('--update-baseline');

const USES = /^[^\S\n]*-?[^\S\n]*uses:[^\S\n]*(['"]?)([^\s'"#]+)\1/gmu;
const PINNED_SHA = /@[0-9a-f]{40}$/u;
const FLOATING_BRANCH = /@(?:master|main|HEAD)$/u;

export function scanWorkflows(directory) {
  const local = [];
  const pinned = [];
  const floatingTag = [];
  const floatingBranch = [];

  let entries;
  try {
    entries = readdirSync(directory).filter((name) => /\.ya?ml$/u.test(name)).sort();
  } catch (error) {
    throw new Error(`cannot read workflow directory ${directory}: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const name of entries) {
    const file = join(directory, name);
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(USES)) {
      const reference = match[2];
      const record = { file: name, reference };
      if (reference.startsWith('./') || reference.startsWith('.\\')) local.push(record);
      else if (PINNED_SHA.test(reference)) pinned.push(record);
      else if (FLOATING_BRANCH.test(reference)) floatingBranch.push(record);
      else floatingTag.push(record);
    }
  }

  return { local, pinned, floatingTag, floatingBranch };
}

function main() {
  const scan = scanWorkflows(WORKFLOW_DIR);
  const floatingTotal = scan.floatingTag.length + scan.floatingBranch.length;

  if (UPDATE) {
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify({
        schemaVersion: 1,
        note: 'Ratchet baseline. Floating references may fall but never rise. Floating branches are always a failure.',
        maxFloatingReferences: floatingTotal,
        pinnedReferences: scan.pinned.length,
      }, null, 2)}\n`,
    );
    console.log(`baseline updated: maxFloatingReferences=${floatingTotal}`);
    return 0;
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch (error) {
    console.error(`ACTION_PINNING: FAIL_CLOSED - cannot read baseline ${BASELINE_PATH}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  const allowed = Number(baseline.maxFloatingReferences);
  if (!Number.isInteger(allowed) || allowed < 0) {
    console.error('ACTION_PINNING: FAIL_CLOSED - baseline maxFloatingReferences is not a non-negative integer');
    return 1;
  }

  console.log('GitHub Actions pinning ratchet');
  console.log(`  pinned to commit SHA   ${scan.pinned.length}`);
  console.log(`  floating tags          ${scan.floatingTag.length}`);
  console.log(`  floating branches      ${scan.floatingBranch.length}`);
  console.log(`  local actions          ${scan.local.length}`);
  console.log(`  baseline ceiling       ${allowed}`);

  // The pinned count is a floor, the mirror of the floating ceiling.
  //
  // It was written by --update-baseline and never read, so it asserted nothing.
  // The ceiling alone does not cover unpinning: turning one SHA back into a tag
  // raises floating by one AND lowers pinned by one, so the ceiling catches it -
  // but unpinning one action while deleting another floating reference in the
  // same change leaves floating exactly at the ceiling and passes, with the
  // pinned count quietly one lower. That is the case this floor catches.
  const requiredPinned = Number(baseline.pinnedReferences);
  if (!Number.isInteger(requiredPinned) || requiredPinned < 0) {
    console.error('ACTION_PINNING: FAIL_CLOSED - baseline pinnedReferences is not a non-negative integer');
    return 1;
  }
  console.log(`  baseline pinned floor  ${requiredPinned}`);

  const failures = [];

  for (const item of scan.floatingBranch) {
    failures.push(`floating branch reference ${item.reference} in ${item.file}`);
  }

  if (floatingTotal > allowed) {
    failures.push(`floating references rose from ${allowed} to ${floatingTotal}; new actions must be pinned to a commit SHA`);
  }

  if (scan.pinned.length < requiredPinned) {
    failures.push(`pinned references fell from ${requiredPinned} to ${scan.pinned.length}; an action already pinned to a commit SHA must not be unpinned`);
  }

  if (failures.length > 0) {
    console.error('\nACTION_PINNING: FAIL_CLOSED');
    for (const failure of failures) console.error(`  - ${failure}`);
    return 1;
  }

  if (floatingTotal < allowed || scan.pinned.length > requiredPinned) {
    console.log(`\n  note: floating fell to ${floatingTotal} and pinned rose to ${scan.pinned.length}; run --update-baseline to tighten the ratchet.`);
  }

  console.log('\nACTION_PINNING: WITHIN_BASELINE');
  console.log('  This is not a claim that actions are pinned. Historical debt remains; see SUPPLY_CHAIN_MATRIX.md.');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
