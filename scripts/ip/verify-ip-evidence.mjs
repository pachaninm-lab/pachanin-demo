import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room';
const required = [
  'file-provenance.csv',
  'authors.csv',
  'current-header-candidates.csv',
  'history-header-candidates.txt',
  'history-vendor-candidates.csv',
  'clean-room-summary.json',
  'license-map.csv',
  'license-summary.json',
  'public-code-match-candidates.json',
];
const missing = required.filter((name) => !existsSync(join(outDir, name)));
const sbomDir = join(outDir, 'sbom');
const sboms = existsSync(sbomDir) ? readdirSync(sbomDir) : [];
if (!sboms.some((name) => name.endsWith('.cdx.json'))) missing.push('sbom/*.cdx.json');
if (!sboms.some((name) => name.endsWith('.spdx.json'))) missing.push('sbom/*.spdx.json');
if (missing.length) {
  console.error(`IP evidence incomplete: missing ${missing.join(', ')}`);
  process.exit(1);
}

const license = JSON.parse(readFileSync(join(outDir, 'license-summary.json'), 'utf8'));
const blocked = license.classifications?.BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE ?? 0;
const unknown = license.classifications?.UNKNOWN_REVIEW ?? 0;
if (blocked > 0) {
  console.error(`IP evidence gate: ${blocked} blocked license candidate(s)`);
  process.exit(2);
}
if (unknown > 0) {
  console.error(`IP evidence gate: ${unknown} unresolved license candidate(s)`);
  process.exit(3);
}

const provenance = JSON.parse(readFileSync(join(outDir, 'clean-room-summary.json'), 'utf8'));
if (provenance.identifiedOrigins !== provenance.trackedFiles) {
  console.error(`IP evidence gate: provenance incomplete (${provenance.identifiedOrigins}/${provenance.trackedFiles})`);
  process.exit(4);
}

const publicScan = JSON.parse(readFileSync(join(outDir, 'public-code-match-candidates.json'), 'utf8'));
if (publicScan.status !== 'COMPLETE') {
  console.error('IP evidence gate: public-code screening incomplete');
  process.exit(5);
}

console.log(`IP evidence gate PASS: ${provenance.identifiedOrigins}/${provenance.trackedFiles} file origins; ${license.components} dependency components; ${publicScan.queries} public-code fingerprint queries; ${publicScan.findingCount} match candidate(s)`);
