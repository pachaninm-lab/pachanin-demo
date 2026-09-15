#!/usr/bin/env node
// What merging the outstanding branches would do to the ASVS register.
//
// The register on main is not the sum of the work: assessments live on branches
// that have not merged, so a requirement can read FAIL on main while a branch
// already closes it. Reporting the main figure alone overstates what is left,
// and reporting the branch figure alone claims credit for work nobody can see.
// This prints both, per requirement, from the branches themselves.
//
// It also looks for the case that matters more than the count: a branch whose
// verdict for a requirement is FAVOURABLE while main's later, differently
// evidenced verdict is not. Merging such a branch would overwrite an earned
// verdict with an older reading of the same code. That is reported separately
// and loudly, because it is a regression wearing the shape of progress.
//
// This is a report, not a gate: it exits 0 unless it cannot do its job.

import { execFileSync } from 'node:child_process';

const DECISIONS = 'docs/security/asvs-applicability-decisions.json';
const FAVOURABLE = new Set(['PASS', 'NOT_APPLICABLE']);
const BASE = process.env.RECONCILE_BASE ?? 'origin/main';

function git(args) {
  // stderr is swallowed: probing a ref that predates the register is expected,
  // and git's 'exists on disk, but not in <ref>' is noise, not a result.
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

function decisionsAt(ref) {
  try {
    return JSON.parse(git(['show', `${ref}:${DECISIONS}`])).decisions;
  } catch {
    return null;
  }
}

export function statusMap(decisions) {
  return new Map((decisions ?? []).map((decision) => [decision.requirementId, decision.status]));
}

/**
 * What a branch's own commits did, not what its file happens to contain.
 *
 * A branch cut before a requirement was assessed carries no opinion about it;
 * a branch cut after carries main's. Only a difference from the branch's own
 * merge-base is that branch's work.
 */
export function branchChanges(baseStatus, headDecisions) {
  const changed = [];
  for (const decision of headDecisions ?? []) {
    const before = baseStatus.get(decision.requirementId);
    if (before !== decision.status) changed.push({ requirementId: decision.requirementId, from: before ?? 'NONE', to: decision.status });
  }
  return changed;
}

export function classify(change, mainStatus) {
  const onMain = mainStatus.get(change.requirementId) ?? 'NONE';
  if (FAVOURABLE.has(change.to) && !FAVOURABLE.has(onMain)) return 'would-resolve';
  if (!FAVOURABLE.has(change.to) && FAVOURABLE.has(onMain)) return 'would-downgrade';
  if (FAVOURABLE.has(change.to) && FAVOURABLE.has(onMain) && change.to !== onMain) return 'differs';
  return 'no-effect';
}

function sessionBranches(marker) {
  const names = git(['branch', '--format=%(refname:short)']).split('\n').filter(Boolean);
  if (!marker) return names;
  return names.filter((name) => {
    try {
      return git(['log', '--format=%B', `${BASE}..${name}`]).includes(marker);
    } catch {
      return false;
    }
  });
}

function main() {
  const mainDecisions = decisionsAt(BASE);
  if (!mainDecisions) {
    console.error(`cannot read ${DECISIONS} at ${BASE}`);
    return 1;
  }
  const mainStatus = statusMap(mainDecisions);
  const branches = sessionBranches(process.env.RECONCILE_MARKER);

  const resolve = new Map();
  const downgrade = new Map();
  let inspected = 0;

  for (const branch of branches) {
    let mergeBase;
    try {
      mergeBase = git(['merge-base', branch, BASE]).trim();
    } catch {
      continue;
    }
    const head = decisionsAt(branch);
    const base = decisionsAt(mergeBase);
    if (!head || !base) continue;
    inspected += 1;
    for (const change of branchChanges(statusMap(base), head)) {
      const verdict = classify(change, mainStatus);
      const bucket = verdict === 'would-resolve' ? resolve : verdict === 'would-downgrade' ? downgrade : null;
      if (!bucket) continue;
      if (!bucket.has(change.requirementId)) bucket.set(change.requirementId, []);
      bucket.get(change.requirementId).push({ branch, ...change });
    }
  }

  const counts = {};
  for (const decision of mainDecisions) counts[decision.status] = (counts[decision.status] ?? 0) + 1;

  console.log(`branch verdict reconciliation against ${BASE} (${inspected} branch(es) with a readable register)`);
  // Register rows, not the matrix tally: the matrix also counts a requirement
  // with no row at all as NOT_ASSESSED, so its NOT_ASSESSED is the larger number.
  console.log(`  register rows on ${BASE}: ` + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));
  console.log(`  requirements a branch would resolve but ${BASE} still counts against: ${resolve.size}`);
  for (const [requirementId, entries] of [...resolve].sort()) {
    console.log(`    ${requirementId.padEnd(9)} ${(mainStatus.get(requirementId) ?? 'NONE').padEnd(14)} -> ${entries[0].to.padEnd(15)} ${entries.map((e) => e.branch).join(', ')}`);
  }

  console.log(`\n  verdicts a branch would take away from ${BASE}: ${downgrade.size}`);
  if (downgrade.size === 0) console.log('    none');
  for (const [requirementId, entries] of [...downgrade].sort()) {
    console.log(`    ${requirementId.padEnd(9)} ${(mainStatus.get(requirementId) ?? 'NONE').padEnd(14)} -> ${entries[0].to.padEnd(15)} ${entries.map((e) => e.branch).join(', ')}`);
  }
  console.log('\nA requirement listed twice is assessed differently on two branches; read both notes before merging either.');
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
