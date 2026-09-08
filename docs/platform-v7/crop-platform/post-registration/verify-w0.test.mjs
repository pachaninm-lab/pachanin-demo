import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
const source = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(source, '../../../..');
const rel = path.relative(repo, source);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'revenue-contract-mutations-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));
const target = path.join(temporary, rel);
fs.mkdirSync(target, { recursive: true });
const base = JSON.parse(fs.readFileSync(path.join(source, 'execution-state.v1.json')));
// Read real accepted objects without copying a worktree's .git file/directory,
// changing source refs, or writing test objects into the source repository.
const cleanEnv = { ...process.env };
for (const key of Object.keys(cleanEnv)) {
  if (key.startsWith('GIT_')) delete cleanEnv[key];
}
function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, env: cleanEnv, encoding: 'utf8' });
  assert.equal(result.status, 0, `fixture git ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
}
const sourceObjects = git(repo, 'rev-parse', '--path-format=absolute', '--git-path', 'objects');
git(temporary, 'init', '--quiet');
fs.mkdirSync(path.join(temporary, '.git/objects/info'), { recursive: true });
fs.writeFileSync(path.join(temporary, '.git/objects/info/alternates'), `${sourceObjects}\n`);
const offMainResult = spawnSync('git', ['commit-tree', git(temporary, 'rev-parse', `${base.observedMainSha}^{tree}`), '-p', base.observedMainSha, '-m', 'Synthetic off-main evidence test fixture'], {
  cwd: temporary,
  env: { ...cleanEnv, GIT_AUTHOR_NAME: 'Evidence schema test', GIT_AUTHOR_EMAIL: 'schema-test@example.invalid', GIT_COMMITTER_NAME: 'Evidence schema test', GIT_COMMITTER_EMAIL: 'schema-test@example.invalid' },
  encoding: 'utf8',
});
assert.equal(offMainResult.status, 0, `off-main fixture commit failed: ${offMainResult.stderr}`);
const offMainSha = offMainResult.stdout.trim();
assert.match(offMainSha, /^[a-f0-9]{40}$/u);
assert.notEqual(offMainSha, base.observedMainSha);
base.observedProductionSha = base.observedMainSha;
const eventFile = path.join(temporary, 'trusted-event.json');
const trustedEvent = { repository: { full_name: 'pachaninm-lab/pachanin-demo' }, pull_request: { base: { sha: base.observedMainSha, ref: 'main', repo: { full_name: 'pachaninm-lab/pachanin-demo' } } } };
const verifierEnv = { ...cleanEnv, GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request', GITHUB_REPOSITORY: 'pachaninm-lab/pachanin-demo', GITHUB_EVENT_PATH: eventFile };
const gap = JSON.parse(fs.readFileSync(path.join(source, 'exact-gap-map.v1.json')));
for (const name of ['verify-w0.mjs', 'dod-baseline.v1.json', 'exact-gap-map.v1.json']) fs.copyFileSync(path.join(source, name), path.join(target, name));
for (const evidencePath of new Set([...gap.findings.flatMap((item) => item.evidence), ...base.revenueSliceV1.components.flatMap((item) => item.sourceEvidence)])) {
  const destination = path.join(temporary, evidencePath);
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.symlinkSync(path.join(repo, evidencePath), destination);
  }
}
// All accepted records below are synthetic schema-test fixtures, never production claims.
function proof(kind, id, extra = {}) {
  return { schemaVersion: 'pc-crop.revenue-evidence.v1', id, kind,
    deployedSha: base.observedProductionSha, implementationSha: base.observedMainSha, specificationSha256: base.specification.sha256,
    environment: 'REG_RU_PRODUCTION', executionMode: 'LIVE', result: 'PASS',
    observedAt: '2026-09-08T18:00:00Z',
    evidenceUrl: 'https://github.com/pachaninm-lab/pachanin-demo/actions/runs/1/artifacts/1',
    evidenceSha256: '1'.repeat(64), ...extra };
}
function acceptComponents(s, count) {
  s.w1Completion.productionStatus = 'ACCEPTED';
  s.revenueSliceV1.components.slice(0, count).forEach((item) => {
    item.status = 'PRODUCTION_ACCEPTED';
    item.productionEvidence = [proof('REG_RU_DEPLOYMENT', `${item.id}-deployment`, { componentId: item.id }), proof('LIVE_COMPONENT_ACCEPTANCE', `${item.id}-acceptance`, { componentId: item.id })];
  });
  s.revenueSliceV1.acceptedComponentCount = count;
  s.revenueSliceV1.progressPercent = Math.floor(count / 15 * 1000) / 10;
}
function complete(s) {
  acceptComponents(s, 15);
  const links = { canonicalDealId: 'schema-deal', tenantId: 'schema-tenant', farmerOrganizationId: 'schema-farmer', buyerOrganizationId: 'schema-buyer', companyOrganizationId: 'schema-company' };
  const make = (kind, extra) => proof(kind, `schema-${kind}`, { ...links, ...extra });
  s.revenueSliceV1.realTransaction = {
    status: 'ACCEPTED', realFarmerEvidence: make('REAL_FARMER'), realBuyerEvidence: make('REAL_BUYER'), canonicalDealEvidence: make('CANONICAL_DEAL'),
    applicableRegulatoryReceipts: [make('REGULATORY_RECEIPT', { system: 'FGIS_GRAIN', externalReceiptId: 'schema-fgis-receipt' })],
    executionEvidence: make('EXECUTION_ACCEPTANCE'), bankFinalityEvidence: make('BANK_FINALITY', { externalReceiptId: 'schema-bank-receipt' }),
    reconciliationEvidence: make('RECONCILIATION', { bankFinalityEvidenceId: 'schema-BANK_FINALITY', companyCashReceiptEvidenceId: 'schema-COMPANY_CASH_RECEIPT' }),
    lawfulCommissionBasis: make('LAWFUL_COMMISSION_BASIS', { contractVersionId: 'schema-contract-v1', currency: 'RUB', amountKopecks: '100' }),
    companyRevenueEvent: make('COMPANY_REVENUE_EVENT', { currency: 'RUB', amountKopecks: '100', commissionBasisEvidenceId: 'schema-LAWFUL_COMMISSION_BASIS' }),
    companyCashReceipt: make('COMPANY_CASH_RECEIPT', { currency: 'RUB', amountKopecks: '100', revenueEventEvidenceId: 'schema-COMPANY_REVENUE_EVENT', payeeOrganizationId: 'schema-company', externalReceiptId: 'schema-company-bank-receipt' })
  };
}
let caseNumber = 0;
function check(name, mutate, expectedSuccess = false, setup = () => {}, trust = {}) {
  const number = ++caseNumber;
  test(`${number}. ${name}`, () => {
    const state = structuredClone(base);
    setup(state);
    for (const name of ['exact-gap-map.v1.json', 'dod-baseline.v1.json']) {
      fs.copyFileSync(path.join(source, name), path.join(target, name));
    }
    mutate(state);
    fs.writeFileSync(path.join(target, 'execution-state.v1.json'), JSON.stringify(state));
    const event = structuredClone(trustedEvent);
    trust.mutateEvent?.(event);
    fs.writeFileSync(eventFile, JSON.stringify(event));
    const result = spawnSync(process.execPath, [path.join(target, 'verify-w0.mjs')], {
      cwd: temporary,
      encoding: 'utf8',
      env: { ...verifierEnv, ...trust.env },
      timeout: 30_000,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null, `${name}: verifier terminated`);
    assert.equal(result.status === 0, expectedSuccess, `${name}\n${result.stderr}`);
    if (trust.rejection) assert.match(result.stderr, trust.rejection);
  });
}
check('unchanged zero-credit register', () => {}, true);
check('synthetic single component contract', () => {}, true, (s) => acceptComponents(s, 1));
check('synthetic complete E2E contract', () => {}, true, complete);
for (const bad of [undefined, null, [], false]) check(`mandatory revenue object ${String(bad)}`, (s) => { if (bad === undefined) delete s.revenueSliceV1; else s.revenueSliceV1 = bad; });
check('canonical component identity', (s) => { s.revenueSliceV1.components[0].id = 'RS-99'; });
for (const bad of [[], [null], ['placeholder'], [{}]]) check(`untyped acceptance ${JSON.stringify(bad)}`, (s) => { s.revenueSliceV1.components[0].productionEvidence = bad; }, false, (s) => acceptComponents(s, 1));
for (const mutate of [
  (p) => { p.pop(); }, (p) => { p.shift(); },
  (p) => { p[1].deployedSha = '2'.repeat(40); },
  (p) => { p[1].deployedSha = 'short'; },
  (p) => { p[1].componentId = 'RS-02'; },
  (p) => { p[1].executionMode = 'SIMULATED'; },
  (p) => { p[1].environment = 'VERCEL'; },
  (p) => { p[1].result = 'FAIL'; },
  (p) => { p[1].evidenceUrl = 'placeholder'; },
  (p) => { p[1].evidenceSha256 = '0'.repeat(64); },
  (p) => { p[1].observedAt = 'yesterday'; },
  (p) => { p[1].specificationSha256 = '2'.repeat(64); },
]) check('invalid deployment/live evidence', (s) => mutate(s.revenueSliceV1.components[0].productionEvidence), false, (s) => acceptComponents(s, 1));
check('invented matching deployment SHA', (s) => { s.observedProductionSha = 'a'.repeat(40); for(const p of s.revenueSliceV1.components[0].productionEvidence) p.deployedSha=s.observedProductionSha; }, false, (s) => acceptComponents(s, 1));
check('missing implementation commit', (s) => { for(const p of s.revenueSliceV1.components[0].productionEvidence) p.implementationSha='a'.repeat(40); }, false, (s) => acceptComponents(s, 1));
check('deployed history lacks implementation', (s) => { s.observedProductionSha='d401f2678070eae3362d22d09b60aadf3a8e042d'; for(const p of s.revenueSliceV1.components[0].productionEvidence) p.deployedSha=s.observedProductionSha; }, false, (s) => acceptComponents(s, 1));
check('accepted implementation lacks component source', (s) => { for(const p of s.revenueSliceV1.components[0].productionEvidence) p.implementationSha='d401f2678070eae3362d22d09b60aadf3a8e042d'; }, false, (s) => acceptComponents(s, 1));
check('unaccepted implementation commit', (s) => { for(const p of s.revenueSliceV1.components[0].productionEvidence) p.implementationSha=offMainSha; }, false, (s) => acceptComponents(s, 1));
check('real off-main commit cannot self-authorize main', (s) => {
  const offMain = offMainSha;
  s.observedMainSha=offMain;s.observedProductionSha=offMain;
  const gm=JSON.parse(fs.readFileSync(path.join(target,'exact-gap-map.v1.json')));gm.exactMainBaseline=offMain;fs.writeFileSync(path.join(target,'exact-gap-map.v1.json'),JSON.stringify(gm));
  const db=JSON.parse(fs.readFileSync(path.join(target,'dod-baseline.v1.json')));db.exactMainBaseline=offMain;fs.writeFileSync(path.join(target,'dod-baseline.v1.json'),JSON.stringify(db));
  for(const p of s.revenueSliceV1.components[0].productionEvidence){p.deployedSha=offMain;p.implementationSha=offMain;}
}, false, (s) => acceptComponents(s,1));
check('W1 prerequisite', (s) => { s.w1Completion.productionStatus = 'BLOCKED'; }, false, (s) => acceptComponents(s, 1));
check('100% without real transaction', () => {}, false, (s) => acceptComponents(s, 15));
check('accepted transaction before 15 components', (s) => { s.revenueSliceV1.components[14].status = 'NOT_ACCEPTED'; s.revenueSliceV1.acceptedComponentCount = 14; s.revenueSliceV1.progressPercent = 93.3; }, false, complete);
for (const key of Object.keys(base.revenueSliceV1.realTransaction).filter((key) => key !== 'status')) {
  check(`missing E2E ${key}`, (s) => { delete s.revenueSliceV1.realTransaction[key]; }, false, complete);
  check(`placeholder E2E ${key}`, (s) => { s.revenueSliceV1.realTransaction[key] = 'placeholder'; }, false, complete);
}
for (const mutate of [
  (t) => { t.realBuyerEvidence.canonicalDealId = 'other-deal'; },
  (t) => { t.companyCashReceipt.tenantId = 'other-tenant'; },
  (t) => { t.realFarmerEvidence.farmerOrganizationId = 'other-farmer'; },
  (t) => { t.companyCashReceipt.payeeOrganizationId = 'other-company'; },
  (t) => { t.companyCashReceipt.amountKopecks = '99'; },
  (t) => { t.companyRevenueEvent.amountKopecks = 100; },
  (t) => { t.lawfulCommissionBasis.amountKopecks = '0'; },
  (t) => { t.companyCashReceipt.revenueEventEvidenceId = 'other-event'; },
  (t) => { t.companyRevenueEvent.commissionBasisEvidenceId = 'other-basis'; },
  (t) => { t.reconciliationEvidence.companyCashReceiptEvidenceId = 'other-cash'; },
  (t) => { t.reconciliationEvidence.bankFinalityEvidenceId = 'other-bank'; },
  (t) => { t.bankFinalityEvidence.externalReceiptId = null; },
  (t) => { t.companyCashReceipt.externalReceiptId = null; },
  (t) => { t.applicableRegulatoryReceipts = []; },
  (t) => { t.applicableRegulatoryReceipts[0].system = 'OTHER_SYSTEM'; },
  (t) => { t.executionEvidence.id = t.bankFinalityEvidence.id; },
  (t) => { t.companyCashReceipt.deployedSha = '2'.repeat(40); },
  (t) => { t.companyRevenueEvent.result = 'PENDING'; },
]) check('broken E2E linkage or finality', (s) => mutate(s.revenueSliceV1.realTransaction), false, complete);

// These exercise the trust boundary even though the real register is still 0%.
// Positive LIVE/production-shaped records are synthetic schema fixtures only;
// they are never persisted, uploaded, or counted as actual production evidence.
const oneAcceptedComponent = (state) => acceptComponents(state, 1);
for (const [name, trust] of [
  ['wrong workflow repository', { env: { GITHUB_REPOSITORY: 'fork/example' }, rejection: /trusted workflow repository required/u }],
  ['wrong event repository', { mutateEvent: (event) => { event.repository.full_name = 'fork/example'; }, rejection: /trusted event repository required/u }],
  ['missing event repository', { mutateEvent: (event) => { delete event.repository; }, rejection: /trusted event repository required/u }],
  ['wrong PR base repository', { mutateEvent: (event) => { event.pull_request.base.repo.full_name = 'fork/example'; }, rejection: /trusted PR base repository required/u }],
  ['wrong PR base ref', { mutateEvent: (event) => { event.pull_request.base.ref = 'release'; }, rejection: /trusted PR base must be main/u }],
  ['missing PR base', { mutateEvent: (event) => { delete event.pull_request.base; }, rejection: /trusted PR base repository required/u }],
  ['invented trusted PR base commit', { mutateEvent: (event) => { event.pull_request.base.sha = 'a'.repeat(40); }, rejection: /trusted main: missing or ambiguous repository object/u }],
  ['non-main push workflow', { env: { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/feature', GITHUB_SHA: base.observedMainSha }, rejection: /non-PR acceptance requires a main workflow/u }],
  ['non-main manual workflow', { env: { GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/feature', GITHUB_SHA: base.observedMainSha }, rejection: /non-PR acceptance requires a main workflow/u }],
]) check(name, () => {}, false, oneAcceptedComponent, trust);
check('trusted pull_request_target base accepts a synthetic component', () => {}, true, oneAcceptedComponent, { env: { GITHUB_EVENT_NAME: 'pull_request_target' } });
check('trusted main push accepts a synthetic component', () => {}, true, oneAcceptedComponent, { env: { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: base.observedMainSha } });

assert.equal(caseNumber, 82, 'the complete 71-case contract plus 11 trust-source regressions must run');
