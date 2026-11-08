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

  return {
    inventoryKeys: inventoryKeys.size,
    documentedKeys: usageKeys.size,
    problems,
    ok: problems.length === 0,
  };
}

function main() {
  const result = auditKeyUsage(
    JSON.parse(readFileSync(INVENTORY, 'utf8')),
    JSON.parse(readFileSync(USAGE, 'utf8')),
  );
  console.log(`key usage: ${result.inventoryKeys} inventoried · ${result.documentedKeys} with a recorded boundary`);
  if (result.ok) {
    console.log('Every key records where it may be used and what it may and may not protect.');
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
