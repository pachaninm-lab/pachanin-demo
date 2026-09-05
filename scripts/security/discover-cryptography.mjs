#!/usr/bin/env node
/**
 * Repository-owned cryptographic discovery.
 *
 * ASVS V11.1.3 asks for a mechanism that identifies *all* instances of
 * cryptography, and V11.1.2 asks for an inventory of the algorithms and keys
 * in use. CodeQL does not answer either: its security suite reports the crypto
 * it considers *insecure*, so a clean CodeQL run says nothing about where
 * AES-GCM or SHA-256 are used. This enumerates instead of judging.
 *
 * What it is honest about, and the generated artefact repeats it:
 *  - the scan is static, so an algorithm assembled at runtime is not resolved;
 *  - key custody, crypto-periods and who may hold a key are not derivable from
 *    source at all, and remain an owner decision;
 *  - therefore this closes "a discovery mechanism is employed" and only
 *    partially answers "an inventory exists".
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SOURCE_EXTENSIONS = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/u;
const TEST_PATH = /(?:\.(?:spec|test)\.[cm]?[jt]sx?$)|(?:(?:^|\/)(?:tests?|__tests__)\/)/u;

/**
 * Each probe names one cryptographic operation class. `capture` pulls the
 * detail that matters for an inventory - the algorithm, not just the call.
 */
const PROBES = [
  { id: 'encryption', label: 'Symmetric encryption', call: /\bcreateCipheriv\s*\(\s*['"]([^'"]+)['"]/gu },
  { id: 'decryption', label: 'Symmetric decryption', call: /\bcreateDecipheriv\s*\(\s*['"]([^'"]+)['"]/gu },
  { id: 'hash', label: 'Hashing', call: /\bcreateHash\s*\(\s*['"]([^'"]+)['"]/gu },
  { id: 'mac', label: 'Message authentication', call: /\bcreateHmac\s*\(\s*['"]([^'"]+)['"]/gu },
  { id: 'kdf-hkdf', label: 'Key derivation (HKDF)', call: /\bhkdfSync\s*\(\s*['"]([^'"]+)['"]/gu },
  { id: 'kdf-pbkdf2', label: 'Key derivation (PBKDF2)', call: /\b(pbkdf2Sync|pbkdf2)\s*\(/gu },
  { id: 'kdf-scrypt', label: 'Key derivation (scrypt)', call: /\b(scryptSync|scrypt)\s*\(/gu },
  { id: 'password-hash', label: 'Password hashing', call: /\bbcrypt\s*\.\s*(hash|hashSync)\s*\(/gu },
  { id: 'signing', label: 'Digital signature generation', call: /\bcreateSign\s*\(/gu },
  { id: 'verification', label: 'Digital signature verification', call: /\bcreateVerify\s*\(/gu },
  { id: 'keypair', label: 'Key pair generation', call: /\bgenerateKeyPair(?:Sync)?\s*\(/gu },
  { id: 'key-exchange', label: 'Key exchange', call: /\b(createECDH|createDiffieHellman)\s*\(/gu },
  { id: 'csprng', label: 'Cryptographic randomness', call: /\brandomBytes\s*\(/gu },
  { id: 'uuid', label: 'UUID generation', call: /\brandomUUID\s*\(/gu },
  { id: 'weak-prng', label: 'Non-cryptographic randomness', call: /\bMath\s*\.\s*random\s*\(/gu },
  { id: 'constant-time', label: 'Constant-time comparison', call: /\btimingSafeEqual\s*\(/gu },
  { id: 'webcrypto', label: 'WebCrypto operations', call: /\bcrypto\s*\.\s*subtle\s*\.\s*(\w+)/gu },
];

/**
 * Names that match the key-material pattern but configure it rather than being
 * it - a keyring directory, a current-version pointer, a token budget. Kept
 * and labelled rather than dropped: where a key lives is part of an inventory,
 * and silently discarding a match would make the list look cleaner than it is.
 */
const KEY_CONFIGURATION = /(?:_DIR|_VERSION|_VERSION_FILE|_MAX_TOKENS|_TTL|_TIMEOUT|_LIMIT|_COUNT|_SIZE)$/u;

/** Key material is named, never read. The value never enters this process. */
const KEY_MATERIAL = /\b(?:requireSecret\s*\(\s*['"]([A-Z0-9_]+)['"]|process\.env\.([A-Z0-9_]*(?:KEY|SECRET|PEPPER|TOKEN)[A-Z0-9_]*))/gu;

export function scanSource(text) {
  const found = [];
  for (const probe of PROBES) {
    probe.call.lastIndex = 0;
    let match;
    while ((match = probe.call.exec(text)) !== null) {
      found.push({ probe: probe.id, label: probe.label, detail: match[1] ?? null });
    }
  }
  return found;
}

export function scanKeyMaterial(text) {
  const names = new Set();
  KEY_MATERIAL.lastIndex = 0;
  let match;
  while ((match = KEY_MATERIAL.exec(text)) !== null) {
    const name = match[1] ?? match[2];
    if (name) names.add(name);
  }
  return [...names];
}

export function buildInventory({ files, readFile }) {
  const byProbe = new Map();
  const keyMaterial = new Map();
  let scanned = 0;

  for (const path of files) {
    const text = readFile(path);
    if (text === null) continue;
    scanned += 1;
    for (const hit of scanSource(text)) {
      const bucket = byProbe.get(hit.probe) ?? { label: hit.label, algorithms: new Map(), sites: 0 };
      bucket.sites += 1;
      const algorithm = (hit.detail ?? 'unspecified').toLowerCase();
      const seen = bucket.algorithms.get(algorithm) ?? { sites: 0, files: new Set() };
      seen.sites += 1;
      seen.files.add(path);
      bucket.algorithms.set(algorithm, seen);
      byProbe.set(hit.probe, bucket);
    }
    for (const name of scanKeyMaterial(text)) {
      const seen = keyMaterial.get(name) ?? new Set();
      seen.add(path);
      keyMaterial.set(name, seen);
    }
  }

  const operations = PROBES.map((probe) => {
    const bucket = byProbe.get(probe.id);
    return {
      operation: probe.id,
      label: probe.label,
      sites: bucket?.sites ?? 0,
      algorithms: bucket
        ? [...bucket.algorithms.entries()]
          .sort((a, b) => b[1].sites - a[1].sites || a[0].localeCompare(b[0]))
          .map(([algorithm, seen]) => ({
            algorithm,
            sites: seen.sites,
            files: [...seen.files].sort(),
          }))
        : [],
    };
  });

  return {
    schemaVersion: 'pc-crop.cryptographic-inventory.v1',
    scannedFiles: scanned,
    operations,
    keyMaterial: [...keyMaterial.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, files]) => ({
        name,
        kind: KEY_CONFIGURATION.test(name) ? 'configuration' : 'secret',
        files: [...files].sort(),
      })),
    limits: [
      'Static scan: an algorithm assembled at runtime is not resolved.',
      'Names key material only. No key value is read, printed or stored.',
      'Key material is classified by name, so the secret/configuration split is a label rather than a proof.',
      'Key custody, crypto-periods and who may hold a key are not derivable from source and remain an owner decision.',
      'Absence of an operation here means absence of a recognised call, not proof that the operation cannot occur.',
    ],
  };
}

export function renderMarkdown(inventory, { sourceSha }) {
  const lines = [];
  lines.push('# Cryptographic Inventory');
  lines.push('');
  lines.push('Generated by `scripts/security/discover-cryptography.mjs`. Do not edit by hand.');
  lines.push('');
  lines.push(`Source SHA: \`${sourceSha}\``);
  lines.push(`Files scanned: ${inventory.scannedFiles}`);
  lines.push('');
  lines.push('Reproduce:');
  lines.push('');
  lines.push('```');
  lines.push('node scripts/security/discover-cryptography.mjs');
  lines.push('```');
  lines.push('');
  lines.push('## Operations');
  lines.push('');
  lines.push('| Operation | Sites | Algorithms |');
  lines.push('|---|---:|---|');
  for (const op of inventory.operations) {
    const algorithms = op.algorithms.length === 0
      ? '—'
      : op.algorithms.map((a) => `\`${a.algorithm}\` ×${a.sites}`).join(', ');
    lines.push(`| ${op.label} | ${op.sites} | ${algorithms} |`);
  }
  lines.push('');
  lines.push('## Key material');
  lines.push('');
  lines.push('Names only. No value is read by the scanner.');
  lines.push('');
  const secrets = inventory.keyMaterial.filter((key) => key.kind === 'secret');
  const configuration = inventory.keyMaterial.filter((key) => key.kind === 'configuration');
  lines.push(`### Secrets (${secrets.length})`);
  lines.push('');
  for (const key of secrets) {
    lines.push(`- \`${key.name}\` — ${key.files.length} file(s)`);
  }
  lines.push('');
  lines.push(`### Key configuration, not key material (${configuration.length})`);
  lines.push('');
  lines.push('Matched the same pattern but names where a key lives or which version is current.');
  lines.push('');
  for (const key of configuration) {
    lines.push(`- \`${key.name}\` — ${key.files.length} file(s)`);
  }
  lines.push('');
  lines.push('## What this does not tell you');
  lines.push('');
  for (const limit of inventory.limits) {
    lines.push(`- ${limit}`);
  }
  lines.push('');
  lines.push('An inventory of algorithms and key names is not a key-management policy.');
  lines.push('Where each key may and may not be used, which data each may protect, and');
  lines.push('how long it stays valid are owner decisions and are tracked separately.');
  lines.push('');
  return lines.join('\n');
}

export function trackedSourceFiles({ includeTests = false } = {}) {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\n')
    .filter(Boolean);
  return tracked.filter((path) => (
    SOURCE_EXTENSIONS.test(path)
    && (path.startsWith('apps/') || path.startsWith('packages/'))
    && !path.startsWith('apps/landing/')
    && (includeTests || !TEST_PATH.test(path))
  ));
}

const invokedAsScript = process.argv[1]
  && resolve(process.argv[1]).endsWith('discover-cryptography.mjs');

if (invokedAsScript) {
  const outJson = resolve(process.argv[2] ?? 'docs/security/cryptographic-inventory.json');
  const outMd = resolve(process.argv[3] ?? 'docs/security/CRYPTOGRAPHIC_INVENTORY.md');
  const files = trackedSourceFiles();
  const readFile = (path) => {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  };
  const inventory = buildInventory({ files, readFile });
  const sourceSha = process.env.SOURCE_SHA
    || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  writeFileSync(outMd, renderMarkdown(inventory, { sourceSha }), 'utf8');

  const used = inventory.operations.filter((op) => op.sites > 0).length;
  console.log(`Cryptographic inventory: ${inventory.scannedFiles} files scanned; ${used} operation classes present; ${inventory.keyMaterial.length} key names.`);
}
