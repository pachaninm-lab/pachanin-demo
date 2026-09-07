#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * ASVS 5.0 V11.1.2 asks for more than a list of keys.
 *
 * The generated inventory answers what cryptographic material exists and where
 * it appears, because that is discoverable by scanning the tree. The requirement
 * also asks where each key may and may not be used, and what data it may and may
 * not protect - which no scanner can derive, because it is a decision rather
 * than a fact about the text.
 *
 * So the decision is written down, and this holds it to the tree. The usage map
 * must name exactly the keys the inventory found, and each entry must record the
 * same files the inventory saw. A key that spreads to a new file fails the build
 * until someone revisits what that key is allowed to protect - which is the
 * question the requirement is really asking.
 */

const INVENTORY = 'docs/security/cryptographic-inventory.json';
const USAGE = 'docs/security/cryptographic-key-usage.json';

const sameSet = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

export function auditKeyUsage(inventory, usage) {
  const inventoryKeys = new Map((inventory.keyMaterial ?? []).map((k) => [k.name, k]));
  const usageKeys = new Map((usage.keys ?? []).map((k) => [k.name, k]));
  const problems = [];

  const undocumented = [...inventoryKeys.keys()].filter((name) => !usageKeys.has(name));
  if (undocumented.length > 0) {
    problems.push({
      kind: 'UNDOCUMENTED_KEY',
      detail: 'key material the inventory found with no recorded usage boundary',
      keys: undocumented,
    });
  }

  const phantom = [...usageKeys.keys()].filter((name) => !inventoryKeys.has(name));
  if (phantom.length > 0) {
    problems.push({
      kind: 'PHANTOM_KEY',
      detail: 'usage entries for key material that no longer exists in the tree',
      keys: phantom,
    });
  }

  const spread = [];
  for (const [name, entry] of usageKeys) {
    const found = inventoryKeys.get(name);
    if (!found) continue;
    if (!sameSet(entry.usedIn ?? [], found.files ?? [])) spread.push(name);
  }
  if (spread.length > 0) {
    problems.push({
      kind: 'KEY_USED_SOMEWHERE_UNDECIDED',
      detail: 'a key appears in files the usage map does not account for, or no longer appears where it says it does',
      keys: spread,
    });
  }

  const unstated = [...usageKeys.values()]
    .filter((entry) => (entry.mayProtect ?? []).length === 0 || (entry.mustNotProtect ?? []).length === 0)
    .map((entry) => entry.name);
  if (unstated.length > 0) {
    problems.push({
      kind: 'UNSTATED_BOUNDARY',
      detail: 'an entry that does not say both what the key may protect and what it may not; a blank half is not a boundary',
      keys: unstated,
    });
  }

  problems.push(...auditRotation([...usageKeys.values()]));

  return {
    inventoryKeys: inventoryKeys.size,
    documentedKeys: usageKeys.size,
    scheduledSecrets: [...usageKeys.values()].filter((entry) => entry.kind === 'secret' && entry.rotation).length,
    problems,
    ok: problems.length === 0,
  };
}

/**
 * ASVS 5.0 V13.1.4 asks the documentation to define the secrets that are critical
 * to the application and a schedule for rotating them.
 *
 * A uniform interval written across every secret would be the wrong answer twice
 * over: it would overstate what can be done for material whose rotation needs a
 * data migration, and understate what should be done for a token the provider
 * revokes in a second. So each secret records how it can actually be rotated, and
 * a secret that cannot be rotated on a calendar says so instead of carrying a
 * number nobody will honour.
 */
export const ROTATION_CADENCES = new Set(['CALENDAR', 'EVENT_DRIVEN', 'PER_RUN']);
export const ROTATION_SUPPORT = new Set([
  'OVERLAPPING_KEYS',
  'COORDINATED_CUTOVER',
  'DATA_MIGRATION_REQUIRED',
  'PROVIDER_REVOCABLE',
  'EPHEMERAL',
]);
export const ROTATION_CRITICALITY = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'NON_PRODUCTION']);

export function auditRotation(entries) {
  const problems = [];
  const unscheduled = [];
  const malformed = [];
  const misplaced = [];

  for (const entry of entries) {
    const rotation = entry.rotation;
    if (entry.kind !== 'secret') {
      if (rotation) misplaced.push(entry.name);
      continue;
    }
    if (!rotation) {
      unscheduled.push(entry.name);
      continue;
    }

    const calendar = rotation.cadence === 'CALENDAR';
    const interval = rotation.intervalDays;
    const bad = !ROTATION_CRITICALITY.has(rotation.criticality)
      || !ROTATION_CADENCES.has(rotation.cadence)
      || !ROTATION_SUPPORT.has(rotation.rotationSupport)
      || String(rotation.blastRadius || '').trim().length < 20
      || String(rotation.rationale || '').trim().length < 20
      // A calendar cadence must carry an interval, and only a calendar cadence may.
      || (calendar && !(Number.isInteger(interval) && interval > 0))
      || (!calendar && interval !== null);

    if (bad) malformed.push(entry.name);
  }

  if (unscheduled.length > 0) {
    problems.push({
      kind: 'UNSCHEDULED_SECRET',
      detail: 'a secret with no rotation record; the requirement asks for a schedule, not only an inventory',
      keys: unscheduled,
    });
  }
  if (malformed.length > 0) {
    problems.push({
      kind: 'UNUSABLE_ROTATION_RECORD',
      detail: 'a rotation record that states no criticality, no blast radius, no reasoning, or an interval that contradicts its cadence',
      keys: malformed,
    });
  }
  if (misplaced.length > 0) {
    problems.push({
      kind: 'ROTATION_ON_NON_SECRET',
      detail: 'a rotation schedule on configuration, which has nothing to rotate',
      keys: misplaced,
    });
  }

  return problems;
}

function main() {
  const result = auditKeyUsage(
    JSON.parse(readFileSync(INVENTORY, 'utf8')),
    JSON.parse(readFileSync(USAGE, 'utf8')),
  );
  console.log(`key usage: ${result.inventoryKeys} inventoried · ${result.documentedKeys} with a recorded boundary · ${result.scheduledSecrets} secrets with a rotation schedule`);
  if (result.ok) {
    console.log('Every key records where it may be used, what it may and may not protect, and every secret records how and when it is rotated.');
    return 0;
  }
  for (const problem of result.problems) {
    console.error(`\n${problem.kind}: ${problem.detail}`);
    for (const key of problem.keys) console.error(`  ${key}`);
  }
  console.error(`\nRegenerate ${INVENTORY} and record the decision in ${USAGE}.`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
