import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import test, { after } from 'node:test';

const finalPublicBranches = [
  'agent/platform-v7-strategic-rebuild-v3',
  'p0/farmer-public-market-teaser-20260913',
  'fix/public-registration-final-copy-4916',
  'fix/public-deal-journey-10of10-current-main-20260808',
  'agent/platform-v7-product-copy',
  'ops/production-full-stack-release-v1',
];
const finalPublicGovernanceBranch = 'governance/final-public-experience-v1-20260919';
const industrialGovernanceBranch = 'governance/industrial-load-diagnostics-20260919';
const industrialDiagnosticBranch = 'test/industrial-load-diagnostics-20260919';
const ir20BindingPrerequisiteBranch = 'governance/ir20-binding-immutable-scope-20260919';
const ir20BindingImplementationBranch = 'ops/ir20-api-database-binding-20260919';
const ir20BindingImplementationPaths = [
  'scripts/release/ir20-api-database-binding.py',
  'scripts/release/test-ir20-api-database-binding.py',
  'scripts/release/test-ir20-api-database-binding-integration.py',
  '.github/workflows/ir20-api-database-binding.yml',
  'docs/ops/ir20-api-database-binding.md',
];
const productImplementationManifests = new Map([
  ['bank/deep-visible-copy-guard-20260924', 'docs/platform-v7/autopilot/scopes/bank-deep-visible-copy-guard-20260924.json'],
  ['fgis/zsn-public-document-source-lock-20260924', 'docs/platform-v7/autopilot/scopes/fgis-zsn-public-document-source-lock-20260924.json'],
  ['ux/first-customer-next-action-unknown-20260924', 'docs/platform-v7/autopilot/scopes/first-customer-next-action-unknown-20260924.json'],
  ['fix/public-registration-participation-choice-20260923', 'docs/platform-v7/autopilot/scopes/public-registration-participation-choice-20260923.json'],
  ['fix/production-mobile-controller-handoff-20260927', 'docs/platform-v7/autopilot/scopes/production-mobile-controller-handoff-20260927.json'],
  ['fix/readiness-queue-job-gate-20260927', 'docs/platform-v7/autopilot/scopes/readiness-queue-job-gate-20260927.json'],
  ['fix/readiness-default-branch-push-gate-20260929', 'docs/platform-v7/autopilot/scopes/readiness-default-branch-push-gate-20260929.json'],
  ['ux/buyer-first-customer-home-20260925', 'docs/platform-v7/autopilot/scopes/buyer-first-customer-home-20260925.json'],
  ['bank/first-customer-home-20260926', 'docs/platform-v7/autopilot/scopes/bank-first-customer-home-20260926.json'],
]);
const productAdmissionBranch = 'governance/product-bank-fgis-ux-source-admission-20260924';
const buyerAdmissionBranch = 'governance/product-buyer-home-admission-20260925';
const buyerBranch = 'ux/buyer-first-customer-home-20260925';
const buyerCoordinationKey = 'ux-buyer-first-customer-home-20260925-coordination';
const buyerPaths = [
  'apps/web/components/platform-v7/FirstCustomerWorkspace.tsx',
  'apps/web/components/platform-v7/FirstCustomerWorkspace.module.css',
  'apps/web/tests/unit/designSystemV8MoneyRoles.test.ts',
  'apps/web/tests/unit/platformV7BuyerFirstCustomerUx.test.tsx',
  'docs/platform-v7/autopilot/scopes/buyer-first-customer-home-20260925.json',
];
const bankHomeAdmissionBranch = 'governance/product-bank-home-admission-20260926';
const bankHomeBranch = 'bank/first-customer-home-20260926';
const bankHomeCoordinationKey = 'bank-first-customer-home-20260926-coordination';
const bankHomePaths = [
  'apps/web/components/platform-v7/FirstCustomerWorkspace.tsx',
  'apps/web/components/platform-v7/FirstCustomerWorkspace.module.css',
  'apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx',
  'apps/web/tests/unit/designSystemV8MoneyRoles.test.ts',
  'apps/web/tests/unit/platformV7RoleIntentDashboard.test.ts',
  'apps/web/tests/e2e/platform-v7-canonical-visual-evidence.spec.ts',
  'docs/platform-v7/autopilot/scopes/bank-first-customer-home-20260926.json',
];
const dealCommandImplementationBranch = 'ux/deal-command-unknown-20260925';
const webkitI18nBranch = 'fix/public-webkit-i18n-route-lifecycle-20260927';
const webkitI18nTestPath = 'apps/web/tests/e2e/platform-v7-production-i18n-acceptance.spec.ts';
const productAdmissionPaths = new Map([
  ['bank/deep-visible-copy-guard-20260924', [
    'apps/web/app/platform-v7/bank/escrow/page.tsx',
    'apps/web/app/platform-v7/bank/factoring/page.tsx',
    'apps/web/app/platform-v7/bank/release-safety/page.tsx',
    'apps/web/app/platform-v7/profile/page.tsx',
    'apps/web/tests/unit/bankReleaseSafetyRoute.test.tsx',
    'apps/web/tests/unit/platformV7DeepBankDealCopyGuard.test.ts',
    'docs/platform-v7/autopilot/scopes/bank-deep-visible-copy-guard-20260924.json',
  ]],
  ['fgis/zsn-public-document-source-lock-20260924', [
    '.github/workflows/pc-crop-zsn-source-lock.yml',
    'docs/platform-v7/crop-platform/efgis-zsn-api-document.source-lock.json',
    'docs/platform-v7/crop-platform/efgis-zsn-api-document.source-lock.schema.json',
    'scripts/pc-crop-zsn/verify-source-lock.mjs',
    'scripts/pc-crop-zsn/verify-source-lock.test.mjs',
    'docs/platform-v7/autopilot/scopes/fgis-zsn-public-document-source-lock-20260924.json',
  ]],
  ['ux/first-customer-next-action-unknown-20260924', [
    'apps/web/components/platform-v7/FirstCustomerWorkspace.tsx',
    'apps/web/tests/unit/designSystemV8MoneyRoles.test.ts',
    'apps/web/tests/unit/sellerExecutionPolish.test.tsx',
    'docs/platform-v7/autopilot/scopes/first-customer-next-action-unknown-20260924.json',
  ]],
]);
const productAdmissionCoordinationKeys = new Map([
  ['bank/deep-visible-copy-guard-20260924', 'bank-deep-visible-copy-guard-20260924-coordination'],
  ['fgis/zsn-public-document-source-lock-20260924', 'fgis-zsn-public-document-source-lock-20260924-coordination'],
  ['ux/first-customer-next-action-unknown-20260924', 'ux-first-customer-next-action-unknown-20260924-coordination'],
]);
const productAdmissionMetadata = new Map([
  ['bank/deep-visible-copy-guard-20260924', {
    purpose: 'Presentation-only bank/deal copy guard and negative release safety wording; no provider or payment finality.',
    requiredTruthBoundaries: [
      'Preserve the forbidden money-finality and demo vocabulary guard, including absence of the removed operator execution queue source.',
      'A recorded release request is not external execution; unresolved outcome requires same-operation reconciliation before retry.',
      'RU/EN/ZH bank copy does not attribute a concrete provider or claim factoring, release or debit finality.',
    ],
    forbiddenAuthority: [
      'API/DB/settlement/ledger/provider/callback or money-finality authority',
      'tenant/role/session authority',
      'CI/security gate weakening',
    ],
    teamHubDependency: '#5565; Team Hub #5469 scope correction 5818641448',
  }],
  ['fgis/zsn-public-document-source-lock-20260924', {
    purpose: 'Lock public operator-linked EFGIS ZSN document identity and PDF bytes as provenance only.',
    requiredTruthBoundaries: [
      'Pin official public operator-linked PDF identity, 906732-byte payload and SHA-256; title/year are not an API contract version.',
      'Keep historical government-system registry v1 byte-immutable and mutation capability disabled.',
      'Do not claim organization access, credentials, signature, legal acceptance, delegated access, live mutation or E2E.',
    ],
    forbiddenAuthority: [
      'FGIS credentials/API write/signature/legal finality',
      'government registry v1 mutation',
      'CI/security gate weakening',
    ],
    teamHubDependency: '#5532; Team Hub #5469 scope correction 5818641448',
  }],
  ['ux/first-customer-next-action-unknown-20260924', {
    purpose: 'Keep recency-sorted first customer queues as navigation for seven roles while server priority is absent.',
    requiredTruthBoundaries: [
      'Buyer, bank, logistics, driver, elevator, lab and surveyor must display UNKNOWN primary next action until accepted server-derived priority.',
      'RU/EN/ZH and keyboard-visible in-page queue navigation remain available; server-scoped item links are preserved.',
      'Owner-controlled showroom navigation and seller fail-closed behavior stay intact.',
    ],
    forbiddenAuthority: [
      'API/DB/tenant/role/priority authority',
      'bank/FGIS/provider/settlement finality',
      'CI/security gate weakening',
    ],
    teamHubDependency: '#5535; Team Hub #5469 scope correction 5818641448',
  }],
]);
function productCoordinationRecord(branch, paths, base) {
  return {
    owner: 'ACCOUNT_2_PRODUCT', ...productAdmissionMetadata.get(branch),
    authorityBaseExactMain: base, implementationBranch: branch, allowedPaths: [...paths],
  };
}
const industrialDiagnosticPaths = ['apps/api/test/industrial/load-proof.e2e-spec.ts'];
const industrialGovernancePaths = [
  'docs/platform-v7/autopilot/autopilot-state.json',
  'docs/platform-v7/execution-queue.md',
  'docs/platform-v7/autopilot/prompts/current-codex-task.md',
  'docs/platform-v7/autopilot/prompts/current-review-task.md',
  'scripts/p7-autopilot-guard.sh',
  'scripts/p7-autopilot-guard.test.mjs',
  '.github/workflows/platform-v7-autopilot-guard.yml',
];
const finalPublicGovernancePaths = [
  'docs/platform-v7/autopilot/autopilot-state.json',
  'docs/platform-v7/autopilot/scopes/platform-v7-strategic-rebuild-v3.json',
  'docs/platform-v7/autopilot/scopes/public-registration-final-copy-4916.json',
  'scripts/p7-autopilot-guard.sh',
  'scripts/p7-autopilot-guard.test.mjs',
  '.github/workflows/platform-v7-autopilot-guard.yml',
];
const implementationBranches = [
  'fix/p0-registration-authority-rollover-4637',
  'fix/p0-owner-control-plane-audit-lock-4698',
  'feat/pc-crop-auction-inventory-authority-4997',
  'ops/pc-crop-w1-production-acceptance-4997',
  'docs/pc-crop-post-registration-progress-4997',
  'governance/pc-crop-post-registration-progress-scope-4997',
  'governance/pc-crop-inventory-reservation-scope-4997',
  'fix/owner-handoff-product-host-20260908',
  ir20BindingImplementationBranch,
  ...finalPublicBranches,
];
const publicHomeGovernanceBranch = 'governance/public-home-role-clarity-scope-20260905';
const publicHomeImplementationBranch = 'feat/public-home-role-clarity-20260905';
const publicHomeGovernanceManifest = 'docs/platform-v7/autopilot/scopes/governance-public-home-role-clarity-scope-20260905.json';
const publicHomeImplementationManifest = 'docs/platform-v7/autopilot/scopes/public-home-role-clarity-20260905.json';
const poisonIsolationImplementationBranch = 'fix/production-like-outbox-poison-isolation-3793';
const poisonIsolationManifest = 'docs/platform-v7/autopilot/scopes/production-like-outbox-poison-isolation-3793.json';
const poisonIsolationScript = 'scripts/release/production-like-kubernetes-outbox-runtime.sh';
const qwenFailedEvidenceBranch = 'fix/local-qwen-failed-review-evidence-20260912';
const kindMinioImageSourceBranch = 'fix/kind-minio-image-source-20260912';
const gitleaksReleaseAttestationBranch = 'fix/gitleaks-release-authority-attestation-20260912';
const gitleaksReleaseAttestationPath = 'apps/tai/tests/test_gitleaks_release_authority.py';
const kindMinioImageSourcePaths = [
  'infra/kind/production-like/dependencies.yaml',
  'infra/kind/production-like/minio-tls-check.yaml',
  'scripts/release/production-like-kubernetes-cluster.sh',
];
const qwenFailedEvidencePaths = [
  '.github/workflows/local-qwen-independent-review.yml',
  'docs/platform-v7/autopilot/verify-pr-review-gate.test.mjs',
];
const sourceGuard = path.resolve('scripts/p7-autopilot-guard.sh');
const sourceResolver = path.resolve('scripts/p7-source-controlled-scope.mjs');
const sourceWorkflow = path.resolve('.github/workflows/platform-v7-autopilot-guard.yml');
const sourceGitleaksReleaseAttestation = path.resolve(gitleaksReleaseAttestationPath);
const gitleaksCommodityAnchor =
  '        "ec4b80ce1ee4fa7cf18361f1ff536c34b5030948:"\n' +
  '        "apps/api/src/modules/commodity-profiles/commodity-profile-command.contract.spec.ts:"\n' +
  '        "generic-api-key:11",\n';
const gitleaksServiceMarketplace =
  '        "8c08a3d3764b616f919a1e73828643dff95db5d4:"\n' +
  '        "apps/api/src/modules/service-marketplace/service-marketplace.contract.spec.ts:"\n' +
  '        "generic-api-key:11",\n';
const gitleaksSdizAnchor = '        ".github/workflows/pc-crop-08f-sync-main.yml:generic-api-key:126",\n';
const gitleaksFinalReviewedEntries =
  '        "bcc5ba620f5e8cfec4e540c4b9fab4e236393c63:"\n' +
  '        "apps/web/tests/unit/platformV7RootWorkEntry.test.ts:generic-api-key:227",\n' +
  '        "25f4fa23451d9b2fd58ff60ba9badfc063055796:"\n' +
  '        ".github/workflows/pc-crop-w1-production-acceptance.yml:generic-api-key:391",\n' +
  '        "ba4e7b26a34f95ebc5636c6a18785a6a2d63b0b1:"\n' +
  '        ".github/workflows/pc-crop-w1-production-acceptance.yml:generic-api-key:395",\n';
const gitleaksCurrentAnchor =
  '        "db4f0a50b8df0a5e1045d3b9dc6a6fdc9d2806b0:"\n' +
  '        "apps/web/tests/unit/platformV7RootWorkEntry.test.ts:generic-api-key:1018",\n';
const gitleaksCurrentReviewedEntries =
  '        "2dbd66d9bf258113272825d7b082b20e3b15a2b6:"\n' +
  '        "docs/platform-v7/autopilot/autopilot-state.json:generic-api-key:2713",\n' +
  '        "3b76d0f3473b986b6354aaac528994f7ac343df2:"\n' +
  '        "apps/api/src/modules/service-marketplace/service-marketplace.contract.spec.ts:"\n' +
  '        "generic-api-key:17",\n';
const gitleaksSessionMintingAnchor =
  '        "3b76d0f3473b986b6354aaac528994f7ac343df2:"\n' +
  '        "apps/api/src/modules/service-marketplace/service-marketplace.contract.spec.ts:"\n' +
  '        "generic-api-key:17",\n';
const gitleaksSessionMintingEntries =
  '        "8e1febfffeb4da36f1dba9badb7522ddb6513c1d:"\n' +
  '        "apps/web/tests/unit/sessionMintingSurface.spec.ts:generic-api-key:137",\n' +
  '        "8e1febfffeb4da36f1dba9badb7522ddb6513c1d:"\n' +
  '        "apps/web/tests/unit/sessionMintingSurface.spec.ts:generic-api-key:138",\n';

// Historical attestation phases are bound to immutable accepted blobs, never to
// the mutable repository test, so later accepted synchronizations cannot shift
// their baselines.
function acceptedBlob(blob) {
  const result = spawnSync('git', ['cat-file', 'blob', blob], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function blobOf(content) {
  const result = spawnSync('git', ['hash-object', '--stdin'], { input: content, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

function baselineGitleaksReleaseAttestation(source) {
  const serviceCount = source.split(gitleaksServiceMarketplace).length - 1;
  const finalCount = source.split(gitleaksFinalReviewedEntries).length - 1;
  assert.ok(serviceCount === 0 || serviceCount === 1);
  assert.equal(finalCount, serviceCount, 'reviewed fingerprint groups must be both absent or both present');
  return source
    .replace(gitleaksServiceMarketplace, '')
    .replace(gitleaksFinalReviewedEntries, '');
}

function synchronizeGitleaksReleaseAttestation(baseline) {
  assert.equal(baseline.split(gitleaksCommodityAnchor).length - 1, 1);
  assert.equal(baseline.split(gitleaksSdizAnchor).length - 1, 1);
  return baseline
    .replace(gitleaksCommodityAnchor, gitleaksCommodityAnchor + gitleaksServiceMarketplace)
    .replace(gitleaksSdizAnchor, gitleaksSdizAnchor + gitleaksFinalReviewedEntries);
}

function write(root, file, content, mode) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  if (mode) fs.chmodSync(target, mode);
}

// Every fixture repository opts out of git's automatic maintenance. Since git
// 2.47 `maintenance.autoDetach` defaults to true, so `git commit` hands
// `maintenance run --auto` to a detached background process that can still be
// writing under .git after the test body returns. The cleanup hook then races
// it and fails with ENOTEMPTY even after its retries (CI runs git 2.55). The
// setting is repository-local, so it also covers every git call the guard
// script itself makes inside the fixture. No assertion changes.
const FIXTURE_GIT_CONFIG = [['maintenance.auto', 'false'], ['gc.auto', '0']];

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  if (args[0] === 'init') {
    for (const [key, value] of FIXTURE_GIT_CONFIG) {
      const config = spawnSync('git', ['config', key, value], { cwd: root, encoding: 'utf8' });
      assert.equal(config.status, 0, `${config.stdout}\n${config.stderr}`);
    }
  }
  return result.stdout.trim();
}

function commit(root, message) {
  git(root, ['add', '--all']);
  git(root, ['commit', '-m', message]);
}

// Reuse only an immutable copy of a genuine baseline built by the unchanged
// constructor. Every caller receives separate files, refs and mutable history.
const fixtureSnapshots = new Map();
let fixtureSnapshotDirectory;
after(() => {
  if (fixtureSnapshotDirectory) fs.rmSync(fixtureSnapshotDirectory, { recursive: true, force: true });
});

function fixture(t, implementationBranch) {
  // Conditional includes may activate only after the fixture Git directory exists.
  // Conservatively retain the constructor for any conditional include or custom setup.
  if (Object.keys(process.env).some(name => name.startsWith('GIT_') && name !== 'GIT_PAGER')) return constructFixture(t, implementationBranch);
  const custom = spawnSync('git', ['config', '--includes', '--get-regexp', '^(core\\.[Hh]ooks[Pp]ath|init\\.[Tt]emplate[Dd]ir|include[Ii]f\\..*\\.path)$'], { cwd: os.tmpdir(), encoding: 'utf8' });
  if (custom.status !== 1) return constructFixture(t, implementationBranch);
  const guard = fs.readFileSync(sourceGuard, 'utf8');
  const resolver = fs.readFileSync(sourceResolver, 'utf8');
  const key = createHash('sha256').update(JSON.stringify([implementationBranch, guard, resolver])).digest('hex');
  const previous = fixtureSnapshots.get(key);
  if (previous) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-immutable-scope-guard-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
    fs.cpSync(previous.directory, root, { recursive: true, dereference: false });
    assert.equal(fs.readFileSync(path.join(root, '.git', 'HEAD'), 'utf8'), `ref: refs/heads/${implementationBranch}\n`);
    assert.equal(fs.readFileSync(path.join(root, '.git', 'refs', 'heads', implementationBranch), 'utf8'), `${previous.baseline}\n`);
    return { root, baseline: previous.baseline, implementationBranch };
  }
  const context = constructFixture(t, implementationBranch);
  if (fs.readFileSync(path.join(context.root, 'scripts/p7-autopilot-guard.sh'), 'utf8') !== guard ||
      fs.readFileSync(path.join(context.root, 'scripts/p7-source-controlled-scope.mjs'), 'utf8') !== resolver ||
      fs.readdirSync(path.join(context.root, '.git', 'hooks')).some(name => !name.endsWith('.sample'))) return context;
  fixtureSnapshotDirectory ??= fs.mkdtempSync(path.join(os.tmpdir(), 'p7-fixture-snapshots-'));
  const directory = path.join(fixtureSnapshotDirectory, key);
  fs.cpSync(context.root, directory, { recursive: true, dereference: false });
  fixtureSnapshots.set(key, { directory, baseline: context.baseline });
  return context;
}

function constructFixture(t, implementationBranch) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-immutable-scope-guard-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));

  write(root, 'scripts/p7-autopilot-guard.sh', fs.readFileSync(sourceGuard, 'utf8'), 0o755);
  write(root, 'scripts/p7-source-controlled-scope.mjs', fs.readFileSync(sourceResolver, 'utf8'), 0o755);
  write(root, '.github/workflows/platform-v7-autopilot-guard.yml', 'name: fixture\n');
  write(root, 'docs/platform-v7/autopilot/autopilot-state.json', `${JSON.stringify({
    allowedCurrentScope: ['README.md'],
    approvedConcurrentScopes: {
      [implementationBranch]: ['allowed.txt', 'approved/**'],
    },
  }, null, 2)}\n`);
  write(root, 'README.md', 'baseline\n');
  write(root, 'allowed.txt', 'baseline\n');
  write(root, 'apps/api/src/app.module.ts', 'unapproved source\n');
  write(root, 'apps/web/components/platform-v7/staff/OwnerAccessCenter.tsx', 'unapproved legacy trigger\n');

  git(root, ['init', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'PC-CROP Guard Test']);
  git(root, ['config', 'user.email', 'pc-crop-guard@example.invalid']);
  commit(root, 'baseline');
  const baseline = git(root, ['rev-parse', 'HEAD']);
  git(root, ['switch', '-c', implementationBranch]);
  return { root, baseline, implementationBranch };
}

test('IR-20 binding prerequisite admits exactly the five non-authority implementation paths', () => {
  const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  assert.deepEqual(state.approvedConcurrentScopes[ir20BindingImplementationBranch], ir20BindingImplementationPaths);
  assert.deepEqual(state.approvedConcurrentScopes[ir20BindingPrerequisiteBranch], [
    'scripts/p7-autopilot-guard.sh',
    'scripts/p7-autopilot-guard.test.mjs',
    '.github/workflows/platform-v7-autopilot-guard.yml',
    'docs/platform-v7/autopilot/autopilot-state.json',
  ]);
  assert.equal(ir20BindingImplementationPaths.some((file) => file.includes('/scopes/')), false);
});

function publicHomeImplementationFixture(t, { withManifest = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-public-home-immutable-scope-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  write(root, 'scripts/p7-autopilot-guard.sh', fs.readFileSync(sourceGuard, 'utf8'), 0o755);
  write(root, 'scripts/p7-source-controlled-scope.mjs', fs.readFileSync(sourceResolver, 'utf8'), 0o755);
  write(root, '.github/workflows/platform-v7-autopilot-guard.yml', 'name: fixture\n');
  write(root, '.github/workflows/automerge.yml', 'name: baseline automerge\n');
  write(root, 'docs/platform-v7/autopilot/autopilot-state.json', '{"allowedCurrentScope":["README.md"],"approvedConcurrentScopes":{}}\n');
  write(root, 'README.md', 'baseline\n');
  write(root, 'allowed.txt', 'baseline\n');
  write(root, 'apps/api/src/app.module.ts', 'unapproved source\n');
  if (withManifest) {
    write(root, publicHomeImplementationManifest, `${JSON.stringify({
      schemaVersion: 'platform-v7.concurrent-scope.v1',
      branch: publicHomeImplementationBranch,
      status: 'active',
      allowedPaths: ['allowed.txt'],
    }, null, 2)}\n`);
  }
  git(root, ['init', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'Public Home Guard Test']);
  git(root, ['config', 'user.email', 'public-home-guard@example.invalid']);
  commit(root, 'accepted base');
  const baseline = git(root, ['rev-parse', 'HEAD']);
  git(root, ['switch', '-c', publicHomeImplementationBranch]);
  return { root, baseline, implementationBranch: publicHomeImplementationBranch };
}

function poisonIsolationFixture(t, { manifest = 'valid' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-poison-isolation-immutable-scope-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  write(root, 'scripts/p7-autopilot-guard.sh', fs.readFileSync(sourceGuard, 'utf8'), 0o755);
  write(root, 'scripts/p7-source-controlled-scope.mjs', fs.readFileSync(sourceResolver, 'utf8'), 0o755);
  write(root, '.github/workflows/platform-v7-autopilot-guard.yml', 'name: fixture\n');
  write(root, 'docs/platform-v7/autopilot/autopilot-state.json', '{"allowedCurrentScope":["README.md"],"approvedConcurrentScopes":{}}\n');
  write(root, 'README.md', 'baseline\n');
  write(root, poisonIsolationScript, 'baseline runtime harness\n');
  if (manifest !== null) {
    if (manifest === 'malformed') {
      write(root, poisonIsolationManifest, '{not-json\n');
    } else {
      const value = {
        schemaVersion: 'platform-v7.concurrent-scope.v1',
        branch: poisonIsolationImplementationBranch,
        status: 'active',
        allowedPaths: [poisonIsolationManifest, poisonIsolationScript],
        ...(manifest === 'valid' ? {} : manifest),
      };
      write(root, poisonIsolationManifest, `${JSON.stringify(value, null, 2)}\n`);
    }
  }
  git(root, ['init', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'Poison Isolation Guard Test']);
  git(root, ['config', 'user.email', 'poison-isolation-guard@example.invalid']);
  commit(root, 'accepted base');
  const baseline = git(root, ['rev-parse', 'HEAD']);
  git(root, ['switch', '-c', poisonIsolationImplementationBranch]);
  return { root, baseline, implementationBranch: poisonIsolationImplementationBranch };
}

function publicHomeGovernanceFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-public-home-governance-scope-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  write(root, 'scripts/p7-autopilot-guard.sh', fs.readFileSync(sourceGuard, 'utf8'), 0o755);
  write(root, 'scripts/p7-source-controlled-scope.mjs', fs.readFileSync(sourceResolver, 'utf8'), 0o755);
  write(root, '.github/workflows/platform-v7-autopilot-guard.yml', 'name: fixture\n');
  write(root, 'docs/platform-v7/autopilot/autopilot-state.json', '{"allowedCurrentScope":["README.md"],"approvedConcurrentScopes":{}}\n');
  write(root, 'README.md', 'baseline\n');
  git(root, ['init', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'Public Home Governance Guard Test']);
  git(root, ['config', 'user.email', 'public-home-governance@example.invalid']);
  commit(root, 'trusted base before public-home manifests');
  const baseline = git(root, ['rev-parse', 'HEAD']);
  git(root, ['switch', '-c', publicHomeGovernanceBranch]);
  return { root, baseline, implementationBranch: publicHomeGovernanceBranch };
}

function runGuard({ root, baseline, implementationBranch }) {
  return spawnSync('bash', ['scripts/p7-autopilot-guard.sh'], {
    cwd: root,
    env: {
      ...process.env,
      BASE_REF: baseline,
      HEAD_REF: 'HEAD',
      GITHUB_HEAD_REF: implementationBranch,
    },
    encoding: 'utf8',
  });
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function qwenFailedEvidenceFixture(t) {
  const context = fixture(t, qwenFailedEvidenceBranch);
  fs.mkdirSync(path.join(context.root, 'docs/platform-v7/autopilot/scopes'), { recursive: true });
  write(context.root, 'docs/platform-v7/autopilot/autopilot-state.json', JSON.stringify({
    allowedCurrentScope: ['README.md'],
    approvedConcurrentScopes: { [qwenFailedEvidenceBranch]: qwenFailedEvidencePaths },
  }));
  commit(context.root, 'accepted bounded Qwen diagnostic scope');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  return context;
}

function kindMinioImageSourceFixture(t) {
  const context = fixture(t, kindMinioImageSourceBranch);
  write(context.root, 'infra/kind/production-like/dependencies.yaml', 'baseline dependencies\n');
  write(context.root, 'infra/kind/production-like/minio-tls-check.yaml', 'baseline TLS check\n');
  write(context.root, 'scripts/release/production-like-kubernetes-cluster.sh', '#!/usr/bin/env bash\n', 0o755);
  const state = JSON.parse(fs.readFileSync(path.join(context.root, 'docs/platform-v7/autopilot/autopilot-state.json'), 'utf8'));
  state.approvedConcurrentScopes[kindMinioImageSourceBranch] = kindMinioImageSourcePaths;
  write(context.root, 'docs/platform-v7/autopilot/autopilot-state.json', `${JSON.stringify(state, null, 2)}\n`);
  commit(context.root, 'accepted bounded kind MinIO image-source scope');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  return context;
}

function gitleaksReleaseAttestationFixture(t, source = fs.readFileSync(sourceGitleaksReleaseAttestation, 'utf8')) {
  const context = fixture(t, gitleaksReleaseAttestationBranch);
  write(context.root, gitleaksReleaseAttestationPath, baselineGitleaksReleaseAttestation(source));
  const state = JSON.parse(fs.readFileSync(path.join(context.root, 'docs/platform-v7/autopilot/autopilot-state.json'), 'utf8'));
  state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch] = [gitleaksReleaseAttestationPath];
  write(context.root, 'docs/platform-v7/autopilot/autopilot-state.json', `${JSON.stringify(state, null, 2)}\n`);
  commit(context.root, 'accepted bounded gitleaks attestation scope');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  return context;
}

test('gitleaks release attestation scope accepts exactly four reviewed fingerprints', (t) => {
  const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  assert.deepEqual(state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch], expectedAttestationScope(state));
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  assert.ok(workflow.includes(`- '${gitleaksReleaseAttestationPath}'`), 'missing Gitleaks attestation PR-head trigger');
  const source = fs.readFileSync(sourceGitleaksReleaseAttestation, 'utf8');
  const normalizedBaseline = baselineGitleaksReleaseAttestation(source);
  const synchronized = synchronizeGitleaksReleaseAttestation(normalizedBaseline);
  assert.equal(baselineGitleaksReleaseAttestation(synchronized), normalizedBaseline);

  const allowed = gitleaksReleaseAttestationFixture(t);
  const baseline = fs.readFileSync(path.join(allowed.root, gitleaksReleaseAttestationPath), 'utf8');
  write(allowed.root, gitleaksReleaseAttestationPath, synchronizeGitleaksReleaseAttestation(baseline));
  commit(allowed.root, 'synchronize exact fingerprint attestation');
  const acceptedResult = runGuard(allowed);
  assert.equal(acceptedResult.status, 0, output(acceptedResult));

  const rejected = gitleaksReleaseAttestationFixture(t);
  write(rejected.root, '.gitleaksignore', 'unauthorized allowlist mutation\n');
  commit(rejected.root, 'attempt to mutate gitleaks allowlist');
  const rejectedResult = runGuard(rejected);
  assert.notEqual(rejectedResult.status, 0, output(rejectedResult));
  assert.match(output(rejectedResult), /\.gitleaksignore/u);
  assert.match(output(rejectedResult), /Files outside current autopilot scope/u);
});

for (const mutation of ['remove existing assertion', 'add fifth fingerprint', 'alter reviewed fingerprint']) {
  test(`gitleaks release attestation rejects content mutation: ${mutation}`, (t) => {
    const context = gitleaksReleaseAttestationFixture(t);
    const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
    let candidate = synchronizeGitleaksReleaseAttestation(baseline);
    if (mutation === 'remove existing assertion') {
      candidate = candidate.replace('    assert ".gitleaksignore" in manifest["files"]\n', '');
    } else if (mutation === 'add fifth fingerprint') {
      candidate = candidate.replace('    ]\n', '        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:extra.py:generic-api-key:1",\n    ]\n');
    } else {
      candidate = candidate.replace(':generic-api-key:395",', ':generic-api-key:396",');
    }
    write(context.root, gitleaksReleaseAttestationPath, candidate);
    commit(context.root, `attempt ${mutation}`);
    const result = runGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /must add exactly four reviewed fingerprints/u);
  });
}

function currentGitleaksReleaseAttestationFixture(t) {
  const context = fixture(t, gitleaksReleaseAttestationBranch);
  // The accepted test before the two-existing-fingerprint repair.
  write(context.root, gitleaksReleaseAttestationPath, acceptedBlob('e589046fc52daf8a3632f70b6879543934be56ff'));
  // This fixture models the immutable historical attestation, not today's allowlist.
  const historicalIgnore = spawnSync('git', ['cat-file', 'blob', '5c151dc1a2b5329fb2d4feb1fd0c1713bbef96db'], { encoding: 'utf8' });
  assert.equal(historicalIgnore.status, 0, `${historicalIgnore.stdout}\n${historicalIgnore.stderr}`);
  write(context.root, '.gitleaksignore', historicalIgnore.stdout);
  write(context.root, 'apps/tai/release-source-manifest.json', fs.readFileSync('apps/tai/release-source-manifest.json', 'utf8'));
  const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
  state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch] = [gitleaksReleaseAttestationPath];
  write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
  commit(context.root, 'accepted exact current Gitleaks attestation inputs');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  assert.equal(git(context.root, ['rev-parse', `${context.baseline}:${gitleaksReleaseAttestationPath}`]), 'e589046fc52daf8a3632f70b6879543934be56ff');
  assert.equal(git(context.root, ['rev-parse', `${context.baseline}:.gitleaksignore`]), '5c151dc1a2b5329fb2d4feb1fd0c1713bbef96db');
  assert.equal(git(context.root, ['rev-parse', `${context.baseline}:apps/tai/release-source-manifest.json`]), '35f96ccc7fe332ddd90454eeee19853ba0612b71');
  return context;
}

function synchronizeCurrentGitleaksReleaseAttestation(baseline) {
  assert.equal(baseline.split(gitleaksCurrentAnchor).length - 1, 1);
  return baseline.replace(gitleaksCurrentAnchor, gitleaksCurrentAnchor + gitleaksCurrentReviewedEntries);
}

function runTrustedCurrentGitleaksGuard({ root, baseline, implementationBranch }) {
  const trustedGuard = git(root, ['show', `${baseline}:scripts/p7-autopilot-guard.sh`]);
  return spawnSync('bash', [], {
    cwd: root,
    input: trustedGuard,
    env: { ...process.env, BASE_REF: baseline, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: implementationBranch },
    encoding: 'utf8',
  });
}

test('current Gitleaks attestation accepts only the exact two-existing-fingerprint repair', (t) => {
  const context = currentGitleaksReleaseAttestationFixture(t);
  const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
  write(context.root, gitleaksReleaseAttestationPath, synchronizeCurrentGitleaksReleaseAttestation(baseline));
  commit(context.root, 'synchronize current exact fingerprint attestation');
  assert.equal(git(context.root, ['rev-parse', `HEAD:${gitleaksReleaseAttestationPath}`]), '404e172449f53c01369ef974a50079d6f6967d56');
  const result = runTrustedCurrentGitleaksGuard(context);
  assert.equal(result.status, 0, output(result));
});

for (const mutation of [
  'remove manifest assertion', 'weaken format assertion', 'remove old fingerprint',
  'add extra fingerprint', 'alter first fingerprint', 'alter second fingerprint',
  'omit first fingerprint', 'omit second fingerprint', 'reverse fingerprint order',
]) {
  test(`current Gitleaks attestation rejects candidate content: ${mutation}`, (t) => {
    const context = currentGitleaksReleaseAttestationFixture(t);
    const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
    let candidate = synchronizeCurrentGitleaksReleaseAttestation(baseline);
    if (mutation === 'remove manifest assertion') candidate = candidate.replace('    assert ".gitleaksignore" in manifest["files"]\n', '');
    if (mutation === 'weaken format assertion') candidate = candidate.replace('    assert all(_FINGERPRINT.fullmatch(entry) is not None for entry in entries)\n', '    assert True\n');
    if (mutation === 'remove old fingerprint') candidate = candidate.replace(gitleaksCommodityAnchor, '');
    if (mutation === 'add extra fingerprint') candidate = candidate.replace('    ]\n', '        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:extra.py:generic-api-key:1",\n    ]\n');
    if (mutation === 'alter first fingerprint') candidate = candidate.replace('generic-api-key:2713', 'generic-api-key:2714');
    if (mutation === 'alter second fingerprint') candidate = candidate.replace('generic-api-key:17', 'generic-api-key:18');
    const lines = gitleaksCurrentReviewedEntries.split('\n').filter(Boolean);
    if (mutation === 'omit first fingerprint') candidate = candidate.replace(gitleaksCurrentReviewedEntries, `${lines.slice(2).join('\n')}\n`);
    if (mutation === 'omit second fingerprint') candidate = candidate.replace(gitleaksCurrentReviewedEntries, `${lines.slice(0, 2).join('\n')}\n`);
    if (mutation === 'reverse fingerprint order') candidate = candidate.replace(gitleaksCurrentReviewedEntries, `${[...lines.slice(2), ...lines.slice(0, 2)].join('\n')}\n`);
    write(context.root, gitleaksReleaseAttestationPath, candidate);
    commit(context.root, `attempt ${mutation}`);
    const result = runTrustedCurrentGitleaksGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /Gitleaks release attestation head must be the exact two-fingerprint regular-file repair/u);
  });
}

for (const file of ['.gitleaksignore', 'apps/tai/release-source-manifest.json']) {
  for (const side of ['base', 'head']) {
    test(`current Gitleaks attestation rejects ${side} input drift: ${file}`, (t) => {
      const context = currentGitleaksReleaseAttestationFixture(t);
      if (side === 'base') {
        fs.appendFileSync(path.join(context.root, file), '\n');
        commit(context.root, 'drift accepted input');
        context.baseline = git(context.root, ['rev-parse', 'HEAD']);
      }
      const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
      write(context.root, gitleaksReleaseAttestationPath, synchronizeCurrentGitleaksReleaseAttestation(baseline));
      if (side === 'head') fs.appendFileSync(path.join(context.root, file), '\n');
      commit(context.root, 'attempt repair with drifting input');
      const result = runTrustedCurrentGitleaksGuard(context);
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /Gitleaks release attestation input must remain the exact accepted regular file/u);
    });
  }
}

test('current Gitleaks attestation rejects baseline assertion drift', (t) => {
  const context = currentGitleaksReleaseAttestationFixture(t);
  const file = path.join(context.root, gitleaksReleaseAttestationPath);
  write(context.root, gitleaksReleaseAttestationPath, fs.readFileSync(file, 'utf8').replace('    assert ".gitleaksignore" in manifest["files"]\n', ''));
  commit(context.root, 'drift accepted test assertion');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  write(context.root, gitleaksReleaseAttestationPath, synchronizeCurrentGitleaksReleaseAttestation(fs.readFileSync(file, 'utf8')));
  commit(context.root, 'attempt repair over drifting test');
  const result = runTrustedCurrentGitleaksGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /Gitleaks release attestation commodity-profile anchor must occur exactly once/u);
});

for (const side of ['base', 'head']) {
  test(`current Gitleaks attestation rejects ${side} executable mode`, (t) => {
    const context = currentGitleaksReleaseAttestationFixture(t);
    if (side === 'base') {
      fs.chmodSync(path.join(context.root, gitleaksReleaseAttestationPath), 0o755);
      commit(context.root, 'drift accepted test mode');
      context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    }
    const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
    write(context.root, gitleaksReleaseAttestationPath, synchronizeCurrentGitleaksReleaseAttestation(baseline), 0o755);
    commit(context.root, 'attempt executable test repair');
    const result = runTrustedCurrentGitleaksGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /Gitleaks release attestation (baseline|head) must be the exact/u);
  });
}

test('current Gitleaks attestation rejects implementation-owned scope and guard expansion', (t) => {
  for (const target of ['state', 'guard']) {
    const context = currentGitleaksReleaseAttestationFixture(t);
    const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
    write(context.root, gitleaksReleaseAttestationPath, synchronizeCurrentGitleaksReleaseAttestation(baseline));
    if (target === 'state') {
      const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
      const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
      state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch].push('README.md');
      write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
      write(context.root, 'README.md', 'unapproved self-admission\n');
    } else {
      write(context.root, 'scripts/p7-autopilot-guard.sh', '#!/usr/bin/env bash\nexit 0\n');
    }
    commit(context.root, `attempt candidate ${target} authority`);
    const result = runTrustedCurrentGitleaksGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /Mutable scope authority changed on a PC-CROP immutable-scope implementation branch/u);
  }
});

function sessionMintingGitleaksReleaseAttestationFixture(t) {
  const context = fixture(t, gitleaksReleaseAttestationBranch);
  // The accepted test after the two-existing-fingerprint repair.
  write(context.root, gitleaksReleaseAttestationPath, acceptedBlob('404e172449f53c01369ef974a50079d6f6967d56'));
  // The accepted ignore file that already carries the two #5804 fingerprints.
  write(context.root, '.gitleaksignore', acceptedBlob('2c7aaa811ed3ea3dd1cf806ed1126705c173591b'));
  write(context.root, 'apps/tai/release-source-manifest.json', acceptedBlob('35f96ccc7fe332ddd90454eeee19853ba0612b71'));
  const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
  state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch] = [gitleaksReleaseAttestationPath];
  write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
  commit(context.root, 'accepted exact session-minting Gitleaks attestation inputs');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  assert.equal(git(context.root, ['rev-parse', `${context.baseline}:${gitleaksReleaseAttestationPath}`]), '404e172449f53c01369ef974a50079d6f6967d56');
  assert.equal(git(context.root, ['rev-parse', `${context.baseline}:.gitleaksignore`]), '2c7aaa811ed3ea3dd1cf806ed1126705c173591b');
  assert.equal(git(context.root, ['rev-parse', `${context.baseline}:apps/tai/release-source-manifest.json`]), '35f96ccc7fe332ddd90454eeee19853ba0612b71');
  return context;
}

function synchronizeSessionMintingGitleaksReleaseAttestation(baseline) {
  assert.equal(baseline.split(gitleaksSessionMintingAnchor).length - 1, 1);
  return baseline.replace(gitleaksSessionMintingAnchor, gitleaksSessionMintingAnchor + gitleaksSessionMintingEntries);
}

test('session-minting Gitleaks attestation accepts only the exact two-fingerprint synchronization', (t) => {
  const context = sessionMintingGitleaksReleaseAttestationFixture(t);
  const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
  write(context.root, gitleaksReleaseAttestationPath, synchronizeSessionMintingGitleaksReleaseAttestation(baseline));
  commit(context.root, 'synchronize session-minting fingerprint attestation');
  assert.equal(git(context.root, ['rev-parse', `HEAD:${gitleaksReleaseAttestationPath}`]), '95c914d64012a6260ca1090a01844b2c6f56cc3a');
  const result = runTrustedCurrentGitleaksGuard(context);
  assert.equal(result.status, 0, output(result));
});

for (const mutation of [
  'remove manifest assertion', 'weaken format assertion', 'remove old fingerprint',
  'add extra fingerprint', 'alter first fingerprint', 'alter second fingerprint',
  'omit first fingerprint', 'omit second fingerprint', 'reverse fingerprint order',
]) {
  test(`session-minting Gitleaks attestation rejects candidate content: ${mutation}`, (t) => {
    const context = sessionMintingGitleaksReleaseAttestationFixture(t);
    const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
    let candidate = synchronizeSessionMintingGitleaksReleaseAttestation(baseline);
    if (mutation === 'remove manifest assertion') candidate = candidate.replace('    assert ".gitleaksignore" in manifest["files"]\n', '');
    if (mutation === 'weaken format assertion') candidate = candidate.replace('    assert all(_FINGERPRINT.fullmatch(entry) is not None for entry in entries)\n', '    assert True\n');
    if (mutation === 'remove old fingerprint') candidate = candidate.replace(gitleaksCommodityAnchor, '');
    if (mutation === 'add extra fingerprint') candidate = candidate.replace('    ]\n', '        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:extra.py:generic-api-key:1",\n    ]\n');
    if (mutation === 'alter first fingerprint') candidate = candidate.replace('generic-api-key:137', 'generic-api-key:139');
    if (mutation === 'alter second fingerprint') candidate = candidate.replace('generic-api-key:138', 'generic-api-key:139');
    const lines = gitleaksSessionMintingEntries.split('\n').filter(Boolean);
    if (mutation === 'omit first fingerprint') candidate = candidate.replace(gitleaksSessionMintingEntries, `${lines.slice(2).join('\n')}\n`);
    if (mutation === 'omit second fingerprint') candidate = candidate.replace(gitleaksSessionMintingEntries, `${lines.slice(0, 2).join('\n')}\n`);
    if (mutation === 'reverse fingerprint order') candidate = candidate.replace(gitleaksSessionMintingEntries, `${[...lines.slice(2), ...lines.slice(0, 2)].join('\n')}\n`);
    write(context.root, gitleaksReleaseAttestationPath, candidate);
    commit(context.root, `attempt ${mutation}`);
    const result = runTrustedCurrentGitleaksGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /Gitleaks release attestation head must be the exact session-minting regular-file repair/u);
  });
}

for (const file of ['.gitleaksignore', 'apps/tai/release-source-manifest.json']) {
  for (const side of ['base', 'head']) {
    test(`session-minting Gitleaks attestation rejects ${side} input drift: ${file}`, (t) => {
      const context = sessionMintingGitleaksReleaseAttestationFixture(t);
      if (side === 'base') {
        fs.appendFileSync(path.join(context.root, file), '\n');
        commit(context.root, 'drift accepted input');
        context.baseline = git(context.root, ['rev-parse', 'HEAD']);
      }
      const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
      write(context.root, gitleaksReleaseAttestationPath, synchronizeSessionMintingGitleaksReleaseAttestation(baseline));
      if (side === 'head') fs.appendFileSync(path.join(context.root, file), '\n');
      commit(context.root, 'attempt repair with drifting input');
      const result = runTrustedCurrentGitleaksGuard(context);
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /Gitleaks release attestation input must remain the exact accepted regular file/u);
    });
  }
}

test('session-minting Gitleaks attestation rejects baseline assertion drift', (t) => {
  const context = sessionMintingGitleaksReleaseAttestationFixture(t);
  const file = path.join(context.root, gitleaksReleaseAttestationPath);
  write(context.root, gitleaksReleaseAttestationPath, fs.readFileSync(file, 'utf8').replace('    assert ".gitleaksignore" in manifest["files"]\n', ''));
  commit(context.root, 'drift accepted test assertion');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  write(context.root, gitleaksReleaseAttestationPath, synchronizeSessionMintingGitleaksReleaseAttestation(fs.readFileSync(file, 'utf8')));
  commit(context.root, 'attempt repair over drifting test');
  const result = runTrustedCurrentGitleaksGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /Gitleaks release attestation commodity-profile anchor must occur exactly once/u);
});

for (const side of ['base', 'head']) {
  test(`session-minting Gitleaks attestation rejects ${side} executable mode`, (t) => {
    const context = sessionMintingGitleaksReleaseAttestationFixture(t);
    if (side === 'base') {
      fs.chmodSync(path.join(context.root, gitleaksReleaseAttestationPath), 0o755);
      commit(context.root, 'drift accepted test mode');
      context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    }
    const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
    write(context.root, gitleaksReleaseAttestationPath, synchronizeSessionMintingGitleaksReleaseAttestation(baseline), 0o755);
    commit(context.root, 'attempt executable test repair');
    const result = runTrustedCurrentGitleaksGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /Gitleaks release attestation (baseline|head) must be the exact/u);
  });
}

test('session-minting Gitleaks attestation rejects implementation-owned scope and guard expansion', (t) => {
  for (const target of ['state', 'guard']) {
    const context = sessionMintingGitleaksReleaseAttestationFixture(t);
    const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
    write(context.root, gitleaksReleaseAttestationPath, synchronizeSessionMintingGitleaksReleaseAttestation(baseline));
    if (target === 'state') {
      const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
      const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
      state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch].push('README.md');
      write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
      write(context.root, 'README.md', 'unapproved self-admission\n');
    } else {
      write(context.root, 'scripts/p7-autopilot-guard.sh', '#!/usr/bin/env bash\nexit 0\n');
    }
    commit(context.root, `attempt candidate ${target} authority`);
    const result = runTrustedCurrentGitleaksGuard(context);
    assert.notEqual(result.status, 0, output(result));
    // The one-file rule of this phase is the first defence that rejects the mix.
    assert.match(output(result), /Gitleaks release attestation session-minting repair must change exactly the attestation test/u);
  }
});

for (const other of ['apps/landing/package.json', 'docs/ip/internal-package-metadata-exceptions.json']) {
  test(`session-minting Gitleaks attestation rejects a mixed diff with ${other}`, (t) => {
    const context = sessionMintingGitleaksReleaseAttestationFixture(t);
    // Model the real attestation ref vector, so the mix is otherwise in scope.
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch] = [
      gitleaksReleaseAttestationPath, 'apps/landing/package.json', 'docs/ip/internal-package-metadata-exceptions.json',
    ];
    write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
    write(context.root, other, '{}\n');
    commit(context.root, 'accepted attestation ref vector with metadata paths');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
    write(context.root, gitleaksReleaseAttestationPath, synchronizeSessionMintingGitleaksReleaseAttestation(baseline));
    write(context.root, other, '{"changed":true}\n');
    commit(context.root, `attempt test synchronization mixed with ${other}`);
    const result = runTrustedCurrentGitleaksGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /Gitleaks release attestation session-minting repair must change exactly the attestation test/u);
  });
}

test('legacy Gitleaks attestation phase cannot apply the session-minting synchronization', (t) => {
  const context = gitleaksReleaseAttestationFixture(t);
  const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
  write(context.root, gitleaksReleaseAttestationPath, synchronizeSessionMintingGitleaksReleaseAttestation(synchronizeGitleaksReleaseAttestation(baseline)));
  commit(context.root, 'attempt legacy and session-minting synchronizations together');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /must add exactly four reviewed fingerprints/u);
});

test('session-minting Gitleaks attestation phase cannot apply an earlier phase transformation', (t) => {
  const context = sessionMintingGitleaksReleaseAttestationFixture(t);
  const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
  write(context.root, gitleaksReleaseAttestationPath, synchronizeCurrentGitleaksReleaseAttestation(baseline));
  commit(context.root, 'attempt the two-existing-fingerprint transformation again');
  const result = runTrustedCurrentGitleaksGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /Gitleaks release attestation head must be the exact session-minting regular-file repair/u);
});

test('historical Gitleaks attestation fixtures hold for every accepted repository test revision', (t) => {
  const stepC = synchronizeSessionMintingGitleaksReleaseAttestation(acceptedBlob('404e172449f53c01369ef974a50079d6f6967d56'));
  assert.equal(blobOf(stepC), '95c914d64012a6260ca1090a01844b2c6f56cc3a');
  for (const [revision, source] of [
    ['404e1724', acceptedBlob('404e172449f53c01369ef974a50079d6f6967d56')],
    ['95c914d6', stepC],
  ]) {
    // The legacy four-fingerprint phase is the only one still derived from the repository test.
    const normalizedBaseline = baselineGitleaksReleaseAttestation(source);
    assert.equal(baselineGitleaksReleaseAttestation(synchronizeGitleaksReleaseAttestation(normalizedBaseline)), normalizedBaseline, revision);
    const legacy = gitleaksReleaseAttestationFixture(t, source);
    const legacyBaseline = fs.readFileSync(path.join(legacy.root, gitleaksReleaseAttestationPath), 'utf8');
    write(legacy.root, gitleaksReleaseAttestationPath, synchronizeGitleaksReleaseAttestation(legacyBaseline));
    commit(legacy.root, `synchronize legacy attestation from ${revision}`);
    const legacyResult = runGuard(legacy);
    assert.equal(legacyResult.status, 0, `${revision}\n${output(legacyResult)}`);
  }
  // The two later phases start from immutable accepted blobs whatever the repository test holds.
  const current = currentGitleaksReleaseAttestationFixture(t);
  write(current.root, gitleaksReleaseAttestationPath, synchronizeCurrentGitleaksReleaseAttestation(fs.readFileSync(path.join(current.root, gitleaksReleaseAttestationPath), 'utf8')));
  commit(current.root, 'synchronize current exact fingerprint attestation');
  assert.equal(runTrustedCurrentGitleaksGuard(current).status, 0);
  const session = sessionMintingGitleaksReleaseAttestationFixture(t);
  write(session.root, gitleaksReleaseAttestationPath, stepC);
  commit(session.root, 'synchronize session-minting fingerprint attestation');
  assert.equal(runTrustedCurrentGitleaksGuard(session).status, 0);
});

test('earlier Gitleaks attestation phase cannot apply the session-minting synchronization', (t) => {
  const context = currentGitleaksReleaseAttestationFixture(t);
  const baseline = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
  write(context.root, gitleaksReleaseAttestationPath, synchronizeSessionMintingGitleaksReleaseAttestation(synchronizeCurrentGitleaksReleaseAttestation(baseline)));
  commit(context.root, 'attempt both synchronizations from the earlier baseline');
  const result = runTrustedCurrentGitleaksGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /Gitleaks release attestation head must be the exact two-fingerprint regular-file repair/u);
});

test('kind MinIO image-source scope accepts exactly three paths and rejects ci.yml', (t) => {
  const allowed = kindMinioImageSourceFixture(t);
  write(allowed.root, kindMinioImageSourcePaths[0], 'pinned server image\n');
  write(allowed.root, kindMinioImageSourcePaths[1], 'pinned TLS client image\n');
  write(allowed.root, kindMinioImageSourcePaths[2], '#!/usr/bin/env bash\n# pinned initializer client image\n', 0o755);
  commit(allowed.root, 'change all three accepted MinIO image references');
  const acceptedResult = runGuard(allowed);
  assert.equal(acceptedResult.status, 0, output(acceptedResult));

  const rejected = kindMinioImageSourceFixture(t);
  write(rejected.root, '.github/workflows/ci.yml', 'name: unauthorized widening\n');
  commit(rejected.root, 'attempt unrelated CI workflow change');
  const result = runGuard(rejected);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /\.github\/workflows\/ci\.yml/u);
  assert.match(output(result), /Files outside current autopilot scope/u);
});

test('Qwen failed-evidence scope accepts exactly the two previously approved diagnostic paths', (t) => {
  const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  assert.deepEqual(state.approvedConcurrentScopes[qwenFailedEvidenceBranch], qwenFailedEvidencePaths);
  const context = qwenFailedEvidenceFixture(t);
  for (const file of qwenFailedEvidencePaths) write(context.root, file, 'bounded diagnostic change\n');
  commit(context.root, 'diagnostics and regression only');
  const result = runGuard(context);
  assert.equal(result.status, 0, output(result));
});

test('Qwen failed-evidence scope rejects head-state expansion', (t) => {
  const context = qwenFailedEvidenceFixture(t);
  const stateFile = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = JSON.parse(fs.readFileSync(path.join(context.root, stateFile), 'utf8'));
  state.approvedConcurrentScopes[qwenFailedEvidenceBranch].push('apps/api/src/app.module.ts');
  write(context.root, stateFile, JSON.stringify(state));
  write(context.root, 'apps/api/src/app.module.ts', 'self-authorized application change\n');
  commit(context.root, 'attempt head-state scope expansion');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /Mutable scope authority changed/u);
});

for (const forbidden of ['README.md', '.github/workflows/ci.yml']) {
  test(`Qwen failed-evidence scope rejects global/infra fallback: ${forbidden}`, (t) => {
    const context = qwenFailedEvidenceFixture(t);
    write(context.root, forbidden, 'unapproved change\n');
    commit(context.root, 'attempt global or generic infrastructure scope');
    const result = runGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /Files outside current autopilot scope/u);
  });
}

function finalPublicManifestFallbackFixture(t) {
  const implementationBranch = finalPublicBranches[1];
  const manifestPath = 'docs/platform-v7/autopilot/scopes/farmer-public-market-teaser-20260913.json';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-final-public-fallback-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  write(root, 'scripts/p7-autopilot-guard.sh', fs.readFileSync(sourceGuard, 'utf8'), 0o755);
  write(root, 'scripts/p7-source-controlled-scope.mjs', fs.readFileSync(sourceResolver, 'utf8'), 0o755);
  write(root, '.github/workflows/platform-v7-autopilot-guard.yml', 'name: fixture\n');
  write(root, 'docs/platform-v7/autopilot/autopilot-state.json', '{"allowedCurrentScope":["README.md"],"approvedConcurrentScopes":{}}\n');
  write(root, manifestPath, `${JSON.stringify({ schemaVersion: 'platform-v7.concurrent-scope.v1', branch: implementationBranch, status: 'active', allowedPaths: ['allowed.txt'] }, null, 2)}\n`);
  write(root, 'README.md', 'baseline\n');
  write(root, 'allowed.txt', 'baseline\n');
  git(root, ['init', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'Final Public Guard Test']);
  git(root, ['config', 'user.email', 'final-public-guard@example.invalid']);
  commit(root, 'trusted base manifest');
  const baseline = git(root, ['rev-parse', 'HEAD']);
  git(root, ['switch', '-c', implementationBranch]);
  return { root, baseline, implementationBranch, manifestPath };
}

test('Final Public immutable routing accepts only the trusted-base manifest before state admission lands', (t) => {
  const allowed = finalPublicManifestFallbackFixture(t);
  write(allowed.root, 'allowed.txt', 'accepted through base manifest\n');
  commit(allowed.root, 'accepted bounded change');
  const accepted = runGuard(allowed);
  assert.equal(accepted.status, 0, output(accepted));

  const rejected = finalPublicManifestFallbackFixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(rejected.root, rejected.manifestPath), 'utf8'));
  manifest.allowedPaths = [rejected.manifestPath, 'README.md'];
  write(rejected.root, rejected.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  write(rejected.root, 'README.md', 'self-authorized through head manifest\n');
  commit(rejected.root, 'attempt head manifest widening');
  const denied = runGuard(rejected);
  assert.notEqual(denied.status, 0, output(denied));
  assert.match(output(denied), /Mutable scope authority changed|Files outside current autopilot scope/u);
});
for (const implementationBranch of implementationBranches) {
test(`${implementationBranch}: accepts only a path approved by the immutable base state`, (t) => {
  const context = fixture(t, implementationBranch);
  write(context.root, 'allowed.txt', 'authorized change\n');
  commit(context.root, 'authorized change');
  const result = runGuard(context);
  assert.equal(result.status, 0, output(result));
  assert.match(result.stdout, /Scope guard passed\./u);
});

test(`${implementationBranch}: does not inherit allowedCurrentScope`, (t) => {
  const context = fixture(t, implementationBranch);
  write(context.root, 'README.md', 'not branch-approved\n');
  commit(context.root, 'try global current scope');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /Files outside current autopilot scope/u);
});

test(`${implementationBranch}: does not inherit a legacy diff-triggered scope expansion`, (t) => {
  const context = fixture(t, implementationBranch);
  write(context.root, 'apps/web/components/platform-v7/staff/OwnerAccessCenter.tsx', 'legacy trigger must remain unapproved\n');
  commit(context.root, 'try legacy triggered scope');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /OwnerAccessCenter\.tsx/u);
});

test(`${implementationBranch}: validates both sides of a rename into approved scope`, (t) => {
  const context = fixture(t, implementationBranch);
  fs.mkdirSync(path.join(context.root, 'approved'), { recursive: true });
  git(context.root, ['mv', 'apps/api/src/app.module.ts', 'approved/app.module.ts']);
  commit(context.root, 'try rename into approved scope');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /apps\/api\/src\/app\.module\.ts/u);
});

test(`${implementationBranch}: does not treat a plain file as a subtree prefix`, (t) => {
  const context = fixture(t, implementationBranch);
  fs.rmSync(path.join(context.root, 'allowed.txt'));
  write(context.root, 'allowed.txt/evil.sh', 'unapproved descendant\n');
  commit(context.root, 'try plain-entry subtree expansion');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /allowed\.txt\/evil\.sh/u);
});

test(`${implementationBranch}: rejects branch-local state expansion`, (t) => {
  const context = fixture(t, implementationBranch);
  const stateFile = path.join(context.root, 'docs/platform-v7/autopilot/autopilot-state.json');
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  state.approvedConcurrentScopes[implementationBranch].push('README.md');
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  write(context.root, 'README.md', 'self-authorized attempt\n');
  commit(context.root, 'try state expansion');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), implementationBranch.startsWith('governance/') ? /Files outside current autopilot scope/u : /Mutable scope authority changed/u);
});

test(`${implementationBranch}: rejects a branch-local scope manifest`, (t) => {
  const context = fixture(t, implementationBranch);
  write(context.root, 'docs/platform-v7/autopilot/scopes/attack.json', `${JSON.stringify({ schemaVersion: 'platform-v7.concurrent-scope.v1', branch: implementationBranch, status: 'active', allowedPaths: ['README.md'] }, null, 2)}\n`);
  write(context.root, 'README.md', 'manifest-authorized attempt\n');
  commit(context.root, 'try manifest expansion');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), implementationBranch.startsWith('governance/') ? /Files outside current autopilot scope/u : /Mutable scope authority changed/u);
});

test(`${implementationBranch}: rejects changes to the guard authority`, (t) => {
  const context = fixture(t, implementationBranch);
  fs.appendFileSync(path.join(context.root, 'scripts/p7-autopilot-guard.sh'), '\n# branch-local mutation\n');
  commit(context.root, 'try guard mutation');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), implementationBranch.startsWith('governance/') ? /Files outside current autopilot scope/u : /Mutable scope authority changed/u);
});

test(`${implementationBranch}: fails closed without immutable base authority`, (t) => {
  const context = fixture(t, implementationBranch);
  const stateFile = path.join(context.root, 'docs/platform-v7/autopilot/autopilot-state.json');
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  delete state.approvedConcurrentScopes[implementationBranch];
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  commit(context.root, 'base without implementation authority');
  const unauthorizedBase = git(context.root, ['rev-parse', 'HEAD']);
  write(context.root, 'allowed.txt', 'attempt without base authority\n');
  commit(context.root, 'attempt without authority');
  const result = runGuard({ ...context, baseline: unauthorizedBase });
  assert.notEqual(result.status, 0, output(result));
  if (['agent/platform-v7-product-copy', 'ops/production-full-stack-release-v1'].includes(implementationBranch)) {
    assert.match(output(result), /Files outside current autopilot scope/u);
  } else if (finalPublicBranches.includes(implementationBranch)) {
    assert.match(output(result), /cannot load accepted Final Public manifest/u);
  } else {
    assert.match(output(result), /no immutable approved scope/u);
  }
});
}

for (const [branch, allowed, rejected] of [
  ['agent/platform-v7-product-copy', 'apps/web/tests/unit/platformV7HomepageProductCopy.test.ts', 'apps/web/tsconfig.json'],
  ['ops/production-full-stack-release-v1', 'scripts/production-full-stack-live-acceptance.sh', 'scripts/production-full-stack-exact-sha.sh'],
]) {
  test(`${branch}: transitional fallback is exact and rejects broader legacy-manifest paths`, (t) => {
    const context = fixture(t, branch);
    const stateFile = path.join(context.root, 'docs/platform-v7/autopilot/autopilot-state.json');
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    delete state.approvedConcurrentScopes[branch];
    fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
    commit(context.root, 'base without state admission');
    const baseline = git(context.root, ['rev-parse', 'HEAD']);

    write(context.root, allowed, 'accepted narrow fallback\n');
    commit(context.root, 'change narrow fallback path');
    assert.equal(runGuard({ ...context, baseline }).status, 0);

    write(context.root, rejected, 'rejected legacy-manifest path\n');
    commit(context.root, 'attempt broader legacy path');
    const rejectedResult = runGuard({ ...context, baseline });
    assert.notEqual(rejectedResult.status, 0, output(rejectedResult));
    assert.match(output(rejectedResult), /Files outside current autopilot scope/u);
  });
}

function finalPublicGovernanceFixture(t, admitted = true) {
  const context = fixture(t, finalPublicGovernanceBranch);
  for (const file of finalPublicGovernancePaths.slice(1, 3)) write(context.root, file, '{}\n');
  write(context.root, 'scripts/p7-autopilot-guard.test.mjs', '// baseline regression\n');
  const state = JSON.parse(fs.readFileSync(path.join(context.root, finalPublicGovernancePaths[0]), 'utf8'));
  if (admitted) state.approvedConcurrentScopes[finalPublicGovernanceBranch] = finalPublicGovernancePaths;
  else delete state.approvedConcurrentScopes[finalPublicGovernanceBranch];
  write(context.root, finalPublicGovernancePaths[0], JSON.stringify(state));
  commit(context.root, 'accepted public governance authority');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  return context;
}

function runTrustedPublicGovernance(context) {
  return spawnSync('bash', [sourceGuard], {
    cwd: context.root,
    env: { ...process.env, BASE_REF: context.baseline, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: finalPublicGovernanceBranch },
    encoding: 'utf8',
  });
}

test('Final Public governance admission and trusted routing ship atomically', () => {
  const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  assert.deepEqual(state.approvedConcurrentScopes[finalPublicGovernanceBranch], finalPublicGovernancePaths);
});

test('Final Public governance accepts the two implementation entries and admitted manifest edits', (t) => {
  const context = finalPublicGovernanceFixture(t);
  const state = JSON.parse(fs.readFileSync(path.join(context.root, finalPublicGovernancePaths[0]), 'utf8'));
  state.approvedConcurrentScopes['agent/platform-v7-strategic-rebuild-v3'] = ['apps/web/components/platform-v7/PlatformV7StrategicHome.tsx'];
  state.approvedConcurrentScopes['fix/public-registration-final-copy-4916'] = ['apps/web/app/platform-v7/register/page.tsx'];
  write(context.root, finalPublicGovernancePaths[0], JSON.stringify(state));
  write(context.root, finalPublicGovernancePaths[1], '{"status":"active"}\n');
  write(context.root, finalPublicGovernancePaths[2], '{"status":"active"}\n');
  commit(context.root, 'bounded public admission');
  const result = runTrustedPublicGovernance(context);
  assert.equal(result.status, 0, output(result));
});

for (const mutation of ['own scope', 'global scope', 'other branch', 'IR20 state', 'unapproved file', 'delete authority', 'rename authority', 'symlink authority', 'poison head guard']) {
  test(`Final Public governance rejects ${mutation}`, (t) => {
    const context = finalPublicGovernanceFixture(t);
    const file = finalPublicGovernancePaths[0];
    const state = JSON.parse(fs.readFileSync(path.join(context.root, file), 'utf8'));
    if (mutation === 'own scope') state.approvedConcurrentScopes[finalPublicGovernanceBranch].push('UNAPPROVED.txt');
    if (mutation === 'global scope') state.allowedCurrentScope.push('UNAPPROVED.txt');
    if (mutation === 'other branch') state.approvedConcurrentScopes['unrelated/branch'] = ['UNAPPROVED.txt'];
    if (mutation === 'IR20 state') state.status = 'closed';
    if (['own scope', 'global scope', 'other branch', 'IR20 state'].includes(mutation)) write(context.root, file, JSON.stringify(state));
    if (mutation === 'unapproved file' || mutation === 'poison head guard') write(context.root, 'UNAPPROVED.txt', 'not admitted\n');
    if (mutation === 'poison head guard') write(context.root, 'scripts/p7-autopilot-guard.sh', '#!/bin/sh\nexit 0\n', 0o755);
    if (mutation === 'delete authority') fs.unlinkSync(path.join(context.root, finalPublicGovernancePaths[1]));
    if (mutation === 'rename authority') git(context.root, ['mv', finalPublicGovernancePaths[1], 'renamed.json']);
    if (mutation === 'symlink authority') {
      fs.unlinkSync(path.join(context.root, finalPublicGovernancePaths[1]));
      fs.symlinkSync('autopilot-state.json', path.join(context.root, finalPublicGovernancePaths[1]));
    }
    commit(context.root, `attempt ${mutation}`);
    const result = runTrustedPublicGovernance(context);
    assert.notEqual(result.status, 0, output(result));
  });
}

test('Final Public governance fails without prior base admission', (t) => {
  const context = finalPublicGovernanceFixture(t, false);
  write(context.root, finalPublicGovernancePaths[1], '{"status":"active"}\n');
  commit(context.root, 'attempt unadmitted manifest change');
  const result = runTrustedPublicGovernance(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /no immutable approved scope/u);
});

test('public-home governance branch accepts only the two manifest files', (t) => {
  const context = publicHomeGovernanceFixture(t);
  write(context.root, publicHomeGovernanceManifest, '{}\n');
  write(context.root, publicHomeImplementationManifest, '{}\n');
  commit(context.root, 'add independently reviewed public-home scope manifests');
  const result = runGuard(context);
  assert.equal(result.status, 0, output(result));
  assert.match(result.stdout, /Scope guard passed\./u);
});

test('public-home governance branch rejects any third path', (t) => {
  const context = publicHomeGovernanceFixture(t);
  write(context.root, publicHomeGovernanceManifest, '{}\n');
  write(context.root, publicHomeImplementationManifest, '{}\n');
  write(context.root, 'README.md', 'scope widening\n');
  commit(context.root, 'attempt governance widening');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /README\.md/u);
});

test('public-home implementation accepts a path from the accepted base manifest', (t) => {
  const context = publicHomeImplementationFixture(t);
  write(context.root, 'allowed.txt', 'accepted implementation change\n');
  commit(context.root, 'allowed public-home change');
  const result = runGuard(context);
  assert.equal(result.status, 0, output(result));
});

test('public-home implementation cannot widen its own manifest to admit API code', (t) => {
  const context = publicHomeImplementationFixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(context.root, publicHomeImplementationManifest), 'utf8'));
  manifest.allowedPaths.push('apps/api/src/app.module.ts');
  write(context.root, publicHomeImplementationManifest, `${JSON.stringify(manifest, null, 2)}\n`);
  write(context.root, 'apps/api/src/app.module.ts', 'self-authorized API mutation\n');
  commit(context.root, 'attempt head-controlled manifest widening');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /Mutable scope authority changed|Files outside current autopilot scope/u);
});

test('public-home implementation cannot use the legacy automerge workflow exemption', (t) => {
  const context = publicHomeImplementationFixture(t);
  write(context.root, '.github/workflows/automerge.yml', 'name: weakened gate\n');
  commit(context.root, 'attempt automerge bypass');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /automerge\.yml/u);
});

test('public-home implementation fails closed when the accepted base manifest is absent', (t) => {
  const context = publicHomeImplementationFixture(t, { withManifest: false });
  write(context.root, 'allowed.txt', 'attempt without manifest\n');
  commit(context.root, 'attempt without accepted manifest');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /cannot load accepted public-home manifest/u);
});

test('poison-isolation implementation accepts a script-only diff from the accepted base manifest', (t) => {
  const context = poisonIsolationFixture(t);
  write(context.root, poisonIsolationScript, 'accepted runtime harness change\n');
  commit(context.root, 'change accepted poison-isolation harness');
  const result = runGuard(context);
  assert.equal(result.status, 0, output(result));
  assert.match(result.stdout, /Scope guard passed\./u);
});

test('poison-isolation implementation fails closed when the accepted base manifest is missing', (t) => {
  const context = poisonIsolationFixture(t, { manifest: null });
  write(context.root, poisonIsolationScript, 'attempt without manifest\n');
  commit(context.root, 'attempt without accepted poison-isolation manifest');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /cannot load accepted poison-isolation manifest/u);
});

test('poison-isolation implementation fails closed when the accepted base manifest is malformed', (t) => {
  const context = poisonIsolationFixture(t, { manifest: 'malformed' });
  write(context.root, poisonIsolationScript, 'attempt with malformed manifest\n');
  commit(context.root, 'attempt with malformed poison-isolation manifest');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /cannot load accepted poison-isolation manifest/u);
});

test('poison-isolation implementation rejects an accepted base manifest with the wrong schema', (t) => {
  const context = poisonIsolationFixture(t, { manifest: { schemaVersion: 'platform-v7.concurrent-scope.v0' } });
  write(context.root, poisonIsolationScript, 'attempt with wrong schema\n');
  commit(context.root, 'attempt wrong poison-isolation schema');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /accepted poison-isolation manifest identity is invalid/u);
});

test('poison-isolation implementation rejects an inactive accepted base manifest', (t) => {
  const context = poisonIsolationFixture(t, { manifest: { status: 'inactive' } });
  write(context.root, poisonIsolationScript, 'attempt with inactive manifest\n');
  commit(context.root, 'attempt inactive poison-isolation scope');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /accepted poison-isolation manifest identity is invalid/u);
});

test('poison-isolation implementation rejects an accepted base manifest for another branch', (t) => {
  const context = poisonIsolationFixture(t, { manifest: { branch: 'fix/not-the-poison-isolation-branch' } });
  write(context.root, poisonIsolationScript, 'attempt with wrong branch\n');
  commit(context.root, 'attempt wrong poison-isolation branch');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /accepted poison-isolation manifest identity is invalid/u);
});

test('poison-isolation implementation cannot widen its own manifest', (t) => {
  const context = poisonIsolationFixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(context.root, poisonIsolationManifest), 'utf8'));
  manifest.allowedPaths.push('README.md');
  write(context.root, poisonIsolationManifest, `${JSON.stringify(manifest, null, 2)}\n`);
  write(context.root, 'README.md', 'self-authorized widening attempt\n');
  commit(context.root, 'attempt poison-isolation manifest widening');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /Mutable scope authority changed/u);
  assert.match(output(result), /production-like-outbox-poison-isolation-3793\.json/u);
});

test('records immutable prior authority for the EGRUL governance manifest only', () => {
  const state = JSON.parse(fs.readFileSync(path.resolve('docs/platform-v7/autopilot/autopilot-state.json'), 'utf8'));
  assert.deepEqual(state.approvedConcurrentScopes['governance/role-eligibility-fns-egrul-file-import-5016'], ['docs/platform-v7/autopilot/scopes/role-eligibility-fns-egrul-file-import-5016.json']);
});

test('runs immutable authority checks from a read-only trusted-base workflow', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  for (const marker of [
    'pull_request_target:',
    'group: platform-v7-autopilot-guard-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref }}',
    'name: PC-CROP implementation immutable scope · trusted base',
    'name: FNS EGRUL immutable scope · trusted base',
    "github.event.pull_request.head.ref == 'fix/p0-registration-authority-rollover-4637'",
    "github.event.pull_request.head.ref == 'fix/p0-owner-control-plane-audit-lock-4698'",
    "github.event.pull_request.head.ref == 'feat/pc-crop-auction-inventory-authority-4997'",
    "github.event.pull_request.head.ref == 'docs/pc-crop-post-registration-progress-4997'",
    "github.event.pull_request.head.ref == 'governance/role-eligibility-fns-egrul-file-import-5016'",
    "github.event.pull_request.head.ref == 'feat/role-eligibility-fns-egrul-file-import-5016'",
    `github.event.pull_request.head.ref == '${publicHomeGovernanceBranch}'`,
    `github.event.pull_request.head.ref == '${publicHomeImplementationBranch}'`,
    "github.event.pull_request.head.ref == 'governance/production-like-outbox-poison-isolation-scope-3793'",
    "github.event.pull_request.head.ref == 'fix/production-like-outbox-poison-isolation-3793'",
    `github.event.pull_request.head.ref == '${kindMinioImageSourceBranch}'`,
    `github.event.pull_request.head.ref == '${gitleaksReleaseAttestationBranch}'`,
    "github.event.pull_request.head.ref == 'fix/owner-handoff-product-host-20260908'",
    "const manifestPath = 'docs/platform-v7/autopilot/scopes/role-eligibility-fns-egrul-file-import-5016.json';",
    "'apps/api/src/fns-egrul-import.ts'",
    "'apps/api/src/modules/role-eligibility/fns-egrul-file-import.service.ts'",
    "'apps/api/src/modules/role-eligibility/role-eligibility-registry-sync.service.ts'",
    "'apps/api/src/modules/role-eligibility/role-eligibility-registry-sync.spec.ts'",
    "'docs/security/cryptographic-inventory.json'",
    'run: node docs/platform-v7/crop-platform/post-registration/verify-w0.mjs',
    'HEAD_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name }}',
    'if [ "$HEAD_REPOSITORY" != "$GITHUB_REPOSITORY" ]; then',
    'PC-CROP immutable-scope authority rejects same-name branches from forks.',
    'checks: write\n      contents: read',
    'ref: ${{ github.event.pull_request.base.sha }}',
    'git fetch --no-tags origin "$HEAD_SHA"',
    'IMMUTABLE_SCOPE_BRANCH: ${{ github.event.pull_request.head.ref }}',
    'BASE_REF="$BASE_SHA" HEAD_REF="$HEAD_SHA" GITHUB_HEAD_REF="$IMMUTABLE_SCOPE_BRANCH"',
    'Emit required guard context from trusted base on the PR head',
    '"repos/$GITHUB_REPOSITORY/check-runs"',
    "-f name='guard'",
    '-f head_sha="$HEAD_SHA"',
    "-f status='completed'",
    "'PC-CROP immutable scope · PR-head defense' || 'guard' }}",
    'needs: [standard_validation, public-home-contract]',
    "if: always() && github.event_name != 'pull_request_target'",
    'git show "$BASE_SHA:scripts/p7-autopilot-guard.sh" > "$TRUSTED_GUARD"',
    'standard_validation:',
    'STANDARD_VALIDATION_RESULT: ${{ needs.standard_validation.result }}',
    "- '.github/workflows/production-full-stack-exact-sha.yml'",
    "- 'docs/ops/production-p0-all-role-registration.md'",
  ]) assert.ok(workflow.includes(marker), `missing trusted-base workflow marker: ${marker}`);
});

test('final public unit contracts run on unprivileged exact head and fail the guard closed', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const job = workflow.split('\n  public-home-contract:\n')[1].split('\n  trusted-kind-minio-governance-bootstrap:')[0];
  assert.match(job, /github\.event_name == 'pull_request'/u);
  assert.match(job, /head\.ref == 'agent\/platform-v7-strategic-rebuild-v3'/u);
  assert.match(job, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/u);
  assert.match(job, /permissions:\n      contents: read/u);
  assert.match(job, /persist-credentials: false/u);
  assert.match(job, /pnpm install --frozen-lockfile/u);
  assert.doesNotMatch(job, /pull_request_target|continue-on-error|secrets\.|(?:checks|contents|pull-requests): write/u);
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs/platform-v7/autopilot/scopes/platform-v7-strategic-rebuild-v3.json'), 'utf8'));
  for (const file of manifest.allowedPaths.filter(file => file.startsWith('apps/web/tests/unit/'))) {
    assert.ok(job.includes(file.replace('apps/web/', '')), `Scoped unit suite is not executed: ${file}`);
  }
  const guard = workflow.split('\n  guard:\n')[1].split('\n  standard_validation:\n')[0];
  assert.match(guard, /needs: \[standard_validation, public-home-contract\]/u);
  const step = guard.split('      - name: Require final public unit contracts for homepage implementation\n')[1]
    .split('      - name: Validate immutable scope')[0];
  assert.match(step, /github\.event_name == 'pull_request' && github\.head_ref == 'agent\/platform-v7-strategic-rebuild-v3'/u);
  assert.ok(step.includes('PUBLIC_HOME_RESULT: ${{ needs.public-home-contract.result }}'));
  const shell = step.split('        run: |\n')[1].split('\n').map(line => line.replace(/^          /u, '')).join('\n');
  for (const state of ['success', 'failure', 'cancelled', 'skipped', '']) {
    const result = spawnSync('bash', ['-c', shell], { env: { ...process.env, PUBLIC_HOME_RESULT: state }, encoding: 'utf8' });
    assert.equal(result.status, state === 'success' ? 0 : 1, state);
  }
});

test('public-home workflow routing covers every non-glob presentation path that otherwise lacks a broad trigger', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  for (const path of [
    '.github/workflows/public-entry-clarity.yml',
    'apps/web/i18n/platform-v7-hero-message.ts',
    'apps/web/i18n/platform-v7-home-story-product.ts',
    'apps/web/i18n/platform-v7-home-v3-product.ts',
    'apps/web/i18n/platform-v7-organization-connect-product.ts',
  ]) assert.ok(workflow.includes(`- '${path}'`), `missing public-home head-validation trigger: ${path}`);
});

test('every trusted-base Final Public manifest path triggers unprivileged candidate-head validation', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  for (const manifestPath of [
    'docs/platform-v7/autopilot/scopes/platform-v7-strategic-rebuild-v3.json',
    'docs/platform-v7/autopilot/scopes/farmer-public-market-teaser-20260913.json',
    'docs/platform-v7/autopilot/scopes/public-registration-final-copy-4916.json',
    'docs/platform-v7/autopilot/scopes/public-deal-journey-10of10-20260808.json',
  ]) {
    const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
    for (const allowedPath of manifest.allowedPaths) {
      assert.ok(workflow.includes(`- '${allowedPath}'`), `missing pull_request path trigger: ${allowedPath}`);
    }
  }
});

for (const branch of implementationBranches.filter((name) => name.startsWith('governance/'))) {
  test(`${branch}: permits governance authorities only when the base lists them explicitly`, (t) => {
    const context = fixture(t, branch);
    const stateFile = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, stateFile), 'utf8'));
    state.approvedConcurrentScopes[branch] = [stateFile, 'scripts/p7-autopilot-guard.sh'];
    write(context.root, stateFile, JSON.stringify(state));
    commit(context.root, 'record prior two-file governance approval');
    const baseline = git(context.root, ['rev-parse', 'HEAD']);
    state.approvedConcurrentScopes['future/branch'] = ['future.txt'];
    write(context.root, stateFile, JSON.stringify(state));
    fs.appendFileSync(path.join(context.root, 'scripts/p7-autopilot-guard.sh'), '\n# approved governance change\n');
    commit(context.root, 'apply approved governance changes');
    assert.equal(runGuard({ ...context, baseline }).status, 0);
    write(context.root, 'README.md', 'unapproved despite a governance branch');
    commit(context.root, 'attempt to exceed the prior approval');
    assert.notEqual(runGuard({ ...context, baseline }).status, 0);
  });
}

test('governance branches retain unprivileged head regression validation', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  for (const [start, end] of [
    ['      - name: Require standard validations in the required guard context', '      - name: Validate immutable scope with trusted base guard on PR head'],
    ['  standard_validation:', '    runs-on: ubuntu-latest'],
  ]) {
    const section = workflow.slice(workflow.indexOf(start), workflow.indexOf(end, workflow.indexOf(start) + start.length));
    assert.doesNotMatch(section, /github\.head_ref != 'governance\//u);
  }
  assert.ok(workflow.includes('run: node --test scripts/p7-autopilot-guard.test.mjs'));
});

for (const branch of ['feat/pc-crop-auction-inventory-authority-4997', 'ops/pc-crop-w1-production-acceptance-4997', qwenFailedEvidenceBranch, kindMinioImageSourceBranch, gitleaksReleaseAttestationBranch, ...finalPublicBranches, finalPublicGovernanceBranch, industrialGovernanceBranch, industrialDiagnosticBranch]) {
test(`${branch}: trusted scope routing retains substantive head validation`, () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const section = (start, end) => {
    const first = workflow.indexOf(start);
    const last = workflow.indexOf(end, first + start.length);
    assert.ok(first >= 0 && last > first, `missing workflow section: ${start}`);
    return workflow.slice(first, last);
  };
  const trusted = section('  trusted-immutable-scope:', '  guard:');
  assert.ok(trusted.includes(`github.event.pull_request.head.ref == '${branch}'`));
  assert.ok(trusted.includes(`|${branch}|`) || trusted.includes(`|${branch})`));
  assert.ok(trusted.includes('ref: ${{ github.event.pull_request.base.sha }}'));
  assert.ok(trusted.includes('test "$(git rev-parse HEAD)" = "$BASE_SHA"'));
  assert.ok(trusted.includes('bash scripts/p7-autopilot-guard.sh'));
  assert.doesNotMatch(trusted, /git\s+(?:checkout|switch)\s+.*HEAD_SHA|ref:\s*\$\{\{\s*github\.event\.pull_request\.head/u);
  const guard = section('  guard:', '      - name: Require standard validations in the required guard context');
  assert.ok(guard.includes(`github.head_ref == '${branch}'`));
  assert.ok(guard.includes("'PC-CROP immutable scope · PR-head defense' || 'guard'"));
  assert.ok(guard.includes('permissions:\n      contents: read'));
  const defense = section('      - name: Validate immutable scope with trusted base guard on PR head', '      - name: Validate post-registration DoD register');
  assert.ok(defense.includes(`github.head_ref == '${branch}'`));
  assert.ok(defense.includes(`|${branch}|`) || defense.includes(`|${branch})`));
  assert.ok(defense.includes('git show "$BASE_SHA:scripts/p7-autopilot-guard.sh" > "$TRUSTED_GUARD"'));
  const standardScope = section('      - name: Validate standard branch scope on PR head', '  standard_validation:');
  assert.ok(standardScope.includes(`github.head_ref != '${branch}'`));
  for (const [start, end] of [
    ['      - name: Require standard validations in the required guard context', '      - name: Validate immutable scope with trusted base guard on PR head'],
    ['  standard_validation:', '    runs-on: ubuntu-latest'],
  ]) assert.ok(!section(start, end).includes(`github.head_ref != '${branch}'`), `${branch} must retain substantive head validations`);
});
}

test('Auction head validation triggers for every immutable state-approved path', () => {
  const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  const approved = state.approvedConcurrentScopes['feat/pc-crop-auction-inventory-authority-4997'];
  assert.ok(Array.isArray(approved), 'Auction scope must be recorded in the state authority');
  assert.equal(approved.length, 19);
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const first = workflow.indexOf('\n  pull_request:\n');
  const last = workflow.indexOf('\nconcurrency:', first);
  assert.ok(first >= 0 && last > first, 'unprivileged pull_request trigger must exist');
  const trigger = workflow.slice(first, last);
  const paths = [...trigger.matchAll(/^      - '([^']+)'$/gmu)].map((match) => match[1]);
  for (const file of approved) assert.equal(paths.filter((entry) => entry === file).length, 1, `Each approved Auction path must trigger head validation exactly once: ${file}`);
});

test('Qwen failed-evidence candidate regressions run unprivileged and block the required guard on failure', (t) => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const standard = workflow.split('\n  standard_validation:\n')[1];
  const step = standard.match(/      - name: Validate Local Qwen failed-review evidence regression\n([\s\S]*?)(?=\n      - (?:name:|uses:)|$)/u)?.[1];
  assert.ok(step, 'The candidate review-gate regression file must run in standard_validation');
  assert.ok(step.includes(`if: github.event_name == 'pull_request' && github.head_ref == '${qwenFailedEvidenceBranch}'`));
  const command = step.match(/^        run: (.+)$/mu)?.[1];
  assert.equal(command, 'node --test docs/platform-v7/autopilot/verify-pr-review-gate.test.mjs');
  assert.match(standard.split('    steps:')[0], /permissions:\n      contents: read/u);
  assert.match(standard.split('      - name:')[0], /persist-credentials: false/u);
  assert.doesNotMatch(standard, /continue-on-error:|secrets\.|(?:checks|contents|pull-requests): write/u);
  const guard = workflow.split('\n  guard:\n')[1].split('\n  standard_validation:\n')[0];
  assert.match(guard, /needs: \[standard_validation, public-home-contract\]/u);
  const required = guard.split('      - name: Require standard validations in the required guard context\n')[1]
    .split('      - name: Require final public unit contracts for homepage implementation')[0];
  assert.ok(required.includes('STANDARD_VALIDATION_RESULT: ${{ needs.standard_validation.result }}'));
  const enforce = required.split('        run: |\n')[1].split('\n').map(line => line.replace(/^          /u, '')).join('\n');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-qwen-candidate-validation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  const candidateEnv = { ...process.env };
  delete candidateEnv.NODE_TEST_CONTEXT;
  for (const fails of [false, true]) {
    write(root, 'docs/platform-v7/autopilot/verify-pr-review-gate.test.mjs', fails
      ? "throw new Error('candidate regression sentinel');\n" : 'export {};\n');
    const candidate = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', command], { cwd: root, env: candidateEnv, encoding: 'utf8' });
    assert.equal(candidate.status === 0, !fails, output(candidate));
    if (fails) assert.match(output(candidate), /candidate regression sentinel/u);
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', enforce], {
      cwd: root,
      env: { ...process.env, STANDARD_VALIDATION_RESULT: candidate.status === 0 ? 'success' : 'failure' },
      encoding: 'utf8',
    });
    assert.equal(result.status === 0, !fails, output(result));
  }
});

test('admission blockers survive actual dispatcher regeneration without duplication or maturity credit', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-admission-dispatcher-regression-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  state.current = 'R1 release prerequisite: atomic canonical readiness recovery #4829';
  state.currentStatus = 'blocked';
  state.coordinationAdmissions.fixtureOne = { dispatcherBlocker: 'Own fixture: source acceptance remains pending.' };
  state.coordinationAdmissions.fixtureDuplicate = { dispatcherBlocker: 'Own fixture: source acceptance remains pending.' };
  state.coordinationAdmissions.fixtureTwo = { dispatcherBlocker: 'Own fixture: actual runtime remains pending.' };
  const section = '\n## Own admission fixture\nSource and runtime acceptance remain separate.\n';
  write(root, 'docs/platform-v7/autopilot/autopilot-state.json', JSON.stringify(state));
  write(root, 'docs/platform-v7/execution-queue.md', fs.readFileSync('docs/platform-v7/execution-queue.md', 'utf8') + section);
  write(root, 'docs/platform-v7/autopilot/progress.json', JSON.stringify({ fullTzReadinessPercent: 5 }));
  for (const file of ['current-codex-task.md', 'current-review-task.md']) write(root, 'docs/platform-v7/autopilot/prompts/' + file, 'Before regeneration');
  for (let run = 0; run < 2; run += 1) {
    const result = spawnSync(process.execPath, [path.resolve('scripts/p7-autopilot-dispatcher.mjs')], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, output(result));
    const progress = JSON.parse(fs.readFileSync(path.join(root, 'docs/platform-v7/autopilot/progress.json'), 'utf8'));
    assert.equal(progress.fullTzReadinessPercent, 5);
    assert.equal(progress.currentStep, state.current);
    for (const blocker of ['Own fixture: source acceptance remains pending.', 'Own fixture: actual runtime remains pending.']) assert.equal(progress.blockedBy.filter(x => x === blocker).length, 1);
    for (const file of ['current-codex-task.md', 'current-review-task.md']) {
      const text = fs.readFileSync(path.join(root, 'docs/platform-v7/autopilot/prompts', file), 'utf8');
      assert.equal(text.split(section).length - 1, 1);
      assert.ok(text.includes('Own fixture: source acceptance remains pending.'));
      assert.ok(text.includes('Own fixture: actual runtime remains pending.'));
    }
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'docs/platform-v7/autopilot/autopilot-state.json'), 'utf8')), state);
});

test('invalid admission blocker fails the dispatcher before writing generated outputs', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-invalid-admission-blocker-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  const originalProgress = JSON.stringify({ fullTzReadinessPercent: 5, blockedBy: ['Existing truthful blocker'] });
  for (const value of [false, '', ' ', 'first\nsecond', 'x'.repeat(2001)]) {
    state.coordinationAdmissions.fixtureInvalid = { dispatcherBlocker: value };
    write(root, 'docs/platform-v7/autopilot/autopilot-state.json', JSON.stringify(state));
    write(root, 'docs/platform-v7/execution-queue.md', fs.readFileSync('docs/platform-v7/execution-queue.md', 'utf8'));
    write(root, 'docs/platform-v7/autopilot/progress.json', originalProgress);
    for (const file of ['current-codex-task.md', 'current-review-task.md']) write(root, 'docs/platform-v7/autopilot/prompts/' + file, 'Original prompt');
    const result = spawnSync(process.execPath, [path.resolve('scripts/p7-autopilot-dispatcher.mjs')], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid dispatcher admission blocker: fixtureInvalid/u);
    assert.equal(fs.readFileSync(path.join(root, 'docs/platform-v7/autopilot/progress.json'), 'utf8'), originalProgress);
    for (const file of ['current-codex-task.md', 'current-review-task.md']) assert.equal(fs.readFileSync(path.join(root, 'docs/platform-v7/autopilot/prompts', file), 'utf8'), 'Original prompt');
  }
});

function dispatcherSupersessionFixture(t, state) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-dispatcher-supersession-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'docs/platform-v7/autopilot/autopilot-state.json', JSON.stringify(state));
  write(root, 'docs/platform-v7/execution-queue.md', fs.readFileSync('docs/platform-v7/execution-queue.md', 'utf8'));
  const outputs = ['docs/platform-v7/autopilot/progress.json', 'docs/platform-v7/autopilot/prompts/current-codex-task.md', 'docs/platform-v7/autopilot/prompts/current-review-task.md'];
  for (const file of outputs) write(root, file, file.endsWith('.json') ? JSON.stringify({ fullTzReadinessPercent: 5, blockedBy: ['Original blocker'] }) : 'Original prompt');
  return { root, outputs, run: () => spawnSync(process.execPath, [path.resolve('scripts/p7-autopilot-dispatcher.mjs')], { cwd: root, encoding: 'utf8' }) };
}

test('dispatcher supersession: actual registered18 and anonymous17 retire old requirements transitively while frozen records and current stay unchanged', (t) => {
  const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  const registered = state.coordinationAdmissions['gekta-registration-refresh-ci-correction-20261009'];
  const anonymous = state.coordinationAdmissions['gekta-anonymous-document-evidence-20261009'];
  const originalRegistered = state.coordinationAdmissions['gekta-registration-document-evidence-20261008'];
  state.coordinationAdmissions = {
    'gekta-registration-document-evidence-20261008': originalRegistered,
    'gekta-registration-refresh-ci-correction-20261009': registered,
    'gekta-anonymous-document-evidence-20261009': anonymous,
  };
  const extra = ['apps/web/middleware.ts', 'apps/web/tests/unit/gektaAnonymousLegalRoutes.test.ts'];
  for (const path of extra) if (!state.approvedConcurrentScopes[registered.implementationBranch].includes(path)) state.approvedConcurrentScopes[registered.implementationBranch].push(path);
  state.coordinationAdmissions.fixtureRegistered18 = {
    ...structuredClone(registered), sourcePayloads: [...registered.sourcePayloads, ...extra.map(path => ({ path }))],
    supersedesUnacceptedPayloadOf: 'gekta-registration-refresh-ci-correction-20261009', dispatcherBlocker: 'Current registered eighteen-path source remains pending.',
  };
  state.coordinationAdmissions.fixtureAnonymous17 = {
    ...structuredClone(anonymous), sourcePayloads: anonymous.sourcePayloads.filter(pin => !extra.includes(pin.path)),
    supersedesUnacceptedPayloadOf: 'gekta-anonymous-document-evidence-20261009', dispatcherBlocker: 'Current anonymous seventeen-path source remains pending.',
  };
  const fixture = dispatcherSupersessionFixture(t, state);
  const retired = [registered.dispatcherBlocker, anonymous.dispatcherBlocker, state.coordinationAdmissions['gekta-registration-document-evidence-20261008'].dispatcherBlocker];
  const active = [state.coordinationAdmissions.fixtureRegistered18.dispatcherBlocker, state.coordinationAdmissions.fixtureAnonymous17.dispatcherBlocker];
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const result = fixture.run(); assert.equal(result.status, 0, output(result));
    const progress = JSON.parse(fs.readFileSync(path.join(fixture.root, fixture.outputs[0]), 'utf8'));
    for (const blocker of retired) assert.equal(progress.blockedBy.includes(blocker), false, blocker);
    for (const blocker of active) assert.equal(progress.blockedBy.filter(value => value === blocker).length, 1);
    assert.equal(progress.currentStep, state.current); assert.equal(progress.nextStep, state.current); assert.equal(progress.fullTzReadinessPercent, 5);
    for (const file of fixture.outputs.slice(1)) {
      const prompt = fs.readFileSync(path.join(fixture.root, file), 'utf8').split('## Active queue')[0].split('## Queue snapshot')[0];
      for (const blocker of retired) assert.equal(prompt.includes(`- BLOCKED: ${blocker}`), false);
      for (const blocker of active) assert.equal(prompt.split(`- BLOCKED: ${blocker}`).length - 1, 1);
    }
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fixture.root, 'docs/platform-v7/autopilot/autopilot-state.json'), 'utf8')), state);
});

const invalidDispatcherSupersessions = [
  ['missing target', s => { s.coordinationAdmissions.fixtureChild.supersedesUnacceptedPayloadOf = 'missing'; }],
  ['blank target', s => { s.coordinationAdmissions.fixtureChild.supersedesUnacceptedPayloadOf = ' '; }],
  ['multiline target', s => { s.coordinationAdmissions.fixtureChild.supersedesUnacceptedPayloadOf = 'fixtureParent\n'; }],
  ['non-string target', s => { s.coordinationAdmissions.fixtureChild.supersedesUnacceptedPayloadOf = []; }],
  ['self target', s => { s.coordinationAdmissions.fixtureChild.supersedesUnacceptedPayloadOf = 'fixtureChild'; }],
  ['cycle', s => { s.coordinationAdmissions.fixtureParent.supersedesUnacceptedPayloadOf = 'fixtureChild'; }],
  ['foreign owner', s => { s.coordinationAdmissions.fixtureChild.owner = 'OTHER_OWNER'; }],
  ['missing owner', s => { delete s.coordinationAdmissions.fixtureChild.owner; }],
  ['no replacement blocker', s => { delete s.coordinationAdmissions.fixtureChild.dispatcherBlocker; }],
  ['non-source target', s => { delete s.coordinationAdmissions.fixtureParent.sourcePayloads; }],
  ['unrelated source lineage', s => { s.coordinationAdmissions.fixtureChild.sourcePayloads = [{ path: 'fixture/unrelated' }]; }],
  ['duplicate source path', s => { s.coordinationAdmissions.fixtureChild.sourcePayloads.push({ path: 'fixture/a' }); }],
  ['missing approved source scope', s => { delete s.approvedConcurrentScopes['fixture/source']; }],
  ['scope without source path', s => { s.approvedConcurrentScopes['fixture/source'] = ['fixture/b']; }],
  ['ambiguous fork', s => { s.coordinationAdmissions.fixtureFork = { ...structuredClone(s.coordinationAdmissions.fixtureChild), dispatcherBlocker: 'Competing pending source.' }; }],
];
for (const [name, mutate] of invalidDispatcherSupersessions) {
  test(`dispatcher supersession: rejects ${name} before writing progress or prompts`, (t) => {
    const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
    const source = { owner: 'FIXTURE_SOURCE_OWNER', implementationBranch: 'fixture/source', sourcePayloads: [{ path: 'fixture/a' }, { path: 'fixture/b' }], dispatcherBlocker: 'Original pending source.' };
    state.approvedConcurrentScopes['fixture/source'] = ['fixture/a', 'fixture/b'];
    state.coordinationAdmissions.fixtureParent = source;
    state.coordinationAdmissions.fixtureChild = { ...structuredClone(source), sourcePayloads: [{ path: 'fixture/a' }], supersedesUnacceptedPayloadOf: 'fixtureParent', dispatcherBlocker: 'Replacement pending source.' };
    mutate(state); const fixture = dispatcherSupersessionFixture(t, state);
    const before = fixture.outputs.map(file => fs.readFileSync(path.join(fixture.root, file), 'utf8'));
    const result = fixture.run(); assert.equal(result.status, 1, output(result)); assert.match(result.stderr, /Invalid dispatcher admission supersession/u);
    assert.deepEqual(fixture.outputs.map(file => fs.readFileSync(path.join(fixture.root, file), 'utf8')), before);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fixture.root, 'docs/platform-v7/autopilot/autopilot-state.json'), 'utf8')), state);
  });
}

test('provider-independent review policy survives actual dispatcher regeneration without duplication', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-review-policy-dispatcher-regression-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  for (const file of ['docs/platform-v7/autopilot/autopilot-state.json', 'docs/platform-v7/execution-queue.md']) {
    write(root, file, fs.readFileSync(file, 'utf8'));
  }
  const promptPaths = ['docs/platform-v7/autopilot/prompts/current-codex-task.md', 'docs/platform-v7/autopilot/prompts/current-review-task.md'];
  for (const file of promptPaths) write(root, file, 'Stale generated prompt must be replaced.\n');
  const heading = '## Owner-authorized provider-independent review — 2026-09-18';
  const queue = fs.readFileSync('docs/platform-v7/execution-queue.md', 'utf8');
  const conditionalBlock = heading + (queue.split(heading)[1]?.split('\n## ')[0] ?? '');
  const required = [
    'fix/provider-independent-review-20260918',
    'The implementation author cannot supply their own independent review.',
    'READY_FOR_MANUAL_REVIEW',
    'AUTOMATIC_MERGE_DISABLED',
    'complete applicable substantive CI/security checks',
    'Existing GitHub branch protections apply',
    'IR-20 remains active.',
    'Archived instruction only.',
  ];
  const firstPass = [];
  for (let run = 0; run < 2; run += 1) {
    const result = spawnSync(process.execPath, [path.resolve('scripts/p7-autopilot-dispatcher.mjs')], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, output(result));
    for (const [index, file] of promptPaths.entries()) {
      const prompt = fs.readFileSync(path.join(root, file), 'utf8');
      assert.equal(prompt.split(heading).length - 1, 1, `${file}: current review policy must survive exactly once`);
      assert.ok(prompt.includes(conditionalBlock), `${file}: preserve the entire queue authority block`);
      const normalized = prompt.replace(/\s+/gu, ' ');
      for (const marker of required) assert.ok(normalized.includes(marker), `${file}: missing ${marker}`);
      if (run === 0) firstPass[index] = prompt;
      else assert.equal(prompt, firstPass[index], `${file}: repeated regeneration must be stable`);
    }
  }
});


test('W1 release scope binds operational, correction and isolated lineage fixture paths to validation', () => {
  const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  const approved = state.approvedConcurrentScopes['ops/pc-crop-w1-production-acceptance-4997'];
  const expected = [
    '.github/workflows/pc-crop-w1-production-acceptance.yml',
    'scripts/production-pc-crop-w1-migrations.sh',
    'scripts/check-production-pc-crop-w1-acceptance.mjs',
    'scripts/check-production-pc-crop-w1-acceptance.test.mjs',
    'scripts/production-role-eligibility-api-release.sh',
    'scripts/check-role-eligibility-api-release.mjs',
    '.github/workflows/production-web-exact-sha.yml',
    '.gitleaksignore',
    'apps/api/prisma/migrations/20260909120000_reconcile_historical_auction_authority/migration.sql',
    'scripts/fixtures/pc-crop-w1-lineage/20260716130000_market_open_lots_showcase.sql',
    'scripts/fixtures/pc-crop-w1-lineage/20260716150000_auction_cross_tenant_participation.sql',
    'scripts/fixtures/pc-crop-w1-lineage/20260716160000_auction_participant_workspace.sql',
    'scripts/fixtures/pc-crop-w1-lineage/20260717170000_deal_cross_tenant_participation.sql',
  ];
  assert.deepEqual(approved, expected);
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const first = workflow.indexOf('\n  pull_request:\n');
  const last = workflow.indexOf('\nconcurrency:', first);
  assert.ok(first >= 0 && last > first);
  const paths = [...workflow.slice(first, last).matchAll(/^      - '([^']+)'$/gmu)].map((match) => match[1]);
  for (const file of approved) assert.equal(paths.filter((entry) => entry === file).length, 1, `Missing W1 head-validation trigger: ${file}`);
  const contract = fs.readFileSync('.github/workflows/pc-crop-w1-production-acceptance.yml', 'utf8');
  const contractTrigger = contract.slice(contract.indexOf('\n  pull_request:\n'), contract.indexOf('\n  issue_comment:\n'));
  const contractPaths = [...contractTrigger.matchAll(/^      - '([^']+)'$/gmu)].map((match) => match[1]);
  for (const file of approved.filter(file => file.startsWith('apps/api/prisma/migrations/') || file.startsWith('scripts/fixtures/pc-crop-w1-lineage/'))) {
    assert.equal(contractPaths.filter(entry => entry === file).length, 1, `Missing W1 contract trigger: ${file}`);
  }
});

test('W1 cannot execute a newly appended lineage path against an older immutable base', (t) => {
  const branch = 'ops/pc-crop-w1-production-acceptance-4997';
  const context = fixture(t, branch);
  const stateFile = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = JSON.parse(fs.readFileSync(path.join(context.root, stateFile), 'utf8'));
  const migration = 'apps/api/prisma/migrations/20260909120000_reconcile_historical_auction_authority/migration.sql';
  state.approvedConcurrentScopes[branch].push(migration);
  write(context.root, stateFile, JSON.stringify(state));
  write(context.root, migration, 'SELECT 1;\n');
  commit(context.root, 'attempt premature lineage path self-approval');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /Mutable scope authority changed/u);
  assert.ok(output(result).includes(migration));
});

test('W1 implementation cannot authorize itself when the immutable base lacks its scope', (t) => {
  const branch = 'ops/pc-crop-w1-production-acceptance-4997';
  const context = fixture(t, branch);
  const stateFile = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = JSON.parse(fs.readFileSync(path.join(context.root, stateFile), 'utf8'));
  delete state.approvedConcurrentScopes[branch];
  write(context.root, stateFile, JSON.stringify(state));
  commit(context.root, 'accepted base without W1 release authority');
  const baseline = git(context.root, ['rev-parse', 'HEAD']);
  state.approvedConcurrentScopes[branch] = ['allowed.txt'];
  write(context.root, stateFile, JSON.stringify(state));
  write(context.root, 'allowed.txt', 'attempt implementation self-approval\n');
  commit(context.root, 'attempt head-only W1 release approval');
  const result = runGuard({ ...context, baseline });
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /no immutable approved scope/u);
});

test('W1 implementation cannot change runtime files absent from its immutable base scope', (t) => {
  const branch = 'ops/pc-crop-w1-production-acceptance-4997';
  const context = fixture(t, branch);
  const protectedFiles = [
    'scripts/production-role-eligibility-api-release.sh',
    'apps/api/src/modules/auth/auth.service.ts',
    'apps/web/app/platform-v7/register/page.tsx',
  ];
  for (const file of protectedFiles) write(context.root, file, 'unauthorized W1 mutation\n');
  commit(context.root, 'attempt to expand W1 release into runtime code');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /Files outside current autopilot scope/u);
  for (const file of protectedFiles) assert.ok(output(result).includes(file), `Unapproved path must be rejected: ${file}`);
});


test('W1 implementation cannot add digest or web-lock authority to an older four-file base', (t) => {
  const branch = 'ops/pc-crop-w1-production-acceptance-4997';
  const context = fixture(t, branch);
  const stateFile = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = JSON.parse(fs.readFileSync(path.join(context.root, stateFile), 'utf8'));
  state.approvedConcurrentScopes[branch] = [
    '.github/workflows/pc-crop-w1-production-acceptance.yml',
    'scripts/production-pc-crop-w1-migrations.sh',
    'scripts/check-production-pc-crop-w1-acceptance.mjs',
    'scripts/check-production-pc-crop-w1-acceptance.test.mjs',
  ];
  write(context.root, stateFile, JSON.stringify(state));
  commit(context.root, 'accepted original four-path W1 scope');
  const baseline = git(context.root, ['rev-parse', 'HEAD']);
  for (const file of ['scripts/production-role-eligibility-api-release.sh', 'scripts/check-role-eligibility-api-release.mjs', '.github/workflows/production-web-exact-sha.yml']) {
    state.approvedConcurrentScopes[branch].push(file);
    write(context.root, file, 'attempt premature reuse-guard change\n');
  }
  write(context.root, stateFile, JSON.stringify(state));
  commit(context.root, 'attempt implementation-side authority expansion');
  const result = runGuard({ ...context, baseline });
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /Mutable scope authority changed/u);
});


test('admits the bounded revenue evidence regression suite and runs it in required CI', () => {
  const state = JSON.parse(fs.readFileSync(path.resolve('docs/platform-v7/autopilot/autopilot-state.json'), 'utf8'));
  const scope = state.approvedConcurrentScopes['docs/pc-crop-post-registration-progress-4997'];
  const prefix = 'docs/platform-v7/crop-platform/post-registration/';
  assert.deepEqual([...scope].sort(), ['README.md', 'dod-baseline.v1.json', 'exact-gap-map.v1.json', 'execution-state.v1.json', 'verify-w0.mjs', 'verify-w0.test.mjs', 'w2-a-inventory-reservation-plan.v1.json'].map(name => prefix + name).sort());
  assert.ok(scope.every(name => !name.includes('*')));
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  assert.ok(workflow.includes("- 'docs/platform-v7/**'"), 'existing trigger covers the added test');
  assert.ok(workflow.includes("      - name: Test post-registration evidence rejection\n        if: github.event_name == 'pull_request' && github.head_ref == 'docs/pc-crop-post-registration-progress-4997'\n        run: node --test docs/platform-v7/crop-platform/post-registration/verify-w0.test.mjs"));
});


for (const mutation of ['approved append', 'extra fingerprint', 'remove prior entry', 'alter fingerprint']) {
  test(`W1 historical scanner exception: ${mutation}`, (t) => {
    const context = fixture(t, 'ops/pc-crop-w1-production-acceptance-4997');
    const stateFile = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, stateFile), 'utf8'));
    state.approvedConcurrentScopes[context.implementationBranch].push('.gitleaksignore');
    write(context.root, stateFile, JSON.stringify(state));
    const prior = '# Previously reviewed exception\nprior:exact:fingerprint:1\n';
    write(context.root, '.gitleaksignore', prior);
    commit(context.root, 'accepted historical scan exception authority');
    const baseline = git(context.root, ['rev-parse', 'HEAD']);
    const approvedAppend = "\n# False positive: static PC_W1_API_DIGEST_VERIFIED output field name in W1 controller history.\n# Exact commit/path/rule/line only; these strings never contained a credential.\n25f4fa23451d9b2fd58ff60ba9badfc063055796:.github/workflows/pc-crop-w1-production-acceptance.yml:generic-api-key:391\nba4e7b26a34f95ebc5636c6a18785a6a2d63b0b1:.github/workflows/pc-crop-w1-production-acceptance.yml:generic-api-key:395\n";
    let content = prior + approvedAppend;
    if (mutation === 'extra fingerprint') content += 'unreviewed:extra:fingerprint:2\n';
    if (mutation === 'remove prior entry') content = approvedAppend;
    if (mutation === 'alter fingerprint') content = content.replace(':395', ':396');
    write(context.root, '.gitleaksignore', content);
    commit(context.root, `candidate ${mutation}`);
    const result = runGuard({ ...context, baseline });
    if (mutation === 'approved append') assert.equal(result.status, 0, output(result));
    else {
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /exact approved append/u);
    }
  });
}

const nextSecurityPatchBranch = 'security/pc-crop-next-15-5-24-4997';
const nextSecurityPaths = ['.github/workflows/platform-v7-autopilot-guard.yml', '.github/workflows/sbom-scan.yml', 'apps/web/package.json', 'package.json', 'pnpm-lock.yaml', 'docs/platform-v7/autopilot/autopilot-state.json', 'scripts/p7-autopilot-guard.sh', 'scripts/p7-autopilot-guard.test.mjs'];
function nextSecurityFixture(t) {
  const context = fixture(t, nextSecurityPatchBranch);
  write(context.root, 'docs/platform-v7/autopilot/autopilot-state.json', JSON.stringify({
    allowedCurrentScope: ['README.md'],
    approvedConcurrentScopes: { [nextSecurityPatchBranch]: nextSecurityPaths },
  }));
  commit(context.root, 'owner-authorized exact dependency scope');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  return context;
}
test('Next security patch admits the manifests and lockfile after prior governance', (t) => {
  const context = nextSecurityFixture(t);
  write(context.root, 'apps/web/package.json', '{"dependencies":{"next":"15.5.24"}}');
  write(context.root, 'package.json', '{"pnpm":{"overrides":{"multer":"2.3.0","sharp":"0.35.4"}}}');
  write(context.root, 'pnpm-lock.yaml', 'lockfileVersion: 9.0\n');
  commit(context.root, 'bounded patch');
  const result = runGuard(context);
  assert.equal(result.status, 0, output(result));
});
for (const forbidden of ['README.md', 'apps/web/app/platform-v7/register/page.tsx', 'apps/api/src/app.module.ts', 'pnpm-lock.yaml/child', 'package.json/child', 'package-lock.json']) {
  test(`Next security patch rejects unrelated path ${forbidden}`, (t) => {
    const context = nextSecurityFixture(t);
    write(context.root, forbidden, 'unapproved change\n');
    commit(context.root, 'out-of-scope change');
    const result = runGuard(context);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /Files outside current autopilot scope|Forbidden path changed/u);
  });
}

test('Next security patch rejects expansion of its declared scope', (t) => {
  const context = nextSecurityFixture(t);
  const statePath = path.join(context.root, 'docs/platform-v7/autopilot/autopilot-state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.approvedConcurrentScopes[nextSecurityPatchBranch].push('apps/web/**');
  fs.writeFileSync(statePath, JSON.stringify(state));
  commit(context.root, 'attempt mutable scope expansion');
  const result = runGuard(context);
  assert.notEqual(result.status, 0);
  assert.match(output(result), /NEXT_SECURITY_PATCH_SCOPE_MISMATCH/u);
});

test('Next security patch rejects same-PR self-authorization against an unapproved base', (t) => {
  const context = nextSecurityFixture(t);
  context.baseline = git(context.root, ['rev-parse', 'HEAD~1']);
  write(context.root, 'apps/web/package.json', '{"dependencies":{"next":"15.5.24"}}');
  commit(context.root, 'implementation bundled with candidate scope');
  const result = runGuard(context);
  assert.notEqual(result.status, 0);
  assert.match(output(result), /NEXT_SECURITY_PATCH_ACCEPTED_SCOPE_MISSING/u);
});

for (const mutation of ['approved append', 'alter global scope', 'alter other branch', 'unrelated base']) {
  test(`owner-authorized combined security repair: ${mutation}`, (t) => {
    const context = fixture(t, nextSecurityPatchBranch);
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const baselineRead = spawnSync('git', ['show', `2d55077c90adc6e0c5dd8aba217d323dbac327fd:${statePath}`], { encoding: 'utf8' });
    assert.equal(baselineRead.status, 0, baselineRead.stderr);
    const baselineText = baselineRead.stdout;
    const baselineState = JSON.parse(baselineText);
    // Preserve exact bytes: authority binds the real Git blob.
    write(context.root, statePath, baselineText);
    if (mutation === 'unrelated base') {
      baselineState.allowedCurrentScope.push('unrelated.txt');
      write(context.root, statePath, JSON.stringify(baselineState));
    }
    commit(context.root, 'accepted base before combined owner authorization');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    const candidate = structuredClone(baselineState);
    candidate.approvedConcurrentScopes[nextSecurityPatchBranch] = nextSecurityPaths;
    if (mutation === 'alter global scope') candidate.allowedCurrentScope.push('unapproved.txt');
    if (mutation === 'alter other branch') candidate.approvedConcurrentScopes['unrelated'] = ['**'];
    write(context.root, statePath, JSON.stringify(candidate));
    write(context.root, 'package.json', '{}');
    commit(context.root, 'candidate combined repair');
    const result = runGuard(context);
    if (mutation === 'approved append') assert.equal(result.status, 0, output(result));
    else {
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /NEXT_SECURITY_PATCH_(STATE_MUTATION|ACCEPTED_SCOPE_MISSING)/u);
    }
  });
}

test('security scope routing binds bootstrap to its base and otherwise loads the base guard', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const step = workflow.split('- name: Validate bounded security repair with trusted base authority')[1].split('- name: Validate post-registration DoD register')[0];
  assert.match(step, /BASE_STATE.*571d2821ac3c371d548e51e747ea8111a436dab8/u);
  assert.match(step, /git show bcfc63c01d6a0195cea8d2b55978d47e3dbe7964:scripts\/p7-autopilot-guard.sh > "\$TRUSTED_GUARD"/u);
  assert.doesNotMatch(step, /git show "\$HEAD_SHA:scripts\/p7-autopilot-guard.sh"/u);
  assert.match(step, /git show "\$BASE_SHA:scripts\/p7-autopilot-guard.sh" > "\$TRUSTED_GUARD"/u);
  assert.match(step, /BASE_REF="\$BASE_SHA" HEAD_REF="\$HEAD_SHA"/u);
  const standard = workflow.split('- name: Validate standard branch scope on PR head')[1].split('standard_validation:')[0];
  assert.match(standard, /github.head_ref != 'security\/pc-crop-next-15-5-24-4997'/u);
  const trusted = workflow.split('name: PC-CROP implementation immutable scope · trusted base')[1].split('  guard:')[0];
  assert.match(trusted, /github.event.pull_request.head.ref == 'security\/pc-crop-next-15-5-24-4997'/u);
  assert.match(trusted, /ref: \$\{\{ github.event.pull_request.base.sha \}\}/u);
  assert.match(trusted, /HEAD_REF="\$HEAD_SHA"/u);
});

for (const mutation of ['unapproved file', 'candidate global scope']) {
  test(`trusted security guard ignores a poisoned head script: ${mutation}`, (t) => {
    const context = nextSecurityFixture(t);
    write(context.root, 'scripts/p7-autopilot-guard.sh', '#!/usr/bin/env bash\nexit 0\n', 0o755);
    if (mutation === 'unapproved file') write(context.root, 'apps/api/src/unauthorized.ts', 'export {};');
    else {
      const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
      const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
      state.allowedCurrentScope.push('unapproved.txt');
      write(context.root, statePath, JSON.stringify(state));
    }
    commit(context.root, 'poison untrusted guard and candidate');
    const candidateHead = git(context.root, ['rev-parse', 'HEAD']);
    git(context.root, ['checkout', '--detach', context.baseline]);
    const result = spawnSync('bash', ['scripts/p7-autopilot-guard.sh'], {
      cwd: context.root,
      env: { ...process.env, BASE_REF: context.baseline, HEAD_REF: candidateHead, GITHUB_HEAD_REF: nextSecurityPatchBranch },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /Files outside current autopilot scope|NEXT_SECURITY_PATCH_STATE_MUTATION/u);
  });
}

function industrialFixture(t, branch, admitted = true) {
  const context = fixture(t, branch);
  const statePath = industrialGovernancePaths[0];
  const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
  delete state.approvedConcurrentScopes[branch];
  state.allowedCurrentScope.push('apps/api/src/outbox-worker.ts');
  if (admitted) {
    state.approvedConcurrentScopes[industrialGovernanceBranch] = industrialGovernancePaths;
    state.approvedConcurrentScopes[industrialDiagnosticBranch] = industrialDiagnosticPaths;
  }
  write(context.root, statePath, JSON.stringify(state));
  for (const file of [...industrialGovernancePaths.slice(1, 4), industrialGovernancePaths[5], ...industrialDiagnosticPaths,
    'apps/api/src/outbox-worker.ts', 'scripts/p7-agent-runner.sh']) write(context.root, file, 'baseline\n');
  commit(context.root, 'industrial admission fixture');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  return context;
}

function runIndustrialTrustedGuard(context, script) {
  const trusted = script ?? git(context.root, ['show', `${context.baseline}:scripts/p7-autopilot-guard.sh`]);
  return spawnSync('bash', ['-s'], {
    cwd: context.root, input: trusted, encoding: 'utf8',
    env: { ...process.env, BASE_REF: context.baseline, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: context.implementationBranch },
  });
}

for (const branch of [industrialGovernanceBranch, industrialDiagnosticBranch]) {
  for (const mutation of ['allowed', 'global runtime', 'generic infrastructure', 'head scope', 'global scope',
    'other branch', 'rename', 'delete', 'mode', 'symlink', 'poisoned guard and runtime', 'poisoned workflow and runtime']) {
    test(`${branch}: trusted industrial scope rejects ${mutation}`, (t) => {
      const context = industrialFixture(t, branch);
      const allowed = branch === industrialGovernanceBranch ? industrialGovernancePaths[1] : industrialDiagnosticPaths[0];
      write(context.root, allowed, 'changed\n');
      if (mutation === 'global runtime') write(context.root, 'apps/api/src/outbox-worker.ts', 'changed\n');
      if (mutation === 'generic infrastructure') write(context.root, 'scripts/p7-agent-runner.sh', 'changed\n');
      if (['head scope', 'global scope', 'other branch'].includes(mutation)) {
        const statePath = industrialGovernancePaths[0];
        const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
        if (mutation === 'head scope') state.approvedConcurrentScopes[branch].push('scripts/p7-agent-runner.sh');
        if (mutation === 'global scope') state.allowedCurrentScope.push('**');
        if (mutation === 'other branch') state.approvedConcurrentScopes.unrelated = ['**'];
        write(context.root, statePath, JSON.stringify(state));
      }
      if (mutation === 'rename') git(context.root, ['mv', allowed, `${allowed}.renamed`]);
      if (mutation === 'delete') fs.unlinkSync(path.join(context.root, allowed));
      if (mutation === 'mode') fs.chmodSync(path.join(context.root, allowed), 0o755);
      if (mutation === 'symlink') {
        fs.unlinkSync(path.join(context.root, allowed));
        fs.symlinkSync('README.md', path.join(context.root, allowed));
      }
      if (mutation.startsWith('poisoned')) {
        const target = mutation.includes('guard') ? 'scripts/p7-autopilot-guard.sh' : '.github/workflows/platform-v7-autopilot-guard.yml';
        write(context.root, target, mutation.includes('guard') ? '#!/usr/bin/env bash\nexit 0\n' : 'name: bypass\n');
        write(context.root, 'apps/api/src/outbox-worker.ts', 'changed\n');
      }
      commit(context.root, `candidate ${mutation}`);
      const result = runIndustrialTrustedGuard(context);
      if (mutation === 'allowed') assert.equal(result.status, 0, output(result));
      else {
        assert.notEqual(result.status, 0, output(result));
        assert.match(output(result), /INDUSTRIAL_DIAGNOSTIC_(STATE_MUTATION|DIFF_SCOPE|FILE_MODE)/u);
      }
    });
  }
}

for (const mutation of ['absent admission', 'self admission', 'expanded base admission']) {
  test(`industrial diagnostic cannot bootstrap itself: ${mutation}`, (t) => {
    const context = industrialFixture(t, industrialDiagnosticBranch, false);
    const statePath = industrialGovernancePaths[0];
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    if (mutation !== 'absent admission') {
      state.approvedConcurrentScopes[industrialDiagnosticBranch] = mutation === 'self admission'
        ? industrialDiagnosticPaths : [...industrialDiagnosticPaths, 'scripts/p7-agent-runner.sh'];
      write(context.root, statePath, JSON.stringify(state));
      if (mutation === 'expanded base admission') {
        commit(context.root, 'invalid accepted admission');
        context.baseline = git(context.root, ['rev-parse', 'HEAD']);
      }
    }
    write(context.root, industrialDiagnosticPaths[0], 'changed\n');
    commit(context.root, 'candidate diagnostic');
    const result = runIndustrialTrustedGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /INDUSTRIAL_DIAGNOSTIC_ACCEPTED_SCOPE_MISMATCH/u);
  });
}

for (const mutation of ['approved append', 'wrong base SHA', 'wrong state blob', 'existing diagnostic admission',
  'expanded governance', 'expanded diagnostic', 'other state', 'unapproved file']) {
  test(`industrial bootstrap is exact-base-bound: ${mutation}`, (t) => {
    const context = industrialFixture(t, industrialGovernanceBranch, false);
    const statePath = industrialGovernancePaths[0];
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    if (mutation === 'existing diagnostic admission') {
      state.approvedConcurrentScopes[industrialDiagnosticBranch] = industrialDiagnosticPaths;
      write(context.root, statePath, JSON.stringify(state));
      commit(context.root, 'pre-existing diagnostic');
      context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    }
    const blob = git(context.root, ['rev-parse', `${context.baseline}:${statePath}`]);
    // Bind the frozen guard to this synthetic fixture, not to mutable inputs.
    // Production literals are checked separately below; no runtime override exists.
    let guard = fs.readFileSync(sourceGuard, 'utf8')
      .replace('fe50e24d202bcd22d72dd15e4dc58f9ddc491331', mutation === 'wrong base SHA' ? '0'.repeat(40) : context.baseline)
      .replace('ea92fc5f636efaf147ddeee34f81428cdd69a925', mutation === 'wrong state blob' ? '0'.repeat(40) : blob);
    state.approvedConcurrentScopes[industrialGovernanceBranch] = [...industrialGovernancePaths];
    state.approvedConcurrentScopes[industrialDiagnosticBranch] = [...industrialDiagnosticPaths];
    if (mutation === 'expanded governance') state.approvedConcurrentScopes[industrialGovernanceBranch].push('**');
    if (mutation === 'expanded diagnostic') state.approvedConcurrentScopes[industrialDiagnosticBranch].push('**');
    if (mutation === 'other state') state.allowedCurrentScope.push('**');
    write(context.root, statePath, JSON.stringify(state));
    if (mutation === 'unapproved file') write(context.root, 'apps/api/src/outbox-worker.ts', 'changed\n');
    commit(context.root, 'candidate atomic bootstrap');
    const result = runIndustrialTrustedGuard(context, guard);
    if (mutation === 'approved append') assert.equal(result.status, 0, output(result));
    else {
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /INDUSTRIAL_DIAGNOSTIC_(BOOTSTRAP_BASE_MISMATCH|STATE_MUTATION|DIFF_SCOPE)/u);
    }
  });
}

test('industrial bootstrap retains base defense and read-only candidate tests without privileged head execution', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const source = fs.readFileSync(sourceGuard, 'utf8');
  const state = JSON.parse(fs.readFileSync(industrialGovernancePaths[0], 'utf8'));
  assert.deepEqual(state.approvedConcurrentScopes[industrialGovernanceBranch], industrialGovernancePaths);
  assert.deepEqual(state.approvedConcurrentScopes[industrialDiagnosticBranch], industrialDiagnosticPaths);
  assert.ok(source.includes("sha !== 'fe50e24d202bcd22d72dd15e4dc58f9ddc491331'"));
  assert.ok(source.includes("blob !== 'ea92fc5f636efaf147ddeee34f81428cdd69a925'"));
  const candidate = workflow.split('- name: Validate owner-authorized industrial diagnostic bootstrap candidate')[1]
    .split('- name: Validate bounded security repair with trusted base authority')[0];
  assert.ok(candidate.includes("github.event_name == 'pull_request'"));
  assert.ok(candidate.includes(`github.head_ref == '${industrialGovernanceBranch}'`));
  assert.ok(candidate.includes("github.event.pull_request.base.sha == 'fe50e24d202bcd22d72dd15e4dc58f9ddc491331'"));
  assert.ok(candidate.includes('run: bash scripts/p7-autopilot-guard.sh'));
  const paths = workflow.split('\n  pull_request:\n')[1].split('\nconcurrency:')[0];
  assert.ok(paths.includes(`'${industrialDiagnosticPaths[0]}'`));
});

for (const [branch, manifest] of productImplementationManifests) {
  test(`${branch}: accepted base controls scope and permits only its own manifest`, (t) => {
    const context = fixture(t, branch);
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    state.approvedConcurrentScopes[branch] = ['allowed.txt', manifest];
    write(context.root, statePath, JSON.stringify(state));
    commit(context.root, 'accepted product scope');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    write(context.root, 'allowed.txt', 'accepted product change\n');
    write(context.root, manifest, JSON.stringify({
      schemaVersion: 'platform-v7.concurrent-scope.v1', status: 'active', branch,
      allowedPaths: ['allowed.txt', manifest],
    }));
    commit(context.root, 'bounded product change');
    const accepted = runGuard(context);
    assert.equal(accepted.status, 0, output(accepted));

    write(context.root, 'apps/api/src/app.module.ts', 'unauthorized server authority\n');
    commit(context.root, 'attempt protected backend change');
    const result = runGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /Files outside current autopilot scope/u);
  });

  test(`${branch}: head-only scope expansion cannot approve itself`, (t) => {
    const context = fixture(t, branch);
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    state.approvedConcurrentScopes[branch] = ['allowed.txt', manifest];
    write(context.root, statePath, JSON.stringify(state));
    commit(context.root, 'accepted product scope');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    state.allowedCurrentScope.push('apps/api/src/app.module.ts');
    state.approvedConcurrentScopes[branch].push('apps/api/src/app.module.ts');
    write(context.root, statePath, JSON.stringify(state));
    write(context.root, manifest, JSON.stringify({
      schemaVersion: 'platform-v7.concurrent-scope.v1', status: 'active', branch,
      allowedPaths: ['allowed.txt', manifest],
    }));
    write(context.root, 'apps/api/src/app.module.ts', 'unauthorized server authority\n');
    commit(context.root, 'attempt mutable product scope');
    const result = runGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /Mutable scope authority changed/u);
  });

  for (const mutation of ['foreign branch', 'expanded paths']) {
    test(`${branch}: own manifest cannot grant ${mutation} authority`, (t) => {
      const context = fixture(t, branch);
      const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
      const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
      state.approvedConcurrentScopes[branch] = ['allowed.txt', manifest];
      write(context.root, statePath, JSON.stringify(state));
      commit(context.root, 'accepted product scope');
      context.baseline = git(context.root, ['rev-parse', 'HEAD']);
      const candidate = {
        schemaVersion: 'platform-v7.concurrent-scope.v1', status: 'active', branch,
        allowedPaths: ['allowed.txt', manifest],
      };
      if (mutation === 'foreign branch') candidate.branch = 'agent/unrelated';
      if (mutation === 'expanded paths') candidate.allowedPaths.push('apps/api/src/modules/auth/**');
      write(context.root, manifest, JSON.stringify(candidate));
      commit(context.root, 'attempt product manifest scope laundering');
      const result = runGuard(context);
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /PRODUCT_MANIFEST_BASE_SCOPE_MISMATCH/u);
    });
  }
}

test('product branches run the immutable guard from the accepted base in both workflow entry points', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const trusted = workflow.split('  trusted-immutable-scope:')[1].split('  guard:')[0];
  const prHead = workflow.split('      - name: Validate immutable scope with trusted base guard on PR head')[1]
    .split('      - name: Validate owner-authorized industrial diagnostic bootstrap candidate')[0];
  const standard = workflow.split('      - name: Validate standard branch scope on PR head')[1]
    .split('  standard_validation:')[0];
  for (const branch of productImplementationManifests.keys()) {
    assert.ok(trusted.includes(`github.event.pull_request.head.ref == '${branch}'`));
    assert.ok(trusted.includes(`|${branch})`) || trusted.includes(`|${branch}|`));
    assert.ok(prHead.includes(`github.head_ref == '${branch}'`));
    assert.ok(prHead.includes(`|${branch})`) || prHead.includes(`|${branch}|`));
    assert.ok(standard.includes(`github.head_ref != '${branch}'`));
  }
  assert.ok(prHead.includes('git show "$BASE_SHA:scripts/p7-autopilot-guard.sh"'));
  assert.ok(trusted.includes('ref: ${{ github.event.pull_request.base.sha }}'));
});

test('readiness queue job gate has exactly the two accepted paths and a workflow trigger', () => {
  const branch = 'fix/readiness-queue-job-gate-20260927';
  const workflowPath = '.github/workflows/automerge.yml';
  const manifestPath = productImplementationManifests.get(branch);
  const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  assert.deepEqual(state.approvedConcurrentScopes[branch], [workflowPath, manifestPath]);
  const paths = workflow.split('\n  pull_request:\n')[1].split('\nconcurrency:')[0];
  assert.ok(paths.includes(`- '${workflowPath}'`));
  assert.ok(fs.readFileSync(sourceGuard, 'utf8').includes(`"$READINESS_QUEUE_JOB_GATE_BRANCH") PRODUCT_SCOPE_MANIFEST='${manifestPath}'`));
});

test('readiness queue guard accepts the exact job lease move and rejects another workflow byte', (t) => {
  const branch = 'fix/readiness-queue-job-gate-20260927';
  const workflowPath = '.github/workflows/automerge.yml';
  const manifestPath = productImplementationManifests.get(branch);
  const context = fixture(t, branch);
  const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
  state.approvedConcurrentScopes[branch] = [workflowPath, manifestPath];
  write(context.root, statePath, `${JSON.stringify(state)}\n`);

  const workflowLease = `# Serial publication prevents an older evaluator overwriting a newer result.
concurrency:
  group: repo-engineering-readiness
  cancel-in-progress: false
  queue: max

`;
  const anchor = `         github.event.workflow_run.name != 'Independent Octopus Review'))\n`;
  const gatedLease = `    # A job that fails the event gate must not occupy the global publication
    # queue. Keep admitted evaluations serialized at the job boundary.
    concurrency:
      group: repo-engineering-readiness
      cancel-in-progress: false
      queue: max
`;
  const baseWorkflow = `name: Repo automations
permissions:
  contents: read
${workflowLease}jobs:
  engineering-readiness:
    if: >-
${anchor}    runs-on: ubuntu-latest
`;
  write(context.root, workflowPath, baseWorkflow);
  commit(context.root, 'accepted readiness scope and trusted workflow shape');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);

  const exactWorkflow = baseWorkflow.replace(workflowLease, '').replace(anchor, `${anchor}${gatedLease}`);
  write(context.root, workflowPath, exactWorkflow);
  write(context.root, manifestPath, JSON.stringify({
    schemaVersion: 'platform-v7.concurrent-scope.v1',
    status: 'active',
    branch,
    allowedPaths: [workflowPath, manifestPath],
  }));
  commit(context.root, 'move only the serial lease under the job event gate');
  const accepted = runGuard(context);
  assert.equal(accepted.status, 0, output(accepted));

  write(context.root, workflowPath, exactWorkflow.replace('  contents: read\n', '  contents: write\n'));
  commit(context.root, 'attempt unrelated workflow permission change');
  const rejected = runGuard(context);
  assert.notEqual(rejected.status, 0, output(rejected));
  assert.match(output(rejected), /READINESS_QUEUE_CHANGE_EXCEEDS_EXACT_TRANSFORM/u);
});

test('readiness default-branch push gate has exactly the two accepted paths and a workflow trigger', () => {
  const branch = 'fix/readiness-default-branch-push-gate-20260929';
  const workflowPath = '.github/workflows/automerge.yml';
  const manifestPath = productImplementationManifests.get(branch);
  const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  assert.deepEqual(state.approvedConcurrentScopes[branch], [workflowPath, manifestPath]);
  const paths = workflow.split('\n  pull_request:\n')[1].split('\nconcurrency:')[0];
  assert.ok(paths.includes(`- '${workflowPath}'`));
  assert.ok(fs.readFileSync(sourceGuard, 'utf8').includes(`"$READINESS_DEFAULT_BRANCH_PUSH_GATE_BRANCH") PRODUCT_SCOPE_MANIFEST='${manifestPath}'`));
});

test('readiness default-branch push guard accepts only the exact event-gate exclusion', (t) => {
  const branch = 'fix/readiness-default-branch-push-gate-20260929';
  const workflowPath = '.github/workflows/automerge.yml';
  const manifestPath = productImplementationManifests.get(branch);
  const context = fixture(t, branch);
  const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
  state.approvedConcurrentScopes[branch] = [workflowPath, manifestPath];
  write(context.root, statePath, `${JSON.stringify(state)}\n`);

  const anchor = `         github.event.workflow_run.name != 'Independent Octopus Review'))\n`;
  const gated = `         github.event.workflow_run.name != 'Independent Octopus Review' &&
         !(github.event.workflow_run.event == 'push' &&
           github.event.workflow_run.head_branch == github.event.repository.default_branch)))\n`;
  const baseWorkflow = `name: Repo automations
permissions:
  contents: read
jobs:
  engineering-readiness:
    if: >-
${anchor}    runs-on: ubuntu-latest
`;
  write(context.root, workflowPath, baseWorkflow);
  commit(context.root, 'accepted default-branch scope and trusted workflow shape');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);

  const exactWorkflow = baseWorkflow.replace(anchor, gated);
  write(context.root, workflowPath, exactWorkflow);
  write(context.root, manifestPath, JSON.stringify({
    schemaVersion: 'platform-v7.concurrent-scope.v1',
    status: 'active',
    branch,
    allowedPaths: [workflowPath, manifestPath],
  }));
  commit(context.root, 'exclude only default-branch push workflow_run events');
  const accepted = runGuard(context);
  assert.equal(accepted.status, 0, output(accepted));

  write(context.root, workflowPath, exactWorkflow.replace('  contents: read\n', '  contents: write\n'));
  commit(context.root, 'attempt unrelated workflow permission change');
  const rejected = runGuard(context);
  assert.notEqual(rejected.status, 0, output(rejected));
  assert.match(output(rejected), /READINESS_DEFAULT_BRANCH_PUSH_CHANGE_EXCEEDS_EXACT_TRANSFORM/u);

  write(context.root, workflowPath, baseWorkflow.replace(anchor, gated.replace("event == 'push'", "event != 'pull_request'")));
  commit(context.root, 'attempt a broader event exclusion');
  const broader = runGuard(context);
  assert.notEqual(broader.status, 0, output(broader));
  assert.match(output(broader), /READINESS_DEFAULT_BRANCH_PUSH_CHANGE_EXCEEDS_EXACT_TRANSFORM/u);
});

test('mobile controller handoff has exactly the two accepted paths and a workflow trigger', () => {
  const branch = 'fix/production-mobile-controller-handoff-20260927';
  const workflowPath = '.github/workflows/platform-v7-production-mobile-acceptance.yml';
  const manifestPath = productImplementationManifests.get(branch);
  const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  assert.deepEqual(state.approvedConcurrentScopes[branch], [workflowPath, manifestPath]);
  const paths = workflow.split('\n  pull_request:\n')[1].split('\nconcurrency:')[0];
  assert.ok(paths.includes(`- '${workflowPath}'`));
  assert.ok(fs.readFileSync(sourceGuard, 'utf8').includes(`"$PRODUCTION_MOBILE_HANDOFF_BRANCH") PRODUCT_SCOPE_MANIFEST='${manifestPath}'`));
});

test('Deal command source branch runs the trusted-base guard in both workflow entry points', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const trusted = workflow.split('  trusted-immutable-scope:')[1].split('  guard:')[0];
  const prHead = workflow.split('      - name: Validate immutable scope with trusted base guard on PR head')[1]
    .split('      - name: Validate owner-authorized industrial diagnostic bootstrap candidate')[0];
  const standard = workflow.split('      - name: Validate standard branch scope on PR head')[1]
    .split('  standard_validation:')[0];
  assert.ok(trusted.includes(`github.event.pull_request.head.ref == '${dealCommandImplementationBranch}'`));
  assert.ok(trusted.includes(`|${dealCommandImplementationBranch}|`));
  assert.ok(prHead.includes(`github.head_ref == '${dealCommandImplementationBranch}'`));
  assert.ok(prHead.includes(`|${dealCommandImplementationBranch}|`));
  assert.ok(standard.includes(`github.head_ref != '${dealCommandImplementationBranch}'`));
  assert.ok(prHead.includes('git show "$BASE_SHA:scripts/p7-autopilot-guard.sh"'));
});

test('Deal command source cannot expand its own trusted-base scope', (t) => {
  const context = fixture(t, dealCommandImplementationBranch);
  fs.mkdirSync(path.join(context.root, 'docs/platform-v7/autopilot/scopes'), { recursive: true });
  write(context.root, 'allowed.txt', 'admitted Deal UX change\n');
  commit(context.root, 'admitted Deal UX');
  const accepted = runGuard(context);
  assert.equal(accepted.status, 0, output(accepted));
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);

  const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
  state.approvedConcurrentScopes[dealCommandImplementationBranch].push(statePath, 'apps/web/app/layout.tsx');
  write(context.root, statePath, JSON.stringify(state));
  write(context.root, 'apps/web/app/layout.tsx', 'self-authorized layout change\n');
  commit(context.root, 'attempt Deal source self-expansion');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /Mutable scope authority changed|Files outside current autopilot scope/u);
});

test('WebKit i18n test branch uses the trusted base guard at both PR entry points', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const trusted = workflow.split('  trusted-immutable-scope:')[1].split('  guard:')[0];
  const prHead = workflow.split('      - name: Validate immutable scope with trusted base guard on PR head')[1]
    .split('      - name: Validate owner-authorized industrial diagnostic bootstrap candidate')[0];
  const standard = workflow.split('      - name: Validate standard branch scope on PR head')[1]
    .split('  standard_validation:')[0];
  assert.ok(trusted.includes(`github.event.pull_request.head.ref == '${webkitI18nBranch}'`));
  assert.ok(trusted.includes(`|${webkitI18nBranch}|`));
  assert.ok(trusted.includes('if [ "$HEAD_REPOSITORY" != "$GITHUB_REPOSITORY" ]; then'));
  assert.ok(prHead.includes(`github.head_ref == '${webkitI18nBranch}'`));
  assert.ok(prHead.includes(`|${webkitI18nBranch}|`));
  assert.ok(prHead.includes('git show "$BASE_SHA:scripts/p7-autopilot-guard.sh"'));
  assert.ok(standard.includes(`github.head_ref != '${webkitI18nBranch}'`));
});

for (const mutation of ['admitted test', 'unadmitted test', 'foreign source', 'self-expanded state']) {
  test(`WebKit i18n branch enforces base-owned one-file scope: ${mutation}`, (t) => {
    const context = fixture(t, webkitI18nBranch);
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    if (mutation === 'unadmitted test') delete state.approvedConcurrentScopes[webkitI18nBranch];
    else state.approvedConcurrentScopes[webkitI18nBranch] = [webkitI18nTestPath];
    write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
    commit(context.root, 'accepted baseline scope');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);

    write(context.root, webkitI18nTestPath, 'test-only browser lifecycle repair\n');
    if (mutation === 'foreign source') {
      write(context.root, 'apps/web/app/platform-v7/login/page.tsx', 'unauthorized runtime change\n');
    }
    if (mutation === 'self-expanded state') {
      state.approvedConcurrentScopes[webkitI18nBranch].push('apps/web/app/platform-v7/login/page.tsx');
      state.allowedCurrentScope.push('apps/web/**');
      write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
      write(context.root, 'apps/web/app/platform-v7/login/page.tsx', 'candidate-supplied source authority\n');
    }
    commit(context.root, mutation);
    const result = runGuard(context);
    if (mutation === 'admitted test') assert.equal(result.status, 0, output(result));
    else {
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /no immutable approved scope|Mutable scope authority changed|Files outside current autopilot scope/u);
    }
  });
}

for (const mutation of ['accepted', 'unrelated global scope', 'bank path expansion', 'wrong base identity', 'unapproved fourth branch', 'weakened truth boundary', 'extra coordination authority']) {
  test(`product source admission accepts only exact base-bound state: ${mutation}`, (t) => {
    const context = fixture(t, productAdmissionBranch);
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    state.approvedConcurrentScopes[productAdmissionBranch] = [statePath];
    state.coordinationAdmissions = {};
    write(context.root, statePath, JSON.stringify(state));
    commit(context.root, 'accepted prior product governance scope');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    for (const [branch, paths] of productAdmissionPaths) {
      state.approvedConcurrentScopes[branch] = [...paths];
      state.coordinationAdmissions[productAdmissionCoordinationKeys.get(branch)] =
        productCoordinationRecord(branch, paths, context.baseline);
    }
    if (mutation === 'unrelated global scope') state.allowedCurrentScope.push('apps/api/**');
    if (mutation === 'bank path expansion') state.approvedConcurrentScopes['bank/deep-visible-copy-guard-20260924'].push('apps/api/src/app.module.ts');
    if (mutation === 'wrong base identity') state.coordinationAdmissions[productAdmissionCoordinationKeys.get('bank/deep-visible-copy-guard-20260924')].authorityBaseExactMain = '0'.repeat(40);
    if (mutation === 'unapproved fourth branch') state.approvedConcurrentScopes['bank/parallel-core'] = ['apps/api/**'];
    if (mutation === 'weakened truth boundary') state.coordinationAdmissions[productAdmissionCoordinationKeys.get('bank/deep-visible-copy-guard-20260924')].requiredTruthBoundaries = [null];
    if (mutation === 'extra coordination authority') state.coordinationAdmissions[productAdmissionCoordinationKeys.get('bank/deep-visible-copy-guard-20260924')].grantOtherBranch = 'apps/api/**';
    write(context.root, statePath, JSON.stringify(state));
    commit(context.root, `candidate ${mutation}`);
    const result = runGuard(context);
    if (mutation === 'accepted') assert.equal(result.status, 0, output(result));
    else {
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /PRODUCT_SCOPE_ADMISSION_(PATH_MISMATCH|COORDINATION_MISMATCH|STATE_MUTATION)/u);
    }
  });
}

test('product source admission cannot authorize its own missing base scope', (t) => {
  const context = fixture(t, productAdmissionBranch);
  const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
  delete state.approvedConcurrentScopes[productAdmissionBranch];
  write(context.root, statePath, JSON.stringify(state));
  commit(context.root, 'base without admission authority');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  state.approvedConcurrentScopes[productAdmissionBranch] = [statePath];
  state.coordinationAdmissions = {};
  for (const [branch, paths] of productAdmissionPaths) {
    state.approvedConcurrentScopes[branch] = [...paths];
    state.coordinationAdmissions[productAdmissionCoordinationKeys.get(branch)] =
      productCoordinationRecord(branch, paths, context.baseline);
  }
  write(context.root, statePath, JSON.stringify(state));
  commit(context.root, 'attempt self-admission');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /PRODUCT_SCOPE_ADMISSION_STATE_MUTATION|no immutable approved scope/u);
});

function webkitCoordinationRecord(base) {
  return {
    owner: 'ACCOUNT_2_PRODUCT',
    purpose: 'Isolate public production i18n route navigation in a fresh page lifecycle and verify realistic login-to-register navigation after the measured WebKit EN 320 ChunkLoadError.',
    authorityBaseExactMain: base,
    acceptedGuardPr: 5669,
    acceptedGuardMerge: base,
    implementationBranch: webkitI18nBranch,
    allowedPaths: [webkitI18nTestPath],
    requiredTruthBoundaries: [
      'The accepted trusted-base immutable guard and both PR entry points permit this implementation ref only the exact browser test path; candidate state cannot expand it.',
      'Preserve all eight public routes, EN/ZH localization, RU homepage design gates, ten viewport-locale combinations, zero pageerror, response success, Chinese typography, mobile target geometry and horizontal reflow assertions.',
      'Use an independent page lifecycle for each direct public route and a separate real user click from login to register at 320 px; do not dismiss an actual click-path product error as test harness noise.',
      'The previous WebKit EN 320 ChunkLoadError is unresolved until Chromium and WebKit exact-deployed-OCI live production i18n acceptance passes; source CI alone does not establish production acceptance.',
      'Do not broaden to BANKS, FGIS, provider credentials, backend/runtime/locale product code, other tests or release workflow in this one-file implementation.',
    ],
    forbiddenAuthority: [
      'Candidate-owned state or scope extension in the implementation PR',
      'Product code/API/DB/tenant/role/bank/provider/FGIS mutation',
      'CI/security/readiness weakening, fabricated acceptance or automatic merge',
    ],
    teamHubDependency: '#5666; accepted guard #5669; Team Hub #5469',
  };
}

for (const mutation of ['accepted', 'wrong base', 'extra path', 'weakened boundary', 'prior record mutation', 'foreign source']) {
  test(`WebKit state follow-up preserves the three accepted product admissions: ${mutation}`, (t) => {
    const context = fixture(t, productAdmissionBranch);
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    state.approvedConcurrentScopes[productAdmissionBranch] = [statePath];
    state.coordinationAdmissions = {};
    for (const [branch, paths] of productAdmissionPaths) {
      state.approvedConcurrentScopes[branch] = [...paths];
      state.coordinationAdmissions[productAdmissionCoordinationKeys.get(branch)] =
        productCoordinationRecord(branch, paths, '1'.repeat(40));
    }
    write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
    commit(context.root, 'accepted first three product admissions');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);

    state.approvedConcurrentScopes[webkitI18nBranch] = [webkitI18nTestPath];
    state.coordinationAdmissions['public-webkit-i18n-route-lifecycle-20260927'] =
      webkitCoordinationRecord(context.baseline);
    if (mutation === 'wrong base') state.coordinationAdmissions['public-webkit-i18n-route-lifecycle-20260927'].authorityBaseExactMain = '0'.repeat(40);
    if (mutation === 'extra path') state.approvedConcurrentScopes[webkitI18nBranch].push('apps/web/app/platform-v7/login/page.tsx');
    if (mutation === 'weakened boundary') state.coordinationAdmissions['public-webkit-i18n-route-lifecycle-20260927'].requiredTruthBoundaries.pop();
    if (mutation === 'prior record mutation') state.coordinationAdmissions[productAdmissionCoordinationKeys.get('bank/deep-visible-copy-guard-20260924')].grantProviderFinality = true;
    if (mutation === 'foreign source') write(context.root, 'apps/web/app/platform-v7/login/page.tsx', 'unadmitted runtime edit\n');
    write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
    commit(context.root, `candidate ${mutation}`);
    const result = runGuard(context);
    if (mutation === 'accepted') assert.equal(result.status, 0, output(result));
    else {
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /PRODUCT_WEBKIT_ADMISSION_STATE_MUTATION|Files outside current autopilot scope/u);
    }
  });
}

test('product source admission uses both trusted-base workflow routes', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const trusted = workflow.split('  trusted-immutable-scope:')[1].split('  guard:')[0];
  const prHead = workflow.split('      - name: Validate immutable scope with trusted base guard on PR head')[1]
    .split('      - name: Validate owner-authorized industrial diagnostic bootstrap candidate')[0];
  const standard = workflow.split('      - name: Validate standard branch scope on PR head')[1]
    .split('  standard_validation:')[0];
  assert.ok(trusted.includes(`github.event.pull_request.head.ref == '${productAdmissionBranch}'`));
  assert.ok(trusted.includes(`|${productAdmissionBranch}|${buyerAdmissionBranch}|${bankHomeAdmissionBranch})`));
  assert.ok(prHead.includes(`github.head_ref == '${productAdmissionBranch}'`));
  assert.ok(prHead.includes(`|${productAdmissionBranch}|${buyerAdmissionBranch}|${bankHomeAdmissionBranch})`));
  assert.ok(standard.includes(`github.head_ref != '${productAdmissionBranch}'`));
});

for (const mutation of ['accepted', 'wrong base', 'extra path', 'global scope', 'weakened boundary',
  'unrelated admission', 'source file', 'missing state diff']) {
  test(`buyer state-only admission is exact and base-bound: ${mutation}`, (t) => {
    const context = fixture(t, buyerAdmissionBranch);
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    delete state.approvedConcurrentScopes[buyerAdmissionBranch];
    state.coordinationAdmissions = {};
    write(context.root, statePath, JSON.stringify(state));
    commit(context.root, 'trusted base without buyer source authority');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    state.approvedConcurrentScopes[buyerBranch] = [...buyerPaths];
    state.coordinationAdmissions[buyerCoordinationKey] = {
      owner: 'ACCOUNT_2_PRODUCT',
      purpose: 'Buyer first-customer production-home information architecture and visual hierarchy from existing scoped server facts; one vertical after seller, not full 13-role acceptance.',
      authorityBaseExactMain: context.baseline,
      implementationBranch: buyerBranch,
      allowedPaths: [...buyerPaths],
      requiredTruthBoundaries: [
        'Buyer shows only server-scoped organization, identity and Deal queue facts; list recency never becomes required next action, amount or deadline.',
        'UNKNOWN next action, empty, forbidden and degraded remain explicit; no demo/static deal or fake bank/provider/FGIS status.',
        'RU/EN/ZH, mobile, focus and seller plus other six role regressions stay covered; owner-controlled showroom does not gain customer authority.',
        'Buyer source changes start only after the accepted immutable guard prerequisite and this state-only admission are merged.',
      ],
      forbiddenAuthority: [
        'homepage/public implementation or parallel App Shell/design system',
        'API/backend/domain/DB/RLS/tenant/role/priority or money/provider/FGIS finality',
        'CI/security/readiness gate weakening',
      ],
      teamHubDependency: '#5372 inventory comment 5833248230; #5604 guard prerequisite; PUBLIC #5559 main serialization; #5535 CORE next-action dependency',
    };
    if (mutation === 'wrong base') state.coordinationAdmissions[buyerCoordinationKey].authorityBaseExactMain = '0'.repeat(40);
    if (mutation === 'extra path') state.approvedConcurrentScopes[buyerBranch].push('apps/api/src/app.module.ts');
    if (mutation === 'global scope') state.allowedCurrentScope.push('apps/api/**');
    if (mutation === 'weakened boundary') state.coordinationAdmissions[buyerCoordinationKey].requiredTruthBoundaries.pop();
    if (mutation === 'unrelated admission') state.coordinationAdmissions.extra = { owner: 'ACCOUNT_2_PRODUCT' };
    if (mutation !== 'missing state diff') write(context.root, statePath, JSON.stringify(state));
    if (mutation === 'source file') write(context.root, 'apps/api/src/app.module.ts', 'unapproved\n');
    if (mutation === 'missing state diff') write(context.root, 'allowed.txt', 'changed\n');
    commit(context.root, `buyer admission ${mutation}`);
    const result = runGuard(context);
    if (mutation === 'accepted') assert.equal(result.status, 0, output(result));
    else {
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /PRODUCT_BUYER_ADMISSION_(STATE_MUTATION|DIFF_SCOPE)/u);
    }
  });
}

test('buyer admission uses trusted base guard in both workflow entry points', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const trusted = workflow.split('  trusted-immutable-scope:')[1].split('  guard:')[0];
  const prHead = workflow.split('      - name: Validate immutable scope with trusted base guard on PR head')[1]
    .split('      - name: Validate owner-authorized industrial diagnostic bootstrap candidate')[0];
  const standard = workflow.split('      - name: Validate standard branch scope on PR head')[1]
    .split('  standard_validation:')[0];
  assert.ok(trusted.includes(`github.event.pull_request.head.ref == '${buyerAdmissionBranch}'`));
  assert.ok(trusted.includes(`|${buyerAdmissionBranch}|${bankHomeAdmissionBranch})`));
  assert.ok(prHead.includes(`github.head_ref == '${buyerAdmissionBranch}'`));
  assert.ok(prHead.includes(`|${buyerAdmissionBranch}|${bankHomeAdmissionBranch})`));
  assert.ok(standard.includes(`github.head_ref != '${buyerAdmissionBranch}'`));
});

for (const mutation of ['accepted', 'wrong base', 'extra path', 'global scope', 'weakened boundary',
  'unrelated admission', 'source file', 'missing state diff']) {
  test(`bank home state-only admission is exact and base-bound: ${mutation}`, (t) => {
    const context = fixture(t, bankHomeAdmissionBranch);
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    delete state.approvedConcurrentScopes[bankHomeAdmissionBranch];
    state.coordinationAdmissions = {};
    write(context.root, statePath, JSON.stringify(state));
    commit(context.root, 'trusted base without bank home source authority');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    state.approvedConcurrentScopes[bankHomeBranch] = [...bankHomePaths];
    state.coordinationAdmissions[bankHomeCoordinationKey] = {
      owner: 'ACCOUNT_2_PRODUCT',
      purpose: 'Bank first-customer production-home hierarchy from existing server-scoped Deal navigation; no bank operation, provider or settlement authority.',
      authorityBaseExactMain: context.baseline,
      implementationBranch: bankHomeBranch,
      allowedPaths: [...bankHomePaths],
      requiredTruthBoundaries: [
        'The bank Deal queue is navigation, not a BankOperation read, provider binding, release decision, payment instruction or external bank confirmation.',
        'UNKNOWN next action, empty, forbidden and degraded remain explicit; no demo amounts, concrete provider or settlement finality.',
        'RU/EN/ZH, mobile, focus, buyer/seller and other role regressions remain covered; owner-controlled showroom does not gain customer authority.',
        'Ordinary verified bank root mounts the server-scoped bank workspace; owner-controlled preview keeps precedence and other roles do not inherit bank access.',
        'Bank source changes start only after the trusted immutable guard prerequisite and this state-only admission are merged.',
      ],
      forbiddenAuthority: [
        'API/backend/domain/DB/RLS/tenant/role/BankOperation/IntegrationBinding/provider/payment authority',
        'homepage/public implementation or parallel App Shell/design system',
        'CI/security/readiness gate weakening or production PASS claim',
      ],
      teamHubDependency: '#5469 comment 5842845723; CORE #5525; external #5530; buyer #5610 review; P0 release serialization',
    };
    if (mutation === 'wrong base') state.coordinationAdmissions[bankHomeCoordinationKey].authorityBaseExactMain = '0'.repeat(40);
    if (mutation === 'extra path') state.approvedConcurrentScopes[bankHomeBranch].push('apps/api/src/app.module.ts');
    if (mutation === 'global scope') state.allowedCurrentScope.push('apps/api/**');
    if (mutation === 'weakened boundary') state.coordinationAdmissions[bankHomeCoordinationKey].requiredTruthBoundaries.pop();
    if (mutation === 'unrelated admission') state.coordinationAdmissions.extra = { owner: 'ACCOUNT_2_PRODUCT' };
    if (mutation !== 'missing state diff') write(context.root, statePath, JSON.stringify(state));
    if (mutation === 'source file') write(context.root, 'apps/api/src/app.module.ts', 'unapproved\n');
    if (mutation === 'missing state diff') write(context.root, 'allowed.txt', 'changed\n');
    commit(context.root, `bank home admission ${mutation}`);
    const result = runGuard(context);
    if (mutation === 'accepted') assert.equal(result.status, 0, output(result));
    else {
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /PRODUCT_BANK_HOME_ADMISSION_(STATE_MUTATION|DIFF_SCOPE)/u);
    }
  });
}

test('bank home implementation and admission use trusted base guard in both workflow entry points', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const trusted = workflow.split('  trusted-immutable-scope:')[1].split('  guard:')[0];
  const prHead = workflow.split('      - name: Validate immutable scope with trusted base guard on PR head')[1]
    .split('      - name: Validate owner-authorized industrial diagnostic bootstrap candidate')[0];
  const standard = workflow.split('      - name: Validate standard branch scope on PR head')[1]
    .split('  standard_validation:')[0];
  for (const branch of [bankHomeBranch, bankHomeAdmissionBranch]) {
    assert.ok(trusted.includes(`github.event.pull_request.head.ref == '${branch}'`));
    assert.ok(trusted.includes(`|${branch}|`) || trusted.includes(`|${branch})`));
    assert.ok(prHead.includes(`github.head_ref == '${branch}'`));
    assert.ok(prHead.includes(`|${branch}|`) || prHead.includes(`|${branch})`));
    assert.ok(standard.includes(`github.head_ref != '${branch}'`));
  }
});

const buyerRouteCoordinationKey = 'ux-buyer-first-customer-route-20260927-coordination';
const buyerRouteAdditions = [
  'apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx',
  'apps/web/tests/unit/platformV7RoleIntentDashboard.test.ts',
  'apps/web/tests/e2e/platform-v7-canonical-visual-evidence.spec.ts',
];
const buyerRoutePaths = [...buyerPaths.slice(0, -1), ...buyerRouteAdditions, buyerPaths.at(-1)];

test('buyer route admission adds only shell composition and actual-route checks', () => {
  const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  assert.deepEqual(state.approvedConcurrentScopes[buyerBranch], buyerRoutePaths);
  assert.deepEqual(state.coordinationAdmissions[buyerCoordinationKey].allowedPaths, buyerRoutePaths);
  assert.deepEqual(state.coordinationAdmissions[buyerRouteCoordinationKey].allowedPaths, buyerRouteAdditions);
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const trusted = workflow.split('  trusted-immutable-scope:')[1].split('  guard:')[0];
  const prHead = workflow.split('      - name: Validate immutable scope with trusted base guard on PR head')[1]
    .split('      - name: Validate owner-authorized industrial diagnostic bootstrap candidate')[0];
  assert.ok(trusted.includes("github.event.pull_request.head.ref == 'governance/pc-crop-inventory-reservation-scope-4997'"));
  assert.ok(prHead.includes("github.head_ref == 'governance/pc-crop-inventory-reservation-scope-4997'"));
});

for (const mutation of ['accepted', 'wrong base', 'extra buyer path', 'missing browser check', 'missing route record', 'global scope', 'unrelated state']) {
  test(`buyer route governance exact state transform: ${mutation}`, (t) => {
    const branch = 'governance/pc-crop-inventory-reservation-scope-4997';
    const context = fixture(t, branch);
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    state.approvedConcurrentScopes[branch] = [
      statePath, 'scripts/p7-autopilot-guard.sh', 'scripts/p7-autopilot-guard.test.mjs',
      '.github/workflows/platform-v7-autopilot-guard.yml',
    ];
    state.approvedConcurrentScopes[buyerBranch] = [...buyerPaths];
    state.coordinationAdmissions = { [buyerCoordinationKey]: { allowedPaths: [...buyerPaths] } };
    write(context.root, statePath, JSON.stringify(state));
    commit(context.root, 'trusted buyer route governance baseline');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);

    state.approvedConcurrentScopes[buyerBranch] = [...buyerRoutePaths];
    state.coordinationAdmissions[buyerCoordinationKey].allowedPaths = [...buyerRoutePaths];
    const metadata = JSON.parse(fs.readFileSync(statePath, 'utf8')).coordinationAdmissions[buyerRouteCoordinationKey];
    state.coordinationAdmissions[buyerRouteCoordinationKey] = {
      ...metadata, authorityBaseExactMain: context.baseline,
    };
    if (mutation === 'wrong base') state.coordinationAdmissions[buyerRouteCoordinationKey].authorityBaseExactMain = '0'.repeat(40);
    if (mutation === 'extra buyer path') state.approvedConcurrentScopes[buyerBranch].push('apps/api/src/app.module.ts');
    if (mutation === 'missing browser check') state.approvedConcurrentScopes[buyerBranch] = buyerRoutePaths.filter((file) => !file.endsWith('canonical-visual-evidence.spec.ts'));
    if (mutation === 'missing route record') delete state.coordinationAdmissions[buyerRouteCoordinationKey];
    if (mutation === 'global scope') state.allowedCurrentScope.push('apps/api/**');
    if (mutation === 'unrelated state') state.coordinationAdmissions.unrelated = { owner: 'ACCOUNT_2_PRODUCT' };
    write(context.root, statePath, JSON.stringify(state));
    commit(context.root, `buyer route ${mutation}`);
    const result = runGuard(context);
    if (mutation === 'accepted') assert.equal(result.status, 0, output(result));
    else {
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /BUYER_ROUTE_ADMISSION_STATE_MUTATION/u);
    }
  });
}

for (const mutation of ['edit existing route record', 'delete existing route record']) {
  test(`buyer route governance preserves accepted route record: ${mutation}`, (t) => {
    const branch = 'governance/pc-crop-inventory-reservation-scope-4997';
    const context = fixture(t, branch);
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    state.approvedConcurrentScopes[branch] = [
      statePath, 'scripts/p7-autopilot-guard.sh', 'scripts/p7-autopilot-guard.test.mjs',
      '.github/workflows/platform-v7-autopilot-guard.yml',
    ];
    state.approvedConcurrentScopes[buyerBranch] = [...buyerRoutePaths];
    state.coordinationAdmissions = {
      [buyerCoordinationKey]: { allowedPaths: [...buyerRoutePaths] },
      [buyerRouteCoordinationKey]: JSON.parse(fs.readFileSync(statePath, 'utf8')).coordinationAdmissions[buyerRouteCoordinationKey],
    };
    write(context.root, statePath, JSON.stringify(state));
    commit(context.root, 'accepted buyer route admission');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);

    if (mutation === 'edit existing route record') {
      state.coordinationAdmissions[buyerRouteCoordinationKey].purpose += ' changed';
    } else {
      delete state.coordinationAdmissions[buyerRouteCoordinationKey];
    }
    write(context.root, statePath, JSON.stringify(state));
    commit(context.root, mutation);
    const result = runGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /BUYER_ROUTE_ADMISSION_STATE_MUTATION/u);
  });
}

test('buyer route implementation stays inside the accepted shell and browser scope', (t) => {
  const context = fixture(t, buyerBranch);
  const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
  const manifestPath = buyerPaths.at(-1);
  const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
  state.approvedConcurrentScopes[buyerBranch] = [...buyerRoutePaths];
  write(context.root, statePath, JSON.stringify(state));
  commit(context.root, 'trusted buyer route scope');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);

  for (const file of buyerRouteAdditions) write(context.root, file, `accepted ${file}\n`);
  const manifest = {
    schemaVersion: 'platform-v7.concurrent-scope.v1', status: 'active', branch: buyerBranch,
    allowedPaths: [...buyerRoutePaths],
  };
  write(context.root, manifestPath, JSON.stringify(manifest));
  commit(context.root, 'buyer route implementation');
  assert.equal(runGuard(context).status, 0);

  manifest.allowedPaths.push('apps/api/src/app.module.ts');
  write(context.root, manifestPath, JSON.stringify(manifest));
  commit(context.root, 'attempt to widen buyer manifest');
  const rejected = runGuard(context);
  assert.notEqual(rejected.status, 0, output(rejected));
  assert.match(output(rejected), /PRODUCT_MANIFEST_BASE_SCOPE_MISMATCH/u);
});

test('security remediation pins the three affected dependency families', () => {
  const root = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const web = JSON.parse(fs.readFileSync('apps/web/package.json', 'utf8'));
  assert.equal(root.pnpm.overrides.multer, '2.3.0');
  assert.equal(root.pnpm.overrides.sharp, '0.35.5');
  assert.equal(web.dependencies.next, '15.5.24');
});

test('SBOM isolated pnpm commands preserve the setup-node cache store root', () => {
  const workflow = fs.readFileSync('.github/workflows/sbom-scan.yml', 'utf8');
  const commands = workflow.split('\n').filter(line => line.includes('env -i ') && /pnpm (install|dlx)/u.test(line));
  assert.equal(commands.length, 5);
  for (const command of commands) {
    assert.match(command, /env -i PATH="\$PATH" HOME="\$HOME" PNPM_HOME="\$PNPM_HOME" CI=true/u);
  }
  assert.equal((workflow.match(/cache: pnpm/gu) ?? []).length, 2);
  assert.equal((workflow.match(/install --frozen-lockfile --ignore-scripts/gu) ?? []).length, 2);
  assert.equal((workflow.match(/--validate/gu) ?? []).length, 3);
  assert.equal((workflow.match(/if-no-files-found: error/gu) ?? []).length, 2);
});


const loginRegisterLocaleBranch = 'fix/public-login-register-locale-20260928';
const loginRegisterLocaleKey = 'public-login-register-locale-20260928';
const loginRegisterLocalePaths = [
  'apps/web/app/platform-v7/login/LoginFormClient.tsx',
  'apps/web/app/platform-v7/login/page.tsx',
  'apps/web/tests/e2e/platform-v7-production-i18n-acceptance.spec.ts',
];

function loginRegisterLocaleRecord(base) {
  return {
    owner: 'ACCOUNT_2_PRODUCT',
    purpose: 'Preserve RU/EN/ZH on the existing Login to Register link and verify the real mobile click path after the exact-live locale-loss failure.',
    authorityBaseExactMain: base,
    implementationBranch: loginRegisterLocaleBranch,
    allowedPaths: [...loginRegisterLocalePaths],
    requiredTruthBoundaries: [
      'Only the three exact paths from trusted base state are admitted; candidate state, manifests and guards cannot expand implementation authority.',
      'Pass the existing getLocale/canonicalPublicLocale result from the Login server page to LoginFormClient as a bounded RU/EN/ZH presentation prop; do not add client locale hooks or providers to the lean Login entry, and keep authentication, MFA, session, redirect authority and register-page behavior unchanged.',
      'Preserve all eight public routes, EN/ZH localization, RU homepage design gates, ten viewport-locale combinations, zero pageerror, response success, Chinese typography, mobile target geometry and horizontal reflow assertions.',
      'Assert the exact localized Register href, real user navigation, resulting HTML locale and zero page errors; do not replace the click with direct navigation or weaken locale assertions.',
      'Source and local tests do not establish live acceptance; require exact-head independent review and complete CI, then exact-main release and live mobile/i18n on the deployed OCI revision.',
    ],
    forbiddenAuthority: [
      'Candidate-owned state or scope extension in the implementation PR',
      'Backend/API/DB/role/tenant/authentication/bank/provider/FGIS authority or root-layout, middleware, locale-provider, homepage and register-page changes',
      'CI/security/readiness weakening, fabricated acceptance or automatic merge',
    ],
    teamHubDependency: '#2198 locale-loss evidence 5866099139; Team Hub #5469',
  };
}

test('Login-register locale branch uses trusted base guards at both PR entry points', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const trusted = workflow.split('  trusted-immutable-scope:')[1].split('  guard:')[0];
  const prHead = workflow.split('      - name: Validate immutable scope with trusted base guard on PR head')[1]
    .split('      - name: Validate owner-authorized industrial diagnostic bootstrap candidate')[0];
  const standard = workflow.split('      - name: Validate standard branch scope on PR head')[1]
    .split('  standard_validation:')[0];
  assert.ok(trusted.includes(`github.event.pull_request.head.ref == '${loginRegisterLocaleBranch}'`));
  assert.ok(trusted.includes(`|${loginRegisterLocaleBranch}|`));
  assert.ok(trusted.includes('if [ "$HEAD_REPOSITORY" != "$GITHUB_REPOSITORY" ]; then'));
  assert.ok(prHead.includes(`github.head_ref == '${loginRegisterLocaleBranch}'`));
  assert.ok(prHead.includes(`|${loginRegisterLocaleBranch}|`));
  assert.ok(prHead.includes('git show "$BASE_SHA:scripts/p7-autopilot-guard.sh"'));
  assert.ok(standard.includes(`github.head_ref != '${loginRegisterLocaleBranch}'`));
});

for (const mutation of ['admitted three paths', 'unadmitted', 'foreign source', 'root layout', 'self-expanded state', 'self-owned manifest']) {
  test(`Login-register locale implementation scope: ${mutation}`, (t) => {
    const context = fixture(t, loginRegisterLocaleBranch);
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    if (mutation === 'unadmitted') delete state.approvedConcurrentScopes[loginRegisterLocaleBranch];
    else state.approvedConcurrentScopes[loginRegisterLocaleBranch] = [...loginRegisterLocalePaths];
    write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
    commit(context.root, 'accepted locale scope baseline');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    for (const file of loginRegisterLocalePaths) write(context.root, file, 'bounded locale repair\n');
    if (mutation === 'foreign source') write(context.root, 'apps/web/app/platform-v7/register/page.tsx', 'foreign source\n');
    if (mutation === 'root layout') write(context.root, 'apps/web/app/layout.tsx', 'unadmitted provider injection\n');
    if (mutation === 'self-expanded state') {
      state.approvedConcurrentScopes[loginRegisterLocaleBranch].push('apps/web/app/platform-v7/register/page.tsx');
      state.allowedCurrentScope.push('apps/web/**');
      write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
      write(context.root, 'apps/web/app/platform-v7/register/page.tsx', 'self-admitted source\n');
    }
    if (mutation === 'self-owned manifest') {
      write(context.root, 'docs/platform-v7/autopilot/scopes/public-login-register-locale-20260928.json', JSON.stringify({
        schemaVersion: 'platform-v7.concurrent-scope.v1', branch: loginRegisterLocaleBranch,
        status: 'active', allowedPaths: ['apps/web/**'],
      }));
    }
    commit(context.root, mutation);
    const result = runGuard(context);
    if (mutation === 'admitted three paths') assert.equal(result.status, 0, output(result));
    else {
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /no immutable approved scope|Mutable scope authority changed|Files outside current autopilot scope/u);
    }
  });
}

for (const mutation of ['accepted', 'wrong base', 'extra path', 'weakened boundary', 'prior WebKit mutation', 'prior bank mutation', 'global scope', 'foreign source', 'executable state', 'duplicate', 'partial prior admission', 'obsolete two paths', 'missing server handoff boundary', 'root layout path', 'locale config path']) {
  test(`Login-register locale state admission: ${mutation}`, (t) => {
    const context = fixture(t, productAdmissionBranch);
    const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
    const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
    state.approvedConcurrentScopes[productAdmissionBranch] = [statePath];
    state.coordinationAdmissions = {};
    for (const [branch, paths] of productAdmissionPaths) {
      state.approvedConcurrentScopes[branch] = [...paths];
      state.coordinationAdmissions[productAdmissionCoordinationKeys.get(branch)] =
        productCoordinationRecord(branch, paths, '1'.repeat(40));
    }
    state.approvedConcurrentScopes[webkitI18nBranch] = [webkitI18nTestPath];
    state.coordinationAdmissions['public-webkit-i18n-route-lifecycle-20260927'] = webkitCoordinationRecord('1'.repeat(40));
    if (mutation === 'partial prior admission') delete state.coordinationAdmissions['public-webkit-i18n-route-lifecycle-20260927'];
    if (mutation === 'duplicate') {
      state.approvedConcurrentScopes[loginRegisterLocaleBranch] = [...loginRegisterLocalePaths];
      state.coordinationAdmissions[loginRegisterLocaleKey] = loginRegisterLocaleRecord('1'.repeat(40));
    }
    write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
    commit(context.root, 'accepted original product and WebKit admissions');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    state.approvedConcurrentScopes[loginRegisterLocaleBranch] = [...loginRegisterLocalePaths];
    state.coordinationAdmissions[loginRegisterLocaleKey] = loginRegisterLocaleRecord(context.baseline);
    if (mutation === 'wrong base') state.coordinationAdmissions[loginRegisterLocaleKey].authorityBaseExactMain = '0'.repeat(40);
    if (mutation === 'obsolete two paths') {
      state.approvedConcurrentScopes[loginRegisterLocaleBranch] = loginRegisterLocalePaths.filter((file) => file !== 'apps/web/app/platform-v7/login/page.tsx');
      state.coordinationAdmissions[loginRegisterLocaleKey].allowedPaths = [...state.approvedConcurrentScopes[loginRegisterLocaleBranch]];
    }
    if (mutation === 'missing server handoff boundary') state.coordinationAdmissions[loginRegisterLocaleKey].requiredTruthBoundaries[1] = 'Use the existing next-intl locale constrained to RU/EN/ZH in the Register href; authentication, MFA, session and redirect authority and register-page behavior are unchanged.';
    for (const [caseName, forbiddenPath] of [
      ['root layout path', 'apps/web/app/layout.tsx'],
      ['locale config path', 'apps/web/i18n/request.ts'],
    ]) {
      if (mutation === caseName) {
        state.approvedConcurrentScopes[loginRegisterLocaleBranch].push(forbiddenPath);
        state.coordinationAdmissions[loginRegisterLocaleKey].allowedPaths.push(forbiddenPath);
      }
    }
    if (mutation === 'extra path') state.approvedConcurrentScopes[loginRegisterLocaleBranch].push('apps/web/app/platform-v7/register/page.tsx');
    if (mutation === 'weakened boundary') state.coordinationAdmissions[loginRegisterLocaleKey].requiredTruthBoundaries.pop();
    if (mutation === 'prior WebKit mutation') state.approvedConcurrentScopes[webkitI18nBranch].push(loginRegisterLocalePaths[0]);
    if (mutation === 'prior bank mutation') state.coordinationAdmissions[productAdmissionCoordinationKeys.get('bank/deep-visible-copy-guard-20260924')].grantProviderFinality = true;
    if (mutation === 'global scope') state.allowedCurrentScope.push('apps/web/**');
    if (mutation === 'foreign source') write(context.root, loginRegisterLocalePaths[0], 'unadmitted runtime edit\n');
    write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
    if (mutation === 'executable state') fs.chmodSync(path.join(context.root, statePath), 0o755);
    commit(context.root, `candidate locale admission ${mutation}`);
    const result = runGuard(context);
    if (mutation === 'accepted') assert.equal(result.status, 0, output(result));
    else {
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /PRODUCT_LOGIN_LOCALE_ADMISSION_|PRODUCT_WEBKIT_ADMISSION_|Files outside current autopilot scope/u);
    }
  });
}


const dealRuntimeImplementationBranch = 'ux/deal-runtime-unknown-20260929';
const dealRuntimeAdmissionBranch = 'governance/product-deal-runtime-admission-20260929';
const dealRuntimeCoordinationKey = 'deal-runtime-unknown-20260929';
const dealRuntimeRenewalKey = 'deal-runtime-binding-guard-reuse-20260929';
const dealRuntimeStatePath = 'docs/platform-v7/autopilot/autopilot-state.json';
const dealRuntimePaths = [
  'apps/web/components/transaction-ux/TransactionDealWorkspace.tsx',
  'apps/web/tests/unit/transactionDealWorkspaceRecovery.test.tsx',
  'apps/web/tests/unit/transactionUxV8Migration.test.ts',
  '.github/workflows/ci.yml',
  'docs/platform-v7/qa/web-unit-coverage-registry.json',
];
function dealRuntimeAdmissionRecord(authorityBaseExactMain) {
  return {
    owner: 'ACCOUNT_1_EXECUTION',
    purpose: 'Repair UNKNOWN command recovery in the existing production-resolved TransactionDealWorkspace and prove the same runtime binding without changing its approved design.',
    authorityBaseExactMain,
    implementationBranch: dealRuntimeImplementationBranch,
    allowedPaths: [...dealRuntimePaths],
    requiredTruthBoundaries: [
      'The trusted-base guard admits exactly the runtime component, its production-resolved behavior regression and the existing transaction-ux migration regression plus their exact CI invocation and coverage-registry wiring; candidate state cannot widen scope.',
      'Preserve the transaction-ux design, facade and tsconfig aliases; exercise the module resolved by the protected Deal route rather than the detached platform-v7 component.',
      'Lost or unverifiable command responses remain UNKNOWN with the original attempt identity, no fresh command replay and GET-only recovery; only an exact-attempt server receipt establishes a known outcome.',
      'Cover actual RU/EN/zh-CN recovery states and preserve migration binding, shell, server-owned role/auth/tenant/action authority and accessibility assertions.',
      'Require fresh exact-head author audit, independent review and all substantive CI/readiness before normal expected-SHA merge; source evidence is not REG.RU live acceptance.',
      'The existing ci.yml invocation must execute both recovery and migration regressions without losing any prior test or changing workflow behavior; the coverage registry may only remove the migration test exclusion.',
    ],
    forbiddenAuthority: [
      'Candidate state, scope, guard, unrelated workflow, alias, facade or design replacement',
      'Backend/API/DB/role/tenant/idempotency/payment/provider/FGIS authority or production/model-host mutation',
      'CI/security/readiness weakening, independent-review impersonation, forced merge or new recurring cost',
    ],
    teamHubDependency: '#5469 runtime binding dependency5887083491; migration regression5887595513; guard-purpose renewal #5721',
  };
}
function writeDealRuntimeAdmission(context, mutate = () => {}) {
  const state = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimeStatePath), 'utf8'));
  state.approvedConcurrentScopes[dealRuntimeImplementationBranch] = [...dealRuntimePaths];
  state.coordinationAdmissions[dealRuntimeCoordinationKey] = dealRuntimeAdmissionRecord(context.baseline);
  mutate(state);
  write(context.root, dealRuntimeStatePath, `${JSON.stringify(state, null, 2)}\n`);
}
function dealRuntimeFixture(t, { admitted = false, renewal = true, admission = false } = {}) {
  const context = fixture(t, admission ? dealRuntimeAdmissionBranch : dealRuntimeImplementationBranch);
  const current = JSON.parse(fs.readFileSync(dealRuntimeStatePath, 'utf8'));
  const renewalRecord = structuredClone(current.coordinationAdmissions[dealRuntimeRenewalKey]);
  assert.equal(renewalRecord.owner, 'ACCOUNT_1_EXECUTION');
  assert.deepEqual(renewalRecord.allowedPaths, [
    'scripts/p7-autopilot-guard.sh', 'scripts/p7-autopilot-guard.test.mjs', '.github/workflows/platform-v7-autopilot-guard.yml',
  ]);
  write(context.root, dealRuntimeStatePath, `${JSON.stringify({
    current: 'R1.2 unchanged fixture',
    allowedCurrentScope: ['README.md'],
    approvedConcurrentScopes: { [renewalRecord.implementationBranch]: [...renewalRecord.allowedPaths] },
    coordinationAdmissions: renewal ? { [dealRuntimeRenewalKey]: renewalRecord } : {},
  }, null, 2)}\n`);
  write(context.root, dealRuntimePaths[0], 'existing approved transaction workspace\n');
  write(context.root, dealRuntimePaths[2], 'existing binding and design assertions\n');
  write(context.root, dealRuntimePaths[3], 'name: retained CI\njobs:\n  test:\n    steps:\n      - run: pnpm --filter @pc/web exec vitest run tests/unit/retained.test.ts\n');
  write(context.root, dealRuntimePaths[4], `${JSON.stringify({ exclusions: [
    { file: dealRuntimePaths[2], status: 'failed', reason: 'Historical inventory; re-enable with bounded repair.' },
    { file: 'apps/web/tests/unit/unrelated.test.ts', reason: 'Unrelated retained coverage record.' },
  ] }, null, 2)}\n`);
  write(context.root, 'apps/web/components/transaction-ux/CanonicalDealWorkspace.tsx', 'existing production facade\n');
  write(context.root, 'apps/web/tsconfig.json', '{"compilerOptions":{"paths":{}}}\n');
  commit(context.root, 'trusted guard and bounded renewal only');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  context.admissionBase = context.baseline;
  if (admitted) {
    writeDealRuntimeAdmission(context);
    commit(context.root, 'separate exact state-only source admission');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  }
  return context;
}
function runTrustedDealRuntimeGuard(context) {
  const fetched = spawnSync('git', ['show', `${context.baseline}:scripts/p7-autopilot-guard.sh`], { cwd: context.root, encoding: 'utf8' });
  assert.equal(fetched.status, 0, output(fetched));
  const trusted = path.join(context.root, '.git', 'deal-runtime-trusted-guard.sh');
  fs.writeFileSync(trusted, fetched.stdout);
  return spawnSync('bash', [trusted], {
    cwd: context.root,
    env: { ...process.env, BASE_REF: context.baseline, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: context.implementationBranch },
    encoding: 'utf8',
  });
}
function wireDealRuntimeTests(context) {
  const ci = fs.readFileSync(path.join(context.root, dealRuntimePaths[3]), 'utf8');
  write(context.root, dealRuntimePaths[3], ci.replace('pnpm --filter @pc/web exec vitest run ',
    'pnpm --filter @pc/web exec vitest run tests/unit/transactionDealWorkspaceRecovery.test.tsx tests/unit/transactionUxV8Migration.test.ts '));
  const registry = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimePaths[4]), 'utf8'));
  registry.exclusions = registry.exclusions.filter((entry) => entry.file !== dealRuntimePaths[2]);
  write(context.root, dealRuntimePaths[4], `${JSON.stringify(registry, null, 2)}\n`);
}
function changeDealRuntime(context) {
  write(context.root, dealRuntimePaths[0], 'bounded UNKNOWN recovery candidate\n');
  commit(context.root, 'candidate runtime change');
}
function rejectDealRuntime(context, pattern = /DEAL_RUNTIME_/u) {
  const result = runTrustedDealRuntimeGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), pattern);
}

test('Deal runtime: guard renewal alone never admits implementation source', (t) => {
  const context = dealRuntimeFixture(t);
  changeDealRuntime(context);
  rejectDealRuntime(context, /DEAL_RUNTIME_ACCEPTED_ADMISSION_MISMATCH/u);
});
test('Deal runtime: exact state-only admission passes without touching runtime', (t) => {
  const context = dealRuntimeFixture(t, { admission: true });
  writeDealRuntimeAdmission(context);
  commit(context.root, 'exact state-only admission candidate');
  const result = runTrustedDealRuntimeGuard(context);
  assert.equal(result.status, 0, output(result));
  assert.equal(git(context.root, ['diff', '--name-status', `${context.baseline}...HEAD`]), `M\t${dealRuntimeStatePath}`);
});
for (const [label, mutate] of [
  ['global scope', (state) => state.allowedCurrentScope.push('apps/web/**')],
  ['R1 state', (state) => { state.current = 'unauthorized next block'; }],
  ['extra runtime path', (state) => state.approvedConcurrentScopes[dealRuntimeImplementationBranch].push('apps/web/tsconfig.json')],
  ['duplicate path', (state) => state.approvedConcurrentScopes[dealRuntimeImplementationBranch].push(dealRuntimePaths[0])],
  ['owner substitution', (state) => { state.coordinationAdmissions[dealRuntimeCoordinationKey].owner = 'ACCOUNT_2_PRODUCT'; }],
  ['wrong implementation ref', (state) => { state.coordinationAdmissions[dealRuntimeCoordinationKey].implementationBranch = dealCommandImplementationBranch; }],
  ['stale base binding', (state) => { state.coordinationAdmissions[dealRuntimeCoordinationKey].authorityBaseExactMain = '0'.repeat(40); }],
  ['weakened boundaries', (state) => { state.coordinationAdmissions[dealRuntimeCoordinationKey].requiredTruthBoundaries = []; }],
]) {
  test(`Deal runtime: state admission rejects ${label}`, (t) => {
    const context = dealRuntimeFixture(t, { admission: true });
    writeDealRuntimeAdmission(context, mutate);
    commit(context.root, `unauthorized ${label}`);
    rejectDealRuntime(context, /DEAL_RUNTIME_ADMISSION_STATE_MUTATION/u);
  });
}
for (const label of ['missing trusted renewal', 'candidate-only renewal', 'runtime alongside admission', 'executable state']) {
  test(`Deal runtime: admission rejects ${label}`, (t) => {
    const context = dealRuntimeFixture(t, { admission: true, renewal: !label.includes('renewal') });
    writeDealRuntimeAdmission(context, (state) => {
      if (label === 'candidate-only renewal') {
        state.coordinationAdmissions[dealRuntimeRenewalKey] = JSON.parse(fs.readFileSync(dealRuntimeStatePath, 'utf8')).coordinationAdmissions[dealRuntimeRenewalKey];
      }
    });
    if (label === 'runtime alongside admission') write(context.root, dealRuntimePaths[0], 'unauthorized runtime\n');
    if (label === 'executable state') fs.chmodSync(path.join(context.root, dealRuntimeStatePath), 0o755);
    commit(context.root, label);
    rejectDealRuntime(context);
  });
}
test('Deal runtime: existing admission cannot be renewed inside the one-time state route', (t) => {
  const context = dealRuntimeFixture(t, { admission: true, admitted: true });
  writeDealRuntimeAdmission(context);
  commit(context.root, 'attempted second admission');
  rejectDealRuntime(context, /DEAL_RUNTIME_ADMISSION_ALREADY_PRESENT/u);
});
test('Deal runtime: separately admitted runtime and both exact tests pass', (t) => {
  const context = dealRuntimeFixture(t, { admitted: true });
  write(context.root, dealRuntimePaths[0], 'bounded UNKNOWN recovery candidate\n');
  write(context.root, dealRuntimePaths[1], 'production-resolved behavior regression\n');
  write(context.root, dealRuntimePaths[2], 'retained design assertions with safe unknown-copy assertion\n');
  wireDealRuntimeTests(context);
  commit(context.root, 'three exact source paths and bounded CI wiring');
  const result = runTrustedDealRuntimeGuard(context);
  assert.equal(result.status, 0, output(result));
});
for (const [label, mutate] of [
  ['missing coordination', (state) => { delete state.coordinationAdmissions[dealRuntimeCoordinationKey]; }],
  ['wrong trusted owner', (state) => { state.coordinationAdmissions[dealRuntimeCoordinationKey].owner = 'other'; }],
  ['wrong trusted ref', (state) => { state.coordinationAdmissions[dealRuntimeCoordinationKey].implementationBranch = dealCommandImplementationBranch; }],
  ['broadened trusted paths', (state) => state.approvedConcurrentScopes[dealRuntimeImplementationBranch].push('apps/web/**')],
  ['missing trusted path', (state) => state.approvedConcurrentScopes[dealRuntimeImplementationBranch].pop()],
  ['unknown admission base', (state) => { state.coordinationAdmissions[dealRuntimeCoordinationKey].authorityBaseExactMain = '0'.repeat(40); }],
  ['malformed admission base', (state) => { state.coordinationAdmissions[dealRuntimeCoordinationKey].authorityBaseExactMain += ' '; }],
]) {
  test(`Deal runtime: implementation rejects ${label}`, (t) => {
    const context = dealRuntimeFixture(t, { admitted: true });
    const state = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimeStatePath), 'utf8'));
    mutate(state);
    write(context.root, dealRuntimeStatePath, `${JSON.stringify(state, null, 2)}\n`);
    commit(context.root, `invalid trusted fixture ${label}`);
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    changeDealRuntime(context);
    rejectDealRuntime(context);
  });
}
for (const file of [
  'apps/web/tsconfig.json',
  'apps/web/components/transaction-ux/CanonicalDealWorkspace.tsx',
  'apps/web/components/platform-v7/CanonicalDealWorkspace.tsx',
  'apps/api/src/app.module.ts',
  'scripts/p7-autopilot-guard.sh',
  '.github/workflows/platform-v7-autopilot-guard.yml',
  'docs/platform-v7/autopilot/scopes/deal-runtime.json',
]) {
  test(`Deal runtime: trusted guard rejects candidate edit to ${file}`, (t) => {
    const context = dealRuntimeFixture(t, { admitted: true });
    write(context.root, file, file.endsWith('.sh') ? '#!/usr/bin/env bash\nexit 0\n' : 'unadmitted candidate change\n');
    changeDealRuntime(context);
    rejectDealRuntime(context, /DEAL_RUNTIME_IMPLEMENTATION_DIFF_SCOPE/u);
  });
}
test('Deal runtime: candidate cannot rewrite its own admission or even reformat state', (t) => {
  const context = dealRuntimeFixture(t, { admitted: true });
  fs.appendFileSync(path.join(context.root, dealRuntimeStatePath), '\n');
  changeDealRuntime(context);
  rejectDealRuntime(context, /DEAL_RUNTIME_IMPLEMENTATION_STATE_MUTATION/u);
});
for (const kind of ['chmod', 'symlink', 'delete', 'rename']) {
  test(`Deal runtime: implementation rejects ${kind} of the production component`, (t) => {
    const context = dealRuntimeFixture(t, { admitted: true });
    const file = path.join(context.root, dealRuntimePaths[0]);
    if (kind === 'chmod') fs.chmodSync(file, 0o755);
    if (kind === 'delete') fs.unlinkSync(file);
    if (kind === 'symlink') { fs.unlinkSync(file); fs.symlinkSync('../../../../README.md', file); }
    if (kind === 'rename') fs.renameSync(file, `${file}.other`);
    commit(context.root, `candidate ${kind}`);
    rejectDealRuntime(context);
  });
}
test('Deal runtime: an unrelated current base cannot authorize a stale source branch', (t) => {
  const context = dealRuntimeFixture(t, { admitted: true });
  changeDealRuntime(context);
  context.baseline = git(context.root, ['commit-tree', `${context.baseline}^{tree}`, '-p', context.admissionBase, '-m', 'different current-base history']);
  rejectDealRuntime(context, /DEAL_RUNTIME_BASE_NOT_ANCESTOR/u);
});
test('Deal runtime: both workflow entry points use the trusted base for both exact new refs', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  for (const branch of [dealRuntimeImplementationBranch, dealRuntimeAdmissionBranch]) {
    assert.ok(workflow.includes(`github.event.pull_request.head.ref == '${branch}'`));
    assert.equal(workflow.split(`github.head_ref == '${branch}'`).length - 1, 2);
    assert.equal(workflow.split(`github.head_ref != '${branch}'`).length - 1, 1);
    assert.equal(workflow.split(`|${branch}|`).length - 1, 2);
  }
  const trusted = workflow.slice(workflow.indexOf('  trusted-immutable-scope:'), workflow.indexOf('\n  guard:'));
  assert.match(trusted, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/u);
  assert.match(trusted, /HEAD_REPOSITORY.*GITHUB_REPOSITORY/u);
  assert.ok(workflow.includes('git show "$BASE_SHA:scripts/p7-autopilot-guard.sh" > "$TRUSTED_GUARD"'));
});


for (const mutation of [
  'missing recovery test', 'lost old test', 'missing migration argument', 'ignored failure',
  'unrelated workflow change', 'new recovery exclusion', 'retained migration exclusion', 'unrelated registry change',
  'executable workflow', 'executable registry',
]) {
  test(`Deal runtime CI: rejects ${mutation}`, (t) => {
    const context = dealRuntimeFixture(t, { admitted: true });
    write(context.root, dealRuntimePaths[0], 'bounded UNKNOWN recovery candidate\n');
    write(context.root, dealRuntimePaths[1], 'production-resolved behavior regression\n');
    write(context.root, dealRuntimePaths[2], 'retained migration assertions and recovery contract\n');
    wireDealRuntimeTests(context);
    const ciPath = path.join(context.root, dealRuntimePaths[3]);
    const registryPath = path.join(context.root, dealRuntimePaths[4]);
    let ci = fs.readFileSync(ciPath, 'utf8');
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    if (mutation === 'missing recovery test') fs.unlinkSync(path.join(context.root, dealRuntimePaths[1]));
    if (mutation === 'lost old test') ci = ci.replace(' tests/unit/retained.test.ts', '');
    if (mutation === 'missing migration argument') ci = ci.replace('tests/unit/transactionUxV8Migration.test.ts ', '');
    if (mutation === 'ignored failure') ci = ci.replace('tests/unit/retained.test.ts', 'tests/unit/retained.test.ts || true');
    if (mutation === 'unrelated workflow change') ci = ci.replace('name: retained CI', 'name: unapproved change');
    if (mutation === 'new recovery exclusion') registry.exclusions.push({ file: dealRuntimePaths[1], reason: 'Never exclude the new required recovery regression.' });
    if (mutation === 'retained migration exclusion') registry.exclusions.push({ file: dealRuntimePaths[2], reason: 'The old required migration regression must run.' });
    if (mutation === 'unrelated registry change') registry.exclusions[0].reason = 'Candidate changed an unrelated exclusion record.';
    fs.writeFileSync(ciPath, ci);
    fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
    if (mutation === 'executable workflow') fs.chmodSync(ciPath, 0o755);
    if (mutation === 'executable registry') fs.chmodSync(registryPath, 0o755);
    commit(context.root, `rejected CI wiring ${mutation}`);
    const expectedError = mutation.startsWith('executable ')
      ? /DEAL_RUNTIME_IMPLEMENTATION_FILE_MODE/u
      : mutation.includes('exclusion') || mutation === 'unrelated registry change'
        ? /DEAL_RUNTIME_CI_REGISTRY_MUTATION/u
        : /DEAL_RUNTIME_CI_WIRING_MISMATCH/u;
    rejectDealRuntime(context, expectedError);
  });
}

test('Deal runtime CI: old three-path state cannot self-authorize the five-path delivery', (t) => {
  const context = dealRuntimeFixture(t, { admission: true });
  writeDealRuntimeAdmission(context, (state) => {
    state.approvedConcurrentScopes[dealRuntimeImplementationBranch] = dealRuntimePaths.slice(0, 3);
    state.coordinationAdmissions[dealRuntimeCoordinationKey].allowedPaths = dealRuntimePaths.slice(0, 3);
  });
  commit(context.root, 'incomplete three-path admission');
  rejectDealRuntime(context, /DEAL_RUNTIME_ADMISSION_STATE_MUTATION/u);
});


test('Deal runtime CI: later source correction preserves already accepted CI wiring', (t) => {
  const context = dealRuntimeFixture(t, { admitted: true });
  write(context.root, dealRuntimePaths[1], 'accepted behavior regression\n');
  wireDealRuntimeTests(context);
  commit(context.root, 'accepted runtime regression and exact CI wiring');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  changeDealRuntime(context);
  const result = runTrustedDealRuntimeGuard(context);
  assert.equal(result.status, 0, output(result));
});


const dealRuntimeGeneratedPaths = ['docs/security/cryptographic-inventory.json', 'docs/security/CRYPTOGRAPHIC_INVENTORY.md'];
const dealRuntimeGeneratorPath = 'scripts/security/discover-cryptography.mjs';
function generateDealRuntimeInventory(context, sourceSha) {
  const result = spawnSync(process.execPath, [dealRuntimeGeneratorPath], {
    cwd: context.root, encoding: 'utf8', env: { ...process.env, SOURCE_SHA: sourceSha },
  });
  assert.equal(result.status, 0, output(result));
}
function generatedDealRuntimeFixture(t) {
  const context = dealRuntimeFixture(t, { admitted: true });
  write(context.root, dealRuntimeGeneratorPath, fs.readFileSync(dealRuntimeGeneratorPath, 'utf8'));
  write(context.root, dealRuntimePaths[1], 'existing production-resolved test\n');
  write(context.root, 'apps/web/middleware.ts', 'export const stable = true;\n');
  fs.mkdirSync(path.join(context.root, 'apps/web/apps/web'), { recursive: true });
  fs.symlinkSync('../../middleware.ts', path.join(context.root, 'apps/web/apps/web/middleware.ts'));
  wireDealRuntimeTests(context);
  commit(context.root, 'trusted generator and existing regression wiring');
  generateDealRuntimeInventory(context, git(context.root, ['rev-parse', 'HEAD']));
  commit(context.root, 'trusted generated inventory baseline');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  return context;
}
function changeAndGenerateDealRuntime(context) {
  write(context.root, dealRuntimePaths[0],
    'export const generate = () => globalThis.crypto.randomUUID();\n' +
    "export const fingerprint = bytes => crypto.subtle.digest('SHA-256', bytes);\n");
  commit(context.root, 'admitted runtime changes cryptographic usage');
  context.inventorySource = git(context.root, ['rev-parse', 'HEAD']);
  generateDealRuntimeInventory(context, context.inventorySource);
  commit(context.root, 'exact generated inventory pair');
}
test('Deal inventory: exact trusted generation follows the changed admitted runtime', (t) => {
  const context = generatedDealRuntimeFixture(t);
  changeAndGenerateDealRuntime(context);
  const result = runTrustedDealRuntimeGuard(context);
  assert.equal(result.status, 0, output(result));
});
test('Deal inventory: committed blobs, not dirty worktree source or generator, determine evidence', (t) => {
  const context = generatedDealRuntimeFixture(t);
  changeAndGenerateDealRuntime(context);
  write(context.root, dealRuntimePaths[0], 'uncommitted decoy source\n');
  const marker = path.join(context.root, 'untrusted-generator-executed');
  write(context.root, dealRuntimeGeneratorPath, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'unsafe');\n`);
  const result = runTrustedDealRuntimeGuard(context);
  assert.equal(result.status, 0, output(result));
  assert.equal(fs.existsSync(marker), false);
});
for (const [label, mutate] of [
  ['edited JSON', (context) => {
    const file = path.join(context.root, dealRuntimeGeneratedPaths[0]);
    const json = JSON.parse(fs.readFileSync(file, 'utf8')); json.scannedFiles += 1;
    fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  }],
  ['edited Markdown', (context) => fs.appendFileSync(path.join(context.root, dealRuntimeGeneratedPaths[1]), 'untrusted claim\n')],
  ['stale source attribution', (context) => {
    const file = path.join(context.root, dealRuntimeGeneratedPaths[1]);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(context.inventorySource, context.baseline));
  }],
  ['unknown source attribution', (context) => {
    const file = path.join(context.root, dealRuntimeGeneratedPaths[1]);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(context.inventorySource, '0'.repeat(40)));
  }],
  ['malformed source attribution', (context) => {
    const file = path.join(context.root, dealRuntimeGeneratedPaths[1]);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(context.inventorySource, 'unverified'));
  }],
  ['stale JSON with fresh Markdown', (context) => {
    write(context.root, dealRuntimeGeneratedPaths[0], git(context.root, ['show', `${context.baseline}:${dealRuntimeGeneratedPaths[0]}`]) + '\n');
  }],
]) {
  test(`Deal inventory: rejects ${label}`, (t) => {
    const context = generatedDealRuntimeFixture(t);
    changeAndGenerateDealRuntime(context); mutate(context);
    commit(context.root, `invalid ${label}`);
    rejectDealRuntime(context, /DEAL_RUNTIME_GENERATED_/u);
  });
}
for (const file of dealRuntimeGeneratedPaths) {
  for (const kind of ['chmod', 'symlink', 'delete', 'rename']) {
    test(`Deal inventory: rejects ${kind} of ${file}`, (t) => {
      const context = generatedDealRuntimeFixture(t); changeAndGenerateDealRuntime(context);
      const target = path.join(context.root, file);
      if (kind === 'chmod') fs.chmodSync(target, 0o755);
      if (kind === 'symlink') { fs.unlinkSync(target); fs.symlinkSync('../../README.md', target); }
      if (kind === 'delete') fs.unlinkSync(target);
      if (kind === 'rename') fs.renameSync(target, `${target}.other`);
      commit(context.root, `invalid ${kind}`); rejectDealRuntime(context);
    });
  }
}
test('Deal inventory: artifacts alone do not grant an independent documentation write', (t) => {
  const context = generatedDealRuntimeFixture(t);
  generateDealRuntimeInventory(context, context.baseline);
  fs.appendFileSync(path.join(context.root, dealRuntimeGeneratedPaths[0]), '\n');
  commit(context.root, 'artifacts without runtime');
  rejectDealRuntime(context, /DEAL_RUNTIME_GENERATED_PAIR_REQUIRES_RUNTIME/u);
});
test('Deal inventory: the pair cannot accompany a test-only change', (t) => {
  const context = generatedDealRuntimeFixture(t);
  fs.appendFileSync(path.join(context.root, dealRuntimePaths[1]), 'additional test\n');
  commit(context.root, 'only tests changed');
  generateDealRuntimeInventory(context, git(context.root, ['rev-parse', 'HEAD']));
  fs.appendFileSync(path.join(context.root, dealRuntimeGeneratedPaths[0]), '\n');
  commit(context.root, 'pair without runtime change');
  rejectDealRuntime(context, /DEAL_RUNTIME_GENERATED_PAIR_REQUIRES_RUNTIME/u);
});
test('Deal inventory: candidate generator replacement is never executed or admitted', (t) => {
  const context = generatedDealRuntimeFixture(t); changeAndGenerateDealRuntime(context);
  const marker = path.join(context.root, 'candidate-generator-executed');
  write(context.root, dealRuntimeGeneratorPath, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'unsafe');\n`);
  commit(context.root, 'attempted candidate generator replacement');
  rejectDealRuntime(context, /DEAL_RUNTIME_IMPLEMENTATION_DIFF_SCOPE/u);
  assert.equal(fs.existsSync(marker), false);
});
test('Deal inventory: unrelated documentation remains outside the exact generated pair', (t) => {
  const context = generatedDealRuntimeFixture(t); changeAndGenerateDealRuntime(context);
  write(context.root, 'docs/security/unrelated.md', 'unadmitted\n');
  commit(context.root, 'unrelated documentation');
  rejectDealRuntime(context, /DEAL_RUNTIME_IMPLEMENTATION_DIFF_SCOPE/u);
});
test('Deal inventory: a dirty correct JSON cannot rescue incorrect committed evidence', (t) => {
  const context = generatedDealRuntimeFixture(t); changeAndGenerateDealRuntime(context);
  const target = path.join(context.root, dealRuntimeGeneratedPaths[0]);
  const correct = fs.readFileSync(target, 'utf8');
  fs.writeFileSync(target, '{}\n'); commit(context.root, 'incorrect committed inventory');
  fs.writeFileSync(target, correct);
  rejectDealRuntime(context, /DEAL_RUNTIME_GENERATED_OUTPUT_MISMATCH/u);
});

test('Deal inventory: inherited compatibility alias is not resolved against the host filesystem', (t) => {
  const context = generatedDealRuntimeFixture(t); changeAndGenerateDealRuntime(context);
  fs.unlinkSync(path.join(context.root, 'apps/web/apps/web/middleware.ts'));
  fs.symlinkSync('/etc/passwd', path.join(context.root, 'apps/web/apps/web/middleware.ts'));
  const result = runTrustedDealRuntimeGuard(context);
  assert.equal(result.status, 0, output(result));
});
test('Deal inventory: a committed retarget of the compatibility alias is rejected', (t) => {
  const context = generatedDealRuntimeFixture(t); changeAndGenerateDealRuntime(context);
  fs.unlinkSync(path.join(context.root, 'apps/web/apps/web/middleware.ts'));
  fs.symlinkSync('/etc/passwd', path.join(context.root, 'apps/web/apps/web/middleware.ts'));
  commit(context.root, 'forbidden alias retarget');
  rejectDealRuntime(context, /DEAL_RUNTIME_IMPLEMENTATION_DIFF_SCOPE/u);
});


// Real Git fixtures execute the immutable BASE guard, never candidate code.
const landingMetadataAdmissionBranch = 'governance/pc-crop-post-registration-progress-scope-4997';
const landingMetadataStatePath = 'docs/platform-v7/autopilot/autopilot-state.json';
const landingMetadataPurposeKey = 'landing-package-metadata-guard-purpose-20261001';
const landingMetadataKey = 'landing-package-metadata-20261001';
const landingMetadataPurpose = {
  "owner": "ACCOUNT_2_PRODUCT",
  "purpose": "Bounded critical-path renewal of the existing trusted three-path guard ref for a separately admitted exact metadata-only repair of the expired internal landing-package exception; close the existing no-publish metadata blocker without renewing its expiry or changing application/licensing/provenance truth.",
  "authorityBaseExactMain": "7a90199a40a86cdc129f804780a8f2635cf0bccb",
  "implementationBranch": "governance/pc-crop-post-registration-progress-scope-4997",
  "allowedPaths": [
    "scripts/p7-autopilot-guard.sh",
    "scripts/p7-autopilot-guard.test.mjs",
    ".github/workflows/platform-v7-autopilot-guard.yml"
  ],
  "futureMetadataAdmissionBranch": "governance/pc-crop-post-registration-progress-scope-4997",
  "futureMetadataImplementationBranch": "fix/gitleaks-release-authority-attestation-20260912",
  "requiredTruthBoundaries": [
    "The current full-head #5744 native SBOM/IP run36794727081/job110155435088 fails because the preexisting apps/landing/package.json metadata exception expired on2026-09-30. Original IP program#4459 and the existing exception require a separately authorized metadata-only addition of license=UNLICENSED; the package already remains private=true.",
    "This purpose-only prerequisite admits no landing implementation or metadata file and changes no primary/global/R1.2/approvedConcurrentScopes/old admissions/progress. Publish a separate trusted guard repair within the already accepted three-path scope only after actual independent review, all current gates and ordinary expected-full-SHA acceptance of this purpose.",
    "The later guard must define distinct state-only admission and exact two-file metadata implementation phases on the already registered trusted-guard and Gitleaks refs. Existing native trusted-base routing remains unchanged; no workflow/IP waiver. Preserve the original one-file Gitleaks attestation phase and add only the separately accepted exact metadata pair to that existing branch scope. Source scope and exact baseline/candidate blobs must come from accepted trusted base; candidate-owned state/guard cannot grant authority.",
    "Permit only apps/landing/package.json100644 c80706ce0a424d57b2f7687bc0f4306f5c88a434→e693a061ea6d42a9c62cc1ab8350c3af904265a4 (one license field, all scripts/dependencies/private/name/other bytes preserved) and docs/ip/internal-package-metadata-exceptions.json100644872689ef5215d2b92429c465159fbf794259cc9f→c3eb22c2f4fc9ec3105e0203b7990de3b88dc345 (remove only that completed exception; schema/effective date preserved).",
    "Preserve the general apps/landing prohibition and every old security/attestation gate. Permit the exact metadata pair only in its separately accepted phase on the existing trusted Gitleaks ref, with exact baseline/head blobs and regular modes; reject mixed metadata/test/runtime edits, other manifest fields, expiry extension, stale or altered exceptions, source self-expansion and baseline/mode drift using real Git fixtures.",
    "Accept the guard before the separate state-only exact-content source admission; accept that admission before publishing either metadata file. Metadata/private-package checks do not prove proprietary authorship, third-party rights, human assignments, full IP/security completion or production acceptance.",
    "Keep the sole BANK continuation220/workspace0b9 window held. Preserve the immutable #5744 test candidate while the distinct metadata prerequisite uses the same existing trusted source ref under separate source admission and fresh PR review. After accepted metadata normalization, restore the original one-file #5744 repair on actual current main and renew every review/CI/readiness result before bounded exact-current-main canonical REG.RU web release and actual OCI/live/downstream evidence."
  ],
  "forbiddenAuthority": [
    "Landing page/runtime/component/script/dependency changes or general landing access",
    "Exception expiry extension, CI/security/license/scanner weakening or required-check override",
    "Direct metadata source admission in this purpose or later guard PR; source-owned mutable scope authority",
    "CORE/API/DB/provider/money/role/session/model or human legal/provenance authority",
    "Forced/automatic merge, stale review transfer, new recurring costs or false production/whole-block PASS"
  ],
  "teamHubDependency": "#5744 native IP metadata expiry blocker36794727081; original#4459 metadata baseline; held BANK critical path/window5916270228"
};
const landingMetadataTemplate = {
  "owner": "ACCOUNT_2_PRODUCT",
  "purpose": "Normalize only the already-private internal landing package license metadata and remove its completed exception; no application, dependency, publication or legal-rights change.",
  "implementationBranch": "fix/gitleaks-release-authority-attestation-20260912",
  "allowedPaths": [
    "apps/landing/package.json",
    "docs/ip/internal-package-metadata-exceptions.json"
  ],
  "preservedAttestationPaths": [
    "apps/tai/tests/test_gitleaks_release_authority.py"
  ],
  "exactMetadataFiles": [
    {
      "path": "apps/landing/package.json",
      "mode": "100644",
      "baselineBlob": "c80706ce0a424d57b2f7687bc0f4306f5c88a434",
      "candidateBlob": "e693a061ea6d42a9c62cc1ab8350c3af904265a4"
    },
    {
      "path": "docs/ip/internal-package-metadata-exceptions.json",
      "mode": "100644",
      "baselineBlob": "872689ef5215d2b92429c465159fbf794259cc9f",
      "candidateBlob": "c3eb22c2f4fc9ec3105e0203b7990de3b88dc345"
    }
  ],
  "requiredTruthBoundaries": [
    "Only add license=UNLICENSED to the existing private=true manifest and remove exactly its completed metadata exception; every other manifest byte and register schema/effective date remains unchanged.",
    "Source authority comes only from separately accepted base purpose, guard and state-only admission. The implementation cannot modify state, guard, workflow, scope or publishable-package authority.",
    "The existing attestation ref has distinct test-only and metadata-only phases. Preserve the original test path and its exact fingerprint guard; reject mixed metadata/test changes.",
    "Preserve the general landing prohibition, all existing CI/security/attestation checks, provenance and third-party/human legal remainder. No expiry extension or proprietary ownership claim.",
    "Fresh whole-head independent review, native private-package/IP/security/source checks and manual full-expected-SHA readiness/merge required; current-main REG.RU release remains a separate acceptance."
  ],
  "forbiddenAuthority": [
    "Landing runtime/pages/components/scripts/dependencies or any other manifest field",
    "Expired-exception renewal, new exception or publishable-package authorization",
    "Source-owned scope, CI/security/readiness weakening, forced/automatic merge",
    "CORE/API/DB/money/provider/role/session/model or human legal/provenance authority"
  ],
  "teamHubDependency": "#5744 IP expiry blocker36794727081; original IP#4459; BANK hold5916270228; purpose#5749"
};
const landingMetadataFiles = [
  {
    "path": "apps/landing/package.json",
    "mode": "100644",
    "baselineBlob": "c80706ce0a424d57b2f7687bc0f4306f5c88a434",
    "candidateBlob": "e693a061ea6d42a9c62cc1ab8350c3af904265a4",
    "baselineContent": "{\n  \"name\": \"@pc/landing\",\n  \"private\": true,\n  \"scripts\": {\n    \"dev\": \"next dev -p 3001\",\n    \"build\": \"next build\",\n    \"start\": \"next start -p 3001\"\n  },\n  \"dependencies\": {\n    \"next\": \"14.2.35\",\n    \"react\": \"18.3.1\",\n    \"react-dom\": \"18.3.1\",\n    \"lucide-react\": \"0.460.0\",\n    \"clsx\": \"2.1.1\"\n  },\n  \"devDependencies\": {\n    \"@types/node\": \"22.8.1\",\n    \"@types/react\": \"18.3.3\",\n    \"@types/react-dom\": \"18.3.0\",\n    \"autoprefixer\": \"10.4.18\",\n    \"postcss\": \"8.4.35\",\n    \"tailwindcss\": \"3.4.1\",\n    \"typescript\": \"5.6.3\"\n  }\n}\n",
    "content": "{\n  \"name\": \"@pc/landing\",\n  \"private\": true,\n  \"license\": \"UNLICENSED\",\n  \"scripts\": {\n    \"dev\": \"next dev -p 3001\",\n    \"build\": \"next build\",\n    \"start\": \"next start -p 3001\"\n  },\n  \"dependencies\": {\n    \"next\": \"14.2.35\",\n    \"react\": \"18.3.1\",\n    \"react-dom\": \"18.3.1\",\n    \"lucide-react\": \"0.460.0\",\n    \"clsx\": \"2.1.1\"\n  },\n  \"devDependencies\": {\n    \"@types/node\": \"22.8.1\",\n    \"@types/react\": \"18.3.3\",\n    \"@types/react-dom\": \"18.3.0\",\n    \"autoprefixer\": \"10.4.18\",\n    \"postcss\": \"8.4.35\",\n    \"tailwindcss\": \"3.4.1\",\n    \"typescript\": \"5.6.3\"\n  }\n}\n"
  },
  {
    "path": "docs/ip/internal-package-metadata-exceptions.json",
    "mode": "100644",
    "baselineBlob": "872689ef5215d2b92429c465159fbf794259cc9f",
    "candidateBlob": "c3eb22c2f4fc9ec3105e0203b7990de3b88dc345",
    "baselineContent": "{\n  \"schemaVersion\": 1,\n  \"effectiveDate\": \"2026-08-21\",\n  \"exceptions\": [\n    {\n      \"path\": \"apps/landing/package.json\",\n      \"name\": \"@pc/landing\",\n      \"status\": \"OPEN_BLOCKER\",\n      \"requirePrivate\": true,\n      \"missingField\": \"license=UNLICENSED\",\n      \"reason\": \"AGENTS.md forbids changes under apps/landing in this bounded slice. The manifest remains non-publishable through private=true, but final IP status is blocked until a separately authorized metadata-only change adds license=UNLICENSED.\",\n      \"authority\": \"https://github.com/pachaninm-lab/pachanin-demo/issues/4459\",\n      \"expiresOn\": \"2026-09-30\"\n    }\n  ]\n}\n",
    "content": "{\n  \"schemaVersion\": 1,\n  \"effectiveDate\": \"2026-08-21\",\n  \"exceptions\": []\n}\n"
  }
];
const landingMetadataPaths = landingMetadataTemplate.allowedPaths;

function landingAdmission(origin) {
  return { ...structuredClone(landingMetadataTemplate), authorityBaseExactMain: origin };
}
function expectedAttestationScope(state) {
  const admission = state.coordinationAdmissions?.[landingMetadataKey];
  if (!admission) return [gitleaksReleaseAttestationPath];
  assert.match(admission.authorityBaseExactMain, /^[0-9a-f]{40}$/u);
  assert.deepEqual(admission, landingAdmission(admission.authorityBaseExactMain));
  assert.deepEqual(state.coordinationAdmissions[landingMetadataPurposeKey], landingMetadataPurpose);
  return [gitleaksReleaseAttestationPath, ...landingMetadataPaths];
}
function landingMetadataFixture(t, implementation = false) {
  const context = currentGitleaksReleaseAttestationFixture(t);
  if (!implementation) {
    git(context.root, ['switch', '-c', landingMetadataAdmissionBranch]);
    context.implementationBranch = landingMetadataAdmissionBranch;
  }
  const state = JSON.parse(fs.readFileSync(path.join(context.root, landingMetadataStatePath), 'utf8'));
  state.approvedConcurrentScopes[landingMetadataAdmissionBranch] = [...landingMetadataPurpose.allowedPaths];
  state.coordinationAdmissions = {
    retainedOwnerRecord: { owner: 'ORIGINAL_OWNER', purpose: 'unchanged existing authority' },
    [landingMetadataPurposeKey]: structuredClone(landingMetadataPurpose),
  };
  state.current = 'R1.2';
  state.fullTzReadinessPercent = 5;
  write(context.root, landingMetadataStatePath, `${JSON.stringify(state, null, 2)}\n`);
  for (const file of landingMetadataFiles) write(context.root, file.path, file.baselineContent);
  commit(context.root, 'accepted purpose and exact original package metadata');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  context.admissionOrigin = context.baseline;
  for (const file of landingMetadataFiles) assert.equal(git(context.root, ['rev-parse', `${context.baseline}:${file.path}`]), file.baselineBlob);
  if (implementation) {
    writeLandingAdmission(context);
    commit(context.root, 'separately accepted state-only exact metadata admission');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  }
  return context;
}
function writeLandingAdmission(context, mutate = () => {}) {
  const state = JSON.parse(git(context.root, ['show', `${context.baseline}:${landingMetadataStatePath}`]));
  state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch] = [gitleaksReleaseAttestationPath, ...landingMetadataPaths];
  state.coordinationAdmissions[landingMetadataKey] = landingAdmission(context.admissionOrigin);
  mutate(state);
  write(context.root, landingMetadataStatePath, `${JSON.stringify(state, null, 2)}\n`);
}
function changeLandingPair(context) {
  for (const file of landingMetadataFiles) write(context.root, file.path, file.content);
}
function rejectLandingMetadata(context, pattern = /LANDING_METADATA|Mutable scope authority|Forbidden path|Files outside current autopilot scope/u) {
  const result = runTrustedCurrentGitleaksGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), pattern);
}
function amendLandingBaseline(context, mutate) {
  mutate(); commit(context.root, 'changed immutable fixture baseline');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
}

test('landing metadata: native trusted-base routing already covers both existing refs', () => {
  const state = JSON.parse(fs.readFileSync(landingMetadataStatePath, 'utf8'));
  assert.deepEqual(state.coordinationAdmissions[landingMetadataPurposeKey], landingMetadataPurpose);
  assert.deepEqual(state.approvedConcurrentScopes[landingMetadataAdmissionBranch], landingMetadataPurpose.allowedPaths);
  assert.deepEqual(state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch], expectedAttestationScope(state));
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  for (const branch of [landingMetadataAdmissionBranch, gitleaksReleaseAttestationBranch]) {
    assert.ok(workflow.includes(`github.event.pull_request.head.ref == '${branch}'`));
  }
  assert.ok(workflow.includes('BASE_REF="$BASE_SHA" HEAD_REF="$HEAD_SHA" GITHUB_HEAD_REF="$IMMUTABLE_SCOPE_BRANCH"'));
});
test('landing metadata: state-only admission preserves the original attestation path and all old authority', (t) => {
  const context = landingMetadataFixture(t);
  writeLandingAdmission(context); commit(context.root, 'exact state-only admission');
  const result = runTrustedCurrentGitleaksGuard(context);
  assert.equal(result.status, 0, output(result));
});
test('landing metadata: exact two-file metadata phase passes only from accepted state', (t) => {
  const context = landingMetadataFixture(t, true);
  changeLandingPair(context); commit(context.root, 'only exact package normalization');
  const result = runTrustedCurrentGitleaksGuard(context);
  assert.equal(result.status, 0, output(result));
});
test('landing metadata: original attestation-only phase still passes after metadata acceptance', (t) => {
  const context = landingMetadataFixture(t, true);
  changeLandingPair(context); commit(context.root, 'accepted metadata pair');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  const source = fs.readFileSync(path.join(context.root, gitleaksReleaseAttestationPath), 'utf8');
  write(context.root, gitleaksReleaseAttestationPath, synchronizeCurrentGitleaksReleaseAttestation(source));
  commit(context.root, 'original exact two-fingerprint repair only');
  const result = runTrustedCurrentGitleaksGuard(context);
  assert.equal(result.status, 0, output(result));
});
for (const [name, mutate] of [
  ['missing metadata record', state => { delete state.coordinationAdmissions[landingMetadataKey]; }],
  ['wrong exact origin', state => { state.coordinationAdmissions[landingMetadataKey].authorityBaseExactMain = 'a'.repeat(40); }],
  ['source owner changed', state => { state.coordinationAdmissions[landingMetadataKey].owner = 'OTHER'; }],
  ['original attestation path removed', state => { state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch].shift(); }],
  ['metadata scope widened', state => { state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch].push('apps/landing/**'); }],
  ['candidate blob changed', state => { state.coordinationAdmissions[landingMetadataKey].exactMetadataFiles[0].candidateBlob = 'b'.repeat(40); }],
  ['old owner record changed', state => { state.coordinationAdmissions.retainedOwnerRecord.owner = 'OTHER'; }],
  ['global current scope expanded', state => { state.allowedCurrentScope.push('apps/landing/**'); }],
  ['official progress changed', state => { state.fullTzReadinessPercent = 100; }],
  ['guard self-scope expanded', state => { state.approvedConcurrentScopes[landingMetadataAdmissionBranch].push(landingMetadataStatePath); }],
  ['purpose weakened in candidate', state => { state.coordinationAdmissions[landingMetadataPurposeKey].forbiddenAuthority = []; }],
]) {
  test(`landing metadata admission rejects ${name}`, (t) => {
    const context = landingMetadataFixture(t);
    writeLandingAdmission(context, mutate); commit(context.root, name);
    rejectLandingMetadata(context, /LANDING_METADATA_ADMISSION_STATE_MUTATION/u);
  });
}
for (const file of ['README.md', 'scripts/p7-autopilot-guard.sh', ...landingMetadataPaths]) {
  test(`landing metadata admission rejects mixed source ${file}`, (t) => {
    const context = landingMetadataFixture(t); writeLandingAdmission(context);
    const old = fs.readFileSync(path.join(context.root, file), 'utf8');
    write(context.root, file, old + '\n'); commit(context.root, 'mixed admission/source');
    rejectLandingMetadata(context, /LANDING_METADATA_ADMISSION_DIFF_SCOPE/u);
  });
}
for (const [name, mutate] of [
  ['missing trusted purpose', state => { delete state.coordinationAdmissions[landingMetadataPurposeKey]; }],
  ['altered trusted purpose', state => { state.coordinationAdmissions[landingMetadataPurposeKey].owner = 'OTHER'; }],
  ['guard scope widened in base', state => { state.approvedConcurrentScopes[landingMetadataAdmissionBranch].push('README.md'); }],
  ['original attestation scope widened', state => { state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch].push('README.md'); }],
  ['admission already present', state => { state.coordinationAdmissions[landingMetadataKey] = landingAdmission('a'.repeat(40)); }],
]) {
  test(`landing metadata admission rejects ${name}`, (t) => {
    const context = landingMetadataFixture(t);
    amendLandingBaseline(context, () => {
      const state = JSON.parse(fs.readFileSync(path.join(context.root, landingMetadataStatePath), 'utf8'));
      mutate(state); write(context.root, landingMetadataStatePath, `${JSON.stringify(state, null, 2)}\n`);
    });
    context.admissionOrigin = context.baseline;
    writeLandingAdmission(context); commit(context.root, 'attempt admission');
    rejectLandingMetadata(context);
  });
}
test('landing metadata admission rejects executable state', (t) => {
  const context = landingMetadataFixture(t); writeLandingAdmission(context);
  fs.chmodSync(path.join(context.root, landingMetadataStatePath), 0o755);
  commit(context.root, 'executable state'); rejectLandingMetadata(context, /LANDING_METADATA_STATE_FILE_MODE/u);
});
test('landing metadata admission rejects state reformatting', (t) => {
  const context = landingMetadataFixture(t); writeLandingAdmission(context);
  const state = JSON.parse(fs.readFileSync(path.join(context.root, landingMetadataStatePath), 'utf8'));
  write(context.root, landingMetadataStatePath, JSON.stringify(state));
  commit(context.root, 'state reformatting'); rejectLandingMetadata(context, /LANDING_METADATA_ADMISSION_STATE_MUTATION/u);
});
for (const [name, mutate] of [
  ['missing accepted admission', state => { delete state.coordinationAdmissions[landingMetadataKey]; }],
  ['altered accepted metadata pins', state => { state.coordinationAdmissions[landingMetadataKey].exactMetadataFiles[0].candidateBlob = 'b'.repeat(40); }],
  ['altered accepted origin', state => { state.coordinationAdmissions[landingMetadataKey].authorityBaseExactMain = 'b'.repeat(40); }],
  ['missing accepted original test path', state => { state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch].shift(); }],
  ['altered accepted purpose', state => { state.coordinationAdmissions[landingMetadataPurposeKey].owner = 'OTHER'; }],
]) {
  test(`landing metadata implementation rejects ${name}`, (t) => {
    const context = landingMetadataFixture(t, true);
    amendLandingBaseline(context, () => {
      const state = JSON.parse(fs.readFileSync(path.join(context.root, landingMetadataStatePath), 'utf8'));
      mutate(state); write(context.root, landingMetadataStatePath, `${JSON.stringify(state, null, 2)}\n`);
    });
    changeLandingPair(context); commit(context.root, 'attempt source'); rejectLandingMetadata(context);
  });
}
for (const [name, fileIndex, mutate] of [
  ['license changed', 0, source => source.replace('"UNLICENSED"', '"MIT"')],
  ['private flag removed', 0, source => source.replace('  "private": true,\n', '')],
  ['private flag false', 0, source => source.replace('"private": true', '"private": false')],
  ['package name changed', 0, source => source.replace('@pc/landing', '@pc/other')],
  ['build script changed', 0, source => source.replace('next build', 'next build && echo altered')],
  ['dependency changed', 0, source => source.replace('14.2.35', '14.2.34')],
  ['metadata field added', 0, source => source.replace('  "private": true,', '  "private": true,\n  "description": "changed",')],
  ['register effective date changed', 1, source => source.replace('2026-08-21', '2026-10-01')],
  ['register schema changed', 1, source => source.replace('"schemaVersion": 1', '"schemaVersion": 2')],
  ['exception expiry extended', 1, () => landingMetadataFiles[1].baselineContent.replace('2026-09-30', '2026-12-31')],
  ['stale completed exception retained', 1, () => landingMetadataFiles[1].baselineContent],
]) {
  test(`landing metadata implementation rejects ${name}`, (t) => {
    const context = landingMetadataFixture(t, true); changeLandingPair(context);
    const file = landingMetadataFiles[fileIndex]; write(context.root, file.path, mutate(file.content));
    commit(context.root, name); rejectLandingMetadata(context);
  });
}
for (const file of [gitleaksReleaseAttestationPath, 'scripts/p7-autopilot-guard.sh', landingMetadataStatePath, 'apps/landing/app/page.tsx', 'docs/ip/publishable-packages.json']) {
  test(`landing metadata implementation rejects mixed source ${file}`, (t) => {
    const context = landingMetadataFixture(t, true); changeLandingPair(context);
    if (file === gitleaksReleaseAttestationPath) {
      write(context.root, file, synchronizeCurrentGitleaksReleaseAttestation(fs.readFileSync(path.join(context.root, file), 'utf8')));
    } else write(context.root, file, `${fs.existsSync(path.join(context.root, file)) ? fs.readFileSync(path.join(context.root, file), 'utf8') : ''}\n`);
    commit(context.root, 'mixed metadata authority'); rejectLandingMetadata(context, /LANDING_METADATA_IMPLEMENTATION_DIFF_SCOPE/u);
  });
}
for (let missing = 0; missing < landingMetadataFiles.length; missing++) {
  test(`landing metadata implementation rejects missing paired file ${missing}`, (t) => {
    const context = landingMetadataFixture(t, true);
    const file = landingMetadataFiles[1 - missing]; write(context.root, file.path, file.content);
    commit(context.root, 'incomplete pair'); rejectLandingMetadata(context, /LANDING_METADATA_IMPLEMENTATION_DIFF_SCOPE/u);
  });
}
for (const file of landingMetadataFiles) {
  for (const kind of ['executable', 'symlink', 'rename', 'baseline drift']) {
    test(`landing metadata implementation rejects ${kind} ${file.path}`, (t) => {
      const context = landingMetadataFixture(t, true);
      if (kind === 'baseline drift') amendLandingBaseline(context, () => write(context.root, file.path, file.baselineContent + '\n'));
      changeLandingPair(context);
      if (kind === 'executable') fs.chmodSync(path.join(context.root, file.path), 0o755);
      if (kind === 'symlink') { fs.unlinkSync(path.join(context.root, file.path)); fs.symlinkSync('../../README.md', path.join(context.root, file.path)); }
      if (kind === 'rename') fs.renameSync(path.join(context.root, file.path), path.join(context.root, file.path + '.renamed'));
      commit(context.root, kind); rejectLandingMetadata(context);
    });
  }
}
test('landing metadata: dirty correct bytes cannot rescue wrong committed source', (t) => {
  const context = landingMetadataFixture(t, true); changeLandingPair(context);
  write(context.root, landingMetadataFiles[0].path, landingMetadataFiles[0].content.replace('UNLICENSED', 'MIT'));
  commit(context.root, 'wrong committed license'); changeLandingPair(context);
  rejectLandingMetadata(context, /LANDING_METADATA_EXACT_FILE/u);
});
test('landing metadata: candidate guard cannot authorize source without accepted admission', (t) => {
  const context = landingMetadataFixture(t);
  git(context.root, ['switch', gitleaksReleaseAttestationBranch]);
  git(context.root, ['merge', '--ff-only', context.baseline]); context.implementationBranch = gitleaksReleaseAttestationBranch;
  write(context.root, 'scripts/p7-autopilot-guard.sh', '#!/bin/bash\nexit 0\n', 0o755);
  changeLandingPair(context); commit(context.root, 'candidate guard self-admission');
  rejectLandingMetadata(context, /LANDING_METADATA_ACCEPTED_ADMISSION_MISMATCH/u);
});
test('landing metadata: ordinary guard phase cannot include landing source', (t) => {
  const context = landingMetadataFixture(t);
  write(context.root, 'scripts/p7-autopilot-guard.sh', fs.readFileSync(sourceGuard, 'utf8') + '\n');
  changeLandingPair(context); commit(context.root, 'guard/source mixed phase');
  rejectLandingMetadata(context, /Forbidden path/u);
});

const dealLocalePurposeKey = 'deal-destination-locale-guard-purpose-20261001';
const dealLocaleAdmissionKey = 'deal-destination-locale-20261001';
const dealLocalePurpose = {
  "owner": "ACCOUNT_1_EXECUTION",
  "presentationContributor": "ACCOUNT_2_PRODUCT",
  "purpose": "Renew the existing accepted three-path PRODUCT guard ref for separately admitted RU/EN/ZH presentation on the actual protected Deal destination, resolving #5735 destination-language finding without changing command or server authority.",
  "authorityBaseExactMain": "2d0db1af028b9d9d17d5a1e84a4dbe86ec990d68",
  "implementationBranch": "governance/pc-crop-post-registration-progress-scope-4997",
  "allowedPaths": [
    "scripts/p7-autopilot-guard.sh",
    "scripts/p7-autopilot-guard.test.mjs",
    ".github/workflows/platform-v7-autopilot-guard.yml"
  ],
  "futureAdmissionBranch": "governance/product-deal-runtime-admission-20260929",
  "futureImplementationBranch": "ux/deal-runtime-unknown-20260929",
  "futureAdditionalSourcePaths": [
    "apps/web/app/platform-v7/deals/[id]/execution/page.tsx",
    "apps/web/components/platform-v7/DealCommandForm.tsx",
    "apps/web/i18n/transaction-deal-copy.ts",
    "packages/design-system-v8/src/components.tsx"
  ],
  "reviewedPrivatePayload": {
    "sha256": "6666012b47c9179f132149d010d13284309d7fe5ec2689373dba18ccdcc4024e",
    "sourceComments": [
      5908067884,
      5908071391
    ],
    "authorAuditComment": 5908085804,
    "independentPrivateReviewComment": 5916309103
  },
  "requiredTruthBoundaries": [
    "This one-file purpose record admits no runtime, test, workflow or new source path. Global/current/R1.2 scopes, approvedConcurrentScopes, every existing admission, progress and maturity remain unchanged.",
    "After this purpose is independently reviewed and accepted, use the existing already admitted three-path guard ref for a separate trusted-base literal guard repair and adversarial tests. Preserve all existing admission phases, metadata/attestation routes and trusted-base plus PR-head defense.",
    "The guard must define a separate exact state-only extension phase on the existing Deal-runtime admission ref. Preserve the full original five-path runtime scope and add only the four listed paths in a later independently reviewed accepted state. Candidate-owned state or a manifest cannot grant implementation authority.",
    "Publish no Deal locale source before the separately accepted guard and state-only source extension. Use the existing production-resolved transaction-ux workspace and NextIntl request locale; keep the facade, tsconfig mapping, shell and approved design.",
    "Preserve all original UNKNOWN attempt identity, immutable request fingerprint, draft/review/focus state, exact server role/tenant/Deal/action permissions, CSRF, GET-only recovery and duplicate command prevention. Locale changes affect presentation only.",
    "The captured six-file private payload and its bounded review are support, not current-head CI, admission, native account approval, full browser acceptance or production evidence. Obtain fresh independent whole-source review, author audit and every applicable CI/security/readiness gate after actual adoption.",
    "Preserve original source authors and canonical CORE ownership. Queue the shared guard writer and any main/release action after the current Gekta owner window; do not overwrite another owner's ref or issue a competing deployment command.",
    "Require normal expected-full-SHA manual merges and exact-current-main REG.RU OCI/container/live acceptance followed by the ordinary authorized bank queue to the same Deal in RU/EN/ZH. Public or seeded fixture evidence does not close protected bank, 13-cabinet or provider acceptance."
  ],
  "forbiddenAuthority": [
    "Direct runtime/test/source admission, permission-vector changes or another owner's branch mutation in this purpose PR",
    "Backend/API/DB/RLS/tenant/role/session/command/payment/provider/FGIS or legal authority",
    "Design or App Shell replacement, duplicate Deal core, alias removal, business-status or external-success inference",
    "CI/security/readiness/independent-review weakening, fake PASS, forced/automatic merge, production/model mutation or new recurring cost"
  ],
  "teamHubDependency": "#5735 P2 thread4142098743; source5908067884/5908071391; private review5916309103; #5699; current Gekta next window5924684608"
};
const dealLocaleAdditionalPaths = [
  "apps/web/app/platform-v7/deals/[id]/execution/page.tsx",
  "apps/web/components/platform-v7/DealCommandForm.tsx",
  "apps/web/i18n/transaction-deal-copy.ts",
  "packages/design-system-v8/src/components.tsx"
];
const dealLocaleSourcePaths = [
  "apps/web/components/transaction-ux/TransactionDealWorkspace.tsx",
  "apps/web/tests/unit/transactionDealWorkspaceRecovery.test.tsx",
  "apps/web/app/platform-v7/deals/[id]/execution/page.tsx",
  "apps/web/components/platform-v7/DealCommandForm.tsx",
  "apps/web/i18n/transaction-deal-copy.ts",
  "packages/design-system-v8/src/components.tsx"
];
const dealLocalePins = [
  [
    "apps/web/components/transaction-ux/TransactionDealWorkspace.tsx",
    "6f980ea5c83dc9776d51fe01b6f33bf21704a037",
    "be57e8931fc5a056ed59039d9bf0da6f98aeb6fe"
  ],
  [
    "apps/web/tests/unit/transactionDealWorkspaceRecovery.test.tsx",
    "4cf04d22287002bf90888847153bfe9759d8e1fd",
    "1c669249fcf4451bc0655f506d975edc069fe81c"
  ],
  [
    "apps/web/app/platform-v7/deals/[id]/execution/page.tsx",
    "699ae74d30128e72ccad0a4559ad40944b3ecda8",
    "2099bb5fcd731368ffccecd096ebb10320379257"
  ],
  [
    "apps/web/components/platform-v7/DealCommandForm.tsx",
    "7bde1116c8e84e2f253da69431d867ceaa90663d",
    "aba1af6c10dbbee0cee25cb13bdbce40145024a2"
  ],
  [
    "apps/web/i18n/transaction-deal-copy.ts",
    null,
    "4db89dfdec3f5f871760461a60dd2f89194329a1"
  ],
  [
    "packages/design-system-v8/src/components.tsx",
    "3f95e51e99858debcd3f784e5b77b05be9619ccd",
    "3f29bfef940801667273f066a02d34f20c2be8b5"
  ]
];
function dealLocaleAdmissionRecord(authorityBaseExactMain) {
  return {
    owner: 'ACCOUNT_1_EXECUTION',
    presentationContributor: 'ACCOUNT_2_PRODUCT',
    sourceOwnerRetained: 'ACCOUNT_1_EXECUTION',
    purpose: 'Apply only the already reviewed RU/EN/ZH protected Deal presentation payload while preserving canonical UNKNOWN recovery and server authority.',
    authorityBaseExactMain,
    implementationBranch: dealRuntimeImplementationBranch,
    allowedPaths: [...dealRuntimePaths, ...dealLocaleAdditionalPaths],
    exactSourcePaths: [...dealLocaleSourcePaths],
    exactSourcePins: structuredClone(dealLocalePins),
    reviewedPrivatePayloadSha256: '6666012b47c9179f132149d010d13284309d7fe5ec2689373dba18ccdcc4024e',
    requiredTruthBoundaries: [
      'Presentation only; actual route/locale/workspace/form and stable metadata labels. Original command controls, owner, identity, UNKNOWN/fingerprint, CSRF and permissions remain canonical.',
      'The original five-path scope and all old records remain intact. This locale phase permits exactly the six pinned source/test files; it does not permit workflow, registry, generated inventory or scope changes.',
      'No private source review transfers to an adopted SHA. Fresh whole-head nonauthor review, owner audit, native CI/security/readiness, expected-SHA merge and exact REG.RU protected acceptance remain required.',
    ],
    forbiddenAuthority: ['API/DB/role/tenant/money/provider/FGIS authority', 'Source-owned scope or guard changes', 'CI/security/readiness or review weakening', 'False live or external success'],
  };
}
// Captured six-file payload from #5735 comments5908067884/5908071391.
// Compressed only to avoid duplicating 103071 bytes of source in this guard test.
// Its fixed SHA-256 and every actual old/new Git blob are verified below.
const dealLocalePinnedPatch = inflateSync(Buffer.from([
  "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",
].join(''), 'base64'));
assert.equal(createHash('sha256').update(dealLocalePinnedPatch).digest('hex'),
  '6666012b47c9179f132149d010d13284309d7fe5ec2689373dba18ccdcc4024e');
function actualLocaleBaselineBlob(blob) {
  const result = spawnSync('git', ['cat-file', 'blob', blob], { cwd: process.cwd() });
  assert.equal(result.status, 0, `full-history guard checkout must contain accepted blob ${blob}: ${result.stderr}`);
  const bytes = result.stdout;
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), blob);
  return bytes;
}
function assertActualLocalePins(context, ref, candidate, changedMode = null) {
  for (const [file, oldBlob, newBlob] of dealLocalePins) {
    const blob = candidate ? newBlob : oldBlob;
    const mode = changedMode?.file === file ? changedMode.mode : '100644';
    assert.equal(git(context.root, ['ls-tree', ref, '--', file]),
      blob === null ? '' : `${mode} blob ${blob}\t${file}`, `actual source pin: ${file}`);
  }
}
function applyActualPinnedLocaleSource(context) {
  assertActualLocalePins(context, context.baseline, false);
  const applied = spawnSync('git', ['apply', '--index', '--whitespace=nowarn', '-'], {
    cwd: context.root, input: dealLocalePinnedPatch, encoding: 'utf8',
  });
  assert.equal(applied.status, 0, output(applied));
  git(context.root, ['commit', '-m', 'actual six pinned locale source transitions']);
  assertActualLocalePins(context, 'HEAD', true);
}
function runLocaleModeBypassControl(context) {
  const source = git(context.root, ['show', `${context.baseline}:scripts/p7-autopilot-guard.sh`]);
  const condition = "before !== `100644 blob ${oldBlob}\\t${file}`) ||\n              after !== `100644 blob ${newBlob}\\t${file}`";
  const withoutMode = "before.slice(7) !== `blob ${oldBlob}\\t${file}`) ||\n              after.slice(7) !== `blob ${newBlob}\\t${file}`";
  assert.equal(source.split(condition).length, 2, 'change only the locale regular-mode predicate');
  const control = path.join(context.root, '.git', 'locale-mode-bypass-control.sh');
  fs.writeFileSync(control, source.replace(condition, withoutMode));
  return spawnSync('bash', [control], {
    cwd: context.root,
    env: { ...process.env, BASE_REF: context.baseline, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: context.implementationBranch },
    encoding: 'utf8',
  });
}
function dealLocaleFixture(t, { implementation = false, accepted = false, pinnedSources = false, mutateBase = () => {} } = {}) {
  const context = dealRuntimeFixture(t, { admitted: true, admission: !implementation });
  const state = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimeStatePath), 'utf8'));
  state.coordinationAdmissions[dealLocalePurposeKey] = structuredClone(dealLocalePurpose);
  mutateBase(state);
  for (const [file, oldBlob] of dealLocalePins) {
    if (oldBlob !== null) write(context.root, file, pinnedSources ? actualLocaleBaselineBlob(oldBlob) : 'isolated locale baseline: ' + file + '\n');
  }
  write(context.root, dealRuntimeStatePath, JSON.stringify(state, null, 2) + '\n');
  commit(context.root, 'separately accepted locale purpose fixture');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  if (accepted) {
    const after = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimeStatePath), 'utf8'));
    after.approvedConcurrentScopes[dealRuntimeImplementationBranch] = [...dealRuntimePaths, ...dealLocaleAdditionalPaths];
    after.coordinationAdmissions[dealLocaleAdmissionKey] = dealLocaleAdmissionRecord(context.baseline);
    write(context.root, dealRuntimeStatePath, JSON.stringify(after, null, 2) + '\n');
    commit(context.root, 'separately accepted locale source admission fixture');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  }
  return context;
}
function extendDealLocale(context, mutate = () => {}) {
  const state = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimeStatePath), 'utf8'));
  state.approvedConcurrentScopes[dealRuntimeImplementationBranch] = [...dealRuntimePaths, ...dealLocaleAdditionalPaths];
  state.coordinationAdmissions[dealLocaleAdmissionKey] = dealLocaleAdmissionRecord(context.baseline);
  mutate(state);
  write(context.root, dealRuntimeStatePath, JSON.stringify(state, null, 2) + '\n');
}
function rejectDealLocale(context) {
  const result = runTrustedDealRuntimeGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /DEAL_LOCALE_|DEAL_RUNTIME_|Mutable scope|outside current/u);
}

const localeInventoryPurposeKey = 'deal-locale-generated-inventory-guard-purpose-20261001';
const localeInventoryAdmissionKey = 'deal-locale-generated-inventory-20261001';
const localeInventoryPaths = [...dealRuntimePaths, ...dealLocaleAdditionalPaths, ...dealRuntimeGeneratedPaths];
const localeInventoryPurpose = JSON.parse(fs.readFileSync(dealRuntimeStatePath, 'utf8'))
  .coordinationAdmissions[localeInventoryPurposeKey];
assert.equal(localeInventoryPurpose.authorityBaseExactMain, '4f5d03b833f0064b4538aae751d74f17e6d67c88');
assert.deepEqual(localeInventoryPurpose.futureGeneratedPaths, dealRuntimeGeneratedPaths);
assert.deepEqual(localeInventoryPurpose.immutableLocaleSourcePins, dealLocalePins);
function localeInventoryRecord(authorityBaseExactMain) {
  return {
    owner: 'ACCOUNT_1_EXECUTION', presentationContributor: 'ACCOUNT_2_PRODUCT', sourceOwnerRetained: 'ACCOUNT_1_EXECUTION',
    purpose: 'Complete the immutable six-file Deal locale transition with only its byte-exact trusted generated cryptographic inventory pair.',
    authorityBaseExactMain, implementationBranch: dealRuntimeImplementationBranch,
    allowedPaths: [...localeInventoryPaths], retainedLocaleAdmissionKey: dealLocaleAdmissionKey,
    exactSourcePins: structuredClone(dealLocalePins), exactGeneratedPaths: [...dealRuntimeGeneratedPaths],
    trustedGenerator: { path: dealRuntimeGeneratorPath, mode: '100644', blob: '6a5751eb031a514bcf7f26893c0003e6013107aa' },
    requiredTruthBoundaries: [
      'Separate completion phase only. Preserve every old record and the immutable six source blobs; append only the two generated paths after the existing nine paths.',
      'Unchanged state and exactly six source transitions plus both regular generated files; no arbitrary source, workflow, registry, guard or scope mutation.',
      'Use only the unchanged pinned accepted-base generator and committed application blobs as text. Verify full source enumeration, modes, attributable ancestor/source-tree equality, and byte-exact JSON/Markdown reproduction.',
      'Fresh whole-head independent review, separate owner audit, all applicable native CI/security/readiness and ordinary full-expected-SHA merge remain mandatory. No protected/live/provider/Founder13 acceptance is inferred.',
    ],
    forbiddenAuthority: ['API/DB/role/tenant/money/provider/FGIS/model authority', 'General source or generated-output permissions', 'Candidate-code execution during regeneration', 'CI/security/review/readiness weakening or false live/external PASS'],
  };
}
function extendLocaleInventory(context, mutate = () => {}) {
  const state = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimeStatePath), 'utf8'));
  state.approvedConcurrentScopes[dealRuntimeImplementationBranch] = [...localeInventoryPaths];
  state.coordinationAdmissions[localeInventoryAdmissionKey] = localeInventoryRecord(context.baseline);
  mutate(state);
  write(context.root, dealRuntimeStatePath, JSON.stringify(state, null, 2) + '\n');
}
function localeInventoryFixture(t, { implementation = false, admitted = false, mutateBase = () => {}, generatorMode = '100644' } = {}) {
  const context = dealLocaleFixture(t, { implementation, accepted: true, pinnedSources: implementation });
  const state = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimeStatePath), 'utf8'));
  state.coordinationAdmissions[localeInventoryPurposeKey] = structuredClone(localeInventoryPurpose);
  mutateBase(state);
  write(context.root, dealRuntimeStatePath, JSON.stringify(state, null, 2) + '\n');
  const generator = fs.readFileSync(dealRuntimeGeneratorPath);
  const generatorBlob = createHash('sha1').update(`blob ${generator.length}\0`).update(generator).digest('hex');
  assert.equal(generatorBlob, localeInventoryPurpose.trustedGenerator.blob);
  write(context.root, dealRuntimeGeneratorPath, generator);
  write(context.root, 'apps/web/middleware.ts', 'export const stable = true;\n');
  fs.mkdirSync(path.join(context.root, 'apps/web/apps/web'), { recursive: true });
  fs.symlinkSync('../../middleware.ts', path.join(context.root, 'apps/web/apps/web/middleware.ts'));
  commit(context.root, 'separate accepted inventory purpose and unchanged trusted generator');
  if (generatorMode !== '100644') {
    fs.chmodSync(path.join(context.root, dealRuntimeGeneratorPath), 0o755);
    git(context.root, ['update-index', '--cacheinfo', `${generatorMode},${generatorBlob},${dealRuntimeGeneratorPath}`]);
    git(context.root, ['commit', '-m', 'isolated baseline generator mode precondition']);
  }
  generateDealRuntimeInventory(context, git(context.root, ['rev-parse', 'HEAD']));
  commit(context.root, 'trusted current generated pair');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  if (admitted) {
    extendLocaleInventory(context);
    commit(context.root, 'separate accepted two-path inventory co-admission');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  }
  return context;
}
function completePinnedLocaleInventory(context) {
  applyActualPinnedLocaleSource(context);
  context.inventorySource = git(context.root, ['rev-parse', 'HEAD']);
  generateDealRuntimeInventory(context, context.inventorySource);
  commit(context.root, 'exact generated pair for the six actual pinned source changes');
  assertActualLocalePins(context, context.baseline, false);
  assertActualLocalePins(context, 'HEAD', true);
}
test('Locale inventory: exact state-only co-admission preserves old nine paths and immutable locale record', (t) => {
  const context = localeInventoryFixture(t);
  const before = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimeStatePath), 'utf8'));
  extendLocaleInventory(context);
  commit(context.root, 'exact generated-pair state co-admission');
  const after = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimeStatePath), 'utf8'));
  assert.deepEqual(after.coordinationAdmissions[dealLocaleAdmissionKey], before.coordinationAdmissions[dealLocaleAdmissionKey]);
  assert.deepEqual(after.approvedConcurrentScopes[dealRuntimeImplementationBranch].slice(0, 9), before.approvedConcurrentScopes[dealRuntimeImplementationBranch]);
  const result = runTrustedDealRuntimeGuard(context);
  assert.equal(result.status, 0, output(result));
  assert.equal(git(context.root, ['diff', '--name-status', `${context.baseline}...HEAD`]), `M\t${dealRuntimeStatePath}`);
});
const inventoryTextAttacks = [
  ['compact old state', (raw) => JSON.stringify(JSON.parse(raw)) + '\n'],
  ['four-space old state', (raw) => JSON.stringify(JSON.parse(raw), null, 4) + '\n'],
  ['reordered old top-level keys', (raw) => JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(raw)).reverse()), null, 2) + '\n'],
  ['reordered old admission records', (raw) => {
    const state = JSON.parse(raw);
    state.coordinationAdmissions = Object.fromEntries(Object.entries(state.coordinationAdmissions).reverse());
    return JSON.stringify(state, null, 2) + '\n';
  }],
  ['reordered retained locale fields', (raw) => {
    const state = JSON.parse(raw);
    state.coordinationAdmissions[dealLocaleAdmissionKey] = Object.fromEntries(Object.entries(state.coordinationAdmissions[dealLocaleAdmissionKey]).reverse());
    return JSON.stringify(state, null, 2) + '\n';
  }],
  ['duplicate old current-step key with last-value wins', (raw) => raw.replace('  "current": "R1.2 unchanged fixture",', '  "current": "unauthorized next step",\n  "current": "R1.2 unchanged fixture",')],
  ['duplicate old owner key with last-value wins', (raw) => {
    const start = raw.indexOf('    "' + dealLocaleAdmissionKey + '": {');
    assert.notEqual(start, -1);
    return raw.slice(0, start) + raw.slice(start).replace('      "owner": "ACCOUNT_1_EXECUTION",',
      '      "owner": "ACCOUNT_2_PRODUCT",\n      "owner": "ACCOUNT_1_EXECUTION",');
  }],
  ['escaped old key spelling', (raw) => raw.replace('  "current":', '  "\\u0063urrent":')],
  ['CRLF reserialization', (raw) => raw.replaceAll('\n', '\r\n')],
];
for (const [name, attack] of inventoryTextAttacks) {
  test('Locale inventory: byte preservation rejects ' + name + ' although parsed values match', (t) => {
    const context = localeInventoryFixture(t);
    extendLocaleInventory(context);
    const target = path.join(context.root, dealRuntimeStatePath);
    const valid = fs.readFileSync(target, 'utf8');
    const changed = attack(valid);
    assert.notEqual(changed, valid, 'isolated attack must change actual bytes');
    assert.deepEqual(JSON.parse(changed), JSON.parse(valid), 'the preexisting object comparison cannot distinguish this attack');
    fs.writeFileSync(target, changed);
    commit(context.root, 'same parsed state with changed old bytes: ' + name);
    const result = runTrustedDealRuntimeGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /DEAL_LOCALE_INVENTORY_ADMISSION_TEXT_MUTATION/u);
    const trusted = git(context.root, ['show', `${context.baseline}:scripts/p7-autopilot-guard.sh`]);
    const predicate = "if (readState(headRef) !== expectedText) throw new Error('DEAL_LOCALE_INVENTORY_ADMISSION_TEXT_MUTATION');";
    assert.equal(trusted.split(predicate).length, 2, 'remove only the new exact-text comparison');
    const bypass = path.join(context.root, '.git', 'inventory-text-bypass-control.sh');
    fs.writeFileSync(bypass, trusted.replace(predicate, ''));
    const control = spawnSync('bash', [bypass], {
      cwd: context.root,
      env: { ...process.env, BASE_REF: context.baseline, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: context.implementationBranch },
      encoding: 'utf8',
    });
    assert.equal(control.status, 0, 'without only the text predicate this same attack reaches PASS: ' + output(control));
  });
}
test('Locale inventory: preserved noncanonical old whitespace is accepted without reserializing the base', (t) => {
  const context = localeInventoryFixture(t);
  const target = path.join(context.root, dealRuntimeStatePath);
  const preserve = (raw) => raw.replace('  "current":', '  "current" :');
  const before = fs.readFileSync(target, 'utf8');
  assert.notEqual(preserve(before), before);
  fs.writeFileSync(target, preserve(before));
  commit(context.root, 'genuine fixture base with preexisting noncanonical whitespace');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  extendLocaleInventory(context);
  fs.writeFileSync(target, preserve(fs.readFileSync(target, 'utf8')));
  commit(context.root, 'exact two insertions retaining old whitespace');
  const result = runTrustedDealRuntimeGuard(context);
  assert.equal(result.status, 0, output(result));
});
const inventoryStateAttacks = [
  ['third permission', (s) => s.approvedConcurrentScopes[dealRuntimeImplementationBranch].push('apps/api/src/app.module.ts')],
  ['removed original permission', (s) => s.approvedConcurrentScopes[dealRuntimeImplementationBranch].shift()],
  ['reordered old vector', (s) => s.approvedConcurrentScopes[dealRuntimeImplementationBranch].reverse()],
  ['duplicate generated path', (s) => s.approvedConcurrentScopes[dealRuntimeImplementationBranch].push(dealRuntimeGeneratedPaths[0])],
  ['changed prior locale pins', (s) => { s.coordinationAdmissions[dealLocaleAdmissionKey].exactSourcePins[0][2] = '0'.repeat(40); }],
  ['changed prior owner', (s) => { s.coordinationAdmissions[dealLocaleAdmissionKey].owner = 'ACCOUNT_2_PRODUCT'; }],
  ['changed source owner', (s) => { s.coordinationAdmissions[localeInventoryAdmissionKey].sourceOwnerRetained = 'ACCOUNT_2_PRODUCT'; }],
  ['changed completion owner', (s) => { s.coordinationAdmissions[localeInventoryAdmissionKey].owner = 'ACCOUNT_2_PRODUCT'; }],
  ['global scope widening', (s) => s.allowedCurrentScope.push('**')],
  ['changed current step', (s) => { s.current = 'unauthorized next step'; }],
  ['fabricated progress', (s) => { s.fullTzReadinessPercent = 100; }],
  ['wrong admission base', (s) => { s.coordinationAdmissions[localeInventoryAdmissionKey].authorityBaseExactMain = '0'.repeat(40); }],
  ['wrong generator pin', (s) => { s.coordinationAdmissions[localeInventoryAdmissionKey].trustedGenerator.blob = '0'.repeat(40); }],
  ['weakened boundaries', (s) => { s.coordinationAdmissions[localeInventoryAdmissionKey].requiredTruthBoundaries = []; }],
];
for (const [name, mutate] of inventoryStateAttacks) {
  test('Locale inventory: state co-admission rejects ' + name, (t) => {
    const context = localeInventoryFixture(t);
    extendLocaleInventory(context, mutate);
    commit(context.root, 'isolated invalid state: ' + name);
    const result = runTrustedDealRuntimeGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /DEAL_LOCALE_INVENTORY_ADMISSION_STATE_MUTATION/u);
  });
}
test('Locale inventory: candidate-fabricated purpose cannot grant output authority', (t) => {
  const context = localeInventoryFixture(t, { mutateBase: (s) => { delete s.coordinationAdmissions[localeInventoryPurposeKey]; } });
  extendLocaleInventory(context, (s) => { s.coordinationAdmissions[localeInventoryPurposeKey] = structuredClone(localeInventoryPurpose); });
  commit(context.root, 'candidate-only purpose');
  rejectDealLocale(context);
});
test('Locale inventory: altered accepted purpose is rejected', (t) => {
  const context = localeInventoryFixture(t, { mutateBase: (s) => { s.coordinationAdmissions[localeInventoryPurposeKey].owner = 'ACCOUNT_2_PRODUCT'; } });
  extendLocaleInventory(context);
  commit(context.root, 'co-admission from altered purpose');
  const result = runTrustedDealRuntimeGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /DEAL_LOCALE_INVENTORY_PURPOSE_MISMATCH/u);
});
test('Locale inventory: state and runtime changes cannot mix', (t) => {
  const context = localeInventoryFixture(t);
  extendLocaleInventory(context);
  write(context.root, dealLocaleSourcePaths[0], 'mixed application source\n');
  commit(context.root, 'mixed co-admission/source');
  const result = runTrustedDealRuntimeGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /DEAL_LOCALE_INVENTORY_ADMISSION_DIFF_SCOPE/u);
});
test('Locale inventory: executable state is rejected with the otherwise exact candidate blob', (t) => {
  const context = localeInventoryFixture(t);
  extendLocaleInventory(context);
  commit(context.root, 'otherwise exact admission');
  const blob = git(context.root, ['rev-parse', 'HEAD:' + dealRuntimeStatePath]);
  git(context.root, ['update-index', '--cacheinfo', `100755,${blob},${dealRuntimeStatePath}`]);
  git(context.root, ['commit', '-m', 'one state-mode-only attack']);
  assert.equal(git(context.root, ['rev-parse', 'HEAD:' + dealRuntimeStatePath]), blob);
  const result = runTrustedDealRuntimeGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /DEAL_LOCALE_INVENTORY_ADMISSION_FILE_MODE/u);
});
test('Locale inventory: actual six pins and exact generated pair pass together', (t) => {
  const context = localeInventoryFixture(t, { implementation: true, admitted: true });
  completePinnedLocaleInventory(context);
  const result = runTrustedDealRuntimeGuard(context);
  assert.equal(result.status, 0, output(result));
  assert.equal(git(context.root, ['diff', '--name-only', `${context.baseline}...HEAD`]).split('\n').length, 8);
});
test('Locale inventory: purpose alone does not admit the generated pair', (t) => {
  const context = localeInventoryFixture(t, { implementation: true });
  completePinnedLocaleInventory(context);
  const result = runTrustedDealRuntimeGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /DEAL_LOCALE_IMPLEMENTATION_DIFF_SCOPE/u);
});
test('Locale inventory: completion admission requires both generated files', (t) => {
  const context = localeInventoryFixture(t, { implementation: true, admitted: true });
  applyActualPinnedLocaleSource(context);
  const result = runTrustedDealRuntimeGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /DEAL_LOCALE_IMPLEMENTATION_DIFF_SCOPE/u);
});
test('Locale inventory: uncommitted source/generator never determine the verified output', (t) => {
  const context = localeInventoryFixture(t, { implementation: true, admitted: true });
  completePinnedLocaleInventory(context);
  write(context.root, dealLocaleSourcePaths[0], 'uncommitted decoy\n');
  const marker = path.join(context.root, 'candidate-generator-executed');
  write(context.root, dealRuntimeGeneratorPath, `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(marker)},'unsafe');\n`);
  const result = runTrustedDealRuntimeGuard(context);
  assert.equal(result.status, 0, output(result));
  assert.equal(fs.existsSync(marker), false);
});
const inventorySourceAttacks = [
  ['wrong source blob', (c) => write(c.root, dealLocaleSourcePaths[0], 'invalid pinned source\n')],
  ['changed JSON', (c) => { const p = path.join(c.root, dealRuntimeGeneratedPaths[0]); const j = JSON.parse(fs.readFileSync(p, 'utf8')); j.scannedFiles += 1; fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n'); }],
  ['changed Markdown', (c) => fs.appendFileSync(path.join(c.root, dealRuntimeGeneratedPaths[1]), 'untrusted output claim\n')],
  ['stale ancestor attribution', (c) => { const p = path.join(c.root, dealRuntimeGeneratedPaths[1]); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(c.inventorySource, c.baseline)); }],
  ['nonexistent attribution', (c) => { const p = path.join(c.root, dealRuntimeGeneratedPaths[1]); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(c.inventorySource, '0'.repeat(40))); }],
  ['missing JSON', (c) => fs.rmSync(path.join(c.root, dealRuntimeGeneratedPaths[0]))],
  ['missing Markdown', (c) => fs.rmSync(path.join(c.root, dealRuntimeGeneratedPaths[1]))],
  ['unrelated source', (c) => write(c.root, 'apps/web/extra-unadmitted.ts', 'export const extra = true;\n')],
  ['changed generator', (c) => write(c.root, dealRuntimeGeneratorPath, 'throw new Error("untrusted candidate generator");\n')],
  ['source-owned state grant', (c) => { const s = JSON.parse(fs.readFileSync(path.join(c.root, dealRuntimeStatePath), 'utf8')); s.allowedCurrentScope.push('**'); write(c.root, dealRuntimeStatePath, JSON.stringify(s, null, 2) + '\n'); }],
];
for (const [name, mutate] of inventorySourceAttacks) {
  test('Locale inventory: completed actual eight-file transition rejects ' + name, (t) => {
    const context = localeInventoryFixture(t, { implementation: true, admitted: true });
    completePinnedLocaleInventory(context);
    mutate(context);
    commit(context.root, 'one source/output attack: ' + name);
    const result = runTrustedDealRuntimeGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /DEAL_LOCALE_|DEAL_RUNTIME_|outside current/u);
  });
}
for (const mode of ['100755', '120000']) {
  test('Locale inventory: output mode ' + mode + ' fails while every content pin/output byte is valid', (t) => {
    const context = localeInventoryFixture(t, { implementation: true, admitted: true });
    completePinnedLocaleInventory(context);
    const file = dealRuntimeGeneratedPaths[0], blob = git(context.root, ['rev-parse', 'HEAD:' + file]);
    git(context.root, ['update-index', '--cacheinfo', `${mode},${blob},${file}`]);
    git(context.root, ['commit', '-m', 'one generated-output mode attack']);
    if (mode === '120000') {
      // A head-only symlink also yields Git status T, independently refused by
      // exact diff scope. For the predicate-removal control, keep the same bad
      // kind in both isolated fixture snapshots so this remains an M change.
      // Every old/new content blob and all genuine application pins stay valid.
      const badHead = git(context.root, ['rev-parse', 'HEAD']);
      const headTree = git(context.root, ['rev-parse', 'HEAD^{tree}']);
      const oldBlob = git(context.root, ['rev-parse', context.baseline + ':' + file]);
      git(context.root, ['read-tree', context.baseline]);
      git(context.root, ['update-index', '--cacheinfo', `120000,${oldBlob},${file}`]);
      const baseTree = git(context.root, ['write-tree']);
      const isolatedBase = spawnSync('git', ['commit-tree', baseTree, '-p', context.baseline],
        { cwd: context.root, encoding: 'utf8', input: 'Isolated test baseline: only generated-output mode changed\n' });
      assert.equal(isolatedBase.status, 0, output(isolatedBase));
      const newBase = isolatedBase.stdout.trim();
      const isolatedHead = spawnSync('git', ['commit-tree', headTree, '-p', badHead, '-p', newBase],
        { cwd: context.root, encoding: 'utf8', input: 'Isolated test head preserving all prior source/content ancestry\n' });
      assert.equal(isolatedHead.status, 0, output(isolatedHead));
      git(context.root, ['update-ref', 'HEAD', isolatedHead.stdout.trim(), badHead]);
      git(context.root, ['read-tree', 'HEAD']);
      context.baseline = newBase;
    }
    assertActualLocalePins(context, 'HEAD', true);
    assert.equal(git(context.root, ['ls-tree', 'HEAD', '--', file]), `${mode} blob ${blob}\t${file}`);
    const result = runTrustedDealRuntimeGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /DEAL_LOCALE_INVENTORY_OUTPUT_MODE/u);
    const guard = git(context.root, ['show', context.baseline + ':scripts/p7-autopilot-guard.sh']);
    const predicate = "if ([baseRef, headRef].some((ref) => fileMode(ref, file) !== '100644')) throw new Error('DEAL_LOCALE_INVENTORY_OUTPUT_MODE:' + file);";
    assert.equal(guard.split(predicate).length, 2);
    const control = path.join(context.root, '.git', 'inventory-output-mode-control.sh');
    fs.writeFileSync(control, guard.replace(predicate, '/* isolated output-mode predicate removal control */'));
    const bypass = spawnSync('bash', [control], { cwd: context.root, encoding: 'utf8',
      env: { ...process.env, BASE_REF: context.baseline, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: context.implementationBranch } });
    assert.equal(bypass.status, 0, output(bypass));
  });
}
test('Locale inventory: same pinned baseline generator blob with executable mode is rejected', (t) => {
  const context = localeInventoryFixture(t, { implementation: true, admitted: true, generatorMode: '100755' });
  completePinnedLocaleInventory(context);
  assertActualLocalePins(context, 'HEAD', true);
  assert.equal(git(context.root, ['rev-parse', context.baseline + ':' + dealRuntimeGeneratorPath]), '6a5751eb031a514bcf7f26893c0003e6013107aa');
  assert.equal(git(context.root, ['rev-parse', 'HEAD:' + dealRuntimeGeneratorPath]), '6a5751eb031a514bcf7f26893c0003e6013107aa');
  const result = runTrustedDealRuntimeGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /DEAL_LOCALE_INVENTORY_GENERATOR_PIN_OR_MODE/u);
});
test('Deal locale: exact state-only extension preserves the old five paths and old authority', (t) => {
  const context = dealLocaleFixture(t);
  extendDealLocale(context);
  commit(context.root, 'exact four-path extension');
  const result = runTrustedDealRuntimeGuard(context);
  assert.equal(result.status, 0, output(result));
});
const localeStateAttacks = [
  ['extra source permission', (s) => s.approvedConcurrentScopes[dealRuntimeImplementationBranch].push('apps/api/src/app.module.ts')],
  ['removed old permission', (s) => s.approvedConcurrentScopes[dealRuntimeImplementationBranch].shift()],
  ['reordered permission vector', (s) => s.approvedConcurrentScopes[dealRuntimeImplementationBranch].reverse()],
  ['duplicate permission', (s) => s.approvedConcurrentScopes[dealRuntimeImplementationBranch].push(dealLocaleAdditionalPaths[0])],
  ['primary scope expansion', (s) => s.allowedCurrentScope.push('**')],
  ['changed current step', (s) => { s.current = 'bank source authority'; }],
  ['changed old runtime owner', (s) => { s.coordinationAdmissions[dealRuntimeCoordinationKey].owner = 'ACCOUNT_2_PRODUCT'; }],
  ['changed retained owner', (s) => { s.coordinationAdmissions[dealLocaleAdmissionKey].sourceOwnerRetained = 'ACCOUNT_2_PRODUCT'; }],
  ['changed locale authority owner', (s) => { s.coordinationAdmissions[dealLocaleAdmissionKey].owner = 'ACCOUNT_2_PRODUCT'; }],
  ['changed presentation contributor to authority owner', (s) => { s.coordinationAdmissions[dealLocaleAdmissionKey].presentationContributor = 'ACCOUNT_1_EXECUTION'; }],
  ['changed old renewal', (s) => { s.coordinationAdmissions[dealRuntimeRenewalKey].purpose = 'arbitrary source'; }],
  ['changed accepted purpose', (s) => { s.coordinationAdmissions[dealLocalePurposeKey].futureAdditionalSourcePaths.push('apps/api/src/app.module.ts'); }],
  ['changed source pin', (s) => { s.coordinationAdmissions[dealLocaleAdmissionKey].exactSourcePins[0][2] = 'a'.repeat(40); }],
  ['changed source catalogue', (s) => { s.coordinationAdmissions[dealLocaleAdmissionKey].exactSourcePaths = ['apps/api/src/app.module.ts']; }],
  ['changed payload identity', (s) => { s.coordinationAdmissions[dealLocaleAdmissionKey].reviewedPrivatePayloadSha256 = 'a'.repeat(64); }],
  ['changed acceptance base', (s) => { s.coordinationAdmissions[dealLocaleAdmissionKey].authorityBaseExactMain = 'a'.repeat(40); }],
  ['unrelated added record', (s) => { s.coordinationAdmissions.extra = {}; }],
];
for (const [name, attack] of localeStateAttacks) {
  test('Deal locale: rejects state admission ' + name, (t) => {
    const context = dealLocaleFixture(t);
    extendDealLocale(context, attack);
    commit(context.root, 'invalid state extension');
    rejectDealLocale(context);
  });
}
test('Deal locale: rejects mixed state admission and runtime source', (t) => {
  const context = dealLocaleFixture(t);
  extendDealLocale(context);
  write(context.root, dealRuntimePaths[0], 'unadmitted runtime source\n');
  commit(context.root, 'mixed admission and runtime');
  rejectDealLocale(context);
});
test('Deal locale: rejects executable state admission', (t) => {
  const context = dealLocaleFixture(t);
  extendDealLocale(context);
  fs.chmodSync(path.join(context.root, dealRuntimeStatePath), 0o755);
  commit(context.root, 'executable state');
  rejectDealLocale(context);
});
test('Deal locale: rejects a purpose fabricated only in the candidate', (t) => {
  const context = dealLocaleFixture(t, { mutateBase: (s) => { delete s.coordinationAdmissions[dealLocalePurposeKey]; } });
  extendDealLocale(context, (s) => { s.coordinationAdmissions[dealLocalePurposeKey] = structuredClone(dealLocalePurpose); });
  commit(context.root, 'self-admitted purpose');
  rejectDealLocale(context);
});
test('Deal locale: rejects an altered purpose in the accepted base', (t) => {
  const context = dealLocaleFixture(t, { mutateBase: (s) => { s.coordinationAdmissions[dealLocalePurposeKey].owner = 'ACCOUNT_2_PRODUCT'; } });
  extendDealLocale(context);
  commit(context.root, 'extension under different purpose');
  rejectDealLocale(context);
});
test('Deal locale: rejects a prior scope extended before exact admission', (t) => {
  const context = dealLocaleFixture(t, { mutateBase: (s) => { s.approvedConcurrentScopes[dealRuntimeImplementationBranch].push('extra.ts'); } });
  extendDealLocale(context);
  commit(context.root, 'premature scope extension');
  rejectDealLocale(context);
});
test('Deal locale: purpose alone never authorizes implementation', (t) => {
  const context = dealLocaleFixture(t, { implementation: true });
  changeDealRuntime(context);
  rejectDealLocale(context);
});
test('Deal locale: accepts all six actual pinned source transitions', (t) => {
  const context = dealLocaleFixture(t, { implementation: true, accepted: true, pinnedSources: true });
  applyActualPinnedLocaleSource(context);
  const result = runTrustedDealRuntimeGuard(context);
  assert.equal(result.status, 0, output(result));
});
for (const [name, mutate] of [
  ['replacement of one actual pinned source blob', (c) => write(c.root, dealLocaleSourcePaths[0], 'incorrect candidate bytes\n')],
  ['additional backend source', (c) => write(c.root, 'apps/api/src/app.module.ts', 'unapproved backend\n')],
  ['implementation-owned state', (c) => { const s = JSON.parse(fs.readFileSync(path.join(c.root, dealRuntimeStatePath), 'utf8')); s.allowedCurrentScope.push('**'); write(c.root, dealRuntimeStatePath, JSON.stringify(s) + '\n'); }],
  ['mixed workflow change', (c) => write(c.root, dealRuntimePaths[3], 'weakened CI\n')],
  ['removed original recovery test', (c) => fs.rmSync(path.join(c.root, dealLocaleSourcePaths[1]))],
]) {
  test('Deal locale: rejects source phase ' + name, (t) => {
    const context = dealLocaleFixture(t, { implementation: true, accepted: true, pinnedSources: true });
    applyActualPinnedLocaleSource(context);
    mutate(context);
    commit(context.root, 'untrusted locale source');
    rejectDealLocale(context);
  });
}
for (const [name, file, mode] of [
  ['executable presentation file', dealLocaleSourcePaths[0], '100755'],
  ['symbolic-link catalogue', dealLocaleAdditionalPaths[2], '120000'],
]) {
  test('Deal locale: rejects source phase ' + name + ' with every content pin valid', (t) => {
    const context = dealLocaleFixture(t, { implementation: true, accepted: true, pinnedSources: true });
    applyActualPinnedLocaleSource(context);
    const newBlob = dealLocalePins.find(([path]) => path === file)[2];
    // Git tree mutation retains the identical pinned blob, including for a
    // symlink: no different link-target bytes can mask the type/mode check.
    git(context.root, ['update-index', '--cacheinfo', `${mode},${newBlob},${file}`]);
    git(context.root, ['commit', '-m', 'one source mode mutation; immutable bytes retained']);
    assertActualLocalePins(context, context.baseline, false);
    assertActualLocalePins(context, 'HEAD', true, { file, mode });
    const rejected = runTrustedDealRuntimeGuard(context);
    assert.notEqual(rejected.status, 0, output(rejected));
    assert.ok(output(rejected).includes('DEAL_LOCALE_SOURCE_PIN_OR_MODE_MISMATCH:' + file), output(rejected));
    const bypassed = runLocaleModeBypassControl(context);
    assert.equal(bypassed.status, 0, 'this attack must pass only if regular-mode enforcement is removed: ' + output(bypassed));
  });
}


// Separately admitted BANK consumer phase; these are isolated unit fixtures,
// never native PostgreSQL, provider or production acceptance evidence.
const bankMoneyPurposeKey = 'bank-release-currency-amount-guard-purpose-20261001';
const bankMoneyCorrectionKey = 'bank-release-reserve-evidence-guard-purpose-20261001';
const bankMoneyAdmissionKey = 'bank-release-currency-amount-20261001';
const bankMoneySourceBranch = 'bank/deep-visible-copy-guard-20260924';
const bankMoneyAdmissionBranch = 'governance/product-bank-fgis-ux-source-admission-20260924';
const bankMoneyPurpose = JSON.parse(fs.readFileSync(dealRuntimeStatePath, 'utf8')).coordinationAdmissions[bankMoneyPurposeKey];
const bankMoneyCorrectionPurpose = JSON.parse(fs.readFileSync(dealRuntimeStatePath, 'utf8')).coordinationAdmissions[bankMoneyCorrectionKey];
const bankMoneyPrior = {
  "owner": "ACCOUNT_2_PRODUCT",
  "purpose": "Presentation-only bank/deal copy guard and negative release safety wording; no provider or payment finality.",
  "authorityBaseExactMain": "5d2fb28c0957b7c03928102b2a4ec353a49b3f79",
  "implementationBranch": "bank/deep-visible-copy-guard-20260924",
  "allowedPaths": [
    "apps/web/app/platform-v7/bank/escrow/page.tsx",
    "apps/web/app/platform-v7/bank/factoring/page.tsx",
    "apps/web/app/platform-v7/bank/release-safety/page.tsx",
    "apps/web/app/platform-v7/profile/page.tsx",
    "apps/web/tests/unit/bankReleaseSafetyRoute.test.tsx",
    "apps/web/tests/unit/platformV7DeepBankDealCopyGuard.test.ts",
    "docs/platform-v7/autopilot/scopes/bank-deep-visible-copy-guard-20260924.json"
  ],
  "requiredTruthBoundaries": [
    "Preserve the forbidden money-finality and demo vocabulary guard, including absence of the removed operator execution queue source.",
    "A recorded release request is not external execution; unresolved outcome requires same-operation reconciliation before retry.",
    "RU/EN/ZH bank copy does not attribute a concrete provider or claim factoring, release or debit finality."
  ],
  "forbiddenAuthority": [
    "API/DB/settlement/ledger/provider/callback or money-finality authority",
    "tenant/role/session authority",
    "CI/security gate weakening"
  ],
  "teamHubDependency": "#5565; Team Hub #5469 scope correction 5818641448"
};
const bankMoneyOldPaths = [
  "apps/web/app/platform-v7/bank/escrow/page.tsx",
  "apps/web/app/platform-v7/bank/factoring/page.tsx",
  "apps/web/app/platform-v7/bank/release-safety/page.tsx",
  "apps/web/app/platform-v7/profile/page.tsx",
  "apps/web/tests/unit/bankReleaseSafetyRoute.test.tsx",
  "apps/web/tests/unit/platformV7DeepBankDealCopyGuard.test.ts",
  "docs/platform-v7/autopilot/scopes/bank-deep-visible-copy-guard-20260924.json"
];
const bankMoneyPins = [
  [
    "apps/web/lib/bank-release-server.ts",
    "870a839e7087ef1114d805d818220471027c89fb",
    "54e276cc387366a4068c4a9358aea1dcfa0ebc18"
  ],
  [
    "apps/web/tests/unit/bankReleaseServer.test.ts",
    "698b609d3d3ee2a60bcbe491e7b8137807b261e6",
    "2ab6b6c3ac056b3d08eb76450fd0c54e97bff304"
  ],
  [
    "apps/web/app/platform-v7/bank/release-safety/page.tsx",
    "55f1572c14283fb2b69153adba6cbe13622fd387",
    "b67a3452e05ad97082ccfbcc0c4975302cb62df9"
  ],
  [
    "apps/web/tests/unit/bankReleaseSafetyRoute.test.tsx",
    "68382969c3b8f1bb8912a1c514fd71882470cf95",
    "630599ff7ff0ca4338445fc8bba50d61cf07f4f6"
  ]
];
const bankMoneyManifest = 'docs/platform-v7/autopilot/scopes/bank-deep-visible-copy-guard-20260924.json';
const bankMoneyPaths = [...bankMoneyOldPaths, 'apps/web/lib/bank-release-server.ts', 'apps/web/tests/unit/bankReleaseServer.test.ts'];
const bankMoneyPinnedPatch = inflateSync(Buffer.from('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', 'base64'));
assert.equal(createHash('sha256').update(bankMoneyPinnedPatch).digest('hex'), '8c05b77b82a722c6ca21118ed0b7c7dcc2dec549f93e4b77e6a2349a9b8ef06e');
function bankMoneyRecord(authorityBaseExactMain) {
  const bankMoneySourceBranch = 'bank/deep-visible-copy-guard-20260924';
  const completedPaths = bankMoneyPaths, priorKey = 'bank-deep-visible-copy-guard-20260924-coordination';
  const bankMoneyCorrectionKey = 'bank-release-reserve-evidence-guard-purpose-20261001';
  const pins = structuredClone(bankMoneyPins), manifestPath = bankMoneyManifest, manifestBlob = 'c7a015a9449578df7fbd325aae81f2d3795a4523';
  return {
      owner: 'ACCOUNT_2_PRODUCT', sourceOwnerRetained: 'ACCOUNT_2_PRODUCT', canonicalApiOwnerRetained: 'ACCOUNT_1_EXECUTION',
      purpose: 'Apply only the immutable four-file read-only BANK currency and selected-operation amount consistency payload plus its exact existing scope-manifest update.',
      authorityBaseExactMain, implementationBranch: bankMoneySourceBranch,
      allowedPaths: completedPaths, retainedAdmissionKey: priorKey, exactSourcePins: pins,
      exactManifestPath: manifestPath, baselineManifestBlob: manifestBlob,
      correctionPurposeKey: bankMoneyCorrectionKey,
      reviewedPrivatePayloadSha256: '8c05b77b82a722c6ca21118ed0b7c7dcc2dec549f93e4b77e6a2349a9b8ef06e',
      requiredTruthBoundaries: [
        'Preserve the seven-path prefix and every old admission byte/value. Append only two read-only web source/test paths; no server, provider, money mutation or legal authority.',
        'The source phase requires all four immutable100644 source transitions and only the exact accepted-manifest path/base transformation, unchanged state and genuine accepted-base ancestry.',
        'Preserve canonical GET-only Deal/tenant/participant permissions, UNKNOWN external outcome and all callback/outbox prerequisites. Currency/selected RESERVE and RELEASE amount conflicts cannot establish readiness or RELEASED.',
        'A released projection requires persisted payment reservation and the selected canonical RESERVE amount/currency, DONE status, confirmation timestamp and bank reference; missing/unconfirmed/newer-pending reserve evidence remains manual review.',
        'Fresh independent full current-head review, separate owner audit, every substantive native CI/security/readiness gate and ordinary expected-full-SHA merge remain mandatory. Private unit doubles are not PostgreSQL/browser/provider/Founder13/REG.RU acceptance.',
      ],
      forbiddenAuthority: ['API/DB/RLS/role/tenant/session/command/money/provider/FGIS/legal/model authority', 'Arbitrary source/scope/metadata changes', 'CI/security/readiness/review weakening or fake acceptance'],
    };
}
function extendBankMoney(context, mutate = () => {}) {
  const state = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimeStatePath), 'utf8'));
  state.approvedConcurrentScopes[bankMoneySourceBranch] = [...bankMoneyPaths];
  state.coordinationAdmissions[bankMoneyAdmissionKey] = bankMoneyRecord(context.baseline);
  mutate(state);
  write(context.root, dealRuntimeStatePath, JSON.stringify(state, null, 2) + '\n');
}
function bankMoneyFixture(t, { implementation = false, admitted = false, purpose = true, correction = true, mutateBase = () => {} } = {}) {
  const context = fixture(t, implementation ? bankMoneySourceBranch : bankMoneyAdmissionBranch);
  const state = {
    current: 'BANK unchanged fixture', fullTzReadinessPercent: 5, allowedCurrentScope: ['README.md'],
    approvedConcurrentScopes: {
      [bankMoneySourceBranch]: [...bankMoneyOldPaths],
      [bankMoneyAdmissionBranch]: [dealRuntimeStatePath],
      [bankMoneyPurpose.implementationBranch]: [...bankMoneyPurpose.allowedPaths],
    },
    coordinationAdmissions: {
      'bank-deep-visible-copy-guard-20260924-coordination': { ...structuredClone(bankMoneyPrior), authorityBaseExactMain: context.baseline },
      ...(purpose ? { [bankMoneyPurposeKey]: structuredClone(bankMoneyPurpose) } : {}),
      ...(correction ? { [bankMoneyCorrectionKey]: structuredClone(bankMoneyCorrectionPurpose) } : {}),
    },
  };
  mutateBase(state);
  for (const [file, before] of bankMoneyPins) write(context.root, file, actualLocaleBaselineBlob(before));
  write(context.root, bankMoneyManifest, actualLocaleBaselineBlob('c7a015a9449578df7fbd325aae81f2d3795a4523'));
  write(context.root, dealRuntimeStatePath, JSON.stringify(state, null, 2) + '\n');
  commit(context.root, 'genuine isolated baseline source blobs and accepted-purpose fixture');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  if (admitted) {
    extendBankMoney(context);
    commit(context.root, 'separate exact two-path BANK co-admission fixture');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  }
  return context;
}
function completeBankMoney(context) {
  const applied = spawnSync('git', ['apply', '--index', '--whitespace=nowarn', '-'], {
    cwd: context.root, input: bankMoneyPinnedPatch, encoding: 'utf8',
  });
  assert.equal(applied.status, 0, output(applied));
  const state = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimeStatePath), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(context.root, bankMoneyManifest), 'utf8'));
  manifest.allowedPaths = [...bankMoneyPaths];
  manifest.authorityBaseExactMain = state.coordinationAdmissions[bankMoneyAdmissionKey]?.authorityBaseExactMain ?? context.baseline;
  write(context.root, bankMoneyManifest, JSON.stringify(manifest, null, 2) + '\n');
  commit(context.root, 'actual immutable four-file BANK payload and exact manifest transform');
  for (const [file, before, after] of bankMoneyPins) {
    assert.equal(git(context.root, ['ls-tree', context.baseline, '--', file]), `100644 blob ${before}\t${file}`);
    assert.equal(git(context.root, ['ls-tree', 'HEAD', '--', file]), `100644 blob ${after}\t${file}`);
  }
}
function rejectBankMoney(context, pattern = /BANK_MONEY_|PRODUCT_|Mutable scope|outside current/u) {
  const result = runTrustedDealRuntimeGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), pattern);
}
test('BANK money: exact state-only co-admission preserves all seven paths and old admission', (t) => {
  const context = bankMoneyFixture(t);
  const before = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimeStatePath), 'utf8'));
  extendBankMoney(context);
  commit(context.root, 'exact BANK state-only co-admission');
  const result = runTrustedDealRuntimeGuard(context);
  assert.equal(result.status, 0, output(result));
  const after = JSON.parse(fs.readFileSync(path.join(context.root, dealRuntimeStatePath), 'utf8'));
  assert.deepEqual(after.coordinationAdmissions['bank-deep-visible-copy-guard-20260924-coordination'], before.coordinationAdmissions['bank-deep-visible-copy-guard-20260924-coordination']);
  assert.deepEqual(after.approvedConcurrentScopes[bankMoneySourceBranch].slice(0, 7), bankMoneyOldPaths);
  assert.equal(git(context.root, ['diff', '--name-status', `${context.baseline}...HEAD`]), `M\t${dealRuntimeStatePath}`);
});
const bankStateAttacks = [
  ['third permission', (s) => s.approvedConcurrentScopes[bankMoneySourceBranch].push('apps/api/src/app.module.ts')],
  ['removed old path', (s) => s.approvedConcurrentScopes[bankMoneySourceBranch].shift()],
  ['reordered old prefix', (s) => s.approvedConcurrentScopes[bankMoneySourceBranch].reverse()],
  ['duplicate added path', (s) => s.approvedConcurrentScopes[bankMoneySourceBranch].push(bankMoneyPaths.at(-1))],
  ['old source owner', (s) => { s.coordinationAdmissions['bank-deep-visible-copy-guard-20260924-coordination'].owner = 'ACCOUNT_1_EXECUTION'; }],
  ['new source owner', (s) => { s.coordinationAdmissions[bankMoneyAdmissionKey].sourceOwnerRetained = 'ACCOUNT_1_EXECUTION'; }],
  ['new semantic owner', (s) => { s.coordinationAdmissions[bankMoneyAdmissionKey].owner = 'ACCOUNT_1_EXECUTION'; }],
  ['canonical API owner', (s) => { s.coordinationAdmissions[bankMoneyAdmissionKey].canonicalApiOwnerRetained = 'ACCOUNT_2_PRODUCT'; }],
  ['wrong actual base', (s) => { s.coordinationAdmissions[bankMoneyAdmissionKey].authorityBaseExactMain = '0'.repeat(40); }],
  ['changed immutable pin', (s) => { s.coordinationAdmissions[bankMoneyAdmissionKey].exactSourcePins[0][2] = '0'.repeat(40); }],
  ['weakened boundary', (s) => { s.coordinationAdmissions[bankMoneyAdmissionKey].requiredTruthBoundaries = []; }],
  ['changed manifest pin', (s) => { s.coordinationAdmissions[bankMoneyAdmissionKey].baselineManifestBlob = '0'.repeat(40); }],
  ['global authority', (s) => s.allowedCurrentScope.push('**')],
  ['false progress', (s) => { s.fullTzReadinessPercent = 100; }],
  ['extra grant field', (s) => { s.coordinationAdmissions[bankMoneyAdmissionKey].grantApiAuthority = true; }],
];
for (const [name, mutate] of bankStateAttacks) test('BANK money: co-admission rejects ' + name, (t) => {
  const context = bankMoneyFixture(t);
  extendBankMoney(context, mutate);
  commit(context.root, 'invalid BANK state: ' + name);
  rejectBankMoney(context, /BANK_MONEY_ADMISSION_STATE_MUTATION/u);
});
const bankTextAttacks = [
  ['compact old bytes', (raw) => JSON.stringify(JSON.parse(raw)) + '\n'],
  ['reordered old keys', (raw) => JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(raw)).reverse()), null, 2) + '\n'],
  ['duplicate old progress key', (raw) => raw.replace('  "fullTzReadinessPercent": 5,', '  "fullTzReadinessPercent": 100,\n  "fullTzReadinessPercent": 5,')],
  ['escaped old key', (raw) => raw.replace('  "current":', '  "\\u0063urrent":')],
];
for (const [name, attack] of bankTextAttacks) test('BANK money: byte preservation rejects ' + name, (t) => {
  const context = bankMoneyFixture(t); extendBankMoney(context);
  const target = path.join(context.root, dealRuntimeStatePath), valid = fs.readFileSync(target, 'utf8');
  const changed = attack(valid); assert.notEqual(changed, valid); assert.deepEqual(JSON.parse(changed), JSON.parse(valid));
  fs.writeFileSync(target, changed); commit(context.root, 'same values with altered old bytes');
  rejectBankMoney(context, /BANK_MONEY_ADMISSION_TEXT_MUTATION/u);
  const trusted = git(context.root, ['show', `${context.baseline}:scripts/p7-autopilot-guard.sh`]);
  const predicate = "if (candidateText !== exact) throw new Error('BANK_MONEY_ADMISSION_TEXT_MUTATION');";
  assert.equal(trusted.split(predicate).length, 2);
  const bypass = path.join(context.root, '.git', 'BANK-byte-only-bypass.sh');
  fs.writeFileSync(bypass, trusted.replace(predicate, ''));
  const control = spawnSync('bash', [bypass], { cwd: context.root, env: { ...process.env, BASE_REF: context.baseline, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: context.implementationBranch }, encoding: 'utf8' });
  assert.equal(control.status, 0, output(control));
});
test('BANK money: purpose is required from trusted base, not candidate', (t) => {
  const context = bankMoneyFixture(t, { purpose: false });
  extendBankMoney(context, (s) => { s.coordinationAdmissions[bankMoneyPurposeKey] = structuredClone(bankMoneyPurpose); });
  commit(context.root, 'candidate fabricated purpose'); rejectBankMoney(context);
});
test('BANK money: altered accepted purpose is rejected', (t) => {
  const context = bankMoneyFixture(t, { mutateBase: (s) => { s.coordinationAdmissions[bankMoneyPurposeKey].owner = 'ACCOUNT_2_PRODUCT'; } });
  extendBankMoney(context); commit(context.root, 'altered accepted purpose'); rejectBankMoney(context, /BANK_MONEY_PURPOSE_MISMATCH/u);
});
test('BANK money: mixed state/source co-admission is rejected', (t) => {
  const context = bankMoneyFixture(t); extendBankMoney(context);
  write(context.root, bankMoneyPins[0][0], 'mixed source\n'); commit(context.root, 'mixed phase');
  rejectBankMoney(context, /BANK_MONEY_ADMISSION_DIFF_SCOPE/u);
});
for (const mode of ['100755', '120000']) test('BANK money: exact state bytes with mode ' + mode + ' reject before diff-type checks', (t) => {
  const context = bankMoneyFixture(t); extendBankMoney(context); commit(context.root, 'exact state bytes');
  const blob = git(context.root, ['rev-parse', 'HEAD:' + dealRuntimeStatePath]);
  git(context.root, ['update-index', '--cacheinfo', `${mode},${blob},${dealRuntimeStatePath}`]);
  git(context.root, ['commit', '-m', 'isolated bad state mode']);
  rejectBankMoney(context, /BANK_MONEY_ADMISSION_MODE/u);
});
test('BANK money: all four actual source pins and exact existing manifest pass', (t) => {
  const context = bankMoneyFixture(t, { implementation: true, admitted: true }); completeBankMoney(context);
  const result = runTrustedDealRuntimeGuard(context); assert.equal(result.status, 0, output(result));
  assert.equal(git(context.root, ['diff', '--name-only', `${context.baseline}...HEAD`]).split('\n').length, 5);
});
test('BANK money: accepted purpose alone cannot admit source', (t) => {
  const context = bankMoneyFixture(t, { implementation: true }); completeBankMoney(context);
  rejectBankMoney(context, /BANK_MONEY_ACCEPTED_ADMISSION_MISMATCH/u);
});
const bankSourceAttacks = [
  ['different source bytes', (c) => write(c.root, bankMoneyPins[0][0], 'wrong candidate\n')],
  ['missing amount server repair', (c) => write(c.root, bankMoneyPins[0][0], actualLocaleBaselineBlob(bankMoneyPins[0][1]))],
  ['server-only two-file adoption', (c) => { for (const [file, before] of bankMoneyPins.slice(2)) write(c.root, file, actualLocaleBaselineBlob(before)); }],
  ['extra old permitted source', (c) => write(c.root, bankMoneyOldPaths[0], 'extra immutable-phase source\n')],
  ['candidate-owned state', (c) => { const p = path.join(c.root, dealRuntimeStatePath); const s = JSON.parse(fs.readFileSync(p,'utf8'));s.approvedConcurrentScopes[bankMoneySourceBranch].push('apps/api/**');fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n'); }],
  ['arbitrary manifest authority', (c) => { const p=path.join(c.root,bankMoneyManifest);const s=JSON.parse(fs.readFileSync(p,'utf8'));s.newRecurringCostRub=100;fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n'); }],
  ['reserialized manifest bytes', (c) => { const p=path.join(c.root,bankMoneyManifest);fs.writeFileSync(p,JSON.stringify(JSON.parse(fs.readFileSync(p,'utf8')))+'\n'); }],
  ['duplicate manifest key', (c) => { const p=path.join(c.root,bankMoneyManifest);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('  "status": "active",','  "status": "inactive",\n  "status": "active",')); }],
  ['missing manifest transition', (c) => write(c.root,bankMoneyManifest,actualLocaleBaselineBlob('c7a015a9449578df7fbd325aae81f2d3795a4523'))],
];
for (const [name, mutate] of bankSourceAttacks) test('BANK money: completed immutable source rejects ' + name, (t) => {
  const context=bankMoneyFixture(t,{implementation:true,admitted:true});completeBankMoney(context);mutate(context);commit(context.root,'source attack: '+name);rejectBankMoney(context);
});
for (const mode of ['100755','120000']) test('BANK money: actual source blob with mode ' + mode + ' fails its regular-mode predicate', (t) => {
  const context=bankMoneyFixture(t,{implementation:true,admitted:true});completeBankMoney(context);
  const [file,,sha]=bankMoneyPins[0];git(context.root,['update-index','--cacheinfo',`${mode},${sha},${file}`]);git(context.root,['commit','-m','exact blob with wrong mode']);
  rejectBankMoney(context,/BANK_MONEY_SOURCE_PIN_OR_MODE/u);
  if(mode==='100755') {
    const trusted=git(context.root,['show',`${context.baseline}:scripts/p7-autopilot-guard.sh`]);
    const strict='entry(headRef, file) !== `100644 blob ${after}\\t${file}`';
    assert.equal(trusted.split(strict).length,2);
    const bypass=path.join(context.root,'.git','BANK-source-mode-only-bypass.sh');
    fs.writeFileSync(bypass,trusted.replace(strict,'entry(headRef, file).slice(7) !== `blob ${after}\\t${file}`'));
    const control=spawnSync('bash',[bypass],{cwd:context.root,env:{...process.env,BASE_REF:context.baseline,HEAD_REF:'HEAD',GITHUB_HEAD_REF:context.implementationBranch},encoding:'utf8'});
    assert.equal(control.status,0,'remove only candidate source mode comparison: '+output(control));
  }
});
test('BANK money: wrong admitted base cannot pass ancestry', (t) => {
  const context=bankMoneyFixture(t,{implementation:true,admitted:true});
  const p=path.join(context.root,dealRuntimeStatePath),s=JSON.parse(fs.readFileSync(p,'utf8'));
  s.coordinationAdmissions[bankMoneyAdmissionKey].authorityBaseExactMain='0'.repeat(40);
  fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n');commit(context.root,'wrong accepted-base fixture precondition');context.baseline=git(context.root,['rev-parse','HEAD']);
  completeBankMoney(context);rejectBankMoney(context,/BANK_MONEY_ADMISSION_BASE_NOT_ANCESTOR/u);
});
// Independent correction-purpose and defective-source controls.
test('BANK reserve correction: missing trusted correction cannot admit paths', (t) => {
  const context = bankMoneyFixture(t, { correction: false });
  extendBankMoney(context); commit(context.root, 'missing trusted correction');
  rejectBankMoney(context, /BANK_MONEY_CORRECTION_PURPOSE_MISMATCH/u);
  const trusted = git(context.root, ['show', `${context.baseline}:scripts/p7-autopilot-guard.sh`]);
  const predicate = "    if (!isDeepStrictEqual(state.coordinationAdmissions[bankMoneyCorrectionKey], requiredCorrectionPurpose)) {\n      throw new Error('BANK_MONEY_CORRECTION_PURPOSE_MISMATCH');\n    }";
  assert.equal(trusted.split(predicate).length, 2);
  const bypass = path.join(context.root, '.git', 'BANK-correction-only-control.sh');
  fs.writeFileSync(bypass, trusted.replace(predicate, ''));
  const control = spawnSync('bash', [bypass], { cwd: context.root, env: { ...process.env, BASE_REF: context.baseline, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: context.implementationBranch }, encoding: 'utf8' });
  assert.equal(control.status, 0, 'remove only accepted-BASE correction comparison: ' + output(control));
});
test('BANK reserve correction: candidate-only correction cannot self-admit', (t) => {
  const context = bankMoneyFixture(t, { correction: false });
  extendBankMoney(context, (s) => { s.coordinationAdmissions[bankMoneyCorrectionKey] = structuredClone(bankMoneyCorrectionPurpose); });
  commit(context.root, 'candidate self-admission');
  rejectBankMoney(context, /BANK_MONEY_CORRECTION_PURPOSE_MISMATCH/u);
});
const bankCorrectionAttacks = [
  ['execution owner', (p) => { p.owner = 'ACCOUNT_2_PRODUCT'; }],
  ['source owner', (p) => { p.sourceOwnerRetained = 'ACCOUNT_1_EXECUTION'; }],
  ['allowed paths', (p) => { p.allowedPaths.push('apps/api/**'); }],
  ['original purpose', (p) => { p.priorPurposeKey = 'candidate-owned'; }],
  ['defective server pin', (p) => { p.immutableSourcePins[0][2] = '6ae431216dce41f07d6c73a8b3fe4231bd4c540d'; }],
  ['defective test pin', (p) => { p.immutableSourcePins[1][2] = 'fe1c8bc089be2b409ad65837a4ba3985edbfb619'; }],
  ['source payload hash', (p) => { p.reviewedPrivatePayload.sha256 = '0'.repeat(64); }],
  ['source authority', (p) => { p.grantSourceAuthority = true; }],
];
for (const [name, attack] of bankCorrectionAttacks) test('BANK reserve correction: changed BASE ' + name + ' is rejected', (t) => {
  const context = bankMoneyFixture(t, { mutateBase: (s) => attack(s.coordinationAdmissions[bankMoneyCorrectionKey]) });
  extendBankMoney(context); commit(context.root, 'mutated correction BASE fixture');
  rejectBankMoney(context, /BANK_MONEY_CORRECTION_PURPOSE_MISMATCH/u);
});
const bankMoneyPriorPrivateSources = new Map(JSON.parse(inflateSync(Buffer.from('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', 'base64')).toString('utf8')).map((item) => {
  const bytes = Buffer.from(item.content);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), item.blob);
  return [item.blob, bytes];
}));
for (const [index, oldBlob] of [[0, '6ae431216dce41f07d6c73a8b3fe4231bd4c540d'], [1, 'fe1c8bc089be2b409ad65837a4ba3985edbfb619']]) {
  test('BANK reserve correction: old defective private source ' + index + ' cannot be admitted', (t) => {
    const context = bankMoneyFixture(t, { implementation: true, admitted: true }); completeBankMoney(context);
    write(context.root, bankMoneyPins[index][0], bankMoneyPriorPrivateSources.get(oldBlob));
    commit(context.root, 'restore actual old defective private blob');
    assert.equal(git(context.root, ['rev-parse', 'HEAD:' + bankMoneyPins[index][0]]), oldBlob);
    rejectBankMoney(context, /BANK_MONEY_SOURCE_PIN_OR_MODE/u);
  });
}

// Actual accepted/candidate route bytes: portable private Git fixture data, not native acceptance.
const routeActualBlobs = new Map([{"blob":"b9b96c88695c7960a309e98e691c348fec03a2b0","content":"const DESIGN_SYSTEM_V8_EXACT_ROUTES = new Set([\n  '/platform-v7/control-tower',\n  '/platform-v7/status',\n  '/platform-v7/health',\n  '/platform-v7/audit-log',\n  '/platform-v7/connectors',\n  '/platform-v7/integrations',\n  '/platform-v7/api-docs',\n  '/platform-v7/profile',\n  '/platform-v7/profile/team',\n  '/platform-v7/reports',\n  '/platform-v7/onboarding',\n  '/platform-v7/notifications',\n  '/platform-v7/operator',\n  '/platform-v7/operator-cockpit/queues',\n  '/platform-v7/buyer',\n  '/platform-v7/buyer/financing',\n  '/platform-v7/buyer/reputation',\n  '/platform-v7/seller',\n  '/platform-v7/seller/rfq',\n  '/platform-v7/seller/reputation',\n  '/platform-v7/logistics',\n  '/platform-v7/driver',\n  '/platform-v7/driver/field',\n  '/platform-v7/elevator',\n  '/platform-v7/lab',\n  '/platform-v7/surveyor',\n  '/platform-v7/bank',\n  '/platform-v7/compliance',\n  '/platform-v7/arbitrator',\n  '/platform-v7/executive',\n  '/platform-v7/deals',\n  '/platform-v7/commodity-profiles',\n  '/platform-v7/documents',\n  '/platform-v7/disputes',\n  '/platform-v7/money',\n  '/platform-v7/accounting',\n  '/platform-v7/bank/release-safety',\n  '/platform-v7/fgis-access',\n  '/platform-v7/deal-logistics',\n  '/platform-v7/deal-acceptance',\n  '/platform-v7/deal-documents-basis',\n]);\n\nconst DESIGN_SYSTEM_V8_PREFIX_ROUTES = [\n  '/platform-v7/deals/',\n  '/platform-v7/commodity-profiles',\n  '/platform-v7/integrations',\n  '/platform-v7/auction',\n  '/platform-v7/buyer/rfq',\n  '/platform-v7/bank',\n  '/platform-v7/logistics',\n] as const;\n\n// Routes with an identifier in the middle, which neither an exact entry nor a\n// prefix can express. A prefix of '/platform-v7/deals' would sweep every deal\n// sub-route into the v8 class, which is a decision about somebody else's\n// screens and not one this registration is entitled to make. Anchored at both\n// ends so a longer path is not admitted by accident.\nconst DESIGN_SYSTEM_V8_DYNAMIC_ROUTES = [\n  /^\\/platform-v7\\/deals\\/[^/]+\\/accounting$/,\n] as const;\n\nfunction normalizePath(value: string | null | undefined): string {\n  return (value || '').split('?')[0].replace(/\\/$/, '') || '/platform-v7';\n}\n\nexport function isDesignSystemV8Route(value: string | null | undefined): boolean {\n  const pathname = normalizePath(value);\n  return DESIGN_SYSTEM_V8_EXACT_ROUTES.has(pathname)\n    || DESIGN_SYSTEM_V8_PREFIX_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))\n    || DESIGN_SYSTEM_V8_DYNAMIC_ROUTES.some((pattern) => pattern.test(pathname));\n}\n\n// The inventory carries the dynamic class too, as pattern sources rather than\n// RegExp objects so it stays serialisable. A matcher present at runtime and\n// absent from the published policy would make the policy a partial account of\n// itself, and everything that audits this file audits the wrong thing.\nexport const DESIGN_SYSTEM_V8_ROUTE_POLICY = Object.freeze({\n  exact: Object.freeze([...DESIGN_SYSTEM_V8_EXACT_ROUTES]),\n  prefixes: Object.freeze([...DESIGN_SYSTEM_V8_PREFIX_ROUTES]),\n  dynamic: Object.freeze(DESIGN_SYSTEM_V8_DYNAMIC_ROUTES.map((pattern) => pattern.source)),\n});\n"},{"blob":"d94cc0d0af208fd6faea32e321a136629bef44f8","content":"const DESIGN_SYSTEM_V8_EXACT_ROUTES = new Set([\n  '/platform-v7/control-tower',\n  '/platform-v7/status',\n  '/platform-v7/health',\n  '/platform-v7/audit-log',\n  '/platform-v7/connectors',\n  '/platform-v7/integrations',\n  '/platform-v7/api-docs',\n  '/platform-v7/profile',\n  '/platform-v7/profile/team',\n  '/platform-v7/reports',\n  '/platform-v7/onboarding',\n  '/platform-v7/notifications',\n  '/platform-v7/operator',\n  '/platform-v7/operator-cockpit/queues',\n  '/platform-v7/buyer',\n  '/platform-v7/buyer/financing',\n  '/platform-v7/buyer/reputation',\n  '/platform-v7/seller',\n  '/platform-v7/seller/rfq',\n  '/platform-v7/seller/reputation',\n  '/platform-v7/logistics',\n  '/platform-v7/driver',\n  '/platform-v7/driver/field',\n  '/platform-v7/elevator',\n  '/platform-v7/lab',\n  '/platform-v7/surveyor',\n  '/platform-v7/bank',\n  '/platform-v7/compliance',\n  '/platform-v7/arbitrator',\n  '/platform-v7/executive',\n  '/platform-v7/deals',\n  '/platform-v7/commodity-profiles',\n  '/platform-v7/documents',\n  '/platform-v7/disputes',\n  '/platform-v7/money',\n  '/platform-v7/accounting',\n  '/platform-v7/bank/release-safety',\n  '/platform-v7/fgis-access',\n  '/platform-v7/deal-logistics',\n  '/platform-v7/deal-acceptance',\n  '/platform-v7/deal-documents-basis',\n]);\n\nconst DESIGN_SYSTEM_V8_PREFIX_ROUTES = [\n  '/platform-v7/commodity-profiles',\n  '/platform-v7/integrations',\n  '/platform-v7/auction',\n  '/platform-v7/buyer/rfq',\n  '/platform-v7/bank',\n  '/platform-v7/logistics',\n] as const;\n\n// Routes with an identifier in the middle, which neither an exact entry nor a\n// prefix can express. A prefix of '/platform-v7/deals' would sweep every deal\n// sub-route into the v8 class, which is a decision about somebody else's\n// screens and not one this registration is entitled to make. Anchored at both\n// ends so a longer path is not admitted by accident.\nconst DESIGN_SYSTEM_V8_DYNAMIC_ROUTES = [\n  /^\\/platform-v7\\/deals\\/[^/]+\\/accounting$/,\n  /^\\/platform-v7\\/deals\\/[^/]+\\/execution$/,\n] as const;\n\nfunction normalizePath(value: string | null | undefined): string {\n  return (value || '').split('?')[0].replace(/\\/$/, '') || '/platform-v7';\n}\n\nexport function isDesignSystemV8Route(value: string | null | undefined): boolean {\n  const pathname = normalizePath(value);\n  return DESIGN_SYSTEM_V8_EXACT_ROUTES.has(pathname)\n    || DESIGN_SYSTEM_V8_PREFIX_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))\n    || DESIGN_SYSTEM_V8_DYNAMIC_ROUTES.some((pattern) => pattern.test(pathname));\n}\n\n// The inventory carries the dynamic class too, as pattern sources rather than\n// RegExp objects so it stays serialisable. A matcher present at runtime and\n// absent from the published policy would make the policy a partial account of\n// itself, and everything that audits this file audits the wrong thing.\nexport const DESIGN_SYSTEM_V8_ROUTE_POLICY = Object.freeze({\n  exact: Object.freeze([...DESIGN_SYSTEM_V8_EXACT_ROUTES]),\n  prefixes: Object.freeze([...DESIGN_SYSTEM_V8_PREFIX_ROUTES]),\n  dynamic: Object.freeze(DESIGN_SYSTEM_V8_DYNAMIC_ROUTES.map((pattern) => pattern.source)),\n});\n"},{"blob":"87ebc91bcc9a927dd6ad2d6f9afdfff8737d47bd","content":"import { describe, expect, it } from 'vitest';\nimport { canRoleAccessCabinet } from '../../lib/platform-v7/cabinet-access-policy';\nimport { isDesignSystemV8Route } from '../../lib/platform-v7/design-system-v8-route-policy';\nimport { platformV7RoleCanOpenHref } from '../../lib/platform-v7/shellRoutes';\n\n/**\n * Who can open the accounting surface, and whether it is reachable at all.\n *\n * The second question is not rhetorical. `apps/web/app/platform-v7/layout.tsx`\n * calls `notFound()` for any path the route policy does not know, before it\n * ever looks at a role — so a page that exists on disk and is absent from the\n * policy is a 404 with a file behind it. That is exactly what the accounting\n * board was until the route was registered, and this test is what fails if the\n * registration is lost again.\n *\n * The role fence here is the coarse one. The server decides for real: the API\n * answers 403 for a membership without accounting capability, and no client\n * list can grant what the server refuses. This one exists so a role that will\n * be refused anyway is not walked into a dead screen first.\n */\n\nconst ACCOUNTING = '/platform-v7/accounting';\nconst DEAL_ACCOUNTING = '/platform-v7/deals/D-2026-1/accounting';\n\ndescribe('platform-v7 accounting route access', () => {\n  it('registers both accounting routes in the design system v8 route class', () => {\n    expect(isDesignSystemV8Route(ACCOUNTING)).toBe(true);\n    expect(isDesignSystemV8Route(DEAL_ACCOUNTING)).toBe(true);\n  });\n\n  it('lets the roles that carry accounting work open the surface', () => {\n    for (const role of ['seller', 'buyer'] as const) {\n      expect(platformV7RoleCanOpenHref(role, ACCOUNTING)).toBe(true);\n      expect(canRoleAccessCabinet(role, ACCOUNTING)).toBe(true);\n      expect(canRoleAccessCabinet(role, DEAL_ACCOUNTING)).toBe(true);\n    }\n  });\n\n  it('keeps oversight roles able to open it without a per-role entry', () => {\n    for (const role of ['operator', 'executive'] as const) {\n      expect(canRoleAccessCabinet(role, ACCOUNTING)).toBe(true);\n    }\n  });\n\n  it('does not hand the surface to field roles that have no accounting work', () => {\n    for (const role of ['driver', 'lab', 'surveyor'] as const) {\n      expect(canRoleAccessCabinet(role, ACCOUNTING)).toBe(false);\n    }\n  });\n});\n"},{"blob":"a1290dc9b3ba122de480200ff5efa86445b5fe66","content":"import { describe, expect, it } from 'vitest';\nimport { canRoleAccessCabinet } from '../../lib/platform-v7/cabinet-access-policy';\nimport { isDesignSystemV8Route } from '../../lib/platform-v7/design-system-v8-route-policy';\nimport { platformV7RoleCanOpenHref } from '../../lib/platform-v7/shellRoutes';\n\n/**\n * Who can open the accounting surface, and whether it is reachable at all.\n *\n * The second question is not rhetorical. `apps/web/app/platform-v7/layout.tsx`\n * calls `notFound()` for any path the route policy does not know, before it\n * ever looks at a role — so a page that exists on disk and is absent from the\n * policy is a 404 with a file behind it. That is exactly what the accounting\n * board was until the route was registered, and this test is what fails if the\n * registration is lost again.\n *\n * The role fence here is the coarse one. The server decides for real: the API\n * answers 403 for a membership without accounting capability, and no client\n * list can grant what the server refuses. This one exists so a role that will\n * be refused anyway is not walked into a dead screen first.\n */\n\nconst ACCOUNTING = '/platform-v7/accounting';\nconst DEAL_ACCOUNTING = '/platform-v7/deals/D-2026-1/accounting';\n\ndescribe('platform-v7 accounting route access', () => {\n  it('registers both accounting routes in the design system v8 route class', () => {\n    expect(isDesignSystemV8Route(ACCOUNTING)).toBe(true);\n    expect(isDesignSystemV8Route(DEAL_ACCOUNTING)).toBe(true);\n  });\n\n  it('lets the roles that carry accounting work open the surface', () => {\n    for (const role of ['seller', 'buyer'] as const) {\n      expect(platformV7RoleCanOpenHref(role, ACCOUNTING)).toBe(true);\n      expect(canRoleAccessCabinet(role, ACCOUNTING)).toBe(true);\n      expect(canRoleAccessCabinet(role, DEAL_ACCOUNTING)).toBe(true);\n    }\n  });\n\n  it('keeps oversight roles able to open it without a per-role entry', () => {\n    for (const role of ['operator', 'executive'] as const) {\n      expect(canRoleAccessCabinet(role, ACCOUNTING)).toBe(true);\n    }\n  });\n\n  it('does not hand the surface to field roles that have no accounting work', () => {\n    for (const role of ['driver', 'lab', 'surveyor'] as const) {\n      expect(canRoleAccessCabinet(role, ACCOUNTING)).toBe(false);\n    }\n  });\n});\n\ndescribe('canonical Deal execution route registration', () => {\n  const dealId = 'dsv8-ready-bank-046f2994-08e4-4f67-8958-533c4c03bf5d';\n  const route = `/platform-v7/deals/${dealId}/execution`;\n\n  it('admits the real protected execution destination before the layout role check', () => {\n    for (const locale of ['ru', 'en', 'zh']) {\n      expect(isDesignSystemV8Route(`${route}?lang=${locale}`)).toBe(true);\n    }\n    expect(isDesignSystemV8Route(route + '/')).toBe(true);\n    expect(isDesignSystemV8Route('/platform-v7/deals/D-2026-1/execution')).toBe(true);\n  });\n\n  it('preserves existing bank and participant cabinet permissions', () => {\n    for (const role of ['bank', 'seller', 'buyer'] as const) {\n      expect(platformV7RoleCanOpenHref(role, route)).toBe(true);\n      expect(canRoleAccessCabinet(role, route)).toBe(true);\n    }\n    for (const role of ['driver', 'lab', 'surveyor'] as const) {\n      expect(canRoleAccessCabinet(role, DEAL_ACCOUNTING)).toBe(false);\n    }\n  });\n\n  it('does not admit sibling, missing-id or longer execution paths', () => {\n    for (const unknown of [\n      '/platform-v7/deals/execution',\n      '/platform-v7/deals//execution',\n      route + '/unknown',\n      route + '-unknown',\n      '/platform-v7/deals/D-2026-1/unknown',\n      '/platform-v7/deals/D-2026-1/execution/commands',\n    ]) expect(isDesignSystemV8Route(unknown)).toBe(false);\n  });\n});\n"},{"blob":"0e7d10b62a722802c76e73f2eb2e618953a383c5","content":"import fs from 'node:fs';\nimport path from 'node:path';\nimport { describe, expect, it } from 'vitest';\nimport { isDesignSystemV8Route } from '../../lib/platform-v7/design-system-v8-route-policy';\n\nconst root = process.cwd();\nconst absolute = (relativePath: string) => path.join(root, relativePath);\nconst read = (relativePath: string) => fs.readFileSync(absolute(relativePath), 'utf8');\n\nconst layout = read('apps/web/app/platform-v7/layout.tsx');\nconst template = read('apps/web/app/platform-v7/template.tsx');\nconst controlTower = read('apps/web/app/platform-v7/control-tower/page.tsx');\nconst routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');\nconst v8Runtime = read('apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx');\nconst fixedHeaderContract = read('apps/web/app/platform-v7/_styles/fixed-header-contract.css');\n\nconst removedRuntimeFiles = [\n  'apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx',\n  'apps/web/components/platform-v7/PlatformV7ProtectedTemplateRuntime.tsx',\n  'apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx',\n  'apps/web/components/platform-v7/PlatformV7TemplateSwitch.tsx',\n  'apps/web/components/platform-v7/PlatformV7ProductionCopyPatch.tsx',\n  'apps/web/components/platform-v7/PlatformV7ScrollRestorationGuard.tsx',\n];\n\nconst roleRoutes = [\n  'operator', 'buyer', 'seller', 'logistics', 'driver', 'elevator',\n  'lab', 'surveyor', 'bank', 'compliance', 'arbitrator', 'executive',\n];\n\nconst criticalRoutes = [\n  '/platform-v7/control-tower',\n  '/platform-v7/deals',\n  '/platform-v7/documents',\n  '/platform-v7/disputes',\n  '/platform-v7/money',\n  '/platform-v7/bank/release-safety',\n  '/platform-v7/fgis-access',\n  '/platform-v7/deal-logistics',\n  '/platform-v7/deal-acceptance',\n  '/platform-v7/deal-documents-basis',\n];\n\nfunction quotedRoutes(block: string): string[] {\n  return [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]);\n}\n\nfunction extractPublicPolicy(): { exact: Set<string>; prefixes: string[] } {\n  const exactBlock = layout.match(/const PUBLIC_EXACT_PATHS = new Set\\(\\[([\\s\\S]*?)\\]\\);/)?.[1] ?? '';\n  const prefixBlock = layout.match(/const PUBLIC_PREFIX_PATHS = \\[([\\s\\S]*?)\\];/)?.[1] ?? '';\n  return {\n    exact: new Set([\n      '/platform-v7',\n      '/platform-v7/login',\n      '/platform-v7/forgot-password',\n      ...quotedRoutes(exactBlock),\n    ]),\n    prefixes: quotedRoutes(prefixBlock),\n  };\n}\n\nfunction extractStaffPrefix(): string {\n  return layout.match(/const STAFF_PREFIX = '([^']+)'/)?.[1] ?? '';\n}\n\nfunction extractExactAliases(): Set<string> {\n  const block = layout.match(/const ALIAS_EXACT_PATHS = new Set\\(\\[([\\s\\S]*?)\\]\\);/)?.[1] ?? '';\n  return new Set(quotedRoutes(block));\n}\n\nfunction extractDynamicAliases(): RegExp[] {\n  const block = layout.match(/const ALIAS_DYNAMIC_PATHS = \\[([\\s\\S]*?)\\] as const;/)?.[1] ?? '';\n  return block\n    .split('\\n')\n    .map((line) => line.trim().replace(/,$/, ''))\n    .filter((line) => line.startsWith('/^') && line.endsWith('/'))\n    .map((line) => new RegExp(line.slice(1, -1)));\n}\n\nfunction walkPages(directory: string, output: string[] = []): string[] {\n  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {\n    const child = path.join(directory, entry.name);\n    if (entry.isDirectory()) walkPages(child, output);\n    else if (entry.isFile() && entry.name === 'page.tsx') output.push(child);\n  }\n  return output;\n}\n\nfunction routeFromPage(pagePath: string): string {\n  const appRoot = absolute('apps/web/app/platform-v7');\n  const segments = path.relative(appRoot, pagePath).split(path.sep);\n  segments.pop();\n  const routeSegments = segments.filter((segment) => !/^\\(.+\\)$/.test(segment) && !segment.startsWith('@'));\n  return ['/platform-v7', ...routeSegments].join('/').replace(/\\/$/, '') || '/platform-v7';\n}\n\nfunction sampleRoute(route: string): string {\n  return route.replace(/\\[[^/]+\\]/g, 'sample-id');\n}\n\nfunction matchesPrefix(route: string, prefix: string): boolean {\n  return Boolean(prefix) && (route === prefix || route.startsWith(`${prefix}/`));\n}\n\ndescribe('platform-v7 Design System v8 runtime isolation', () => {\n  it('registers all twelve role roots and accepted transaction routes in one server-safe policy', () => {\n    for (const role of roleRoutes) expect(routePolicy).toContain(`'/platform-v7/${role}'`);\n    for (const route of criticalRoutes) expect(routePolicy).toContain(`'${route}'`);\n    expect(routePolicy).toContain(\"'/platform-v7/deals/'\");\n    expect(routePolicy).toContain(\"'/platform-v7/auction'\");\n    expect(routePolicy).toContain('isDesignSystemV8Route');\n    expect(routePolicy).not.toContain(\"'use client'\");\n    expect(routePolicy).not.toContain('window.');\n    expect(routePolicy).not.toContain('document.');\n  });\n\n  it('fails unknown paths before auth and selects the v8 boundary only after verified role enforcement', () => {\n    expect(layout).toContain(\"from '@/lib/platform-v7/design-system-v8-route-policy'\");\n    expect(layout).toContain('if (!isKnownProtectedPath(pathname)) notFound()');\n    expect(layout).toContain('if (!role) redirect');\n    expect(layout).toContain('if (!canRoleAccessCabinet(role, pathname))');\n    expect(layout).toContain(\"await import('@/components/platform-v7/PlatformV7ProtectedRuntime')\");\n    expect(layout).toContain(\"await import('@/components/platform-v7/PlatformV7DesignSystemV8Runtime')\");\n    expect(layout).toContain('<PlatformV7DesignSystemV8Runtime>{protectedContent}</PlatformV7DesignSystemV8Runtime>');\n    expect(layout).toContain('if (!isDesignSystemV8Route(pathname)) return protectedContent');\n    expect(layout.indexOf('if (!isKnownProtectedPath(pathname)) notFound()')).toBeLessThan(\n      layout.indexOf('if (!role) redirect'),\n    );\n    expect(layout.indexOf('if (!role) redirect')).toBeLessThan(\n      layout.indexOf('if (!isDesignSystemV8Route(pathname)) return protectedContent'),\n    );\n    expect(layout).not.toContain('PlatformV7FullStyleRuntime');\n  });\n\n  it('keeps every server redirect route reachable through an explicit route class', () => {\n    const publicPolicy = extractPublicPolicy();\n    const staffPrefix = extractStaffPrefix();\n    const exactAliases = extractExactAliases();\n    const dynamicAliases = extractDynamicAliases();\n    const redirectRoutes = walkPages(absolute('apps/web/app/platform-v7'))\n      .filter((pagePath) => /\\bredirect\\s*\\(/.test(fs.readFileSync(pagePath, 'utf8')))\n      .map(routeFromPage);\n\n    expect(staffPrefix).toBe('/platform-v7/staff');\n\n    for (const route of redirectRoutes) {\n      const sample = sampleRoute(route);\n      const publicRoute = publicPolicy.exact.has(route)\n        || publicPolicy.prefixes.some((prefix) => matchesPrefix(sample, prefix));\n      const covered = publicRoute\n        || matchesPrefix(sample, staffPrefix)\n        || isDesignSystemV8Route(sample)\n        || exactAliases.has(route)\n        || dynamicAliases.some((pattern) => pattern.test(sample));\n      expect(covered, `redirect route is absent from route policy: ${route}`).toBe(true);\n    }\n  });\n\n  it('keeps the route template free of client guards and mutation repair', () => {\n    expect(template).toContain('return children');\n    expect(template).not.toContain(\"'use client'\");\n    expect(template).not.toContain('headers()');\n    expect(template).not.toContain('PlatformV7ProtectedTemplateRuntime');\n    expect(template).not.toContain('PlatformV7TemplateGuards');\n  });\n\n  it('physically removes historical runtime, copy-repair and scroll-polling files', () => {\n    for (const file of removedRuntimeFiles) expect(fs.existsSync(absolute(file))).toBe(false);\n  });\n\n  it('keeps the governed runtime token-only, hydration-safe and free of DOM/style repair code', () => {\n    expect(v8Runtime).toContain('packages/design-tokens/tokens.css');\n    expect(v8Runtime).not.toContain('<HydrationSafeChatSupport />');\n    expect(v8Runtime).not.toContain('<ChatSupportWidget />');\n    expect(v8Runtime).not.toContain('PlatformV7FullStyleRuntime');\n    expect(v8Runtime).not.toContain('PlatformV7TemplateGuards');\n    expect(v8Runtime).not.toContain('MutationObserver');\n    expect(v8Runtime).not.toContain('ResizeObserver');\n    expect(v8Runtime).not.toContain('setInterval');\n    expect(v8Runtime).not.toContain('setTimeout');\n    expect(v8Runtime).not.toContain('<style');\n    expect(v8Runtime).not.toContain('@/styles/');\n  });\n\n  it('keeps one canonical role-safe operator or executive workspace', () => {\n    expect(controlTower).toContain('readVerifiedCabinetSessionRole');\n    expect(controlTower).toContain('readVerifiedCabinetRole');\n    expect(controlTower).toContain(\"role === 'executive'\");\n    expect(controlTower).toContain(\"redirect('/platform-v7/executive')\");\n    expect(controlTower).toContain(\"redirect('/platform-v7/operator')\");\n    expect(controlTower).not.toContain('selectRuntimeDeals');\n    expect(controlTower).not.toContain('canonicalDomainDeals');\n    expect(controlTower).not.toContain('ControlTowerCharts');\n    expect(controlTower).not.toContain('dangerouslySetInnerHTML');\n    expect(controlTower).not.toContain('style=');\n    expect(controlTower).not.toContain('useSearchParams');\n    expect(controlTower).not.toContain('localStorage');\n  });\n\n  it('prevents root compatibility CSS from overriding the governed AppShell module', () => {\n    expect(fixedHeaderContract).not.toContain('.pc-v4-header');\n    expect(fixedHeaderContract).not.toContain('.pc-shell-root-v4');\n    expect(fixedHeaderContract).toContain('.pc-site-header');\n    expect(fixedHeaderContract).toContain('[data-staff-platform-shell]');\n  });\n});\n"},{"blob":"043c10b308d52091cebb1b7a26dd31fc23a0bc45","content":"import fs from 'node:fs';\nimport path from 'node:path';\nimport { describe, expect, it } from 'vitest';\nimport { DESIGN_SYSTEM_V8_ROUTE_POLICY, isDesignSystemV8Route } from '../../lib/platform-v7/design-system-v8-route-policy';\n\nconst root = process.cwd();\nconst absolute = (relativePath: string) => path.join(root, relativePath);\nconst read = (relativePath: string) => fs.readFileSync(absolute(relativePath), 'utf8');\n\nconst layout = read('apps/web/app/platform-v7/layout.tsx');\nconst template = read('apps/web/app/platform-v7/template.tsx');\nconst controlTower = read('apps/web/app/platform-v7/control-tower/page.tsx');\nconst routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');\nconst v8Runtime = read('apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx');\nconst fixedHeaderContract = read('apps/web/app/platform-v7/_styles/fixed-header-contract.css');\n\nconst removedRuntimeFiles = [\n  'apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx',\n  'apps/web/components/platform-v7/PlatformV7ProtectedTemplateRuntime.tsx',\n  'apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx',\n  'apps/web/components/platform-v7/PlatformV7TemplateSwitch.tsx',\n  'apps/web/components/platform-v7/PlatformV7ProductionCopyPatch.tsx',\n  'apps/web/components/platform-v7/PlatformV7ScrollRestorationGuard.tsx',\n];\n\nconst roleRoutes = [\n  'operator', 'buyer', 'seller', 'logistics', 'driver', 'elevator',\n  'lab', 'surveyor', 'bank', 'compliance', 'arbitrator', 'executive',\n];\n\nconst criticalRoutes = [\n  '/platform-v7/control-tower',\n  '/platform-v7/deals',\n  '/platform-v7/documents',\n  '/platform-v7/disputes',\n  '/platform-v7/money',\n  '/platform-v7/bank/release-safety',\n  '/platform-v7/fgis-access',\n  '/platform-v7/deal-logistics',\n  '/platform-v7/deal-acceptance',\n  '/platform-v7/deal-documents-basis',\n];\n\nfunction quotedRoutes(block: string): string[] {\n  return [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]);\n}\n\nfunction extractPublicPolicy(): { exact: Set<string>; prefixes: string[] } {\n  const exactBlock = layout.match(/const PUBLIC_EXACT_PATHS = new Set\\(\\[([\\s\\S]*?)\\]\\);/)?.[1] ?? '';\n  const prefixBlock = layout.match(/const PUBLIC_PREFIX_PATHS = \\[([\\s\\S]*?)\\];/)?.[1] ?? '';\n  return {\n    exact: new Set([\n      '/platform-v7',\n      '/platform-v7/login',\n      '/platform-v7/forgot-password',\n      ...quotedRoutes(exactBlock),\n    ]),\n    prefixes: quotedRoutes(prefixBlock),\n  };\n}\n\nfunction extractStaffPrefix(): string {\n  return layout.match(/const STAFF_PREFIX = '([^']+)'/)?.[1] ?? '';\n}\n\nfunction extractExactAliases(): Set<string> {\n  const block = layout.match(/const ALIAS_EXACT_PATHS = new Set\\(\\[([\\s\\S]*?)\\]\\);/)?.[1] ?? '';\n  return new Set(quotedRoutes(block));\n}\n\nfunction extractDynamicAliases(): RegExp[] {\n  const block = layout.match(/const ALIAS_DYNAMIC_PATHS = \\[([\\s\\S]*?)\\] as const;/)?.[1] ?? '';\n  return block\n    .split('\\n')\n    .map((line) => line.trim().replace(/,$/, ''))\n    .filter((line) => line.startsWith('/^') && line.endsWith('/'))\n    .map((line) => new RegExp(line.slice(1, -1)));\n}\n\nfunction walkPages(directory: string, output: string[] = []): string[] {\n  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {\n    const child = path.join(directory, entry.name);\n    if (entry.isDirectory()) walkPages(child, output);\n    else if (entry.isFile() && entry.name === 'page.tsx') output.push(child);\n  }\n  return output;\n}\n\nfunction routeFromPage(pagePath: string): string {\n  const appRoot = absolute('apps/web/app/platform-v7');\n  const segments = path.relative(appRoot, pagePath).split(path.sep);\n  segments.pop();\n  const routeSegments = segments.filter((segment) => !/^\\(.+\\)$/.test(segment) && !segment.startsWith('@'));\n  return ['/platform-v7', ...routeSegments].join('/').replace(/\\/$/, '') || '/platform-v7';\n}\n\nfunction sampleRoute(route: string): string {\n  return route.replace(/\\[[^/]+\\]/g, 'sample-id');\n}\n\nfunction matchesPrefix(route: string, prefix: string): boolean {\n  return Boolean(prefix) && (route === prefix || route.startsWith(`${prefix}/`));\n}\n\ndescribe('platform-v7 Design System v8 runtime isolation', () => {\n  it('registers all twelve role roots and accepted transaction routes in one server-safe policy', () => {\n    for (const role of roleRoutes) expect(routePolicy).toContain(`'/platform-v7/${role}'`);\n    for (const route of criticalRoutes) expect(routePolicy).toContain(`'${route}'`);\n    expect(isDesignSystemV8Route('/platform-v7/deals/sample-id/execution')).toBe(true);\n    expect(DESIGN_SYSTEM_V8_ROUTE_POLICY.dynamic).toContain(/^\\/platform-v7\\/deals\\/[^/]+\\/execution$/.source);\n    expect(routePolicy).toContain(\"'/platform-v7/auction'\");\n    expect(routePolicy).toContain('isDesignSystemV8Route');\n    expect(routePolicy).not.toContain(\"'use client'\");\n    expect(routePolicy).not.toContain('window.');\n    expect(routePolicy).not.toContain('document.');\n  });\n\n  it('fails unknown paths before auth and selects the v8 boundary only after verified role enforcement', () => {\n    expect(layout).toContain(\"from '@/lib/platform-v7/design-system-v8-route-policy'\");\n    expect(layout).toContain('if (!isKnownProtectedPath(pathname)) notFound()');\n    expect(layout).toContain('if (!role) redirect');\n    expect(layout).toContain('if (!canRoleAccessCabinet(role, pathname))');\n    expect(layout).toContain(\"await import('@/components/platform-v7/PlatformV7ProtectedRuntime')\");\n    expect(layout).toContain(\"await import('@/components/platform-v7/PlatformV7DesignSystemV8Runtime')\");\n    expect(layout).toContain('<PlatformV7DesignSystemV8Runtime>{protectedContent}</PlatformV7DesignSystemV8Runtime>');\n    expect(layout).toContain('if (!isDesignSystemV8Route(pathname)) return protectedContent');\n    expect(layout.indexOf('if (!isKnownProtectedPath(pathname)) notFound()')).toBeLessThan(\n      layout.indexOf('if (!role) redirect'),\n    );\n    expect(layout.indexOf('if (!role) redirect')).toBeLessThan(\n      layout.indexOf('if (!isDesignSystemV8Route(pathname)) return protectedContent'),\n    );\n    expect(layout).not.toContain('PlatformV7FullStyleRuntime');\n  });\n\n  it('keeps every server redirect route reachable through an explicit route class', () => {\n    const publicPolicy = extractPublicPolicy();\n    const staffPrefix = extractStaffPrefix();\n    const exactAliases = extractExactAliases();\n    const dynamicAliases = extractDynamicAliases();\n    const redirectRoutes = walkPages(absolute('apps/web/app/platform-v7'))\n      .filter((pagePath) => /\\bredirect\\s*\\(/.test(fs.readFileSync(pagePath, 'utf8')))\n      .map(routeFromPage);\n\n    expect(staffPrefix).toBe('/platform-v7/staff');\n\n    for (const route of redirectRoutes) {\n      const sample = sampleRoute(route);\n      const publicRoute = publicPolicy.exact.has(route)\n        || publicPolicy.prefixes.some((prefix) => matchesPrefix(sample, prefix));\n      const covered = publicRoute\n        || matchesPrefix(sample, staffPrefix)\n        || isDesignSystemV8Route(sample)\n        || exactAliases.has(route)\n        || dynamicAliases.some((pattern) => pattern.test(sample));\n      expect(covered, `redirect route is absent from route policy: ${route}`).toBe(true);\n    }\n  });\n\n  it('keeps the route template free of client guards and mutation repair', () => {\n    expect(template).toContain('return children');\n    expect(template).not.toContain(\"'use client'\");\n    expect(template).not.toContain('headers()');\n    expect(template).not.toContain('PlatformV7ProtectedTemplateRuntime');\n    expect(template).not.toContain('PlatformV7TemplateGuards');\n  });\n\n  it('physically removes historical runtime, copy-repair and scroll-polling files', () => {\n    for (const file of removedRuntimeFiles) expect(fs.existsSync(absolute(file))).toBe(false);\n  });\n\n  it('keeps the governed runtime token-only, hydration-safe and free of DOM/style repair code', () => {\n    expect(v8Runtime).toContain('packages/design-tokens/tokens.css');\n    expect(v8Runtime).not.toContain('<HydrationSafeChatSupport />');\n    expect(v8Runtime).not.toContain('<ChatSupportWidget />');\n    expect(v8Runtime).not.toContain('PlatformV7FullStyleRuntime');\n    expect(v8Runtime).not.toContain('PlatformV7TemplateGuards');\n    expect(v8Runtime).not.toContain('MutationObserver');\n    expect(v8Runtime).not.toContain('ResizeObserver');\n    expect(v8Runtime).not.toContain('setInterval');\n    expect(v8Runtime).not.toContain('setTimeout');\n    expect(v8Runtime).not.toContain('<style');\n    expect(v8Runtime).not.toContain('@/styles/');\n  });\n\n  it('keeps one canonical role-safe operator or executive workspace', () => {\n    expect(controlTower).toContain('readVerifiedCabinetSessionRole');\n    expect(controlTower).toContain('readVerifiedCabinetRole');\n    expect(controlTower).toContain(\"role === 'executive'\");\n    expect(controlTower).toContain(\"redirect('/platform-v7/executive')\");\n    expect(controlTower).toContain(\"redirect('/platform-v7/operator')\");\n    expect(controlTower).not.toContain('selectRuntimeDeals');\n    expect(controlTower).not.toContain('canonicalDomainDeals');\n    expect(controlTower).not.toContain('ControlTowerCharts');\n    expect(controlTower).not.toContain('dangerouslySetInnerHTML');\n    expect(controlTower).not.toContain('style=');\n    expect(controlTower).not.toContain('useSearchParams');\n    expect(controlTower).not.toContain('localStorage');\n  });\n\n  it('prevents root compatibility CSS from overriding the governed AppShell module', () => {\n    expect(fixedHeaderContract).not.toContain('.pc-v4-header');\n    expect(fixedHeaderContract).not.toContain('.pc-shell-root-v4');\n    expect(fixedHeaderContract).toContain('.pc-site-header');\n    expect(fixedHeaderContract).toContain('[data-staff-platform-shell]');\n  });\n});\n"}].map(item=>{const bytes=Buffer.from(item.content);assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),item.blob);return[item.blob,bytes];}));

const routeGuardPurposeTemplate = {
  "owner": "ACCOUNT_2_PRODUCT",
  "sourceOwnerRetained": "ACCOUNT_2_PRODUCT",
  "purpose": "Renew only the already admitted protected guard ref to bind the exact Deal execution route prerequisite, including trusted-base workflow routing after native review proved PRIMARY inheritance, inert source pins and candidate-owned guard execution.",
  "implementationBranch": "governance/pc-crop-post-registration-progress-scope-4997",
  "allowedPaths": [
    "scripts/p7-autopilot-guard.sh",
    "scripts/p7-autopilot-guard.test.mjs",
    ".github/workflows/platform-v7-autopilot-guard.yml"
  ],
  "retainedAcceptedGuardScope": [
    "scripts/p7-autopilot-guard.sh",
    "scripts/p7-autopilot-guard.test.mjs",
    ".github/workflows/platform-v7-autopilot-guard.yml"
  ],
  "futureAdmissionBranch": "governance/product-deal-execution-route-20261001",
  "futureImplementationBranch": "fix/deal-execution-route-20261001",
  "futureAllowedPaths": [
    "apps/web/lib/platform-v7/design-system-v8-route-policy.ts",
    "apps/web/tests/unit/platformV7AccountingRouteAccess.test.ts",
    "apps/web/tests/unit/platformV7DesignSystemV8RuntimeIsolation.test.ts"
  ],
  "futureExactSourcePins": [
    [
      "apps/web/lib/platform-v7/design-system-v8-route-policy.ts",
      "b9b96c88695c7960a309e98e691c348fec03a2b0",
      "d94cc0d0af208fd6faea32e321a136629bef44f8"
    ],
    [
      "apps/web/tests/unit/platformV7AccountingRouteAccess.test.ts",
      "87ebc91bcc9a927dd6ad2d6f9afdfff8737d47bd",
      "a1290dc9b3ba122de480200ff5efa86445b5fe66"
    ],
    [
      "apps/web/tests/unit/platformV7DesignSystemV8RuntimeIsolation.test.ts",
      "0e7d10b62a722802c76e73f2eb2e618953a383c5",
      "043c10b308d52091cebb1b7a26dd31fc23a0bc45"
    ]
  ],
  "requiredFutureSourceMode": "100644",
  "privateRoutePayloadSha256": "d4c4bf61d3813e2d0d4b9c364c81941ab88039b078413addc5eb1d3ca750e884",
  "blockingNativeFindings": [
    4155054017,
    4155054022,
    4155554749
  ],
  "grantRouteSourceAuthority": false,
  "guardAdoptionRequiresCoreHandoff": true,
  "requiredTruthBoundaries": [
    "Purpose only: renew this one record without a route SOURCE vector. All other old state bytes/values, admissions/vectors, PRIMARY/current/global/R1.2 scope, official5/100 and runtime remain unchanged.",
    "Renew only the existing protected three-path guard ref; the correction changes exactly the three recorded guard/test/workflow blobs with original100755/100644/100644 modes and unchanged accepted state. Do not introduce another shared guard writer.",
    "The accepted guard must discard PRIMARY/source-controlled expansion for the route SOURCE ref, bind exact trusted-base state/three paths/blobs/modes/ancestry and reject extra, partial, wrong-byte, wrong-mode, rename/delete and candidate-owned authority cases.",
    "Both exact route branches must run the accepted BASE guard in the existing pull_request_target immutable job and PR-head defense, pass both shell allow-lists, and be excluded from candidate-owned standard/active guard paths. Preserve every old predicate, workflow trigger, permission, check binding and all other branches; do not let a candidate guard/test replace its validator.",
    "The next state-only admission and route SOURCE remain separate accepted-base-reviewed native-gated phases. Purpose and guard code grant no route SOURCE vector, ordinary role/session/money/provider authority or live acceptance.",
    "CORE retains current source and first-merge priority. Every guard/admission/SOURCE adoption waits for actual handoff, fresh MAIN/Hub/ownership checks, independent complete-head review, strict author audit, all substantive native/security gates and normal expected-full-SHA manual merge."
  ],
  "forbiddenAuthority": [
    "SOURCE route/self-admission or arbitrary scope/state changes",
    "CORE/API/DB/RLS/role/session/money/provider/FGIS/deployment authority",
    "CI/security/readiness weakening, fake history/PASS or forced/automatic merge"
  ]
};
const routeSourceAdmissionTemplate = {
  "owner": "ACCOUNT_2_PRODUCT",
  "sourceOwnerRetained": "ACCOUNT_2_PRODUCT",
  "purpose": "Register only the existing protected canonical Deal execution destination after the genuine native BANK queue journey returned layout404; preserve all server role, tenant, membership and command authority.",
  "authorityBaseExactMain": "3372f85ee832cd0e7a199c71f44eb32462138fc2",
  "implementationBranch": "fix/deal-execution-route-20261001",
  "allowedPaths": [
    "apps/web/lib/platform-v7/design-system-v8-route-policy.ts",
    "apps/web/tests/unit/platformV7AccountingRouteAccess.test.ts",
    "apps/web/tests/unit/platformV7DesignSystemV8RuntimeIsolation.test.ts"
  ],
  "exactSourcePins": [
    [
      "apps/web/lib/platform-v7/design-system-v8-route-policy.ts",
      "b9b96c88695c7960a309e98e691c348fec03a2b0",
      "d94cc0d0af208fd6faea32e321a136629bef44f8"
    ],
    [
      "apps/web/tests/unit/platformV7AccountingRouteAccess.test.ts",
      "87ebc91bcc9a927dd6ad2d6f9afdfff8737d47bd",
      "a1290dc9b3ba122de480200ff5efa86445b5fe66"
    ],
    [
      "apps/web/tests/unit/platformV7DesignSystemV8RuntimeIsolation.test.ts",
      "0e7d10b62a722802c76e73f2eb2e618953a383c5",
      "043c10b308d52091cebb1b7a26dd31fc23a0bc45"
    ]
  ],
  "requiredSourceMode": "100644",
  "nativeFailureEvidence": {
    "pr": 5735,
    "head": "1fdd8981106145df244420138b86fc6ae4f23d48",
    "workflowRun": 36849109373,
    "job": 110326285988,
    "failedProjects": 5,
    "observedStatus": 404,
    "diagnosisHubComment": 5930062482
  },
  "privatePayload": {
    "bytes": 4262,
    "sha256": "d4c4bf61d3813e2d0d4b9c364c81941ab88039b078413addc5eb1d3ca750e884",
    "candidateTestsPassed": 15,
    "unchangedBaselinePassed": 12,
    "unchangedBaselineFailed": 3
  },
  "requiredTruthBoundaries": [
    "Separate state-only proposal. Preserve all prior state bytes/values except the append of one exact concurrent three-path vector and this one record. Primary/current/global/R1.2 scopes, all historical admissions, every other branch, official5/100 progress, maturity and canonical CORE source ownership remain unchanged.",
    "The future source phase changes exactly the three pinned regular files, retains unchanged accepted-base state/guard/workflows/security/registry/source modes and all other leaves, and requires an independently reviewed accepted MAIN admission before publication.",
    "Add only anchored /platform-v7/deals/<one-id>/execution registration and remove only the broken trailing-slash Deal prefix. Keep anchored accounting, all other role and route classes, unknown-route rejection before auth, signed session and API membership checks. Do not repair the prefix by broadly admitting all Deal subroutes.",
    "Preserve every existing test and replace the broken prefix text assertion with behavioral execution reachability plus published dynamic-policy coverage. Exercise all three locales, valid canonical IDs, missing/empty IDs, malformed double slash and extra/nested/sibling paths; retain accounting negative roles.",
    "Keep the current original BANK source unchanged until this prerequisite is accepted. Then normally compose its original head with accepted current MAIN, preserving the original two source pins and bounded E2E case; obtain fresh whole-head review, owner audit and native five-browser/Kubernetes/readiness results.",
    "Private15-test/typecheck results and the original404 diagnosis do not establish current-head native CI, browser acceptance, exact REG.RU deployment, real providers or actual13-cabinet closure. Never rerun the failed unchanged BANK head or lower assertions to get green.",
    "While canonical CORE6 window5930002118 remains active, only an unmerged one-file metadata review proposal is prepared under bounded decision5930593870. This proposal changes no accepted state, grants no SOURCE authority and performs no SOURCE/MAIN/guard/release mutation. Any metadata adoption/merge and future SOURCE publication are serialized after actual CORE HANDOFF/DONE, fresh Hub/main/source/scope recheck, every applicable substantive CI/security, independent current-head review, separate author audit and normal expected-full-SHA manual merge."
  ],
  "forbiddenAuthority": [
    "API/DB/RLS/role/tenant/session/command/money/provider/FGIS or new CORE authority",
    "Broad Deal-prefix admission, route/auth bypass, original BANK source replacement or competing owner branch",
    "CI/security/readiness/review weakening, fake history/PASS, forced/automatic merge, release/model mutation or new recurring cost"
  ],
  "metadataPreparationDecision": "Team Hub #5469 comment5930593870"
};
const routeGuardPurposeKey = 'deal-execution-route-guard-purpose-20261001';
const routeAdmissionKey = 'deal-execution-route-20261001';
const routeSourceBranch = routeGuardPurposeTemplate.futureImplementationBranch;
const routeAdmissionBranch = routeGuardPurposeTemplate.futureAdmissionBranch;
const routeGuardBranch = routeGuardPurposeTemplate.implementationBranch;
const routePins = routeGuardPurposeTemplate.futureExactSourcePins;
const routeBlob = bytes => createHash('sha1').update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest('hex');
const routeGuardBytes = fs.readFileSync(sourceGuard);
const routeTestBytes = fs.readFileSync(path.resolve('scripts/p7-autopilot-guard.test.mjs'));
const routeWorkflowPath = '.github/workflows/platform-v7-autopilot-guard.yml';
const routeWorkflowBytes = fs.readFileSync(path.resolve(routeWorkflowPath));
const routeWorkflowBeforeResult = spawnSync('git', ['cat-file', 'blob', '90f6c2b52b25b7a4f09446b7dafb36270f9969dc'], { encoding: 'utf8' });
assert.equal(routeWorkflowBeforeResult.status, 0, 'Actual accepted workflow blob is required; no invented baseline');
const routeWorkflowBeforeBytes = routeWorkflowBeforeResult.stdout;
assert.equal(routeBlob(routeWorkflowBeforeBytes), '90f6c2b52b25b7a4f09446b7dafb36270f9969dc');
const routeGuardPins = [
  ['scripts/p7-autopilot-guard.sh', '38be109d11422546c07fd96db283d848599a709f', routeBlob(routeGuardBytes), '100755'],
  ['scripts/p7-autopilot-guard.test.mjs', 'db910d2e6c2521957fb8719f7e5af659a8cd0165', routeBlob(routeTestBytes), '100644'],
  [routeWorkflowPath, '90f6c2b52b25b7a4f09446b7dafb36270f9969dc', routeBlob(routeWorkflowBytes), '100644'],
];
function routeFixture(t, { branch = routeSourceBranch, admitted = true, guardAdoption = false, purpose = true } = {}) {
  const c = fixture(t, branch);
  fs.mkdirSync(path.join(c.root, 'docs/platform-v7/autopilot/scopes'), { recursive: true });
  const p = path.join(c.root, dealRuntimeStatePath);
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  delete s.approvedConcurrentScopes[branch];
  s.allowedCurrentScope.push('docs/execution/**', 'apps/api/src/modules/staff-access/**');
  s.approvedConcurrentScopes[routeGuardBranch] = routeGuardPurposeTemplate.retainedAcceptedGuardScope;
  s.coordinationAdmissions = {};
  if (purpose) s.coordinationAdmissions[routeGuardPurposeKey] = {
    ...structuredClone(routeGuardPurposeTemplate), authorityBaseExactMain: c.baseline, exactGuardSourcePins: structuredClone(routeGuardPins),
  };
  for (const [file, before] of routePins) write(c.root, file, routeActualBlobs.get(before));
  write(c.root, routeWorkflowPath, guardAdoption ? routeWorkflowBeforeBytes : routeWorkflowBytes, 0o644);
  write(c.root, 'scripts/p7-autopilot-guard.test.mjs',
    guardAdoption ? actualLocaleBaselineBlob(routeGuardPins[1][1]) : routeTestBytes, 0o644);
  if (guardAdoption) write(c.root, 'scripts/p7-autopilot-guard.sh', actualLocaleBaselineBlob(routeGuardPins[0][1]), 0o755);
  write(c.root, dealRuntimeStatePath, JSON.stringify(s, null, 2) + '\n');
  commit(c.root, 'accepted guard-purpose fixture');
  c.baseline = git(c.root, ['rev-parse', 'HEAD']);
  if (admitted) {
    addRouteAdmission(c);
    commit(c.root, 'separate route state-only fixture');
    c.baseline = git(c.root, ['rev-parse', 'HEAD']);
  }
  return c;
}
function addRouteAdmission(c, mutate = () => {}) {
  const p = path.join(c.root, dealRuntimeStatePath), s = JSON.parse(fs.readFileSync(p, 'utf8'));
  s.approvedConcurrentScopes[routeSourceBranch] = routePins.map(pin => pin[0]);
  s.coordinationAdmissions[routeAdmissionKey] = {
    ...structuredClone(routeSourceAdmissionTemplate), authorityBaseExactMain: c.baseline, guardPurposeKey: routeGuardPurposeKey,
  };
  mutate(s); write(c.root, dealRuntimeStatePath, JSON.stringify(s, null, 2) + '\n');
}
function applyRoute(c) {
  for (const [file,, after] of routePins) write(c.root, file, routeActualBlobs.get(after));
  commit(c.root, 'actual pinned three-file route repair fixture');
}
function rejectRoute(c, pattern = /DEAL_ROUTE_|outside immutable/u) {
  const r = runTrustedDealRuntimeGuard(c); assert.notEqual(r.status, 0, output(r)); assert.match(output(r), pattern);
}
function runOldRouteControl(c) {
  const old = path.join(c.root, '.git', 'actual-old-route-guard-control.sh');
  fs.writeFileSync(old, actualLocaleBaselineBlob('38be109d11422546c07fd96db283d848599a709f'));
  return spawnSync('bash', [old], { cwd: c.root,
    env: { ...process.env, BASE_REF: c.baseline, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: c.implementationBranch }, encoding: 'utf8' });
}
test('Deal route: actual three-file pins and regular modes pass trusted BASE', t => {
  const c = routeFixture(t); applyRoute(c); const r = runTrustedDealRuntimeGuard(c); assert.equal(r.status, 0, output(r));
  assert.deepEqual(git(c.root, ['diff','--name-only',c.baseline+'...HEAD']).split('\n').sort(), routePins.map(p=>p[0]).sort());
});
test('Deal route: reviewer PRIMARY-scope probe fails; unchanged old guard accepts it', t => {
  const c = routeFixture(t); write(c.root, 'docs/execution/route-guard-out-of-vector-probe.md','probe\n'); commit(c.root,'same native P1 probe');
  rejectRoute(c,/DEAL_ROUTE_(SOURCE_DIFF_SCOPE|PIN_OR_MODE)/u); const control=runOldRouteControl(c); assert.equal(control.status,0,output(control));
});
test('Deal route: reviewer arbitrary-byte probe fails; unchanged old guard accepts it', t => {
  const c = routeFixture(t); applyRoute(c); write(c.root,routePins[0][0],'arbitrary content\n'); commit(c.root,'same native P1 bytes probe');
  rejectRoute(c,/DEAL_ROUTE_PIN_OR_MODE/u); const control=runOldRouteControl(c); assert.equal(control.status,0,output(control));
});
for (const [name,mutate] of [
  ['inherited staff file',c=>write(c.root,'apps/api/src/modules/staff-access/route-probe.ts','extra\n')],
  ['partial two files',c=>write(c.root,routePins[2][0],routeActualBlobs.get(routePins[2][1]))],
  ['extra governance file',c=>write(c.root,'docs/execution/extra.md','extra\n')],
  ['candidate scope self-grant',c=>{const p=path.join(c.root,dealRuntimeStatePath),s=JSON.parse(fs.readFileSync(p,'utf8'));s.approvedConcurrentScopes[routeSourceBranch].push('apps/api/**');write(c.root,dealRuntimeStatePath,JSON.stringify(s,null,2)+'\n');}],
  ['candidate pin self-grant',c=>{const p=path.join(c.root,dealRuntimeStatePath),s=JSON.parse(fs.readFileSync(p,'utf8'));s.coordinationAdmissions[routeAdmissionKey].exactSourcePins[0][2]='0'.repeat(40);write(c.root,dealRuntimeStatePath,JSON.stringify(s,null,2)+'\n');}],
  ['deleted required test',c=>fs.unlinkSync(path.join(c.root,routePins[1][0]))],
  ['renamed required source',c=>fs.renameSync(path.join(c.root,routePins[0][0]),path.join(c.root,'renamed-route-policy.ts'))],
]) test('Deal route: rejects '+name,t=>{const c=routeFixture(t);applyRoute(c);mutate(c);commit(c.root,'route attack '+name);rejectRoute(c);});
for (const mode of ['100755','120000']) test('Deal route: exact source blob in mode '+mode+' rejects',t=>{
  const c=routeFixture(t);applyRoute(c);git(c.root,['update-index','--cacheinfo',mode+','+routePins[0][2]+','+routePins[0][0]]);git(c.root,['commit','-m','wrong source mode']);rejectRoute(c,/DEAL_ROUTE_PIN_OR_MODE/u);
});
test('Deal route: purpose alone cannot grant SOURCE',t=>{const c=routeFixture(t,{admitted:false});applyRoute(c);rejectRoute(c,/DEAL_ROUTE_ACCEPTED_ADMISSION_MISMATCH/u);});
test('Deal route: absent trusted purpose rejects SOURCE',t=>{const c=routeFixture(t,{purpose:false});applyRoute(c);rejectRoute(c,/DEAL_ROUTE_PURPOSE_MISMATCH/u);});
test('Deal route: separate exact state-only admission passes',t=>{
  const c=routeFixture(t,{branch:routeAdmissionBranch,admitted:false});addRouteAdmission(c);commit(c.root,'route metadata only');const r=runTrustedDealRuntimeGuard(c);assert.equal(r.status,0,output(r));
});
for (const [name,mutate] of [
  ['primary scope',s=>s.allowedCurrentScope.push('apps/web/**')],
  ['wrong source pin',s=>s.coordinationAdmissions[routeAdmissionKey].exactSourcePins[0][2]='0'.repeat(40)],
  ['wrong source mode',s=>s.coordinationAdmissions[routeAdmissionKey].requiredSourceMode='100755'],
  ['wrong source owner',s=>s.coordinationAdmissions[routeAdmissionKey].owner='ACCOUNT_1_CORE'],
  ['extra route path',s=>s.approvedConcurrentScopes[routeSourceBranch].push('README.md')],
]) test('Deal route: metadata rejects '+name,t=>{
  const c=routeFixture(t,{branch:routeAdmissionBranch,admitted:false});addRouteAdmission(c,mutate);commit(c.root,'bad route metadata');rejectRoute(c,/DEAL_ROUTE_ADMISSION_STATE_MUTATION/u);
});
test('Deal route: metadata cannot mix reviewed SOURCE',t=>{
  const c=routeFixture(t,{branch:routeAdmissionBranch,admitted:false});addRouteAdmission(c);write(c.root,routePins[0][0],routeActualBlobs.get(routePins[0][2]));commit(c.root,'mixed route metadata');rejectRoute(c,/DEAL_ROUTE_ADMISSION_DIFF_SCOPE/u);
});
test('Deal route: accepted wrong ancestry rejects before SOURCE',t=>{
  const c=routeFixture(t);const p=path.join(c.root,dealRuntimeStatePath),s=JSON.parse(fs.readFileSync(p,'utf8'));s.coordinationAdmissions[routeAdmissionKey].authorityBaseExactMain='0'.repeat(40);write(c.root,dealRuntimeStatePath,JSON.stringify(s,null,2)+'\n');commit(c.root,'bad ancestor fixture');c.baseline=git(c.root,['rev-parse','HEAD']);applyRoute(c);rejectRoute(c,/DEAL_ROUTE_AUTHORITY_NOT_ANCESTOR/u);
});
function applyRouteGuard(c) {
  write(c.root,'scripts/p7-autopilot-guard.sh',routeGuardBytes,0o755);
  write(c.root,'scripts/p7-autopilot-guard.test.mjs',routeTestBytes,0o644);
  write(c.root,routeWorkflowPath,routeWorkflowBytes,0o644);commit(c.root,'exact guard workflow three fixture');
}
function runRouteGuardCandidate(c) {
  const script=path.join(c.root,'.git','reviewed-guard-candidate.sh');fs.writeFileSync(script,routeGuardBytes);
  return spawnSync('bash',[script],{cwd:c.root,env:{...process.env,BASE_REF:c.baseline,HEAD_REF:'HEAD',GITHUB_HEAD_REF:c.implementationBranch},encoding:'utf8'});
}
test('Deal route: existing protected-ref guard correction is exactly three pinned files',t=>{
  const c=routeFixture(t,{branch:routeGuardBranch,admitted:false,guardAdoption:true});applyRouteGuard(c);const r=runRouteGuardCandidate(c);assert.equal(r.status,0,output(r));
});
for(const [name,mutate] of [
 ['altered pinned workflow',c=>write(c.root,'.github/workflows/platform-v7-autopilot-guard.yml','name: altered\n')],
 ['arbitrary guard bytes',c=>write(c.root,'scripts/p7-autopilot-guard.sh','#!/bin/bash\nexit 0\n',0o755)],
 ['wrong guard mode',c=>{git(c.root,['update-index','--cacheinfo','100644,'+routeGuardPins[0][2]+',scripts/p7-autopilot-guard.sh']);git(c.root,['commit','-m','wrong guard mode']);}],
]) test('Deal route: guard correction rejects '+name,t=>{
 const c=routeFixture(t,{branch:routeGuardBranch,admitted:false,guardAdoption:true});applyRouteGuard(c);mutate(c);if(name!=='wrong guard mode')commit(c.root,'guard attack');const r=runRouteGuardCandidate(c);assert.notEqual(r.status,0,output(r));assert.match(output(r),/DEAL_ROUTE_/u);
});

// Native workflow P1: actual accepted/proposed predicates, shell allow-lists and real Git/BASE attacks.
function routeWorkflowJobText(workflow,key) {
 const jobs=[...workflow.matchAll(/^  ([a-z][a-z0-9_-]*):\n/gm)].filter(m=>m.index>workflow.indexOf('\njobs:\n'));
 const i=jobs.findIndex(m=>m[1]===key);assert.notEqual(i,-1,'Missing workflow job '+key);
 return workflow.slice(jobs[i].index,jobs[i+1]?.index??workflow.length);
}

function routeWorkflowStepText(job,name) {
 const token='      - name: '+name+'\n',at=job.indexOf(token);assert.notEqual(at,-1,'Missing workflow step '+name);
 const end=job.indexOf('\n      - ',at+token.length);return job.slice(at,end<0?job.length:end);
}

function routeWorkflowIf(text) {
 const lines=text.split('\n'),i=lines.findIndex(s=>/^\s+if: /u.test(s));assert.notEqual(i,-1,'Missing workflow condition');
 const m=lines[i].match(/^(\s*)if: (.*)$/u);if(m[2]!=='>-')return m[2];
 const next=[];for(let j=i+1;j<lines.length&&lines[j].startsWith(' '.repeat(m[1].length+1));j++)next.push(lines[j].trim());
 assert.ok(next.length);return next.join(' ');
}

function routeWorkflowPredicate(expression,eventName,branch) {
 const github={event_name:eventName,head_ref:branch,event:{pull_request:{head:{ref:branch},base:{sha:'f'.repeat(40)}}}};
 const compiled=new Function('github','contains','fromJSON','always','return ('+expression.replace(/ == /gu,' === ').replace(/ != /gu,' !== ')+');');
 return compiled(github,(rows,v)=>rows.includes(v),JSON.parse,()=>true);
}

function routeWorkflowSelection(workflow,branch) {
 const trusted=routeWorkflowJobText(workflow,'trusted-immutable-scope'),head=routeWorkflowJobText(workflow,'guard'),standard=routeWorkflowJobText(workflow,'standard_validation');
 const defense=routeWorkflowStepText(head,'Validate immutable scope with trusted base guard on PR head');
 return {
  trusted:routeWorkflowPredicate(routeWorkflowIf(trusted),'pull_request_target',branch),
  defense:routeWorkflowPredicate(routeWorkflowIf(defense),'pull_request',branch),
  standard:routeWorkflowPredicate(routeWorkflowIf(routeWorkflowStepText(head,'Validate standard branch scope on PR head')),'pull_request',branch),
  active:routeWorkflowPredicate(routeWorkflowIf(routeWorkflowStepText(standard,'Validate active platform-v7 autopilot scope')),'pull_request',branch),
 };
}

function routeWorkflowShellBranch(job,branch) {
 const start=job.indexOf('case "$IMMUTABLE_SCOPE_BRANCH" in'),end=job.indexOf('esac',start);
 assert.ok(start>=0&&end>start,'Missing workflow shell allow-list');
 return spawnSync('bash',['-c',job.slice(start,end+4)],{env:{...process.env,IMMUTABLE_SCOPE_BRANCH:branch},encoding:'utf8'});
}

for (const branch of [routeAdmissionBranch, routeSourceBranch]) {
  test('Deal route workflow: trusted BASE and PR-head defense replace both candidate-owned paths for '+branch, () => {
    assert.deepEqual(routeWorkflowSelection(routeWorkflowBeforeBytes,branch), {trusted:false,defense:false,standard:true,active:true});
    assert.deepEqual(routeWorkflowSelection(String(routeWorkflowBytes),branch), {trusted:true,defense:true,standard:false,active:false});
    for(const job of ['trusted-immutable-scope','guard']) {
      assert.notEqual(routeWorkflowShellBranch(routeWorkflowJobText(routeWorkflowBeforeBytes,job),branch).status,0);
      assert.equal(routeWorkflowShellBranch(routeWorkflowJobText(String(routeWorkflowBytes),job),branch).status,0);
    }
    const trusted=routeWorkflowJobText(String(routeWorkflowBytes),'trusted-immutable-scope');
    assert.ok(trusted.includes('ref: '+'$'+'{{ github.event.pull_request.base.sha }}'));
    const defense=routeWorkflowStepText(routeWorkflowJobText(String(routeWorkflowBytes),'guard'),'Validate immutable scope with trusted base guard on PR head');
    assert.ok(defense.includes('git show "$BASE_SHA:scripts/p7-autopilot-guard.sh"'));
    assert.ok(defense.includes('BASE_REF="$BASE_SHA" HEAD_REF="$HEAD_SHA"'));
  });
  test('Deal route workflow: native reviewer candidate-guard/test replacement cannot accept extra CORE scope for '+branch,t=>{
    const c=routeFixture(t,{branch,admitted:branch===routeSourceBranch});
    if(branch===routeSourceBranch)applyRoute(c);else{addRouteAdmission(c);commit(c.root,'correct admission before pipeline attack');}
    write(c.root,'scripts/p7-autopilot-guard.sh','#!/usr/bin/env bash\ntouch CANDIDATE_EXECUTED\necho "Scope guard passed."\nexit 0\n',0o755);
    write(c.root,'scripts/p7-autopilot-guard.test.mjs','// replaced candidate tests\n');
    write(c.root,'apps/api/src/modules/staff-access/workflow-route-probe.ts','export const unauthorized = true;\n');
    commit(c.root,'native reviewer candidate-owned pipeline attack');
    const old=routeWorkflowSelection(routeWorkflowBeforeBytes,branch);assert.equal(old.standard||old.active,true);
    const candidate=spawnSync('bash',[path.join(c.root,'scripts/p7-autopilot-guard.sh')],{cwd:c.root,encoding:'utf8'});
    assert.equal(candidate.status,0,output(candidate));const sentinel=path.join(c.root,'CANDIDATE_EXECUTED');assert.equal(fs.existsSync(sentinel),true);fs.unlinkSync(sentinel);
    const fixed=routeWorkflowSelection(String(routeWorkflowBytes),branch);assert.equal(fixed.trusted&&fixed.defense&&!fixed.standard&&!fixed.active,true);
    const trusted=runTrustedDealRuntimeGuard(c);assert.notEqual(trusted.status,0,output(trusted));assert.match(output(trusted),/DEAL_ROUTE_|immutable/u);
    assert.equal(fs.existsSync(sentinel),false,'Accepted BASE validation must never execute the changed candidate guard');
  });
}
test('Deal route workflow: every old unrelated branch predicate is preserved',()=>{
  for(const branch of [routeGuardBranch,'bank/first-customer-home-20260926','ux/deal-runtime-unknown-20260929','r1-founder-role-mode-authority-20260920','unrelated/source']) {
    assert.deepEqual(routeWorkflowSelection(String(routeWorkflowBytes),branch),routeWorkflowSelection(routeWorkflowBeforeBytes,branch));
  }
});
test('Deal route: exact workflow blob in wrong mode rejects protected guard three-file renewal',t=>{
 const c=routeFixture(t,{branch:routeGuardBranch,admitted:false,guardAdoption:true});applyRouteGuard(c);
 git(c.root,['update-index','--cacheinfo','100755,'+routeGuardPins[2][2]+','+routeWorkflowPath]);git(c.root,['commit','-m','wrong workflow mode']);
 const r=runRouteGuardCandidate(c);assert.notEqual(r.status,0,output(r));assert.match(output(r),/DEAL_ROUTE_PIN_OR_MODE/u);
});

const trustedConcurrentSourceBranches = [
  'security/accounting-bff-csrf-3-5-1',
  'security/module-body-validation',
  'security/bff-upstream-path-encoding-4459',
  'security/request-cookie-single-reader-4459',
  'security/open-redirect-demo-login-4459',
  'security/email-check-length-first-4459',
  'security/browser-hardening-headers-4459',
  'security/outbound-redirect-and-surface-4459',
  'security/credential-surface-4459',
  'fix/tai-release-run-event-filter-20261008',
];

function trustedConcurrentManifestPath(branch) {
  return `docs/platform-v7/autopilot/scopes/${branch.split('/')[1]}.json`;
}

function trustedConcurrentManifest(branch, overrides = {}) {
  return `${JSON.stringify({
    schemaVersion: 'platform-v7.concurrent-scope.v1',
    branch,
    status: 'active',
    allowedPaths: ['apps/web/**'],
    ...overrides,
  }, null, 2)}\n`;
}

test('Trusted concurrent-scope sources are registered at every trusted-base workflow entry point', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const trusted = workflow.split('  trusted-immutable-scope:')[1].split('  guard:')[0];
  const prHead = workflow.split('      - name: Validate immutable scope with trusted base guard on PR head')[1]
    .split('      - name: Validate owner-authorized industrial diagnostic bootstrap candidate')[0];
  const standard = workflow.split('      - name: Validate standard branch scope on PR head')[1]
    .split('  standard_validation:')[0];
  for (const branch of trustedConcurrentSourceBranches) {
    assert.ok(trusted.includes(`github.event.pull_request.head.ref == '${branch}'`), branch);
    assert.ok(trusted.includes(`|${branch}|`), branch);
    assert.ok(prHead.includes(`github.head_ref == '${branch}'`), branch);
    assert.ok(prHead.includes(`|${branch}|`), branch);
    assert.ok(standard.includes(`github.head_ref != '${branch}'`), branch);
  }
  assert.equal(new Set(trustedConcurrentSourceBranches).size, 10);
});

test('Trusted concurrent-scope sources are literal immutable branches in the guard', () => {
  const guard = fs.readFileSync(sourceGuard, 'utf8');
  const list = guard.split('is_immutable_scope_branch() {')[1].split('\n}\n')[0];
  for (const branch of trustedConcurrentSourceBranches) {
    assert.ok(list.includes(`"${branch}"`), branch);
    assert.ok(guard.includes(`"${branch}") CONCURRENT_SCOPE_MANIFEST='${trustedConcurrentManifestPath(branch)}'`), branch);
  }
});

for (const branch of trustedConcurrentSourceBranches) {
  for (const mutation of ['admitted paths with own manifest', 'unadmitted', 'foreign source', 'self-expanded state',
    'manifest outside base vector', 'manifest of another branch', 'manifest naming another branch', 'guard script edit']) {
    test(`Trusted concurrent source ${branch}: ${mutation}`, (t) => {
      const context = fixture(t, branch);
      const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
      const manifest = trustedConcurrentManifestPath(branch);
      const state = JSON.parse(fs.readFileSync(path.join(context.root, statePath), 'utf8'));
      const vector = mutation === 'manifest outside base vector' ? ['allowed.txt'] : ['allowed.txt', manifest];
      if (mutation === 'unadmitted') delete state.approvedConcurrentScopes[branch];
      else state.approvedConcurrentScopes[branch] = vector;
      write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
      commit(context.root, 'accepted admission baseline');
      context.baseline = git(context.root, ['rev-parse', 'HEAD']);
      write(context.root, 'allowed.txt', 'bounded source change\n');
      if (['admitted paths with own manifest', 'unadmitted', 'foreign source', 'self-expanded state', 'guard script edit'].includes(mutation)) {
        write(context.root, manifest, trustedConcurrentManifest(branch));
      }
      if (mutation === 'manifest outside base vector') write(context.root, manifest, trustedConcurrentManifest(branch));
      if (mutation === 'manifest of another branch') {
        const other = trustedConcurrentSourceBranches.find((candidate) => candidate !== branch);
        write(context.root, trustedConcurrentManifestPath(other), trustedConcurrentManifest(other));
      }
      if (mutation === 'manifest naming another branch') {
        write(context.root, manifest, trustedConcurrentManifest('security/some-other-branch'));
        state.approvedConcurrentScopes[branch] = vector;
      }
      if (mutation === 'foreign source') write(context.root, 'apps/web/app/layout.tsx', 'unadmitted source\n');
      if (mutation === 'self-expanded state') {
        state.approvedConcurrentScopes[branch] = [...vector, 'apps/web/app/layout.tsx'];
        state.allowedCurrentScope.push('apps/web/**');
        write(context.root, statePath, `${JSON.stringify(state, null, 2)}\n`);
        write(context.root, 'apps/web/app/layout.tsx', 'self-admitted source\n');
      }
      if (mutation === 'guard script edit') {
        write(context.root, 'scripts/p7-autopilot-guard.sh', '#!/usr/bin/env bash\nexit 0\n', 0o755);
      }
      commit(context.root, mutation);
      // The trusted-base workflow runs the accepted base copy of the guard, never the candidate's own edit.
      const baseGuard = path.join(context.root, '..', `${path.basename(context.root)}-base-guard.sh`);
      fs.writeFileSync(baseGuard, git(context.root, ['show', `${context.baseline}:scripts/p7-autopilot-guard.sh`]) + '\n');
      t.after(() => fs.rmSync(baseGuard, { force: true }));
      const result = mutation === 'guard script edit'
        ? spawnSync('bash', [baseGuard], {
          cwd: context.root,
          env: { ...process.env, BASE_REF: context.baseline, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: branch },
          encoding: 'utf8',
        })
        : runGuard(context);
      if (mutation === 'admitted paths with own manifest') {
        assert.equal(result.status, 0, output(result));
      } else {
        assert.notEqual(result.status, 0, output(result));
        assert.match(output(result), /no immutable approved scope|Mutable scope authority changed|Files outside current autopilot scope|CONCURRENT_MANIFEST_|P7_IMMUTABLE_SCOPE/u);
      }
    });
  }
}


const immutableStatePath = 'docs/platform-v7/autopilot/autopilot-state.json';
const immutableStateCapacity = 3 * 1024 * 1024;
const boundedStateBranch = 'security/credential-surface-4459';

function sizedImmutableState(state, bytes) {
  const value = { ...state, retainedCapacityFixture: '' };
  const empty = JSON.stringify(value);
  const remaining = bytes - Buffer.byteLength(empty);
  assert.ok(remaining >= 0);
  // Mixed-width text catches character-count and UTF8 truncation mistakes.
  value.retainedCapacityFixture = '测'.repeat(Math.floor(remaining / 3)) + 'x'.repeat(remaining % 3);
  const result = JSON.stringify(value);
  assert.equal(Buffer.byteLength(result), bytes);
  return result;
}

function boundedStateFixture(t, bytes, branch = boundedStateBranch) {
  const context = fixture(t, branch);
  const state = JSON.parse(fs.readFileSync(path.join(context.root, immutableStatePath), 'utf8'));
  write(context.root, immutableStatePath, sizedImmutableState(state, bytes));
  commit(context.root, 'accepted full bounded state');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  return context;
}

test('immutable state capacity reads the complete actual accepted buyer registry', (t) => {
  const context = fixture(t, buyerBranch);
  const retained = fs.readFileSync(immutableStatePath);
  assert.ok(retained.length > 1024 * 1024);
  assert.ok(retained.length <= immutableStateCapacity);
  const file = 'apps/web/components/platform-v7/FirstCustomerWorkspace.tsx';
  const manifest = 'docs/platform-v7/autopilot/scopes/buyer-first-customer-home-20260925.json';
  write(context.root, immutableStatePath, retained);
  write(context.root, manifest, fs.readFileSync(manifest));
  write(context.root, file, 'accepted buyer source\n');
  commit(context.root, 'full actual accepted registry and manifest');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  write(context.root, file, 'authorized buyer source\n');
  commit(context.root, 'authorized buyer change');
  const result = runGuard(context);
  assert.equal(result.status, 0, output(result));
  assert.deepEqual(fs.readFileSync(path.join(context.root, immutableStatePath)), retained);
});

for (const bytes of [1024 * 1024 + 1, 2251808, immutableStateCapacity]) {
  test(`immutable state capacity accepts complete UTF8 base of ${bytes} bytes`, (t) => {
    const context = boundedStateFixture(t, bytes);
    write(context.root, 'allowed.txt', 'authorized bounded-state change\n');
    commit(context.root, 'authorized bounded-state change');
    const result = runGuard(context);
    assert.equal(result.status, 0, output(result));
    assert.match(result.stdout, /Scope guard passed\./u);
  });
}

for (const bytes of [immutableStateCapacity + 1, immutableStateCapacity + 128 * 1024]) {
  test(`immutable state capacity rejects accepted base of ${bytes} bytes`, (t) => {
    const context = boundedStateFixture(t, bytes);
    write(context.root, 'allowed.txt', 'otherwise authorized change\n');
    commit(context.root, 'otherwise authorized change');
    const result = runGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /P7_IMMUTABLE_STATE_CAPACITY/u);
  });
}

test('immutable state capacity rejects oversized candidate in state-only admission', (t) => {
  const context = boundedStateFixture(t, 2251808, buyerAdmissionBranch);
  const state = JSON.parse(fs.readFileSync(path.join(context.root, immutableStatePath), 'utf8'));
  write(context.root, immutableStatePath, sizedImmutableState(state, immutableStateCapacity + 1));
  commit(context.root, 'oversized state-only candidate');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /P7_IMMUTABLE_STATE_CAPACITY/u);
});

test('immutable state capacity rejects invalid UTF8 instead of decoding replacement characters', (t) => {
  const context = boundedStateFixture(t, 2251808);
  const target = path.join(context.root, immutableStatePath);
  const bytes = fs.readFileSync(target);
  const offset = bytes.indexOf(Buffer.from('测'));
  assert.ok(offset > 0);
  bytes[offset] = 0xff;
  fs.writeFileSync(target, bytes);
  commit(context.root, 'invalid UTF8 accepted state');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  write(context.root, 'allowed.txt', 'otherwise authorized change\n');
  commit(context.root, 'otherwise authorized change');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /P7_IMMUTABLE_STATE_UTF8/u);
});

for (const mutation of ['global path', 'candidate self-admission']) {
  test(`immutable state capacity preserves rejection of ${mutation} on large state`, (t) => {
    const context = boundedStateFixture(t, 2251808);
    if (mutation === 'candidate self-admission') {
      const state = JSON.parse(fs.readFileSync(path.join(context.root, immutableStatePath), 'utf8'));
      state.approvedConcurrentScopes[boundedStateBranch].push('README.md');
      write(context.root, immutableStatePath, JSON.stringify(state));
    }
    write(context.root, 'README.md', 'unapproved change\n');
    commit(context.root, mutation);
    const result = runGuard(context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), mutation === 'global path' ? /Files outside current autopilot scope/u : /Mutable scope authority changed/u);
  });
}

test('immutable state capacity does not enlarge the ordinary manifest buffer', (t) => {
  const context = publicHomeImplementationFixture(t);
  const target = path.join(context.root, publicHomeImplementationManifest);
  const manifest = JSON.parse(fs.readFileSync(target, 'utf8'));
  write(context.root, publicHomeImplementationManifest, sizedImmutableState(manifest, 1024 * 1024 + 1));
  commit(context.root, 'oversized ordinary manifest base');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  write(context.root, 'apps/web/app/platform-v7/page.tsx', 'authorized presentation\n');
  commit(context.root, 'authorized presentation');
  const result = runGuard(context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /accepted public-home manifest:.*ENOBUFS/u);
});
