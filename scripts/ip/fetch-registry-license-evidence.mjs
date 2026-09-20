#!/usr/bin/env node
/**
 * Registry licence evidence for components the build cannot resolve locally.
 *
 * build-license-map.mjs resolves an undeclared licence by reading the installed
 * package manifest, and refuses to guess when nothing is installed. That refusal is
 * correct and stays. But it leaves a whole class permanently UNKNOWN: platform-
 * specific optional packages -- prebuilt binaries for other operating systems and
 * architectures -- which are real dependencies of the build on those platforms and
 * are simply never installed on this one.
 *
 * Their licences are knowable from a primary source: the package manifest the
 * registry publishes for that exact version, which is the same artifact the build
 * would install elsewhere. This script fetches that manifest and records the licence
 * together with the registry URL and the published dist integrity, so the claim is
 * checkable rather than asserted. Anyone can re-fetch and compare.
 *
 * Deliberately a separate, online step. build-license-map.mjs stays offline and
 * deterministic; it consumes the file this produces exactly as it consumes the
 * reviewed overrides. Nothing here is inferred from a package name.
 *
 * Usage: node scripts/ip/fetch-registry-license-evidence.mjs <license-map.csv> [out]
 */

import { readFileSync, writeFileSync } from 'node:fs';

const mapPath = process.argv[2] ?? 'artifacts/ip-clean-room/license-map.csv';
const outPath = process.argv[3] ?? 'docs/ip/registry-license-evidence.json';
const REGISTRY = 'https://registry.npmjs.org';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; } else quoted = false;
      } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(readFileSync(mapPath, 'utf8').trim());
const header = rows[0];
const records = rows.slice(1).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index]])));

// Only components the offline build could not resolve. A component with a declared
// or installed licence is never touched: local evidence outranks a network lookup.
const unresolved = records.filter((record) => record.detected_license === 'UNKNOWN' && !record.evidence);

process.stderr.write(`${unresolved.length} component(s) to resolve from the registry\n`);

const entries = [];
const failures = [];

for (const [index, record] of unresolved.entries()) {
  const name = record.component;
  const version = record.version;
  const url = `${REGISTRY}/${name.replace('/', '%2F')}/${version}`;
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) {
      failures.push({ name, version, url, reason: `HTTP ${response.status}` });
      continue;
    }
    const manifest = await response.json();
    const license = typeof manifest.license === 'string'
      ? manifest.license
      : (manifest.license?.type ?? '');
    if (!license) {
      failures.push({ name, version, url, reason: 'registry manifest declares no license field' });
      continue;
    }
    entries.push({
      purl: record.purl,
      name,
      version,
      license,
      registryUrl: url,
      distIntegrity: manifest.dist?.integrity ?? '',
      distShasum: manifest.dist?.shasum ?? '',
      manifestVersion: manifest.version ?? '',
    });
  } catch (error) {
    failures.push({ name, version, url, reason: error.message });
  }
  if ((index + 1) % 10 === 0) process.stderr.write(`${index + 1}/${unresolved.length}\n`);
}

// A manifest served for a version other than the one requested does not describe the
// artifact this build would install, so it is dropped rather than recorded.
const mismatched = entries.filter((entry) => entry.manifestVersion && entry.manifestVersion !== entry.version);
for (const entry of mismatched) {
  failures.push({ ...entry, reason: `registry served version ${entry.manifestVersion} for requested ${entry.version}` });
}
const sound = entries.filter((entry) => !mismatched.includes(entry));

const document = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: REGISTRY,
  purpose: 'Licence read from the registry-published manifest for components the build does not install locally, chiefly platform-specific optional binaries. Consumed offline by scripts/ip/build-license-map.mjs. Primary-source evidence, not inference from package names.',
  limits: [
    'Records what the registry publishes for that exact version. It does not audit the package contents against its declared licence.',
    'Local evidence outranks this: a component whose licence the SBOM declares, or whose installed manifest can be read, is never resolved from here.',
    'Re-fetching should reproduce these values. A change in the published manifest is a signal to re-review, not to update silently.',
  ],
  resolved: sound.length,
  unresolved: failures.length,
  entries: sound.sort((left, right) => left.name.localeCompare(right.name)),
  failures,
};

writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ resolved: sound.length, failures: failures.length, out: outPath }, null, 2)}\n`);
