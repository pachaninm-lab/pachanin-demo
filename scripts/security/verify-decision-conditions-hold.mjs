#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { evaluateDecisions } from './build-asvs-matrix.mjs';
import { conditionsHold, validateDecision } from './asvs-decisions.mjs';

/**
 * A rejected decision is silent, and it should not be.
 *
 * Every decision in the register carries conditions that are re-checked against
 * the tree on every run. That is the mechanism which makes a PASS revocable and
 * a FAIL self-closing. When a condition stops holding, the matrix builder
 * rejects the decision and the requirement falls back to NOT_ASSESSED - which is
 * the correct handling, because a decision whose basis has changed is not a
 * decision.
 *
 * What was missing is anyone noticing. The rejection is recorded in
 * ASVS_SUMMARY.json as a count and a blocker, and no gate reads either. It also
 * cannot be seen in the status counts, because a rejected decision does not
 * appear as a FAIL - it disappears into the 39 requirements that were never
 * assessed at all. So a requirement can be assessed, written up, and then
 * quietly un-assessed by an unrelated commit, and every gate stays green.
 *
 * That is not hypothetical. It is how this gate came to exist. V8.2.4's
 * condition asserts that nothing in the tree reads location as an access input,
 * and it did so with the substring "geoip". An analytics change added
 * '$geoip_disable': true - a line that turns geolocation enrichment OFF - and
 * the condition began to report that an adaptive control had appeared. The
 * decision was rejected on that basis for however long it took to notice, and
 * nothing anywhere went red.
 *
 * This gate goes red. It re-evaluates every condition against the working tree
 * and refuses any decision the matrix builder would reject.
 *
 * What it checks is the offline subset of the builder's rejection rules:
 * structural validity, duplicate requirement ids, and conditions that no longer
 * hold. The fourth rule - a decision naming a requirement absent from the
 * pinned standard - needs the downloaded standard and is left to the builder,
 * which has it.
 */

const DECISIONS = 'docs/security/asvs-applicability-decisions.json';

/**
 * Reasons a decision would be rejected, evaluated against a tree.
 *
 * The evaluation is deliberately not restated here: `evaluateDecisions` is the
 * builder's own, so this gate cannot drift into a second opinion about whether
 * a condition holds. A gate that disagrees with the thing it guards is worse
 * than no gate.
 */
export function rejectedDecisions(decisions, context) {
  const evaluated = evaluateDecisions(decisions, context);
  const rejected = [];
  const seen = new Set();

  for (const decision of evaluated) {
    const validation = validateDecision(decision);
    if (!validation.valid) {
      rejected.push({ requirementId: validation.id || '(unparseable)', problems: validation.problems });
      continue;
    }
    if (seen.has(validation.id)) {
      rejected.push({ requirementId: validation.id, problems: ['duplicate decision for the same requirement'] });
      continue;
    }
    seen.add(validation.id);
    if (!conditionsHold(decision)) {
      // Naming the failing condition and what the check actually found is the
      // difference between a gate somebody can act on and one they will
      // disable. The evidence string says which path matched, or which pattern
      // went missing.
      const broken = (decision.conditions ?? [])
        .filter((condition) => condition?.holds !== true)
        .map((condition) => `${condition?.condition ?? '?'} [${condition?.evidence ?? 'no evidence'}]`);
      rejected.push({ requirementId: validation.id, problems: [`condition no longer holds: ${broken.join('; ')}`] });
    }
  }

  return rejected;
}

export function report(rejected, total) {
  const lines = [`ASVS decision conditions: ${total} decisions re-evaluated against the tree`];
  if (rejected.length === 0) {
    lines.push('Every decision still rests on conditions that hold.');
    return { ok: true, text: lines.join('\n') };
  }
  lines.push('', `${rejected.length} decision(s) would be rejected, which silently un-assesses the requirement:`);
  for (const entry of rejected) {
    lines.push(`  ${entry.requirementId}`);
    for (const problem of entry.problems) lines.push(`    ${problem}`);
  }
  lines.push(
    '',
    'Either the tree changed and the decision must be re-made, or the condition',
    'is matching something it did not mean to. Both are edits to',
    `${DECISIONS} - neither is a reason to skip this gate.`,
  );
  return { ok: false, text: lines.join('\n') };
}

function main() {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\n')
    .filter(Boolean);
  const cache = new Map();
  const readFile = (path) => {
    if (!cache.has(path)) {
      try {
        cache.set(path, readFileSync(path, 'utf8'));
      } catch {
        cache.set(path, null);
      }
    }
    return cache.get(path);
  };

  const decisions = JSON.parse(readFileSync(DECISIONS, 'utf8')).decisions ?? [];
  const rejected = rejectedDecisions(decisions, { tracked, readFile });
  const { ok, text } = report(rejected, decisions.length);
  process.stdout.write(`${text}\n`);
  if (!ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
