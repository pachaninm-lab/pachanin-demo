#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * A decision that cites a file which no longer exists.
 *
 * This programme keeps finding verdicts that rested on facts which had quietly
 * stopped being true - a draw that was removed, an inventory that came to
 * exist, a timestamp that was already stored, a pathway that mints nothing.
 * Most of those live in prose and no scanner will catch them. But one form is
 * mechanical: a decision naming a file the tree no longer has, or a condition
 * pointing at one.
 *
 * The condition case is the dangerous one. A condition is how a PASS revokes
 * itself, and an ABSENT_AT_PATH check against a file that does not exist finds
 * nothing missing - so it holds, silently, forever. The decision would look
 * self-revoking while being unable to revoke.
 *
 * This refuses both.
 */

const DECISIONS = 'docs/security/asvs-applicability-decisions.json';

/**
 * Evidence entries are not all paths. Some are semantic labels the assessment
 * uses to say why something is not applicable - repository-scan:no-ldap-integration,
 * stack-mismatch:jndi-is-java-specific - and some are label:path pairs. Only the
 * part that looks like a repository path is checked, so a label is not mistaken
 * for a missing file.
 */
const PATH_LIKE = /^[\w./[\]@-]+\/[\w.[\]@-]+\.\w+$/u;

export function evidencePaths(entry) {
  if (typeof entry !== 'string' || entry.startsWith('depends-on:')) return [];
  const tail = entry.split(':').pop() ?? '';
  return PATH_LIKE.test(tail) ? [tail] : [];
}

export function auditDecisionEvidence({ decisions, tracked, requirementIds, directoryExists }) {
  const trackedSet = new Set(tracked);
  const known = new Set(requirementIds);
  const problems = [];
  const add = (kind, detail, items) => items.length > 0 && problems.push({ kind, detail, items });

  const missingEvidence = [];
  const missingConditionPath = [];
  const missingRoot = [];
  const danglingDependsOn = [];
  const duplicateIds = [];
  const seen = new Set();

  for (const decision of decisions) {
    const id = decision.requirementId;
    if (seen.has(id)) duplicateIds.push(id);
    seen.add(id);

    for (const entry of decision.evidence ?? []) {
      if (typeof entry === 'string' && entry.startsWith('depends-on:')) {
        const target = entry.slice('depends-on:'.length);
        if (!known.has(target)) danglingDependsOn.push(`${id} -> ${target}`);
        continue;
      }
      for (const path of evidencePaths(entry)) {
        if (!trackedSet.has(path)) missingEvidence.push(`${id}: ${path}`);
      }
    }

    for (const condition of decision.conditions ?? []) {
      for (const path of condition.paths ?? []) {
        if (!trackedSet.has(path)) missingConditionPath.push(`${id}: ${path}`);
      }
      for (const root of condition.roots ?? []) {
        if (!directoryExists(root)) missingRoot.push(`${id}: ${root}`);
      }
    }
  }

  add('CONDITION_PATH_GONE',
    'a self-revoking condition points at a file that no longer exists; an absence check against a missing file always holds, so the decision cannot revoke itself',
    missingConditionPath);
  add('CONDITION_ROOT_GONE',
    'a condition scans a directory that no longer exists, so it scans nothing',
    missingRoot);
  add('EVIDENCE_FILE_GONE',
    'a decision cites a file the tree no longer has',
    missingEvidence);
  add('DEPENDS_ON_UNKNOWN',
    'a decision depends on a requirement id that is not in the standard',
    danglingDependsOn);
  add('DUPLICATE_REQUIREMENT',
    'the same requirement is decided twice, so which decision applies depends on order',
    duplicateIds);

  return { decisions: decisions.length, problems, ok: problems.length === 0 };
}

function main() {
  const doc = JSON.parse(readFileSync(DECISIONS, 'utf8'));
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter(Boolean);
  const requirementIds = doc.decisions.map((d) => d.requirementId);

  const result = auditDecisionEvidence({
    decisions: doc.decisions,
    tracked,
    requirementIds,
    directoryExists: (root) => existsSync(root),
  });

  console.log(`decision evidence: ${result.decisions} decisions checked against the tree`);
  if (result.ok) {
    console.log('Every cited file and every condition path still exists.');
    return 0;
  }
  for (const problem of result.problems) {
    console.error(`\n${problem.kind}: ${problem.detail}`);
    for (const item of problem.items.slice(0, 40)) console.error(`  ${item}`);
    if (problem.items.length > 40) console.error(`  ... and ${problem.items.length - 40} more`);
  }
  console.error(`\nUpdate ${DECISIONS}: a decision that cites something gone is a decision nobody can check.`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
