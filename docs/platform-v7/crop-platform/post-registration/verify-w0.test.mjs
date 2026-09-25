import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { resolveArtifactEvidence, validateW1Deployment } from './verify-w0.mjs';
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
// Synthetic records are used only by exported STRUCTURE_ONLY validation.
// The real CLI must reject them and cannot use an injected HTTP transport.
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
    const structureScript = `import { verifyRegisterStructure } from ${JSON.stringify(pathToFileURL(path.join(target, 'verify-w0.mjs')).href)}; const result = verifyRegisterStructure(); if (result.status !== 'STRUCTURE_ONLY_NOT_ACCEPTANCE') throw new Error('structural result cannot grant acceptance');`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', structureScript], {
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
check('synthetic single component structure only', () => {}, true, (s) => acceptComponents(s, 1));
check('synthetic complete E2E structure only', () => {}, true, complete);
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

for (const [name, setup, symlink] of [['component', (state) => acceptComponents(state, 1)], ['complete transaction', complete], ['symlinked component', (state) => acceptComponents(state, 1), true]]) {
  test(`real CLI rejects invented ${name} URL/hash fixtures`, () => {
    const state = structuredClone(base);
    setup(state);
    for (const name of ['exact-gap-map.v1.json', 'dod-baseline.v1.json']) fs.copyFileSync(path.join(source, name), path.join(target, name));
    fs.writeFileSync(path.join(target, 'execution-state.v1.json'), JSON.stringify(state));
    fs.writeFileSync(eventFile, JSON.stringify(trustedEvent));
    const entry = symlink ? path.join(temporary, 'verify-w0-link.mjs') : path.join(target, 'verify-w0.mjs');
    if (symlink) fs.symlinkSync(path.join(target, 'verify-w0.mjs'), entry);
    const result = spawnSync(process.execPath, [entry], { cwd: temporary, encoding: 'utf8', env: { ...verifierEnv, GITHUB_TOKEN: '' }, timeout: 30_000 });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /read-only GitHub Actions token required|no approved production evidence collector/u);
    assert.doesNotMatch(result.stdout, /PC-CROP DoD verified/u);
  });
}

function archiveFor(files, method = 0) {
  const localParts = [], centralParts = [];
  let offset = 0;
  for (const [filename, text] of Object.entries(files)) {
    const name = Buffer.from(filename), expanded = Buffer.from(text);
    const body = method === 8 ? deflateRawSync(expanded) : expanded;
    let crc = 0xffffffff;
    for (const byte of expanded) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(expanded.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(method, 10); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20); central.writeUInt32LE(expanded.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    localParts.push(local, name, body); centralParts.push(central, name); offset += local.length + name.length + body.length;
  }
  const central = Buffer.concat(centralParts), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, central, end]);
}

function upstreamFixture() {
  const record = proof('REG_RU_DEPLOYMENT', 'schema-deployment', { componentId: 'RS-01', observedAt: new Date().toISOString() });
  const run = { id: 1, run_attempt: 1, repository: { id: 10, full_name: 'pachaninm-lab/pachanin-demo' }, head_repository: { full_name: 'pachaninm-lab/pachanin-demo' }, head_branch: 'main', head_sha: record.deployedSha, event: 'issue_comment', status: 'completed', conclusion: 'success', path: '.github/workflows/pc-crop-w1-production-acceptance.yml' };
  // These are isolated unit bytes in the actual existing controller's format.
  // They are never admitted by CLI transport or written to an accepted register.
  const stage = [
    `PC_W1_TARGET_SHA=${record.deployedSha}`, `PC_W1_DEPLOYED_API_SHA=${record.deployedSha}`,
    ...['API_RELEASE', 'API_READY', 'API_DIGEST_VERIFIED', 'DATABASE_IDENTITY', 'SCHEMA_STRUCTURAL_CHECKS', 'RUNTIME_UNCHANGED', 'API_ENV_UNCHANGED', 'NON_API_WORKLOADS_UNCHANGED', 'PUBLIC_ROUTE'].map((key) => `PC_W1_${key}=PASS`),
    'PC_W1_PENDING_MIGRATIONS=0', 'PC_W1_SCHEMA_TABLES=24', 'PC_W1_REMOTE_EXIT=0', 'PC_W1_CONTROLLER_STAGE=COMPLETED',
    ...['AUTHENTICATED_ACCEPTANCE', 'FULL_ACCEPTANCE', 'FULL_W1_ACCEPTANCE'].map((key) => `PC_W1_${key}=NOT_EVIDENCED`),
    `PC_W1_SCHEMA_CATALOG_SHA256=${'2'.repeat(64)}`, 'PC_W1_RESULT=MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE', 'PC_W1_RESULT=VERIFIED_ALREADY_APPLIED',
  ].join('\n') + '\n';
  const payload = { stage, summary: '' };
  const artifact = { id: 1, name: 'pc-crop-w1-production-1-1', url: 'https://api.github.com/repos/pachaninm-lab/pachanin-demo/actions/artifacts/1', archive_download_url: 'https://api.github.com/repos/pachaninm-lab/pachanin-demo/actions/artifacts/1/zip', workflow_run: { id: 1, repository_id: 10, head_repository_id: 10, head_branch: 'main', head_sha: run.head_sha }, expired: false, expires_at: '2099-01-01T00:00:00Z', created_at: record.observedAt };
  const fixture = { record, run, payload, artifact };
  refreshSummary(fixture);
  return fixture;
}
function refreshSummary(f) {
  f.payload.summary = `PC-CROP W1 bounded migrate, run ${f.run.id}\n\nTarget: ${f.record.deployedSha}\nRemote stage: success\nPublic route: success\n\n\`\`\`text\n${f.payload.stage}\`\`\`\n\nAuthenticated W1 business acceptance: NOT_EVIDENCED. Full W1 DoD acceptance: NOT_EVIDENCED. No real transaction or external provider success is claimed.\n`;
}

function injectedHttp(fixture, mutateArchive = (bytes) => bytes) {
  const archive = archiveFor(fixture.files ?? { 'stage.log': fixture.payload.stage, 'result.md': fixture.payload.summary }, fixture.zipMethod);
  const digest = createHash('sha256').update(archive).digest('hex');
  fixture.record.evidenceSha256 = digest;
  fixture.artifact.digest ??= `sha256:${digest}`;
  fixture.artifact.size_in_bytes ??= archive.length;
  const downloaded = mutateArchive(archive);
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(url); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'manual');
    if (url === 'https://unit-evidence.blob.core.windows.net/archive') {
      assert.equal(options.headers, undefined, 'token must not cross the storage redirect');
      return new Response(downloaded);
    }
    assert.equal(options.headers.Authorization, 'Bearer unit-test');
    if (url.endsWith('/actions/runs/1')) return Response.json(fixture.run);
    if (url.endsWith('/actions/artifacts/1')) return Response.json(fixture.artifact);
    if (url.endsWith('/actions/artifacts/1/zip')) return new Response(null, { status: 302, headers: { location: fixture.redirect ?? 'https://unit-evidence.blob.core.windows.net/archive' } });
    throw new Error('unexpected unit HTTP URL');
  };
  return { fetchImpl, calls };
}

for (const method of [0, 8]) test(`injected HTTP verifies actual W1 archive format, ZIP method ${method}, with no revenue credit`, async () => {
  const fixture = upstreamFixture(); fixture.zipMethod = method;
  const http = injectedHttp(fixture);
  const result = await resolveArtifactEvidence(fixture.record, { token: 'unit-test', fetchImpl: http.fetchImpl });
  assert.equal(result.status, 'RESOLVED_DEPLOYMENT_ONLY');
  assert.equal(result.authenticatedAcceptance, 'NOT_EVIDENCED');
  assert.equal(result.fullW1Acceptance, 'NOT_EVIDENCED');
  assert.equal(result.revenueAcceptance, 'NOT_EVIDENCED');
  assert.equal(http.calls.length, 4);
});

for (const [name, mutate, rejection] of [
  ['wrong run ID', (f) => { f.run.id = 2; }, /run identity/u],
  ['wrong run repository', (f) => { f.run.repository.full_name = 'fork/example'; }, /run repository/u],
  ['fork producer', (f) => { f.run.head_repository.full_name = 'fork/example'; }, /fork producer/u],
  ['non-main producer', (f) => { f.run.head_branch = 'feature'; }, /canonical main/u],
  ['ordinary CI artifact', (f) => { f.run.event = 'push'; }, /CI and pull request/u],
  ['PR artifact', (f) => { f.run.event = 'pull_request'; }, /CI and pull request/u],
  ['wrong producer workflow', (f) => { f.run.path = '.github/workflows/ci.yml'; }, /unapproved production producer/u],
  ['unfinished run', (f) => { f.run.status = 'in_progress'; }, /not completed/u],
  ['failed run', (f) => { f.run.conclusion = 'failure'; }, /did not succeed/u],
  ['wrong deployed revision', (f) => { f.run.head_sha = 'a'.repeat(40); }, /producer revision/u],
  ['artifact ID mismatch', (f) => { f.artifact.id = 2; }, /artifact identity/u],
  ['artifact URL mismatch', (f) => { f.artifact.url = 'https://example.invalid'; }, /canonical URL/u],
  ['download URL mismatch', (f) => { f.artifact.archive_download_url = 'https://example.invalid'; }, /download URL/u],
  ['isolated rehearsal name', (f) => { f.artifact.name = 'pc-crop-w1-isolated-rehearsal-1-1'; }, /wrong production artifact/u],
  ['another attempt', (f) => { f.artifact.name = 'pc-crop-w1-production-1-2'; }, /wrong production artifact/u],
  ['another run', (f) => { f.artifact.workflow_run.id = 2; }, /another run/u],
  ['another artifact revision', (f) => { f.artifact.workflow_run.head_sha = 'a'.repeat(40); }, /source revision/u],
  ['another artifact repository', (f) => { f.artifact.workflow_run.repository_id = 11; }, /repository identity/u],
  ['expired flag', (f) => { f.artifact.expired = true; }, /expired evidence/u],
  ['expired lifetime', (f) => { f.artifact.expires_at = '2000-01-01T00:00:00Z'; }, /artifact lifetime/u],
  ['stale runtime deployment', (f) => { f.artifact.created_at = '2000-01-01T00:00:00Z'; }, /artifact is stale/u],
  ['invented observation time', (f) => { f.record.observedAt = '2000-01-01T00:00:00Z'; }, /actual artifact creation time/u],
  ['missing digest', (f) => { f.artifact.digest = ''; }, /artifact digest/u],
  ['invented digest', (f) => { f.artifact.digest = `sha256:${'1'.repeat(64)}`; }, /artifact digest/u],
  ['unsafe redirect', (f) => { f.redirect = 'http://127.0.0.1/archive'; }, /storage origin/u],
  ['unknown JSON envelope', (f) => { f.files = { 'pc-crop-production-evidence.v1.json': '{}' }; }, /exact W1 evidence members/u],
  ['unexpected archive member', (f) => { f.files = { '../stage.log': f.payload.stage, 'result.md': f.payload.summary }; }, /unsupported or duplicate/u],
  ['web component claim', (f) => { f.record.componentId = 'RS-15'; }, /cannot attest web components/u],
]) test(`upstream admission rejects ${name}`, async () => {
  const fixture = upstreamFixture(); mutate(fixture);
  const { fetchImpl } = injectedHttp(fixture);
  await assert.rejects(resolveArtifactEvidence(fixture.record, { token: 'unit-test', fetchImpl }), rejection);
});

for (const key of ['TARGET_SHA', 'DEPLOYED_API_SHA', 'API_RELEASE', 'API_READY', 'API_DIGEST_VERIFIED', 'DATABASE_IDENTITY', 'SCHEMA_STRUCTURAL_CHECKS', 'RUNTIME_UNCHANGED', 'API_ENV_UNCHANGED', 'NON_API_WORKLOADS_UNCHANGED', 'PUBLIC_ROUTE', 'PENDING_MIGRATIONS', 'SCHEMA_TABLES', 'REMOTE_EXIT', 'CONTROLLER_STAGE', 'AUTHENTICATED_ACCEPTANCE', 'FULL_ACCEPTANCE', 'FULL_W1_ACCEPTANCE', 'SCHEMA_CATALOG_SHA256']) test(`W1 deployment requires actual ${key} assertion`, () => {
  const fixture = upstreamFixture();
  fixture.payload.stage = fixture.payload.stage.split('\n').filter((line) => !line.startsWith(`PC_W1_${key}=`)).join('\n');
  refreshSummary(fixture);
  assert.throws(() => validateW1Deployment(fixture.payload, fixture.record, fixture.run), /assertion missing|catalog/u);
});

for (const [name, change, rejection] of [
  ['contradictory deployed SHA', (f) => { f.payload.stage += `PC_W1_DEPLOYED_API_SHA=${'a'.repeat(40)}\n`; }, /contradictory/u],
  ['false full acceptance', (f) => { f.payload.stage = f.payload.stage.replace('PC_W1_FULL_W1_ACCEPTANCE=NOT_EVIDENCED', 'PC_W1_FULL_W1_ACCEPTANCE=PASS'); }, /contradictory/u],
  ['pending migrations', (f) => { f.payload.stage = f.payload.stage.replace('PC_W1_PENDING_MIGRATIONS=0', 'PC_W1_PENDING_MIGRATIONS=7'); }, /contradictory/u],
  ['production blocker', (f) => { f.payload.stage += 'PC_W1_BLOCKER=DATABASE_DRIFT\n'; }, /failure cannot/u],
  ['failed external signal', (f) => { f.payload.stage += 'PC_W1_PUBLIC_ROUTE=FAIL\n'; }, /failure cannot/u],
  ['untyped raw line', (f) => { f.payload.stage += 'raw untrusted log\n'; }, /untyped/u],
  ['missing post-deploy verification', (f) => { f.payload.stage = f.payload.stage.replace('PC_W1_RESULT=VERIFIED_ALREADY_APPLIED\n', ''); }, /post-deployment/u],
  ['read-only preflight summary', (f) => { f.payload.summary = f.payload.summary.replace('bounded migrate', 'bounded preflight'); }, /summary\/run\/stage/u],
  ['summary for another run', (f) => { f.payload.summary = f.payload.summary.replace('run 1', 'run 2'); }, /summary\/run\/stage/u],
  ['summary with hidden limits', (f) => { f.payload.summary = f.payload.summary.replace('Full W1 DoD acceptance: NOT_EVIDENCED.', ''); }, /acceptance limits/u],
]) test(`W1 deployment rejects ${name}`, () => {
  const fixture = upstreamFixture(); change(fixture);
  assert.throws(() => validateW1Deployment(fixture.payload, fixture.record, fixture.run), rejection);
});

test('upstream admission hashes actual downloaded archive bytes', async () => {
  const fixture = upstreamFixture();
  const { fetchImpl } = injectedHttp(fixture, (archive) => Buffer.concat([archive, Buffer.from('tampered')]));
  await assert.rejects(resolveArtifactEvidence(fixture.record, { token: 'unit-test', fetchImpl }), /downloaded artifact bytes differ/u);
});
for (const status of [403, 404, 410, 429, 500]) test(`upstream metadata HTTP ${status} fails closed`, async () => {
  await assert.rejects(resolveArtifactEvidence(upstreamFixture().record, { token: 'unit-test', fetchImpl: async () => new Response(null, { status }) }), /metadata unavailable/u);
});
test('missing GitHub token fails before HTTP', async () => {
  await assert.rejects(resolveArtifactEvidence(upstreamFixture().record, { fetchImpl: async () => { throw new Error('must not run'); } }), /read-only GitHub Actions token required/u);
});
test('unavailable upstream cannot become external success', async () => {
  await assert.rejects(resolveArtifactEvidence(upstreamFixture().record, { token: 'unit-test', fetchImpl: async () => { throw new Error('network failed'); } }), /upstream evidence unavailable/u);
});
for (const kind of ['LIVE_COMPONENT_ACCEPTANCE', 'REAL_FARMER', 'REAL_BUYER', 'CANONICAL_DEAL', 'REGULATORY_RECEIPT', 'EXECUTION_ACCEPTANCE', 'BANK_FINALITY', 'RECONCILIATION', 'LAWFUL_COMMISSION_BASIS', 'COMPANY_REVENUE_EVENT', 'COMPANY_CASH_RECEIPT']) test(`${kind} has no approved collector and cannot earn credit`, async () => {
  const fixture = upstreamFixture(); fixture.record.kind = kind;
  await assert.rejects(resolveArtifactEvidence(fixture.record, { token: 'unit-test', fetchImpl: async () => { throw new Error('must not run'); } }), /no approved production evidence collector/u);
});

// The actual executable remains usable for the real unevidenced register.
test('real zero-credit CLI succeeds without credentials or network evidence', () => {
  fs.writeFileSync(path.join(target, 'execution-state.v1.json'), JSON.stringify(base));
  for (const name of ['exact-gap-map.v1.json', 'dod-baseline.v1.json']) fs.copyFileSync(path.join(source, name), path.join(target, name));
  fs.writeFileSync(eventFile, JSON.stringify(trustedEvent));
  const result = spawnSync(process.execPath, [path.join(target, 'verify-w0.mjs')], { cwd: temporary, encoding: 'utf8', env: { ...verifierEnv, GITHUB_TOKEN: '' }, timeout: 30_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PC-CROP DoD verified: 126 criteria, 4 PASS, 3\.1%/u);
});
