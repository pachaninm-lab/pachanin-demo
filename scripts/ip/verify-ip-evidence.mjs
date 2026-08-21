import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room';
const baselineMode = process.argv.includes('--baseline');
const required = [
  'REPOSITORY_INVENTORY.json',
  'FILE_PROVENANCE.csv',
  'FILE_PROVENANCE.json',
  'CONTRIBUTORS.csv',
  'CURRENT_LICENSE_HEADER_CANDIDATES.csv',
  'HISTORY_LICENSE_HEADER_CANDIDATES.txt',
  'HISTORY_VENDOR_CANDIDATES.csv',
  'HISTORICAL_DELETED_FILES.csv',
  'RENAME_EVENTS.csv',
  'PROVENANCE_SUMMARY.json',
  'license-map.csv',
  'license-summary.json',
  'SIMILARITY_FINDINGS.csv',
  'similarity-fingerprints.json',
  'similarity-summary.json',
];
const requiredSboms = [
  'sbom/sbom-node.cdx.json',
  'sbom/sbom-node.spdx.json',
  'sbom/sbom-tai.cdx.json',
  'sbom/sbom-tai.spdx.json',
];
const missing = [...required, ...requiredSboms].filter((name) => !existsSync(join(outDir, name)) || statSync(join(outDir, name)).size === 0);
if (missing.length) {
  console.error(`IP evidence incomplete: missing or empty ${missing.join(', ')}`);
  process.exit(1);
}

for (const name of requiredSboms) {
  const document = JSON.parse(readFileSync(join(outDir, name), 'utf8'));
  if (name.endsWith('.cdx.json') && document.bomFormat !== 'CycloneDX') {
    console.error(`IP evidence gate: ${name} is not CycloneDX JSON`);
    process.exit(2);
  }
  if (name.endsWith('.spdx.json')) {
    const spdx2 = String(document.spdxVersion ?? '').startsWith('SPDX-');
    const spdx3 = /^https:\/\/spdx\.org\/rdf\/3\.[0-9.]+\/spdx-context\.jsonld$/u.test(String(document['@context'] ?? ''))
      && Array.isArray(document['@graph'])
      && document['@graph'].length > 0;
    if (!spdx2 && !spdx3) {
      console.error(`IP evidence gate: ${name} is neither SPDX 2 JSON nor SPDX 3 JSON-LD`);
      process.exit(2);
    }
  }
}

const license = JSON.parse(readFileSync(join(outDir, 'license-summary.json'), 'utf8'));
const blocked = license.classifications?.BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE ?? 0;
const unknownLicenses = license.classifications?.UNKNOWN_REVIEW ?? 0;
if (blocked > 0) {
  console.error(`IP evidence gate: ${blocked} blocked license candidate(s)`);
  process.exit(3);
}
if (!baselineMode && unknownLicenses > 0) {
  console.error(`IP evidence gate: ${unknownLicenses} unresolved dependency license candidate(s)`);
  process.exit(4);
}

const provenance = JSON.parse(readFileSync(join(outDir, 'PROVENANCE_SUMMARY.json'), 'utf8'));
if (provenance.recordedFiles !== provenance.trackedFiles) {
  console.error(`IP evidence gate: provenance coverage incomplete (${provenance.recordedFiles}/${provenance.trackedFiles})`);
  process.exit(5);
}

const similarity = JSON.parse(readFileSync(join(outDir, 'similarity-summary.json'), 'utf8'));
if (similarity.networkUsed !== false || similarity.sourceUploaded !== false) {
  console.error('IP evidence gate: similarity evidence violated the offline/no-upload boundary');
  process.exit(6);
}

const finalBlockers = [];
if (unknownLicenses > 0) finalBlockers.push(`UNKNOWN_DEPENDENCY_LICENSES:${unknownLicenses}`);
if (provenance.unknownOriginFiles > 0) finalBlockers.push(`UNKNOWN_ORIGIN_FILES:${provenance.unknownOriginFiles}`);
if (provenance.unresolvedRightsFiles > 0) finalBlockers.push(`UNRESOLVED_RIGHTS_FILES:${provenance.unresolvedRightsFiles}`);
if (provenance.crownJewelUnknownOrigin > 0) finalBlockers.push(`CROWN_JEWEL_UNKNOWN_ORIGIN:${provenance.crownJewelUnknownOrigin}`);
if (provenance.unresolvedLicenseMarkers > 0) finalBlockers.push(`UNRESOLVED_FILE_LICENSE_MARKERS:${provenance.unresolvedLicenseMarkers}`);
if (similarity.finalEligible !== true) finalBlockers.push(...(similarity.finalBlockers ?? ['SIMILARITY_NOT_FINAL_ELIGIBLE']));

if (!baselineMode && finalBlockers.length) {
  console.error(`IP final evidence gate BLOCKED: ${finalBlockers.join(', ')}`);
  process.exit(7);
}

if (baselineMode) {
  console.log(`IP evidence BASELINE_STRUCTURALLY_COMPLETE: ${provenance.recordedFiles}/${provenance.trackedFiles} tracked files; ${license.components} dependency components; exact Node/TAI CycloneDX+SPDX set; final blockers: ${finalBlockers.join(', ') || 'NONE'}`);
} else {
  console.log(`IP evidence FINAL PASS: ${provenance.recordedFiles}/${provenance.trackedFiles} origins resolved; ${license.components} dependency components; offline similarity ${similarity.status}`);
}
