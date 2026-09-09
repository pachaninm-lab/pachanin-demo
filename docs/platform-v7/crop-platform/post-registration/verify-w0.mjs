#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, '../../../..');
export function verifyRegisterStructure() {
  const readJson = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));

  const gapMap = readJson('exact-gap-map.v1.json');
  const baseline = readJson('dod-baseline.v1.json');
  const state = readJson('execution-state.v1.json');
  const referencedEvidence = [];

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
      && /^https:\/\/github\.com\/pachaninm-lab\/pachanin-demo\/actions\/runs\/[1-9]\d*\/artifacts\/[1-9]\d*$/u.test(value.evidenceUrl), `${label}: traceable repository evidence URL required`);
    fingerprint(value.evidenceSha256, 64, `${label}.evidenceSha256`);
    referencedEvidence.push(value);
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

  return { status: 'STRUCTURE_ONLY_NOT_ACCEPTANCE', referencedEvidence, trustedMainSha, observedMainSha: state.observedMainSha, criteriaCount: baseline.criteria.length, passCount: counts.PASS, strictPercent, gapCount: gapMap.findings.length };
}

const canonicalRepository = 'pachaninm-lab/pachanin-demo';
const canonicalApi = `https://api.github.com/repos/${canonicalRepository}`;
const w1Producer = '.github/workflows/pc-crop-w1-production-acceptance.yml';
// W1 can only attest deployment. No authenticated component/business collector
// is approved yet; adding one requires reviewed producer code and this admission.
const approvedProducers = Object.freeze({ REG_RU_DEPLOYMENT: w1Producer });
const w1ProducerSources = Object.freeze([w1Producer, 'scripts/production-pc-crop-w1-migrations.sh', 'scripts/check-production-pc-crop-w1-acceptance.mjs', 'scripts/production-role-eligibility-api-release.sh']);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function unpackEvidence(archive) {
  // Read only the current controller's two bounded regular text files.
  assert.ok(archive.length >= 98 && archive.length <= 2_097_152, 'unsupported evidence archive size');
  const end = archive.length - 22;
  assert.equal(archive.readUInt32LE(end), 0x06054b50, 'ZIP end record required');
  assert.equal(archive.readUInt32LE(end + 4), 0, 'multi-disk ZIP rejected');
  assert.equal(archive.readUInt16LE(end + 8), 2, 'exact W1 evidence members required');
  assert.equal(archive.readUInt16LE(end + 10), 2, 'exact W1 evidence members required');
  assert.equal(archive.readUInt16LE(end + 20), 0, 'ZIP comments rejected');
  const directoryStart = archive.readUInt32LE(end + 16);
  assert.equal(directoryStart + archive.readUInt32LE(end + 12), end, 'invalid ZIP directory');
  let cursor = directoryStart;
  const files = new Map();
  for (let index = 0; index < 2; index++) {
    assert.ok(cursor + 46 <= end, 'truncated ZIP directory');
    assert.equal(archive.readUInt32LE(cursor), 0x02014b50, 'ZIP central member required');
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const compressed = archive.readUInt32LE(cursor + 20);
    const expanded = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const local = archive.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    assert.ok(next <= end && local + 30 <= directoryStart, 'invalid ZIP member boundaries');
    assert.equal(archive.readUInt16LE(cursor + 34), 0, 'multi-disk member rejected');
    assert.ok([0, 0o100000].includes((archive.readUInt32LE(cursor + 38) >>> 16) & 0o170000), 'nonregular ZIP member rejected');
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    assert.ok(['stage.log', 'result.md'].includes(name) && !files.has(name), 'unsupported or duplicate W1 evidence member');
    assert.ok((flags & ~0x808) === 0 && [0, 8].includes(method), 'unsupported ZIP compression/encryption');
    assert.ok(expanded > 0 && expanded <= 262_144, 'expanded evidence too large');
    assert.equal(archive.readUInt32LE(local), 0x04034b50, 'local ZIP member required');
    assert.equal(archive.readUInt16LE(local + 6), flags, 'ZIP flags differ');
    assert.equal(archive.readUInt16LE(local + 8), method, 'ZIP compression differs');
    const localNameLength = archive.readUInt16LE(local + 26);
    assert.equal(archive.subarray(local + 30, local + 30 + localNameLength).toString('utf8'), name, 'local ZIP member differs');
    const start = local + 30 + localNameLength + archive.readUInt16LE(local + 28);
    assert.ok(start + compressed <= directoryStart, 'ZIP content overlaps directory');
    const compressedBytes = archive.subarray(start, start + compressed);
    const bytes = method === 0 ? compressedBytes : inflateRawSync(compressedBytes, { maxOutputLength: 262_144 });
    assert.equal(bytes.length, expanded, 'expanded evidence size differs');
    files.set(name, bytes.toString('utf8'));
    cursor = next;
  }
  assert.equal(cursor, end, 'additional ZIP directory data rejected');
  return { stage: files.get('stage.log'), summary: files.get('result.md') };
}

export function validateW1Deployment(payload, proof, run) {
  assert.equal(proof.kind, 'REG_RU_DEPLOYMENT', 'W1 output is deployment-only evidence');
  assert.equal(proof.environment, 'REG_RU_PRODUCTION', 'REG.RU production required');
  assert.equal(proof.executionMode, 'LIVE', 'live deployment required');
  assert.equal(proof.result, 'PASS', 'successful deployment required');
  assert.ok(/^RS-(?:01|02|04|05|06|07|08|09|10|11|12|13|14)$/u.test(proof.componentId), 'API-only W1 deployment cannot attest web components');
  assert.ok(typeof payload.stage === 'string' && payload.stage.endsWith('\n'), 'bounded W1 stage log required');
  const fields = new Map();
  for (const line of payload.stage.trimEnd().split('\n')) {
    const match = line.match(/^(PC_W1_[A-Z0-9_]+)=([A-Z][A-Z0-9_]{0,100}|true|false|[0-9]{1,10}|[0-9a-f]{40}|[0-9a-f]{64})$/u);
    assert.ok(match, 'untyped W1 log line rejected');
    const [, key, value] = match;
    assert.ok(!/ERROR|BLOCKER/u.test(key) && !['FAIL', 'BLOCKED', 'NOT_EXECUTED'].includes(value), 'W1 failure cannot become deployment success');
    fields.set(key, [...(fields.get(key) ?? []), value]);
  }
  function every(key, expected) {
    const values = fields.get(key);
    assert.ok(values?.length > 0 && values.every((value) => value === expected), `W1 deployment assertion missing or contradictory: ${key}`);
  }
  every('PC_W1_TARGET_SHA', proof.deployedSha);
  every('PC_W1_DEPLOYED_API_SHA', proof.deployedSha);
  for (const key of ['API_RELEASE', 'API_READY', 'API_DIGEST_VERIFIED', 'DATABASE_IDENTITY', 'SCHEMA_STRUCTURAL_CHECKS', 'RUNTIME_UNCHANGED', 'API_ENV_UNCHANGED', 'NON_API_WORKLOADS_UNCHANGED', 'PUBLIC_ROUTE']) every(`PC_W1_${key}`, 'PASS');
  every('PC_W1_PENDING_MIGRATIONS', '0');
  every('PC_W1_SCHEMA_TABLES', '24');
  const catalogs = fields.get('PC_W1_SCHEMA_CATALOG_SHA256');
  assert.ok(catalogs?.length > 0 && catalogs.every((value) => /^[a-f0-9]{64}$/u.test(value) && !/^0+$/u.test(value) && value === catalogs[0]), 'verified schema catalog hash required');
  every('PC_W1_REMOTE_EXIT', '0');
  every('PC_W1_CONTROLLER_STAGE', 'COMPLETED');
  for (const key of ['AUTHENTICATED_ACCEPTANCE', 'FULL_ACCEPTANCE', 'FULL_W1_ACCEPTANCE']) every(`PC_W1_${key}`, 'NOT_EVIDENCED');
  const decisions = fields.get('PC_W1_RESULT');
  assert.ok(decisions?.length > 0 && decisions.every((value) => ['MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE', 'VERIFIED_ALREADY_APPLIED'].includes(value)) && decisions.at(-1) === 'VERIFIED_ALREADY_APPLIED', 'post-deployment database verification required');
  const prefix = `PC-CROP W1 bounded migrate, run ${run.id}\n\nTarget: ${proof.deployedSha}\nRemote stage: success\nPublic route: success\n\n\`\`\`text\n${payload.stage}\`\`\`\n\n`;
  assert.ok(typeof payload.summary === 'string' && payload.summary.startsWith(prefix), 'W1 migrate summary/run/stage differs');
  assert.ok(payload.summary.includes('Authenticated W1 business acceptance: NOT_EVIDENCED. Full W1 DoD acceptance: NOT_EVIDENCED.'), 'W1 acceptance limits must remain explicit');
  assert.ok(payload.summary.includes('No real transaction or external provider success is claimed.'), 'W1 deployment cannot claim external success');
  return { authenticatedAcceptance: 'NOT_EVIDENCED', fullW1Acceptance: 'NOT_EVIDENCED', revenueAcceptance: 'NOT_EVIDENCED' };
}

async function responseBytes(response, maximum) {
  const length = response.headers.get('content-length');
  assert.ok(length === null || (Number.isSafeInteger(Number(length)) && Number(length) <= maximum), 'upstream evidence response too large');
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maximum) throw new Error('upstream evidence response too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Only HTTP is injectable for unit tests. The CLI supplies the native transport;
// producer admission, URL origins, digest checks and payload assertions are fixed.
export async function resolveArtifactEvidence(proof, { token, fetchImpl = globalThis.fetch } = {}) {
  const match = proof.evidenceUrl?.match(/^https:\/\/github\.com\/pachaninm-lab\/pachanin-demo\/actions\/runs\/([1-9]\d*)\/artifacts\/([1-9]\d*)$/u);
  assert.ok(match, 'only canonical immutable Actions artifact evidence is supported');
  assert.ok(approvedProducers[proof.kind], `no approved production evidence collector for ${proof.kind}`);
  assert.ok(typeof token === 'string' && token.length > 0, 'read-only GitHub Actions token required for evidence resolution');
  const runId = Number(match[1]);
  const artifactId = Number(match[2]);
  assert.ok(Number.isSafeInteger(runId) && Number.isSafeInteger(artifactId), 'unsupported upstream identity');
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
  async function request(url, options = {}) {
    try { return await fetchImpl(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15_000), ...options }); }
    catch { throw new Error('upstream evidence unavailable'); }
  }
  async function json(url) {
    const response = await request(url, { headers });
    assert.equal(response.status, 200, 'upstream evidence metadata unavailable');
    return JSON.parse((await responseBytes(response, 262_144)).toString('utf8'));
  }
  const artifactUrl = `${canonicalApi}/actions/artifacts/${artifactId}`;
  const [run, artifact] = await Promise.all([json(`${canonicalApi}/actions/runs/${runId}`), json(artifactUrl)]);
  assert.equal(run.id, runId, 'upstream run identity differs');
  assert.equal(run.repository?.full_name, canonicalRepository, 'upstream run repository differs');
  assert.equal(run.head_repository?.full_name, canonicalRepository, 'fork producer rejected');
  assert.equal(run.head_branch, 'main', 'production producer must run on canonical main');
  assert.ok(['issue_comment', 'workflow_dispatch'].includes(run.event), 'CI and pull request producers rejected');
  assert.equal(run.status, 'completed', 'upstream producer has not completed');
  assert.equal(run.conclusion, 'success', 'upstream producer did not succeed');
  assert.equal(run.path, approvedProducers[proof.kind], 'unapproved production producer');
  assert.equal(run.head_sha, proof.deployedSha, 'producer revision differs from deployed revision');
  assert.ok(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0, 'producer attempt required');
  assert.equal(artifact.id, artifactId, 'artifact identity differs');
  assert.equal(artifact.url, artifactUrl, 'artifact canonical URL differs');
  assert.equal(artifact.archive_download_url, `${artifactUrl}/zip`, 'artifact download URL differs');
  assert.equal(artifact.name, `pc-crop-w1-production-${runId}-${run.run_attempt}`, 'wrong production artifact/attempt');
  assert.equal(artifact.workflow_run?.id, runId, 'artifact belongs to another run');
  assert.equal(artifact.workflow_run?.head_sha, run.head_sha, 'artifact source revision differs');
  assert.equal(artifact.workflow_run?.head_branch, 'main', 'artifact source branch differs');
  assert.equal(artifact.workflow_run?.repository_id, run.repository.id, 'artifact repository identity differs');
  assert.equal(artifact.workflow_run?.head_repository_id, run.repository.id, 'artifact fork identity differs');
  assert.equal(artifact.expired, false, 'expired evidence artifact');
  const observationTime = Date.parse(artifact.created_at);
  assert.ok(Number.isFinite(observationTime) && observationTime <= Date.now() + 300_000 && observationTime >= Date.now() - 86_400_000, 'deployment artifact is stale');
  assert.equal(Date.parse(proof.observedAt), observationTime, 'observation must identify the actual artifact creation time');
  assert.ok(Date.parse(artifact.expires_at) > Date.now(), 'expired or invalid artifact lifetime');
  assert.ok(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0 && artifact.size_in_bytes <= 2_097_152, 'artifact size unsupported');
  assert.match(proof.evidenceSha256 ?? '', /^[a-f0-9]{64}$/u, 'archive SHA-256 required');
  assert.equal(artifact.digest, `sha256:${proof.evidenceSha256}`, 'upstream artifact digest differs');
  const redirect = await request(`${artifactUrl}/zip`, { headers });
  assert.equal(redirect.status, 302, 'artifact archive unavailable');
  const location = new URL(redirect.headers.get('location'));
  assert.ok(location.protocol === 'https:' && !location.username && !location.password && (!location.port || location.port === '443') && /(?:\.blob\.core\.windows\.net|\.actions\.githubusercontent\.com)$/u.test(location.hostname), 'unsupported artifact storage origin');
  // Never forward the GitHub token to the signed storage URL.
  const download = await request(location.href);
  assert.equal(download.status, 200, 'artifact download failed');
  const archive = await responseBytes(download, 2_097_152);
  assert.equal(sha256(archive), proof.evidenceSha256, 'downloaded artifact bytes differ');
  assert.equal(archive.length, artifact.size_in_bytes, 'downloaded artifact length differs');
  const payload = unpackEvidence(archive);
  const limits = validateW1Deployment(payload, proof, run);
  return { status: 'RESOLVED_DEPLOYMENT_ONLY', workflowPath: run.path, runSha: run.head_sha, ...limits };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyRegisterStructure();
  const immutableGit = (...args) => execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  for (const proof of result.referencedEvidence) assert.ok(approvedProducers[proof.kind], `no approved production evidence collector for ${proof.kind}`);
  for (const proof of result.referencedEvidence) {
    const upstream = await resolveArtifactEvidence(proof, { token: process.env.GITHUB_TOKEN });
    // The approved producer's actual source must also be accepted trusted main.
    immutableGit('merge-base', '--is-ancestor', upstream.runSha, result.trustedMainSha);
    for (const source of w1ProducerSources) {
      assert.equal(immutableGit('rev-parse', `${upstream.runSha}:${source}`), immutableGit('rev-parse', `${result.trustedMainSha}:${source}`), 'producer source differs from trusted main; renew approval');
    }
  }
  process.stdout.write(`PC-CROP DoD verified: ${result.criteriaCount} criteria, ${result.passCount} PASS, ${result.strictPercent.toFixed(1)}% strict progress, ${result.gapCount} gap findings.\n`);
}
