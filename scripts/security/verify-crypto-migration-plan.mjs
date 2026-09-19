#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * ASVS 5.0 V11.1.4 asks that the inventory include a documented plan for
 * migrating to new cryptographic standards.
 *
 * A plan is prose, and prose goes stale silently - which is exactly how the
 * inventory verdict came to rest on "no cryptographic inventory exists" long
 * after one existed. So the plan is held to the generated inventory: every
 * algorithm actually present in the tree must appear in it, with a trigger and
 * a target. An algorithm cannot enter the codebase without someone deciding in
 * advance how it would leave.
 */

const INVENTORY = 'docs/security/cryptographic-inventory.json';
const PLAN = 'docs/security/CRYPTO_MIGRATION_PLAN.md';

/** Algorithm names an inventory scan cannot resolve are not migration subjects. */
const UNRESOLVED = new Set(['unspecified']);

/**
 * WebCrypto reports its verbs rather than its algorithms, so the operation is
 * the migration subject there instead of each verb.
 */
const OPERATION_SUBJECTS = new Set(['webcrypto', 'csprng']);

export function migrationSubjects(inventory) {
  const subjects = new Set();
  for (const operation of inventory.operations ?? []) {
    if (!operation.sites) continue;
    if (OPERATION_SUBJECTS.has(operation.id ?? operation.operation)) {
      subjects.add(operation.operation);
      continue;
    }
    for (const algorithm of operation.algorithms ?? []) {
      const name = String(algorithm.algorithm ?? algorithm.name ?? '').toLowerCase();
      if (!name || UNRESOLVED.has(name)) continue;
      subjects.add(name);
    }
  }
  return [...subjects].sort();
}

/**
 * How each subject may be written in prose. The plan is for people, so it says
 * HMAC-SHA256 where the scanner says sha256 under the mac operation; the
 * mapping is stated here rather than the plan being forced into scanner
 * vocabulary.
 */
const ACCEPTED_SPELLINGS = {
  'aes-256-gcm': ['aes-256-gcm'],
  sha256: ['sha-256', 'sha256'],
  sha1: ['sha-1', 'sha1'],
  scrypt: ['scrypt'],
  hashsync: ['bcrypt'],
  hash: ['bcrypt'],
  csprng: ['csprng'],
  webcrypto: ['webcrypto'],
};

export function auditMigrationPlan(inventory, planText) {
  const plan = planText.toLowerCase();
  const subjects = migrationSubjects(inventory);
  const problems = [];

  const unaddressed = subjects.filter((subject) => {
    const spellings = ACCEPTED_SPELLINGS[subject] ?? [subject];
    return !spellings.some((spelling) => plan.includes(spelling));
  });
  if (unaddressed.length > 0) {
    problems.push({
      kind: 'ALGORITHM_WITHOUT_A_PLAN',
      detail: 'the inventory reports these in the tree and the plan does not mention them',
      items: unaddressed,
    });
  }

  const missingStructure = ['migration trigger', 'target', 'cost', 'post-quantum']
    .filter((heading) => !plan.includes(heading));
  if (missingStructure.length > 0) {
    problems.push({
      kind: 'PLAN_MISSING_STRUCTURE',
      detail: 'a plan without a trigger, a target, a cost and a stated post-quantum position is not a plan',
      items: missingStructure,
    });
  }

  // One trigger and one target per algorithm section, so a section cannot be
  // added as a heading with nothing underneath it.
  const triggers = (plan.match(/\*\*migration trigger\*\*/gu) ?? []).length;
  const targets = (plan.match(/\*\*target\*\*/gu) ?? []).length;
  if (triggers < subjects.length || targets < subjects.length) {
    problems.push({
      kind: 'FEWER_ENTRIES_THAN_ALGORITHMS',
      detail: `plan carries ${triggers} triggers and ${targets} targets for ${subjects.length} algorithm subjects`,
      items: subjects,
    });
  }

  return { subjects, problems, ok: problems.length === 0 };
}

function main() {
  const result = auditMigrationPlan(
    JSON.parse(readFileSync(INVENTORY, 'utf8')),
    readFileSync(PLAN, 'utf8'),
  );
  console.log(`crypto migration plan: ${result.subjects.length} algorithm subjects in the tree`);
  if (result.ok) {
    console.log('Every algorithm present in the tree has a migration trigger and a target.');
    return 0;
  }
  for (const problem of result.problems) {
    console.error(`\n${problem.kind}: ${problem.detail}`);
    for (const item of problem.items) console.error(`  ${item}`);
  }
  console.error(`\nAdd it to ${PLAN}, or explain in the inventory why it is not a migration subject.`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
