import { existsSync, lstatSync, readFileSync } from 'node:fs';
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
  'SBOM_COVERAGE.json',
  'SBOM_COVERAGE.md',
];
const requiredSboms = [
  'sbom/sbom-node.cdx.json',
  'sbom/sbom-node.spdx.json',
  'sbom/sbom-tai.cdx.json',
  'sbom/sbom-tai.spdx.json',
];
const missing = [...required, ...requiredSboms].filter((name) => {
  const path = join(outDir, name);
  if (!existsSync(path)) return true;
  const metadata = lstatSync(path);
  return !metadata.isFile() || metadata.size === 0;
});
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

const coverage = JSON.parse(readFileSync(join(outDir, 'SBOM_COVERAGE.json'), 'utf8'));
const coverageRecords = Array.isArray(coverage.manifests) ? coverage.manifests : [];
const coverageManifestNames = coverageRecords.map((record) => record.manifest);
const uniqueCoverageManifestNames = new Set(coverageManifestNames);
const coveredRecords = coverageRecords.filter((record) => record.status === 'COVERED');
const uncoveredRecords = coverageRecords.filter((record) => record.status === 'UNCOVERED');
const invalidCoverageRecords = coverageRecords.filter((record) => !['COVERED', 'UNCOVERED'].includes(record.status));
const expectedCoveragePercent = coverageRecords.length > 0
  ? Number(((coveredRecords.length / coverageRecords.length) * 100).toFixed(2))
  : -1;
const expectedCoverageStatus = uncoveredRecords.length === 0 ? 'COMPLETE' : 'BASELINE_WITH_KNOWN_GAPS';
const knownCoverageGaps = Array.isArray(coverage.knownGaps) ? coverage.knownGaps : [];
const actualGapPairs = uncoveredRecords.map((record) => `${record.manifest}\u0000${record.reason}`).sort();
const declaredGapPairs = knownCoverageGaps.map((gap) => `${gap.manifest}\u0000${gap.reason}`).sort();
const sourceShaMatches = !process.env.SOURCE_SHA || coverage.sourceSha === process.env.SOURCE_SHA;
if (coverage.schemaVersion !== 1
  || !/^[0-9a-f]{40}$/u.test(String(coverage.sourceSha ?? ''))
  || !sourceShaMatches
  || coverageRecords.length === 0
  || uniqueCoverageManifestNames.size !== coverageRecords.length
  || invalidCoverageRecords.length > 0
  || coverage.totals?.manifests !== coverageRecords.length
  || coverage.totals?.covered !== coveredRecords.length
  || coverage.totals?.uncovered !== uncoveredRecords.length
  || coverage.totals?.coveragePercent !== expectedCoveragePercent
  || coverage.status !== expectedCoverageStatus
  || JSON.stringify(actualGapPairs) !== JSON.stringify(declaredGapPairs)
  || typeof coverage.definition !== 'string'
  || coverage.definition.length === 0
  || !Array.isArray(coverage.boundaries)
  || coverage.boundaries.length === 0) {
  console.error('IP evidence gate: SBOM coverage report is incomplete or internally inconsistent');
  process.exit(3);
}

const license = JSON.parse(readFileSync(join(outDir, 'license-summary.json'), 'utf8'));
const expectedLicenseSboms = ['sbom-node.cdx.json', 'sbom-tai.cdx.json'];
const actualLicenseSboms = Array.isArray(license.sbomFiles) ? [...license.sbomFiles].sort() : [];
const classificationCounts = Object.values(license.classifications ?? {});
const validClassificationCounts = classificationCounts.every((value) => Number.isInteger(value) && value >= 0);
const classifiedComponents = validClassificationCounts
  ? classificationCounts.reduce((total, value) => total + value, 0)
  : -1;
if (!Number.isInteger(license.components) || license.components <= 0
  || classifiedComponents !== license.components
  || JSON.stringify(actualLicenseSboms) !== JSON.stringify(expectedLicenseSboms)
  || license.internalEvidenceMode !== 'SBOM_SRCFILE_TO_EXACT_REPOSITORY_MANIFEST') {
  console.error('IP evidence gate: license summary is incomplete or internally inconsistent');
  process.exit(4);
}
const blocked = license.classifications?.BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE ?? 0;
const unknownLicenses = license.classifications?.UNKNOWN_REVIEW ?? 0;
const legalReviewLicenses = license.classifications?.LEGAL_REVIEW ?? 0;
if (blocked > 0) {
  console.error(`IP evidence gate: ${blocked} blocked license candidate(s)`);
  process.exit(4);
}
if (!baselineMode && (unknownLicenses > 0 || legalReviewLicenses > 0)) {
  console.error(`IP evidence gate: unresolved dependency license candidates (unknown=${unknownLicenses}, legal_review=${legalReviewLicenses})`);
  process.exit(5);
}

const provenance = JSON.parse(readFileSync(join(outDir, 'PROVENANCE_SUMMARY.json'), 'utf8'));
if (provenance.recordedFiles !== provenance.trackedFiles) {
  console.error(`IP evidence gate: provenance coverage incomplete (${provenance.recordedFiles}/${provenance.trackedFiles})`);
  process.exit(6);
}

const similarity = JSON.parse(readFileSync(join(outDir, 'similarity-summary.json'), 'utf8'));
if (similarity.networkUsed !== false || similarity.sourceUploaded !== false) {
  console.error('IP evidence gate: similarity evidence violated the offline/no-upload boundary');
  process.exit(7);
}

const finalBlockers = [];
if (unknownLicenses > 0) finalBlockers.push(`UNKNOWN_DEPENDENCY_LICENSES:${unknownLicenses}`);
if (legalReviewLicenses > 0) finalBlockers.push(`UNRESOLVED_DEPENDENCY_LICENSE_REVIEWS:${legalReviewLicenses}`);
if (provenance.unknownOriginFiles > 0) finalBlockers.push(`UNKNOWN_ORIGIN_FILES:${provenance.unknownOriginFiles}`);
if (provenance.unresolvedRightsFiles > 0) finalBlockers.push(`UNRESOLVED_RIGHTS_FILES:${provenance.unresolvedRightsFiles}`);
if (provenance.crownJewelUnknownOrigin > 0) finalBlockers.push(`CROWN_JEWEL_UNKNOWN_ORIGIN:${provenance.crownJewelUnknownOrigin}`);
if (provenance.unresolvedLicenseMarkers > 0) finalBlockers.push(`UNRESOLVED_FILE_LICENSE_MARKERS:${provenance.unresolvedLicenseMarkers}`);
if (uncoveredRecords.length > 0) finalBlockers.push(`INCOMPLETE_SBOM_SCOPE:${coveredRecords.length}/${coverageRecords.length}`);
if (similarity.finalEligible !== true) finalBlockers.push(...(similarity.finalBlockers ?? ['SIMILARITY_NOT_FINAL_ELIGIBLE']));

if (!baselineMode && finalBlockers.length) {
  console.error(`IP final evidence gate BLOCKED: ${finalBlockers.join(', ')}`);
  process.exit(8);
}

if (baselineMode) {
  console.log(`IP evidence BASELINE_STRUCTURALLY_COMPLETE: ${provenance.recordedFiles}/${provenance.trackedFiles} tracked files; ${license.components} dependency components; SBOM scope ${coveredRecords.length}/${coverageRecords.length} (${coverage.totals.coveragePercent}%); exact Node/TAI CycloneDX+SPDX set; final blockers: ${finalBlockers.join(', ') || 'NONE'}`);
} else {
  console.log(`IP BOUNDED EVIDENCE GATE PASS: ${provenance.recordedFiles}/${provenance.trackedFiles} origins resolved; ${license.components} dependency components; SBOM scope ${coveredRecords.length}/${coverageRecords.length}; offline similarity ${similarity.status}. This does not establish full-program legal or security completion.`);
}
