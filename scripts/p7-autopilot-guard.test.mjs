import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

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

function fixture(t, implementationBranch) {
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

function gitleaksReleaseAttestationFixture(t) {
  const context = fixture(t, gitleaksReleaseAttestationBranch);
  const source = fs.readFileSync(sourceGitleaksReleaseAttestation, 'utf8');
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
  assert.deepEqual(state.approvedConcurrentScopes[gitleaksReleaseAttestationBranch], [gitleaksReleaseAttestationPath]);
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
  assert.equal(root.pnpm.overrides.sharp, '0.35.4');
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
