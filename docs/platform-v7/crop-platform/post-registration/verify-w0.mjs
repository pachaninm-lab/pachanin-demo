#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, '../../../..');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));

const gapMap = readJson('exact-gap-map.v1.json');
const baseline = readJson('dod-baseline.v1.json');
const state = readJson('execution-state.v1.json');

const allowedClassifications = new Set([
  'KEEP',
  'EXTEND_EXISTING',
  'NEW_REQUIRED',
  'REMOVE_OR_SUPERSEDE',
  'EXTERNAL_BLOCKER',
  'NOT_REQUIRED',
]);
const allowedStatuses = new Set(['PASS', 'PARTIAL', 'FAIL', 'EXTERNAL_BLOCKER', 'NOT_EVIDENCED']);

assert.equal(gapMap.exactMainBaseline, state.observedMainSha);
assert.equal(baseline.exactMainBaseline, state.observedMainSha);
assert.equal(gapMap.specification.sha256, state.specification.sha256);
assert.equal(baseline.specificationSha256, state.specification.sha256);
assert.equal(baseline.criteria.length, 126);
assert.equal(new Set(baseline.criteria.map(({ criterion }) => criterion)).size, 126);

const criteriaPayload = `${baseline.criteria.map(({ criterion }) => criterion).join('\n')}\n`;
const criteriaHash = createHash('sha256').update(criteriaPayload).digest('hex');
assert.equal(criteriaHash, state.specification.dodListSha256);

const gapIds = new Set();
for (const finding of gapMap.findings) {
  assert.ok(!gapIds.has(finding.id), `duplicate gap id: ${finding.id}`);
  gapIds.add(finding.id);
  assert.ok(finding.classification.length > 0, `missing classification: ${finding.id}`);
  for (const classification of finding.classification) {
    assert.ok(allowedClassifications.has(classification), `invalid classification: ${finding.id}/${classification}`);
  }
  assert.ok(finding.evidence.length > 0, `missing evidence: ${finding.id}`);
  for (const evidencePath of finding.evidence) {
    assert.ok(fs.existsSync(path.join(repositoryRoot, evidencePath)), `evidence path does not exist: ${finding.id}/${evidencePath}`);
  }
  assert.ok(finding.finding, `missing finding: ${finding.id}`);
  assert.ok(finding.requiredDelta, `missing required delta: ${finding.id}`);
}

const counts = Object.fromEntries([...allowedStatuses].map((status) => [status, 0]));
for (const item of baseline.criteria) {
  assert.ok(allowedStatuses.has(item.status), `invalid DoD status: ${item.criterion}/${item.status}`);
  counts[item.status] += 1;
  for (const gapRef of item.gapRefs) {
    assert.ok(gapIds.has(gapRef), `unknown gap ref: ${item.criterion}/${gapRef}`);
  }
  if (item.status === 'PASS') {
    assert.ok(Array.isArray(item.evidence) && item.evidence.length > 0, `PASS lacks evidence: ${item.criterion}`);
  }
}

assert.deepEqual(counts, state.dodStatusCounts);
const strictPercent = Math.floor((counts.PASS / baseline.criteria.length) * 1000) / 10;
assert.equal(strictPercent, state.overallProgressPercent);
if (state.progressReconciliation) {
  assert.equal(state.progressReconciliation.confirmedTerminalPercent, strictPercent);
}
assert.equal(state.invariants.registrationCodeChanged, false);
assert.equal(state.invariants.registrationBehaviorChanged, false);
assert.equal(state.invariants.roleEligibilityRegression, false);
assert.equal(state.invariants.productionMockEvidenceAccepted, false);
assert.equal(state.invariants.newMandatoryPaidDependencies, 0);
assert.equal(state.invariants.externalPartnerMessagesSent, 0);

function record(value, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function identifier(value, label) {
  assert.ok(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,199}$/u.test(value)
    && !/^(placeholder|todo|tbd|unknown|null|undefined|not_evidenced)$/iu.test(value), `${label} must be a real evidence identifier`);
}

function fingerprint(value, size, label) {
  assert.ok(typeof value === 'string' && new RegExp(`^[a-f0-9]{${size}}$`, 'u').test(value)
    && !/^0+$/u.test(value), `${label} must be a full nonzero fingerprint`);
}

const git = (...args) => execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function repositoryCommit(sha, label) {
  fingerprint(sha, 40, label);
  // Object lookup prevents a similarly named ref from supplying a missing SHA.
  assert.equal(git('rev-parse', `--disambiguate=${sha}`), sha, `${label}: missing or ambiguous repository object; fetch accepted history first`);
  assert.equal(git('cat-file', '-t', sha), 'commit', `${label}: repository commit required`);
}

let trustedMainSha;
function trustedMainCommit() {
  if (trustedMainSha) return trustedMainSha;
  const repository = 'pachaninm-lab/pachanin-demo';
  if (process.env.GITHUB_ACTIONS === 'true') {
    assert.equal(process.env.GITHUB_REPOSITORY, repository, 'trusted workflow repository required');
    const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    assert.equal(event.repository?.full_name, repository, 'trusted event repository required');
    if (['pull_request', 'pull_request_target'].includes(process.env.GITHUB_EVENT_NAME)) {
      assert.equal(event.pull_request?.base?.repo?.full_name, repository, 'trusted PR base repository required');
      assert.equal(event.pull_request?.base?.ref, 'main', 'trusted PR base must be main');
      trustedMainSha = event.pull_request.base.sha;
    } else {
      assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'non-PR acceptance requires a main workflow');
      trustedMainSha = process.env.GITHUB_SHA;
    }
  } else {
    // Never trust a mutable local origin/main or the register as main authority.
    const result = git('ls-remote', '--exit-code', 'https://github.com/pachaninm-lab/pachanin-demo.git', 'refs/heads/main');
    const match = result.match(/^([0-9a-f]{40})\trefs\/heads\/main$/u);
    assert.ok(match, 'verified canonical remote main required');
    trustedMainSha = match[1];
  }
  repositoryCommit(trustedMainSha, 'trusted main');
  return trustedMainSha;
}

function implementationEvidence(proof, component) {
  repositoryCommit(proof.implementationSha, `${component.id}.implementationSha`);
  git('merge-base', '--is-ancestor', proof.implementationSha, state.observedMainSha);
  git('merge-base', '--is-ancestor', proof.implementationSha, proof.deployedSha);
  for (const source of component.sourceEvidence) {
    assert.equal(git('cat-file', '-t', `${proof.implementationSha}:${source}`), 'blob', `${component.id}: accepted implementation source missing`);
    assert.equal(git('rev-parse', `${proof.implementationSha}:${source}`), git('rev-parse', `${proof.deployedSha}:${source}`), `${component.id}: deployed source differs from accepted implementation; renew acceptance evidence`);
  }
}

function evidence(value, kind, label) {
  record(value, label);
  assert.equal(value.schemaVersion, 'pc-crop.revenue-evidence.v1', `${label}: evidence schema`);
  assert.equal(value.kind, kind, `${label}: evidence kind`);
  identifier(value.id, `${label}.id`);
  repositoryCommit(state.observedMainSha, 'observedMainSha');
  git('merge-base', '--is-ancestor', state.observedMainSha, trustedMainCommit());
  repositoryCommit(state.observedProductionSha, 'observedProductionSha');
  repositoryCommit(value.deployedSha, `${label}.deployedSha`);
  assert.equal(value.deployedSha, state.observedProductionSha, `${label}: wrong deployed revision`);
  git('merge-base', '--is-ancestor', value.deployedSha, state.observedMainSha);
  assert.equal(value.specificationSha256, state.specification.sha256, `${label}: wrong specification`);
  assert.equal(value.environment, 'REG_RU_PRODUCTION', `${label}: production hosting`);
  assert.equal(value.executionMode, 'LIVE', `${label}: live acceptance required`);
  assert.equal(value.result, 'PASS', `${label}: passing acceptance required`);
  assert.ok(typeof value.observedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value.observedAt)
    && Number.isFinite(Date.parse(value.observedAt)), `${label}: valid observation timestamp required`);
  assert.ok(typeof value.evidenceUrl === 'string'
    && /^https:\/\/github\.com\/pachaninm-lab\/pachanin-demo\/(?:actions\/runs\/[1-9]\d*(?:\/job\/[1-9]\d*|\/artifacts\/[1-9]\d*)?|issues\/[1-9]\d*#issuecomment-[1-9]\d*)$/u.test(value.evidenceUrl), `${label}: traceable repository evidence URL required`);
  fingerprint(value.evidenceSha256, 64, `${label}.evidenceSha256`);
  return value;
}

const transactionKinds = {
  realFarmerEvidence: 'REAL_FARMER',
  realBuyerEvidence: 'REAL_BUYER',
  canonicalDealEvidence: 'CANONICAL_DEAL',
  applicableRegulatoryReceipts: 'REGULATORY_RECEIPT',
  executionEvidence: 'EXECUTION_ACCEPTANCE',
  bankFinalityEvidence: 'BANK_FINALITY',
  reconciliationEvidence: 'RECONCILIATION',
  lawfulCommissionBasis: 'LAWFUL_COMMISSION_BASIS',
  companyRevenueEvent: 'COMPANY_REVENUE_EVENT',
  companyCashReceipt: 'COMPANY_CASH_RECEIPT',
};

function verifyRealTransaction(transaction) {
  const anchor = record(transaction.canonicalDealEvidence, 'canonicalDealEvidence');
  const linkedKeys = ['canonicalDealId', 'tenantId', 'farmerOrganizationId', 'buyerOrganizationId', 'companyOrganizationId'];
  for (const key of linkedKeys) identifier(anchor[key], `canonicalDealEvidence.${key}`);
  assert.equal(new Set(linkedKeys.slice(2).map((key) => anchor[key])).size, 3, 'farmer, buyer and platform company must be distinct organizations');
  const ids = new Set();
  for (const [key, kind] of Object.entries(transactionKinds)) {
    const values = key === 'applicableRegulatoryReceipts' ? transaction[key] : [transaction[key]];
    assert.ok(Array.isArray(values) && values.length > 0, `${key}: complete transaction evidence required`);
    for (const value of values) {
      evidence(value, kind, key);
      assert.ok(!ids.has(value.id), `duplicate transaction evidence id: ${value.id}`);
      ids.add(value.id);
      for (const link of linkedKeys) assert.equal(value[link], anchor[link], `${key}: inconsistent ${link}`);
      if (key === 'applicableRegulatoryReceipts') {
        identifier(value.system, `${key}.system`);
        identifier(value.externalReceiptId, `${key}.externalReceiptId`);
      }
    }
  }
  assert.ok(transaction.applicableRegulatoryReceipts.some((item) => item.system === 'FGIS_GRAIN'), 'first commercial transaction requires FGIS Grain receipt');
  identifier(transaction.bankFinalityEvidence.externalReceiptId, 'bankFinalityEvidence.externalReceiptId');
  identifier(transaction.companyCashReceipt.externalReceiptId, 'companyCashReceipt.externalReceiptId');
  const basis = transaction.lawfulCommissionBasis;
  const revenue = transaction.companyRevenueEvent;
  const cash = transaction.companyCashReceipt;
  identifier(basis.contractVersionId, 'lawfulCommissionBasis.contractVersionId');
  for (const item of [basis, revenue, cash]) {
    assert.equal(item.currency, 'RUB', `${item.kind}: commission currency`);
    assert.ok(typeof item.amountKopecks === 'string' && /^[1-9]\d{0,18}$/u.test(item.amountKopecks)
      && BigInt(item.amountKopecks) <= 9_223_372_036_854_775_807n, `${item.kind}: positive exact commission amount required`);
    assert.equal(item.amountKopecks, basis.amountKopecks, `${item.kind}: commission amount mismatch`);
  }
  assert.equal(revenue.commissionBasisEvidenceId, basis.id, 'revenue must reference its lawful commission basis');
  assert.equal(cash.revenueEventEvidenceId, revenue.id, 'cash receipt must reference the revenue event');
  assert.equal(cash.payeeOrganizationId, anchor.companyOrganizationId, 'cash must be received by the platform company');
  assert.equal(transaction.reconciliationEvidence.bankFinalityEvidenceId, transaction.bankFinalityEvidence.id, 'reconciliation must link bank finality');
  assert.equal(transaction.reconciliationEvidence.companyCashReceiptEvidenceId, cash.id, 'reconciliation must link company cash receipt');
}

{
  const slice = record(state.revenueSliceV1, 'revenueSliceV1');
  record(state.executionOrder, 'executionOrder');
  assert.equal(state.executionOrder.mode, 'REVENUE_FIRST');
  assert.equal(state.executionOrder.specificationChanged, false);
  assert.equal(state.executionOrder.definitionOfDoneChanged, false);
  assert.deepEqual(state.executionOrder.order, [
    'W1_CONFIG_FOUNDATION_COMPLETION', 'REVENUE_SLICE_V1', 'REMAINING_ORIGINAL_DOD',
  ]);
  assert.equal(slice.componentCount, 15);
  assert.ok(Array.isArray(slice.components), 'revenue components must be an array');
  assert.equal(slice.components.length, slice.componentCount);
  assert.deepEqual(slice.components.map((item) => item.id).sort(),
    Array.from({ length: 15 }, (_, index) => `RS-${String(index + 1).padStart(2, '0')}`), 'canonical revenue component identities required');
  for (const item of slice.components) {
    assert.ok(['NOT_ACCEPTED', 'PRODUCTION_ACCEPTED'].includes(item.status));
    assert.ok(item.classification.length > 0);
    for (const classification of item.classification) assert.ok(allowedClassifications.has(classification));
    assert.ok(item.sourceEvidence.length > 0);
    for (const evidencePath of item.sourceEvidence) {
      assert.ok(fs.existsSync(path.join(repositoryRoot, evidencePath)), `missing revenue source: ${item.id}/${evidencePath}`);
    }
    assert.ok(Array.isArray(item.productionEvidence));
    const evidenceKinds = new Set();
    for (const proof of item.productionEvidence) {
      record(proof, `${item.id}.productionEvidence`);
      assert.ok(['REG_RU_DEPLOYMENT', 'LIVE_COMPONENT_ACCEPTANCE'].includes(proof.kind), `${item.id}: unsupported production evidence`);
      evidence(proof, proof.kind, `${item.id}.productionEvidence`);
      assert.equal(proof.componentId, item.id, `${item.id}: evidence for another component`);
      implementationEvidence(proof, item);
      assert.ok(!evidenceKinds.has(proof.kind), `${item.id}: duplicate evidence kind`);
      evidenceKinds.add(proof.kind);
    }
    if (item.status === 'PRODUCTION_ACCEPTED') {
      assert.ok(evidenceKinds.has('REG_RU_DEPLOYMENT') && evidenceKinds.has('LIVE_COMPONENT_ACCEPTANCE'), `revenue acceptance lacks deployment and live task evidence: ${item.id}`);
      assert.equal(state.w1Completion.productionStatus, 'ACCEPTED');
    }
  }
  const accepted = slice.components.filter((item) => item.status === 'PRODUCTION_ACCEPTED').length;
  assert.equal(slice.acceptedComponentCount, accepted);
  assert.equal(slice.progressPercent, Math.floor(accepted / slice.componentCount * 1000) / 10);
  const transaction = record(slice.realTransaction, 'realTransaction');
  assert.deepEqual(Object.keys(transaction).sort(), ['status', ...Object.keys(transactionKinds)].sort(), 'complete realTransaction evidence fields required');
  if (accepted === slice.componentCount) {
    assert.equal(transaction.status, 'ACCEPTED', '100% revenue progress requires a real commercial transaction');
  }
  if (transaction.status === 'ACCEPTED') {
    assert.equal(accepted, slice.componentCount);
    verifyRealTransaction(transaction);
  } else {
    assert.equal(transaction.status, 'NOT_EVIDENCED');
  }
}

process.stdout.write(
  `PC-CROP DoD verified: ${baseline.criteria.length} criteria, ${counts.PASS} PASS, ${strictPercent.toFixed(1)}% strict progress, ${gapMap.findings.length} gap findings.\n`,
);
