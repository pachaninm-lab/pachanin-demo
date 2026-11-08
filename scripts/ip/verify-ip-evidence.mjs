import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room';
const baselineMode = process.argv.includes('--baseline');
const asvsVersion = '5.0.0';
const asvsSourceCommit = '5cf9b032440be53ce345ab3c130fda46ba1ce7a2';
const asvsSourceUrl = `https://raw.githubusercontent.com/OWASP/ASVS/${asvsSourceCommit}/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.flat.json`;
const asvsSourceSha256 = '8201b20eec2908c3380ac600c91c8ba746346fbb808859366abb232027532311';
const expectedAsvsRequirements = 345;
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
  'security/asvs/ASVS_MATRIX.csv',
  'security/asvs/ASVS_SUMMARY.json',
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
const coverageRecords = Array.isArray(coverage.records) ? coverage.records : [];
const coverageComponents = new Set(coverageRecords.map((record) => record.component));
const COVERED_STATUSES = new Set(['RUNTIME_COVERED', 'BUILD_ONLY_COVERED', 'NOT_RUNTIME_WITH_JUSTIFICATION']);
const VALID_STATUSES = new Set([...COVERED_STATUSES, 'UNKNOWN']);

const coveredRecords = coverageRecords.filter((record) => COVERED_STATUSES.has(record.status));
const unknownRecords = coverageRecords.filter((record) => record.status === 'UNKNOWN');
const invalidStatusRecords = coverageRecords.filter((record) => !VALID_STATUSES.has(record.status));

// An exclusion only counts while every one of its conditions still holds. A
// record claiming NOT_RUNTIME with no conditions, or with a failing condition,
// is a fabricated justification and must fail rather than be trusted.
const fabricatedExclusions = coverageRecords.filter((record) => {
  if (record.status !== 'NOT_RUNTIME_WITH_JUSTIFICATION') return false;
  const checks = record.justification?.checks;
  return !Array.isArray(checks) || checks.length === 0 || !checks.every((check) => check.holds === true);
});

// A covered runtime root must name the artifact that covers it, unless there is
// genuinely nothing to cover.
const unmappedRuntimeRecords = coverageRecords.filter((record) => (
  (record.status === 'RUNTIME_COVERED' || record.status === 'BUILD_ONLY_COVERED')
  && record.reason !== 'NO_DECLARED_DEPENDENCIES'
  && (!Array.isArray(record.coveringSbom) || record.coveringSbom.length === 0)
));

const expectedCoveragePercent = coverageRecords.length > 0
  ? Number(((coveredRecords.length / coverageRecords.length) * 100).toFixed(2))
  : -1;
const expectedComplete = coverageRecords.length > 0
  && coveredRecords.length === coverageRecords.length
  && unknownRecords.length === 0;
const sourceShaMatches = !process.env.SOURCE_SHA || coverage.sourceSha === process.env.SOURCE_SHA;

if (coverage.schemaVersion !== 2
  || !/^[0-9a-f]{40}$/u.test(String(coverage.sourceSha ?? ''))
  || !sourceShaMatches
  || coverageRecords.length === 0
  || coverageComponents.size !== coverageRecords.length
  || invalidStatusRecords.length > 0
  || fabricatedExclusions.length > 0
  || unmappedRuntimeRecords.length > 0
  || coverage.totals?.total !== coverageRecords.length
  || coverage.totals?.covered !== coveredRecords.length
  || coverage.totals?.unknown !== unknownRecords.length
  || coverage.totals?.uncovered !== coverageRecords.length - coveredRecords.length
  || coverage.totals?.coveragePercent !== expectedCoveragePercent
  || coverage.complete !== expectedComplete
  || typeof coverage.scopeNote !== 'string'
  || coverage.scopeNote.length === 0) {
  console.error('IP evidence gate: SBOM coverage report is incomplete or internally inconsistent');
  if (fabricatedExclusions.length > 0) {
    console.error(`  unjustified exclusions: ${fabricatedExclusions.map((r) => r.component).join(', ')}`);
  }
  if (unmappedRuntimeRecords.length > 0) {
    console.error(`  covered roots with no SBOM artifact: ${unmappedRuntimeRecords.map((r) => r.component).join(', ')}`);
  }
  if (unknownRecords.length > 0) {
    console.error(`  unknown dependency roots: ${unknownRecords.map((r) => r.component).join(', ')}`);
  }
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

function parseQuotedCsvLine(line) {
  const fields = [];
  let index = 0;
  while (index < line.length) {
    if (line[index] !== '"') throw new Error('field is not quoted');
    index += 1;
    let value = '';
    let closed = false;
    while (index < line.length) {
      if (line[index] === '"') {
        if (line[index + 1] === '"') {
          value += '"';
          index += 2;
          continue;
        }
        index += 1;
        closed = true;
        break;
      }
      value += line[index];
      index += 1;
    }
    if (!closed) throw new Error('unterminated quoted field');
    fields.push(value);
    if (index === line.length) break;
    if (line[index] !== ',') throw new Error('unexpected character after quoted field');
    index += 1;
  }
  return fields;
}

const asvsMatrixPath = join(outDir, 'security/asvs/ASVS_MATRIX.csv');
const asvsSummaryPath = join(outDir, 'security/asvs/ASVS_SUMMARY.json');
const asvsMatrix = readFileSync(asvsMatrixPath, 'utf8');
const asvs = JSON.parse(readFileSync(asvsSummaryPath, 'utf8'));
const expectedAsvsHeader = [
  'standard_version',
  'source_commit',
  'asvs_ref',
  'requirement_id',
  'level',
  'applicability',
  'status',
  'evidence_ref',
  'assessment_note',
];
const asvsLines = asvsMatrix.endsWith('\n') ? asvsMatrix.slice(0, -1).split('\n') : asvsMatrix.split('\n');
let matrixRows;
try {
  const header = parseQuotedCsvLine(asvsLines[0] ?? '');
  if (JSON.stringify(header) !== JSON.stringify(expectedAsvsHeader)) throw new Error('unexpected header');
  matrixRows = asvsLines.slice(1).map(parseQuotedCsvLine);
} catch (error) {
  console.error(`IP evidence gate: ASVS matrix CSV invalid (${error instanceof Error ? error.message : String(error)})`);
  process.exit(8);
}

if (matrixRows.length !== expectedAsvsRequirements || matrixRows.some((row) => row.length !== expectedAsvsHeader.length)) {
  console.error(`IP evidence gate: ASVS matrix row count/shape invalid (${matrixRows.length}/${expectedAsvsRequirements})`);
  process.exit(8);
}

const asvsStatusCounts = { NOT_ASSESSED: 0, PASS: 0, FAIL: 0, NOT_APPLICABLE: 0 };
const asvsApplicabilityCounts = {
  PENDING_APPLICABILITY_REVIEW: 0,
  APPLICABLE: 0,
  NOT_APPLICABLE_WITH_JUSTIFICATION: 0,
};
const asvsLevelCounts = { '1': 0, '2': 0, '3': 0 };
const seenAsvsIds = new Set();
for (const row of matrixRows) {
  const [version, sourceCommit, asvsRef, requirementId, level, applicability, status, evidenceRef, assessmentNote] = row;
  if (version !== asvsVersion
    || sourceCommit !== asvsSourceCommit
    || !/^V[1-9]\d*\.[1-9]\d*\.[1-9]\d*$/u.test(requirementId)
    || asvsRef !== `v${asvsVersion}-${requirementId.slice(1)}`
    || !Object.hasOwn(asvsLevelCounts, level)
    || !Object.hasOwn(asvsApplicabilityCounts, applicability)
    || !Object.hasOwn(asvsStatusCounts, status)
    || seenAsvsIds.has(requirementId)) {
    console.error(`IP evidence gate: ASVS matrix contains an invalid or duplicate row for ${requirementId || 'UNKNOWN'}`);
    process.exit(8);
  }
  if (status === 'NOT_APPLICABLE') {
    if (applicability !== 'NOT_APPLICABLE_WITH_JUSTIFICATION' || !evidenceRef || !assessmentNote) {
      console.error(`IP evidence gate: ASVS N/A lacks justification evidence for ${requirementId}`);
      process.exit(8);
    }
  } else if (status !== 'NOT_ASSESSED' && !evidenceRef) {
    console.error(`IP evidence gate: ASVS assessed row lacks evidence for ${requirementId}`);
    process.exit(8);
  }
  if (status === 'PASS' && applicability !== 'APPLICABLE') {
    console.error(`IP evidence gate: ASVS PASS has non-applicable state for ${requirementId}`);
    process.exit(8);
  }
  seenAsvsIds.add(requirementId);
  asvsLevelCounts[level] += 1;
  asvsApplicabilityCounts[applicability] += 1;
  asvsStatusCounts[status] += 1;
}

const matrixSha256 = createHash('sha256').update(asvsMatrix, 'utf8').digest('hex');
const normalizedSummaryStatusCounts = {
  NOT_ASSESSED: asvs.statusCounts?.NOT_ASSESSED ?? 0,
  PASS: asvs.statusCounts?.PASS ?? 0,
  FAIL: asvs.statusCounts?.FAIL ?? 0,
  NOT_APPLICABLE: asvs.statusCounts?.NOT_APPLICABLE ?? 0,
};
const normalizedSummaryApplicabilityCounts = {
  PENDING_APPLICABILITY_REVIEW: asvs.applicabilityCounts?.PENDING_APPLICABILITY_REVIEW ?? 0,
  APPLICABLE: asvs.applicabilityCounts?.APPLICABLE ?? 0,
  NOT_APPLICABLE_WITH_JUSTIFICATION: asvs.applicabilityCounts?.NOT_APPLICABLE_WITH_JUSTIFICATION ?? 0,
};
const normalizedSummaryLevelCounts = {
  '1': asvs.levelCounts?.['1'] ?? 0,
  '2': asvs.levelCounts?.['2'] ?? 0,
  '3': asvs.levelCounts?.['3'] ?? 0,
};
const asvsEligible = asvsStatusCounts.NOT_ASSESSED === 0
  && asvsStatusCounts.FAIL === 0
  && asvsApplicabilityCounts.PENDING_APPLICABILITY_REVIEW === 0;

if (asvs.schemaVersion !== 'pc-crop.asvs-evidence.v1'
  || asvs.standard !== 'OWASP ASVS'
  || asvs.standardVersion !== asvsVersion
  || asvs.sourceCommit !== asvsSourceCommit
  || asvs.sourceUrl !== asvsSourceUrl
  || asvs.sourceSha256 !== asvsSourceSha256
  || asvs.sourceMode !== 'PINNED_PUBLIC_STANDARD_DOWNLOAD'
  || asvs.targetLevel !== 3
  || asvs.requirements !== expectedAsvsRequirements
  || asvs.matrixSha256 !== matrixSha256
  || asvs.proprietarySourceUploaded !== false
  || asvs.outputContainsRequirementDescriptions !== false
  || JSON.stringify(normalizedSummaryStatusCounts) !== JSON.stringify(asvsStatusCounts)
  || JSON.stringify(normalizedSummaryApplicabilityCounts) !== JSON.stringify(asvsApplicabilityCounts)
  || JSON.stringify(normalizedSummaryLevelCounts) !== JSON.stringify(asvsLevelCounts)
  || asvs.finalPass !== asvsEligible) {
  console.error('IP evidence gate: ASVS summary is incomplete, inconsistent, or overclaims compliance');
  process.exit(8);
}

const finalBlockers = [];
if (unknownLicenses > 0) finalBlockers.push(`UNKNOWN_DEPENDENCY_LICENSES:${unknownLicenses}`);
if (legalReviewLicenses > 0) finalBlockers.push(`UNRESOLVED_DEPENDENCY_LICENSE_REVIEWS:${legalReviewLicenses}`);
if (provenance.unknownOriginFiles > 0) finalBlockers.push(`UNKNOWN_ORIGIN_FILES:${provenance.unknownOriginFiles}`);
if (provenance.unresolvedRightsFiles > 0) finalBlockers.push(`UNRESOLVED_RIGHTS_FILES:${provenance.unresolvedRightsFiles}`);
if (provenance.crownJewelUnknownOrigin > 0) finalBlockers.push(`CROWN_JEWEL_UNKNOWN_ORIGIN:${provenance.crownJewelUnknownOrigin}`);
if (provenance.unresolvedLicenseMarkers > 0) finalBlockers.push(`UNRESOLVED_FILE_LICENSE_MARKERS:${provenance.unresolvedLicenseMarkers}`);
if (!coverage.complete) finalBlockers.push(`INCOMPLETE_SBOM_SCOPE:${coveredRecords.length}/${coverageRecords.length}`);
if (unknownRecords.length > 0) finalBlockers.push(`UNKNOWN_DEPENDENCY_ROOTS:${unknownRecords.length}`);
if (similarity.finalEligible !== true) finalBlockers.push(...(similarity.finalBlockers ?? ['SIMILARITY_NOT_FINAL_ELIGIBLE']));
if (asvsStatusCounts.NOT_ASSESSED > 0) finalBlockers.push(`ASVS_NOT_ASSESSED:${asvsStatusCounts.NOT_ASSESSED}`);
if (asvsStatusCounts.FAIL > 0) finalBlockers.push(`ASVS_FAIL:${asvsStatusCounts.FAIL}`);
if (asvsApplicabilityCounts.PENDING_APPLICABILITY_REVIEW > 0) finalBlockers.push(`ASVS_APPLICABILITY_PENDING:${asvsApplicabilityCounts.PENDING_APPLICABILITY_REVIEW}`);
if (asvs.finalPass !== true) finalBlockers.push('ASVS_NOT_FINAL_PASS');

if (!baselineMode && finalBlockers.length) {
  console.error(`IP final evidence gate BLOCKED: ${finalBlockers.join(', ')}`);
  process.exit(8);
}

if (baselineMode) {
  console.log(`IP evidence BASELINE_STRUCTURALLY_COMPLETE: ${provenance.recordedFiles}/${provenance.trackedFiles} tracked files; ${license.components} dependency components; SBOM scope ${coveredRecords.length}/${coverageRecords.length} (${coverage.totals.coveragePercent}%); exact Node/TAI CycloneDX+SPDX set; ASVS ${asvs.requirements}/${expectedAsvsRequirements} inventoried; final blockers: ${finalBlockers.join(', ') || 'NONE'}`);
} else {
  console.log(`IP BOUNDED EVIDENCE GATE PASS: ${provenance.recordedFiles}/${provenance.trackedFiles} origins resolved; ${license.components} dependency components; SBOM scope ${coveredRecords.length}/${coverageRecords.length} (${coverage.totals.coveragePercent}%); offline similarity ${similarity.status}; ASVS ${asvs.requirements}/${expectedAsvsRequirements} final PASS. This does not establish full-program legal or security completion.`);
}
