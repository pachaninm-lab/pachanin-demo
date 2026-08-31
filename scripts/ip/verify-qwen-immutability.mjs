#!/usr/bin/env node
// Fail-closed verifier for the Qwen foundation-model boundary.
//
// The proprietary core boundary declares QWEN_MODIFICATION = NONE and requires
// PINNED_MODEL_AND_TOKENIZER_HASHES_FAIL_CLOSED. A declaration that nothing
// checks is not a control, so this script cross-checks the declaration against
// the model governance artifacts and exits non-zero on any disagreement.
//
// It deliberately does not claim more than the artifacts support: while the
// bundle has not been acquired into controlled storage, PINNED_WEIGHTS is
// reported false rather than being rounded up to a pass.

import { readFileSync, existsSync } from 'node:fs';

const BOUNDARY = process.env.QWEN_BOUNDARY_PATH ?? 'docs/ip/proprietary-core-boundary.json';
const ARTIFACT_DIR = process.env.QWEN_ARTIFACT_DIR ?? 'apps/tai/model-artifacts';
const MODEL_KEY = process.env.QWEN_MODEL_KEY ?? 'qwen3-8b';

const REQUIRED_NONE = ['modification', 'finetune', 'lora', 'weightMutation'];
const REQUIRED_HASHES = [
  'source_files_sha256',
  'source_manifest_sha256',
  'model_card_sha256',
  'license_text_sha256',
];
const SHA256 = /^[0-9a-f]{64}$/u;

const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function firstExisting(candidates) {
  return candidates.find((candidate) => existsSync(candidate));
}

// --- boundary declaration -------------------------------------------------

const boundary = readJson(BOUNDARY);
const declared = boundary?.foundationModelBoundary;

if (!declared) {
  fail(`${BOUNDARY} declares no foundationModelBoundary`);
} else {
  if (String(declared.model).toUpperCase() !== 'QWEN') {
    fail(`foundation model changed in the boundary: ${String(declared.model)}`);
  }
  if (String(declared.classification) !== 'THIRD_PARTY_INFRASTRUCTURE') {
    fail(`Qwen must stay THIRD_PARTY_INFRASTRUCTURE, found ${String(declared.classification)}`);
  }
  for (const key of REQUIRED_NONE) {
    const value = declared[key];
    if (String(value).toUpperCase() !== 'NONE') {
      fail(`boundary declares ${key}=${String(value)}; only NONE is permitted`);
    }
  }
}

// --- governance artifacts -------------------------------------------------

const attestationPath = `${ARTIFACT_DIR}/legal-reviews/${MODEL_KEY}.review-attestation.v1.json`;
const recordPath = `${ARTIFACT_DIR}/legal-reviews/${MODEL_KEY}.review-record.v1.json`;
const bundlePath = firstExisting([
  `${ARTIFACT_DIR}/${MODEL_KEY}.bundle.v2.json`,
  `${ARTIFACT_DIR}/${MODEL_KEY}.bundle.v2.pending.json`,
]);

if (!bundlePath) fail(`no bundle manifest found for ${MODEL_KEY}`);

const attestation = readJson(attestationPath);
const record = readJson(recordPath);
const bundle = bundlePath ? readJson(bundlePath) : null;

// --- legal position -------------------------------------------------------

if (attestation && String(attestation.decision) !== 'APPROVED') {
  fail(`legal attestation is not APPROVED: ${String(attestation.decision)}`);
}
if (record && String(record.decision) !== 'APPROVED') {
  fail(`legal review record is not APPROVED: ${String(record.decision)}`);
}
if (record && !String(record.license_spdx ?? '').trim()) {
  fail('legal review record carries no license_spdx');
}
if (record && String(record.reviewer_type) !== 'HUMAN') {
  fail(`legal review must be human; found reviewer_type=${String(record.reviewer_type)}`);
}

// --- pinned hashes --------------------------------------------------------

for (const key of REQUIRED_HASHES) {
  const value = String(attestation?.[key] ?? '');
  if (!SHA256.test(value)) {
    fail(`attestation ${key} is not a pinned sha256`);
  }
}

// --- identity agreement across artifacts ----------------------------------

const identities = [
  ['attestation', attestation?.model_id, attestation?.revision],
  ['bundle', bundle?.model_id, bundle?.revision],
];

const modelIds = new Set(identities.filter(([, id]) => id).map(([, id]) => String(id)));
const revisions = new Set(identities.filter(([, , rev]) => rev).map(([, , rev]) => String(rev)));

if (modelIds.size > 1) fail(`model_id disagrees across artifacts: ${[...modelIds].join(' vs ')}`);
if (revisions.size > 1) fail(`revision disagrees across artifacts: ${[...revisions].join(' vs ')}`);
if (modelIds.size === 0) fail('no model_id pinned in any artifact');
if (revisions.size === 0) fail('no revision pinned in any artifact');

const modelId = [...modelIds][0] ?? 'UNKNOWN';
const revision = [...revisions][0] ?? 'UNKNOWN';

if (modelId !== 'UNKNOWN' && !/^Qwen\//u.test(modelId)) {
  fail(`model_id is not a Qwen model: ${modelId}`);
}

// The review record states the reviewed revision in prose. If the pinned
// revision is absent from it, the approval does not cover what is pinned.
if (record && revision !== 'UNKNOWN') {
  const basis = String(record.decision_basis ?? '');
  if (basis && !basis.includes(revision)) {
    fail('pinned revision does not appear in the legal decision basis');
  }
}

// --- operational honesty --------------------------------------------------

const lifecycle = String(bundle?.lifecycle ?? 'UNKNOWN');
const inventoried = Array.isArray(bundle?.source_files) && bundle.source_files.length > 0;
const pinnedWeights = lifecycle === 'FINALIZED' && inventoried;

if (!pinnedWeights) {
  notes.push(
    `PINNED_WEIGHTS=false - bundle lifecycle is ${lifecycle} and source files are not inventoried in controlled storage. ` +
      'Upstream hashes are pinned in the attestation, but local weight/tokenizer inventory is not yet proven.',
  );
}

const runtimePath = `${ARTIFACT_DIR}/qwen-preview-runtime.pending.json`;
if (existsSync(runtimePath)) {
  const runtime = readJson(runtimePath);
  if (runtime && runtime.accepted !== true) {
    notes.push('RUNTIME_ACTIVATED=false - the Qwen preview runtime is not accepted; no operational claim is permitted.');
  }
}

// --- report ---------------------------------------------------------------

console.log('Qwen immutability verifier');
console.log(`  model_id            ${modelId}`);
console.log(`  revision            ${revision}`);
console.log(`  license             ${record?.license_spdx ?? 'UNKNOWN'}`);
console.log(`  legal decision      ${attestation?.decision ?? 'UNKNOWN'} (${record?.reviewer_type ?? 'UNKNOWN'})`);
console.log(`  bundle lifecycle    ${lifecycle}`);
console.log(`  pinned upstream     ${REQUIRED_HASHES.filter((k) => SHA256.test(String(attestation?.[k] ?? ''))).length}/${REQUIRED_HASHES.length}`);
console.log(`  pinned weights      ${pinnedWeights}`);

for (const note of notes) console.log(`  note: ${note}`);

if (failures.length > 0) {
  console.error('\nQWEN_IMMUTABILITY: FAIL_CLOSED');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('\nQWEN_IMMUTABILITY: CONSISTENT');
console.log('  Declaration and governance artifacts agree. This is not an operational readiness claim.');
