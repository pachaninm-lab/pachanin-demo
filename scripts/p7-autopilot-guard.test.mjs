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
const FIXTURE_GIT_CONFIG = [['maintenance.auto', 'false'], ['gc.auto', '0'], ['core.looseCompression', '0']];

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
const compositeFixtureSnapshots = new Map();
const fixtureSnapshotEntries = new Map();
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
    copyFixtureSnapshot(previous.directory, root);
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
  captureFixtureSnapshot(context.root, directory);
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

// Preserve modes when freezing the baseline too: recursive cp implementations
// may recreate directories without their special permission bits. Restoring
// modes only when cloning would retain that already-normalized snapshot mode.
function captureFixtureSnapshot(source, directory) {
  fs.cpSync(source, directory, { recursive: true, dereference: false, verbatimSymlinks: true });
  const restoreModes = (relative) => {
    const original = path.join(source, relative);
    const metadata = fs.lstatSync(original);
    if (metadata.isSymbolicLink()) return;
    assert.ok(metadata.isDirectory() || metadata.isFile(), 'fixture snapshots contain only directories, files and symlinks');
    if (metadata.isDirectory()) {
      for (const name of fs.readdirSync(original)) restoreModes(path.join(relative, name));
    }
    fs.chmodSync(path.join(directory, relative), metadata.mode & 0o7777);
  };
  restoreModes('');
}

// Reuse completed immutable baselines, never candidate mutations or assertions.
// Constructors with mutation callbacks or custom Git setup always run normally.
function copyFixtureSnapshot(directory, root) {
  const objects = path.join(directory, '.git', 'objects');
  let entries = fixtureSnapshotEntries.get(directory);
  if (!entries) {
    entries = [];
    const visit = (relative) => {
      const source = path.join(directory, relative);
      if (source === objects) return;
      const metadata = fs.lstatSync(source);
      if (metadata.isDirectory()) {
        entries.push({ relative, kind: 'directory', mode: metadata.mode & 0o7777 });
        for (const name of fs.readdirSync(source)) visit(path.join(relative, name));
      } else if (metadata.isSymbolicLink()) {
        entries.push({ relative, kind: 'symlink', target: fs.readlinkSync(source) });
      } else {
        assert.ok(metadata.isFile(), 'fixture snapshots contain only directories, files and symlinks');
        entries.push({ relative, kind: 'file', mode: metadata.mode & 0o7777 });
      }
    };
    visit('');
    fixtureSnapshotEntries.set(directory, entries);
  }
  // Only traversal metadata is reused. Every file, link, index and ref is
  // copied into this caller's own worktree; no candidate bytes are cached.
  for (const entry of entries) {
    const target = path.join(root, entry.relative);
    if (entry.kind === 'directory') {
      if (entry.relative) {
        fs.mkdirSync(target, { mode: 0o700 });
      }
    } else if (entry.kind === 'symlink') {
      fs.symlinkSync(entry.target, target);
    } else {
      fs.copyFileSync(path.join(directory, entry.relative), target);
      fs.chmodSync(target, entry.mode);
    }
  }
  // Git reads only the immutable snapshot's objects; new objects, refs, index
  // and worktree belong exclusively to the caller. Snapshots outlive all tests.
  write(root, '.git/objects/info/alternates', objects + '\n');
  // Populate first so read-only source directories still accept their children.
  for (const entry of [...entries].reverse()) {
    if (entry.kind === 'directory' && entry.relative) fs.chmodSync(path.join(root, entry.relative), entry.mode);
  }
}

function compositeFixture(t, kind, options, construct) {
  if (Object.getPrototypeOf(options) !== Object.prototype ||
      Reflect.ownKeys(options).some(key => typeof key !== 'string' ||
        !Object.hasOwn(Object.getOwnPropertyDescriptor(options, key), 'value')) ||
      Object.hasOwn(options, 'mutateBase') ||
      Object.values(options).some(value => !['string', 'boolean', 'undefined'].includes(typeof value)) ||
      Object.keys(process.env).some(name => name.startsWith('GIT_') && name !== 'GIT_PAGER')) return construct();
  const custom = spawnSync('git', ['config', '--includes', '--get-regexp', '^(core\\.[Hh]ooks[Pp]ath|init\\.[Tt]emplate[Dd]ir|include[Ii]f\\..*\\.path)$'], { cwd: os.tmpdir(), encoding: 'utf8' });
  if (custom.status !== 1) return construct();
  const inputs = [sourceGuard, sourceResolver, 'docs/platform-v7/autopilot/autopilot-state.json',
    'scripts/security/discover-cryptography.mjs', 'apps/tai/release-source-manifest.json'];
  const identity = inputs.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]);
  const key = createHash('sha256').update(JSON.stringify([kind, options, identity])).digest('hex');
  const previous = compositeFixtureSnapshots.get(key);
  if (previous) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-composite-scope-guard-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
    copyFixtureSnapshot(previous.directory, root);
    assert.equal(git(root, ['rev-parse', 'HEAD']), previous.head);
    assert.equal(git(root, ['symbolic-ref', 'HEAD']), `refs/heads/${previous.context.implementationBranch}`);
    assert.equal(git(root, ['status', '--porcelain']), '');
    return { ...structuredClone(previous.context), root };
  }
  const context = construct();
  assert.ok(Object.values(context).every(value => typeof value === 'string'));
  if (fs.readdirSync(path.join(context.root, '.git', 'hooks')).some(name => !name.endsWith('.sample')) ||
      git(context.root, ['status', '--porcelain']) !== '') return context;
  fixtureSnapshotDirectory ??= fs.mkdtempSync(path.join(os.tmpdir(), 'p7-fixture-snapshots-'));
  const directory = path.join(fixtureSnapshotDirectory, 'composite-' + key);
  captureFixtureSnapshot(context.root, directory);
  compositeFixtureSnapshots.set(key, { directory, head: git(context.root, ['rev-parse', 'HEAD']),
    context: structuredClone(context) });
  return context;
}

function runControlledCacheRegression(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-controlled-cache-regression-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  delete env.NODE_TEST_CONTEXT;
  const found = spawnSync('sh', ['-c', 'command -v git'], { env, encoding: 'utf8' });
  assert.equal(found.status, 0, output(found));
  const executable = fs.realpathSync(found.stdout.trim());
  const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  // Configure Git only in its child process. Keep the Node test process free
  // of Git overrides so the actual cache policy remains under test.
  write(root, 'bin/git', '#!/bin/sh\nGIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null exec ' +
    quote(executable) + ' "$@"\n', 0o755);
  env.PATH = path.join(root, 'bin') + path.delimiter + env.PATH;
  env.PC_CROP_CACHE_REGRESSION_CHILD = t.name;
  const pattern = '^' + t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern', pattern,
    path.resolve('scripts/p7-autopilot-guard.test.mjs')],
  { env, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, output(result));
  const totals = {};
  for (const name of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...result.stdout.matchAll(new RegExp('^# ' + name + ' ([0-9]+)\\r?$', 'gm'))];
    assert.equal(matches.length, 1, 'one terminal TAP total for ' + name);
    totals[name] = Number(matches[0][1]);
    assert.ok(Number.isSafeInteger(totals[name]));
  }
  // Node 20 includes unmatched skipped registrations in its total; newer
  // runners omit them. Require exactly one executed test on either version.
  assert.equal(totals.tests, totals.skipped + 1);
  assert.equal(totals.pass, 1);
  for (const name of ['fail', 'cancelled', 'todo']) assert.equal(totals[name], 0);
}

test('composite baseline copies isolate candidate bytes, refs and relative symlinks', (t) => {
  if (process.env.PC_CROP_CACHE_REGRESSION_CHILD !== t.name) return runControlledCacheRegression(t);
  let constructions = 0;
  const construct = () => {
    constructions++;
    const context = fixture(t, 'test/composite-snapshot-isolation');
    write(context.root, 'baseline/value.txt', 'accepted bytes\n', 0o600);
    fs.symlinkSync('value.txt', path.join(context.root, 'baseline/link'));
    fs.symlinkSync('missing/target', path.join(context.root, 'baseline/dangling'));
    fs.mkdirSync(path.join(context.root, 'baseline/empty'));
    fs.chmodSync(path.join(context.root, 'baseline/empty'), 0o1777);
    write(context.root, 'baseline/readonly.txt', 'read-only bytes\n', 0o400);
    fs.mkdirSync(path.join(context.root, 'baseline/readonly'));
    fs.chmodSync(path.join(context.root, 'baseline/readonly'), 0o500);
    fs.chmodSync(context.root, 0o1700);
    commit(context.root, 'genuine composite baseline');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    return context;
  };
  const copy = fs.cpSync;
  let normalizedDirectoryModes = 0;
  let first;
  try {
    // Reproduce platforms that normalize directory modes during the initial
    // snapshot copy, even when this runtime's cp already preserves them.
    fs.cpSync = (source, directory, options) => {
      copy(source, directory, options);
      const empty = path.join(directory, 'baseline/empty');
      if (fs.existsSync(empty)) {
        fs.chmodSync(empty, 0o755);
        normalizedDirectoryModes++;
      }
    };
    first = compositeFixture(t, 'snapshot-isolation-regression', {}, construct);
  } finally {
    fs.cpSync = copy;
  }
  assert.equal(normalizedDirectoryModes, 1);
  write(first.root, 'baseline/value.txt', 'candidate mutation\n');
  fs.unlinkSync(path.join(first.root, 'baseline/link'));
  fs.symlinkSync('../allowed.txt', path.join(first.root, 'baseline/link'));
  commit(first.root, 'mutated candidate refs and bytes');
  write(first.root, 'untracked.txt', 'must stay in first caller\n');
  const second = compositeFixture(t, 'snapshot-isolation-regression', {}, construct);
  assert.equal(constructions, 1);
  assert.notEqual(first.root, second.root);
  assert.equal(git(second.root, ['rev-parse', 'HEAD']), first.baseline);
  assert.notEqual(git(first.root, ['rev-parse', 'HEAD']), first.baseline);
  assert.notEqual(spawnSync('git', ['cat-file', '-e', git(first.root, ['rev-parse', 'HEAD'])],
    { cwd: second.root }).status, 0, 'another candidate must not gain the first caller\'s new objects');
  assert.equal(fs.readFileSync(path.join(second.root, 'baseline/value.txt'), 'utf8'), 'accepted bytes\n');
  assert.equal(fs.statSync(path.join(second.root, 'baseline/value.txt')).mode & 0o777, 0o600);
  assert.equal(fs.readlinkSync(path.join(second.root, 'baseline/link')), 'value.txt');
  assert.equal(fs.existsSync(path.join(second.root, 'untracked.txt')), false);
  write(second.root, 'baseline/value.txt', 'second mutation\n');
  commit(second.root, 'second caller mutation');
  const third = compositeFixture(t, 'snapshot-isolation-regression', {}, construct);
  assert.equal(constructions, 1);
  assert.equal(fs.readFileSync(path.join(third.root, 'baseline/value.txt'), 'utf8'), 'accepted bytes\n');
  assert.equal(fs.statSync(path.join(third.root, 'baseline/value.txt')).mode & 0o777, 0o600);
  assert.equal(fs.readlinkSync(path.join(third.root, 'baseline/link')), 'value.txt');
  assert.equal(fs.readlinkSync(path.join(third.root, 'baseline/dangling')), 'missing/target');
  assert.equal(fs.statSync(path.join(third.root, 'baseline/empty')).mode & 0o7777, 0o1777);
  assert.equal(fs.statSync(third.root).mode & 0o7777, 0o700);
  assert.deepEqual(fs.readdirSync(path.join(third.root, 'baseline/empty')), []);
  assert.equal(fs.statSync(path.join(third.root, 'baseline/readonly')).mode & 0o7777, 0o500);
  assert.equal(fs.statSync(path.join(third.root, 'baseline/readonly.txt')).mode & 0o7777, 0o400);
  assert.equal(fs.readFileSync(path.join(third.root, 'baseline/readonly.txt'), 'utf8'), 'read-only bytes\n');
  assert.equal(git(third.root, ['rev-parse', 'HEAD']), first.baseline);
  assert.notEqual(fs.statSync(path.join(second.root, '.git/index')).ino,
    fs.statSync(path.join(third.root, '.git/index')).ino);
});

test('custom composite mutation callbacks and Git setup never reuse cached baselines', (t) => {
  if (process.env.PC_CROP_CACHE_REGRESSION_CHILD !== t.name) return runControlledCacheRegression(t);
  let constructions = 0;
  const construct = () => { constructions++; return fixture(t, 'test/composite-custom-setup'); };
  compositeFixture(t, 'custom-setup-regression', {}, construct);
  compositeFixture(t, 'custom-setup-regression', {}, construct);
  assert.equal(constructions, 1);
  compositeFixture(t, 'custom-setup-regression', { mutateBase: () => {} }, construct);
  assert.equal(constructions, 2);
  compositeFixture(t, 'custom-setup-regression', Object.create({ admitted: true }), construct);
  assert.equal(constructions, 3);
  let getterReads = 0;
  compositeFixture(t, 'custom-setup-regression', Object.defineProperty({}, 'admitted',
    { enumerable: true, get() { getterReads++; return true; } }), construct);
  assert.equal(constructions, 4);
  assert.equal(getterReads, 0);
  const old = process.env.GIT_CONFIG_NOSYSTEM;
  try {
    process.env.GIT_CONFIG_NOSYSTEM = '1';
    compositeFixture(t, 'custom-setup-regression', {}, construct);
    assert.equal(constructions, 5);
  } finally {
    if (old === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
    else process.env.GIT_CONFIG_NOSYSTEM = old;
  }
});

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

function publicHomeImplementationFixture(t, options = {}) {
  return compositeFixture(t, 'public-home-implementation', options,
    () => constructPublicHomeImplementationFixture(t, options));
}

function constructPublicHomeImplementationFixture(t, { withManifest = true } = {}) {
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

function poisonIsolationFixture(t, options = {}) {
  return compositeFixture(t, 'poison-isolation', options,
    () => constructPoisonIsolationFixture(t, options));
}

function constructPoisonIsolationFixture(t, { manifest = 'valid' } = {}) {
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
  return compositeFixture(t, 'public-home-governance', {},
    () => constructPublicHomeGovernanceFixture(t));
}

function constructPublicHomeGovernanceFixture(t) {
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

const stoppedIr20Branch = 'ops/ir20-isolated-restore-20260919';
const stoppedIr20Paths = [
  'scripts/release/ir20-restore-drill.sh',
  'scripts/release/test-ir20-restore-drill.py',
  'scripts/release/test-ir20-restore-drill-integration.sh',
  '.github/workflows/ir20-restore-drill.yml',
  'docs/ops/ir20-isolated-restore.md',
  'docs/platform-v7/autopilot/scopes/ir20-isolated-restore-20260919.json',
];
const stoppedIr20Key = 'ir20-stopped-copy-source-20261023';
function stoppedIr20Fixture(t, mutateAccepted = () => {}) {
  const context = fixture(t, stoppedIr20Branch);
  const modes = ['100755', '100755', '100755', '100644', '100644', '100644'];
  const payloads = stoppedIr20Paths.map((file, index) => `accepted stopped-copy source ${index}: ${file}\n`);
  const state = {
    allowedCurrentScope: ['README.md', '**'],
    approvedConcurrentScopes: { [stoppedIr20Branch]: stoppedIr20Paths },
    coordinationAdmissions: { [stoppedIr20Key]: {
      owner: 'ACCOUNT_1_CORE', sourceBranch: stoppedIr20Branch,
      ownerDecision: '#5469#issuecomment-6354447020',
      writerHandoff: '#5469#issuecomment-6368785509',
      authorityBaseExactMain: context.baseline,
      sourcePins: stoppedIr20Paths.map((file, index) => ({
        path: file, mode: modes[index], sha256: createHash('sha256').update(payloads[index]).digest('hex'),
      })),
      dependencySha256: {
        'scripts/production_stopped_runtime_headroom.py': '6b121fad2c380a8425f1ca6024e1740406f26172295c215e01bbe0f200768c14',
        'scripts/production_cold_preservation.py': '19c873694debb0076701a912b394aad6bb0e092947f04d97e5144320ca5ca832',
      },
      productionInvocationAuthorized: false, productionAcceptance: false,
      limits: 'Six-path source-only stopped PG16 volatile-copy prerequisite. No host dispatch, original startup, transfer or new cost.',
    } },
  };
  for (let index = 0; index < stoppedIr20Paths.length; index++) {
    write(context.root, stoppedIr20Paths[index], `old source ${index}\n`, parseInt(modes[index], 8));
  }
  for (const file of Object.keys(state.coordinationAdmissions[stoppedIr20Key].dependencySha256)) {
    write(context.root, file, fs.readFileSync(file), fs.statSync(file).mode);
  }
  commit(context.root, 'immutable before-source profile');
  state.coordinationAdmissions[stoppedIr20Key].authorityBaseExactMain = git(context.root, ['rev-parse', 'HEAD']);
  mutateAccepted(state, context);
  write(context.root, 'docs/platform-v7/autopilot/autopilot-state.json', JSON.stringify(state));
  commit(context.root, 'separately accepted stopped-copy pins');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  context.state = state;
  context.payloads = payloads;
  context.writePayload = () => stoppedIr20Paths.forEach((file, index) =>
    write(context.root, file, payloads[index], parseInt(modes[index], 8)));
  return context;
}
function runStoppedIr20Trusted(t, context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ir20-base-guard-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const trusted = path.join(directory, 'guard.sh');
  write(directory, 'guard.sh', git(context.root, ['show', `${context.baseline}:scripts/p7-autopilot-guard.sh`]));
  return spawnSync('bash', [trusted], { cwd: context.root, encoding: 'utf8', env: {
    ...process.env, BASE_REF: context.baseline, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: stoppedIr20Branch,
  } });
}

test('IR20 stopped-copy pins: trusted base accepts exact six objects with no execution grant', t => {
  const context = stoppedIr20Fixture(t);
  context.writePayload();
  commit(context.root, 'exact admitted payload');
  const result = runStoppedIr20Trusted(t, context);
  assert.equal(result.status, 0, output(result));
  assert.match(output(result), /IR20_SOURCE_PINS: accepted-base exact six-file payload verified/u);
});

test('IR20 stopped-copy pins: candidate-only admission cannot grant itself authority', t => {
  let proposed;
  const context = stoppedIr20Fixture(t, state => {
    proposed = structuredClone(state);
    delete state.coordinationAdmissions[stoppedIr20Key];
    delete state.approvedConcurrentScopes[stoppedIr20Branch];
  });
  context.writePayload();
  write(context.root, 'docs/platform-v7/autopilot/autopilot-state.json', JSON.stringify(proposed));
  commit(context.root, 'candidate tries to self-admit exact payload');
  const result = runStoppedIr20Trusted(t, context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /ACCEPTED_ADMISSION_MISSING/u);
});

test('IR20 stopped-copy pins: unchanged three-MiB state capacity remains usable', t => {
  const context = stoppedIr20Fixture(t);
  const file = path.join(context.root, 'docs/platform-v7/autopilot/autopilot-state.json');
  fs.appendFileSync(file, ' '.repeat(3 * 1024 * 1024 - fs.statSync(file).size));
  commit(context.root, 'accepted state at existing byte capacity');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  context.writePayload();
  commit(context.root, 'exact six objects');
  const result = runStoppedIr20Trusted(t, context);
  assert.equal(result.status, 0, output(result));
});

for (const mutation of ['missing admission', 'wrong owner', 'wrong branch', 'wrong owner decision', 'wrong handoff',
  'unknown startup grant', 'unknown restore grant', 'unknown field', 'changed limits',
  'execution grant', 'acceptance grant', 'expanded vector', 'reordered pins', 'invalid digest', 'wrong mode pin',
  'missing pin', 'extra pin field', 'wrong dependency pin', 'wrong dependency bytes', 'nonancestor authority']) {
  test(`IR20 stopped-copy pins: rejects accepted authority with ${mutation}`, t => {
    const context = stoppedIr20Fixture(t, (state, fixtureContext) => {
      const record = state.coordinationAdmissions[stoppedIr20Key];
      if (mutation === 'missing admission') delete state.coordinationAdmissions[stoppedIr20Key];
      if (mutation === 'wrong owner') record.owner = 'OTHER';
      if (mutation === 'wrong branch') record.sourceBranch = 'other';
      if (mutation === 'wrong owner decision') record.ownerDecision = 'candidate decision';
      if (mutation === 'wrong handoff') record.writerHandoff = 'candidate handoff';
      if (mutation === 'unknown startup grant') record.startupAuthorized = true;
      if (mutation === 'unknown restore grant') record.restoreAuthorized = true;
      if (mutation === 'unknown field') record.additionalAuthority = false;
      if (mutation === 'changed limits') record.limits = 'Original startup permitted';
      if (mutation === 'execution grant') record.productionInvocationAuthorized = true;
      if (mutation === 'acceptance grant') record.productionAcceptance = true;
      if (mutation === 'expanded vector') state.approvedConcurrentScopes[stoppedIr20Branch] = [...stoppedIr20Paths, '**'];
      if (mutation === 'reordered pins') record.sourcePins.reverse();
      if (mutation === 'invalid digest') record.sourcePins[0].sha256 = 'invalid';
      if (mutation === 'wrong mode pin') record.sourcePins[0].mode = '100644';
      if (mutation === 'missing pin') record.sourcePins.pop();
      if (mutation === 'extra pin field') record.sourcePins[0].alternate = true;
      if (mutation === 'wrong dependency pin') record.dependencySha256['scripts/production_cold_preservation.py'] = '0'.repeat(64);
      if (mutation === 'wrong dependency bytes') write(fixtureContext.root, 'scripts/production_cold_preservation.py', 'unreviewed dependency');
      if (mutation === 'nonancestor authority') record.authorityBaseExactMain = '0'.repeat(40);
    });
    context.writePayload();
    commit(context.root, 'candidate cannot repair accepted authority');
    const result = runStoppedIr20Trusted(t, context);
    assert.notEqual(result.status, 0, output(result));
  });
}

for (const file of stoppedIr20Paths) {
  test(`IR20 stopped-copy pins: preserves intervening main bytes in ${file}`, t => {
    const context = stoppedIr20Fixture(t);
    fs.appendFileSync(path.join(context.root, file), 'intervening accepted main fix\n');
    commit(context.root, 'new accepted main source fix after admission');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    context.writePayload();
    commit(context.root, 'stale pinned source attempts to replace main fix');
    const result = runStoppedIr20Trusted(t, context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /REPLACEMENT_BASE_DRIFT/u);
  });
}

for (const mutation of ['extra code', 'partial payload', 'extra path', 'candidate guard bypass', 'candidate workflow bypass',
  'candidate pins', 'file mode', 'symlink', 'rename', 'empty diff', 'dependency change']) {
  test(`IR20 stopped-copy pins: trusted guard rejects ${mutation}`, t => {
    const context = stoppedIr20Fixture(t);
    if (mutation !== 'empty diff') context.writePayload();
    const first = stoppedIr20Paths[0];
    if (mutation === 'extra code') fs.appendFileSync(path.join(context.root, first), '\n# unpinned mutation\n');
    if (mutation === 'partial payload') write(context.root, stoppedIr20Paths[5], 'old source 5\n');
    if (mutation === 'extra path') write(context.root, 'README.md', 'candidate-wide primary scope is not authority');
    if (mutation === 'candidate guard bypass') write(context.root, 'scripts/p7-autopilot-guard.sh', 'exit 0\n');
    if (mutation === 'candidate workflow bypass') write(context.root, '.github/workflows/platform-v7-autopilot-guard.yml', 'name: bypass\n');
    if (mutation === 'candidate pins') {
      context.state.coordinationAdmissions[stoppedIr20Key].sourcePins[0].sha256 = '0'.repeat(64);
      write(context.root, 'docs/platform-v7/autopilot/autopilot-state.json', JSON.stringify(context.state));
    }
    if (mutation === 'file mode') fs.chmodSync(path.join(context.root, first), 0o644);
    if (mutation === 'symlink') {
      fs.unlinkSync(path.join(context.root, first));
      fs.symlinkSync('test-ir20-restore-drill.py', path.join(context.root, first));
    }
    if (mutation === 'rename') fs.renameSync(path.join(context.root, first), path.join(context.root, `${first}.renamed`));
    if (mutation === 'dependency change') fs.appendFileSync(path.join(context.root, 'scripts/production_cold_preservation.py'), '\n# drift\n');
    if (mutation !== 'empty diff') commit(context.root, `adversarial ${mutation}`);
    const result = runStoppedIr20Trusted(t, context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /IR20_SOURCE_PINS:/u);
  });
}

for (const mutation of ['oversize', 'invalid UTF-8']) {
  test(`IR20 stopped-copy pins: fails closed on ${mutation} accepted state before empty-diff shortcut`, t => {
    const context = stoppedIr20Fixture(t);
    const file = path.join(context.root, 'docs/platform-v7/autopilot/autopilot-state.json');
    if (mutation === 'oversize') fs.writeFileSync(file, ' '.repeat(3 * 1024 * 1024 + 1));
    else fs.appendFileSync(file, Buffer.from([0xff]));
    commit(context.root, `invalid accepted state ${mutation}`);
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    const result = runStoppedIr20Trusted(t, context);
    assert.notEqual(result.status, 0, output(result));
  });
}

function qwenFailedEvidenceFixture(t) {
  return compositeFixture(t, 'qwen-failed-evidence', {},
    () => constructQwenFailedEvidenceFixture(t));
}

function constructQwenFailedEvidenceFixture(t) {
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
  return compositeFixture(t, 'kind-minio-image-source', {},
    () => constructKindMinioImageSourceFixture(t));
}

function constructKindMinioImageSourceFixture(t) {
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
  return compositeFixture(t, 'final-public-manifest-fallback', {},
    () => constructFinalPublicManifestFallbackFixture(t));
}

function constructFinalPublicManifestFallbackFixture(t) {
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
  return compositeFixture(t, 'final-public-governance', { admitted },
    () => constructFinalPublicGovernanceFixture(t, admitted));
}

function constructFinalPublicGovernanceFixture(t, admitted = true) {
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

for (const branch of ['feat/pc-crop-auction-inventory-authority-4997', 'ops/pc-crop-w1-production-acceptance-4997', qwenFailedEvidenceBranch, kindMinioImageSourceBranch, gitleaksReleaseAttestationBranch, ...finalPublicBranches, finalPublicGovernanceBranch, industrialGovernanceBranch, industrialDiagnosticBranch, 'ops/ir20-isolated-restore-20260919']) {
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
  return compositeFixture(t, 'next-security', {},
    () => constructNextSecurityFixture(t));
}

function constructNextSecurityFixture(t) {
  const context = fixture(t, nextSecurityPatchBranch);
  write(context.root, 'docs/platform-v7/autopilot/autopilot-state.json', JSON.stringify({
    allowedCurrentScope: ['README.md'],
    approvedConcurrentScopes: { [nextSecurityPatchBranch]: nextSecurityPaths },
  }));
  commit(context.root, 'owner-authorized exact dependency scope');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  return context;
}
function nextSecuritySizedState(context, size) {
  const file = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = JSON.parse(fs.readFileSync(path.join(context.root, file), 'utf8'));
  state.capacityProbe = '测';
  state.capacityPadding = '';
  const overhead = Buffer.byteLength(JSON.stringify(state));
  assert.ok(size >= overhead);
  state.capacityPadding = 'x'.repeat(size - overhead);
  const text = JSON.stringify(state);
  assert.equal(Buffer.byteLength(text), size);
  return text;
}
for (const size of [2251808, 3 * 1024 * 1024]) {
  test(`Next security patch reads complete accepted and head state of ${size} bytes`, t => {
    const context = nextSecurityFixture(t);
    write(context.root, immutableStatePath, nextSecuritySizedState(context, size));
    commit(context.root, 'large accepted security state');
    context.baseline = git(context.root, ['rev-parse', 'HEAD']);
    write(context.root, 'apps/web/package.json', '{"dependencies":{"next":"15.5.28"}}');
    commit(context.root, 'bounded security patch with complete state');
    const result = runGuard(context);
    assert.equal(result.status, 0, output(result));
  });
}
for (const side of ['base', 'head']) {
  for (const mutation of ['capacity', 'invalid UTF8', 'global scope']) {
    test(`Next security patch rejects ${side} ${mutation} with large state`, t => {
      const context = nextSecurityFixture(t);
      const file = immutableStatePath;
      let text = nextSecuritySizedState(context, mutation === 'capacity' ? 3 * 1024 * 1024 + 1 : 2251808);
      if (mutation === 'global scope') {
        const state = JSON.parse(text);
        if (side === 'base') delete state.approvedConcurrentScopes[nextSecurityPatchBranch];
        else state.allowedCurrentScope.push('apps/web/**');
        text = JSON.stringify(state);
      }
      let bytes = Buffer.from(text);
      if (mutation === 'invalid UTF8') {
        const offset = bytes.indexOf(Buffer.from('测'));
        assert.ok(offset > 0); bytes[offset] = 0xff;
      }
      if (side === 'base') {
        fs.writeFileSync(path.join(context.root, file), bytes);
        commit(context.root, 'invalid accepted security state');
        context.baseline = git(context.root, ['rev-parse', 'HEAD']);
        // A valid candidate cannot repair or replace unaccepted base authority.
        write(context.root, file, nextSecuritySizedState(nextSecurityFixture(t), 2251808));
      } else fs.writeFileSync(path.join(context.root, file), bytes);
      write(context.root, 'apps/web/package.json', '{"dependencies":{"next":"15.5.28"}}');
      commit(context.root, 'security state rejection probe');
      const result = runGuard(context);
      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /NEXT_SECURITY_PATCH_(STATE_CAPACITY|STATE_UTF8|STATE_MUTATION|ACCEPTED_SCOPE_MISSING)/u);
    });
  }
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
  return compositeFixture(t, 'industrial', { branch, admitted },
    () => constructIndustrialFixture(t, branch, admitted));
}

function constructIndustrialFixture(t, branch, admitted = true) {
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
  assert.equal(root.pnpm.overrides.multer, '2.5.0');
  assert.equal(root.pnpm.overrides.sharp, '0.35.5');
  assert.equal(web.dependencies.next, '15.5.28');
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
function dealRuntimeFixture(t, options = {}) {
  return compositeFixture(t, 'deal-runtime', options, () => constructDealRuntimeFixture(t, options));
}
function constructDealRuntimeFixture(t, { admitted = false, renewal = true, admission = false } = {}) {
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
  return compositeFixture(t, 'generated-deal-runtime', {}, () => constructGeneratedDealRuntimeFixture(t));
}
function constructGeneratedDealRuntimeFixture(t) {
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
  return compositeFixture(t, 'landing-metadata', { implementation }, () => constructLandingMetadataFixture(t, implementation));
}
function constructLandingMetadataFixture(t, implementation = false) {
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
function dealLocaleFixture(t, options = {}) {
  return compositeFixture(t, 'deal-locale', options, () => constructDealLocaleFixture(t, options));
}
function constructDealLocaleFixture(t, { implementation = false, accepted = false, pinnedSources = false, mutateBase = () => {} } = {}) {
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
function localeInventoryFixture(t, options = {}) {
  return compositeFixture(t, 'locale-inventory', options, () => constructLocaleInventoryFixture(t, options));
}
function constructLocaleInventoryFixture(t, { implementation = false, admitted = false, mutateBase = () => {}, generatorMode = '100644' } = {}) {
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
function bankMoneyFixture(t, options = {}) {
  return compositeFixture(t, 'bank-money', options, () => constructBankMoneyFixture(t, options));
}
function constructBankMoneyFixture(t, { implementation = false, admitted = false, purpose = true, correction = true, mutateBase = () => {} } = {}) {
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
function routeFixture(t, options = {}) {
  return compositeFixture(t, 'deal-route', options, () => constructRouteFixture(t, options));
}
function constructRouteFixture(t, { branch = routeSourceBranch, admitted = true, guardAdoption = false, purpose = true } = {}) {
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

// The recovery exception is exercised with the full retained source patch and
// real Git blobs/modes, using the same accepted-base guard as native validation.
const headroomBranch = 'fix/pc-crop-docker-headroom-rollover-4637';
const headroomMarker = '\n## PC-CROP bounded Docker headroom parent-prune correction — 2026-10-11\n\n```json\n';
function headroomPurpose() {
  const queue = fs.readFileSync('docs/platform-v7/execution-queue.md', 'utf8');
  const parts = queue.split(headroomMarker);
  assert.equal(parts.length, 2, 'complete recovery purpose must be retained');
  return JSON.parse(parts[1].slice(0, parts[1].indexOf('\n```\n')));
}
function headroomFixture(t, mutate = () => {}, { ancestry = true } = {}) {
  const purpose = headroomPurpose();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-crop-headroom-scope-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = { allowedCurrentScope: ['README.md', 'apps/api/src/main.ts'],
    approvedConcurrentScopes: { [headroomBranch]: purpose.sourcePayloads.map(item => item.path) } };
  mutate(purpose, state);
  // Seed the actual pinned historical guard tree, not a later worktree repair.
  for (const item of headroomPurpose().guardPayloads) {
    const r = spawnSync('git', ['cat-file', 'blob', item.afterBlob], { encoding: 'utf8' });
    assert.equal(r.status, 0, output(r)); write(root, item.path, r.stdout);
    fs.chmodSync(path.join(root, item.path), item.mode === '100755' ? 0o755 : 0o644);
  }
  write(root, 'scripts/p7-source-controlled-scope.mjs', fs.readFileSync('scripts/p7-source-controlled-scope.mjs', 'utf8'));
  for (const item of headroomPurpose().sourcePayloads) {
    const r = spawnSync('git', ['cat-file', 'blob', item.beforeBlob], { encoding: 'utf8' });
    assert.equal(r.status, 0, output(r)); write(root, item.path, r.stdout);
    fs.chmodSync(path.join(root, item.path), item.mode === '100755' ? 0o755 : 0o644);
  }
  write(root, statePath, JSON.stringify(state));
  write(root, 'docs/platform-v7/execution-queue.md', headroomMarker + JSON.stringify(purpose) + '\n```\n');
  write(root, 'README.md', 'accepted unrelated source\n');
  git(root, ['init', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'Recovery regression']);
  git(root, ['config', 'user.email', 'recovery@example.invalid']);
  const objectDir = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-path', 'objects'], { encoding: 'utf8' });
  assert.equal(objectDir.status, 0, output(objectDir));
  write(root, '.git/objects/info/alternates', objectDir.stdout.trim() + '\n');
  git(root, ['add', '.']); const tree = git(root, ['write-tree']);
  const baseline = git(root, ['commit-tree', tree, ...(ancestry ? ['-p', headroomPurpose().authorityBaseExactMain] : []), '-m', 'accepted scope fixture']);
  git(root, ['update-ref', 'HEAD', baseline]); git(root, ['switch', '-c', headroomBranch]);
  return { root, baseline, implementationBranch: headroomBranch };
}
function applyHeadroomPayload(c) {
  const r = spawnSync('git', ['apply', '--index', '-'], { cwd: c.root, encoding: 'utf8', input: headroomPurpose().sourcePatch });
  assert.equal(r.status, 0, output(r));
}
function runTrustedHeadroomGuard(c) {
  const trusted = spawnSync('git', ['show', c.baseline + ':scripts/p7-autopilot-guard.sh'], { cwd: c.root, encoding: 'utf8' });
  assert.equal(trusted.status, 0, output(trusted));
  const file = path.join(c.root, '.git', 'trusted-headroom-guard.sh'); fs.writeFileSync(file, trusted.stdout);
  return spawnSync('bash', [file], { cwd: c.root, encoding: 'utf8', env: { ...process.env,
    BASE_REF: c.baseline, HEAD_REF: 'HEAD', GITHUB_HEAD_REF: c.implementationBranch } });
}
function checkHeadroom(c, expected = 1) {
  commit(c.root, 'candidate recovery source');
  const r = runTrustedHeadroomGuard(c);
  assert.equal(r.status === 0 ? 0 : 1, expected, output(r));
  if (expected) assert.match(output(r), /PC_CROP_HEADROOM_SCOPE_|Mutable scope authority changed/u);
}
test('headroom: rejects restoring implicit parent pruning in the committed source', t => {
  const c = headroomFixture(t); applyHeadroomPayload(c);
  const file = path.join(c.root, 'scripts/production-docker-headroom-recovery.sh');
  const correct = fs.readFileSync(file, 'utf8');
  assert.equal(correct.split("'rm', '--no-prune', ").length - 1, 2);
  fs.writeFileSync(file, correct.replaceAll("'rm', '--no-prune', ", "'rm', "));
  checkHeadroom(c);
});
test('headroom: full retained three-file payload passes from accepted base', t => {
  const c = headroomFixture(t); applyHeadroomPayload(c); checkHeadroom(c, 0);
});
for (const [name, mutate] of [
  ['missing source admission', (_, state) => { delete state.approvedConcurrentScopes[headroomBranch]; }],
  ['widened source vector', (_, state) => { state.approvedConcurrentScopes[headroomBranch].push('README.md'); }],
  ['wrong retained owner', purpose => { purpose.owner = 'ACCOUNT_2_PRODUCT'; }],
  ['wrong source branch', purpose => { purpose.sourceBranch = 'fix/other-recovery'; }],
  ['wrong source after blob', purpose => { purpose.sourcePayloads[0].afterBlob = 'a'.repeat(40); }],
  ['unaccepted guard bytes', purpose => { purpose.guardPayloads[0].afterBlob = 'a'.repeat(40); }],
  ['wrong guard content checksum', purpose => { purpose.guardPayloads[0].sha256 = 'a'.repeat(64); }],
]) test('headroom: rejects ' + name, t => {
  const c = headroomFixture(t, mutate); applyHeadroomPayload(c); checkHeadroom(c);
});
test('headroom: rejects missing accepted purpose', t => {
  const c = headroomFixture(t); write(c.root, 'docs/platform-v7/execution-queue.md', 'missing purpose\n');
  commit(c.root, 'base without purpose'); c.baseline = git(c.root, ['rev-parse', 'HEAD']);
  applyHeadroomPayload(c); checkHeadroom(c);
});
test('headroom: rejects authority without accepted-main ancestry', t => {
  const c = headroomFixture(t, () => {}, { ancestry: false }); applyHeadroomPayload(c); checkHeadroom(c);
});
for (const item of ['scripts/production-docker-headroom-recovery.sh', '.github/workflows/production-docker-headroom-recovery.yml',
  'docs/platform-v7/autopilot/scopes/pc-crop-hosted-docker-headroom-recovery-3785.json']) {
  test('headroom: rejects partial source without ' + item, t => {
    const c = headroomFixture(t); applyHeadroomPayload(c); git(c.root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', item]); checkHeadroom(c);
  });
  test('headroom: rejects modified bytes in ' + item, t => {
    const c = headroomFixture(t); applyHeadroomPayload(c); fs.appendFileSync(path.join(c.root, item), '\n'); checkHeadroom(c);
  });
  test('headroom: rejects changed mode in ' + item, t => {
    const c = headroomFixture(t); applyHeadroomPayload(c); const target = path.join(c.root, item);
    fs.chmodSync(target, item.endsWith('.sh') ? 0o644 : 0o755); checkHeadroom(c);
  });
}
for (const item of ['README.md', 'apps/api/src/main.ts', 'scripts/p7-autopilot-guard.sh',
  'docs/platform-v7/autopilot/autopilot-state.json', 'docs/platform-v7/execution-queue.md']) {
  test('headroom: rejects PRIMARY or candidate authority mutation ' + item, t => {
    const c = headroomFixture(t); applyHeadroomPayload(c); write(c.root, item, 'candidate authority\n'); checkHeadroom(c);
  });
}
test('headroom: candidate correct dirty bytes cannot rescue committed wrong payload', t => {
  const c = headroomFixture(t); applyHeadroomPayload(c); const file = 'scripts/production-docker-headroom-recovery.sh';
  const correct = fs.readFileSync(path.join(c.root, file)); fs.appendFileSync(path.join(c.root, file), '\n');
  commit(c.root, 'wrong committed payload'); fs.writeFileSync(path.join(c.root, file), correct);
  const r = runTrustedHeadroomGuard(c); assert.notEqual(r.status, 0, output(r)); assert.match(output(r), /PC_CROP_HEADROOM_SCOPE_SOURCE_PAYLOAD_OR_MODE/u);
});
test('headroom: both workflow entry points use trusted-base scope and reject forks', () => {
  const text = fs.readFileSync(sourceWorkflow, 'utf8');
  for (const marker of ["github.event.pull_request.head.ref == '" + headroomBranch + "'",
    "github.head_ref == '" + headroomBranch + "'", "github.head_ref != '" + headroomBranch + "'",
    '|' + headroomBranch + '|', 'git show "$BASE_SHA:scripts/p7-autopilot-guard.sh"',
    'HEAD_REPOSITORY', 'PC-CROP immutable scope · PR-head defense']) assert.ok(text.includes(marker), marker);
});

const stoppedInspectionBranch = 'fix/gekta-docker-diagnostic-route-20260927';
const stoppedInspectionKey = 'stopped-recovery-inspection-test-20261023';
const stoppedInspectionWorkflow = '.github/workflows/production-docker-headroom-diagnostic.yml';
const stoppedInspectionTest = 'scripts/test_production_stopped_runtime_headroom.py';
const stoppedInspectionState = 'docs/platform-v7/autopilot/autopilot-state.json';
const stoppedInspectionOrigin = 'a509789c22298375130d70fde95915b8daa7634a';
function stoppedInspectionFixture(t, mutation = '') {
  const c = fixture(t, stoppedInspectionBranch);
  const objectDir = git(process.cwd(), ['rev-parse', '--path-format=absolute', '--git-path', 'objects']);
  write(c.root, '.git/objects/info/alternates', objectDir + '\n');
  const before = git(process.cwd(), ['show', stoppedInspectionOrigin + ':' + stoppedInspectionTest]) + '\n';
  assert.equal(createHash('sha256').update(before).digest('hex'), '6658a4492242e7ee3e7be9b83be4df005cd879c389b0ee00cb0aefa6d2cf7201');
  const purpose = { owner: 'ACCOUNT_1_CORE', ownerDecision: '#5469#issuecomment-6354447020',
    productionAcceptance: false, authorityBaseExactMain: stoppedInspectionOrigin };
  const state = { allowedCurrentScope: ['README.md'], approvedConcurrentScopes: {
    [stoppedInspectionBranch]: [stoppedInspectionWorkflow, stoppedInspectionTest],
  }, coordinationAdmissions: { [stoppedInspectionKey]: purpose } };
  if (mutation === 'wrong owner') purpose.owner = 'ACCOUNT_2_PRODUCT';
  if (mutation === 'wrong decision') purpose.ownerDecision = '#5469#issuecomment-0';
  if (mutation === 'production credit') purpose.productionAcceptance = true;
  if (mutation === 'extra purpose field') purpose.extraAuthority = true;
  if (mutation === 'malformed origin') purpose.authorityBaseExactMain = 'main';
  if (mutation === 'unrelated origin') purpose.authorityBaseExactMain = '0'.repeat(40);
  if (mutation === 'widened accepted vector') state.approvedConcurrentScopes[stoppedInspectionBranch].push('README.md');
  if (['missing accepted purpose', 'candidate-only purpose', 'legacy workflow only'].includes(mutation)) {
    delete state.coordinationAdmissions[stoppedInspectionKey];
    state.approvedConcurrentScopes[stoppedInspectionBranch] = [stoppedInspectionWorkflow];
  }
  write(c.root, stoppedInspectionState, JSON.stringify(state) + '\n');
  write(c.root, stoppedInspectionWorkflow, 'name: accepted diagnostic fixture\n');
  write(c.root, stoppedInspectionTest, before + (mutation === 'changed accepted test' ? '# extra\n' : ''));
  git(c.root, ['add', '--all']);
  const tree = git(c.root, ['write-tree']);
  c.baseline = git(c.root, ['commit-tree', tree, '-p', stoppedInspectionOrigin, '-m', 'accepted inspection authority fixture']);
  git(c.root, ['update-ref', 'HEAD', c.baseline]);
  const after = before.replace("        expected = {'production-cold-preservation.yml',\n",
    "        expected = {'production-docker-headroom-diagnostic.yml',\n                    'production-cold-preservation.yml',\n");
  assert.equal(createHash('sha256').update(after).digest('hex'), '6f3fcdd7662a5027c06a64e9984e00f6fd81ff6beae6c8c8409785f37d30c8f9');
  if (mutation !== 'missing workflow') write(c.root, stoppedInspectionWorkflow, 'name: candidate diagnostic fixture\n');
  if (!['missing test', 'legacy workflow only'].includes(mutation)) write(c.root, stoppedInspectionTest, after);
  if (mutation === 'changed candidate test') fs.appendFileSync(path.join(c.root, stoppedInspectionTest), '# extra\n');
  if (mutation === 'extra source') write(c.root, 'README.md', 'unauthorized source\n');
  if (mutation === 'state mutation') state.allowedCurrentScope.push('**');
  if (mutation === 'candidate-only purpose') {
    state.coordinationAdmissions[stoppedInspectionKey] = purpose;
    state.approvedConcurrentScopes[stoppedInspectionBranch] = [stoppedInspectionWorkflow, stoppedInspectionTest];
  }
  if (['state mutation', 'candidate-only purpose'].includes(mutation)) write(c.root, stoppedInspectionState, JSON.stringify(state) + '\n');
  if (mutation === 'test executable') fs.chmodSync(path.join(c.root, stoppedInspectionTest), 0o755);
  if (mutation === 'workflow executable') fs.chmodSync(path.join(c.root, stoppedInspectionWorkflow), 0o755);
  if (mutation === 'state executable') fs.chmodSync(path.join(c.root, stoppedInspectionState), 0o755);
  if (mutation === 'test symlink') {
    fs.unlinkSync(path.join(c.root, stoppedInspectionTest));
    fs.symlinkSync('README.md', path.join(c.root, stoppedInspectionTest));
  }
  return c;
}
function checkStoppedInspection(c, accepted = false) {
  commit(c.root, 'candidate inspection source');
  const result = runIndustrialTrustedGuard(c);
  if (accepted) assert.equal(result.status, 0, output(result));
  else {
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /STOPPED_INSPECTION_SCOPE_|Files outside current autopilot scope|Mutable scope authority changed/u);
  }
}
for (const mutation of ['', 'legacy workflow only']) {
  test('stopped inspection: accepts ' + (mutation || 'exact admitted two-file correction'), t => {
    checkStoppedInspection(stoppedInspectionFixture(t, mutation), true);
  });
}
for (const mutation of ['wrong owner', 'wrong decision', 'production credit', 'extra purpose field',
  'malformed origin', 'unrelated origin', 'widened accepted vector', 'missing workflow', 'missing test',
  'changed accepted test', 'changed candidate test', 'extra source', 'state mutation', 'test executable',
  'workflow executable', 'state executable', 'test symlink', 'missing accepted purpose', 'candidate-only purpose']) {
  test('stopped inspection: rejects ' + mutation, t => checkStoppedInspection(stoppedInspectionFixture(t, mutation)));
}
test('stopped inspection: dirty correct test cannot rescue committed wrong bytes', t => {
  const c = stoppedInspectionFixture(t, 'changed candidate test');
  commit(c.root, 'wrong committed test');
  const wrong = fs.readFileSync(path.join(c.root, stoppedInspectionTest), 'utf8');
  write(c.root, stoppedInspectionTest, wrong.slice(0, -'# extra\n'.length));
  const result = runIndustrialTrustedGuard(c);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /STOPPED_INSPECTION_SCOPE_TEST_BLOB/u);
});
test('stopped inspection: rejects a head which skips the accepted base', t => {
  const c = stoppedInspectionFixture(t);
  git(c.root, ['add', '--all']);
  const tree = git(c.root, ['write-tree']);
  const head = git(c.root, ['commit-tree', tree, '-p', stoppedInspectionOrigin, '-m', 'head skips accepted base']);
  git(c.root, ['update-ref', 'HEAD', head]);
  const result = runIndustrialTrustedGuard(c);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /STOPPED_INSPECTION_SCOPE_ANCESTRY/u);
});

const stoppedErrorsKey = 'stopped-inspection-errors-20261023';
const stoppedErrorsOrigin = '05ea2dda74ced6eafb3255beb2a44df5abce9a78';
// Exact public workflow fixture; decompression and Git/content hashes bind its bytes.
const stoppedErrorsAfter = inflateSync(Buffer.from('eNrkvW1j2zayMPrdv4LrdkspkeSXOG6iVN1VbCXRqW3pSnK6qePlQ0uUzUYiVVGy43V8f/udF4AESZCiHKfb59yeszFFAgNgMBgMBvPi2VOnbnTn/mg5XLi+Zxz6w0/O3Hjn2KO570+NHjxUO97k1jh07UvPDxbucGPD9+obhjFbTibW3Plj6QQL/A1v7MVVwI+GUTXM2qW7uFpebN3480/jiX8TbM3Cpqojaqp6JZqqjsIGarfTiQlQ3CBYOtbQn04dT7SwuJ05Qd04G84de+GMzjc2Zs58CgUBIrU89L0FlIYyUGK0sQG/h8v53PGGt/j5cu4vZ3UjpxtYzYcBK/1BsLY3dCZV16tC1cu5E0ADY3sSOBsbjneNkI/a71vWYee42T6pG5+9Kvz3Irj4fbx34Ywvfr8MXl7U8O1sx3ah9GHrTfP0aGC96/QHdWPn5fPazsvazi78/zZ8bZ4O3nV67cEHq93vn7ask9Pj161e3djbf/YjfG69bx+2Tg6guTa8tOcLd2wPFwWRu7Hxu38RomoOFRmzHpHCe3vijgCzhL0q4sGIqoY1qII7rhs/V8Vk80TXnGvAvYWgjEbDMFUKMY0vX0Thkr50bLpN44cfRPEY8BqVqnnL6QXQKVRDnChlY7BrAljtwh/dUhsKjuTAHIEsg+lkUZ3arqf0NtF+LkjXC2bOcFENFv5s5oyAmIb+tTO/jcMulwn0fOkFgOK6sbxYeotldXevtr3HVO5OHX8JpV1vuUB639mm98HCmSnraxngN5uaDraGV87wE9T65/Ve2PMb6Hk9/AVNOjBp39/dFZqvH36QxYIrG/ARx8PcmfmBu/Dnt7WRM7aXk4V1MYdVcmXc3ystwvIM3GBRhQU7gmourBm5cuQwPMmErlWyu/CX3sie34awgitnMqkbF3ZwFb4DFNaNL0pzgbMwqi1n6RszdwbdcidqX24XV773DJr86Sez+8FUPrnTmT9fGHawSL/8PfC99FvkdRP3Iv1h7qTfBcsLoJIhsI30t4XzeXEzt2fKl/EcWC+xOlmoD38nzglgKpjZQwc6aoQ/NpSaktMaDdnBWhf+lr6KFZdrOC0WdrQEjNQfud5lw1wuxtUXZjlGXX8sXZhnaPxMeY3/ba5cw5uV3CoPX8kpwKYWMCymeW3iX0KNrAoRyVv+jefM0wW7B1a31zm0+v13xNqtN+2Tt61et9c+GaRL9xdzd7h4B4j+xbk9wOWLiL11gnTR1/ZieHXsjxz95+PTQXPQ7pxYx53DVqPXah5anZOjD+mCvdbBaa+PW1V/0Ok137as0z782zjpDKyDztFR62DQOrQA1nELRtLqt3rvCXAa0iTwx0bV6xpPj3Y07ZyeEIxmtw0tNXsMtZFd8NfW6/yCh52DX1o9q/P6f6CP0Feo19cUIxinXUtsob9R72l4b3vNE4CuwwniomW9b/Xab9oHUY1uq/em0ztO1DlXF6o/NzzHGU0cYP0h/dcTLbhjWcjzF1hQLsJkQVpEths4Rv8WeP209dldlMYmyTfepboTS+5YN+4Y9D2sxBgHsS+RrAPNWiyZYpmYxlPDDKglfp4BP3XMciW3gju1L501yl8s3clI/ihUA8UMWLlr1bn2J8vpOt3ynAVOw8MGPp+uOYbVFdQBrC4d6/3q4iCwLkBOXFUMxZZVZT65k4muDNPRcDFZ2WKiZFajC5iTIYqiVKoarOy8Qsij8crJZElNAK8G7n/WI+TRUlt8KQB+jn9N8gz434U7AoEIuUG4VjV8I1ZwTbYR1VW2yulyYdPD0J7ZF+7EXSAPCYvexzZ06MDcqQWOPR9eleb6/epj8KQB//N8sxJ2sILV2uVkP1N9NK8AlgECsjt2h9yti9uZHQTRuJP9QQ6q9unf+ael75O9Oi7QK4XPOtcudAIErukSegoygrG4ckCcG6IsBxNpL0GknAMSjd/95dyzJ3E2vPRmc/fanTiXJBXJntSC2QQb+ugZoexS/wiCh7FTPts+j48YFowD0vMiIMqqmWUkhRhg6EeJT08gW1OpG+iSky65eujdXnjI4yEzvoeOC8K5QkaiS9g0NVylFiN0xNEAIEcunVIACXfq8cCeADqckeWBaIMfSyCB11qfZ3jChvIVlMhrr31/0pnxc9Mb8UNnzn8P/OnMnjsVzZqIWkGgfwgAC6DiCzhW8U+UovnpyLdHEqQHzMtblBOrFg7OiNGSKVEEEyaJBbCdxO7FBJhHetbHNO13AOw+nPOdc5UkoqOhhiLwvylKgwBZXQhckQ/lH71S6R91Lnv274/e+ZOPXvlpGaBxn4BCPsZXlrK6CPiakgngYmlPjDkcP51otus8ylRDTji/MAYTaPp33/VKE9gtawFMzqxUJnTjC8Q3dShEEb4NSuUkzMXcgTMsTR+QQ+CUokZQbp/AOalk/vADzphheyODDjXi9Zcv9BqaBK5tTFHKNp1rWsvxRkjcg8/YK2zpxp58KmHLZR2+AJ94hithjbIU/WIEX88gWg2mgSCWMzwKwnpnNEcDzMKz6IQLU4T0POSuRHRfJkzgu5o7kh0sidMOogRFy8Asf1U3+XS/fgfDdar00oZ3NZIrAtRslEzrKztny0ayehhxrjP4fg4UBufFGXBTmvaKMTZ/ErRP9aPyPyP+BBEpMEfOmJselej42UhovSrMThu4d2WwNDwBN4offzOgMKdumOIgiytY/QloubyEfdm7tBJfgOaWE+i32APTE8DkA5gKFRSlSM3UoEeEEj9KJztC/+bydLnsE/1MvigAgyci6i3PQPSb9RQNel0uAC/5n5hbBSJNIf5TQZFirnwhBUSDJ6dcLmvIEbUwuIvKZVoXCA+Xa11BvNyolBbE/PGfcvk+KRI4C5BjjMVyNsF++pMSEnEpsQ4q0L5loUC8gKVrWdDo3f19RfavXM7DUoGtNC492IGjP8cSzSjSGGIamAXAuoPOlAbzJSxR/LesO4Y4sFHg+UIoa6XyFgaJAEycHxjXA/S7UdtvUNGpa/zKBRAgTQPjGC8nk1B6xIaJ0KDlZ9s/7iIoApIDa+nNnQnehjDviMF4vrf/sggMz/eqjE2mPQIiHgEHPki98yLjUuDg6mMw9PQwKNFyVgAm1/hasIdXtodCs0Ir2qlOMlXboyaqwZVtFsEoUDWcrqDfnnODMkvhhlRS+uit1xYt8Qe1ZBRqCCSOsfs5A3vAMWClGoV3pkIN4uIQNxLGNV9OIWC8IqDGiXlT6+rdRQE6mC2DK7zWQ7EnZDwJiMFVoU7iNQPhJGRldybzVwSDX5dzp0ifgk8ucaIMSOJzPqSUepIOOK43Wy6CCgqNwL+I2TFfTe7eQpppSCnlyROuqjksiKJ/a4RQC54aREXlmM3S2Nz5ncEYd9jre/jLRe+xkTvZSlxKg9Oth0C7zX4fKkwcr0QDK9+LDlbDvSvdIpV8ZSjcWDBiIXNKNuR8doZLAiH7WIt1QnMg2/y3etNjXzrW1FnYQL62FQzhkLNofNz8+P1H6OyCr6Os9jHq449bg+Zhc9CEE1qp9uQfZQVMqsxHbzOp3jC+4J++RmuiPdelNQCJIx0rPWXXAdB8CqvwP8Br1Sai14AEeaFVG9GVX0me32J9Ioy4qBQxgaPuPt+vk+LCNo0nxv5e7FLp2pVHxQv8urcdu+9DPQR+a528t943j04BO6f9gYX6+9ctq3v6+qjdf9c6VC/7gIWBkOOQFNUewcqSvQEZpI+KwLqxs/sMfvRASh3YlyhTnZnOZxvv4LbsmVsXEMzzDHGQah66l8CLUpX/qY53yOPNhHPAdg64+ne3d/er2zvw/4Pt7Tr9/29mZj3fG7uXKJaZR/aFMwno0Z9f1vwZXuEJ5XRQo6HXJJLNeohvYDJmy7vG3jOSz2P3uiExZ0tnE2wYGSO1IYQy5luyEQ0PlPQnRoAcMBzMie85IQyQez55sDx1elhnOlvcakGQmLoagIf7jsBcvH6ET+rNGt1ZAQ56VggYLDTg61PA6wqAZ+fFALoebazhpGT3sBABMbUUHAzKrmMHzXNUOlEXHmK5klxQMULIIaabuQ+kxDzMJfuDBYsNtOxjnGfEK/FebKoVaiMHW3RjgKAEx8C+FK68wLElBgpS76JqVycuyy/FAI0ESiQshefsnOdA0UsJLBuDmCCOVJG8YIVsGBVysbWf3FJm9u3Et8kI4O7JE8EpK8aTJwL6/XnqyIkCDpSPrCRq86VXOjOFwQaeDatD+DfaZiohzz4Xwk0DzTRqo+V0FpREFwof1nHHajAxBYsRSAYNpSvddrdF7535PPleIxWJA3aND9JD1BY2GsZ2GUUYgVbUNIqNi26NqTw3DJQY/YYGC0pUGbu0HRNZpFilU/yKnumaI4UryTZKP2O6WL1WDyUxKkBD3zVId7pgcGfb5zXHGwkt3hdcgClKW0ezlxg/rOuZs3rcinDEvUIds6JdZGHrsP22BQJFr3XQ6R02sKuh8AJs44u5fj950YbKx0Jz5EzoMk6ZgoKkMUP7QBDkom2DO4Gqi/koumjTtoysQa5nVNecwWo7C5e0eDhPX6n9r1rR+gWN9BxfuhmruugqNu3phXu59JdBUui+sQMQx4fODCXB9NlHHH129sJrmKWHFoRJMGK64LwzcS7toRRIjNOTX046v55UFBJh4ghCsqTjEIsENRAKDX/qLtY9BIUygwWNOF7gDoOsk9BB52TQbJ+0etabTq910m8f9PXHIU3Bb3kmiow6QqQiprwhnP/nyYVDQ7QCOE8OnYKnomAIwhUdSyzSlpNiNVSRWvLUocrheDItyTuJRKuwyOTtRNTzqMN8RQH18daLmi6nrROFRldr6ej6OmvG6WwM0JPWjMIaURZDo8SY3SIw3LBubeBgKXt+e+hCd/GWoFRGk0eBAGskX6emzveR7ZDJY6qwTpnOQiypO6DmlmK3E5iZxWvTTwA0te8N+TibPsLSxyt3MqLro7DRLayhK5YFn9YfwiBY3Flckde7NWSVZqYgBvLuIVDSkE64bZKylUNvNktVTwHxsyDAiY4F+TwZejmtsf4PjS1nfoD8YX7tDrEXJpyITTojLObLgI+68gSR17NjH2p0feB/1AWugv0c3M4ILttTIeg+LQb1ZKJFbI1MGNjKVbPzpDYGD/WEQFa4zeHiOTNDuTj8ZiZl3QuQmOleuxEBKAWLeQnpL9WGHQCiFmGlMxOkk8UyMM/JAvagc9w9ag1afKEdFaKTAZfZWQWQiQDOYALoWYmIRNJG+XwVAEazNcXpEDB2Ev0Rkx1vgeY9C7zYRsWNtDIZEmgSUd+ho8rEQOaxFa53MiYP2IwFr8qhGw7toyCB4/4YoJwxnCzRnNmgKxTcNHkkteRsM9vyg6RYJuyDLHJ9QQMWnMiKsswrvFwrgsp0JgUxIDjiOFSd9OAHtSV2txQrCvJU0CjtVOIAUKZdlMrwx5piHcsLsihNR5NZVKeHYE8mpazWbdE6E0mBkaeQhTvJ0kPZA+ZUzMkUWEuiHO0m+L42w1225l+gGFPyYTLMjnXSIftmUxyLdegtjo7Tk+b7Zvuo+foohZG8XqASBToQwGgtZzyG941u6MjUms/9Od6CLQzyblqQ3PeYHdUQoXI+EII+a17E3sG6V9KPmHcXsKvQjqPtU5qdKrBj1h7he5TG52U45IDgpSz38Lv2QnmMNtDFGKmCKqqVwE232Ru0m0fMSEUBhYtuZ0PDORIVYqxUASRlaD1HFshaesDWPqW2fDiMXpJ6W4onyMyqqChC3mZqS6+5j4kOBLdT7IG18EsMZi0O8TVjzN197548ER0HupvZI+TVSI2fkRrFtnvc/Fd4I2K9/jBo9c3z+/Kf1v+vB1xg6FJo451RJxhlaGxzha9QIEphS6hs1xJTRJ28tRUWEQ8WLZqY3IArKiymrqlVjWqlDDYLKPOCzBQrBJDCM0srkc+E5jo7Akv3cEaDs10IyF8ucBtIm55RYWVdJitUxIK33CA65JDS4zFJlHqRu3QV9iS7tvpw8iCZO40ziUzqZrK44A9DfzKBEVrSxgat+Cb29GJk141SbLqERJAAA43NlsiEXb+GJvDeZbuTQgVt9tFhGfrFU2KxcqjEQLT7pTw9oE3E+cpVFidiBlsDKoD9aumU2FgydfTNLK5vw3zfOTo9blnEUdsng9ZbNK8nn6jmAPgrulGtA+518+CX064lHa2a3e5R+6D5un30IKgK2w/1P32a1e0HS7VH7eP2wGr966DVOsTL4g31bNH67MyHrrD9FwoVcsACgQbdTOmg4cyZBuZ4EOETutArOrHThPQIvQ021hNs/bl76QL9WjMUHuPK1S6+2oifh9CkgbtMXRJ9tMcLNKuCt4xmECRG7EEsqUbtLA/W0uulxHr6GrWUtLbgzsUUUmrTKgXIVsV4GrGCmsWe1Gaj+749VW62mA5I6tXYO6GCddNBgRxVumglouoB67Cw2OjKmDhjOB96xsjBbWgTje2js5LmBi+lZfyRqqjsSHfvF1LPK/xH3sYQGy1tft4Eqai0B//sbO+Gf54aO2WCnSDyGPgUZyISnhOhnSX3XrRiljyGqLEEG9E13vF9uoGnIO+ogiVph5b0M1xM6DqgivTfELKKlFHoA13ONPa2t80i6n+o4PnVGQgOc67OhN4Y2ouUEKFq5uLrq3SG6GW7H/ti4sgLC0E/58pgs2AC8mr2DGCN9NuTYm5L34sdH6NVD13qas6RsYnRbzhE8aiRWLKHaHxNZbFxsVAajdTawT0HD/4sLMxgCcJG5Aa06+COSiuP8ex6IXI0Vy1JwDGFQw5R8UjOzOg+QO41rZNOv3ugl23wuLkSKI4Dx5B17aLlZMYVoGTiIAa8/zhzHwbmLghNaC6MpgOC/eIFhT2DRtCX6ibCDYvCDhTG3cv/BKBsY2Q7U8WFr5ZwsppAv92xS55mghvKiZXf2MkOpIykD3QmhyN/MiFzPDXMTIb3MSXhPTWkYeTCN0gRrbBNab8QFxITjWlhUpiLYDk1QADnG6dUJZWw5FwqyMF9TJBF3dghNp2iml6v04Ovuyln8UwKY1DhOVRCYPi93mmX/PPbJ4foYc6f7jeKaz6jAWhGh2uPZCW+mcTVxj8BxipK4BbLNaqQcKzSETqGi3CDT9ENmLSr2QKuSxq+LXFm2UI63xLnpK2JO3UXW+iLiFeP8i6S6FyunXjfXiGpYQtV6IRzSU6WUMKdJug+1sk5rJCFoxp6urSwnDlFFcFtH8ZB9sfAy13Pc0bVfv8ddUOQJy5aGQdp5EychbNF7uF8v0vbkiG8m7fQD0DxpI3fh3Y/bCRinLxHT9dbqYxm6wxuGY0DyR4VlhYOVOLnT41+su5dnz4wih9802ApqevFFWFUdBeP6wneSkyVx42lohJL5uXhgyxcV1zFqwRooU3/xL28WmTdxqtxQPDHm6P223cD/YW8vuyfYKccW1PhkBLWEsqo17qXX2XZIFYtoNJH4sw0a2h2mwfop97tdd60QcDX2zQkSv0JyAvZjhhADG3h6NZE2fwTHc82oWfy1EjynGUh98Uj5GZ6J9PMUY3ksBIDLCflOP2k6sBId18GVEmNi2QHkB7gQbQVb4YpKnUKjjW18iis6ZhyHNYTcexYHL4t/5etJ4RHT6T74xdmnpGFqJNvZrG+oQT6/4OkrlV9rms0QREplNL4W9TQFQ8PjWE7MVuLSCev09hLpb7Exnw+37rBtbTwb0BIRp++gBwjE7YXOlhFVf5m1MCq07QOEDAIPIXm3kQUA1FDloYufDCDjwGOJ8DCFRDk2HqEEyYmGs2mSZbr+hN3eEsIRGdZMk2Z3Ni3aFttHtuf3ely2nMW89sDZEfweXs9O5IEpaTUu9ifVVWxTKqikEWZ6zFvOJPhd1RLFFJ+MvKydMuiVq6dCZr1huWEnaB5Xs6xNkmXPtsmyNpFMfcnKToFLitnR5mUOc4GToR2QSj169IRQdCMRZ4pgUXsluaSvmt7w6aUoe+WWGDSktEdhUt9BCcbait0d8giZsIujnHkAt2iBPrJuQ1KJbO39Dy8UkLFjr0MHHSvlOQp3nc6x7+46FSDPw7xDricaRNrTm0PdpUJ7HDsrhx5U6BiwSK4sbcgG1ho4CpfZQHuc83mIjZcw3zjei4cVBIfUutk1VlXEEzqHuaCTHhGCq998iSxrBAr4USgrmVi344D7VSY7+zgteN4xwJL/RBJglrEdzHY1w6qsfNopS+m9S6cyLr0v5DzGb1QplW+zMJ2NOdh12jmI2Ao1B3wvO1kxo1ITBu5k+1sozvZzi67k9V2dp/tPd//8cXL31KzKfnpWiwvPmFpziXslNfiXHE2cpZeoRkXxaLcmVyozNsiEiHmFhZKLZ1zVCQg9ldA57UN/YpmLawabyJabaycpNC+eaCj6eO+r5jBFdCU2WVwcrnmX5WL+uXH3PpQXyUVgngNg36C0S6s8Bf9NrzqUqDohs4eXIWBwVlfunZnAKzu3Gv17zlbfVocEYi5L+uvD4R9/tds/rGtmuHl2XBEZfItBx4s0FDFDIsD+qbYROiNKqPD5DpcZeVg8vr0kIGuMv9J721xU7zytx/3V61rUg+rpz42Fg7QPEQwGHhpEdfWVC1wukPOERk5UEAZNBHGBXk58S8ooIo5u7RuMA6TbimWqI9bEZByhvG9LGh232Kg2D7GxC2reDF39jUx1cJqojv4CP0hlw5/EkK4uIWjXunC9Gf2H0unGn7OggZS7GJqBws4B81ABo11RCj0E1Vhk/OXiUOCsN1e74zAgBIMoj/onR4MTnvNI447nF8Ve48x9C1+IU227mDX/Z2juezs08S5IzrPJQT1+3WtxrmZtWdUj8j0GluBxlVL7GspS5J3bT7NJdywnMI+5TexaNa0J/sGOAg7mcFr0wX1y/XCHn5azlTHHvHG1BfMAIP0AzAktC2jFF001vhtamKEd2d+rRq7npu6BvU8Ibe11WRLgIdXU39U2vb3t7cz4OSUkObWyqxzn1KzLgaexUF0FtjhvSmxD9V8mpYwlxJv5A1wkOvjIgovvcAeAweJsoQIm+58MZdq5+Nwb2/1sliFoOz+7aw5f4XbXmm/2nzdb50MkusEV6OymkAktQNdmaTB6tcwlYwRUFeUFb2OBa4g8wzuIr6qDBLQ/hjT/Kj9W73YVy7m74zmZCI0KjZH5o1cpPCA90qwL4PYUMXotg/DS3IQTcI8O2gVdGtgGA97VEs5ILJP1BkTAm8GOb5RFRKlK5JxVojoK2I0mQeztHhZYfGRBUf+wf8mdtlskPFtMSHDRS/EJrQSjl74U+DExblzjZQrHaRWe4TFHMHW9P9a6+SwjlvYOqLCAyTLh6/F+MaT7dO20pUtNkHlb+SQ9vD5yeE5jzFNa4N/PJZJ9tlDjOaGVs2hKY2MhcAGQXwjrzp8OhS3E+/Y5hgBdI6hEjC/Uk1j6ypNjOFzCW9+tVOUEe7bjJsA4fUy5VtiUzVt9G+ltD7+t2I5mryLp17Em5aGQlFzKWkZTvFz14mJy27qrjOMhR+Vkq/MDIAZYrWslvEZ001JW5i97ZT1P84kBZLXKeEvXdJuf/e3LejDFppLffTcsXF2Zmx+v7OJtDR3rqsUItw4P3+FNOMZzvDKZzNCaBkm5pUxdj/qL3DMILhKNYAmHj9DAwfNLrCq1uZHj4zSxsZmRmKejx+9bq/zumVJttnYgVebWW2Kq/V0szAIGhZFCs1S+7ve2C8bEglPCAlP2MCtB/N46M6fRKiQHf97gB2C8m/a/8IxWSL/Tq/TGWy+MjIbIxdOCUTUQYsg+CO2XWmgDPDld5GK6LDXhjLK902ciFevcsY2C74wo/oiMqJ8IZexslHPrfaknB4oIOZnnMQ3nd7r9uFh68Q6aB4d9TcRkBPYw8zJWaYmRsIGcXc5D9xrp4qR4qkdbRNZoMeuN5p6aYIma+LtrFqT4GLyae06/njNKor5fuGK97qA+hR6TBjhkMEqLfAayLjToKRntcheMPBCyLi2CExm0ZjITC2Vs8tKsfnHtNjseNeo0HRp767BL3eOSSrUhIwN3MYkgytXjEGz97Y1sPrvmg3gLjnXC5Q4rNvpDRrm7i5wavqNScQapvTMEXcB8BETjJ32aW0d9FpRkTybjrftwbvT11bndNA9HTTUsyDbMwpHCbQyEowsVmhoz7CFUQ0YYF4cJg3DaCiSQ8VIUH+skTAcVXUIUleQ21C3OXhHlSUVlMlCHfl4NDlnJhYzU1teKjIVUm4Ylkrd8M3uHCOFO5HLl9ZKS4ZbMcvnK+6QoGcN+B8efpzhp0eJUvUVo0na/v3fMo4DdvRSMkZKKU65ZQ0ljf/KaITs2TD0ayjDElixacbzZyqSkLSSvpo4n1PsCe+Tyf8DvwoxkLsRi9gHIiX+T8qJDSkYZkd72d+rXezvjRxsoCTaqciI3A4rdFCwCFkfnWuVlVINV0ptdisHzzrO4lTgmWFwOB5VRY30Fs1c+c8/QcuDx0gX9i5GxtxzGIiO5Iqnl3hwiLuKzC/b2M1SI6JCNJsn12B/DxYwb2SEJUScrZZ3iYGNyLnpj6XD8XdgZOQHu+BrarFEH++cLYy66MQnlhu0duEYMsx/1DaBymjZTErj5IgcTqlws8yo++CcmgXakExZd28nOXehazsBaLXaPSwotWl5SvawMJtdUtFncTBCmRroQ6kk4UgLeokWEUol/B6iy1qre0CJaLxbOILR12l7vjOa7HPd5YvO/v9zRAkGR8pddSyf3NKT5MqawhS83W38rwoH/Pnt1s52NcAgfiPjYjm6dNCH0MYwFwDK9gje7vbeiyppGaTrNW7ztZRSCkNZxpWd+IDvTU3ZjNM6fmKzW52rMNv2jJzPFBQTB1na2375o1asJ6Q2uF/qpRlSN8HQmq7QXMWvzIQwXCXLAl2dqM/SQxehlFf3feeFtufAiueZpg6lsD9mfDCZ1g8hyAImEKGiHbjyAkdS4ppS+02/UoiL10B0VIwnEVbK/4UN9OtZXeg9THSAchcaK1+I+3PAPf9MGlmID0xuNZZtSvkpjIQzKlKy8USAjRNd+dswugzu/LI4e97b2d6ON4U5p2BnZ6xxoTgmH2tHWYcLZ97MCmgrAp1oKnwrbv+/RPDjs1V4GmwwCvEkGJQ8PKNwfsbEgSGWqDEpy6wKEp77H0YQ54yQUUBuEZYm6SHXMMtZ6y01rHAJwaTcXPmTSGwU0VJHIhUiUJ+tjCk6JwM7RR9+e/LN5If1hPCVN2IYKKd1Mui1W31eeyge6GuVlGohlrHuB4uCh+DxS1ek3zronBz2M/OhaCsdtrqDdxIuHx5ZzgHagv/t7626RSM9XAiZslbo+lw3XtxnyBscGv2rhWuK1MjAsjm7/B7jgmo/MyZS1tPEK+r0rFMAcMqhk2KtoKjoSnaenO2huKoCmWleKiG+d8orkF0ykYZrUx/G6nvuMBF0RMbTIk5B4BnoXxTtdBZ7FKynbgudmSJT409dkTBcrFZeXnroLBIJnfvPtXhEQBkyebwdKePim6yS2Gn8s4VpJCkO88ZfbtZUhpEjn87xahcQWIowkHncyDCaxNObFQyhKy66uIJgK34kEzGLUCyWS2mB+eyiMH54ravhqBHoxHHHnNtDZ1Rl9+uM8wwWSccJxKgZxgEfIA+zfHvlVbYFfXIXlgXi7mRcMcajzPQVWKA2RqlmPMorgkE0yA9YwVlpPCpndgBYkzMXPchvnUDXohpZQoS4C8c62cMu0Oit60xGHBMian8jUz4BshjTXAtUySlHYo1TRj1H+mGKKOXg67MyYU8y42slEBEhj6s/0cWqyrNLEVMJjD5JW39Vrn7Y7rUOBh3YUA/eNU/eprnzVzJ3/VLNsNVLsQaySctlDf41HSIU4zUy1MTXVa2TBCaT5qgGpEawUFjU35gSTBErkwCWswrpN5SQbaXa+/83RTFetXsIoVniHMuleoc2tIqwgGRUXfhVipG0cLRTTnUewYL/0XAbraWYnjeK5ZuD+BUQYzNxetI/7eLteOswPMxocZOxHL8zmvHAnSKDrQzYRvrYBVphe4D7LYzKFsZqG1Hop4VNyQzD0H4Z13K3gUY0EY3F86+WdP5IGWEHZSRK/9NmGQ9hOaElc8Hook6erwo7WaRjnzef7ODZjcHlRZpcCVEGdCIrZDp1BBOQ5Eq7DBtl987pICMgPhnuV5TcJ6rNIU+9JZMXn5fCeQGab2CwzEqmOIIK96CxXdtV4xSGhwnsEIev310Ve17Vr+WYSsoBNIwL0/+EcWmg3RCAEpSBLa5kkq5UsELq/cJmPxZzYez8+GLvxd6Pz3d+ZF/htJXUxEff+pJ5BABjsQCDukHamNpH701GZL9YML6M3KQ5MQR1TY5gPDVU4IaqWc02SP1azuTUFolHihmMoZSIRWFeLAMyZcqXrCK8VxirjxroNHC9odP4ZzRFwp87O5QEAlu4k7DOC6VOFDr1KcVOXTsyqmbMQBtrK2WSy66enC29dubG9UYUdE1ZwbIif4MFnLEr8ffcOCayCPzBgIP+HAMKmHnhQhOw4xXjkSOVPTBTkc1wyo+ATip+DP+UVJXMWQbNlFI0XK7EX8IkJ19pOMePuCbPy/cF7dXTU8eROMUU1WmLH+AGZB02W8edE/P+EVDDp2w4NREzqCcHdYF2To85gmgXvf8LTuyFaSZfcbmvmcbEKjvpiFSZffPbz9/OR28XybBo79G/yArdj8P47Lq5VNoxhyKgw+43J8nkJeQ3GFgekWbfGmRbbnwDj5ScbmjuLornZ8ifqaRHSjhVrI+ts/SVtVk9OP1DYsBKGoj8k9efkggCOHJvcNq1mqeDd51e+zcyXCLLpre95sm6eSDkJvm+1Wu/wTjIEli31XvT6R2vCa71r0Grd9I8skR+CWmGHbe8WglSF+U4w8Y3Fqw3cXHIHu4GO/SG4ZHROGco4hwTLwheGTsvq3zU3kIDAtIjRbeKoR9mwBZrIuYKJmlAH01SDXB054CoDqM6UFhkzmLHWR84Wyzm2CoYklieipXAycESOBZQzGx5MREhmf/UaMT/C6IL/ymRgws5qP2JzmmP5Zj2ndFbemrKFUmQOErDvsRQ3Qv6PuXYS1GyPDSyAqSipTUcw+b2bSwDy38jWqrGdw7VXGNc1ewXXIQOzHw/ujwzMZnRmeKsyBiLUmCIR1hcehNYHVUZ+WxVpMXwLBqLuChD0+WGXLwn5ZgV3XTi7p5KCiqixBjrhIgpBDjm/p7hTyg3wG7nqH3wQQl/Xc+UFmV8urpEOr0T4U+yApZJ25aj5ofO6SCznaQ7NAaeFDTnUtxTHGimtkDtRcVIx+GpS1xTQt5gOUOmBsKrP7c8jBQuySVzEEedg2g7lqZgiSHELcQqhilDtlLXDZPN0OrGS/lf5nA4NEidstxUDCUuSPiK07/xaDWRNnIoWhYPV3SioqRvz7lxpFUj5XRY5fI2t3E7QPZa+913vdIn5xbZbQN5r6IdoB2+TGQMJSpRPgeVaKWPXFaoJgzVat9EpwnjZ2PnBWppkxdbqtMGizVCN1RbfF7EoxEBwHJedb6BqAZXdrqudOn9Cref10sMzJwtrqCjjzG8GTUo5sRql581fPnKK8A9phsU73QJdxqgvqVTZaZSm45yPYgUEhDQFDL4ydjfFlagSgH5PkPa3hTcbLOOC5WkatlPBGRuJtiJRafmdOkM8BkbhTywxJpKMa5EqQzjtlVUrmCTHMXtm6xTAhnYkzW+kC84DIor5BWxsxs3VyTaRyIMzWA4FugD5RtBWp7TjBDvKyiyi/2ZNhmKZQCg8FZBSeX2DdOHWO2TfhfOV+jbjrn7+hoJ3g4WuiQjs9v1Uo9cQaf/d+UkWdzO4PQmCvVdPE9iVFG+EwHZ8yQrQ0kNNRjKAIZXG/rjhhhc7bGPHRsbyXuXP+fE8U3OGhtrHwoW8n1qtBiKIYH2sHBBL/Le6QnmlRq0jruNzLrSY56DXUpn3ixeQAkPMfGSe+0E+fH+i8BSZY+vh6YoFowANs+prY/RmS8dRBSYYVhvCKdbS9x26U5HYeKQEk3kFsZop35XZb+rYb8V91XtzuuFKzmZKiRi0NpEIezCoiQLSeUHwY1sejEh8wHRm1hykLDpZJ9a0Jfw45nZDjtCqebN8w2tZREfFkpocK6dmIXezJBkIbSCL2vdmlAzZZRAFur0qfWK8R5lW/E8ANZIjyts3HTXlWTb0KTNXg6tJOR4uSMaN7CKWTsGx6ByctxRsqVur/2+OWglEy41u91Ws2embD/Q7xxqcVRHCkGgSeVE61f0gxKF4EGM6sIc9t3/0AFi9xnGhKKT0sT1lp9xfpvz4ZWLbqzLOcexno729/IWoJoMXCQPIcnl107vsBFd0VcoHNpx8386vQacp8+LOaGouUb8+WUN80xGF/Y1GhCsj2sXz0phvOK97cq6LiDcyexcHp4/n9oTMtCJkTdnDY8Cwkv1TIWRnWklJqFFEWqPSdvAt7n7+de5UfW06kUspNBIvkhXY7Q0ZFrKNHDLAXj35EkEU5sjXneQLzKv4bRIvOIVkPh6nmGJotppl8ytCPwWwMLI+dDJLU4Kv/V5izLu0Btv7P/js0K5Wu6Qh2h75gIyyMszteqlVr1hSO4v3pj6gkLdNoXTVEMbJkYERyTbBQaNvgAacz5RMGHuHaZWlLtEBvzceK4Ox9Hx5/G1gZMaKTXERZPoZYq8LijnhUjGhA2mXZo2Cm0JaTql/XPuXC4nNiywUtTdisBUWRjmaNCRl7I1q58EioajM0VTpgmtB+NBkgXQ8poUlzdCbuQxIRLOKsbuowKt1bb03qzC23f6aeyOfRV7eHA0H7MLDFAPUWQsZgcNfNJmYmbH+oZxRiq7lKgTijv2ELNRIZjSeFShOBY5MkiwnCyk00O8Tra/gKglLWNF14DO89wDolLQnCYByWp2IlEgQ7aaK9wouJsbWbfcMbtulbMEZJ6JyDArKjpzsPgVtJ52UcdUBJPbDMf04cQPHAVMSocpWT9emuIlajXNCASdF7eyzhuglhFndCK9ZdE170jZsfhFVZ+Ej0yQMUsVSwecZkXpS+tfXQ5S0mu96ZtacpRp+UTD8RR+2gx9Ya2CQQxKWRn6ypm5UpRMezKXnhxhpl6/mGR8fo85XVCB2fVdj65G7u7TCTdkhqP4HqtIXzipjLI8Jb0Ew1nU9Dk4LBEdI2sCsqcT0yQB91iZ+lCm8+D9XjaZc9JVSylTJOGEGTfzu7ZznhB2xxnCbt5qykB5Xo8zHAXUIquFgAf1KeWawJcaOy+N4NZbXDl4nSHiO3DOeAyrJG60Y1Fl8FAynCwpcHRWek7JIPScgbqLm6Nw/ggjlPDVk6tEPnlZPs/RRREgfYYVXUwUqhaGPykXYBGzy6z4KtS0oHBtOJUS1NXn15BbpD7DBlcTwbszE8PESq3I7/IZSfvFzsvdjOAnFRimxdFT8P4KQ6CTZTxsOf4nh26pFQIT/joyae85L7SKsUY0qPBK9zyMA/I6CgMCPX2eFxTq5dfE7tD2IUz1HlqTDqzmAC8Y0r5X38EBE8/cRvctrAO+CqqzecUMFgWag5APFa0ATukLyPHQO9iwRyMXlUSUdZ4WUFDTULcvMpKZO3gM3dl/9mLPzPSvkzrgSzWakq/dF2XxoltjCP7hZByGd+JR0HYwcaFZi7xviqS+IZGFD1FWFK0HhCv8oFMhSg5oYXxGC0uVONorOaOu8M9QzoySlErxLlfia01IhoQneQJHdR+2m/ZnVwRezbgy+rmxsb5AjNChq2lcaEfNaqT113n6biSm1lq50ne3d2JxkMrFoU3XVZKVC/Bn4TeZ/FIL7GtS3Bbfhotgb2WPZLtZ/Vq5ecTq8ds/dyzxNnX9Mdfc2nQg4oX+GyPM6EKB3q7mnOYq/vtcw3+/0WjX6FWRXUGElq76lE4uV9TR1nlIH741ZnL7l5VgLBcvek9vsjLLl053cqRTrv6QOQxrrpJRkwVXiKlZC+LRJ2xlv7JmKT3yjOx3euTmT35edkU0ZASxB2RDe4i36qFAGQR4fPqTSDzVw/wB/UVY1gN5FN/gxlVxuD7/pF6HzWfgmDaYuMAWc1rKMg9I+zbtfOMB5TRNg1hHuCV7VxRvsyKCnVEYt23x7/naF3YPGiBFrqIzmOYwZ62MqBXWFw8ZEbyiohn89rHHVaz3ImSM7L0IIZPddz3HjOORQWh9CdiEgRISj1hjl1TDZl/4a7Wwb9EqvLE1usCDnU4nW8iAQLVOGPrTmvCzF+alob+96v1wn5P1O6kENrF/+BcNVRCK0JuhBQeZ65B7Oxzp0YXaPAREYkARYQiBde+Lm0GYW2jcitGY1QYvXG8Ua87cUiw61rWxEC0lOyobhnZ6v0qnipQBxoVICaqQN/bO9S7R8/SM6eQ81GWFeLkj8qgrJhf3GefNC87iiTroX3HDeA3ggw537sCf3eZ66ovKw+UcqfiAKaBrZ6mX8o+uF7qMoBdzVMuRwnx2W0NegQ8lHri+8JmkfYw2AKR/TtpXSfw3c9+7NM/X4CcqwrmFgggvP7CRrFl9EOXJjt09eRL1TXFNORbuPjvPNbcvD8K+up5hCnBJwh+xmHAy1OX058xDOlQR2ntdO8Y1WnpLE8llgNcByhUB58WkvF3AqINgdjUnTSdGMmKh9MIRyq+kbtPmBtQLRPHKzCi52ubFnfEp6MKMuuh4w/ktmtqxZbuZLZAcdLofMEkSTYGw+BZJkksMuly7cj7zmDUb7tBxZwvaktiU9D2GbmJmNhsC95+MqqpPb+2aNLp8kdu/ss16qjPHzfZJrkmcOV96ZMKXrNk7PSHRCCeFnK1WBHhWnKNaJwe9D128IDvoHB3G0kUIr2lgVOjrRCjBE8lr4S6FqjuBqLymoop9zkBd188CWpWKELJ1Y28Xr+hoicjm8Gogrx15Aoal+zKsfCrzHEicEA5RlEx9yUc7Vumxr/NIccaS6t92eItQT/D4XLgM8L2y6GT9yD8dFbrj8TtgTz1hGSzLtCh6Sbv/Dkpl5zkjQybYWc5Ksew4NaDE2uXsEuDLSTRKZrSqNaEhCjDckikWRk1Y0in7mfgSRVUqa+/9SyGrYFVG/OCmC2unr5VjqkY2NMin8i8TLpf2HCNpfMU1wt8aRhynkuup/LPQlUHY58e/KFDHqR0RbHIubpKi7xZfEcbFMMnN+epZzgYQlX/jOXNr6Y4agGrgffCU6T/IDZ2lmA3JTgq/yRecGErqcK1QiH4lpJVS8/lytlhLWbEmGr62kwIfuVAi8ivn5ZL/00al7Q8u0tw0u8IhwQdIwDXnLKEQkV/Z8yn6jwMVVKfOFGOONLvtrdCIE/6d6a5b/6wb8LkzTgBJ2KRkO85rxUzlcA6QtelvFs4UuHnMAKuMFf7jzkqhizjW1sepg+pneNDG1Gf8TIdsFJRiMDPrRgcOcTY+J0Ep/3R8evLLSefXdBQuHdjwHJOBPDTzyT32oBBeqOoaA4iO97rdZGx/cix75rJJeEZ8QDa5aggD9FWxAe/MWFLduGSlZMPk+J2R8RZ6069qXzGUR9b6D3syaSxATlrVp7PzVZBDQW3V4N6HEt3ZnYnuijhADrTghRZA59qRSKtDdpA7w60jtPI3y/Uqv2Bjv5xAhDFXhsh5BiDfb2hkCqSRT86tOg3w81z61LNBgeSlqMmU9loVI8lYUFKYuVxoatnXtjsJLRDYNY29nQOzfJ91xqktZ5gqUXLfMGVCSb+flyOTgbCoZBarJL9470V1w6sbpZDLhkdSLZddLVwCOhpyDWFPFayE3cUgDE+ePFsJK47CsPqdqQacwEOPPRrdUpCFNFMX9tiqJww7ucGmYDrCAckwKXKhmaMYlxktoRoDxYNQonrF2C6vafnEsHR6XT77ETHuVIzd58/X15QX6jK3s5bWRwd4rMFFypjNd2HkpF1Ibpk6LMjiimBzpsoldD+xrjpG6buEnzGTj9b7SAN0Zop9KGATVw64883HoZPY5kNXJBkklhgT2LbIKH5kyMl1veFkSfF3l14Y4RjDAMRCCUjg9sJwyKNX8QpmlSsGm4C20cmSfHspJl8QV0zBhh1l561pN2hqVx/Onl09hQNpaLGkgUJ+wJaEhQddfdRoDmes4x/orcsIKsJJFF4gYep0Ukoz/YN3reNmXF/E+oyNldoiJQbDm2b7iNUTWeqRHHAY0bO5XFz5c1RJKgoVB/F74NMNBCJPt7vriZVHryXVnRykZTJQhld+OGvM6dB2+dvARWZezhZnuOZGpqoIJuaS/fxjYkqzd/Cu/b7FkVxVmSWMt1RIF1/SyDgcg6rPoBOepChyHTff0tdC4EN2CDVft08O2ydv+7LTCRlKpu0qCjohc1Uof+9Bq9/H3uljCOD9tjVeehwfRV3o+HSeS9dUIkzZw7qeesSgtH4vKtvhiXxqmFYszH6hNuMd15keoASWUP6gr2uG422crPhcU0G989v2iaCp8EigUoT+vjzRZoSjufPHki6RFTyxC5x4T5n48BBC4evDgZTCAo+FVk0fw9a06Aw1FRk+Pck0H9Kul/Ly4al2OyOcgmAaFP4hb3OLQ0THhqfpK06Fj8S7zXhOw6CA5ITsiHCzURUNl5wc013fyJsZs9d63zxqH/K9RcHZiTUZH9Nqr/dCe/WZ3GHJO518KVNSzRv3M4XXuLbnru0tQvFHBGsysB28HnhFqZXdS09EtMCQKFu4RYpQUJcOHNbdYU1LYqK7GeeVDW2Cr1MPzvu4MFjmaZWzM3yBwLUq05U+VkY4FIqoIwQ22IovUFSzJ0tbGzQDWYvD0TsQAcxaWiXzuHN6MrC6zcE7ss2P/8QCzW7b6g+ag1PaF+I/i+wDLSn5VWKi0MpcJhpAcle1DtuwxQ3C65avBp2YtmQ7Xw0/ip1SABmZNINULqmytCLFGFEOzXf+jhDSM2aQU+Cv5OskpW8UghtbTqlQBA5eitjBAi2hAhlOJ+02/JnCs4/ID+4Ok3XVEAFn1Z3zGkddJJFMUDaCu7Enn0oIvqxXrrkBhqZFH94SVqtQpQOMokM3JYnPNdzcuQxq1aiM1jFEFK1JnyTcKt05CVDJgD5l4WQuxpIBMtkROWzRYZ8+LhgWhiwraZBTRlYKDOdez6NV7P4U17pjogzroHOIFoioX+OyQuxGHkTMBG/jrijxbU663TliZjKZcqLSs2b1t3P8Z7v60jq/267sP7s3mTeVRTamkZP0gFZ7o40dr97XRQde3GdCgVxvlBcE63iFx0CLFa1mQExlGcNNqcF5V4lGVWJFGq1d+KPbTKpsj7PoDb8uPV45NO8Yf44clDdlTCtSIFsWdsGyzM10mLMFxbCU4awQ4rE/WsIj9qlxhhVh6pG0LNhJYT8NGmfnZSXgVRQsjIApwa40exAl3MGVEfIIdEuqGOrPSmjRn/MllBj0Vqsc23NFvoHEpS8FewvnuZIIDBbi8B4G/zGH7WfdIAe3fIWMKMCIqfCnXMnLR8B/Mpl8TmQvmlmMUkYzkhNzLCpMEb+inGMYSI+SUrIiI68hscaV0jVavA29QEzNgYibB1Iv+YipR8HPF/ZWMhE4bkt5eh4lT7pIex5lGQCRM1KhsMlh++R9hzMfmEXVICmw6bBESgKDyeRlTCVHx6SAhmGwwu+VYLWhlAscfDm/dq+dSKollr2VEAgxoB+8mixHCESs0YOjdkpKForF/+l3TmrZMr+8EUHNZJ72UuZkiOIFqrpKMXVbYba+rcXchmXtzxdbo7k75kifqftmJSK7NIGTr1aEWU+hH/sVXFnrhHXMizNcQO4bNHtvWwO01GpEx5y37cG709dofWa1DxuhFqrffyfE6oa5bRYA3u30B2T9FsJOJ1McoM1hGEPUmGGy2ZEhI3Bj+Bfyu1lc2RwSNzIJlBY3bMlXQfFBCDIpK0U+ysWuBVLma2Sx+WJ7e3d/z955sfPywt7df7H/0tm7+PHlaGe8/+LHvdHw+faPL2z75Ytd++LZs2fj0ejly5f7uy/H+xd7L7f3t5+l4qWQZs5SY/U9lgb3EbW3hTW34aEjL/UP7qBz+6YiAg6hEcVyOGRDDuOslL7Lgk3svkKn6DVtf0spta7ENMI0I3qlMP8mNEKD+opW8OI41lACQSKS3aM2LyMs3kUAQGanABDPdn/cfxn78uCRRXOR6Pju8+fm48IP2QKCF9eAYQt620HJWCP1TJXjbmsC+2jiypOwtTr4q4gJL/YcJQq2MHHEkPCrEYChY4FOFGaO5nxiMdyvHVFW2RjoYkmREuIx3cPuSpwo8Xb0CPnq2PBqIBDZxbhuTC79tGGfGod9dez4QkFBZBcyTtPhdxSASsq6pcOIlrdlyX8y1vz/0VT6P6mI9gpuYonL0nx7YyO5N/ozh+9YQW753b8wMNVDwDshx7PwqkM8ik0mKML8sXSWFPhb2VJpacTN5EREbQ5pDcI9O7YMb+vpHK60P/Cfy7m/nNUV0FU8K1dhSMNPVeczCFeYrCEXBHe16npVgIIGGXT9Aes+txaNqo7ZeRK+nQpyrCtOv5yOE46xv8XiqGdFBsflH4RfYxEwxFSnm6rRpVEJcVlOniNIk/nZRVeoS9axKFhL+xBgePRKLHVPGDWad/EwqDpHUk+SpYxDvDpeu1kJ+1Uk6QMFifdC+BWVzbBWdymMAsLRAglgWDGFAJkoyRUbaESdZ/nOyorxjrMjC2VMnogy7+TOHjKLORr1oQRYmpv/ThK+WUl0Bu0oa8flNChTtxCSoe8RsxieRU25hIhMjw/WdAbh6bLJKdgnLx62oBWTn8Y8DyTBI2AZ8ZS8Mrq9cNRKDgmMTggyziUwyriOHjNXu2GSo/sEvSN34tA6cqYppxDPjhmRjlk4wj9OL2WzAchPDTNz9cIiCaq+V8+I7e98xsUW8HWtaYh0OSo5MBh3XDd+rn70SqV/1Lnm2b8/eudPPnrlp2XMEkrd5PwCSid0seEEms6g5+cJxRUrwqI+hcHtzB9+QCxxYpJy9PrLF3oNGDYf5BtHnlYmXruYqkYMaHjhsB6MPqUyMlCBUii5pGZt7DoTMmemg6qDyS4bLD1QjlLMuVLhPCWNvf1nPwL+UFdnKhkjJDlXkzHyDeFpWaUclvmDtunQ0jDJZJ2T/Kg/F3P38tJB3ZpSJAj8oUust2F2foVDNcYZJQG1YQqJJa0YpOFKTYNESqIQs1vAyQkjhFRzDa56ZtIrPN7B3PqBS8mgqE/J3ssKttA8ZiMgGp4Vrxp9wAZ5dk5KPB0nJW85vXCiwvTaPM8jLzGlUJemUdbEH9gAcKM5fMN4UF7UfZqafLjJibTUyQkBRe8AWlkbxfozO+3xDMDJgh8osZZDOdROSpIxQUfFbMsG5F1vOWV1KxODLGekbfYnJVwuJWWNk4EFK2Iv4PwAm2BAytg7jGcuulYu52EgnopjJfuML1WxLfFqJUGkxGcLcYBPnino3oKpl9q7k9NUl1nO7nEwTHrxdwpNKR9yRnYXmzlK2Xb8GlYbQRM4xzMgK/3MdEbc2OAiVpQeJR8ec4fJRF43nu/tv6QO8HJEA/8lnATvOcky2QWvz6RgS1iv92q/Nd2PVRW8dQbStiXMWswiOIgBSXNfSVxCeokzXRW+0soa4GX62RBxZAujaWQFKnRykCZ/SSWhENySwcSnpID2fDLVR8EsqESJc2WYPIr8iBbsW6Rq6LQPo0CP8B2oaeqMtvz5DOZwawp06wI/qIqIj9FVY2RqX0Xxzzh8LVvklL1blMN3S8SfgddC16BopBWlM2nASfMsPLIYaIAJcXBkhPkgIaRpMmoRvwjl5A2pOq8bh+KdKjOy6wlFB0arKJkZeLpcRJl7iaXWQ9lxI5KeNtR9sBbtgXTejQsHxg8/aErXqFCNNyishbJDRlEBiS8myQelKHWvAIi7WY32MgQriiQ37RQMYpnrVEhu3oXqEu5rEvU16bCAOWOE5LKhysTG8gKOkMvq7l5tm1PI4HkSZrQ6dT0kn7qx+5zeK2kpJSOTgd7rhhIUnyYIXpFeYUNovGQN1B2+Q/1ev3XQaw3qxvd3d0JjE9S6B1a31zmkAkYYAwSrnPZbvdwqslC8WrfTG6yshoXi1X5pYf7V9nGz9yG7GhRK14K2OieHufVkvh9t/TfNoyNMahqv/r7b1zdJmHzTPnnb6gHYk9VjTVaQ4Fi/Eab/w7Mj8VI2NkOFJFDEP6+jHEO47NXtbO6M62QioG6xzmJ4VR3B4fOqbqgKuxlebgSLKvQPs6i5wNGFmieZgRCjsBikOpLrk+0QgKu7I0fNygknqQ1Fw6r27e07a9D5pXXCaJFriyJ6KIFmvj5xIV3aGdWZsfm9eue2uRGT/xktRrXq+dWFfRmIaOhJ5InI/3Bmb2x+X7q8Qj8oo/rOMJt0nIfZmc3CLeHaGwlNzlPS7RqbxB+2vr+TV3WtbqffHnR6H+63kIm5i4B2j03ox+9/wJEX2jHLak/PzmAYUSc2jcb/a/z7bLv60q6Oz+/2tu+/N87Pc8s3DOy4i5qD6yqdasVQqeXyZrw+FpSEBp0awTYJWIqBTLaWAP6u1Twsi3bVjsSacYZXvrGp3GrGiv78M9QVKGudvN9MShljw/x78BHxG6+WmPGteGrazVReTWHUL7XfqAyUGvbffThOgMAhMuKEm/1/m7gp/0mVvcgcedoD0TmwVLHT+Mn4SRJrHg3yHgHfmqeDd51eewBCSb9/2rJOTvEAcL+ZME5hKj2jdDsgA8qNGASkKzsobapd2CyfG1+Mfy6C69gRnSiGqhOJUBSIH36AdxJUROHnT7/nT4nBUUViU3GaKpUifPwEu+X2tlEuG1++GHdMbqa4N13chrPrBgbqxl+BeKnKVuFsK7Ehaqbx8w+7r8g0xdjZfxXL85ykSj06NRRqyy5VWZ7SkWnPCfzJNQl/C3bRQgmZLiz4Fh72JcMlDr64fURSA7FnWirfoXYSUHUN/G9n8xX9vbv+Dv/5+9/P/nZWp0vx+vn5k/vN+/D736nQd0/UAvw9QhUi6nozjsgr2EWQ0WLb8PkuKadUvz9svWmeHg3o7f1mjFeSciNRWZVYqonyOMPJ8qqoUt3dTdSQTnLaLmoEgGSLRP04RsEf1cEgh1Sp9cD2MMoioB7nF0Q+snaMk+F2HHsAvuoBWETEJq8dfqTGdPiIFcJ116z+Zlf/Y52LB7SorKJJ5bMd2mnUDnZDeoydJl1v6M54bZGc6l2iTlQY7cS7v5Pq/ub3OClxHgCtQi9LJfzyc2MHf+DjT43958+fPeclzvB2k8DkfDFA2Gcw50g0tKdbDdGAOixeVDhLmGIIBH8i2ZjdSmwUz+KjGPlk2+fOApIYHApLbyO44HoP+nRE1uAdvFjfBA5p33wyzDtu4vudexNeBch5qkvsFLr8xyjoEri5UX3z+Y8U9fz000/wLmp9Uy8Svesct7ZqQXC1mSMfUVwQ40fgoGoF9fgqHeIs4EXAJGK7BDMMtr4mriGkqIYCbMsdWbMh+qLB5MCxeiOuLTWqI8P8ODcNHBNDYu7JkDY34tbk2Nt96q3uO+OsBTvXv0vQdPWLMxwFdvVL8KlajmQIWgtCjRi3NYTu4VROP6E1VzkOG+EBCi5hG6veGtWuYZpGdawAxU4DgE1j9+etkXO95cF+w+Q2n3JJ/PoqbDlOTPEGJrJ4eiMRxaoKxfJmElOSKi0qH+5jTP/WCib+Qj+nc/uGJ9Q2LoxhrIDkPVBEcjItMm0Vla+Mi/jPYSaik1sstYNosOPlVMKkrzitEbJtJPsL/GcYIX07ifT4JnUHbW1tffzobX2Pd0r33O5FbrsXj9AuDfELWSvu75EwTrawPxOQGD1BU4n2hw9qP7f0zgqSkVuMemzHLYbYWLpIdEbPKRQexEWZOFEywz7xefCKgATVw0ycFPkjEGmeliH3jgMiRr4XG6AqJg1tL06ntBdn0CpLZZQJ77axndB12wssTyYxO8auAXvHyI91pU7ziy1CM/yDGtOyHSxmVAcgCDBz581TihgxjhPuKiF4ub9sJOxvcCUHYaHzcwo4mfREvbnCZDDtN/1GeCSZuJ6TGg6Ne4aYSi5gLI7knWBwVeDUBseBTAwgtlPu4k6p2R+VzX8828QAcKoUwHxJ35OfM1CNO7rn8EaEGEllEme0Vv2wehYcxi0KBbQhDY1aVCUcC/ttSqzHiQk2hwt4+oT23BvxS8/YTzgJSToDaM/EMSiYOA4Sifi0uREfYUoQU1oOexXfuZhC5BheaQQoXHxSdDXsMSrhScNOfj8UbTIuSz2Pc6TptYrUSHj45Pk3nkUylTqMWL829ALCSiCsmggVoA2xmHJ0EkoNPD40xDLMqQHNG1XXyJKHlLUMZPUax3+M1gG3ToAv2nzWA+R1vMmtfIueKcMFBqr8xbk9QBUOXqaLjwc+zMlwMWCdcmPnOTSQOA78Uww0fuI300dEoExUMQAdA8+tLoFkq84fuJcIDf4120wb0eIVlIEN4snY6vxiJprRyjN4OE4KMZH8q0DLr5w4TnfneC/jhHSoWnjhj/HEvbxCH4JbtN58xPP0d8Zr0aTirREYeFdECghh3Y2nJRGZVNgM2YmIKWqPrbDHFmc6RVY7tBdwHDC7H+LxZOHHm6P223cD1bbLnZKiA/WV6bd+kH4XcwUX71Cho3l7G6i7qJKCwGgYu9t7LxIfX38Y0Kc94wmFkhJ/lFK9zhGVGM/9/zgeYBsjZXCcrhuHwsiHEaSU5z/Iag89ouj11PVcf4W1igg9BaU/2eNPFAzjP77/CRgomX+YsIgu/M9VtITCF/mwkBTxPmsSlsdOXLKdYuwHd/sSSXPI5W5w8S/8G/gVM07odo7aB+0UMrCKRwEe7MmNfUvwlh6GZ5TXu9R7ryrv8stpg6IwR601ntiXQWkxt3FJO5TIrMH3vskrdM/nxNvQHTj1wA4zL/kBtNSxTjpAfMctaBazw5fTW2JYVSSQXx3+xzyJwJb1diB+UOtYvcPOydEHkBzoFzCG1gGqPeWLk86bztFR51f4XdrGnsQGyqETZOfSWCIlOeyPIbZEYFjOoNDAkVTQN8u/sTgLHBkQicvzIigdj6LwuAJ27syU6bs1HjW4C+VimdppBhapnnIe0qA2pszq4xHlVl8KDzk01NiuGBxz1OGgo/nu44rXunkKPOAUgzNbbNOVFzFntKH1LXwNR6Iw3lRuAuixPoQQdio1pfZF4E+WcISK5lQbLFKgTPGvlYFW5mWDvHHZBa1GHD3AO7qSuWXmBLZS0dM+oVAaInBCyoQKWKtHKu6GaIMtLLfQ1LF+nu6p7eEo5iKdIq7+Gv1TM8siRgx/iyA/Rj+JeNNLBLqZJH6dL0UGqbIrt+hmvM9Z1CezWKe7EtatGJjJfXWnCpKWMnpoWlPgO2PAbdkTkJhAPGOjZzhDhZ0zRCT2moECHlkPTxwbPbrhy3KKFu5p5znS0mApLeJx0vUdXrVUeCUi5D9zLZK7HdaoZ0V+TEU6Je9raAylf3TbhMrkecy4zCIodloHYsopJ5YSur8I/yjj54Yqz6z2P1ZXzlH7uD2wWv86aLUOW4dmOTMQKzZVs2HX9kbsfV2j2Or6LQ8Pos4oDFqYMhNGJwLKdIrkzvvJxJ26i0YoemXtV6k5kKsqvjtp9lxlixW/T14fdQ5+iX7TLr7K7lTsa2n6yWAU4tK2EW1g1OMMf6MSLkAsVetb7X6v9bbE9XHHm1IMCW3kk/Cwnbl9RmBw4/xbI75h5oD050pddHGG8xHN1Rq7rGTPb9oZocfkchmPaA4JQygmoxhN6xUwztOPqwj2NseeZjUvDkuUrR7LkctKibpsPM2I/0fKgCJTFBqwYy4+QgduYDg5KJlZLDTDz6H8mTHPuHxFR8sSoZTXD3ZIKbQy2ivGpzLOl3xLfaWXFEoYuQV3ai2ph9JFtLInRKzj5MFTIsEDGrvN5a8Cg+mVT3KI5XpoPIe7ARpQZjPWO8VlWXWyozMUxSPGkNDn9JMDm+giWmMbFm+EYShr/n0SVzblrOMIhkY0o0FosyXEm9NshlERsyIbKW/kG3zzhhQDXl4ldWhGWjDgBkXOU2LczM3Q5md/D4Pb0EaQd2Qqxh3a2dtPvvjELD+OjjxApH2Pu8VGO5LkPVyqdr0rXGPzIJJ6cQU8LCNgrgaYluq5aoUcZ0iwF7DILRUxhzyC6EMI/UpdbFrUfPjsRAE+8zaLmXT1UrsnIuivN2AB6qv7fdA5edN+m9v4hOL6I//nNrnXItr/il6LugWJP2zp7n4tZHC9r8YF8M7WUT93SBgsmiJpYoOMiJxMBwUg0Z94BCh8JU6oKJpwCU8o1EjVIRxF8oIR+RN3iI7oSNzczx7vLV36sia1MThlefELBkz5BspS2yC1XetPg8hqYfUwW1NvYBGkD/lIdDiMldqdY/uzO11Oe/jpAP2JV42VwqcRJOLSPI6FZBTbGBuN24GH3Z29H/dePNvf+/HhZNZrDXofYOGdngzyu4ZBfpPLjvOLAMNccwY56SdR1VdsQRhkOLdh0oGSsMj03YipRcm6CDsiVSH/NNG5tDYPNSPkblqNvFHrVCAJJ3f3oiWIcshkUkrxCELiJwc1cOECIxc0/kxJKMqFPUJj2So0fGA291HqMh+WfzEHYg210+jkALv8N4DOuxNt0EH+Tsy2rfH9rI/vzCK1+G+c+wl7VeY0xO1yNwPSrobZRKhyOMfh4o6/plWOk87gcyS/7MnuLT0PnfYwvLW9DFhXLziseN/pHP/iTib86RAEnnT+kThOSOefwOU7O3jtON6x7S3xTNEXFwN5yB3N3WtagSqcQ3pZrJ54AOTJJxwxOuhN7NsxHeHEj11Kx8KvLhZzfvgP/BEzZy49urnNX7CjkBS4rxiHjoOI5IW5S49R4KqPc+CMXtPxMH/34EgQIl+REI8tV6aNRGdRRltdYKLCIaLQ5ZHoruDKM6di+ix5sVMPpzsiUfqtoc2ijSBGrIAHDw04Yg4JOv74GtAY428YpRoI4XLcTjegDRN5Ke2WVAQ3y+fPo7ZyF7G6tMT8Nclb943rUZiX5sJcuW9xQNhGggms2uyYBjj7UEPAiHMkeqfsF6icEPFVYZD7eyylqUfAzDb5bHh+t3df5Yfd6GEgH+qph9I/6h9r/GOn8vK+/A948duXs6fV81RRjKogOld4CcpYblJlcC4VmXecHKVusEhqspgFv/nhjEW/cwqk4PkP3YhIuMJGHApaqW70dSlQPHyPw43N4t3dott4clAWH6KgblEyhbqkifsVUTNL4pKzoshKFQNTgYvHnjNckn0F/c6l32gKhJomM7D8Cg2TIgGyRkBItEWOX0ntVHY3o5hLmA2+N2g3j0xWhKSGwVR40DnuHrUGLXPjIajMSLuU7ouqAyuulUP2M+bAzTEtSaRwyrlpGBdGcc7lSpi5FIeU0gpe2MNPy5miFNRedRZRCrJExxm7LkS2YHymaF/0vJG9lkQASVmHz6D8vPQCe+xYir/rCmCec+NItXAcRnRxHodG+u173d1lcSVlln6S8JlDYrldQ8KjI4S8lzjuHLZKyft4vp34wdj2t3/8sZgCM4/uvLHPCnlqIzQ54KuXCgCjSw7pFN9IRQDQHBZj1yrYgHqpYsgXmuuR9W7UIpMCNBY+7dK93IcVN2tngnJzuaIseiES4UJR2Wu8iVhRK0aROKdT+3NJ/xEj3C4iFJHRyar+a1YI9TBNOXHU51CMCp4XME0l0EINNm9hy1Bj5iEk8o0V22W4xHWQ2NI3lO15/eckQEmzZ6kktfDiMWMreAMTfeIv3qD9HZFMUd7ffN0HUvpLbjCFt4kHbxGzS5BxbjF6uIZrZHBDafzZSFw4m923mM++j2GwK8azXc1dMxld1NjJoWTawdB1TWRzc3eWCny33rzSIDUcXX/LgvJwQjwGEfgfKAPz4MqrTdW0hjIRBpLDYRdTnVFDjilMFIrocuJf2GTkeCHSnMPU3diT7OON8GkVInnW9Q5OnH6asi7eQKZXthDshnhrhlsJN322fb7GjqLbTQTg2IaivKNrczhKba9/ZX7Qgd2jc5R9U5tzeTdzRzEE+MFiamPwmdqMEg085n4KEMPRr7dfhiSZZyAghiMPODCsQdJbZP3FmAZKw87JAWxO7d8pxJVYfUjdLnMW5eylwLxfT0gXJxpPrImVXDTjll0k13uES3a5Ct1Qklbv2XPkX2nvLLh2eE0PYsJyNiPzIMufWx5ajSuJdrNv7kVeuD/l2j7WlubOPspRt9aFfQQ2c4l8J2MpASH6FFAJY5EtAozlZCDjo1BTpNS3yamiSnIjpbcQ0acMkFqcWs7SDVm11AjURhfMrwnim+A1Bq08dK7zNVLI31xvmSVyCRokFBLHpieP0utlTmJBiwQVdtZ+oSA7Tycc9kwzzZbIPRk2l7UDFdB7qAspV8jna2JaM7o9OF0MbwdD4UiMZ+WlNVVcQ3MieiQ3af6Z18qKGSQ7fYUWNNifXQr0izE9APnrbga6nq24PcEFFZZeG6GxuQvhrFLpPmgGHzSLwlJN1ENLtZ31L1ebx6/bb087p32UOo+aHzqnA7PIkkltIec15/Mi6nhQBEjefkPrEPEn4H2lNvTUc/G48F/QhSr6vZCIlHUT8q+VNwxrqfsKG20/UKXaH/RODwanveZR3nH6L6NZjTacv4xalV38KHoiiAwlzMxF+SMoWsk+pZn0vVHQeF4JI4I3StuVtAONdKJzJsSdg4zPYboM/XfUI20Utk7M2EFkDSU3R5eMhnl0wWLkeg3l42Hr/cnp0VFFJLJSP3Xb3dZa9y4AwpnPNdC1CThCO2TU19nzuX2rTYYxcuwRen1DQURQbeoDUWC0nVLZeCqnKMtmOpyR2qEztoEI+uJFiS2lxa8s8pLfa3Pn0sWTIZ8oaoyrigK+9b51MrB6GE8tAxZ74aeG8FM4wPpqe56wP/xQQhUlHDpCFFVT8MurrX14jZho3I9bT2XVlj68Wnqf+OBMpuMqSmoobnt+qVwxdvafvdgrYKNE4FZ1UhgJcFM3trsoiZCbDUJBbWcFEorhoBRdU1WIKoPQCJ1sSWRuyjA9ADHiUuJQqPOd1BC+3Kxp/AWEDMUcHlhU0VlN+K9kTm4hKsjdUpRV3w8f8/YYbjCNu7XUqoXvOGXZ2syfTEqFzLG5/CcXy+dZj8cJcje/rFgnvGOlVRPCsdy6cb2Rf1PK2mk0W8Wls2AvjTPzYhkMF6RjrFb57IvPGF4RpmXmzBfkLe3PL2vjueOMnODTwp/VuORoJ+ca39yCSltKpS1ZaWvpuYstNiezdh1pAJsDKqv5Wl/WNczWZ2d4bLts0oMBEQA901kqzTvLKZjY7obu4uLbOiOGN/a97Zf76SytGPCikVAvX5hA6BzWrPwxeGIydPT2SVteumPRBbwZi3gIlmbgeTpoqTrT65iSCp+pO5z7ePLFGygCfraTMlgkIqoY4zmHo6V8EtdTf1Ti2sCbt+m/st5Zduf5jz++eLb/YpuMeQgYPhBXxX9o493ffoTRyIlTZIHE5GnaODNFSMiQxpH2GsKUMYioB4jf9YZO45+Y8GRs3tFI7mt3Ei/17f3RvZ5ECejCncTrwuOz7e00BCyOW0/QeLq3vc2/Pb86sy85MEC1KpKRDe2FPvUE0WY8lEIkfu6kJoqcnCyJPemetS7ho8exAihNvAwYXgPpF55t4Tp12Gwdd07M+wJKVTkOc2Q7sGuzDZvlzPzhlUUFJNmazBUtgRj4AtORw2LYnski7zEoDHNDbG9EZgtm5+iwRaEge5RTnq6No7LxybgvtuJzkCTOIAkZnlNsSIlA3qctF+PqC0wrhbtn0DBF3prMGza0xkNIodt4tQr8RnrJGtWqWfiYd9IBIfag0zvsm2uOhRYAbj/4UJug+VaJnfBIKnM5TS3bdVPZUjl1gebMp2TLq8tb1jrp9LsHMDUlEwOwYKBSkIvGCwMD0ztyzYPwGcyG+qw+JjoWdHotixKKEyTOPGksfIP4T2j9Y8oklPQe42IqnwodiUR1jg6TAGAo7crwMdFnfd/Dq/Oo8zIvcsIVK0qWbSSdqoraey49GYcLiGhk+GODfbK0PUOcNt/qsTol/wsym+XcB8KgFt949iy48kloIVwVRezEvoUqoTs+ZUnL6Fq31Ttu9/EaV+ldZIIBdOO5bJ+NJxlOBYEnGENITXqosDx6p10K09M+OWwfNAcCcngBAWxnvpzJkDHSqiKMrqVOEW4SGe0cdZqHFrnCgOSO8FO0GNR5ezYrORAkd8qGgSHFNCDuM1L+0uoldkHKT/yl4UjRN3TAB95blAX9Ckjt/GrxyQVO1AfvMIujvh7sBxjQHbgk1RVOAMtpCR2FkZ0g3yH+g4xIviD72CDOnLTDWGGvLCxtA2ZuwLtqLlANMLb7tfRQuEpDraslTk7IH+trybln5ozs76sHakClSnStTR8p4NDMHTXM8/VsalGKoDN9XBlm7JTLX705poSBJAKhw+RVrsjgMlWcnvKwAh6V1UBWwn88KeezkA9ogTrhuZDjrVDSeWq8/AjSrqa4om8wKfclvKTMrc6ChwCklDL1UUOKLXx/EmQeE4Or5SIW10ztBodY4yK1mysXsBF6KsvTtHpLm0EtJRPVi0FAsvjljFxfhIsasCbircGtN6QRzrJ5vGJ/Iu616E1okJaIFyaOuBr0YEzlzAt9kuIbWW72yRyKZDlHOegT9rfm1rU935q4F1uzYXXuTBxg+tUwPvwWl0/7xgoVeHhbv6L9OJch6a5k0n5w2hXOkUqcuIocVZHUcCXYGg6aR9IEM3ReroixFoPxvnN0etwSd1axroiRFgNz2Dn4BUMbipEx/6cE0nFdSDFoFN8d82G/BXEP07gctPr9Vh/gZfLZYoBj8fkGnc4RwtQtxrWQd9DsNg8w+wD0lMx7wvsoYLj2EMiJaUOvyOVEXug689QwG5TYM0reLP1WgBNgpOFAJMgWua7wZFEyK7iY6mZaRSpShMlJEVkSfqPRN046A+ttr3ky0ITEERVb/xq0eicRicmgj1T3oHN01DrIqS0l9fetXvsNSliyVZDo3nR6x1RTXfnA9i3KimVZ5CxqWRRb3UrtOsQeQLyr4X1IQneSGYRRKVPOy3CSG+1REwlcLV8Ny9dmtysjYUriwEDKJLE+fgxM2YQlmtAGrUyRrwIg/EYW3izQUTTJ7Xgy8rAch5nGOIk72u+Hre7gXQhnfy/LsCu+coqrUItYfEnbJrb2Ekds8SvyrsjWSaQtxjAp2tCeWKo/BppyDDFymPI2G6Y0SxSVMXufCwDjnUMVSmDxSTn2KQeuyIpnRUZUVnz86EY1cbCf6vscszdBSrKe9OvgE1jAGS3jHCIpReXfByZpaQ17uVQ7Y2PpcYLJURhsiFRiecIgep2nIhShL3IjHaMIX0eujxsrNgzYvGD2RAAllyOHCpNS8bgks1V8usSnFbtQblimsg4deKUKTJV1wBkXMqk5+XnlBWfaJAZvoXidm9qOXLuBuyBbdUqVVhEKIG2fYp3W95mAQEd1jKZ4p5VKWvuddKQzvUHId8aBZO5XdmTdGGaDZwtyDoa3hcPa4v5fLEdAYDV9GMMrEuVBTneHwtqyjAyeE86jtL+AzQE5jmEDxjBPHGYWDc3NajlByYrH8JNCbdE4fkWmL+YfwEoBydzOUfGg24TWt9FSKheyzYq6sMKUMeHIFUUOfLj5ucCGdCOCpYHncF4hq6+Nuf/azWLlYJyJOPqT2fvRyS9xX6aijYfb2ZoNgkS1XoPZIbPUeXiQaWVBG0/l1i3aa3AMlWSwvXK9oLZGw5hkNGXr4F3z5G0rP47YV1nmhiddYtAithezp6fGTsinV0AoYNKXZepflFZSPo5FibOAH2JKXxoT8Ir6JSahJEXCGJwLNEkPjCfG853dXBwEhVlAUorMHHKBDTZO31IsUvfBNaIz6sj5r+7sIIGkZYB8O3wCma702G4VRTbZ/7ZrxF/BHUJAyprF/7YzBXNXtV/S30EIAgUkl7wzH7EA0cjfNORYvJUYxDw+yhtJaKq9XWQLSTGc2LRVdLP2gJho6+2qoWCVOjA/onH7X8SiXcZpTk5AkDUDtOxWhG6OA1T4YiVNh1+7m2iHxFdHNIsUKygWsygUWTXqlyzdy3p5GPqnXUxY1DqU11lmtjNBbTnD9HIlVmI1Em73FSOphRGKYdbANKJLqQxP7qhjdN5bx0efL3U7PSuMAmFuZFr7Bot5iaDnuU0ItdG50QgjU0kz3awwTKp6AY0MlbMdRmpTjvH4M0UfWXoV/SQJZ40o6kUIcKXDxqM6aWTgzESlbf8D9OzY+l/m4qHRThfV42eovjUafFmyKkqS7l4BfLu48r1nRrW45r9IC0L53uz3W8eJ2RLabYxoM3Ev9ImeVFv0xZXITgKla134m3U5QoYtIpEJxYtAc66YtBjeSWQB3D0vZ1QVrrkNYzP7Imczft2D/anRnXmJa1OI55T/HfPSPgkyGFgwcY/XbX4gI5njZu+XRH4byR3pAhjaElZ4orVKNNynhvnRQ8J5KsaRhEJxrgU0YCk/hZD1+cx+Juuzz84w1h1C/M3cBdGM0CeBJC6wJE0kL5AO/Am6jBiRoZM0yaLodSISIuxQI8cbRoK2O6rjdnHhPOLF0qW7MMYO2kWTmewCA3j6c/cSWAjOdTK5YQnLz53rKgimgSNKbmHJssiWPWj23rYGVv9dczOeZn7uTP2F5uKq1zruxGOR5XaYcyX2D961jpuN2bAW5dCustVx9QqwChxvWh259qXnBwt3WLveMVMwjk8HTHcY6aeB7kIp3z1hQ4/8E3ssEvWRnrBaBWY7hSGYd3c1doTvQbFDd35/b8YYmrAJMqrXIQtS8nPu/vzDjob7iXv4XqczaEhOqPRmM9XJZK/kRT6sLvgjAqg0oK9o0u/M33NQiHv1Rie8+2cbwsNeG6phFQ5Yqit70D3tY4kTeNB9P4bJhe2a0qRguWNnOvAX9gRwFCMNzoQ6DowFfsWM9CPDvoaZN2awTshy0fjJ+Kk0GhvV7qcELmSO05Neo7EbpgSvfL9b+f5Z5fu9yvfPK9/v38cXcBzNb/rWITD6gxbhOno56AyaR9YvrxOvT/sgO6Tehht2RoVuq3cAokji0zGGng6neBzgnkNI2OQE8yP8S6jAB8AGJQ5FhGxqMOiO8ZKCcOgSEl3GootodBN4dL8FHtsnsJoE5hJDFZ8QGfovIQazK8awiBhzQ2S5EltuiC4cdmKrUlYjCFKjKYwxsRo1eXvTw3zTPjk8VrpRksCqlFg4gVhMM9o5hY5X3vQHH7qtCnPJSocsV/sGJrHFjcs04P9izCOWoTbe/UlwMfmU7DxmryYFpDjhBMi3uGT1gjo3x96cNI+hE9iTfvs32Ss1bzAma85Egxx0rCHKSQwUZwZb/96ibEViTQkj9sZWjAUng9cwT47Va5+gIyfwj4YmbiogZiOuxWILWoVPzwKjav8hNja8UoMe3gyN6oTxXYW+ntXJeL1+Hse6EJ4VWPwGcG5U/ygMxnMWGBtchSNerQmI4rSrYDgcPQOJjU+mVS4KOUHZndf/Awcijoffbyh2yX8PKgIp+CgHhs/ct3oorod1cAGKOvgo69C6pDqbGzGpc0a2M9WFYc9cC21MiVFFUxkbaRWDyaC5uknhZBvZiR8amOi0rG/pxrl4zJYwl6qOO/YAm3jMbXbbjFpiG/Ltr63XylvE4d13AgVn/zy/36QXoqf0Is4RSiUjXoFzTpfLmgU8dEdARHey8HYcmCJKoN5koUgT6gjah7iTt0ex/T5WADMTyGI405kle7DQhVwC7NP5bNQ4/0qNE5oYm+iYiCatEVXVOGcByKAuCjCbmbAPQKKDMz524gC2x4WT3WFh1281ByQgUcjqMPJ1Xq0BSz9hDbSWvqdV4I7yuDjPmTKnq+dMFl5/zpC+cueMChSaMyz5reaMlkGxOcOi68+ZqLXGnMWSUPfQ0W2IjINd44zQYFiEN1gCE7hGoxB5ISOtTGzv1kD3N5ChY8YbUZh7aQ4S6O36OieDZvsEBY9Or3XSbx/0/6xM1LooGdlZqkPd5uqM1Fg8HJcmrzUnSEWzVfYGlkf3REIvldsyCWfU4nip9czKeE4CmeNPSZJNCspHTJRN8B6cLLuckfNSUnFJyZ4sMmAWybn8jbJaCkMctU8PTm6ZeWNSILFlOtFkegGsH0EzN3FZIvHk+MFZJ4k3xVNOalZv0fyTmVhE3xlsqqxFDuIw61IgjtuK8lvaSKrvpKGkBhipIdnEM4IW/oyAha8krIckqMydPHRGi6fdI9Rk05+aLgrqrsin9kCSEgp7bOABeTPHmnCekmt8m4Ce5Ka5wqw5FvQzTLlh8ZFDwuE7WdKHrDKTporW3BmHcUGFuM+/kybRMvO9EZkYk7t8yN4yotLQtIuqq0NUaL2+ZfolDesNL7o0vFg2+00TkcrNAd9UuKdFkpDKavHUo5zvR+4FOQY43xmvhY+GzP8N+98rtDgC2twCEh+ibONegFAXCm0eJeuZOrYXGP9x5r7SpyKWt/HUngWMcMkwKC985rpWuoL1ElwydY/LWoVtzlJXxWHkomLxjrQ0mhr56jzdSUsqkbCbx5dzpRmJkIqPaeH8r+sFPixgSbW2DSdZUX6tvZUCJC6fxddQ4YS0Yh+LS4iyEU0q2hV20QAtnRb2ATkRD1twxht8sI7b/ePm4OBdoVyOSuuUyHFVZ7UJHOnKLnb0UKiNyhU2Z1V2mjDrk5gtBlR+JHPSxJ5YhLI5C3GEsQJ5csMEsmpeOJmpNoHQeMrgIqkAxSa8Rv7XRJOxPLVrNimfEtkS+a1CF2E5LzpgFkwaG9kACmEjSRLiQy5RsIATm7hjfNX1XRR8ihM8Ayqa1DdmWCilLKIyDAdRxAw/lfCNZwlxSi94LGiUY9IWJ9oyC8DGrSR04ua+1Th0RKlcxGqQZdDcNfN/U06yNWNBx238rUcLo8vhefTc6f+CrGV0M6eKruvkl1m5+SLKhCS9DtwMwTg/AIqI52YNJzZIxmOM6AIEGka8TDb6ndFB+xVqcFS99of2xXJig6w6ZNYzcexrx1hcQb/HS2/I8jdGDuEQVVP7ViIOQ6xB11JCtnJSDMNO4Rku0oomQ0nlneY0tVSgqchO+bC0sYdSiSHU0DYyvJgaeks3kcKrVo3fpcsgQhG2kGyzwnCFMXcwLaQIyCXf6VfEgrVk0YkrgoHsF01vQ/YZRvOJomJkGWTGo3ulYnpFL8IoXdrYXPoMyHIhi7kk3siDzSmcRUBUWzS3XvVU6yIb6SpQCaojAA/FczoAWTLwWLn8NRNJjYgYYXJ+lBhaZGFte8CjTFK+2HC2zp8z7Sr6KhRkhP6SUb7k54xwYFlQY0HCKtlx2dZjt0M2BbQE2y0VzReWGVo8o/trBOrk6Jma4JmZ4YISMTUfLbD5WjHMcw7C3xmYq9uwDfTam9DhFdPWLPCyFU1HXwmlT+BeAoborUhtw1d9mRlq8kPNJ4ppdGyRPWmx+OtMNXkxF2LBOlJ6qq8Mwc6HoMcLw079+ppQ7NL07ZbOZOvHY1/tkIPCFrVQL+Smu2b4dl7JhUK4UxqEgh0uFMZdce74VqHcQ8l4RD5q24XdpovGI8+rrIRzy5dpV4d6XTXOdaPIK1paJZJ88QtE3XCLBpdfm1ZXnCX/orHcV5wRHy9A/loh7/ggk3VHpg+/FcmZIXEIKxZ0ckgeYXVx68auw5n6SjHlc3ifpmbKS9+Ypa7LcoKf6TpLQbuxB7XlbEZxiGV4NPQpE/2nAudlXe+H7kjoP3EIOl1pTn9AqDxs939RTGhYVdtrvaEuAHDszhd8Zh1rVg8UVV5aNbdWD4QmMNW+VOhlBBodSl1eSmTU042w6PyfzimFflNohiFqLiBFEyt0DOlQiFxPBlzNTF+p7Rd2SI2Zh0RBgFPE8J1xKK0+toQ5LsXhQR8ZOtFM/EsjCkJrYIg2HAcutSo07VxiQEgRMBV1izU94kQwQCLe9smg9bbXHnyggHeo3+/nRMoT4fXkebDZ7R7BeeZ1+0gD4FsEzNMYimV62UlnuKFqs5syRNtMup1oHfXQek4frM96vb+HhuF43trfM6pV3mvhjeqNl9XCd0bLu0TZg0xs/lg6FEIdjpcg7NuY1hS9tvwFH8KYJLYQyDgwFEZXS3n+CBI8fCNXRSzKmUXX9LHog2nnIWU5t39rFYeTNOoOL9G0ln/MrEITjqJGf1oDv7i5Hm5V4kSbXrFpPz1pTZLoUCzYh+YAxkH/A9XwhciXDogq8coNupjuNux4DAIfxi1KJKyskY080xrRwYoxAUZCdl0olIm37MSIL/W1KBez9kZE18Hw5lTW3dAcNGJJtXU2ixV1oNRh5RZzxHeoSokiHaPFpV4R9eFFjMVhKDmYjBKWDEMSo3eQP+faP6Vle11LuF2jIldVkMZc93vOzB/YlyR04POhCxKITuQQsb6VXmMAv6xCZ+c4BBkfXASVplsFfrexygKLiylUgqopXRlx9xfTU4kI59prAw2SJKI4skEj3cVit7FhKfGw8r41Niu5d7e6cuJh5RVrrBVpEJ64xF1pQG6W9UDCx3g35GvlYlaTvp6W2N72PQVv5goyYIDG/WjI5unxWeB38WkIy8mnxETw2/yuDeq/1Z5WKS66KJ/TM5ZFxptS0CXfqzuFJ9x/ucNFC3+U+MREcdH6Oy/DZ9EWPEmE3G+WM1s6bL/FFC76BrUtydUNjW0mJJn4PpMlxLDuqP2m34gcIGlTdUevjJEfW1RnZ+j9JlyPoAB6JxtfvuitdmJeVtKzQq37JS5AabfyTbXG/9fcl++3cVzp/q+n6KEVA5ABEAB3yHDMBRIZcxsucnwpBm4ADQoRNqMBSgzN/OYh7hPeJ7lnqaqu6q7qbkpOMplJRHR37adOnTrLd4x43UmgRxxlxXIZh6xlyL2U0fZyDjQRPGK7MIkIkt+jEBFL2ISHYngHA+SNiOl4/VDH8fQOIQmiWvT4Q+zxAiGWzLph88ihyWZWMOSxMjCe3N5aAmkiiTUa3PHZWxGc/KfwdxXLiRckXFgh2qp6Syu28RrBPfHFTcQglkwB92AqTn7yBLgPRg/eJ3/00estw8V0TBrohY8nDiukBZx9ungLW/D64vLoXVuFcl9fwv9+gZS7d310fICS8rUWm1srvEiJSZ0OcsTTcu3Hl2dvtHrrhfhSY20dYVqgMFaovDI59747rmfGqhqNiFHj1URI6gr02EEikha0Lmjx0T9QnO3LLe+f3urfOGfFy1Xvke7B5JfxWgSyw98vt5689umB9yiqXjloUwaYztl5+7SDSCgy+q//fpJ8J6izWhu8n6wILUCZa38yO58Iqc2YAsvZoV2RHJ18ZiHuvbWQsW0c4cAxCqkVXnxlT5/dT7OXVPr84myvrTL5mGTLYBZuaBsNkj6cLue9oNPdXEfalhfkT7X86DRG3QTP4WhgxWv90/vbzW7l//iVfwC1frfaAoJNhedwX+dbBVczhZWXGMO+8tKoy7jRI7THd/pKh+EHr4JABIdnJ+3VKvxcHfY7sx6i/cCJUJmRauHsoINYThRIv4eC0cm0H7QeMJ/a1DvqB3CyLYAVoiuKfHq5mIPUeTgNFz8FD/to5h1O7uRLkJcnwD+vhGq5vgGtXF4eIsIA6uf2L9pXP3KzmMFiBUEVsZ9wGrw3yCkBQcQjF+bQ6uLzAg81x0ds3eSPvv/+ey8xb9ri9Fov/xxHSAlSQJPmvRVn5wK40VdQC0NNa5UUi9AQKqBqnqF8u5sHM6/y5vNvbsyU7Hmw15fYS8+qiPejQk5DeaHg/YDjfnt0dXi91zm7vjq/vkokcNgfBf4ETtFIebSY+yCigLwVge0Mmp4/+uQ/hNrt7OvxduZjllXs5K4/ZyU8Om+EiQHsLdH6L/NPRDg36F859ucP/+pRjD+CAMKbU18tO9oWqbIMnjqfjiUqlVRPoSToUG+9MONJ4CpFSFYFf74YDvzeIlzNhQFkXhopaxdVt4rWjxiR6b2VuRShiAaYhbdT9FtqpSWI1Hy8yIcPaiCNNf6m+5sR8xH2/JE/j+tH2AoTjw/pL+NPQEhNfsV61f4g/iKRbK1pydyFrmeU9idE34FiwbhQOqxA+LV0W+OcYIVWAfOS3dRv5YPf4cF6SswgVUKJ6hrNlKAHpbeCOygVsSTfjakXI+2iKl17kRIjoIJTihw5yM2g1o//atzG++w1xMXcbjR2hIhYZrtYAJmb4YdYNiH8w+uOxF06BMHcfPNu1/r48uKd+diRvEh5oFjXzr5aaLeKfBpdiyXnTqDbaf6PTAv1Utoq95dqEXClSQXJtZWesdozPwy/aj2sd8bCf2Yqe6TifvZMIoewzSVUd9OsN27/vfMZ2WD+cnl26phKpgDJxWTntSBa6wxbByIGQWWxxQMyRH3pcNBWqXvF4h3esoXVGN+1L/bOLtsd3JTyUu3YiR/L3r2VduyE85FNn8CDPqLX1LbTyYaPl5uPpFNO2KHCKmqbUFWKZrUEunV/2VlOhr8tA5v6XtvgMCf9ZbwHqvANfoPto3cRl1LvSIWK78tezVjAxXTWoeNOxP0Vi/dl76NI1oNzRW3KWoQNukRK3GgoQOC1+GlpG3HMQnY37ApjtM0tU7qFDFYecTvxh6tFRLp49Wqt1Kw2Bk/e2+Heit0bpU3/YOZy5V9iuYCST8mw20GhqfPx+d3B3jSrdejJyRf1JJnwUiZSY1GTDC85nVbZJGJEwTNVSgsO7A5U6NgPT4dZJisyXgwIilaE50TQLzj2UvBA9ndnXkd3I9LOqUUniYewd2+cgoly6nicTUfDnkiYO59+4ir4IYc48d9E9vCe/VDYTJnpJUb5U7k4mdk4XxXfC9jjZxSEIVxIp8BgyQcIJGkU+ZfocP/kSg0gVlOL4NdGL56Vyp6aiKZhXM3ENNEj+Y1pFU9z1cC5RXnwnZ6M9+c/sst/Ql3DAsMvOjIjrLE+0fsC2UWRidhW6Fkt+cvFtCN7rjebx3syvWtkX0oQ139R/Eie2Dnb2GzkQfld5G5yZSZ1baaR/wA3sdhmUqlCxdvUXTX2/44OQOrIeIQu3xToaeFWH4Oo7KmUReLkn6aTIT0oGe51WfOn9kQM2iLhfhcuZzPqeGc670wwe6XEHUrfixJqPjZXTEMtygHO4y3lyjatqqGJ69wzYmzY4tmlEzVXPdPxcIGDSVRD/tnYLa6x5FW8ei1n34b9joDNx7GZTFO+IzUl7B7r1pRTUcoiX3ty3ua/m2I41xHmd6GMQ0hDaE7Vg1joBwcW5wCMAjrzBzBJwXw8DEOJCyWeRvhKsfeT4FMgoXPs5CgO3C/Nfevw3HVE0P4UPIi/dheL+bC7XATZXrzC66Iy7SottiHnAOOFBaMU50JBxE8q4QeftEMGcjqI/PPhjDU87gKm3scm6HWnFMZwE+t44ZtvvHOl35JxKVK/pUGIa5qu+OoXEk8GKxWYWh+xlf0hiH2/PnKPn359vWL7drxcMDA64l/h55rcZiqFiUhA1prNp/fBBEjEUaMYyGAeUH26iKvXbYdXBjqBer0oLQ4hRsf7Zcdf1lycqXewD2FMYUYNFgjieEVpw+wTgjY5JzraMFG3Y3UDSVkLITx4rm5Mu3jAhI62DdTXXPXtnh81I3cbs1IbwGes0rLwQU4pyUZKWzk8GdMLCmDIXCP5OehmjkSHvXzeSCLMyWeOxIS4zDWSfkDJjCroOsVbI7HcdlOpjdjw5ptelFRgvBHtJDep9IfhxyguXsU9xLvljHCQvCS6t9GG1YSn7Jok8tVRO0HZHgd0ZlZBrq+JwssJiBfT0T26dJEHz9FBju5cn/50evbzKXvVJHskBcHsii7af+GczM/gQiJiwDPjoBxMwQwccCyFjBdn40d6Ra546+QcUJ3fcTj1s+vkIOx4pVEosB4ikFG3JTA5z2wTDC2aF/nKrVQmONFJ/Ylb2+Bs4JjCWIUrEGFZ61vL0oRdhnXWf86S/+V/Hyvcc5KWPU1icrTkuuxlkWYo5uwTrM70k/OM5Jn6Gdbj7Gc7SVobQTcAfVQi4CvJIdHcDwtxefUW6AkzFe23Ly/bl89o6lxPI7OYTkecx8LvDkfDxUO8PcPN4urs7Pg5Tb3jtVG5b1z8VaxJPAFTzpYKqiFyRdMCaSZ9QYOrkg34sxmQfDRWPeYFNiGHXxsEyzBJizmIt8s5vNQoLPT67BwHktNwAO1Jikf/6+XiAxwA/wgk4VQLln63Py8CYniioMyoI3qmfOE0RkZtRYwRPwNx783ZxQl8Zm3kQrrueXjcifiT1S5a6Cs9H+5mRvRKvGmLGx4Ktug7J2cFTgO10ZSmcR6g4O6R5A//Ysi6tIdjLzMvAIVXr45R4od9MQ78kFqRSYjgxA4RLTFsvnplFLxNVfyzov6muZ0Ih8OrjTTeIOEC50DHz1+9//c//1fKGmiLevp1JRZ2IJILWOpD17qbAtJwNJID3aFWirwwhltLUB/3Xfrnlj3KfASj4BZvmpvWoL7kSGQNN836zq1tSOIJ1g/fbNZuk6NEa0TeMUbiFFqxuGjqENFaiPqOKba/kXNUUCjP8ijTXFbvJZfnyxp87+iyUM4467X3Vvcun34qe8EECbrjh73hUCobDOVDCWaillgJs9NXiFlE6ba8WTBHv2WMe1EXOhS2gUeszubLCc6yXJZVGSgqNLhlhTfiUcIw5F7SubdCHFDeravGjChVwjAMl0GF9311DExaTzyG/nbVv0+HkyJ2vsTpz9AZJeaeYrrXx92Jzpfd0TD8oDsSJZOP2TyJgsm9vkJvD+EM+6l92vRePj5iarEPy251Mf0I9xENkf8PSFoG/AZnhTyPgwm65u9eXx2eYaBm5+jy8rrdOb0+2WtfrHgVmLnZNPIIu2jD6X6ESLj4DietQudRzO0sNumaA9aSpAaftDHh6nKGZqyKZL0/3q+nTxgahvUZ4/nP5b9U0eYUpgvj3Iw0B8hSm94znaKM7Yw+6nRvrAzQs6zJUr3hI7pAV0usEYbV9HZqseR684A0hZVRcB/AEtcoylU4//OwecBHIh5AWJxUdoRILMCJQomT9hAmVZDB1lxLEPTDJm26OQz2hZzvHyqiQ2KeAoyvp8haUuXSqnYE0RS8b7+1fF2lj6qT5biLOOctb31zbcvxqaipyqo7aECbdDlsaVWrqDGCuDCHUgjWPylk1AzUNq9izvoJ1i9XHyg6HJJ2lnJRZ9TBshJww3DaG7Jcin2FW2j7Itm+jzfr5zS2mA/v7gIE7OrkL0sLWJXrV5XQCNCtcEmYzKwZBToPKyiILbvLyWJZaaxXa7zDBCpEZTycLBe4I+sb9FxTV8t9hq3APIRNUpaKh7TK8Ih46QvxGa9MT9mu7+bT5czYniiYwYqCOFkh9SlqeGUzaJIeVYbopD1FuwnUPvAjv3YQAJdA+mP/84sY69Q5j76D45RTESQ1VDG/6LNMVxb2WWa+K3H0zvc7yoU5YhUxN2d7EfmRWQxdsDOL4UdmsZ/aeOU4Otm9+MVdDD5KloK2zk4PUstBxSA1t+3l3+weH+Ol1yz+7vzS3iTN5Juj07ftC6j2NHus8QKyOhByZor84kcGWWuAdH+s1/sbO5s1f62xubVR629sr23XtraDtc3eYG27u73hDza3thqbDefhAZcC46QFWjSPBErsWekHMzwZdF49QyNcCFc/EPuRowOZSmKNexrDfVxYCiLqI6MB3dyGkyGWxgsOUGkwnC3+07JBHtdkw1m+cBk/hKKBNj2hr3uNoh+pCymGE72yZX5v73SqtBcKvlDJjEG/Wkh64ifEC2fnHlfQNy3orzRpecorrG5eaa6Inq2UV0TC2Atu2fgUe7Ur78ryzZOtR2rMBBK4kjCHdYC6MFAFZC9/NvRWiLevvnxMyFVPq3jwDIF/IZWglPX337wCEmchGbAS1S1iVLRA3FiASvL7ViTWUbrZb79N+eLns4uf3hyf/Zz2aSy77SFClyWy2HLQJS6Dkj8xqLwzm1PcX4754bMH3tmF1ic5ZzdVaqUsT/Kw/MEPiyszOIM68wDOk3CxUrr1fvd+XIT3hohPc0WFaWRkEaAhy5qi2cZAIHpFQ6DPiUjMYReL0Vi/9xpweTJDRCgSYyXK/dsyJlcPyWifvkvL9m0UixOpaVVNREVcsD5eC+tAGz6yqdlwMoGfwPm9IUcLPfyBLAckoHGx9CjUW/ewS+orr+nfx/tv8H/+9Keb/1L5F29fPa08qfd/oo++eaV/wO9NeJV7eKKzduRAuB2xbUwQGJcEKi8P2m92r4+v6OmTGSuGUmW8sC4TVGLfozdK/HtdGKg0GrESMvrb2kXLERtvkQgYxyh2pj4YGdD8KKFY/Ani0cHU4/pKIE9ku982XiNE0MKr18zZkzHEOBGCGfCf1JhtPoyPomC6zm0UVdep3D7Wymt1Ylx6B88VPWrXA1ze3nCGiXpDj0RWuOQgnAc7J5jdrye6v/ISF8XcxtAq9LJYxDc/tChEFf/8voXYgRulEvaJ62vEK5PrxRXCBibgkWTAoDEs3lR0Fg6g98GcUwYPUTv523I4D2KjWDNH0Z8SytFwRolN7+hu6fkU8HS/Dn06xgjmg7OT3aNTFXqrshLDGaYlO7XEikdBZnHq4Vi7qPUVu/SgIrFWUkSJ3ofxtO9t1WpGAV39KoUGVD4Bk4hFyiPVcgAlcQ1x1rZc8WGzZfeF6WdLuV3fzwsejolrYsbJNZkOv9zbTeqt7T3PWRuOnr8VoenK70GvH/qV38OPlVLEnGkvCF8aE4AeuodLOf64CMazWOQ+1gdTcAcnUeXBq5x7hQJHwslKsdNQQQIF4FHFzOHb16plk5jMBkby8+QZIj6raBQbDyv0jBa1F08m2lEnHE0X9jWd+594QX2v6/Ws0AzwieRk1sn09al87XXNnz3nRCdCQbEdnAbf/E4nTHqLyxpNto9k3yXAg2jSa/FJNw+pR2hrdfX9+8kqBQI/cbvd1Ha7f0C7NMQkyNgPVIlBT9BUrP3eF7Wf+nU9g2TkEaNfjPGIITaW/CS6Bad8pK664ptHS9j7qbjCaAISFMe5vEdhllCYQoH4s1Tc26yIGPm6MUAzhHFi0imdxQ5aZamsQ/C6rVrMtuQv8Hu8dXp1r+GtJSBOmrS+2CI0wz+oMSvbwc8wL3u9xsydD08pYhgcR50qqnp5vtiQSEL1kQNzxALYgqE9ieHQuGc4UwkICvickqubDK4CnNpjiLDYAIyTsoEnpRVLRR3+g9kK+oDrUgDzJXtPfnBMtQI/ETMSx7EU01qZquKuenhuUSigA6nnVaMiaiycMlnOuklMcDh04a+Pr038Bi/+E641ks6gtjWPZaRwFARIJOJVHLsnIYhpLatemScXU4gcw2uLAIWbT4quIsemDO8GrkI4L4YstWFypPG9PqmOIPIk+4qvky4gZFbCdz6lYmyJzZRy2dNK4PWhJbZhSok88BBcyb8TGYIHakJBFJJXRKBMtNgCHQPPrSyBZCvBb3iWCGwg4Qqv4eUIysAGUTfQOfspE3ECuQJq+N0gC1pt6YXjVsE5OmgHSSON0BVhUBFc7WB+7zV8uq+/TuvIoBfXp+jcddU+OXeqw6dzBEMRiJnnR6e25Nh+aMlu/QH6OBp2vwiZAOE043ACDEvA6B26/a0jet4RirqONMRBv6UvOXn1GziAqPaLOlllTl+ElkrVD8HnPmGnFTn51Wa33qgP/H6jt7Zd87fXGxuDes/frDXWg/rWem29tjlobNa3Go2djV6jvhHU6t1uUBs0arWtze1efb1gCCkBxi/AhFVJC0YtJjEcJ2h9xo9GQ+BV/qgTgGhRRE9qTqbFgQ74m1xDoFK2kpnod/i+TG3thph8wRWHI/OVaEUXXO6U8jni+0UVw6JhNtp/PWfXmov2m8sC9YPECOoc3zbMsA8x0xycNuCcmfU6V7qcjYKiCCOil/QW/9It6rjwOiyvYaI3+oOZdQi2ezYXjbHJPoZ/h2Ss82V/wVzy2fsB6jkXsE+1Qp4tIF8sFrNqbzQEBvqHp5pH7rfInYL+wVJtLJUGbVsy831eaDtXPBn7E8xfosupl/uH7ZNdXItZr5piZqveG+hO+2cwo5eHVHC7Vmtsrvv17fpO129sbm/uBOvdrZ1+fbC5vbXe723UtrZ9f2e74XfX1tYG/f7Ozs5mY2ew2V3fqW3W1hL1op4DK/Y3ajtb2zu9BmzX7bWtjfparb9VG/SDnY2d+kZ3u+/7W5tr636iAqANLL+2s7W1U9uorW3vJD85O7vCb1bv/fkqzNTqrAfDHgVwcaoIl7rFg8CYC1d701G/YsBPNWDM9VqjoVeshSIYVfMhp39JPs8E00nJGUEudoDc6pvhsP3XeBEDrVP/FjMocHLxlrfuvfIw9ln8E/tq92L/8OgddqZhfmf/vH16hQ7k8Hm9hv/REb/OjukF0OA/ggkcbMViwZ8N0YPoU4DZ2VXoov73b5SEp9/l4L/+kF6Oh5PhNCt0q/DRH3z0Oc1Sv/9AIV/LRXf6ufJpOscJx8heWEp0Lxhpz8Y+/IWeFOpZRjvByEcPkTDw55gWCbt3xwmUozaNxjB4S99k5GUuXT1kksOiijVPhGgRCEM83lxoEmUMGd7rS007Xi99Yo37IjjreEeoKqO9s73IF/fyCv3zY+sqqAZH3T59e3RKfyl36rIMdb0slHMmOsF5jiIB9tDN/PQt/X3RpqgDxmXEbHfCeRf/jtySYzP+Y4zjmVOpudYiwqUlMa2cbHqLR2ZyRqD5o9N3Z/vcsVK+uP8HjHe0B/bFVsW5fFnABdbk32+Gn9GtlbSiFfRA6XuzD+iJh26zMulTIOvwcOrYnTVkTfxsKajKmvnbTlY8d3Cod/RkISU+o6wZQ8ijOphLEh/7n4fj5bjVePVqc61Sdy4SIXILWWsYEhw3Siw173sROI1/iMpo1a7ab9sXBUd6MiqR6BolxEIX5OJwMphaukJl6SUcox24xpQ9+WM4mUY/xiToyV9LSukhftzBDxcIk/hkMhpOPkYlhOuurJpE6kkYPeklnvjiSSkxQjSNRtGuBEBiyXFJt0QvYPctzCs8AbnoNYiWo9H0ExpufHSH6JEBHiSWMfYXFwVkz+6wD7dQjASoOhZSE2oZ/0RBQeNPAzRnlfAUZEjTL5hxOpnqWoJwcWlGkIGCN/XmraMHXIKE7NGoOBPw7l6R/GCr9D/VAkv0M0YpQrSr7J4YacehD2X8cda5OEDMQO93/qXqkA9Oz96cHR+f/ZyTuVCvoEOqY820PEFah2bknfucHuVl6yKpujuTukrR6v6E5o66bMsOGvgDfWqrz5za6DeFH5TTe5zRW8EFsE92Lr0HLDeVU2c1QAdAUjLwUel2h+lmcS0DxMXl1Ngj1Eq0lDSIw8PbcusNOjY4GSoQqKR88hglXCf8w74d4J/j9u6bzunuSTud8rlTlvVxLEf083TvGKRrtTw8ypz7ohsMOJMr1DXAu5Vz+dShv6hedo4uL9pvi1xYcm7mRtEz4ses6YQXKZuCDqOoHOeKaPH6wPxRHOnVL+dtSqJiTUeOzsAC7rhMt1XC0r+5LWO63phuxFo+NVvipg3+jzX2GCbghvsRR3Aia2FLNaiGJ/KrubOXmen/BnA0wkWgqF1GBEFjdkfMwodz4cRqy5sBkNTjLrQ4CV2NGpHUZHZqIqhEfGUpJV0hpae8LdO6ySsugU1S+4LACmlVISXJsBFnReaAWgnipWg1JRTxS9IIRQ/17VbK2B/ZVVFNzEAMJlAWwkdHSBuhYG6p8Cm8LPuHu6dvLUmsdIlOzLuuaFTrxRAW3YIIPMF5Rbw1HkH+lOkG048zd7xzDu85hXlLqS6AiaIbOcqPrVqCjzPPNeU5W149B7/sBwu4xIb5GaYoIARa8rOTvRNRjcxQERVD/5g5KsIsT7dqmHRcXCuj49q+NP6nsnSy7VCGgpZ5BiLnKIgPZPLn+ubathVr1QLFFlP0xl25GOmr9yEY++/YcIEnIetTLz+QRmK+nBwRhhH7rOJfEYBNbzj7EMzxjrXHCDYZwpRW4JL4O6UInywkZhJf6/YkGg4HKmtvrie9D/7kDruR1ZLQy2sl1DPpVEvqGhHIdSRDYFl7Qx+80+JGsxucDgZof7oQGsfCUxorMu95CHbH5BVIjD+kJbVK6QyHCtzElvGW1OazXjWh8EP9Z74aIzqg2iKNJnZVfMPkEb1HhWWuygU53Ro4ZnIoscU2PsquOrH01kbixEAfEcPNOd8iOyfbJ073L345R4PA/tnxgRH6izihR2+OgDnnqzdJkdyEkWsw50RY6DiqTMVA56wtTuBRTdCn3b3jo8vD3HUl+EBEQaiL15ZJ8gD6oL6TehRKpgsst310bhdTDM3MjWI+IHxqSuEcBXVWBYUlQGh2wTjPFC2LvlvlXTqiMeoXS7rPCWOXLxApYHZXMGpXt6Y4FmykFrn6EJDWdvZhjlo1TAxHKjU8hDGnFTarpHaMe53OhiBV2EBvgwfZVyn0FKKaC9oF1SX4ODQDlHUPL2/6yWlMT1k1XsqS940rEuX9Mi5I8olVGpAvc9+dOJBIEyHMBkl+2DTkBxkLRTBcqZILy3HxXaRNihJ4Wy3PTYua5IK5v6xtDtieLGWq+0GYrkZ4TDTUtHWsbJEPmpL60/a9vhebnn2Dit9tsd/VZxEDSGtBcqEmsiDcaeReh34pIXNXQjSlsPS0agRsyEj1VfIGnNHqoNOlD+CKKH4P5oznnavOI8I8S1Y6oC9KT2VPE1j7wf0Xi/WxtG6aNfoL3E10cJA/0OHkD7GuG4ZiNn0JXyK0t2jm9Orh1dV59CrBdPD60+PXxTAYDaxcCV9U0ZBOIKdoT6/yP0Xxa/dN5/r06K9l+fbybP+nzuXVRXv3pJRWXxVmSsTWUutV8SO9kOwvW39h9oX1l94WLNe72dCuao800owpAjWiDh8F7dUoHeQq3lr+DBTIKV/wpdx0mJ3TycWNxIqrjPSxajFAr4rbE3UR2dz5kV3BHUz6sylaXrRjyzoFOU+txEGDy1aUrZinjf5UnDh4GGCJ9lUHnbyu0F4Yb6KnKA86rVFogRzX0bMNOisWvbWR8+4cVVoVgWnFwtv2lZxCK7cPZ7CLA04xKgvDFUK+KKYdYPKjqgDfg7E3+CiMkAMdd2iShkRpUrhFTgPf2UH2ZaPkHwR3ZNRzabplatOt6tLhUJ337BR+qs0O89XkbpKgCawt0fwxktsLPui49CRotNQ2mcVSyEH6ZiqZFKpAvq6hMMMOwfy50GhR9KOUNd1UA8k6+MtwpMJ9aYHFY0BDlzRI6nyh3w+zpD2DXxRiWZixBrMLRweFVFtOpjUgt7UmjxVKyMtyolPygqTURiqnjvX+IPIC3zdY01TKusblUjXlVX1ouOA460gf0mKTY27I4UJbWr02PBLwPCmUhFOh6oGZaNnoT4424/WcIGz1ObLvUKvMStKF9JmiGHSh1uapchGhm8fkNvTxstzQVeQG5x6EZfE3zdxtybh0ce/oNo47P76B0yTVwyOEczwi2EJ2i0Fk3DepPJab+wJRVe2SOGdlqQKdzREXh9lR2ctmszr9Ch4GS4xzoLK1mKwNlXn8hL1Pd1LoCm30XDPVGi7mybzRhSh2U49QrVKIamODWVgaYRG3VKyypHybyNyZPFwjqxfnQLVa2xpwQscNbuSWNodJ7Y2W4YL+wmuMmOUQTX8fg0kobH7438enMuk+S+XkQZR9vik5MTEAAu3SlP+SKOQNyCKmI2jwgvihuOR12IGDEDescvtkOuEAQZqmP8BqS02hRLK5zgwr3SQpoB87e3BMHqTqCCLDFwweaZJnSKvjoP3uaN+uaBD2WqBUGCzbDixrLzFNSHbuQe+HeLgA4w09cdN2MSukTvyEsA8zvmUhSibmzXHq8MdCyJOen3/I3Op+TTAlNAK+NeTWaSWchyLXq+cukvPSAYJIUXfcwjuVZ+q+9Ldaa2jLT21LZoHTtgttS/SJ5+lAfpM2dQPP3c9mxkkc9wCKWnyuQJbfv1OeNHmdbZ4hniUW0PTWc5ilaRJK+qqlGYQTh0/Z62JmFuJ8VBXf8QTTc92hnC4Gfp42FRuBAt2MAjnEnMT5z1OSUiLLt8AYku6m+OIZI5PluvDsY+i98jbqjYzysBsiGiYTy/lbtCERUH2eKRAhaA4pX98fa43SM0hR1KtyY6AnRaFOJlyFriz7madeISao9IXmeevyKy2lVc2CRVQju16aWyj1gvocP5Ccuy3eJ2OUifasvSPp6UYviQn3ivETOUWMjn/6It9tP/+Zr9/EhW6ApUwXxcoIdZGxV5Pj6OCguvBhB7UghdRLeMzdlyt2ujehCFr1+/2sDzMYtcE0NXERUx2++EommYs5fv3d7xuCeut3GTAx9LpTYPaIOi3kdi9iPAIYPAxWv5f26bOjgx9Woy+q1gb2OSvBgwh/Xsx95CIEkKJSPjwAT0JoaoaxnM778CFIjujy5g8GCCk6XFSdTsK4i4hH3DEmsuAqX+nml0/us5KfQzmag6RyiAaErjkd6X7Cd6Np1x8V/sXSzhfJO8JX+A3cs0+nizcY++6MCImP0pKj9blztZiPDNvzXUdMX2R7Fg+eYYDOtCFjs6ZWXz4h4+sPpNFXBybqhi7OjlMPzJziTyT68KBKXzd90bxNw8XYR4ZQnQ37X2i3/1qScGTzfY4wZ4/toaU42b28al90zo+E687pVeqCSL1GTNCQbKj0r1fXkRev6AVrlwyiOr6m8bgV5zG+2VJDuqndOlgtM9ay+JflMvF3PtYLgi1/QZlPfRP39JksAJMnDD+LgBiSE+hwcskJUxojt35Dud2pfKl5G/VKD8oRr2Xe9+cZFeqon0Ml3WOtvINKOWhdOJNMFkX6AYfNemNnfWdzq7GzkUPdXLRPOq18UZGdTgKoZd7bvWx3TnYvfrKEiOF/EIO6h/KduJ20pKCJAmaaN0fMGyJQPhWkZoEnombp5SDEyIKSa+QL9SBVb6yCbZvQNmf8hJY3MW3PEN0uaAIKd/R3SuRZsuJYN9V8JDvKM5S/ZpVRBcqanntPT/JyLZShUr3D94Q/UtPNaSyUJVHEIsrkFnmDEK0Wmj5baGRd9D5ug1ENuaaNw2RTzdqD4Z2ZM1Yaa1B99fiUNgIurdthuDk4cd8cvU00NvK7AXmKCysYtXZMD/O0xsWTrR3v7rWPLy12V5GcriUa5vam8zuS6iKLbZVmsSq/t3gr3Mf63J7cc4dvbtM6DAVNA4YyQYTKBEEJR1gde19SQ2qfvkt0Q2XnvQnNBPc39VujGlL2GfGPcIU42f3L2UWrULp94WA4tLWjvC4iX2rTdK3k4V8CCyu4QyYKaia1DIHQJxq5fGDYYA7bf9V9TNQndDZg8K+zqWksffYZUhK0lXiEPjEgPy0p9p6zZeFzPn0EJrTTAb1AcRWI/YaZvY0Gd/U38abjL12Za4sFf9zfXCdYgPmY/1jb3hS/KTJg1ttcH5GNNVzbqX3O33XJ2U8EU8cDUqQirt1Sh/VUwhkOlknb/u1jvdzAE1irUy3bU4JfdjGL3OQulOnMFYuGm4NQSpF7UYJzyjwWUOBTB2uhovIvkVuOqpFNRPFu/P+JvUoRyWFASY/pZEbrmC25DnVVy93t8DdhRsrf3Eguajvkn88Hc/DCyALu4IesmRkFMX4Is1AVLldiQqpiru1SLea86XVERfQPkBD/OxGoHiZl2mJjnsFR/xCuGk2OjbPSuO4of4qVu1bnrI/FcPBMTotSoYXPssMkUCZG5IU2byDSK7PhXBqDXVpAdp5TBHlj+EXcMpJUWMz0y6ZJo7p0QjrBG022GwX7+qJshS7R3CVxPNAbjPTVHh7AZyBoLYYpXi9Gv7h+45jgR/HI/hyyPVWIHTWqwwdfUBlGMcvYZtkjhRZAFetfcCPqvZpfq1+kY25FKxoV8iv9iftCqC0CZgBnqVLcL1KNHUr1Qs0TuTGvlj4NZ9dXlyBZdtAbPt2VSSfrFHMyJZC39xe5eiHyLdI+uvhZuAJ1p9NRM90GSsVusMhtpipDHDNZ5u9capFpdl1Z9YgjLq0KcZYzK4vOck88gbOZbd1AVMhE5EN9D9BLsiyXUs3CEStTChpsmvZYWRAs1KPauFFvm7dW3Q30XWOP2Oux/7kYPSIpF5UaLCc4TR7R+S87JnmkdLWyemSzcCGLPBbwQANhSTvtgOxJNCGh1qixrMcu6KT+ZPWnFNJGxhk8m08xD2OVD0mWUax7DGGpEEold42iAOrTC46VoC1GTRoMkx6L4sYL8SzOTLPOH6QJ0cr3LW+7vtNQbl70WPLNMm5w+IL0EftnJ+dnl+LWl2U8EOYL5F3xGjM4BbJvG45MthKVPDXkjOiSg3TYmJnImElJUhNL2YpmsXfoc6gRvbbrRUZO7SXsw9ub2IWAY/42ndcHpe3ii6lwKkzM+DfeiUxBhyBRTcz7s88D8QQC3RwOrekCpSZKAL5ckAE9SqVEdvSQ491IlpYJyKoJeJQhyhJ3ZZX/wWoy1RdfmEuNqbUuZYrSXsdKkTBBc3Wyl90OHHYTlg2SJKfpQPhBWWEOvshiYA/UizkryY130X7TviAo3Ey3JblSaYfW1yvsn2vvkFRj6ZTShsgTATh6dPNUW+dIHATm3krRh/j9n9H+i1nBwrPlIhz2g/3pDDWX0W2WPkPAZdtX8qbrakJIB3QPwE6rC3FB0DxdL3GKQsq0PVnAR2ojuWpNlD3hqYOyYhKxAc7LKHb7uW9VyTqbwGHti40ucoBTnB/R7FNaJFz9S4CX6TxnKzgH8/9vi4czMEI5SmXcUfGHRQvIGiZlH4QyR7BURZdFTLFI2Y631eF8OqG0r8Rix2M6a4eTJEofO5cy+BiWX4U+yHCyebdAnqYfoPTIARuJwUL8nkOFEE1jI+0Ak+FBBLtB2JAnR6dvzhynO4O9E7gpo2wWoVN/OwnGu3Kamu/D74qc3qfkfdx7CR0XMCDVE1c/uFaMxYaTn3SOUT8Y99aFASg1pKxZg1oQylhgECUtBmJBWEK0XNL5OaGGaEaZmgIuhb/j2iESUchzKO5yEftQRhZpIUW8woW01REu97A+a42tze0ISdOxPrkihpxOIhU1HGhwI7MxTVzDtqrDsB/0QPQZudUfKXbPlIM3sSkMFyrcT/m2hybmjWP7ZHO9JD3/3MdcMXHOlYHzEU0dT6cflzN69iWDxysYdgp15V0dfrer+ScUUmpGwo3kSxAtHcc+XfN5/OjfKOg6o1r+6jbl1OYvLTihxHCLDLVSRqbutMuZhgguUbKFiUjNdw1V31hjOsArE48GJKswcUt2ZTICPpSj6AqJ65RdrwDYtVYr5EaMIhbxwSW7JlsYxtS3zhDiUpaylj2qdRMniZWsEqT76cV0ujjAqygSgw6Kna6Jk/ZH0S9TI0xQbtEwzGb3tVBNjv5NM4zzfHYIguXk3GJBTS5BpDq1Mz6yIaCvhLQaZ1cpAZIdy4p5q9HJT66XK1rHsjyiqLlG5juetneyTjXVkSJw9/zI2pY8b2442A2TDhRujVA31ciNauDWphgXoWSanUia9mECO6Z9H63ZlgC07FkWkNL2SabbNB7L9FczbvkXm4pj4/FooD/pbOBIT2HZSvd3o6kZCxRpcWl9jKmb7Dapp9JT5vgUULZ1hJQ3BwaY20SX2Z4Bxl2yY01fBJTYWeYXHaLyj/xYo2wClETYX0zHw14lnPiz8ANu75E/HFdTY93FPtM3GtuLMngaFkHLYQHkePTETImgTIfJXKulutRyFmdM80Fk+29xp/3fo8RIhgM8U59B60RTl8dnKHfUztfpI5KbQCHQWzeAutnReWDc9DJr1vDsm3aWiUIhMa34pcOp9jAA7poi4YeBV9j0pCAlgOmaKP9E4IXpED0S0q2JUP27Bx30pI5QCMQ9GPUFSSRBoRNIq9lM261KCP+N+4Dc51i00lT28mxxVczsDp3XMBibfykbKwp+kmOiExsyUbc+xZ/5PVaPPBbG2oVVOevJB7nc4OSwdif9A2Bvl7BvSEtDmgCEdRLiY0s/JZ/cniKSYHhO+G/n10kMvYQbXjIuXOSQlH5ymkhexpxlHaaO57jNwfSfXV+dX1/ZtZGoonFhcNrQNi3wlUm6Qn9MvGTtT/tBAoMSdWajgKJuiqL1CrSuFSh5v8MDOwKoJFQTmVNQoE5q5WcHF5gUWNbX2wrS6fLF0wA08abIYyyrcZcMlMkkYKbIIeSW7nNhR2oIkbHFib5zkq4gGIdWB306DIxQHmGaEsOCt2nraYRlqSn83uzCqZQX0zGioluc/PbFxRm6oB+ISOtoC0l/dTFUbOT6op2GAsGZLHKPT0F9mm3W9CHHwE35Z8pA3bfvJBIq/JnrXp5NaMbCpB5K2XXlAhaNliXFLRdPKU+BCEq2cJvujYuFkmi38nmrZUEJtAECuo9YEzvYhPszWZYVvs/tX2kehOUk5N4Th/nQUPJgmzq1SVyBtXsmYctP4+ioavWUCsei/6SkwOhzapnvrFnMngyHGoDV0KLf0INbl1a35n1vmUqB4yghHGSur+zJNGAgSY/PSK3GNJrDvI0BRWTxaomYab/diCWK9otas1RBgj+ywEPLF7RjNKLWYLSNuAY3XZtBDnpWMyZoUXkKlSnVTxqVOTuW6EIq6cjepNGO6nHgWkrVdXzwi2PJZndKTWPojNMWbHaXXCt8RsvEQSsiYEXEqnzFOkXRJbxQs7sb0YTwmEjZF/jtMN8JIN0r0pc3bUjPW2Homm1xlXZL7B8hcKauhtACGYrXOiWzCCbqJRmNtANPaNhszXeG/TQvbKUxpJqbmZpN+DxJLfyU6IXnsisnUcUslCmoIB0OVnfrL8dd7J80FSqpPaGlW91dKqXqRHyPVoFEQ+bf0r80mrr0mkVVaph01qGZE63BWmejD1IiNBKfZvnNcoFpyGKrJRKjHPmL6yM1ZvrWHUDxhUEU8Vaz5y/uPGWfxNhXeqK5tGsbpf2xtwMvdnZKsY2UCr7O9TB9W50eFeWQj5lGaS/semHBGtQNNJU5UKHk/hOPaQMqF5uEY80XONKkuc+U4+4x+f1dpK9MOcUXxuUC80yXF2YbNEE3sfm4zbvRRWlrdxwZDmQZe6fyX6Yj20LaQfYvXsAvX8TUQ5OnCM/Nsrde29ksZVL+TUTdt0kMQ8sndqjWLAVG+wJRyuxzLmrHeU+0l3l6ik+TG1i9oC1MXtLKMVq7AD5lJXDiam64htsodAg1Y5IlP4lWxadDy15IJQRzllKZpWpEieFlr97YLmXqIW8ijdqtI8+M+Umr5eiyTSFczlDxpk2zvY836RXeqkCK6KiJDBgvHLeGZCPJodzmmctII+meTOObluEmpXyknrJ2jmY6sWwdjlMZTrxkk6mxVdENnEL0yVsqzbGKkH37y/EsFNrGKoYl94MiursrZyvJYK3XKGcaWl01aGZj1txUtPy2yaykRqLG+ITGU1hY03G5cmyUk2lkEvUn/C50PHkLXrsJYm7AiyfqduJfx4Gp7cDCtmDLlDYw4rCcgsxrulGUnS73iSYcWCQ2rDgbHE4alIW1LQuCSzkBMBDHAIhH6Rsh7olmYrGHZrScI/jD7ZqeHIVhI7eAyyURQOMonQm3gEQjtuC4OA5wOZZT0Ez9GM+BmWgilgA04SSZcKFN+rIm6tStaOW4jSRpSbAosZOaUVcjpjYvqeuyq5AsWhNXA1FyeOO+VE6Kq+WkNJV45GxGzy6fOFnirLtsmH2MLOdoEXwfP4gUy7anRmchz51xvuRyhIQbe4chv1NdIh3uGyqbgc2t0p4wkU2+XDBm803g+MUT1BOosSuY4xvvlHzcQXobQjP/COxJ6cn5W6SlJ9ep8XSBUQJ9qLiaNsQUfwjl7CA9DCK/hqRtL91W63R0SHNpSK8xMhM2efaqMOkYoqKC++gpyVgxsK7MAGgUXKI6tXizqF7ZWk6llxfvo2nYZDQBx9Z5sstDAtJe3wEw8k4HXYs6HboJdzpjfzjpdArNF+kUru0XkJKxl/cYiyqCbeWjkvcDzIMAs3qGcV5V2bBW2ZBVJvTncww30CRIub9CDILxgZLCFsY5AhU1CxSSO1904Aobcl66hBxJwG2XdAtofx4uijWCdaA6NcMvdaZecgflNOJBORdwqU9G5IyjYMFeZHQOJvf6Yrw97Fyd/dQ+bXovHx+9u+Hiw7JbZae5p6c/MG7n5sZbeXm1e/EW5MnLw90Vr/VP728qb8l67eml9+238Mnbo6vD6z1MvwlnXvSVsDe/9AzHVaq0ePcBvQ29lXkAl5TVl4+yijacYEcoIz9R5MBwEa4iNa54lcrff/MKmJm7UFpBOjV7ZjSBg/pON9mL9ENeY72GZnmvAi2/PDw7aa9W4efqsN+Z9dAntg/tzOAVnFUgyp1dXMHvqbeHql00iLYeghAfHCmXTNTKyKeXizncyjBL5U/Bwz76bg4nd/KlSIx0JfIg1TeglcvLw841nE5wmu5ftK9+5GYP4QhfiR16K7MHYHSTNa+y51WOgIQK2uAL8MtYgcIKXJKeFWxlthaP1Iq2e4WPCErRsuI1sj/ks2RFXxvlFdF6+ec4IeprFvQ+TL0VnCO+urReRkVXOJxMjBoEZr0FvPUSC2t9NZ0luoPyFaWhbb1UzVg6E9vqe0uEiSfPyL7GPGXy5T9wxyo6ScbPyQulzvnHM2B+lEcn+XSqw8GBzDUmmWE07MoPzs1obXIln/kUlfFYkCcKnvvGcUEjNk6n4HPQK4pQ6GIRa0WHVxGWd1PQCAwVG6t4+KcQc6FEIUMdFHMwpUfhe7+Hoo858yy+/ECma2gezwHVf/0EIHjolpfoFFyBDug6BXd6U4OjyUgpopACp/oiIUefPYs0ynGGeWbSvrPlFJKJJGFyxEHB6uvRiaSQsX+mt682D6vc9VcaN7t1SR1qgW4KUnYu3BZjSaDKzmrNNybDxKxDCI+pfRAxnoKJyxEXxOOzHwOL5UwxxlzLSSbkaybULxZX8Pbz3gQOCpfjsU8xL4VvvoFTyR7zC/14D/9XsBT8Dkpe0WWk6f2KERuuKcXGf31NHmfxz2Lzi19W09q7pK3R9F69wpqkeKU80KD4q1dV71Io6r1PwTwgQ68IiXztSQczT/kXkAlSs+pUzdaVFMdRPNHNoKTCM5nYNJE7aSDQx/B+8mb4GaYaefJyjvAO/UDMoByQ7qaIk+fqUyRZpje4yzrrValiFs0lyElzlHNQFlHSr2Z3ku2JUKTVc9YsX/73sbtFzWLwFS2eAF+aP6wOlCre3WCkZ/+qFkXMqIiadDenKb+f2Z40HMuanJbj2FRgh1YVBgjsZoq3ivfvEbiDQGKUNsay+ClNXlU0agNrR4JDE+R/Qf3KCPb0VbNHhlnv6CBclV4QHGY4oK0hbW9o3YLnc+oSo/6TcLQAMWuCPjzwbjEc+L1F1dtno61CTZmR2ZZNtDBxFYGG4ukZyKlqAvFfwBkGDKLqZj3vJ6dTGUda1tKPlwXcylIkB5CoK6w1iS5qc/q9mPvAWElwWi5QoQLch0AVMFd51bv6AL+F9OP1pwFH0/vyaPfEWc9qGJIEYj3Wjl3RecMmslmr1aynThgugwqHfFXHffPUERWVnJdWITMm8CR4XExLgeUWGxdshwOEW/7kP+jixH/oUgskD1fQygBEdl2KW43NFF4pXyNpmp41d4iEAB9SlDZS3crL3eurw7OLo6tfML3udbtzen2y177AmwReOrTrsbpz4LvutP9QQa6W1Q9dCh9GK7EExgOTSgd5uLqcoQhUkZvmx8Cvb24MtvubG93NYGuju7FeW1/fCXYa3fXt7c3B+tpmbWvg1xrpK4SRVc2YiN/0XOI3SpHa0sGqIDjzky6sEkBZLP2D7HO4mlLxKitHK3Atqy4+L76ggpj49SU1mAtjkFRlMqXFDCsD3BNCuWhcC5B34BT1YY6b3o6+W/HyA7semWVlFNwHQOCJbOb7o8CfI6lPgnkFkaT064xiPunrmWvzzMe8OezqkXyagZxqgWcpKZL6M7IXKz163wlvM9SWO9cUpN6iL6+P/3WXaEtq22LW5dN+udAuwaXkMaJBMQtBs2S4+GvvhQxeyo4CSTlGcNJe/H9n/6vc', 'base64'));
assert.equal(stoppedErrorsAfter.length, 183028);
assert.equal(createHash('sha256').update(stoppedErrorsAfter).digest('hex'),
  '177abf22e507e68a888b5b2233a82eed779d0b12ec759e8d08145f687de2b254');
const stoppedComposeKey = 'stopped-compose-label-errors-20261023';
const stoppedComposeOrigin = 'bab8d46b1c82d8c82faf1a51690cc19662f103f4';
// Exact public workflow fixture for the next diagnostic-only transition.
const stoppedComposeAfter = inflateSync(Buffer.from('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', 'base64'));
assert.equal(stoppedComposeAfter.length, 185937);
assert.equal(createHash('sha256').update(stoppedComposeAfter).digest('hex'),
  '50adc9a41e460f367396571c4f121fd54ff4552a48f52806ad2beca7b2af2ffc');
const stoppedReferenceKey = 'stopped-compose-reference-budget-20261023';
const stoppedReferenceOrigin = 'b5f8d55cef2034ebfa59effba367cf6c083ab42f';
// Exact public workflow fixture for the bounded aggregate-reference transition.
const stoppedReferenceAfter = inflateSync(Buffer.from('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', 'base64'));
assert.equal(stoppedReferenceAfter.length, 191427);
assert.equal(createHash('sha256').update(stoppedReferenceAfter).digest('hex'),
  '09ae88f0bfcf48b93e5f5dea5302d663d5dd5a709507503701014e4c17d27f5a');
function stoppedErrorsFixture(t, mutation = '', compose = false) {
  const reference = compose === 'references';
  const key = reference ? stoppedReferenceKey : compose ? stoppedComposeKey : stoppedErrorsKey;
  const origin = reference ? stoppedReferenceOrigin : compose ? stoppedComposeOrigin : stoppedErrorsOrigin;
  const candidate = reference ? stoppedReferenceAfter : compose ? stoppedComposeAfter : stoppedErrorsAfter;
  const c = fixture(t, stoppedInspectionBranch);
  const objectDir = git(process.cwd(), ['rev-parse', '--path-format=absolute', '--git-path', 'objects']);
  write(c.root, '.git/objects/info/alternates', objectDir + '\n');
  const before = reference ? stoppedComposeAfter.toString('utf8') : compose ? stoppedErrorsAfter.toString('utf8') :
    git(process.cwd(), ['show', stoppedErrorsOrigin + ':' + stoppedInspectionWorkflow]) + '\n';
  const helper = git(process.cwd(), ['show', origin + ':' + stoppedInspectionTest]) + '\n';
  const purpose = { owner: 'ACCOUNT_1_CORE', ownerDecision: '#5469#issuecomment-6354447020',
    authorityBaseExactMain: origin,
    sourceBeforeBlob: reference ? 'e1ab7a02bc7a1f7db106077128821a563d6ef689' : compose ? '274708ec5cff763ffeccd0137c3048346b720b05' : '18401c26bc8f91bb4d47d084bea8edec6fd33675',
    sourceAfterBlob: reference ? '03dbdc1d5e9a97687ddd7713e896fb3094f0f8a0' : compose ? 'e1ab7a02bc7a1f7db106077128821a563d6ef689' : '274708ec5cff763ffeccd0137c3048346b720b05', productionAcceptance: false };
  const state = { allowedCurrentScope: ['README.md'], approvedConcurrentScopes: {
    [stoppedInspectionBranch]: [stoppedInspectionWorkflow, stoppedInspectionTest],
  }, coordinationAdmissions: {
    [stoppedInspectionKey]: { owner: 'ACCOUNT_1_CORE', ownerDecision: '#5469#issuecomment-6354447020',
      productionAcceptance: false, authorityBaseExactMain: stoppedInspectionOrigin },
    [stoppedErrorsKey]: compose ? { owner: 'ACCOUNT_1_CORE',
      ownerDecision: '#5469#issuecomment-6354447020', authorityBaseExactMain: stoppedErrorsOrigin,
      sourceBeforeBlob: '18401c26bc8f91bb4d47d084bea8edec6fd33675',
      sourceAfterBlob: '274708ec5cff763ffeccd0137c3048346b720b05', productionAcceptance: false } : purpose,
    ...(compose ? { [stoppedComposeKey]: reference ? { owner: 'ACCOUNT_1_CORE',
      ownerDecision: '#5469#issuecomment-6354447020', authorityBaseExactMain: stoppedComposeOrigin,
      sourceBeforeBlob: '274708ec5cff763ffeccd0137c3048346b720b05',
      sourceAfterBlob: 'e1ab7a02bc7a1f7db106077128821a563d6ef689', productionAcceptance: false } : purpose } : {}),
    ...(reference ? { [stoppedReferenceKey]: purpose } : {}),
  } };
  if (mutation === 'wrong owner') purpose.owner = 'ACCOUNT_2_PRODUCT';
  if (mutation === 'wrong decision') purpose.ownerDecision = '#5469#issuecomment-0';
  if (mutation === 'wrong origin') purpose.authorityBaseExactMain = stoppedInspectionOrigin;
  if (mutation === 'malformed origin') purpose.authorityBaseExactMain = 'main';
  if (mutation === 'wrong before pin') purpose.sourceBeforeBlob = 'a'.repeat(40);
  if (mutation === 'wrong after pin') purpose.sourceAfterBlob = 'a'.repeat(40);
  if (mutation === 'production credit') purpose.productionAcceptance = true;
  if (mutation === 'extra purpose field') purpose.override = true;
  if (mutation === 'widened vector') state.approvedConcurrentScopes[stoppedInspectionBranch].push('README.md');
  if (mutation === 'narrowed vector') state.approvedConcurrentScopes[stoppedInspectionBranch].pop();
  if (['missing accepted purpose', 'candidate-only purpose'].includes(mutation)) delete state.coordinationAdmissions[key];
  if (compose && mutation === 'missing prior purpose') delete state.coordinationAdmissions[stoppedErrorsKey];
  if (compose && mutation === 'changed prior purpose') state.coordinationAdmissions[stoppedErrorsKey].sourceAfterBlob = 'a'.repeat(40);
  if (compose && mutation === 'prior production credit') state.coordinationAdmissions[stoppedErrorsKey].productionAcceptance = true;
  if (reference && mutation === 'missing prior compose') delete state.coordinationAdmissions[stoppedComposeKey];
  if (reference && mutation === 'changed prior compose') state.coordinationAdmissions[stoppedComposeKey].sourceAfterBlob = 'a'.repeat(40);
  if (reference && mutation === 'wrong prior compose owner') state.coordinationAdmissions[stoppedComposeKey].owner = 'ACCOUNT_2_PRODUCT';
  if (reference && mutation === 'wrong prior compose decision') state.coordinationAdmissions[stoppedComposeKey].ownerDecision = '#5469#issuecomment-0';
  if (reference && mutation === 'extra prior compose field') state.coordinationAdmissions[stoppedComposeKey].override = true;
  if (reference && mutation === 'prior compose production credit') state.coordinationAdmissions[stoppedComposeKey].productionAcceptance = true;
  write(c.root, stoppedInspectionState, JSON.stringify(state) + '\n');
  write(c.root, stoppedInspectionWorkflow, before + (mutation === 'wrong accepted workflow' ? '# extra\n' : ''));
  write(c.root, stoppedInspectionTest, helper + (mutation === 'wrong accepted helper' ? '# extra\n' : ''));
  git(c.root, ['add', '--all']);
  const tree = git(c.root, ['write-tree']);
  c.baseline = git(c.root, ['commit-tree', tree,
    ...(mutation === 'unrelated accepted base' ? [] : ['-p', origin]), '-m', 'accepted fixed error purpose']);
  git(c.root, ['update-ref', 'HEAD', c.baseline]);
  if (mutation !== 'missing workflow') write(c.root, stoppedInspectionWorkflow, candidate);
  if (mutation === 'wrong candidate workflow') fs.appendFileSync(path.join(c.root, stoppedInspectionWorkflow), '# extra\n');
  if (['missing workflow', 'helper mutation'].includes(mutation)) fs.appendFileSync(path.join(c.root, stoppedInspectionTest), '# extra\n');
  if (mutation === 'extra source') write(c.root, 'README.md', 'not admitted\n');
  if (mutation === 'state mutation') state.allowedCurrentScope.push('**');
  if (mutation === 'candidate-only purpose') state.coordinationAdmissions[key] = purpose;
  if (['state mutation', 'candidate-only purpose'].includes(mutation)) write(c.root, stoppedInspectionState, JSON.stringify(state) + '\n');
  if (mutation === 'state whitespace') fs.appendFileSync(path.join(c.root, stoppedInspectionState), '\n');
  if (mutation === 'workflow executable') fs.chmodSync(path.join(c.root, stoppedInspectionWorkflow), 0o755);
  if (mutation === 'state executable') fs.chmodSync(path.join(c.root, stoppedInspectionState), 0o755);
  if (mutation === 'helper executable') fs.chmodSync(path.join(c.root, stoppedInspectionTest), 0o755);
  if (mutation === 'workflow symlink') {
    fs.unlinkSync(path.join(c.root, stoppedInspectionWorkflow));
    fs.symlinkSync('README.md', path.join(c.root, stoppedInspectionWorkflow));
  }
  if (mutation === 'poisoned guard') write(c.root, 'scripts/p7-autopilot-guard.sh', '#!/bin/sh\nexit 0\n');
  if (mutation === 'workflow deletion') fs.unlinkSync(path.join(c.root, stoppedInspectionWorkflow));
  if (mutation === 'workflow rename') fs.renameSync(path.join(c.root, stoppedInspectionWorkflow), path.join(c.root, 'renamed-workflow.yml'));
  for (const [kind, file] of [['state symlink', stoppedInspectionState], ['helper symlink', stoppedInspectionTest]]) {
    if (mutation === kind) {
      fs.unlinkSync(path.join(c.root, file));
      fs.symlinkSync(path.join(c.root, kind === 'state symlink' ? stoppedInspectionTest : stoppedInspectionWorkflow), path.join(c.root, file));
    }
  }
  return c;
}
function checkStoppedErrors(c, accepted = false) {
  commit(c.root, 'candidate fixed failure classification');
  const result = runIndustrialTrustedGuard(c);
  if (accepted) assert.equal(result.status, 0, output(result));
  else {
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /STOPPED_INSPECTION_(?:ERRORS_)?SCOPE_|Files outside current autopilot scope|Mutable scope authority changed/u);
  }
}
test('stopped errors: accepts only the pinned one-workflow transition', t => checkStoppedErrors(stoppedErrorsFixture(t), true));
for (const mutation of ['wrong owner', 'wrong decision', 'wrong origin', 'malformed origin',
  'wrong before pin', 'wrong after pin', 'production credit', 'extra purpose field', 'widened vector',
  'narrowed vector', 'missing accepted purpose', 'candidate-only purpose', 'wrong accepted workflow',
  'wrong accepted helper', 'missing workflow', 'wrong candidate workflow', 'helper mutation',
  'extra source', 'state mutation', 'state whitespace', 'workflow executable', 'state executable',
  'helper executable', 'workflow symlink', 'poisoned guard', 'unrelated accepted base',
  'workflow deletion', 'workflow rename', 'state symlink', 'helper symlink']) {
  test('stopped errors: rejects ' + mutation, t => checkStoppedErrors(stoppedErrorsFixture(t, mutation)));
}
test('stopped errors: dirty correct workflow cannot rescue committed wrong bytes', t => {
  const c = stoppedErrorsFixture(t, 'wrong candidate workflow');
  commit(c.root, 'wrong committed workflow');
  write(c.root, stoppedInspectionWorkflow, stoppedErrorsAfter);
  const result = runIndustrialTrustedGuard(c);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /STOPPED_INSPECTION_ERRORS_SCOPE_EXACT_WORKFLOW/u);
});
test('stopped errors: rejects a head which skips the accepted base', t => {
  const c = stoppedErrorsFixture(t);
  git(c.root, ['add', '--all']);
  const tree = git(c.root, ['write-tree']);
  const head = git(c.root, ['commit-tree', tree, '-p', stoppedErrorsOrigin, '-m', 'head skips fixed error authority']);
  git(c.root, ['update-ref', 'HEAD', head]);
  const result = runIndustrialTrustedGuard(c);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /STOPPED_INSPECTION_ERRORS_SCOPE_ANCESTRY/u);
});

test('stopped compose errors: accepts only the pinned next workflow transition', t =>
  checkStoppedErrors(stoppedErrorsFixture(t, '', true), true));
for (const mutation of ['wrong owner', 'wrong decision', 'wrong origin', 'malformed origin',
  'wrong before pin', 'wrong after pin', 'production credit', 'extra purpose field', 'widened vector',
  'narrowed vector', 'missing accepted purpose', 'candidate-only purpose', 'wrong accepted workflow',
  'wrong accepted helper', 'missing workflow', 'wrong candidate workflow', 'helper mutation',
  'extra source', 'state mutation', 'state whitespace', 'workflow executable', 'state executable',
  'helper executable', 'workflow symlink', 'poisoned guard', 'unrelated accepted base',
  'workflow deletion', 'workflow rename', 'state symlink', 'helper symlink',
  'missing prior purpose', 'changed prior purpose', 'prior production credit']) {
  test('stopped compose errors: rejects ' + mutation, t =>
    checkStoppedErrors(stoppedErrorsFixture(t, mutation, true)));
}
test('stopped compose errors: dirty correct workflow cannot rescue committed wrong bytes', t => {
  const c = stoppedErrorsFixture(t, 'wrong candidate workflow', true);
  commit(c.root, 'wrong committed workflow');
  write(c.root, stoppedInspectionWorkflow, stoppedComposeAfter);
  const result = runIndustrialTrustedGuard(c);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /STOPPED_INSPECTION_ERRORS_SCOPE_/u);
});
test('stopped compose errors: head must descend from the exact accepted base', t => {
  const c = stoppedErrorsFixture(t, '', true);
  git(c.root, ['add', '--all']);
  const tree = git(c.root, ['write-tree']);
  const head = git(c.root, ['commit-tree', tree, '-p', stoppedComposeOrigin, '-m', 'head skips accepted base']);
  git(c.root, ['update-ref', 'HEAD', head]);
  const result = runIndustrialTrustedGuard(c);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /STOPPED_INSPECTION_ERRORS_SCOPE_ANCESTRY/u);
});

test('stopped references: accepts only the pinned aggregate-reference workflow transition', t =>
  checkStoppedErrors(stoppedErrorsFixture(t, '', 'references'), true));
for (const mutation of ['wrong owner', 'wrong decision', 'wrong origin', 'malformed origin',
  'wrong before pin', 'wrong after pin', 'production credit', 'extra purpose field', 'widened vector',
  'narrowed vector', 'missing accepted purpose', 'candidate-only purpose', 'wrong accepted workflow',
  'wrong accepted helper', 'missing workflow', 'wrong candidate workflow', 'helper mutation',
  'extra source', 'state mutation', 'state whitespace', 'workflow executable', 'state executable',
  'helper executable', 'workflow symlink', 'poisoned guard', 'unrelated accepted base',
  'workflow deletion', 'workflow rename', 'state symlink', 'helper symlink',
  'missing prior purpose', 'changed prior purpose', 'prior production credit',
  'missing prior compose', 'changed prior compose', 'wrong prior compose owner',
  'wrong prior compose decision', 'extra prior compose field', 'prior compose production credit']) {
  test('stopped references: rejects ' + mutation, t =>
    checkStoppedErrors(stoppedErrorsFixture(t, mutation, 'references')));
}
test('stopped references: dirty correct workflow cannot rescue committed wrong bytes', t => {
  const c = stoppedErrorsFixture(t, 'wrong candidate workflow', 'references');
  commit(c.root, 'wrong committed workflow');
  write(c.root, stoppedInspectionWorkflow, stoppedReferenceAfter);
  const result = runIndustrialTrustedGuard(c);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /STOPPED_INSPECTION_ERRORS_SCOPE_/u);
});
test('stopped references: head must descend from the exact accepted base', t => {
  const c = stoppedErrorsFixture(t, '', 'references');
  git(c.root, ['add', '--all']);
  const tree = git(c.root, ['write-tree']);
  const head = git(c.root, ['commit-tree', tree, '-p', stoppedReferenceOrigin, '-m', 'head skips accepted base']);
  git(c.root, ['update-ref', 'HEAD', head]);
  const result = runIndustrialTrustedGuard(c);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /STOPPED_INSPECTION_ERRORS_SCOPE_ANCESTRY/u);
});

// Differential reference is the immutable accepted guard before this process-
// consolidation change, not a candidate-controlled copy or cached decision.
const singleNodeReferenceGuard = acceptedBlob('530f10e9c42d71e66da575efa1f1568421324be1');
const singleNodeFinalMarker = 'SCOPE_RESULT=$(DIFF_FILES="$DIFF_FILES" ALLOWED_CURRENT="$ALLOWED_CURRENT" P7_EXACT_APPROVED_SCOPE="$P7_EXACT_APPROVED_SCOPE" node - <<\'JS\'\n';
const singleNodeProtocolMarker = '\n  # The producer\'s last nonempty line is an ASCII frame.';

function singleNodeFixture(t, item, { corruption = '', afterCapture = '' } = {}) {
  const context = fixture(t, item.generic ? 'analysis/generic-scope-differential' : implementationBranches[0]);
  const stateFile = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = JSON.parse(fs.readFileSync(path.join(context.root, stateFile), 'utf8'));
  state.approvedConcurrentScopes[context.implementationBranch] = item.scopes;
  write(context.root, stateFile, JSON.stringify(state) + '\n');
  fs.mkdirSync(path.join(context.root, 'docs/platform-v7/autopilot/scopes'), { recursive: true });
  git(context.root, ['config', 'core.quotePath', 'false']);
  for (const [file, content] of Object.entries(item.before || {})) write(context.root, file, content);
  commit(context.root, 'accepted differential source scope');
  context.baseline = git(context.root, ['rev-parse', 'HEAD']);
  for (const file of item.changes || []) write(context.root, file, 'candidate source\n');
  if (item.rename) git(context.root, ['mv', item.rename[0], item.rename[1]]);
  if (item.rawNameHex) fs.writeFileSync(Buffer.concat([Buffer.from(context.root + path.sep), Buffer.from(item.rawNameHex, 'hex')]), 'candidate source\n');
  if ((item.changes || []).length || item.rename || item.rawNameHex) commit(context.root, 'candidate differential source');
  let proposed = fs.readFileSync(sourceGuard, 'utf8');
  let reference = singleNodeReferenceGuard;
  if (corruption) {
    assert.equal(proposed.split(singleNodeProtocolMarker).length, 2);
    proposed = proposed.replace(singleNodeProtocolMarker, () => '\n' + corruption + singleNodeProtocolMarker);
  }
  if (afterCapture) {
    const marker = 'if [[ "$P7_EXACT_SCOPE_FRAME_ATTEMPTED" == 1 && "$P7_EXACT_SCOPE_FRAME_VALID" != 1 &&\n';
    assert.equal(proposed.split(marker).length, 2);
    proposed = proposed.replace(marker, () => afterCapture + '\n' + marker);
    assert.equal(reference.split(singleNodeFinalMarker).length, 2);
    reference = reference.replace(singleNodeFinalMarker, () => afterCapture + '\n' + singleNodeFinalMarker);
  }
  const candidate = path.join(context.root, '.git', 'proposed-differential-guard.sh');
  const before = path.join(context.root, '.git', 'accepted-differential-guard.sh');
  fs.writeFileSync(candidate, proposed);
  fs.writeFileSync(before, reference);
  return { ...context, candidate, before };
}

function singleNodeRun(context, file, traceFile) {
  const command = spawnSync('bash', [file], { cwd: context.root, encoding: 'utf8', env: {
    ...process.env, BASE_REF: context.baseline, HEAD_REF: 'HEAD',
    GITHUB_HEAD_REF: context.implementationBranch, ...(traceFile ? { PC_P7_NODE_TRACE: traceFile } : {}),
  } });
  return { status: command.status, stdout: command.stdout, stderr: command.stderr };
}
function singleNodeComparableStderr(value) {
  // Bash includes the script path and shifted source line in its NUL warning.
  // Compare the warning itself without treating this source-location metadata
  // as a change in authority, matching, diagnostic text or exit behavior.
  return value.replace(/^.*?: line [0-9]+: warning: command substitution:/gm, 'warning: command substitution:');
}
function singleNodeAssertSame(context) {
  const before = singleNodeRun(context, context.before);
  const after = singleNodeRun(context, context.candidate);
  assert.equal(after.status, before.status);
  assert.equal(after.stdout, before.stdout);
  assert.equal(singleNodeComparableStderr(after.stderr), singleNodeComparableStderr(before.stderr));
  return after;
}

const singleNodeCases = [
  { title: 'exact allow', scopes: ['allowed.txt'], changes: ['allowed.txt'], status: 0 },
  { title: 'exact deny', scopes: ['allowed.txt'], changes: ['outside.txt'], status: 1 },
  { title: 'single star allow', scopes: ['approved/*.ts'], changes: ['approved/one.ts'], status: 0 },
  { title: 'single star excludes descendants', scopes: ['approved/*.ts'], changes: ['approved/deep/one.ts'], status: 1 },
  { title: 'double star allows descendants', scopes: ['approved/**'], changes: ['approved/deep/one.ts'], status: 0 },
  { title: 'plain exact path is not a subtree', scopes: ['approved'], changes: ['approved/one.ts'], status: 1 },
  { title: 'regex metacharacters are literal', scopes: ['approved/[x]+(one).ts'], changes: ['approved/[x]+(one).ts'], status: 0 },
  { title: 'invalid UTF-8 Git filename uses the same env decoding', scopes: ['name\ufffd.txt'], rawNameHex: '6e616d65ff2e747874', status: 0 },
  { title: 'lone high surrogate scope uses stdout replacement', scopes: ['approved/\ud800.ts'], changes: ['approved/\ufffd.ts'], status: 0 },
  { title: 'lone low surrogate scope uses stdout replacement', scopes: ['approved/\udc00.ts'], changes: ['approved/\ufffd.ts'], status: 0 },
  { title: 'Unicode exact path', scopes: ['approved/пшеница-中文.ts'], changes: ['approved/пшеница-中文.ts'], status: 0 },
  { title: 'Unicode whitespace and trailing slash', scopes: ['\u00a0allowed.txt/\r\n'], changes: ['allowed.txt'], status: 0 },
  { title: 'embedded CRLF scope lines', scopes: ['allowed.txt\r\napproved/**'], changes: ['approved/deep.ts'], status: 0 },
  { title: 'embedded NUL scope bytes', scopes: ['allowed.\0txt'], changes: ['allowed.txt'], status: 0 },
  { title: 'NUL and final LF scope normalization', scopes: ['allowed.txt', '\0\n'], changes: ['allowed.txt'], status: 0 },
  { title: 'newline file name stays Git quoted', scopes: ['approved/**'], changes: ['approved/line\nname.ts'], status: 1 },
  { title: 'rename retains both accepted paths', scopes: ['allowed.txt', 'to.txt'], before: { 'allowed.txt': 'rename source\n' }, rename: ['allowed.txt', 'to.txt'], status: 0 },
  { title: 'rename rejects source outside scope', scopes: ['to.txt'], before: { 'allowed.txt': 'rename source\n' }, rename: ['allowed.txt', 'to.txt'], status: 1 },
  { title: 'forbidden error precedes scope denial', scopes: ['allowed.txt'], changes: ['apps/landing/unsafe.ts'], status: 1, diagnostic: 'Forbidden path changed' },
  { title: 'mutable authority precedes scope denial', scopes: ['allowed.txt'], changes: ['docs/platform-v7/autopilot/rejected.json'], status: 1, diagnostic: 'Mutable scope authority changed' },
  { title: 'generic branch keeps prefix matching', generic: true, scopes: ['approved'], changes: ['approved/one.ts'], status: 0 },
  { title: 'empty diff keeps the earlier shortcut', scopes: ['allowed.txt'], changes: [], status: 0 },
];
for (const item of singleNodeCases) {
  test('single-node scope: differential ' + item.title, (t) => {
    const result = singleNodeAssertSame(singleNodeFixture(t, item));
    assert.equal(result.status, item.status, result.stdout + result.stderr);
    if (item.diagnostic) assert.ok(result.stdout.includes(item.diagnostic), result.stdout);
  });
}

const singleNodeCorruptions = [
  ['missing footer', 'P7_EXACT_SCOPE_FRAME="${P7_EXACT_SCOPE_FRAME%$\'\\n\'*}"'],
  ['invalid footer prefix', 'P7_EXACT_SCOPE_FRAME="${P7_EXACT_SCOPE_FRAME/P7_EXACT_SCOPE_RESULT_HEX:/P7_BROKEN_SCOPE_RESULT_HEX:}"'],
  ['malformed hex digest', 'P7_EXACT_SCOPE_FRAME="${P7_EXACT_SCOPE_FRAME%?}z"'],
  ['NUL byte in hex result', 'P7_EXACT_SCOPE_FRAME="${P7_EXACT_SCOPE_FRAME/P7_EXACT_SCOPE_RESULT_HEX:6f/P7_EXACT_SCOPE_RESULT_HEX:00}"'],
  ['valid hex result spoof', 'P7_EXACT_SCOPE_FRAME="${P7_EXACT_SCOPE_FRAME/P7_EXACT_SCOPE_RESULT_HEX:6f/P7_EXACT_SCOPE_RESULT_HEX:70}"'],
];
for (const [title, corruption] of singleNodeCorruptions) {
  test('single-node scope: fails closed on ' + title, (t) => {
    const context = singleNodeFixture(t, { scopes: ['allowed.txt'], changes: ['outside.txt'] }, { corruption });
    const result = singleNodeRun(context, context.candidate);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(result.stdout.includes('P7_EXACT_SCOPE_FRAME_INVALID'), result.stdout + result.stderr);
    assert.equal(result.stdout.includes('Scope guard passed.'), false);
  });
}
test('single-node scope: forbidden error precedes a corrupt footer', (t) => {
  const context = singleNodeFixture(t, { scopes: ['allowed.txt'], changes: ['apps/landing/unsafe.ts'] },
    { corruption: singleNodeCorruptions[2][1] });
  const result = singleNodeRun(context, context.candidate);
  assert.equal(result.status, 1);
  assert.ok(result.stdout.includes('Forbidden path changed'), result.stdout);
  assert.equal(result.stdout.includes('P7_EXACT_SCOPE_FRAME_INVALID'), false);
});

for (const item of [
  { title: 'scope changes', scopes: ['allowed.txt'], changes: ['outside.txt'], afterCapture: "ALLOWED_CURRENT='outside.txt'" },
  { title: 'diff changes', scopes: ['allowed.txt'], changes: ['outside.txt'], afterCapture: "DIFF_FILES='allowed.txt'" },
  { title: 'matching mode changes', scopes: ['approved'], changes: ['approved/one.ts'], afterCapture: 'P7_EXACT_APPROVED_SCOPE=0' },
]) {
  test('single-node scope: runs original matcher when ' + item.title, (t) => {
    const context = singleNodeFixture(t, item, { afterCapture: item.afterCapture });
    const result = singleNodeAssertSame(context);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}

test('single-node scope: saves one real Node process without skipping the guard', (t) => {
  const context = singleNodeFixture(t, { scopes: ['allowed.txt'], changes: ['allowed.txt'] });
  const lookup = spawnSync('sh', ['-c', 'command -v node'], { encoding: 'utf8' });
  assert.equal(lookup.status, 0, output(lookup));
  const node = fs.realpathSync(lookup.stdout.trim());
  const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  const bin = path.join(context.root, '.git', 'trace-bin');
  const trace = path.join(context.root, '.git', 'node-processes.txt');
  write(context.root, '.git/trace-bin/node', '#!/bin/sh\nprintf \'node\\n\' >> "$PC_P7_NODE_TRACE"\nexec ' + quote(node) + ' "$@"\n', 0o755);
  const oldPath = process.env.PATH;
  try {
    process.env.PATH = bin + path.delimiter + oldPath;
    fs.writeFileSync(trace, '');
    const before = singleNodeRun(context, context.before, trace);
    const beforeCount = fs.readFileSync(trace, 'utf8').trim().split('\n').length;
    fs.writeFileSync(trace, '');
    const after = singleNodeRun(context, context.candidate, trace);
    const afterCount = fs.readFileSync(trace, 'utf8').trim().split('\n').length;
    assert.equal(before.status, 0, before.stdout + before.stderr);
    assert.equal(after.status, 0, after.stdout + after.stderr);
    assert.equal(after.stdout, before.stdout);
    assert.ok(beforeCount >= 2);
    assert.equal(afterCount, beforeCount - 1);
  } finally {
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
  }
});

for (const denied of [false, true]) {
  test('single-node scope: absent checksum utility retains original matcher ' + (denied ? 'deny' : 'allow'), t => {
    const context = singleNodeFixture(t, { scopes: ['allowed.txt'], changes: [denied ? 'outside.txt' : 'allowed.txt'] });
    const bin = path.join(context.root, '.git', 'without-checksum-bin');
    fs.mkdirSync(bin);
    for (const executable of ['bash', 'git', 'node', 'grep']) {
      const found = spawnSync('sh', ['-c', 'command -v "$1"', 'lookup', executable], { encoding: 'utf8' });
      assert.equal(found.status, 0, output(found));
      fs.symlinkSync(fs.realpathSync(found.stdout.trim()), path.join(bin, executable));
    }
    const oldPath = process.env.PATH;
    try {
      process.env.PATH = bin;
      const absent = spawnSync('bash', ['-c', 'command -v sha256sum'], { encoding: 'utf8' });
      assert.notEqual(absent.status, 0);
      const result = singleNodeAssertSame(context);
      assert.equal(result.status, denied ? 1 : 0, result.stdout + result.stderr);
    } finally {
      if (oldPath === undefined) delete process.env.PATH;
      else process.env.PATH = oldPath;
    }
  });
}

test('single-node scope: long denied result decodes every byte across chunks', t => {
  const context = singleNodeFixture(t, {
    scopes: ['allowed.txt'],
    changes: Array.from({ length: 180 }, (_, index) => 'outside/file-' + String(index).padStart(3, '0') + '-' + 'x'.repeat(70) + '.ts'),
  });
  const result = singleNodeAssertSame(context);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok(Buffer.byteLength(result.stdout) > 15000);
});

test('single-node scope: truncated raw diff pipe fails closed after authority checks', t => {
  const context = singleNodeFixture(t, { scopes: ['allowed.txt'], changes: ['outside.txt'] });
  const source = fs.readFileSync(context.candidate, 'utf8');
  const marker = "3< <(printf '%s' \"$DIFF_FILES\" 2>/dev/null)";
  assert.equal(source.split(marker).length, 2);
  fs.writeFileSync(context.candidate, source.replace(marker, '3< /dev/null'));
  const result = singleNodeRun(context, context.candidate);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok(result.stdout.includes('P7_EXACT_SCOPE_FRAME_INVALID'), result.stdout + result.stderr);
});

test('single-node scope: decoder and byte count retain the caller locale', t => {
  const afterCapture = `if [[ "\${LC_ALL-}" != 'C.UTF-8' ]]; then echo 'LOCALE_CHANGED'; exit 1; fi`;
  const context = singleNodeFixture(t, { scopes: ['allowed.txt'], changes: ['allowed.txt'] }, { afterCapture });
  const oldLocale = process.env.LC_ALL;
  try {
    process.env.LC_ALL = 'C.UTF-8';
    const result = singleNodeAssertSame(context);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    if (oldLocale === undefined) delete process.env.LC_ALL;
    else process.env.LC_ALL = oldLocale;
  }
});

// Separate current phase; retained historical headroom fixtures remain unchanged.
const liveHeadroomMarker = '\n## PC-CROP live Docker headroom clean fixture correction v4 — 2026-10-30\n\n```json\n';
function liveHeadroomPurpose() {
  const parts = fs.readFileSync('docs/platform-v7/execution-queue.md', 'utf8').split(liveHeadroomMarker);
  assert.equal(parts.length, 2);
  return JSON.parse(parts[1].slice(0, parts[1].indexOf('\n```\n')));
}
function liveHeadroomFixture(t, mutate = () => {}, { ancestry = true, companionStage = false } = {}) {
  const original = liveHeadroomPurpose();
  const purpose = structuredClone(original);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-live-headroom-safety-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
  const state = { allowedCurrentScope: ['README.md', 'apps/api/src/main.ts'],
    approvedConcurrentScopes: { [headroomBranch]: [...purpose.originalScope], [purpose.companionBranch]: [...purpose.companionScope] } };
  mutate(purpose, state);
  const fromObject = sha => {
    const r = spawnSync('git', ['cat-file', 'blob', sha], { encoding: 'utf8', maxBuffer: 3 * 1024 * 1024 + 1 });
    assert.equal(r.status, 0, output(r)); return r.stdout;
  };
  for (const item of original.guardPayloads) write(root, item.path, fromObject(item.afterBlob), item.mode === '100755' ? 0o755 : 0o644);
  for (const item of original.sourcePayloads) write(root, item.path, fromObject(item.beforeBlob), item.mode === '100755' ? 0o755 : 0o644);
  for (const item of original.companionPayloads) write(root, item.path, fromObject(item.beforeBlob), 0o644);
  if (!companionStage) {
    // The prerequisite guard runs before these future companion bytes are tracked.
    // Reconstruct them from accepted metadata instead of unpublished Git objects.
    const applied = spawnSync('git', ['apply', '-'], { cwd: root, input: original.companionPatch.text,
      encoding: 'utf8', maxBuffer: 3 * 1024 * 1024 });
    assert.equal(applied.status, 0, output(applied));
    for (const item of original.companionPayloads) {
      const bytes = fs.readFileSync(path.join(root, item.path));
      assert.equal(bytes.length, item.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
    }
  }
  const manifest = original.originalScope[2];
  write(root, manifest, fromObject('deb7672c69db09ab0b233cf011e79a904bc5f1a7'), 0o644);
  write(root, 'scripts/p7-source-controlled-scope.mjs', fs.readFileSync(sourceResolver, 'utf8'), 0o644);
  write(root, statePath, JSON.stringify(state));
  write(root, 'docs/platform-v7/execution-queue.md', liveHeadroomMarker + JSON.stringify(purpose) + '\n```\n');
  write(root, 'README.md', 'unrelated protected source\n');
  git(root, ['init', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'Live headroom regression']);
  git(root, ['config', 'user.email', 'live-headroom@example.invalid']);
  const objectDir = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-path', 'objects'], { encoding: 'utf8' });
  assert.equal(objectDir.status, 0, output(objectDir));
  write(root, '.git/objects/info/alternates', objectDir.stdout.trim() + '\n');
  // The real accepted commit object remains exact. Bound this synthetic fixture
  // at that ancestor instead of importing unrelated pre-authority history.
  write(root, '.git/shallow', original.authorityBaseExactMain + '\n');
  git(root, ['add', '.']);
  const tree = git(root, ['write-tree']);
  const baseline = git(root, ['commit-tree', tree, ...(ancestry ? ['-p', original.authorityBaseExactMain] : []), '-m', 'accepted exact safety metadata']);
  git(root, ['update-ref', 'HEAD', baseline]);
  const implementationBranch = companionStage ? original.companionBranch : headroomBranch;
  git(root, ['switch', '-c', implementationBranch]);
  return { root, baseline, implementationBranch, companionStage };
}
function applyLiveHeadroom(c) {
  const r = spawnSync('git', ['apply', '--index', '-'], { cwd: c.root, input: (c.companionStage ? liveHeadroomPurpose().companionPatch : liveHeadroomPurpose().sourcePatch).text,
    encoding: 'utf8', maxBuffer: 3 * 1024 * 1024 });
  assert.equal(r.status, 0, output(r));
}
function checkLiveHeadroom(c, expected = 1) {
  git(c.root, ['add', '--all']);
  git(c.root, ['commit', '--allow-empty', '-m', 'current live cleanup source']);
  const r = runTrustedHeadroomGuard(c);
  assert.equal(r.status === 0 ? 0 : 1, expected, output(r));
  if (expected) assert.match(output(r), /PC_CROP_LIVE_HEADROOM_SAFETY_SCOPE_|PC_CROP_HEADROOM_SCOPE_|Mutable scope authority changed/u);
}
test('live headroom safety: exact two-source payload passes from accepted base', t => {
  const c = liveHeadroomFixture(t); applyLiveHeadroom(c); checkLiveHeadroom(c, 0);
});
for (const [name, mutate] of [
  ['wrong owner', p => { p.owner = 'ACCOUNT_2_PRODUCT'; }],
  ['wrong source branch', p => { p.sourceBranch = 'fix/other'; }],
  ['wrong guard branch', p => { p.guardBranch = 'governance/trusted-concurrent-scope-routing-guard-20261007'; }],
  ['wrong authority', p => { p.authorityBaseExactMain = 'a'.repeat(40); }],
  ['production invocation', p => { p.productionInvocationAuthorized = true; }],
  ['production credit', p => { p.masterCredit = 1; }],
  ['unknown purpose field', p => { p.extra = true; }],
  ['source after blob', p => { p.sourcePayloads[0].afterBlob = 'a'.repeat(40); }],
  ['source bytes', p => { p.sourcePayloads[0].bytes += 1; }],
  ['source mode', p => { p.sourcePayloads[0].mode = '100644'; }],
  ['guard after blob', p => { p.guardPayloads[0].afterBlob = 'a'.repeat(40); }],
  ['guard sha256', p => { p.guardPayloads[0].sha256 = 'a'.repeat(64); }],
  ['guard bytes', p => { p.guardPayloads[0].bytes += 1; }],
  ['guard mode', p => { p.guardPayloads[0].mode = '100644'; }],
  ['missing guard pin', p => { p.guardPayloads.pop(); }],
  ['missing source scope', (_, s) => { delete s.approvedConcurrentScopes[headroomBranch]; }],
  ['expanded source scope', (_, s) => { s.approvedConcurrentScopes[headroomBranch].push('README.md'); }],
]) test('live headroom safety: rejects ' + name, t => {
  const c = liveHeadroomFixture(t, mutate); applyLiveHeadroom(c); checkLiveHeadroom(c);
});
test('live headroom safety: rejects absent accepted ancestry', t => {
  const c = liveHeadroomFixture(t, () => {}, { ancestry: false }); applyLiveHeadroom(c); checkLiveHeadroom(c);
});
for (const kind of ['duplicate', 'malformed', 'removed']) test('live headroom safety: rejects ' + kind + ' accepted marker', t => {
  const c = liveHeadroomFixture(t);
  const file = 'docs/platform-v7/execution-queue.md';
  const old = fs.readFileSync(path.join(c.root, file), 'utf8');
  write(c.root, file, kind === 'duplicate' ? old + old : kind === 'malformed' ? liveHeadroomMarker + '{broken}\n```\n' : 'old purpose unavailable\n');
  commit(c.root, 'changed accepted marker'); c.baseline = git(c.root, ['rev-parse', 'HEAD']);
  applyLiveHeadroom(c); checkLiveHeadroom(c);
});
for (const file of ['scripts/production-docker-headroom-recovery.sh', '.github/workflows/production-docker-headroom-recovery.yml']) {
  for (const kind of ['missing', 'bytes', 'mode']) test('live headroom safety: rejects ' + kind + ' of ' + file, t => {
    const c = liveHeadroomFixture(t); applyLiveHeadroom(c);
    if (kind === 'missing') git(c.root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', file]);
    if (kind === 'bytes') fs.appendFileSync(path.join(c.root, file), '\n');
    if (kind === 'mode') fs.chmodSync(path.join(c.root, file), file.endsWith('.sh') ? 0o644 : 0o755);
    checkLiveHeadroom(c);
  });
}
for (const file of ['README.md', 'scripts/p7-autopilot-guard.sh', 'docs/platform-v7/autopilot/autopilot-state.json',
  'docs/platform-v7/execution-queue.md', 'docs/platform-v7/autopilot/scopes/pc-crop-hosted-docker-headroom-recovery-3785.json']) {
  test('live headroom safety: rejects candidate authority or third-path change ' + file, t => {
    const c = liveHeadroomFixture(t); applyLiveHeadroom(c); fs.appendFileSync(path.join(c.root, file), '\n'); checkLiveHeadroom(c);
  });
}
test('live headroom safety: dirty bytes cannot rescue committed wrong payload', t => {
  const c = liveHeadroomFixture(t); applyLiveHeadroom(c);
  const file = path.join(c.root, 'scripts/production-docker-headroom-recovery.sh');
  const correct = fs.readFileSync(file); fs.appendFileSync(file, '\n'); commit(c.root, 'wrong committed source'); fs.writeFileSync(file, correct);
  const r = runTrustedHeadroomGuard(c); assert.notEqual(r.status, 0, output(r));
  assert.match(output(r), /PC_CROP_LIVE_HEADROOM_SAFETY_SCOPE_SOURCE_PAYLOAD_OR_MODE/u);
});

test('live headroom safety: rejects the superseded template-invalid V1 source', t => {
  const c = liveHeadroomFixture(t);
  const marker = '\n## PC-CROP live Docker headroom safety correction — 2026-10-30\n\n```json\n';
  const pieces = fs.readFileSync('docs/platform-v7/execution-queue.md', 'utf8').split(marker);
  assert.equal(pieces.length, 2);
  const old = JSON.parse(pieces[1].slice(0, pieces[1].indexOf('\n```\n')));
  assert.equal(old.purposeId, 'pc-crop-live-headroom-safety-20261030');
  const applied = spawnSync('git', ['apply', '--index', '-'], { cwd: c.root,
    input: old.sourcePatch.text, encoding: 'utf8', maxBuffer: 3 * 1024 * 1024 });
  assert.equal(applied.status, 0, output(applied));
  checkLiveHeadroom(c);
});

test('live headroom workflow: exact companion uses trusted BASE and PR-head defense', () => {
  const purpose = liveHeadroomPurpose(); const branch = purpose.companionBranch;
  const before = acceptedBlob(purpose.guardPayloads[2].beforeBlob), after = acceptedBlob(purpose.guardPayloads[2].afterBlob);
  assert.deepEqual(routeWorkflowSelection(before, branch), { trusted: false, defense: false, standard: true, active: true });
  assert.deepEqual(routeWorkflowSelection(after, branch), { trusted: true, defense: true, standard: false, active: false });
  assert.ok(after.includes("      - '.github/workflows/production-docker-headroom-owner-push-once.yml'"));
  for (const name of ['trusted-immutable-scope', 'guard']) {
    assert.notEqual(routeWorkflowShellBranch(routeWorkflowJobText(before, name), branch).status, 0);
    assert.equal(routeWorkflowShellBranch(routeWorkflowJobText(after, name), branch).status, 0);
  }
  assert.ok(routeWorkflowJobText(after, 'trusted-immutable-scope').includes('ref: '+'$'+'{{ github.event.pull_request.base.sha }}'));
  const defense = routeWorkflowStepText(routeWorkflowJobText(after, 'guard'), 'Validate immutable scope with trusted base guard on PR head');
  assert.ok(defense.includes('git show "$BASE_SHA:scripts/p7-autopilot-guard.sh"'));
});
test('live headroom workflow: companion routing preserves all other selected branch results', () => {
  const purpose = liveHeadroomPurpose(), branch = purpose.companionBranch;
  const before = acceptedBlob(purpose.guardPayloads[2].beforeBlob), after = acceptedBlob(purpose.guardPayloads[2].afterBlob);
  for (const candidate of [branch+'-extra', branch.slice(0,-1), '', 'fix/unrelated', headroomBranch, industrialGovernanceBranch,
    'fix/gekta-docker-diagnostic-route-20260927', routeSourceBranch, routeAdmissionBranch]) {
    assert.deepEqual(routeWorkflowSelection(after, candidate), routeWorkflowSelection(before, candidate), candidate);
  }
  for (const name of ['trusted-immutable-scope', 'guard']) for (const candidate of [branch+'-extra', branch.slice(0,-1), '']) {
    assert.notEqual(routeWorkflowShellBranch(routeWorkflowJobText(after, name), candidate).status, 0);
  }
});
test('live headroom workflow: actual trusted step rejects companion fork before Git access', t => {
  const purpose = liveHeadroomPurpose(); const workflow = acceptedBlob(purpose.guardPayloads[2].afterBlob);
  const step = routeWorkflowStepText(routeWorkflowJobText(workflow, 'trusted-immutable-scope'), 'Validate untrusted head with trusted base guard');
  const body = step.split('        run: |\n')[1].split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-fork-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'bin/git', '#!/bin/sh\nprintf forbidden > "$GIT_WAS_CALLED"\nexit 99\n', 0o755);
  const result = spawnSync('bash', ['-c', body], { cwd: root, encoding: 'utf8', env: { ...process.env,
    PATH: path.join(root, 'bin')+':'+process.env.PATH, GITHUB_REPOSITORY: 'pachaninm-lab/pachanin-demo',
    HEAD_REPOSITORY: 'foreign/repository', IMMUTABLE_SCOPE_BRANCH: purpose.companionBranch,
    BASE_SHA: 'f'.repeat(40), HEAD_SHA: 'e'.repeat(40), RUNNER_TEMP: root,
    GITHUB_OUTPUT: path.join(root, 'outputs'), GIT_WAS_CALLED: path.join(root, 'git-called') } });
  assert.equal(result.status, 0, output(result));
  assert.match(fs.readFileSync(path.join(root, 'outputs'), 'utf8'), /^rc=1\n$/u);
  assert.match(result.stdout, /rejects same-name branches from forks/u);
  assert.equal(fs.existsSync(path.join(root, 'git-called')), false);
});
test('live headroom safety: rejects actual superseded V2 source payload', t => {
  const c = liveHeadroomFixture(t);
  const marker = '\n## PC-CROP live Docker headroom workflow template correction v2 — 2026-10-30\n\n```json\n';
  const tail = fs.readFileSync('docs/platform-v7/execution-queue.md', 'utf8').split(marker)[1];
  const purpose = JSON.parse(tail.slice(0, tail.indexOf('\n```\n')));
  const applied = spawnSync('git', ['apply', '--index', '-'], { cwd: c.root, input: purpose.sourcePatch.text, encoding: 'utf8' });
  assert.equal(applied.status, 0, output(applied)); checkLiveHeadroom(c);
});
test('live headroom safety: SOURCE rejects companion prerequisite not yet accepted', t => {
  const c = liveHeadroomFixture(t);
  const pin = liveHeadroomPurpose().companionPayloads[0];
  write(c.root, pin.path, acceptedBlob(pin.beforeBlob), 0o644);
  commit(c.root, 'companion prerequisite not accepted'); c.baseline = git(c.root, ['rev-parse', 'HEAD']);
  applyLiveHeadroom(c); checkLiveHeadroom(c);
});
test('live headroom companion: exact one-contract payload passes from accepted base', t => {
  const c = liveHeadroomFixture(t, () => {}, { companionStage: true }); applyLiveHeadroom(c); checkLiveHeadroom(c, 0);
});
for (const [name, mutate] of [
  ['wrong companion branch', p => { p.companionBranch = 'ops/other'; }],
  ['widened companion scope', p => { p.companionScope.push('README.md'); }],
  ['wrong companion after', p => { p.companionPayloads[0].afterBlob = 'a'.repeat(40); }],
  ['wrong companion before', p => { p.companionPayloads[0].beforeBlob = 'a'.repeat(40); }],
  ['wrong companion mode', p => { p.companionPayloads[0].mode = '100755'; }],
  ['wrong companion digest', p => { p.companionPayloads[0].sha256 = 'a'.repeat(64); }],
  ['wrong companion bytes', p => { p.companionPayloads[0].bytes += 1; }],
  ['missing companion scope', (p, s) => { delete s.approvedConcurrentScopes[p.companionBranch]; }],
]) test('live headroom companion: rejects ' + name, t => {
  const c = liveHeadroomFixture(t, mutate, { companionStage: true }); applyLiveHeadroom(c); checkLiveHeadroom(c);
});
for (const kind of ['removed', 'duplicate', 'candidate-only']) test('live headroom companion: rejects ' + kind + ' purpose', t => {
  const c = liveHeadroomFixture(t, () => {}, { companionStage: true });
  const file = 'docs/platform-v7/execution-queue.md'; const original = fs.readFileSync(path.join(c.root, file), 'utf8');
  write(c.root, file, kind === 'duplicate' ? original + original : 'no accepted V4 purpose\n');
  commit(c.root, 'missing or ambiguous accepted companion purpose'); c.baseline = git(c.root, ['rev-parse', 'HEAD']);
  applyLiveHeadroom(c); if (kind === 'candidate-only') write(c.root, file, original); checkLiveHeadroom(c);
});
for (const file of ['README.md', 'scripts/p7-autopilot-guard.sh', 'docs/platform-v7/autopilot/autopilot-state.json',
  'docs/platform-v7/execution-queue.md', 'scripts/production-docker-headroom-recovery.sh']) {
  test('live headroom companion: rejects extra or authority path ' + file, t => {
    const c = liveHeadroomFixture(t, () => {}, { companionStage: true }); applyLiveHeadroom(c);
    fs.appendFileSync(path.join(c.root, file), '\n'); checkLiveHeadroom(c);
  });
}
for (const kind of ['missing', 'bytes', 'mode']) test('live headroom companion: rejects ' + kind + ' payload', t => {
  const c = liveHeadroomFixture(t, () => {}, { companionStage: true }); applyLiveHeadroom(c);
  const file = liveHeadroomPurpose().companionPayloads[0].path;
  if (kind === 'missing') git(c.root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', file]);
  if (kind === 'bytes') fs.appendFileSync(path.join(c.root, file), '\n');
  if (kind === 'mode') fs.chmodSync(path.join(c.root, file), 0o755);
  checkLiveHeadroom(c);
});
test('live headroom companion: rejects missing accepted ancestry', t => {
  const c = liveHeadroomFixture(t, () => {}, { ancestry: false, companionStage: true }); applyLiveHeadroom(c); checkLiveHeadroom(c);
});
test('live headroom companion: rejects source runtime already changed in accepted base', t => {
  const c = liveHeadroomFixture(t, () => {}, { companionStage: true });
  applyLiveHeadroom({ ...c, companionStage: false });
  const workflow = liveHeadroomPurpose().sourcePayloads[1].path;
  git(c.root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', workflow]);
  commit(c.root, 'legacy runtime already changed'); c.baseline = git(c.root, ['rev-parse', 'HEAD']);
  applyLiveHeadroom(c); checkLiveHeadroom(c);
});


// AP2 atomic source admission: actual immutable payloads are fixture data only.
// The tests execute the accepted BASE guard, never any candidate payload.
const ap2FixtureData = JSON.parse(inflateSync(Buffer.from('eNrsvVmT4kiXJvxXwmouu7JSgiAr1W19ESwCBIhAK2jesR6Q2CVBBTtt89/nnOPuWkAQkdVvz3fzXaRFZCBcvpzlOav/52+bj+V8Gdc2UbTc//avvwUtLfTMt0vPtc9eNDp5dbs8WvmvI+ut3LO0VW81uuirdclrGmGv1JB79TfZi9qSbjlhLa4u/Mg5BLVq5Fn+uVcPol69cRqt3uD3xUqPBlf9Oip7qyDUV8Haqy/WuhWu+lawHLl2OfP9cGRVF73IW3tWuzSy/FK/Pr/Az1PfWix6VyfU686i547KvVL7tW95i9FqLdUiVQ6ai6O/rJ5Grr4ZuZXtJJL2k6a6bNfPmb/Jb15JXozd02FUUvbvy7ezfl1f9fr8qq/mpXZtd4J1nWqRfpy48jZoGSGM2RoPjXbgtufvzcoR5nmatEIYJ5TGLWfZxWet13nP8iu96+C1dx296su3Dxyn97aN/WZwHbv+vGtK+64p1ww70KxldWDIb3NbClvWWrUdR1PZ51Kn/baZB2W9OZK06sDW6gNbNQah2vEtZ2+V5Lq97p1HTqMcDG3ZcRc7+Lwa2PrRhp92DPvpOAfX0uSgrspOWdM9Sw2D0DiPB5u5XaqYfvPn1WlsD52yYZuOsZms971ReSCN1vNj3/V6VqhHlls5Os2wZkjBAfb4Y7oOYqfk/QhaTte21JMlzV9HtrfTreohgHG9OIytUjh03d4H/P7XyAlePWdh+tfBeVwOt/ZaPfZtuaLHjmTUF5o1VD3fDQ6OWj0GQ33hN7SLH+uvk+HbxVw5p5G5r5knGFcNdb/28+S64cANFzXf2Q4tZ3M15fAKax/7w8VyqhqOEw6uI2sRd8tqz7a0xiA2zpMw3HiRp7ph0J8Og4/RWrE8KdBwvlNHr4+b5/YkNPZjW30du97eL+un8fr0OrWqtbGp6EFpczHtEN65vkxcb2RH+45re13PnV9NN4hgTqVgvbcHZe80bjjH8XwzH61HUt/RNVtetMcNfR+UjY0nq33v6p8m0TbuxeG7bYe2t95uJo2gO3K2+8FQ+2EMg7odaf1A3u6msTZ0msaxU9bHRt0vGzBfp26MDMmQzeY+dtWqNI28ziD23qdx0HBK24UlBbJzXTiT66jSWyuXqbuo9BuVoR3JG7+hht5Q1Sblt7LR8F8nkXru1+E0gc7spbK010bViNTBYH0+uaFhWfL67KhbyasHuymQ2Li18KzSYjNwjb+shtZ319pJj73SxF40zOGo7Jfsj0mrao1Lvcu45Pzo0XznktkwPuym1rSihTtZry+W7ctOXJXt+rziNba2vwI+KetDvdF4NaPK1rX0hql6+4G5100rMK26FpuWY00iv+yG+sKC+U6GG8m5KAd/uF37cfgB/HN2VuHAKqsboM1aV3qteM5AMqR91WmovaDslOzIkwdOEA9CZ22uqlW9tPvoNStNb6V2e039Lw/mG6y06zh6PRtNY92TfpaBFz48NzwF13bFamxr9noxNBunMxBafapqR89WD73oHPaai7Vh7seeo3U8uSp5knIM6t7eQlpGPrb0gRup5rT2U7LiQLYd/9QtOXW9bHfadTkEXlrUlm974n3b6Ru1p3KhY7nOxSvZc7/l7Ca16gXOVfaGutSu9Uq9elvqL6vXoKnGnlldTsrOwWs663ZDHZimfJxE50q7pQO/aSv4/ARyLJo0w3jcGnRqa3U1KjknkL/SuAnjR05p7Dplzx3MJ6VK2HWN46js7D23IrVb+F6U16o0dpUD/H8xKu1D+C69o7us9ieX6iVwK4eRq+3gXVeYy2UE8x67FZzfDuQyfbdbq24mZV3qlkDONs/HqSuHk3gw98raAn9Oyu25ZauW03DMdlO/eK6xDWqv//7b779tDx/bzW7627/+52+bUzz9AA32Vqv1bd36D/k/an2jAc9MxvjAb7Liy5U//en0dVJRfsp/Vl4lOSiXfvz4WfnxWpH+/Plz/DP4OZ7CN3abw4c/rX6MY38B39xsd9+3H5vg4O+Xm/jbeLv8tonDy7ePaTiFsb+VpNIPWZZk+Ob8MP4Iki/ON8fpRwz/mX5fxsFht/9YjsNv4WYcfAuW43m82e2X/o6+LymyAt//mPqbjwD18MaHl4bj/WzzEX07/vl9fNhvtstws8epRNv97rt/+PiYxnuYxnE5PX3bj3frP6Lgf4y3pWQJ74dJuPTHOO23w34Buv46hdFn43A3hc1L1tSOj5svPPbm+9PtHteTfBiNd/vpR+1jGiB8kP5PZgn/iN/e27RTL/4m3n9swnD68TLZHOJgGryMg2i528Ggv7/g+r/J8jdJ/uOFvQI+335Mt+MPmtPLxzQaL+Nd9m9//CP+R/y///f/Xu028Mt//iN+efnHbzt/AU/+47d/hd+3/h/JQaWv/8YJ5o+j/I/ffmff4n9qB+KL6QmLk02eJSJjz+XpLHlizDZwf6kCaTTOY3/fg7mzr3yVBJPBoul+HIz3Y0ZRbBBGGf43/2OzvafFZFvv556lajbUVwn7Zoj38X6xwxH+J/6VbfzHEkmSf/E7kP1ydqEB2Zl8Y9/8BscHW/NHtNrxMYu+vZ/u9n/3u3drSM/+j+3lKy/90rf/mC/3i8Pk+2nzsZ6Fm9PTffzjEoWZ79IBfrL1wMj/+A2/8L9yOw9KZl6w/U+ERfLbt91+vJ/+QfzyeBf+/4P7Zx9cRiMwpvtFpZDwHg30mPW2f35Lz5qe/WO3KNi2gudwB29Op2CbUvK6G4C2KUetSKf5eTLB/rJfLHcv+9PmG2zmIQL1lSgELoZfcDf/eKlvXuLNHrREAF+ZvsTT0wujppcJ7eXLfvMy3sJBHKdBbRNzXWj6m+1097KM2XuE+Hyh+fzxom9epuepf9iPJ+GUj/f7C63hZfPxsoCtf4EBuNaBAVCa7lEbTS5sxHfjj8wu9WOa3PS8hDOL5y9jobzSg31Jj/slHMfwOvhsugXIDtMFzciU98s4Dvi3YTTQGWxS5ZcTHMMLce7LAVY9jufT4I+X9v4lgvFRre5gE9nUxP7NAB68LKOIr7L6ZjZoT3+HT6bTKzxwCMOX3fLM2fMl2gTT75NwM/lutt5KlR8vW9C1v7/44RgUyexyu/8f09nLeJd5A85xc4ApT0E3Lv0XQAbhZOyvf4dHV1NYywZG+HjZIul+x5ftvtOKvvMBETrsaAfwOJcBvgI4ornE44fNgzVxbmZP7T9g7bDJMRzTkX+GW/YBk4BTyB8QbPF4BgglPRu2s7/DfgE22i1gb6Yv4/0mgpnvpsdp/A0nKhZLhPOv/ExgZ6/TmH8E2xQedrQ57HxmS74XtNsPifN/ZtXw//r3jEZFYsfTtWBIsUZGmwHs6xHoeowHh3PE3zYnZBr2RdgVONDMmfDp40kyghiHsKnBJd0GoosErPwOJwxbzZ71YbxlgGtiOuPFYOcYHLaEJqcvmtnXX9bTy+7fbh8GTgFxwshz+tcBGOCGFNnntHe0q7BVeALBFA4pWsbIST6f/rcjvBX4EhYx/dgTVAQECL8fkdlwvvDdMKAh4SE/PAT4wWmxhFdsx/7032DY6ZbNAxYJm4CvWqKA2B1ms6W/hGMBzAnbiuMcx+FhymlsgYQVbfHYBWMxFArf3cNf8ZhwIEYB7MSFsEio6a/DNPZxSoxz/3jpT/Y4BHDKYYkzSUUBHMweZvktJcFvCzgwLh9+h8EI+cJ3om04RcFJQuobAVI4R+Ch3wVHvL3LL6U/aR0Z4D0bH0KQvyDrgbmRkoBC8TjxZGrt7zuQi4wSQEwAW0zjOUwRCA+mj6QD/9mxvQF0v4zHsPcoSL5Nz1s4pWnwDYTHSzSO8cjHiZ3wkBlxsYJK08dhAHiEz2AG1AALphWCPmevxf0lOX2CzducXiYkAHYgNT6Qd0DC06dwdjCXAEUQqeXfX+rVFziOD1gfyqbDFgU+fHO2nB+4vM9L/sQOSmR/Aq3/uFF27Jyn9eUO6GSJIzBNb0xBafpAUXgg4gC/ofJbTMMtisTUPMtSC1ETSRKSLvyL8DeSBlkCS8UVyqmX8QQkDhcgpw17LRcE4wsijIS4lx+p1iIhwYk7o2R0NgCogWWEO3LYzj/G+HbQvPCNPZAQnDob/zujvO/1agYbFZDBP35LCbKKeh+Q4S1OEDbjDsUlyh5imdN08jsdyjeYZ/j7S7Scs8NiS0J6ZmqGxANs+nd8E3wT9AeKjc2eqPSlBkwNzPx9Gh+XH5sYGen3F1l5OW5C0KSo9gDZ4E+Ubr+/rGB5MVi6SEg4MhcPQA4gmODowhdb7+h9V/9uvjd06wVUEJDedJel+3f+1cws6rr5+4tptvAtbEAkWjiI35lQxEXGQj9OgNLhnH5/gdc0DGFQc/reLcZA+CiFNzHNh0YKN6h+kfJhVNAdoJqQPOBFAm3BRLcHkGI9JGli8b8Oyw+yuzebGfx3DwvfvbT63TrwGAA//PrlJXO6J5AWOf422BCCuUMURe8fy100/o5eBfZruhqCIYk6Ss7zWzyOpt/BfvDXgG1gDcF8+pGR7pIkyf8BR7ifw7b+Ff4HCgnEWbg4kEXAT4AbgKdA1s+BGOGLyy18vN3AJ5d/o41jUprPR4CQvI6A/ST4KaQAKJJtuLkguRQtOdVx+/HHfLpnGnkM6v8bep9CEvYRsmi7/j1YAjbef0fJjtJE7Ajo0q2gFIY3WGgGJo8Q8gOBESnP3wmxMbKf7FDyJCywW4JAgU1aokqBfZnCoMhtKPKYTmYGXjq0ePkL7D6yzx7YHyRwupz5kyPm86Vz+47qCmgn+s7kK6wPeQTWgpAOJ8nJiOgG6Hw2A15AGmlZ1jt+O0Q5Fm3W8KGg0hnw+uFj+j1ZQzIYrjjepGTDgT3J8UQIgDoBbQPUsbxyp1G6lO50PvYvL//jVSmVSFom3Amm3Bz4m48bIZXsgR4TGTlB7oI9A3TBjBTQMeMzSgg86xcEsymnJ8cPszrQpwiegeyArvYw4eyU6mI4gBjTD9jc/cvuAAyy2wGvvCSCkas0HIc0MIhiBrbTWX9HIfm9p76BbCt/Ax0PMwA5Zw+/V9/0zne12TZR0uzRMgm/cdj9AUrSwHn23kyrYWTF90sjb+KQruYiA3ki2RuhrG5U5AcJ8WnQjo8g8cfwBe5D48iL8CSDX78zTPs70/sIVYTahd85szJcSHIduAqQCEfY32NYE8MohO7GYeW7LEkvICJfxBQE6vy3J+bjLtWDiS3JUSDXTcyeHBymh2nih/WBK8+o/1Ay7bhASqxNNA92NJO8jkVshfhmDFgT5Q8IrA86XjiIFMkKMJoh4n888/Hi9jIPLfdxPnX1Pn469fjePpN1/OJn0j/i/0Me2X/E6JdneAP98n/DxfTbv/7WvjQwJnjplrTtZKmEk3g0n0TK2htsjt1L1RKxBIzf+k31Mh7qx8kyiT3Y42Z4bTflo9dyMPawGrmVw6Q8mI+GjjRuKvD8Nmw3G3O/peEzq6AZ0vf9Jow7NLaT0uuhFoUwtnIJatU/2y39NBoGB7scHkaXqtJuepdJSZprpcrRa9o/RqXFdtI0ZjjeqORc/Yv/Z+77FLdQJc9eLPzSfD4zq5EfKft2LThMSkbYj/TLdFiVJrffa2mhX1J2QWTffyeuLoLmPO6fttvJEOYeD+bTSzUau+fQcbSe01QGsJZNuyXNvVg7Tsy3mPbQ2sp+dILvbTqwfwcf9sWWFtV2XZp35cqkV5MqI1OOhsOd1GtJ6+51lz6napotydWhrL1b8mD+DmOOhtWTf1EWfnN9hPVv/ZK86NI64ExiXWo35KqrKjXXMVT78qa064N5Z4k5AW2pXdvMe9bbRa+n77BsdTSUnL4D7zKcHr7jQnH0zDPB0Ij6NRirWQmDS9X2hgvJaDor3Bd/OY/x8641j7u0994C4039ZVXyYyeE/djCnsGzlSvscTweGirS17tZ/bO2fJvbDdU265u5dlFkv9w+jqLw0F8qy7H7iuP1BrJStRqnH3AOde1y6rRr1ZbpGLOBpPSNddgaSpV3Ww4xXqX3l29xz/R37UagOapSt6RK07SDmSGd3wdrtYefY9wrWCqHwD3vsuNZa2Vmr52B1VDrhqPA81t1IBvWzZgte6024SeMe1YLxpsbUmgPZdj7taxZ8M6hXDUtSR44uMYrPP+2mfOx+pas9AbO1htKnuo09PbNu2Dd53dHVgb2WrEtSX+3aJ+Sz9O/w3zgd30oO5bhtGGv/BOubWbtOkAXu9FQv7ZVHoe0nQvQ9aXddF6DpnPwWr25MdQuGPeblqWOFzuHUZl4EmOS58ANL54NtBUZW8a3CzzL9Zjx7Q54DXly227tcC+33vJt03azz6/nQXMB4/sgU5zy7Tw6/PtAI0ptvo0CtyLkA9DKYEO5H2UdxlIuU/MEMkWL/ct6Pj3BPjY5zSPflp1dgDSakx1Ak2WQD4yejpg/gmfkXvx9160cu65yondF6q7rnkGW7K+MJt7msIf7Ee51LVhNylrYjbzrxFUOsO6jv5KjkXu+enhWd88tjhMYx8Z4a12CtTmlbqkiT5ondvYwtnaRVzgPrVyFfTHgvcquG2GMVim/u8BjkXPBz7vL1wOtV5Z2bH/fcM1lD+jgdl88t1LqLxP+gnNxMN9mPXYrMdLVKHYij43LxmnB+bkOnMXgB8gIzMGB7+xBrp6tsRscRi7xnAX80wVa7+F8Jq76OuDjwLv0gbOYDcLQBrmxQ16G878GTRj3uoE9DrZeCXN3bODjt9hvhie2X8FpPKyGGqwJvzMz1yQHimltjjlKV+AtqRtxuq2NovS8KbYtBUOQW5YEsg72djmat4fp53wtfH5vMfGnpNRsyTGdNcgeW+kD/1WRn42aD3QIZ4TjD50tvLueofVNMhegOa+pyDD+DvY9Br0wfwd5zmSp5oEssu7nCbIybh8myHNl0BP1k5KX1YLuAiaPZMe2VQfmqr07dqWhXZJ9gvVqh5ux8Rz/rMUS8LsnTyKd5Qk0wzXmD8D8Kx18vqlciX7j9Q6/7y05H8HvQcu5AM/JQXP02o2MEGnHMxeFPAhne/GGI8ICfomdb9eUS95Q23rxGuU26F8v6JjrQwA6amLOi/gbdfTaoRy4BeY3HH3gT+ChCnwfZIy8h3cLuSL0B+AFH3XHo3nt/Isswd9D4q+LtAd5tpvUsn+TL/znD/yJmGbihhJbgxQPn9LjAt+fOcPXea/2FmlLmhfw6mDTtRpb0O0K6NETjgl6VQV9AvJZ1U270hLnKHQrvAflxtpHXd1yJG81xxwS0q1wZovgsobnqjtcryafThk64N+rwB5gogrtE+WnjIH+BzC+1wyJDvDs4X0XkPVF9KdaoWGatmNl5kt/cx2lBnTYT/hCyFsYA8/VQ74zqwcPzsRy1VOnxubmEZ8ukjPzQB/4Eea1jDLz5rRXS/cioNxBKXmmC1gA9uLVKo1g7WdJrP3xOo3FaPn2L22UZbXABn2uAm+bAxt1sR+zPXrLrGMRjlzEMLj3fI+AnybNcOWZczi/qjRy29tuJAOm0TedmjLt1BsgK0eS3joBpnor65bzs2e1KYdxVm+UCDvV1vNOU9tNStpPQV8d823jXt/2fbex90L5T71eVTrm4Hg3pxbhTNxXsW8Hv3TeAv7e0P7UdvOe+ck+pOtC2jwRLiV5RGPnaQBkf98aMbnpJud6GDfVa4c9v72jC5PTQ+2J3Eb9x+TzJWjpQ5A7sH/+Ec6Qy2g2l4S2Lz/jjgl7X5KB7t9Anr/CM6AfWqe5D3od5Dvw7Gvcbp1/tulzkPc1/9Bd+tn5DQaO0f6UTsT+hLvz0Hxb0NhXcXY+zW/cdBZAexf3qgWcn+NRBBhhSTrMcmxNtyTDsRoOYkeQ02rDskMbZH8j836wpYzL2HWuoDPCoLagsyCczPZ2R3YT2DTt3JxgzaXFAnTsBmUkyNVJT5YSXTkb5GR28o4CGXsCnSkBHcE/w/Jgn1Ef+FEY3mMoPQS6gO85a+RB9/J66EYpPQSATwJ4R6cWBoCFthPK013Qu6cmnM+c0QONH4PMKjp/tWqajg64QQFMrNgds/pzVns7DmugW8vqbtaqom25H5nrdbcEuqMJ+rYm3lGhves8l8/pfkdg+10Wc621B5wcWqCbAd8r705LvoL9GE7cxkHYT6PaGs80fU7S24YNdpcka7asZ2THI7mT7h2c83Hi2hu+D0THT/ek+baeyvl9mbnyFvPxaE1x7wjzI5rsyicYO4xFHuAQxvLd07p7qUiYk9hhcrnSZbbqtgN0pMEaDFmrOo3w3QoVsA8AW9ihZUth37h8gndKYM8T7QxAxnuAX9aF6wJcDFiB8+iVy8ca48vMXr4bgldk4FXZAdunLfb16oEdDXZHSPK3rAGQWSyAT5YdHHdZrQWuF3nD9kH4IAAzJH9j9jY8Hwt5Vb39bJnuyS2OSs+ugH9WIAdW4xJgvcYzLGUATg2Av1M8VbSfY+BvoM9t0FrfYRdNWqgD25hOSyIPXoo7fE+RXrySQxhlgM9J+3cHztFpqKYhIUaUyU+ANmQGHxTxx9ZDGgG6nd5hLsDokRP5F9CBrnxE3uuCPgT8jD6h/cgND8N4z3GZoaAcJxmcrB3XoDt2qKGOABpTNaA3ndG1UTcJQ9D+htMW859kbU20ecauV7Fhr/1ID23yM+Fe7+5snVGkIr1sJ5Gd2XvUp9U7bEU5xWQXcj3b0vFM9yNrg/bXCuyu09hMZMLe5+/vUr4t7lOlhDZ5qk90edIaoG3UtqRzAzEkvGcB3zugnQVY3TUcTTPWIdoTiV3EfGjOzOfrwmcZL1RNS/ZUa5k8m9KcqpThbD6oTgTnK1Xe0S/gqGAvyEZ2fMz9BZkgh8OStkC+BbsPf9/i2U8in/wnA7DjYG7o5zDgoEzDNmYP5rAGWbugfXYUPHOUvdtRFO4+mTvoqupuUg4pb3lY4jUiUfgDZMgP9A1NgN/IDm5JdFYor9KzKeaboAW2o6sweyrlO44BgivZGBFYV8LmSp+5wepAoyB77IZigY31bodhZi8GKT78bB7NdI8FNvDLqHcqsXYhzGWZjYbQX8vREGUMYFmT5Di383DtYl2ChrkMLeuoow/ehWER9Bd2Y9C35cFGyAIm253RwNaB//V3CzAu0IZpOCoYtlpqy9b+jiyoot5M5z2UM3JJngu5lOHD3LqeyblRzfhTrGHmVP4U+HjmvnG7CTD3UIsBq6BOrluSrKM9bNoGyhVY4zqL40Ef6R/AW5L55J3JniXfC7ZwLrdrnmiAPfEcui6eb2LXbsGmXIBNDfsPNIX4L3P+ZCPQfI3g3r4AvgVbCHUj5vBPQL+RjlMJCz6zf7M0k5yjkGsj1wN930Yb4Q7foSzyVAPGth/vw2f2Q2NrWdLrQdA0yuVOshbOd4XPqBHQ/IVoU9brZsNBTGOBDWkOJGcGuqtqrYMcbaLcHZX2x2BoaE/oUdBElqa5/t6RnyyV9SSPyU+DcsqWFMde6yrIqirgOxts2ndrffZu5TbIs76RyHnSE8xP6Sgg+zSkK5ShGmCYPmApkKWnOHdODsicZuPHA9qYcTyf0HbmPUwfOUqK45fVhYf8vkz8S0XP77G+zsO1qvTui26NftzEPjYgSzYjqy3raCfFzskDDAr01oF96aMfi+RMKYxgz/k712DvGlugE5Bd8xje9Qq6Xsh3heFF4P2SKo1Kc7BzuR+X615GUwbo0Nf59PIG9lkF7dhwPKxKzC+kgo33CvMUfugQaYj4C/0DQv8Ln/T7pQq4UwO+q+xB915HbgAyF3XhjQ9PdvoDh/x41cH6rGqXZK4dsJc6Y3c07yAPlpCPe+RXDZj9R/4bD2NaLS8sfobTfBPsnqYD9HS2JzLhScB08gnxajeSw6AJMn+o7YC/8rYV8l25J/h1hesA3AF/GyW2fW955xciGkZb7MvYCDBCGhMDDFuChZvcr5ihS6QvkHMwh3M4iQKwSZg87y3fvrO56pOeKs3hORn0BfA90Ig7SLEW7D/zS+PeAO5iGD5dW+ofLSOGAnpDfVJEcwJPbWfO+TDi/qPMGsIpyINBidkXGZ+n+J7AAImMsQETg77whvAuC3RFu/4TfXQ/2vUG+UexXOdXM+l/+9ffxDG3W6SGb0N8ZH5p110nea6pXmG7Max4E3oUf1cItozKg9uQ4n5cMkCcyycWwkC3+x4giGZNwSwBFmJbahMpir9dJo5emUQ9DMds0BwT3/UBiqF4Gsvic+cVTGzJZ/8vCI1619w6gMSCpgxiI7wUhDaP96HX7XHsvn41fHoFOFyehI/mogN7ndfDcsKSt9/nLueQh6idARfVmbH8Q7cMpmuE5CZj2BQgPsIGedEditI8WYh4MGW3tP68G93bTlso0uxNYuIlrG1syX3YlD88oA2YG51Jh+3DRuxdh7kYTqNLgalh+lvOQiBGuAoFOwlY/1+A5PfsLBdAA20MA5FZA/MGiOuFIswKNBDBea3QTAC6kj1kSzMvUjD8heKkU0PXDokk/o5bF+SvhdNYSO6E54Ei5wfbEwpJoRtbmB8UWkjDa28iZPVnW62C6TrHsGWahrDaUCgYx7ca+gxNF1TTg8t9eBdUt+U6um3YEo5xzr7jPlwc9CxJq7JQKtDwcARrxhBBGnYF07ptyRqMq+oGmV3J+aPKZ+OBFjAbijmUAOLYIc0NxOQruuQ8uwpiSwWeOIfowkbX2dgdJOE/+pesgeCtjWbZ0/dJis7di7/0TuTZWQr3Fn4Z+ChGd44qj9xTLqQ1QrUN+93LQCgmykFVL9d36r0gHIaifS/CADMrF7rhqgBoKnWDSphKwF08YnyUf1ufyYTNOFK2YKpw2ucu08Tty1I2RsD7ABVLOdpPTLkAVWVogOnqOQ/H3CZzYXNW8uEObvogPyR8mTUl5vHINdY8rFRFF0zyd27e8M/OExYCjcbwLuDhMOMqFvuEUC4JcWllLQyWJJ94uDloG7aadTHz5wS0kwFijeKvuHMIAgMszZq93KWMc8ieIXtHCfTIcMDMomGD/XTb9HPiqjCucCeyPe/UgoXfqsJ70cWiADwIryD3jon8jYW7l9a1R5k/qVWbYm9Q1gENz21uYrQb1a0HZzNsvgq3IaepeXFaTCnvRu2t3i46tcdonFiKS3WW8I+p7GFvknQkdEfTmcm6ajWculN7O/fl80Hse1AGfdG0aU9AJy66ZdBJZQP3HNYLOrJsoH5f+MxFGzNXqNMzwFxv19t/froGkOXdkhcST0b2IWj1aAygUY4vBG0mz2DqTm6OibmYMdOBrkRodfPf8P5L9v2AT6SsayPlo/lNOJGZ8Uw3Mdfyr0Be1K95kzk1dVn6Uf5dYDbFz+RQQr9C3oBenwJE7V8S8+12H29l3R7MWfgu2++Re97BGazGFz5+U19MmuflCNaMsvLhHiUmTMKXfya6tYQha3F22TB2fh+Yeb3bpesGPDl0UNYjZqC1JG4BxDaXVL6Lv+M8yF13l14AOKZJLofE9GZpAwIjCaxbQXfaYkIuD24KxgJjkOv73WoI91uhjuLjV4T5mKQd9T99z50Zj7Kmb8nGzFa1d2ft9BN+AdMF8CSmmpwDV92xsLmz9VswF5CtI3ILOTMegoA9AJxC7oqTcM1iSpZr2K9fWcszV+lOuEpxHDRfmStxjvIF1oftcQbzgVPVMu0lVuOmemCtKrQj8M818xnbF5orS9ts47O16g72s4RhfK4r0F0cTmtg9sXGMXCRL1HeV6VU5yU0HiG/pvIz0Z2ZsL93pWeWFa6jwDYp+3t8V0EaRGLuwvPMBX6ZPz5fZv4dEgxSe+bqeXy+IoXm1j2P4wmX40BSe18Zg+F6dZaGWAFL3X2PpxIUfA/+HUDmoZuR3EW9lV3qYng03J26Vrjoul4wvY6kWZI28AzPaXiGmOI1S+U//o4pFehapnANphiqdphxG1Na4td4g8//aagA9/EmVPDpmQLePE2aSmWC6QiqsgBZCnSjbaeRs0Y7h6XefTqv4jBKyqvZMMqjOUXdiOE4dFEBnV9FWhHau0AvO4ajUKb4D3n+Af2zFKy4R2GxDqVqekewJTeCJ9xSZTFx7RT3kh4ygnZTidoqvWuilbhcx7YxmdAwzRNwl9/qHUGvbwGfcKyVxTmVa/faPvVWo1PPQlz0RrhoWErsj1y4GWTpmeykWmAZ9lkdyIN539rFQ3Ix4VwoPTiLowgz/AI2u2SxGaaL5p5bFmGpxp8ildC9BFwGOuvETcqw5d/BoY0xhZA1ao8DehGxp8VDTfNBM4R3SJm1UzrtBVNJ22jGsX2CZ70L7DniFQnWATJBWU5KioRu89HwLcWZIGOo5Q7wndWwM3K12rek87shhf3+JQjIhlR3MaXStpwTpdCXgPfMqmXbgHuwRRrQIKVqlxjmgzntue0g5oN0dBk5Z0qBAFsRMEQFv3+zt73s3h7gPPe2rPaAT4SuQn1CLkJ/WR3wfQVZrhyD2uN9z6UwlDDtdncALLfntIVuxBKGkPyVtMRQXtDEdEOkvTbt91DgC+aL24yAj8boE2n10M14GLlyOHPfgF8GhCVv08w88tfkfDqAq0YHkMOLCeCwAtwHdHJed9gziKc2Xw5xsPR3DHuzFI0arMXdYhjoClgOUw8wvWKO+BNoDVNV57jHSBMUDlzmQ9pFc6eUu2VFYM6NwNB+JOd8UfAMs3m/TJdr4Zf6m+tnci2DXf7CUJV/qS4wbWmKaRekO85h16U0qDmjL4FV/fwZJhieygcSG7rT4mEhmJ/Aton/LOcPXfw1AXsN18FshrcY7MrIj0AWJHQG8hLpt4VuavXEZR6mspwmV1/WRTiOY98sVvlqugv5Y3g4F+17Qbsjs3qdujK66D9YGPu8GKF9ecmG+Qb/NPqYJqG0/zqdJGG5vL95o10UDO1dkZ+7ZYFHhRyv/u3zEH6aL9InpuqpQ6b3TcMOHKuhmoRtYuLPAt6Ut6DHSdYLPdFuOiXPfZ1jKGmCbQaHbZTTO46fE5/KfyPfflWPJWlOQJs7j3AMs7E7X0x1e0SjILsBIxFNEtYj+WXmdD7slyP9f7EPWb3iXz7xDz7fH920A3PgGJolVWCPeIrVF/YnSdWilqevcw/TJ+NfsqEy9tLf8+nB97PpA8/WWXccDfihguurmnaFUgOBLuyBNP9MVq2z+CgN4//NtZbSVA7hK01S+IHGsJ3sr64NeL9ugk0IPG8PHK0lUh/v1vcUdy843t5PNJR5MD6zid8+9ZcNWUkC2mG57wUuhi+9rTcMMN1RAowRg9oSpQ48lbO6npTAhm9WAEvBPHjcMcE3ZpVsGvKLsrD0VZRJCl8QpaMOKRVkzmyR8zZohfP8+bw916uXatSNb/xhtQDjkYD9/LvUlFzKXVYeJ6kxX/QJyfo70GadpXRrmqOGM+DFXjb1/Jm/JpNWMguQR8q0D4nvZ0AxF4wZZdK+ns0tyrbLNGbZ0lYP5usB7vdLdh7z3dCVF50XIDeP3hLsBaBrnH8A43WHToI9vRorKesO9Y/x8G2fmXt8h3ubxhF1zwSwAdNXxmJcspFGoklTjTEGiikUNAbJbFYGQ6lIJSUa1fIy+nPfzhthLPQ9gq6U/SbJa5D96Mui8k9670ObryxssoqQ2XF23NSnXmi33qVtMxvX2PqxUWm3ArBH9jl9XRBbSc6z0M/0CU39iq/pE9/fr/smav8d/sn/BpoXuqKUpU3nFcaU0R8+Mqv51C4qu1TR35mWVy6rG6DPj7+BIYQuOQJu3XqPyjephMMnOgaZnfm7jKXrCz9e52MzmVyLeyzyyTi495fegpfWX8fqGW1dGVOnmG9JiYCWYb64H+092IGIVzCdz58gnnMrEqx32VPPfq+m+ROce2s3p5R7wDO95s+ybtlJjPeORnKYOEmb2T1LmXnoxxouUMZcH9lSz9cDctZc5/3aWWzxiF6GBvpSlyDHQ9BT6K+mfAwqP4l7v+qbJozAbMs5my+Wj2IeTgxzHPZ+RXYR9kefzzvoyiAKwyAT+3pAi9guAFM3D6LdM8yH1sTKgZnPvV2j7x7F+F1X7IezBn28Gg2TWEmqm3/Nx5Xxk6Vyk8mg6nIK4/mXZz7RBGf91/zv+VwkEZePMP0QY1za5fE+oM2Z8wXn7bg9jHslbES6DnRjCVMNlSXh11raogL0FcazNtieAuO1gIN4fBOfPy+m8RrO2cFUx78bB2E6NxcHuYnpYwlQCfg09dMrw3hP38O06GxMvSCP4W6/YE0/pqYM2NxYjWu/JIt2o+EWZLIXYowiu9/DJkvFa9fVT2XQA9pHnyPoEZ35nfH6idjYwvnVJ03lwP2T6FOMsfVDyq9JHsUB9jhmfAI2h6ugz1I8j5gA7b8ryByGscnO8xO/EMcseCbAg76wpfaYkt2NhA1VoVYdPM4t9VcbLtuJDvacDvagrzA1tPIJr5PPZoJ/A96ZIiZ1z7tJmb0bfi+PhuE1LdeRP9EvnHZbTOYhbXRjfTcGXd3Bctd6e3v/9/ZnfgBWai5pluForrB3jbWqWZkyxr/Ltzd0KPx9iHGpNC3FD0/9hGA/wXmjHezmcxmEnQO8scWSWbDVANvqaLtlMODfxhAP7VGQDyeUn4wWHZSBuxFfl6C3BMvmPme2HuXLcP8Rts5h6fm3JdYKYC3nInDqTc5Ghi+ydneal5PLxynA7CwGxXjJi3tHwQug9wRPHfkYO1pProSC+9taPK/SETF2UTK1+POmDOdHO8EJmfwEkB18H3KpxbDeJM9iZn6RTm/9eMPqDmzukGKIIhaNeRcR2dNUipf4mYGu/gv0IuLuv2i3FL37hgbLwgdMeYCg69NSu1/wg1hYMsh8fVw/S3p7YFdawvZ95o8OXA3jYfIEsFhQWmxRV8CewP8HtDdgf2A+glhjpuWTsWV46pd0ZlHuXypXSliyBDpkmfh/Ez4IhlSyFnZd1jJA8Gqalyeh3EYMhz7tI+WtJuX6pzv9223yd0VvBTqEeJHzm7pnfKTLo0i0wPrn8R3//l27DbPhVI3UD/5P48c8XaV5VP1luteIXak8MtZZSw0qXUV8j35V8t04g7X8bqhOz3BYPsHANlie6yc0NylXWawZzgF9GczfCXogwrInbclwM9cFXP77l1+NE+X9MlmdgiUo7iV44EvNtoZ4KzM8Je0DzOMpqWvcE7CzFMDLKyxPKvi+NJFZzHZAMdv5NvHp1BL+fZTTvmG5WantzM6E8UZhSWyxLFXdhlrP5B4XlEBWlRt5muDlANaCWJm1QgAauGCsWeSs/eo5JGVysH9UzvYZjf34Nb/SP48v2Hpv+CHOlh7jHCmn+30Q6qodeqLkvom52oV0X8rEmHKletXNaEjyF/cMcEOVYu9AVwc8e8z7RzsabEnKuxQ2GO5TLraXyefnfiLc41+gL2xvlszxmOYKyGsf5pPi4Bz9Ya4/6DL0NVRDbImj19+2mRI+/Hx5+3map3mfU/iVfS3yV5ih/m4tK7w8OMDWRJlx14cx1ie0nDXoqY1G+tojGe21dJA/iBVUwmX3dubm3wvKiJ5fi/GgzaLfClFfHnqnzbK91Gr5K6SqW9AFeLXUhdojAD12l5l2jK6+gj2UgDcxx4/JSKp7ca7jGrYmrCAGBbmiUOs9P1IRCy2IZkoO2p+43kNtvjWxFLULcnfSWmP+YOhF561XWkiURxIBDhVlhYwu/8I5UNs05BPAGsEQ24cpSFsXivUyXS+hHEWci37oMWAcwEmH2roxz+V41aqyj7GOFmDBlOZBJuiILRrw8wPHABt+NaY2CChzEIepS8QldF3W0MEcmGRelN/4toX9k2Vsm4PP8fdny5MP7UaYrrGFOXO9eT6OWEV/JPrNkCdAT1eXcIaIEa7wO+W+ded4du0Oq42qzoYlTyZc4yizdjOpjWLYk1/D5Z822Vqxi1dmsi5TS0XyR18NMs8hP1MOGNh37czfEVs4VP6f+X40gv2fvKX1UtjSZ9w8b0fz7N/kxShTUyXGBLm37MY45inzni3m3mb+r1xrEYs5kb8Zx15Wk7GoBV7m/UB3mboy0XZDufiZ94PsifH8MusAuaJjTvI1+zfcx9z/XS0pP8z+fTrsdbK1e/AeatmZeeZ234Cuzri/B1Y2D7I1swYs72R7w89rvuX4ukHtOf0mlo0C/me8hHgP/XtAm/IWz24C8ilYNeJaCBiclzTSdZbwHaDRjb8MblqCyr4LeLe2XlRtibeFMskePOE6Oq12nGsrtTKUobqJO4OtBpi/BfhLM2qF70lKhh98v2HagWpT29H7d4JsWPnhCWTozyOcPdlAIG/2gNsWo6WC/IM4G/0de9yPQYuXIa+22fWV9GR9xvtA2qs22lnqLl9n1iS+vwgcz+QZ+VjkCdgQ/eXPY7fsLeD5S5B5HnO/AY/Fw8FWtULWclSTqdaMWiLyd3A5A3Yaaz1KbUhBNgHmOR2zf/N5XVq2Rs3P16pl6s4C0bo0ZnVrFcdpjPb9WqDU1loV1urYKrVbjfnckeZgL3tZmklyX0FWHamGoAz48eJ3MJfWDjXNaNisLSzFfBT4DmIgZR24OsfR1N6Etep1wz2WT3ejjJyOQ8y76wzWYd9owD9ZwdYVSBc0rl73AWuPzqCjK72Vt+yjzbQK1iN3gDmjZT3ylvoqWOHnI8su9+vOUq83ZL3Zu+jXeaXXNCI490rPCsOeiz8X4eiC71PrpuwMhjLwAZWnYz1GEPWuA7nvji49OBO9ZCx7dH2tEY4iu9JzbdmL1IXuevCcF3krWwL5WOk3R5XeFWTldS313B7MS12PosZZX81hDo2TdtoOAOOS7wDwAq5rw8vpmc+uOdj71PrXuQQi19WivFhsm8vo7jo/we8lvdk4wx5UYPwLXl/bd21ptPIrXl2N4P9lvWmsdNiXflNd9K35ZeS2rzC3yGvCPK017F0Y6VFb6ltvYHv24qQ8m/k4Af/LS4ynou/av8h4ZST63ko8t2bP8mQbMDdej2PBfqwar6ProDK6assREJxeX796VqPsrRaLntWDc/MvcCaXUTSA9dgynMer17RPXn2AceVS7xoudKvxqpe0lR7ZryPMnXnbAE9Se0BsNTRwHNq3tIVw7e2vNubqgn5qX7AFNOnhHWDXhcdzpzCvD/3ogA+wLfQW9GXsuZUQdSvZbzG1hsW/Y+0i+uUpFgrY4xjQdZavvN6YrsjE96AdgrEl5M20xqfJ6Nq/7pgPsAEyr9FDXwTsI8bW7YytiG2f2ZWbrJ2TFmILAmyFG9ReO7U5tmk+A5bszW3Bh6JVbcN5pSs7WVvbH5yGELe9s6s+0ZeF9pG3nSKGoxoVzMvAdlXVE+go4PHeAbDCEt8Dn0WUA+piLcaiBBhT5rU8WEPDx8eWulVme1ELNvtH0gqCcvdUsIHs+7ny+pj0PYhnFZDRKOvEu5J3JDU/Y2xftqyA/ADau6RzwvhJoCqAw8Lru2PA2aCdCXgb1jYi26mndEAmM17ZUKzBw6tHYX+HYOuOSuGWf2+LbeXYGueZ+YmWE0/mJvALYHquuzZogwDdbTGGDHbeAvB8iG1HsW0F2HExs1/XmA66BjkGe3sGme2shyXCMmAPqOWOteGxcCP0qOVBCHrf3mC8ZTLsbfvzTN1uel6w36/JM9i6pt08h1RX6mL+Tog1/NcOs7kbjlPtmbYOuseZkV0SKl3DWYOezYyd1nnlx+DPYKukB3ORpmBL8Xah8zFi9DhkWB1kCbbFfadaH75e8+0n6EJq3yvazJJPic0rafmZpzPeboVhwAPox4XX6tF4abvYXCtw1rYD6IK3MwL+JlsK9BjlWGKtzRYw1Az0+XF8lcW+77LvffSP+cIo14G1D4kHyqSp7keRsWirP8HGXMyYn6eKGPyAdbsdE/gda6MuC1PYU7zNyEaTsJ1NherEbdmoWiHFq7eijeO0CbQO9nNHZTTGv7drqw7yFPK5ytqUnJAXWX0+6BH+XJ6G4JzGKCdUjGtgCxrx3bk4A80CO9dqhOjbFjKwj3ZOwi9I682QfJ7DkpBfKb8Cr2foeh9OWavWP7Vyri4i156G+aUz7cOwdQx7Ltvmhtmk8NMTOf7NcCZ4LY+B2D+tpJy8Ia/hCJPvYcuy2ZjnxGHcf1gSLYZEvLCKLbiu3L96W8fH4xy5nM8C2glWaKMBvcbDtBUOj8+FIIfCE+xZUm/F9oDHA0HeDsveEc57T77sbP0++xczm9KZwVpOLMfPmHHeY/o5wpppPKMA9GBF4m2/j+hHnDpKWneW7L/Ql2yOTGcAjwyrJb12dxbic14fA9hStGFzsWXVgLUsMxOZSrIBzmrF7NEB5eqmcvMN22+RjOf1gex7zi5OYhSyhC1X5iJvmNXJVWzKIUUs51RVoFlOd8R/MB68F3R55+v0dppgW5xyOBM9Mvhn2+fyj63DLQG9Yz4lXkuBeeNLtlZqo4b1q80z2CQYk+T74uxxzQHz4YV9B1s8qYSDE/nsIc+ALE3ecXk0x4DaxbbT5/JrxlbutWBgSWdtIIeZFo6aZq0Nll98906j4oPNxluwTnJ7VmLYB36uYey7NZtwRjD+zLQHB2qF3RT1h8n8HvB2EKTYNKV3wO1Y+wXzxDGTsb8wZ7BDHGxHH6Dvk3IZkRaxjoDTmrA3H80zL2dgrYz2ZB3wKbV8GkqGBvOxbtvgPeUJoO1JuRqm9UjF+4g5vfl5od3d2PcdmexZsGVPXbALZlSzksw5c8UJk3Ww7jsZpUnKAGwT4dfUvjJnP3b+2XNN5PGQYRbTsStfPNvKEbDh0nM9avcvzhZz1/jZ5vnzkpHtYv6IwZlMuqG5VAbldQTy2Umh/OgL4ZnkOexRgLjev8Az5Ae8kdsMDxU/X5Pmj9eF73k7gw1Grd0NsJlNx1CHcoC8+w7IW5xb6k8boj1kXMgv9dmZtpwl6gU411OwKuCR23WQTycnzy6aTLXCQecy/94PTwfy7TjSR2e4u+J5J2srV2Wwz7YjWdn6rRHnp2Dg2Bri1JnpVF29mI+w5W/OBsEYK56lfwW7r6muParB7R1gjJLeSP6/efbuW5zlsGcZLlptsv18QD+G6Ou9x3By1QE5AHJV0Wx1JGHdle04Gtj+9zjq5iySNVwqW19WYsALS7w24pMxed+ULBbL6jO+zpLK20QXytxbHR50hT4WfFfGvDQWu0lo9hZXyFKnUCc22ecdZn+TXcF58krtwNnYzH5poSwM0F/Pcqi4fZ3Ry3fyjHKZwF4GHDS763HE8FeCcUS8wkswn0qxLLAPV8yudlisvnQOPfgb4KPs+67Dkhdim0DQTUohP/C1otwN4Iz9JdfF2HfLpXwLwHTSHuyEpcZjymz9BtZ2sFgea6WIvK5k9zu/Fw/kSub993I/P16BziFb7VY3cBnBYjfqLrfXBToU/bQRXkUENIC5asyfbILMd5hcmF7fdj1UMhibFmsv6VjHvk/1SdHa1N2kJuax/xgyerLpiieO87idFSd46O5cK0jjJaD5xQj7ubUMXu8QgG0aLBBLZfcF+DDCHmIid/heb3ogd/H6GbqWqe/c9y7g/CnivW9ZXHbX8+EhDyXfL8DPol8ExYHncSaXZ85a+X65xXTh+d+Nn8R6+fiP62SY7Z/MvYKx102RHcVw/22/i0JdnPTJY/1igtv2p3yslM6zvSc4/n0wrzz/df4O/92OWXpWv+Az3NFg+eicf27X96BOw99yuXJXS1Q8L4aXHtHKsIQ6KIwQ12Zs1C2X2deg1WZ71qAY0A2242vO2GjF4xXj+YKc7WIeaub6NeR0Ud4GD4IHOCfXd+JeH72dAM9hz6hDJ/+uLbumxMa+EIU8gnm1ApOOL1+TiQNTHo9M+QfhYWdf7TrbRXe4QRk56zryn73a6aJbBslJHLPovdmzDZZ37wVbWG/f2psdXpM1xjxDjJUuq/l+HBH3+dXWZN8YzqI6kKluEWUcv65KroLcayLNpefzwBa+FPk/kBa+QlufjXFPT6k9i75OtWdJAeYXwVw11SI6K8JPVOeyQqw8aeVpy6fcDR1x5S777gc0lvXpXB9hnuyYPpej00sAY3kLkUdD+XmlkHq4Cd/KE73I93x0b383VMus5ekPaYWuSGqNyC+Sn0+FrX3Y23DfcVK7itdBwh5qdgOvFQRMvnawdhdlfxFOL01KZ3niOlfWQljYNMW+reFDG0/ZYY2iz/lqgvnKXPcRr7aSMbI+cNrnzHfZZ2BzFsvHZAw6C4o1AGbIjc3OD2jwlNhNdzRcaA/leDtwpcbejRr76Qrtop+HW16Hs+l85nt+9i97rpn14zm+g3xtmXalagFOgZ+q03BA3yquJZ0dy3asQt54zNfCVyNPYsw73Ice2Kqsdifh7y3VZqcxgISvnvktuZ2bifVt/urd+3Vj4f8BvDAY2Dphj8Facax16jNgfUgpPwWwnQbzPGfXAHa1upo0baqV5vGt7W3ch/+dYnO1iGI0uI4t1cY7yhNbCuWBcvSW59uYUoHcwOce+UdZvWzHkhSQEwLHgQ1z5/tO9pXZRgHVefslnIu/S7CXib+znMSs7/YBpqF3u5n3DmEeGVzJY/uZtvPDvN3ZjUfnB3hO4Fvxjjsf2608MxphC/XODZ+x/Qt3WDu3HZZELI/osBBHiuez+4Xr+oKPU+BHMefMHgfBuyV/ij3vMDbWDpW8SXo+OI4Uj1uG5Ld6P7oXBa/V3AQuu36oW0Z+w3rt8DAxZbCd2pkcmFfsV7CfXPxP3nV3/vRO4KU+4HfC4Bl/ZtrrmPcuANqqAb5QLczZAOzP/TbCh3iH4ZL4p6uzq0Ce881xFGMupQc4+ZzU7bzbGHu3Ux/8sr20Y+cA+3tJcgcjJ6baoHgt3nXl16dkY/n4mYS1RG3sI1UexCSrMrl6NubDSpyOWr1Djb9zAHIV9Noa8Gj6LF6n3DKwth5lHrt6muKCzo56ICyrelIP2FSW2TwPZgPkaqPFVQc0DvVpaLIcAswNH7nalWxS83XusNwF6leFuotyD3guAuXqUS3Yide0NnjPWJqz6LcrT6IK5f/ifOEzpNWL6OcwHWK/H4lyJ9k1llWs8cyck0L5hzx/IWa2zyvnNTgdvmfYryapw2V6gXxg+VhKUnOrjCKFtf1/K8YEk5JGOSlgl3PfrYF97Dlf3j0jbKls3PDOtrnlk4dxi+T8nHVGB/J4BZNRXKZnaFjYmFSne2X98da3su1WRtEVPk/enZM7gIULYyO3NUu3vRATXed613c3HT9j73N+SuWyf3kYH6Bx+N7u8Htpn0+6vjYCLPLz3epdPsNTOXzKvlfgf9Gq2CsOscyQXavEYzjGo3Wm17zV5QnYP6w/BbODeI1WGLUbXO7d4ebwDvczDJpe4daxXk83shGwcfVd6K3hbR+EW9wr8GtyHd1aebcau2drHdhyzcSeUrJjpTYNximcC8kKS07HU3cngbXHTWUPnx3xmotJDLQUga7m5242FB2vo9EKzpq+ZybXCJYzV2vuNFkD/FXBnp4NS9K72FeeetWzNdO15RlsiVdeh/5K5s+2P9jV2GkdK9qzHZVfdULvXcN7Kmuekx13HOEzS+THRuRfdmSKaVBvfaQh6hWEfkHzTDm3WFsJe/vaqyV7dgzKPeU2RyeVXQvx3o+E93GPSniFTDXEuzS62X13JJD/2F9XkYO6dNbTfI47vpmUgyd8o5SB/gvpwJBC0M+aR1dwrT3NkB/5T5heeB/iGul6lT/RDw10cX03F3wtXE5Jyf5vqQ69tVc6yWfnxShydn7mszv64Hn2XO5qKG8BF6XyUL3BXcUYDXANnBfoXj4OYHX/gP7ZSUR56AvEZn7cO4j3UW0W5saXsH5bUlIdgP71jOx9gMPEfggeAHsh7kbKid0jIWoJNPSRsDzWOMHT2/82vJahW+bfvjkrmeqHGiyubWA9N+lrl8XT7jGag3kTRqofsv2oBndXW6X+5OvmLrc8U3OzF7FD0b8ec8zv7JPrFmUs4E7CM8g3Ka6+brku3cUm0URBHk/2DK/bHD1lzx6+m8QA4DlORzr5HrxLBWMjhyzewZgb31Puk7cfvP8WM/s/qIfxGu1pHe3qVCYn933wazHLUoKB/aEToj4VOT+d2n2uobBVh2VVhvOvpL6nTM5iLu4n8nYWuT0W8YabXKxbO1JcY4+/3+bI3NhUKO8y/tEwzanosp4DmPsd+qGS5lfd2JTa3ZpwTNxTdTcpBdlcqAf+t5s5UB+WAHtssDp3VVlhXtskdk44BpxxjHQZYP9prHuEdc4e+Juy/PbQf5d9BuQM6JqKX2zfZs4C484i943ZWrf8lPTuc8VZpnGZnD5Hv6ToBy3jlYVBwZWfuTgVYBC9PZQUc2DrSU3svY5IfD03876JTWbt5Lu4pcgBSfeowK5X3ocP82o+lYOY+1REZ/l5gW0TMlye+OFza7qlQbLdsd7mMnWS6+w2D/wH+bGKaDe/xkL/dfG8Mr7o9Fq9m7U9eOZLc83zTd7ncfNZ8VkW89k9HT6LJz+eU/gkR+sr+SelYDMqaz7o6GOR3sX3YI9XOItyN3vN9br6sB5Ju5y/Ot+i3CrBc6LuOe1VLGpeUox9wDg0xahBRt/se/qZo6zQd/Ik1pUdp8BGpus/c88A7f+plYML4JwYZD3SM/ln7mRwSQM5qV4x1zWTR7pGvch0Q3o/h8gNgfHwLhUJdOCT+NkI6WcAeAVsmJxdlp1n5hp4Fp+yZKxlwtw7tQGyzLSZPxhsXj1fVz5IfLcoLxDHzVi9yDzxJ6U2mHKlq+ej8IJYhuNP7AHSBgw1wytvMQ5mXxju471+ijFlGfCrWwFsomFdg8BswkZSrdDTwC7qW7bTd2psPOy5MAY81XXRN0U5Cl8fG2uVGwtnEDK705ZCG/YIe2Dh/t7loWR5pIt1qe7P4hjyJ3tiOB67dhvvEBN4mPpLsn6ArM72b60D44/v9pKNeV/r9/f2BnMLKW5uywOx73jNtiYbpkOxdNCPodO31njfGe9LV0BD1H8Z+A17ombrOBI9eh/7pTsAGe3JE4wBdx3pY1ir/IVXwYKsYWNRH4uETshuHkoVbLKf4nSsb63LA7xDKE+zlUnmu7RGyq9jfWVv79oCGa5cMf7Cam/4nUSxFo7SmAzGAlMfLt7hoSplrBOblH1un54y18Szu4nwXLrkx/TveSzBW2TbPojtkT2+fQfbGfukcH157xdL7i9aP8AOX89HZbSK70FfBs+rlLEeouo4aWyT6Zums3539kIGY61cNB7OFU2u1kEeDUzef24oLd7RJnAklPfKEO/e4t8hOYd7QLYdW28utxF9p/i5sEmx/wX2j5yW4TyFnQq4gnqWmQ2My9zqvJjZ6Vh3IvJS+P0JoYI9C46jUijsmW0b+MCSA7AX23HOP1tL+piCbK/IXrZuqKkdvdZayc5zBPhsmvMfpevhOmo5KRkVjrHJ1830PPa9ox5J9Dm7F1CT/DL12Nqw3gDha8JrWT1CNl14CASN8zmPqJ6R+t/c+XZons6e+VmSsbdBtkYsVyOF/kGqZTNY/O9h/lBDSesDcU0F37mvS4H9lxPe+fr+p/JmUg4Qj7JeCci/Q4aL8WywFzTrA4TrVxFrZ2lcBSxiG5l8a+FX87lv832Yzc+8txPvcgrJ9srX1eA9JYD3L6w+5UFu5n2dSxLzfZCzCTwANp6rV4bZPY11kM+E2dgzZQ1s2BD74M1EbJxql1BuYt+TFPcn9uHN/pL9hzV/Hre70f7D/G1+N0J2P+/9nbWbnN/MONmc0V/Rc5kckAydO5Mx2FEoUx3Wb57n/CCeesvm4OXyIB/lR36eD0vxlALbI4f5c/P7cs5+lm9ucuVvcwyK9yb//dsc/ve6jPrp57v7+D2FeIj9O70/mV/X/ezdEuXyPx6/eA9+hY4/taHYe4pyxW7OqyBvB+t1Yg9zG49ZfxbP5Qfar2hYb5rovQexD57fR7oZ43XYY8kjjLD7qxNl5eYpl3/cx6u8l0LmsdzhmXnnyyDZzvAX9nVZ/0uvdrqvneB+c9d2MG70LnpfF8Z70rkibjzDWgFrhWBrOLOCcYtyo1I/n5gXi8skGCubt4L9g7wS2JjLXI22wCk/frnmDmMq3C8o9PWY5Tgr7y710uL9zgrsd5YLI/A/9s25AGb9E/Zd/A39INT78Vfk2BfG3bI4gnTRVz2pd7Vfe3XhG8uvReTZYt039exxxZ1kZAO9OxLg4q/NgzAI+x71n8L+eiuGlapZHJ/0RwJ5I/sx3Umx5330vvIe7NeW6mV83zC/JtFf0MP76Ch3uDCPLX+m3P7CnjF87UAbxsm/bo6sT3PlJk7BepF9LV6hYI8FzBM86vXRVS+ofUVbyrThjY6GMsA2G4Y5cIL+UHIayCOGqryDfQK8o72DPdbI5omkOfw5n9Qm7QO6eZCfltoCN/mwz+wGtPuq9jpQ7+ouwYYE3PNXZw32+RLkBqwjH2vTPZQVlun/0K7kSy++77sGn9/c953fL95jdK3MrIY6dh2laThG3azdjGufe4DPme+2gXk52N/FTz5P/36eGaH2bjmKY0uOifGb3pN32mtnAO/FXM73wXqrgs1t0XcQs7H+Z5j/24SfDNPAZ92SEQZLwNxg32J8I9PDgPqHsnvZ1z+K6/jBHsF7G9zBxr342b5kMettiXHgyrHrKqzfBfb6ol79e6zHjrsu4UfeW39xnMDfqd9TXcJa+BLYuqDLTs+wZIIp82Nl+uivZN53De0YecV9YUfQsYDDT6KfsjKJnBLDxFukp2tR7Kgg/4x6RQ1LoLNXWB8w2o3KAWBs0mnMplcV5l9wlBnvnQ961wup7znyAd7zKe8u6HfMxpkz8exFcJXpLABf7nx+/wbtH83X30/BlkztdthzwuhfuLcR8dddDAX7P1QAExpXdg/gYqnJpxPLC0jqRGygNXUI2nxgy7l6Y1Fb8j5MYsqEW2md8Zrngqhl97rZ9xwJY+47orNl4Pdqt7XZC/RfgM48kz/jHf1PLQ3tyRPeSdFptuMh9kKuN/COGfbMkPIMsP/dCu9gRD0UNLFnEuVOJj0ksvTM/TpKkY/hK/dOdtSn+cF75ptoy3oL/TdZv/OJ333G1ndvo7J5FNiQCU64n7O2BFlz6tVHko72d1NZttXs3a+DE/pIxk1nAXt0EflOHMNM4Ex4rhn5MsRdOmmNhySDzEzqjB/YR285WnBLbG7uVQ2GlgwyRd+w/mcijrIQ9A2YVynDfog+jx/UB6bM7lAq6smS2ROMD4dP94rJFuVLvJGPD2B/r48uYOQJ3TmHWNEZ2Xine8Np3OwJjw3Y93lB9bef3CfG9xXzqKgmJctbd/eGZfOBcr1dWjpgdrTv0ntveS+ZDfUdSfriaPLYPa/THh+pv9znuZdgc2P8MqHBTF6Akj7jUd83qsMvyhmOyB+T9W1SrdL7kHIUMc5HffPonokUdyX1Usx3meDr1QRj+5Z846elO+bT/AWyJaTb72bj5wX+IlibNZK6EfbiEn1nFrkcKqDFd9CVdQtsn8GK6ot3KZ63FWaT3+cCJbTZTPcFxkrqKNC+eUf/EK7tl+3AE8ZKNLzHFTDEzFkrPceWMW7iOI3FO9VemWmNNechJedHD3dpfQ322jCT+BPzYyKP1Chm08QYCcYdhtTvbmHd9s0AjJD4fiYljfrtI217yzxeuKHdpehP2rnt0Qf6hvRzrm8vxu1GOTnwBTxA9BOUBko292woM/obyj+3dE9YCfY7svFOG6RBtIGv7lUDOZPNLbO36L8EvXG6kTepXElwrrgbZJHJi77Na0G7IPHd8D5GgxQTwxkbDdUGW17Ig8w5JH+rmw21D2eYqfFgcTrQux/9iNXiuqV9cFtX+6u+v+d12Y/x2IP63f+C7y8UeILZxBTrTPoQ/Uh7ydys67oVfLAr6BPzI5Pff5tfdm8LPaonuG5z553Pi7vLvflxy48Dp6olefq1oIC+72vB+9FNrAjtGRtr+gzqt0H5U6K/x3V7K9uSmB/Gx4ZS2Cheb96/l9AV3uNcNmajyIkQb5MPOuMTzjyX7dGxK6ob7sei3va+NuimL9OPT+1J8i3hHWbnoyencrMf5/Nuip4pwPuP8pZ+3OexFPSAoj0prpPrRw91Q8EZcDrDO0DQfic9plXwnhPKt4sHm1t6SmqqQqxr71FOg4a6G+tCHYX3cPZ/8L4N9+981Fsqx0tJj6ncfnTv+03d0bvZUB7R+ZN6EnjPV3HIbe2SwCVD6RZHZWvARG9d3mPExrFAnwHPufaBbDOMI2ViqOl8VO5PWixGZcqd/BRfjVkdDc0PfWwUj63JIh6bj9tlcwTLmIcRwBm0N8/3I/EBJtio2/xMZuT024n1w/wEf6V3dVRu8d+jPggoBx/mSTfVmHJZyAYWdzaktdl+LRdnZpiF4RU230su5jsY2Pg7q3m+ieEIfEm9Uodl5FMD+/qBzSKJeewoB/cuLp/3Mw3N8618pXsRBnalIWTrI1rK90UA+9VhWOWWZ5I8BvRTOW94Vseb8yaZK84g568hTFdh9xA6or5zke2DuuE4etspgU3dfH3UUzLb9wZ7igp6R79k5o4K+Y53i/1H6sofOqgfZrk6u3we8uaX7Y8kfoA2NOfNFdp9zA7C+12YHfRoXvf20oM1U11XQPdjgo3rgo6nuq4H46JPPHr9gf2ZR2Xt6Ne3hf7n/mpQ6l3R17gXeWmf7IGYp8g/WT+ab0ixniZgrPs5Xv0m6NkCe+lev7AeH1iriz2R7YbStyWM/1Uor9/D+7fNYqyc5A4O9RPa2Wnsnfm98zVVYO8A/wxkxbakPdY5F8Rh3u7y3em+S+xndN0+lV3iuZRusPZW9PUPZ2B/fYBMIvzgo06MSd/zmEwQzB7I8oyduE96rVxz/acEhn06v+RexOdylc8n6c0iMPG2KD850xc88Rlgnv+TuOLN+Dc5Elij8Yl9+fWxhV+E+qqQvQJYoYf50JqsvVuNM8YbamAPdXlujuhPz++IPMVAj1jnWjfts5b4UDI5hL9gw2RxSdVuhEm9BYzXM2zMT1SyubLbL6/zF3rKAJ4CDKfpvOYfc8AdS31UG3fDCw2qte181i82zZFT6+TDwvEExiFfOcsdGZbE3X0i/n0CuvfwLtIU76SyHfMZuO3AchmwLwN7XqP/U31gcyf6eoLdhToDe5ZTP6cUF7N+p0ivWCuS5DllcvnEfTQzlJNMv4p323iPR0R3f9aqmVrP0zxjlxfkj7Lv3NaHsv4Uqe0naiA9vI8nvLX1qf9QpsZT4Bm2B0jvI5d6RmXyPAr6ZZJ9GAKeCFTM/8easYGNfT5B9sqKbjq6PmBxpu19T7rkXXiHPKzFQVmDMcsL2Tdx0lcsOavnz2J/U+I9UU/upD1lMnfC3cUVqhe8o4zVLyriHti7M2I5k0jXBsavkN+xjzHqm3c7DGcDaQF4NWDyP6mhETRtbxKZXquC3tLxTtm/ujyvDzBFPG4NFEPcGZnSLLvbo049XJKaGrxz4avyk98FKmQ93jUF8mog/r4gvYx/l50+5jibtqc9lke3PozNPNVVPJac76u3Jawj+hfxZwtqX3guSoIXHuS9fSHuKsZQ7/tqwXvJF8/lT2Evbt7LNek/InLacK38fER/Z/LFwdgS2j/oByTZJyk1jIk61OekMFaX691A+nWoVzAXe+IoiwDvfsb6m6QGLJ/Xws5NgfViDdeOaIG9V7WdhqPbKuWWUC/l5C4fmdXSDwHbTZpnutOI0QIbG+R405I1/cm5AwYM8H7sxNeTzanrL6tNFstkPY8n0f7J5x7mDjz6vHC/6HxVZY05pZncsR+pLoJnsncuYR4Dv1tkGmXPzlGS++sjGcZ4U8QY/O8ZWwE/y+ip5hZ9RAe8mwFkEpsvlyWcx/HvlEOJ9+tSHGmNd8kaVoD+kcv8YY/RbD5OwiMJL5z4HVd4R51/i1+ZLInUNd7/QLqwnPEpYe0t8x3k44psvoiNUAbPWG6r8xrUFnw8jIXvbt+V3xvW2wJweWXht3T43iDl7xsbje4eUllfX9KBjkI1gZSnZubqSMU9aEjDxXmNj/2ipMfFHG76kGbrxwrj57lxb3qyPBk3r4OZTLr1sS+81jrO9pR8gPVu+qNkarEL9BePQ9MZiDuMn/ZnTejpnL1btXCPOb0BHXmoF1ltI/mK031hd/FJz/YNZVD2bNH3MLBkjNUKzCBrtqhhvRTSNbufXVXwzoHLLV9kYoH5PHA2f7DTMdeI7kIs5AOvSfcy8neldUlfeUeKx4yl0H3orxsxu3/G7izCvQd8QnZ40lcxxeaqkvQ/w5weR9WqA3nwzOZZj0S9SaYukOcJxJ1c31KixfT5bF1fS3/8nU/fm4s/83xObhuodAcKy5vL7MsoUqQx1fOFFMsCOqX8HI3XZjzAl7zGzcBee0RHlBvlYMwvrKEdRf1An9gbnA743Ylgz5Tx/hi6S0LQA+C7lGeKeCvpW13W95PSPkMbOXpFf0YWyxXGGdkdbBVxX+4myUkxA7zDqQl80jLRhmI9Tnd0tyXm5awk1PF9w8yv78YHxu63jHPybYV21V1PoMz9guys8O6fswy2QMkzqzXD9t7tNX1WETZF5i5E7AGQf4foB1QWsaDX+QRsR1Gv327Qnl2Axiiu1i3R/Z54D2Iu55vfJXQAuyTk9xKGeG/RvVwQuviMsR6sT8ni60fyLb0/EfA00VzBeY8jjOVUsPaV+SVNsENV7ImiAjautG7kVLInqRxBXLaX/S/RWOIrEeMkOZsTrIMs5foBCPlRx3g67wlgAW/YrA8MxWLVId6dtg7B/sH8D8J3pmGfVcY/an0gOQP4Th/zQJ7w++18bmKy61udeHsPBKcrsReJf2GL/iq/hLSHMvIMdibwQ61ANtae1STcjJvG7/aA+273C3WqKnpii3vmUpn9BDdy+SRwf/HdPQH5fRynSj5Hp4Fn8aAG/v+hbsvEelPajKuYt7jJnNttffyu/cx+ehY/yfge7vuvCn0fNm7qADL4Kd8PNO2Rhb9X3AHI+1vf6n9Nvifz5+eBdy3MWT/ezB7kai6K7kWQFdVVq/m+lg9kFeuRZm+4n4Lu9uC5WVV7Ld/5jtuXahXk+hHvbwVZtAbZyGUS1p29zj28h1L4eKjHFNVgHr2Y7pj/gfJ0QnfOatcbOZraP0xn5+4gYHrEyPlbmE1qY71X7NiVLuijIcy74TjYtzWYIXaxQl3jfrr7fYiDC+vpn97PmLXV73orFuniyBG57IRHb/JeEj5C+c5pozwCu2hIMYn5Nm9zOVg3Xhkma7Q3uXvG01z7XdavRr46oq2ivvoParEEXSbrZHZF+w4/M98D2hLdxL8mZLgO/9SCGrpbOnYiL6I6Aqq1Qv7OyIIN7z2e8zdqchVsLl2zhV+L+a4BY1UaqPOGklfFXMoC+jQ9xLcgVweAw8w0tyu5jxhk/JZybK87vFt547nqLmguKu3GwnZU1jNyVKL7hrGHxSGnk2u9Od2BR3mfzpX1Fwzx/mdpDNi63aBa0wG/Fx39QoC1yX96nZTO2b6FRGfs7mmj1s3lizH/HtDeMkM35C+hszGzsiShiQe2QG4shTBwrm/0DZYNDezfYH9m330Rg34mb8S55mIDubtOhtreY/oi59/4An79ShyiCM+if7XQ3ybuYbzzGaD8SfaT65UM5rmRwUktlPCl3t7FMojoXsnM3ZcgGy/8fr/83SyUt400Qrl7TX4XpUnYn+vA9G/+5e4Ol0/6OLP+7MPh7tytz0/s/iLK12dzWWL80UEcAjaRMwJ54HDd4Vhr1cX74ge21oM9fSTL2d6ze0PYPZx3ed2gL1xnfefHyNRRWxHwaEF9NMiCPsfta1y3V0L/TnofqcijY71MZRob+9MAn+4Ik9E9qdSLFdb6WpSzTeeHvSnT77C1aHnfZ+e+RvTmbsnsZ1RLcOO3i4HPW2R/XDsNwg8qo5d8Dk3hv2d2xFrpWQ26H3kGOEe/4/faHbYRuREZDLB4ktP3oL/3l/Tnja1aNjDmsv6KLs3GE4viXSkdMdmM+cNYz9zO5yLnfGndez9aNlf1s3WydzzZtwn2W4thrtSf+9F4f0u3Psu5pJ49Jsv96XF/xrvNZGZ6j4CEtW2eXVS7IPSinZwl3U28wjpskD17uqcX5oC5NN1h5hybac4f68Fr81wlvP/258P3DJK7t6vZ+7qTfobYZ5P3VEBZu8CYKej5A92NzvoJY4+C9E7u+VN6B7rg/QVof9ebR/yB8T/uixf4cgH48hO6Zj32po6SxG+y+fBAc2BvA8/m7K8Cv2aebvO9ch/NN8EIHp0B1eQntCnit7lxc5/zfkRJjn16R7rDfWAa9gZ8v7dDntFzkc/zzPcA63URvwSJbwGwYWNA9xGSbsc4q421CA/vJnrEn1/CM78iU9HXIeRqLiYteusU37PLdUo3dk6sBjypV1G+mNcxz8Ti4DtZHHK+ixHexDo+xWOiRwZhk1q1xrDEguJm6Mt7pIc+WZeKvuaBFPZMm8fHc3cz3KzpNv7YurMJFYwdm/gcy2l5mufy6Cz+X+rhjP1qWtK5B/RcNzO19LZM9tY73kcCZ1VNck+ymB/zc5epT7Ggvot6F5NvFOyHacsAvm5j3/aTz+8MvMeeBfUpn2J7jOcbswH6j9H/d+tbeJSDI/C86INO8vS8m+ax3aqt6jLFXMs98oXRe1sgR5YiL8Pm946DvmM23scYxulirNitXJnNUN3B/K94f8oIMeKF33mf8yHnfNCpr5adf5jc9UH9KkjfZHx16KsGvTN0pAnV9IUr5hfXKjl906I+P/Mk3snvWw+G5LsHG3Rxx2NFvYBE/JSt287rqH/SO4Sfj/pn5e6ST2ub0dYOlqd5B/5R7MmSKQ+2i/ZxUifUO8H/gfbkbVCXb+5FZ7VI2uVn3L2vG6axHtbCo2+wzO8EgjX6ov8f+7v4/en9Qax+l9kVdKdMvmc6+lZK7N7iNB8cdQzIyl4aC6muxs1wR76sFtBqjDYF0evBxnxS9zXZJ5BXa3iPAjy4TP0OFeCXqsrsH5RnDZbHjT4HFv9HXkf8A7auluxRd22ozrriWI3Tl+50J96D99OZDG/m2QgHhsnmhzjp9nPQ8a4VOj0LcAn1DMB+fksRc8qc2TK9/0DYisk6ZYXqwH9hrgv0qQL+KQ/Rv1om7M3rCwEfYT25q5c9obObihy0qnKA59CkOhD4vraYJrYC2oXqOskf4DnnWA8/AYyK+d4YU+5cUtp9lC+Rib0m50V2qVnFmjJOn/QZp09Wl5LN5yd+Mdfzd7BvQA+PACs4jop92Ng92cgfgCmS3hEZWXz0Ig97NQH2fDvlfIpMh4l++EfsH24Az4Jc2gWq6OOvXHCdI8xjKmHOli4Bzd/Lfcztj3X0LWKt9GqM8vWy4LSO/fEN0AWDA+UPuZVjB/3nPJflXsdm5rSsiFwe7PlyOx76HJJ5Am+oiOeY/1FtUO4Rp+EijEd3cdC+fsFf8LU1ghyoUG3kJPq5QVkgcuQe6EnkCfLdPcUGmTVivSXdhYY5fk19Q3n4sS55QKfd27PkfSgdwOFOg/LA+Bz9R/N5UPud6yGVf2eko64Mi2yYoLQguy1DNxSfwzsR/UztdAEe3GN/ebojBujdoxp78nPPuybjt26EOfsK6M/KdnR5aN9n6vuzY77Oe7W8nAbsoRu2kulreL83VEvM7sTL0if/fbCZwPid+tuht7LJd0g9bzDvM6kjuBuT9SIrORU4uxnlajedEvM/b570zSC6+fCG6wOjX3ZnKNcX8dPzqxXLqGf1v1hnzOQk0j+Li3Swd7rJab2k/dWN6J6cwwTOAtayh33HPlilseuUhWxzS0rkIf/Ut4lM6lzeSrplX/VQ2n46n8S2eNsMYu0I+wY6MzwBJiU/JrwXfRPMp2ltvnZ33JN8brA7YGpqn+XOgqxVsYYYdDnaBcJ/kc25e3YXXaIDdMRD/5e6N1tPHGm6hS/oO/gkMFXFIfOMmSQEZ0aYUQxdYDNc/R8rIlNKCeFyv93v3vs/6KfLIKRUDjHHWlbaHhw6uT7ZwYvBttqEj/g8nmLYdpnpDrxojdIp31D3/vM8wnZQa1HiGJCpY767L8wzQD6WKZfie+OZD/WIWQl5Qf627ON0e/VxT0C+/nnM4GYV3m70mCFms/3THkadRnfj2J375ASbETWLNM/LzrBwVtyKpIMGF9JDiR609P+gb9hOk7H8X5jnb8j3GG6wa/l1F3HEF85HlYCH27S+u54JHp9wriRnLfPJecPonPVo//MZSHIXxvxU6Nuh1IA91SGKEwD6A30180yV/JxA8KyD4oJs2Eo7tMVzlzeO7+K7eXUs2J/LRYn3igffm86906hf+F6ulesxbsDTuBFqyDmGYvu3b9oWSX2lxk969uhluBeMa1jw/L51rXiWO2HcsAjHLro+q5/NeuGSmONIhn21jgbOhOpzDNfvT7pW4ug59OMBH4p0LnBUCr/gk03GAxW7jI3JGTp2FX7eU5mn7G8f+Jte4dApvVw6YX+ixChn9YTsuhXb4tsjl1RQudV8dsbx5fmN9velEfbgFI/Q7TOF59OoFpuDktQtTMjuQC7iHX3a4/5Hig39PA5U1X5RtzPL5H+TX630yzbdht6dSQZdL4ZdKXuz3j1OgVldyo2Gzrw9dK6deO5V22WIK6s1EAwsO/062G/0vemzJ7CJE/I46WemjP+5baj7oKbANmBbsJlDD/O8tnyOh839tg89FAqTO46FjJiAxmBK+ukKiyWND4I51/xSdG2r5HPPQnuNngT/o426LMH+uAiWk+Biabwtfq57ur4GlnBEVxA3DPFehiNrSrrcwDDahTqIuXeEK0zkyghxvArHgLXs6QHPAjFK1GmNh8VfvEeAi7fN1xALHNm+cW23M+Jca+dp7b5wyYkujOYGca/rEfVl7Zt/HN8rP7y0GA+4Im7KDiT7DfntVm26TZHRBv8VfkO+UTVvc20XyTDdjy66EOvY/3CAK+7kKwPUL+ymn1hf8hMg946N0mTZqf26dDYN+DAVxDwZBz8IFoLP3VzIb9Pi0bIntR5gzqy16LG2nje7WZEa1mh+zXXUcn8EjENrijh7z71F15I87g3cVbV/u/D+9jLTbW+cOi94njpvq900xWdS+0POfiGW7ybf+ZfeOzuW96XkPf7fmPeod3G6/WP9Qrxm4Yv5Kd7If0ONh+5VFAwi7v1TmGQliS3SGnOccjK+5MMeKGVv0OLR+5DfsS5cO+VGhJ2JM7GTWkbSJWeJ+XA9g2DKDXM388zTWb8mzvQWdXfie28PGpMw5F5O5vTrg9t7ahwVONjXILFfmQfhq/2aLg9yvdG22QGfoLGHy6MK+FfccnxfV1kH0zPwHgt6pzz9F88hqBhwo8J28ussO6gxBlVFfK6vMOOMNcFeQn7GwfkCtwTHR13uvxw91ix/0Yv7lS8b6vWkvAKW6+A0TbHXI/0TnQ0HecRb2F8JXbiYjYFzttU1w+o5qWftua0nOWgeUzvoohapN6igpk+wgJ6cw7RnfiBG+Sa23vULfG7+r1MCn3gx9j5+JvgxZZ5xFXcvPfSOCudGij6LnU/Pxzlge5HkK/2dlg8P7XfF51jNtsxnl5/F3roH8m1/63PBfUqlFfhbtrMazrd9nK2XEkuADCD7503iC9dGydIcGqv5bXt8WsOi/TP1rK/jYKjdrP5+YgtjLj5gD07F5+f7pcyFqoX9/h5VWAqY5xPJhPW0Vln698OyVe/wWjLeK+0r2T8B+bKXpS964I6++Og7W3K9wGgMP+uGn32l0425VD1Vxp7NdlV+i/mHOUYT9bnL9eodDrrnHXaTYPVqHEjsMTfeo/y8j+RnM8RxOiw1R4vsK/Rv8hlCz+a3zhrGMh8H3IMZfy9Xak8zjL39I3EGgXeRj9tZqfnJkI9Hxza0vI90SdrvHvVi1LMd6wcPudq0PjT4GKI+baWbwEcDvRLWCCp7vL1vmvbgqVGuaHtyx3mr2gBYMxyPfh+uFOaf1hVFfSaxR02cmwc5/W/rOs7fO06q/vtKr+l11uOYsm/Rf1ibJP9FuJ9c1Dr76bJb1Saa8hb7i+tnyoV/IM9DnhiyA3Mj1JCMrEG1Fb/XmbF7h4Vdo1z87JT9rIyncGmUL6nnFvmlzrrwF6057KS/WpvOsz4S9IAxn7ahw5/xfDBWLZ31k45RtpP5NZJ5fmYlNQcRFyjtvcLpee6tkOkUYrls2PqB6hFIsQminHBaDgFzYuQaTsl3HFaqo+EfYhU4W1GsXGxTvY9Itij9lJ6L+nNssLiG3nu7HJ7F6H/rWK6M4wsbJ4xDIxYX2zNKTxSkj0xhA3xLJssaBohThjXXD+P4OzqvaKHeasbXXlezcXM7GRZfXteFw3uJxwoMedofSz5Xb8BILxVfjP0cfjfzpAZotu+EnzGek3z2pD5ez5GVOkcaC0LGGNqI0scV6j6NxyG+F+0FktHurb1bkU+k+0eW8huDX+hZz3V8TbpNp7KqOsGgOq4OUtZG1QfWrnHfg+P/er7/HJ/8Sl9FcSsV65F4gPbRaA8AD7qrueG0riA5wL0/KZy8063k/OJxIvHNNH4zsJlJxu+qpH8SuAcPflVkt8BvU3Y3cymy7pM1VP/W3xXoWon/MGbO7QVYYJAHYXxac/s99D/VLlJzxPn7+SfqW8k3sqeZJdf8MG4s+Qjm+71i/m/2DnXis6wPnX3k3pCdH/LI+beXb/g8eakrkTw16zDxZeNxCdSNyrPmCz8bnFnfZDv5p7nqL3Qe3Webou8+VdwwRdflJVee0HNSLyp1Pl6EC/hMn4TxhAH2lUPrVplynZHqXUjpZ6Y9lO3E5pD2BeoOV8DTR/60vS9u2mPGg1O1d9Ye+R7OH3jACSHdM1xeSX4zfnqin8u0e6L4Xmyvhv62xzyXsTif9EsZPjn56N1OeuzpAn8wA7xztsWC/G5atpPxkvQ9wnY7YhshH6+K72v86sIXmJNi8yMeq+xstaac34HPI7mdcjzGElvb1BqVRC4TNkjhqd8Y1bOUDB/yac3Gi14PtaaGz4j3sc/6fj++UVf/EeVtVf1NFWsZOKmxx0T9TetO9uUyNSa4m2RWn/PMi2ErKKwz9yT+COq4ozXbP+ufYPt11z0gRhHp1MvS4DX+fNZDoGxf9GI+kfNP8iwPOiBVl6u8K8v9A8lH1OnTnmnmtB8CP9TfdRcJWbUVv/ZJXPUrXWDML8m5j8nNiCk+eRfmZDTGJvVYrBfYl/lP6mafyKin9S8sb8Y55Ml+J+XH03lI08E65zLOZaTmJuTB+mHgWqrPolq8eJwy8rNNnManvFrldN1rYs++3R5yOmk1l4qn75qRvIvmcwogtxXn8TzOGfxcX4R9dQqT+AlfkrJFnmDqqt8CU9fqlLeZbz1fc1SU7XD+BK8P72FJHancN71mUM8Z+Cge8MQK+97QX0puDt9f9gMnNx66TfJ7ba79eqw/VfscNUfia+Tlt1EOiO556jzD2qHfGTaUrtP/Q68gOF2OC8+N8bssFNfsrZu19m2uZdiemhZw3YIh+fxdehfnacxRz2v1/HvqBfMe8xz0W48YIzw+jpcomxScohecE+TJ/T3Z23St8EYEwfwmeiw8A+vGejQmm533wwC4/qd2Zkr2DTC9ilIHeCveJ5nqaeI1luBQfRu7d4WVB5yjDNecmf1MqA3b4V7uTdd6tuk5jae8wIhl8Z5Uulp8iU75aui/S74zKty6pYPSuXMTvyi9PrQOedXP4/ftnebvAL/aYNceLZmTFHx7k6xRK3ArVgWbFjl0WrPIBoDPfI54Z+n7etWeMWc3atUCjZeCOoI7eqtgG7MtoXBy1f7ccExL8Hk/GpXK0s90yYep3hS3LvY6amJ2IpuBgV+F/BK8jLD/urql5077jt2B/EAdS2hD69rfsj3zRme1dk34j1vExXqOiaPGuV+uWRA5xHOm8r9Sy+DfVr+nY5d5Gv27zXUpcXtE1Qfg3tKv/+GHXBhz3w+u8C9+hs8fsz0V/qY1tHmdVY0+8AZPkAFvHvyUwj6BewaZ/vBO39Bj+B37gcZzeP1Rqym8vcEH4zSXcw/3f67LdA1R9eJzDdGScbHFB5W54HnTeXyb50LVsBf2z3uzWN8eZzTXjzZud0PneUV2MbDI4W/m2bdNj+M9vjNiFvUu63WsD3B04+fJnbgVd8g9kU9zIp1lf1g8o9/8TdZ86XsuMGC34fik/h39x8fJjnGFArJHlqT7uf8CPVHwFZm7ATUpdF7Ih0zDMrK5n+UmNSzRGVQYSrrHAxgcbAuofsox1gS/e1n2YWPQnppliwey6+PP4N+vGBuesd7XxSyNbQs5hH4a/BtxBvhR0Vntoo8BmNkBapFj+eGRlahDV3XCo2tin29Ta0yYl1NhWviulRpLAw8Z6bGNxtFp1Sv53oixoKK1rp6v7VF1TjbF3WeeR8bb/jHhuN3p2X11nci6ebvQfw3l8xYO9F75Tolr+sOzO85WmJ8N/JPgnUCdjeLAjt5haF2BtzdbF/av68t5nD3tn/ozSqbSHBxes5Xf5BD+1PKz55jYkIVn/tO1V0vIl9Efa42v83EeWAZ5et+9somMd6wyT7NXvexf9xhT42c6/3jqvRP3sdWzDt+qp5Qz5dBa07hUn44/PD2+Y6gforVv3XncWMMf9Jt8Z3NO5xR/VheNfMy4Lz0mI9zPur5mvsoLqv2PZ/2x71Zs+WnpwnVyTiWPHtau61wd9CqOtu7Ccd0e58u+zstKzSevSyXmF6l6vohjuJaG3yT1cD2P8wTI64pdd1v+72tA52B/+dEoHX9568Jf7WHhd8s9/c+iah169+OsM7Rynnv63Xat/11U8X9bPhvlf41vp7M3+nVslA507WHTXh+OvVuf7EB9LvoP9Wh6LCm661GHj5WuitXQoFeZ9gz0b8Yl2SXchK3yrx8Y/6J8oPe5vtOYzo3S6Ti+5355ZAt/KY/+UD+u1q00quTRszkCVmbfbab1hYU+SvPmow/0aNbMRvk+g8MkQ3MFuc39+jm6brBgXl6JtT7Ysf3xgHPiwHcEN9Qssl+VncTYzD9hnwr/VvFAdtoW+WayA1azfffIWAKQVXuyn6BrdO4stGlZn8Cabf2tGFLE6Yfvf6k6nb/Epo2dAV2LXxrZ7qsR6+b6S9YNak6gz+bjrsWxu2peehHk/omxkU1SLpixYb6X9rG8urubjqe7WO8f48+m1hRyjoBkwI10xcFfz32vhLNytl1vNfG8q+9v8v5svd23xZZUOPWC8dw0MBYG7gqY9dw/n7JfEGsIuFe4bN8aa3oG8yeRP15zf+naAz97PU3GtDZV4WxbkCyYAIe23v2FfU17ZU/XoC8v88Ycodt1Evs8cV7WrTLtzeEWZ/x9UT3/XAyv/iywjl698xfOUmN9jsZWOpPGuM68UmPvDRu/eVyCS/ybNKj6PPD924F+d+V5bxmxiBRuo2/bYQYX64Psmg3JdVHjHd8q/9t07V+98pXH0RqCBxbruzV69WJ7EPmWqrNlLoGUmENn6Yh9/mjz7bW/xLxCjC9q1CCfUCMs/iL7HfpcKi439Li9hM9wJaZ3b9TdO2OseUXsdfhb4AsDbwz58+TTjacr2KGNGvdc8j4AvpVpC74JtvJllrkKHuEy9PfIpkT/2URiDzv3L1VPQOd3KzXV9D3yfJBJsOmR7wLWBT4DZmA7rDsAN85LXvLg7hqyl/dtcH5vBFffqzdpH9m/yI74aA0P6wXZE7w+ds4nv+Dm1XJzfObRmW8Flz14KkjOhOdI7VuxUTe25OrGDTqD/qGXsY4s5/dY4y30DfPlgTNWbFrtE6OuJvhQ+s6erBHDuGy9+nnm7c95GaP1l1e34B8D588FLpR6t+Mfzg7e51cjEQdpr3+d6QzMmuvjI+ft8ETvJ2P6t84F+/C0V96HGrPUxJ2BPXblfj3hixP7DM+HfER+DX3y5Bsd5zveN2xDPJ/7uT+2r/dWcKW1u/7EmZO586P3Sp5XkcOkb7YH1Vut/Q6j37qwf8+S/z78e77Zc5lQOfRuVZmP6nW9MDBgvFrjaOyTvy0Totp3FzipZB8OFtHZc++iky5hXU5kj9Pu3mo7MIo/8TlWHLBGrOQnsAb8OmwIZ8nYVnQ+WcdG9X4mPg73QKE/ZV4y9PXftC/+ue5V/vc4l2vVl6Zu5bV+1/lYm+RD9WrjzNL/SVZwfMrnf9deon/jfILT5O/Ia3CzZDt5ea6Kg7It7N5bpYc47syL9hIwyBjLvpXMY8f5iTRvTRhPSdq2Yvvoe7zkO8qX0XmbTtXK9zyd/2F/Mfk9z12DzhutZYqdKr8N73Gv/IDvmx5z/iqOa8gsxn7rX15HU/ILr2Eu4DkOLuMrXOJ5dqwd91mcyO5N9FromP9Vzxv3J4S85dw7EeYB/lSDFPKMhP6Our/0a6lnpfeVCA9H3eCjj2oSPnVeoBWP78P/eGmrvuU3ib2Ah4f1ZEv2XIKnXThBWPck5r+xXsE2YR1myI5fXgn1FFOpr3Av60VpHv1NshHy9jUg+btefrQ2v/hvsrNS8GURj+N1kWem1OGm+/Tsw8tvqqdbWt/IRPyOQ8iNnuj15VjfKPV5NmJ3Kblg4Svc5bOKX53msjtj389b/u6MjvNn8ciozop+c0vEN+WzMLbaGiZjgYgnfd0f+8e4h8Q9OV8+y9JeHof/Jt8r5Ec+9soS8zX45I//oB4ZNtk5bV81oZvXNu2t06G9Pv1vy8XfZM/Q3P4ZG0zlsOJ9YZLDCb5TMx7fH5yHck8k27Y/1donYhbp9Vm9TeGPz4zhCEGOF6IaJY3HDB+P7R7hVQbOJ9dPkszC+pwMbHn1eZhHVXmebtAbI7/uAi8t/Ay1FYJdvd1r3THJTPdtwXw6CY+6Tc+Yg0tUsOmB34z9aJ/2Q2DrVIzP9TgUJnhf+XGIm7POzFqhj9D3pp/oSfAzjLthIb48JX9zkiFbg2O/xRVjFNGe9Nc2fIWj9EdibAOpi6rPD4gB0BrfaD+SHXJUtUmrIMzZVAafk8xZ4WmKv9GWmOMGPOgKQ0mdD+AiuLdGJagwXhI9811zlGZQOwD+0eIn5+80vt7wJdVuEK6AYBNxwkXjxnwoX2s3vanvrdj3pFPVHKOewj396Iyac+iTcbXYGTrdplvNN8iudLjeK023GDV7CofoZ2t9ZBmM+Lrg9Tkal74620+YF6pdOvxl5OXDvRLivGsewB18ROANhLzdoW9h/H4z3fnJZ+R748TY1sgPT2vouxm6U9jK8VxrGr+J6OMoZ5pBnvYKn4Dsz/lC8sHMMUhzD3yMZo7sS+Y4a/NYBrd3sgnhX6KGjrkCMjafX9hy/YwN3Ppv4/zo/1rgAKW1xz1c8NmBlxd8XuCKRi7Ezm/fhJ/dm2Wb7FMPasEN9kJc50Zz1BNevOMk484m2k5285xfVj3d6nu1njXDPqZ5aCVrKbXdYO4BzT1h477bZ3Wn4X7VMRqZ9/iaYn4H2yl6dJruFrW5YT+1ixrRL/0f1X+U3Hfzmn2Z7jthL63kUgWbTu0vh95559/Y73JGbrHm2NG5UPjfxUHFprMzMGtRz1yjXO/kx7Zl7i35XOJuj+PZ5cm2sgOfbUPS0dVzXLc/4HzZrBNSONvUc0KuNuTWmU+G7dAM44Jjvyi+RId5TLm/EfiVTt79up6C9lzZlmeAi4DrY+bz12z3NrlHn2vu9aZt/dS1ndAZ8xgvRT/UE5HNcMb4wD0bji8tDu7vOnnuTxtf9HoZ/I/Xn4vhVj6v07jMv0tzLRO/4pvF/R9w0dR3euxx3tlvzh+NGTiNdyNPfOA5LV3xzJOeq7ayUeNryfyPC+H/9U+6jjXiL66ixgNx0hntD/BO89p7w+tZ77MR18kq/j/zGuS8NOf80NfYauHvHL2eJMPIdiEZAyzf4ENxyfAzaF2HpKVSsFbFjp0NpZYGNqBai646K/s27feWznEadbgqN3wAXy5zidI4aW/dIBf0GWAOb8utDbh/PBgjf4SYeWqdEtdju/dIBoY662PqDZDv/R2ewfoJPCSCE1byf7Cs86wnuHty35Tz+ER/54J5ff7p786qz5LlzOvAHXgju9kmHdUbVNz02E7Y68Q4cBbrAvLrxxmxyfSaGd/t2/VzvqWePVunngflz72wD8f11F53/sgPGtW36RiR1GmxjPtQ2E6GPg7f895K5XkrhmsMW5z20KteB4fGhz02pfF7et6s6H6GHXjsjezwPk/m55jUI6Ot67jAfbbT9gm/D3TXSe890U0iR2neLuTDZJgvKeOyjnfIx5oz7tuceXmhp7l/s5pn3m2+Bn9z/ikYzjJ5S3TQMxw9Qx/ps11lfRqefYWj9znLXA7JPca1bxp7bvhwRkbAqkdN79j9j94fcfgFySNl31Qvff632D74bkp2vQ8uZqu78iuouUANzwW8QAG4N8gPynmZ/GXOfM3RZ6Ns0fq+rUQ2ZJZsW2MsA/m7OK31n89tvQv8/SDCXMaZWaGOw0aNnLJzMAczD/aIF16f0N0rtm+0zm4NE7an3aX95g6H7mD6DTuFY8EP6xiezZD7eAtsa+BH4n3RC4vxeJkuOEhtvwoc7StsiVMzM7/MvQ70PfBV8P+jX+O/bZa7yr6c7btaDv1tG9Xs2wntGDvPuGE8vjAXdl2oHgw8l+t+eYxZ965x20m2b2juLY53Pcb+yd4aCJcN47RXXbey6qk9zFjXfWfQpbmO8bEw1i3ZY6G/KHubYwUSV3nQBVyT9H1bjOMD6iwOUEeo/DH+PLznHHzV6A8c9/ePNjTJhkp+SDqL+xtHz2t8sd/ywnXBNcIR3w34eZBHufm/Va1ryDGIfkKysU9Yj3mte0ncU71vjvb2IPRrBXfriv1vxBK1nx5cmvcjz6HWN4yNW80f+czfCx/ALmpv+MzLb6rMg7d/3XN8kX9L8j42Lx75fw9nI3ZGyRbBelZgx6J3aJ7UA+pdkuew2HNS7TIDmzAuY9VZIz06ds9eRnA1MH8j+hv9TErWAQPwPif5l3aNk52vfK0LasGWzoXCHoDMKx6n9W5H/X38Jtc85Odh5kpvHuuUzOrsMLaBf0zE5TV+omDgaLmSEoN8qMXV17pSd6z26zHCe36qm1gXaxk5hs5wraTuAXZ9z3Wb5fRYQ4oPSjrFr7t3zf32DJ9puiddOIS90gVvBceyFNZ1RX/2R11Ldhh99tnPFm3IAHofvPeBbN4NeCNm6A+rN4w5Ou0nfC3O3xa1HH+1NtsHewM9tmSXDvvglXj0DzaNKnNESAyi5iKfpfTRZRnxdnCv4x45bNSgML8DjYk+YxxdFY/ns8r1sHXUO/bPUc1xk+siJIc9ACfxh+DG6JoKjpXRM9zTtN7RMeSAezwQ9+B66GYuWdNMvoTYnhHH+jNOeLbzoj5IHe+Tfnvgiyo7sCyxF9/o4eksh5q/ivnrdFzCQT365xvttalX5JgdvQc4QW4hZxxy/dIH89GouMh55ji/uAtu9Jwz4wQUwrzxnfaKjT6q92Ee+RThMRzmlT+WD2M7mF9wJrwDh7oWnGaM29W0UJMAbIKpp2tCiyqW5H/QfkQ9dJN5VcAnJPv4aPSqhNeq/diA/Jtp3437bh/jeXEdpec1R/KwkIgHXpTO0eftuprs3JNvrIGOx4R+o+IVMWVtUn6K7c+Y4wfNQ/IojwpilybzT2SjT1UvoRk7JZ0k/DPDl72yx7Q8a6XEymjeSN8yZjF6j8P98RG+zxi920vGPkPsq73T8dxcGPtr7yTunM4T//wZzO/Ata/M8/78Olo7qTvLhfFF4Zt/9AXi6yNrqXB0BQc+jLPL+9G56XAdVB0+k/ST829VL73g1z+cNd5fYXzdDtdW81N++ir+rtdl6Axq8H0e95L2z07oR1Sx/tBnG5F9gbrTPfM2hjGJyE9Vaxz2EOl4CXolx9nz79e1jkmsfgObVnqndO5cYhnc0x/GK9DDOAikz1jqxOUz6Q/kawPBwnPgr9Sqex3T4H5OOXOMCwZ/b+o19i3Paj3DOP4yxlGCLxHMk3WQmucTtpVeR8Zl0XuWxiHrBjwWyaU04vGKH43Inwk/bz3hblb7WMcpGTNG+85hfErZmbSfz5PdYNWoWT84XpScS9ori6GB08I8EMDC7DK3x3TcVBzlqi9ovULO4Ej77oO5XaPcUjgfraRc1vtkm6+gxmEUTPYtjlehJoT0Y1bWKx1DpJh4no4jMB8H+b8X+CKHeX1weV3/+sRYXzedS6dc4X+TvDN6WDgP/0z2pN3jT/c26l27R/DCkz27QC0OdOe8vo3ryhgWkGD3qPPb1NyUit8Ra6rOnpJlwvuu9Qq+39J6BH66vk3xAecsC/DMaL+m5+00HpHE5rBnNf7D6otzkebvFWIxrJQx/0exorTnwL4SDHOcJXkvR3Orkn3nhN/LPCsehoAxktKu199XqszfmzKfsCtYB6L+CHNlrOdQf9eX/PDeI5lDe2WDPjHJ2VwDcIzpeDH2BuwdOi8b1eOK3BrqqKSGUXg/uIZH1WmGtYycKxW7+Q5+F9jcpXVn6dZWAWwrx652pP5qfiP74c4yXnr6PsmvRG0B+TiS9wTPk6oxsGfcTzYlezPYcO1ljWy0LNlD2zz4NVHDMupbq+rIqTAugV/rwM88tsdcn30OY+HjPD23e5oOc5nO0G85lTlwjV8Fq8URTIMd9+7Yk3U+rOMjWX1WPG/3dpb7fhCPu7dHlUyb/ADuCeJ75v7ySdY2L8daP8I0LbqV1Qh6p0X7BRywfr3D57aNXMdNbECSO5+wa/2MvaJn3MiPPU9QF61jRCRLxY4gP7BevLeZpy+PWP8n4i0SpxF+a/rOJlvoHN5vH/lAfE6+O45MxB/W9mhMtCfevCL5LfaacQxr6LHms4l9Ce7bC8bg17Y0R81NO8M1u5+zdf6iOFw/GTN9zPk9Ht9sx/btqU3z7GeLgZLBX40TtQQ26gDbwG0eT3e0BhvhemEO0d10bZtcdv98HrKMOwJ5+NW9jvpckR8Dm570Wkfx6F2WoU0HX2dYzKBXXuqW7eM021Sc5iTryBbz1xF/HWQC956x/UD64lbsoY7AX4dn7Ay5j/qkaSnB4cex907ID8F8AOMu6gzuM/R5rYs2ycUwxg6M54nw+d1wbhGvQJ+dn1kdfalJ+FAcoFzzSnOGfh6uhVb3Y539jvwcPVfrH/SaSJ1wN3gDngnwfNbF4cTz8T4b8HnMavk9+5Sw3+ucC1hJjFjkAWzduR5nPeTOiTiJhio/orjnGhzLpOeT7dZeHsEDBk5eZ8A4pQ2u33StAJzG4BtF/QrJmOq9UamOGqVlq1EFj5tbdkvIxZOdVOkWHQs1SkVvWHFfaY6O07J1cCxw4XYd7ucQrOxbozKl51lLvzZfkF8LHJWlS/LJ2YLLMdj2hipWNe58ePqsu8D9md/EZswBm+8Hrdte/V7s6OqgMXBeYHM2B3ZTc4uDl63qMCe3GhvvGcaNyDfLlR+vjLPQX5Icqo7WwFx2Udc5dJ0cY3M1YdNX53xv5obDvhlZ287m8EPVljp839K86LqDhmc3kZsEdtwe4xo41xHN655rPpz+j2b2+iu8z7BYHW37JM/Ds9Ay5wfXoX+S/A9eE137y5+7eenFKK1Qn8/44DE+rdCOKaz7VpXGoN6/1ADPUOw3wKVpbKxLOId20e1vr83+zdfjj9ZS+TrhOGUsqPMFdzCeMaRnYV/kG+vCb85TcZ0UcygBZ23dkvdeR/ZsdUN27N0fXzivxFxhzCl5kVw4cHSBdeRFOBdadrD/w3tUxkU2z4r0FJ/V6TilZqu0XLei/cs6aRLkSX75h7c97CuypffucVZDDrjJ/Ql0T9JpVcQ44OusGcdHPb/1gJ9WAG+kkbci/6dWgT8a5q08qRdA3oDHSeuI+soT6bSjb+fVs8D37RwbFeB4u8NGpTlVa6fWvZBSn9fAPcyc2ULy6dcV+lK92PO2y0HQ7I0Q/6L5Q48H4/tVur2+c606VrfaSt8rj/7O+op7RDHtks9zJGtHe6CE2hm+l5Lh/Bly6iTvt2vGFwkYG29Bz6U9aBdhEzR2Lx8z1OfKWXkd2f3l0OHczGVq50PZiPgsY1Rnm2clIxZ+BrFuewWbtO/kKo3a471GlaA9YJtovpjXSDdn+7S+xSLO5Gydg86VmrVKrkd7pTN0ztWGPJvxnrybs2/QHtZYXYgZkJ4lW1j1rkEGe+hn627eEAMdoh8VspRs+HGf8YdpfZuD0kXVn4Z4hmTbVG1lZ25o33ItP/SOqg9WOIbMC096t3NSHBGM9TXJ0t+VwWi0Zj/f4HOP2W1LwwfieK/Ck9uSTiiD63RUydc9uzsYIZZRBSeouwCGL9bWZ4yJ44jkQ7VPc/n07MCOyIZ9BXQWjncaw9rLNG1gqZPPupY4DWL3sFHYZke921/kS6CHU/HOA1tY+R83upbjwu7NYy7jLq/5bO+eUVP7yjHbX9dOuXDplMQ/Rz0ZMClgVzRv13BOwe82rzM+GudMyW4J/CAfCC4F+yral0Hc4DSrhfENQyY+fyf9G5xvtu/Cvy/7iaobajO+YZfzXJHfNDf66OS36K9kXY/eGq9B8iPYzEkPzLhPXt+HPhtfP2FX4Bnci8Oy1Hh+Xc/ZS1g3o2QB9raxX0J5js/4LPTG0XoY9ip63XmeaA5lr3M+dPW4P8bzfas++PQyMmeteiUu4+okK9XZJT1Rc7b5LtscpWJ4r/jZJJskPF9X0fdB/pU/VzZHu1Itk05Xn5GuwRwbelbVYVxgg6E2Q9sjWhY5JEN88df3qhfyLv1M/umZLiF5spB3bhzot0vydyoDt7HsB7hXjsf+7P3IX0LPY/R+Ct9QfY64ushifvdwLU9P56Uff1/zHRpkPw63+SbJCqw9/1bhF9A8F3v0+Ud7B3sOGKfg7pEaHMEfiOYF+2o+tv/JnNwnmVVAftCJ/i06ypXxtGlPaFyIWUnrrcIBezc6gzH5TmtWDO83YaywqzEv2N+wGWReSWeuSAZ8zMeW2GLhs6A3q5a8syPfCQZiS/dmoKZe6fODug/O8XGqf8u5PvtzSuPG7yN9zPcluz1nQ3fgO7JRSD8EzA+v7nWcSl4F/XV4J+NvGYO6LhaHwL1I939InyfJ83pxT7ofXIOsy1u1Ps3FYP02fgF+4mrK9nmwbdd0HQs/K9TnJGOln4VlE/k3xj5b1C/79nr+a0G6i+PvNWOea/x31ANq2v7eAPG+9ZxzZBVzD6Kv7Y5eQZIL5Et0PtgvGFc+5Dfou+9/d89ugJs7M/csn4VrdRDE7oE5vIktSnaB9bI056U3ljE0wNNUKm5p7bbQNXpM+Df2Iu35Gu351sgKyM/AnBvvD7/wxmOj/+fYPlZrp/xF9u1T7mGeN8y9usda3SPz60N0SuId4bO4zSr5amWS4V3sCbGDGO/+JLZZkd4fuW6ubb5w3QJ6pzLcj7qLbKfoPXubgnwmNpHax8Gd65DqxQD7XMsEsWG5fiZFV1b309vKmtl5kRHr1ZX2Xc/ZDshfK5bGw+K1vQ/l+rW94zN41HsIdoXhh9J6o9cuOqdah7TV+xpyQWRKfB7wOeq6t/pz8vuhN8GN9oF9xfeMfybxRn092W9kk8CuYHtKzvP1ru8HWTFBDVB2buQ9+bmwWzd85kVOkf2DmB7jVmi5gB61DfnBj+dffnPE/vdhy8lew30lRyr7St/7U/jDc3elH4U3Zd85aQ6W/o1/q+z0a7FvXfVndL4U36/4+6wnsRfljHFNsbbPM9hLM+RRlU/Jegd8nVmyfb05/NjDRM4BzY2qs6u4HdxX+H4j35ix1Oy86icJ2P5i3zqyWQyZcewN1fOSeh3nOjw3hk7QsuNR74svoK7l/dGo0LmErYpzki1wjbd6Vzo30o9h6ETg1oJrRsXg/5k9BD2ozpS82797LuI6t3bifO7juZHPRY8Z50Z0A9aCbKTBIvbuqIFYr36zTC5ddxOue5YzouJzat9ef7MO2Ud9w+psoh/0CHsT50TOnYwDv0dvtfi0od4KwL8MHd9OXBfqx+hv2F5ih2mZzbmoKtfhvN1i8pzkNLjcO7yX1P7Nv904x8zncPpcdn+IPntR+syYf7VH8V5f2Z7Sk7gK/ms2Fq/1v29fvY2fyODEnlHvx7LhbZhjvLV3bZuUC4acgOxCXU3woeWbup7koOwdZRvzv9Vzjm345KSruF44lNH8b+P3zQA92yxnZe8pedxdebRu8BlRP5uQPzJWeoYpf3R8c6L0vrJJZBzqvdKuR2wc++ttrG2f7YeaG9lj7L/8m3LO8G/QV+z9O7IqklF52FbIkez/A5/Oau9hQydt8Cv8EbLZpSYdNjtiGtp+p7MNn559JtgtOl4Xi7XGzr3L9j/tz+j8il2/pH2A9bMMPwjPVXb+N8+712eZGVurRxvtSHMofnRm8Mmcz/t/cy3+/tmel3J4z0dfNOH7qOs4H6Z8HFm3hP8jcQWxXfS9Z1n4XteTrDudP88FJwz5LTJnUX/IV35J4ZmNqeXjmnyrE/oEJrsjc2w3RT7t47qOa70NnQQ8FmW7xHTDQORUwoaBPcC6quSflF4wdVd8jWLPVbU9sfyIoUNLxd/hfjF0MM44zSPGcAx9rmiM94Sc4hhTo/5t/8k4e+G+1jEhlVemZ4pfZKy3k29muP76KvUx8yie6f3f3c8PuurJfpY67ar25V9dcKQqOymK0zHXFe1XqSN43RwF60vkF3/WBpdWxr0iP4xcI+ObmtehJjQLfnfom6vcj97xvRzml/DM88RbHWeee449d2wfZ5v4ddi3fJ167iRTJTnqhHkuPoPy2Um9o3DRyrupf8v5/MoncCKfIC5HEUP1XM4tNuqdP/v1nozzH/v1KfvS2H/g57UEX/dfsZ1Cmwl9inOFvfUf6LZLe4/Y+INuC22i6Z58zazkNKJ4fbCIPbde4LlU+xN9Cjbvp7riW4riP7s57UOp02Wb/CI2eaotrmOp/ZRYaj+Mpar4ul9C3imva5+UrxHWC53U9/B9OYdpPA97Ss3DNZiMz7jucyo+7Ak4FIh5zzIT9S6FD4mB5yVmUnOUj6j/hm+s7gefGPXINVfplujvtroPsFQVLrWMGXgd466VkJv8bvTs7+5PY13/KDfVtTH/eQefkns8sn7Mp/RrecZi+7fk6P8xfxLzXcs/+gDqc8RWZuMAed+M+h44dWesDzA0tK+AOtlZrXtWfmFYI/50LlTeyqnkO7F5MD4Pz20d9WdcQyfP4VoB7jd9aUmtyVGdMd6rvqpdjuwD5LpJdtBep+851xe+n8i3uA9Td++wieV3YY48eWYlZqvuwxzhNcx59/eX91bXJO6dkNVhXf3lG36LnpMHv+Xf9D9wFqf03v7+/2/7m2zV2vzBroCNi1g8X6tjD+Mc+8fTUmL/sOyZo++EbUtl133p98r9ucfkRrJtreVhPC7CtvheZLu+1t1G95O/k7aivwv26ClJ2ItP9Di//38pBiJxuNE27zRkno/AKAc2JPpNDD1v+AaoHWJcq/0/kpWob8G+icWiWVY/20OqnmpQHWyr7qiqY7h8n/LIqnYGbrc8GK7MvSZ4ZXHbYAseBVp7YEOv3/bii+JeqiaG984/q2W5qrHOh30n5wwcGoc5b1KTklJPckE/8IpsD97HdJ+0+hJVJxKL6T887x/Xq9T6HNtD7Sr+Q/+7toMebFM+J1V7Vh8scC3ner7OtyT2a/Qsc8/K/lP5Pc0Js26sSzvugV2oXpKF+o77BN8vB/A+eaOtO/Ssl/3rnnXNQsUmyDdVPozUPQl+SGiP+z/iNWDLvY7vi40uNQvh/e3C4/2zYv+Y90e9MI9lF9Vj6XHgnTnOzfmhh7Hh7Klcgf8D15IfcDXGhbVArJwxdh7Gqn7rfP3be+pv+T3FJm3ej9gbCz9bRR2Ysqtgo0psvh1+JrYsekubdmQH0O+TtWQvbZ43R79j8mynrFu0R+TM8/sl933K7yof6kwF/Bu8lx3GhfavifqoduGYN/iLdH/HY91OpVt0K9XOyJovUGMOvwn4suAnEKyBy1LHUVCH5VSbzdEWXJDAPP2HtT8h7oWSMzZk1YRkTNeGvUef33h+6/I3zdP63WNuvX273mDZO9kHF8TcOZfGcTGF4eXmea3Ce9TU5x6v18m4bjtBDGedw/XwwTknPllf9mFeTfciqWcmPtex9wNiiugpVvciHbBCnRf4cUgWoe8meg7JLfUZnpPPegYew/P6I/Q45I38oK9raiCTUP8kdZFBXuFVmfcBP1Ajn7xG/V7Zf7kFuMSmjGUV6UN+Z/nc1P/Kxg39FvwtNUBedL8542Up3yR6drSOieeY65lS6xrq/qjWFn3OUnuo3lHFR8n3Jdnn77uHN6/4VY5ZnT2bfK4m9FCKPtLfic4y5oBrxr3wWR30nun5OLd36vONfVN+tJoHsRn/NRvkP6+HAlfyInU8w1Vy75yUzU4y0R31nXmV8//QaV4X9f0q77Za+bRHJRZSXZh1rS2jVk/2xVX8YWDu280qyabwnro/GrXlqA2HbWzMe9K3/iq2o+1w0474d2oO9rE81n8hx6q+Fz2a92X+VQ5j/qH9S9Rlkm8gY/nDGuqcetPW4wvtSnBKbMifBD4j6U/NC8x82gvtJ/1hPTd6PYdODvrI0euJ3vgp91mF62nul5Q1cg6Qh4x7W1WySvkSJE9dpzIgvcWYapg3xQHtLoCNRHMT+k7/0dwA+6PiMs+m9oEYC8D9d+bGrTZd0qHm+MEN9zHJVP/NZzQH1hy9DWp9Q9/x35kjOq8Dsh0HTq48cDv6PW6cW9/hXdy7sdbJHHqYJ/8347kqXpZWb3KL4mVs5wkmDmN3p+Qg/huy4r9Un/Q92RDF3L+/vn+W8enz9eW51TpJ7xdw66Fv7cme/I/G3R9UqtHZrZPdUoufq/9btUG94XzUNGJZwIni+Pd/b78hF2HG+//+/lNx8Me4bErOIDDqz4AlFT0XMU8jB1m9TbOS6wpjpBL/F78ttJfCvNK9LXvOfNbXe07lPBhfF+9o2BaokaHrv9oT/y/E849hjQr5XqXtoy3sR3aP8nGkby05FyXxx/rONnjtW0GfOX7QT4y+2mpxSLq6PHSL6GsbOc7FwNBY7klmdwSn7lqDL5Xwf9U6+cfWUw6zHNfHcBwk9HO1Pe2fknGK2ZD9o+CN8bm28bGEZ8s/uW4XuSfdu4znt2gvVwaMRav8UnBaBOEeN3sEdbwX52XzRv7mbHjl3JZPduuUbKB5qdikvSd9QFJvyLWY4TWQUxzzv+L69YRj6VWrUQlGqvaVc8KqZiF2XbsG3NHrEdiIPjgL692FwiDXOSb6rBP1+qm+zHage4Gri9k42PsK/4FklykH0t4TZ6kzdOymWyrYnXLhyvGnsL8u6lX2srrH3DpMMhijwRHCeKXd0xvnoiN+qpYRV+V9vHP34DP2Q6yPOJ4Kag/Q0644hQwOs2tTeHjVmpGfY/Ic9Xd5C/jeqF+AvuCeelUDAf6PWbZ55/oQ9BrsHMYMf/MaXMM1K0mfk8bEba+Lr+i79YW7KMlDtAYuJNdWeAXkQIDVnkNcEdgfs8zpJNg+Od1zfZa8IHqS3Rf04qvPGe9gyjlF+ixzWs4yXeiue8hTFGLFS1+tvE9/yThT4q9bLv49Jl2BBRtZ/wN5LD3bueAd3BTlyrFd7mBdL63R+QT+d1pX7k+Af/p6OcCGZK51/B6xRf2cd1v10DpqXetWPuwzoDPXr+t+eujJQPDBR6eWriNp1M9FPMNRvd2OxuPy4vdBz71fAk5212p/1Zcu/ff0nUtrbeve9w8Dj/Ev4IHRO8k7lm2yf/ylfn5f79n6+TTL+D/Gtp2nOeF56I1zwZz0cup4h0u+p5qnZZRXf5EaQOGrIz123c3Wwc9o3QofTcVTNFE8Ri2yJ95JT5HN/dIb5X5i70+8+Qp8ePP68qNJewQxHPJXhvS5S/O4mu6cA3wykhuOs62+Ola1zD3K6yLZ2NUK4syj6lbmXnCs7oxjzfXO1VNvXM1OxoGFZ7bXA5p39/buNldzG9hi1R293zqyKZ70zD3EoXQNZPzzL3rumHuKZAidp6Vh44GfbrUAFtdb6Ulsy4i9K/6/la5riOO3RrUIXPNVRR6qinfUdgFzDXkZXq+ToQvvGveoFcsDxdfOy9B+07xka9/IqaWPjfbzp+75+2JedNwrrBXVY5UY5VbXQ3x5XWO95b30hroyqcOgM54D18Ke5nvVI+Xaor3NvaIVvHf+Boyz0TZwhg7Ha6tudUB/z0ee7b723Wlx6FyL/S3j/n17n0Knot91ZHWLpBfRY4o4s/ihWlaVrX0n29nrMf8H9yVbErZG8PGwRka8Mva8EeJ8DT7HZGOa54HkJHovBoGzq2ZdvteU7JHmaOAix5Mv953LMrF/85LrRg/j9XN6u2rcgbU6g6t5pnqkM2i9l162kU35cOacRuXaAxenYNQY8dsR8D30eLU8Dbmf9P1J3qzoGdfwrI/vxXlCDtxmdzs2HvhN/j54mF9lCz2JLyfnOYZ1ftS2jLkP/d2vD/BJTbODQwOcxB7jF4Ajimy3X9iTe8TOU/YlyzVSEyTXggWtwQixqNdsiK+kOZToWcV8u35GjZuHNX3dNC6k607R2h+unQ16ea9H6H5l+3SAtzErH4D3fEGsX2JMeKf+fjHcMr6Z1oNGr3PeL5OOjct8650+471bJ5/Xa+bi+yj0a5dJ2zte86dzRZi/cO22oeyuRfXjLZI5k/Hl2K5V8vrsmJhUoh/5PsfperVt767kJ8/pM3BPV38tapWHdeHc6TgPe0+tD/JPFeD8c40T7YH9on7l+sVZZrKcuKeLp+zxBmN9MQYX8Jfo/sY96Dt6B+OetE+Z36gY2nZDt9sbwS93GP81zCE5NnBIq+7QbTJ/w6thmwDnATI60m28H1kPhHltsvnbWt+W4udE2zrh2YINXpvDv1x45IcMKnP4EAPXcYdjN7+QcxjsWvq6Nc3NmPsvd82d/iyUt//THWHPPb5r6IdYzZ7r5CqhbFXvFcqUb5xZz4ZPdl2Q/HDIb+sN7PyiHVu/6wryQOUhE7LEwB0qf/9Z8Rzfr9O0Gu0Dmmvj2ZEciORkXB/RfmKM1EkmuNB+ju/JlH3iWKuig7ioyLcQj+49o+f/GuI6vO6gH6vIo/GYNPaBiY30uj99tNc5YwzX2LWhHjXsA/9+DPcQbRSWP2Lz6nPKZ5P02IDkjfYD4ICe9RwLltR6AHsX5/xD8p18Xjm2gJwV8DdJxpBdn8tCH0yHq5ZD8rC9V+csE+zehystB4+t25z5Bl8zXdQ93iK/YMV4Rz7k8t460nM4lgxO4JjdnwU/zpnlxRTnY/zH98G1/C7RtWyfp12b18/0bsHPBffiAes1AGc8uC8djBF1ti3BprjRb6K52Lkv4OWiPZFf8L6CPxSLHSgZyzwvJ9iLNOZ9zCctk4wK7cg+fDHURQGnyhZ7NHa/VBkQ4Y3O/3hemrczx+LaO/JdvOK9VQnvhzgKrZd/bN4Ulqz4TpC1hq+sOHtKc+5voGdfY2NUWA9NOvOI13hWlKv3bv6Jc4Tr3HY+Jj/ptkrk9renTiJ+8uR8K8yNl49p3QVWyOExx8/3CvGFgOeFNfWyogvJhjhMRg27u16G+Duhf4S4XWZF69Mgm2i16mycTCvxvPfbPMJquSexRS578zzT9w9xLANLMMYVEuFPuMIlivoJmgfjGtRekB00P4qvL3n+1116PATcL1P099aboX+wMPA9mROF8beDe89FTIJkUcZFn63wKd/pHjfUqvg/UFsCjAVwKHuZ6p1k01H95tjeCRYJfFLaD8A8CjEXGQtHuOSA83Cc7oNFuB6hjFxxH3Hb4ACJ87wKllmjNoVsObTHtH6McaZ/f0G+bjOru4yHApxpxsEGblidey7BK2vPaJ4Qs9IxFXBK+jvg+H7Jyc5clILTzzjFSU52/r5XtjieQevTI3+4jPqSFL2q41Jc70jyIN+8k04uVxcGVsyVZHsoz5v3c/hv2bfkN+z69+698DLdVXKvYwe4UC/dkbvpZho5OueZ1/Fg0605Fun7zGTUuXYz4O6j35Q7907Nub+OHHu6cYPX0daeljs2fbudlvzE2K4L7gG/2zNfcQv7a41TO78L3rrqLVGcLlNgtSiuOrI7FGeNgXkX5CNuuXH4HI1tS/Zy8zdiSIwNrOKz4KSMuFk0dnw4f4Kzbs6P5ubC2iTfBc8dxflfp5n857T88I7GPXl9eRzRO0ktMvk958S7LCAz4vxUZHf80/sPucaRfjNFzmkx33QXhh0A/Glrij7PLO0X20pi+TNXJr9nCWNlTk2yvfpH2DuKb4hk2eUQPZ/70hk7SWPnu/WmPR0m1jYbjxPraxXPjPCP1BscczXGy/unlcInQOfuBtzr3jgvNpzGqVZcMj3vnDfxw+Mcp50nnC1qjwIT95Fn6Y73ELxcK09yPSUWDd1trsdlL/XKwj0BeSyc4IPFZFfdvDE3Ca0Haniy4DAIcUs75EvUueZtm/cSXBpYJ+DcCk+BmodX7h2nsezdIMYHJnVEgtWbdr7ieyDJU6axejAX4CRQuIqSS2Mu3ui8xb4TvjvIXcXdUErhZlK4tqinmWTO5A9ZzBNm8CvNePyuJfdW15tz6snYHH8P/mFeJ3nX5H6zrdh+e+RWLkYynJ6h8hTAKhZ8MMa/NO+v1s22/qc3KqSu3cgJRiOHfBtrGedsDfkszjy/Xrg+xt6xH3jANFdDkrvwUYdwrNWPsJ9J76HmU2qONNZtyDN3EvxsjaF8je3rEIvZ1LEBY++yrypn6kGHBu94x5Ktn7EcZAJrWHfX7THzBOCaT5/ru2kf7fJr8Drw/avIeXMe8yg44P5S49gCD3jOvBP9T80LIbVjL596nO2Mnq98ZWR12+hhi/V27TsKI1K4WKc7xh3dqpyJwhICTihj1GLPnhpV2GrAFCG/p1SszDJd6B7Fwcr9h6h1rjjctw5+977mZCA9PficI74heKuM24uzInxLzG15n8jYfuBzbe8I5ql79Ov9nw3me5ccj/RWwr5A/V3+9q75XLEuyyTnU/7O/dqMdf6icbHrQ3fQcJ3mAljEQyf/6jAHiYX+ExvcfLGzkX4PYIRyPfbAyY2HbrNH5kF1FPQFNz2jsZJtxvTGOY1jp9N83XIhbrrGXx8Ad5V2rmc3q+Cbp3H2nGCrsdhXwmkbfMyGNvkQDWDpb97oviSHgHV7nkGeRuewPHRJhW+v08iWCs/SbTrM7eCXCC/0kvQZ+dklKzcZ2jvPO1mdurVv1zXvEda3sOea6ej+Tt9t0jmPeKAYs96bBqST0uas37fz5P8Hi5HdRM13lXw0jp16Vq7IvDVDWQdgUKdx9Or7M/71H9Z24E6r4Ilk7FV1X7/unqBTubaFzgrzCG2risM2fK8++XiJeSMbYOzkZ9nOR8inuw55gHvAeyW7P4VzjH/3obDM79y/pbjnTe7Ct1qedOcDR/hnW7hRQ/k2qNCaso3MvFxpXEtbdTbz+toWyfL20A5x6dsm97yM70jPCXk0mreQP4HtBsVf+8E8AcBAX4f8dMxDjXz3m5vXPgzzMJn56+btiTx9yhunbRB396h3FQ/fzvmY7mktFc99q97Ya//zNThd2qNg1R5P5+/3ibWg8yxc7XrvSNyA9vv+rda9jW+5+dv4l3GWcuc2+g7WecOO9MmWOQt/SQbntv+bfl/44pknGX/svFSGzrzq2P2ELhT+gB76SrJd6GuOO7QiWX/Qa4O11PwD4JlDHwbsBNRuTOnZbYm9QN7mX0vbI2KHqXNcWgnni6v4bUacz91JvCUH+ygTcg6Ha15UPDFq39voJchXZN2Bwc48Znpfh/ePOE/AbaF5VpjHnPSfT/u/yHib6CfifuB950O9I+IbdNa6wn9KYwzx6o0zMXTs4gB8Txa4JroRxxXw8QOu3/mTrHVHAXBYfe7Deg315wp1Aieyh1K47k9XWu/5+F44v7r2z07pcn31IC/VM0vb2Ll1AvfVGNcnnfm8w/nS1cJjbFR34d04noP8ZAaxgfYe/crI2XdnneDBFlI48+T7V+l8Z927v84D0+9zmgl0nUamjTr8PXO07IcVtzgAh4WxR7rD62ae6QvXnYwLMQlwe4G75dCCTEIuvbSE7xjaSzEdU3FJzuRdt/qoD/yan0/YKQf1nM8Ex8ARdZ3IR032ATidDhHnbvjOlynsUo3ta1vw9S6TW27zJvItwUngfMw3lb3aj/xb4KECfxexTJVrBG4u84pBP7hbdzh0pk1wGyb0Nf+e5Brnt7i2B7G3bPeI2M/7UH4/zaw25O8dZ7c8agsPsGtmO4vxZ9qZ7rHtRRwJzZvyD2vil3CMfId50nYo7mnLuD3IQMyPHcpPcF4Y69Af2Pn+0Hkx5h61ZO6u5xXBWXQmnUU2dhPyBTFIWpPAYo492/rdtAr7VvbhOi3TQw7pSEannInM/DDJNmftwP7W+/frKq64OZp2R6bLdgf6kyF3tsl3fJChk13eZjyD0krrvt/0HkfN/dXMaP6EfnTfwDLyi9ZLOGdZd0ey6qXn6XMM3en/BrYfYp4kR6xZ5hzQd4eptzyQjP0Z8qfcLfBrnBW/hvIxLJrXLmJGx/fyWWxf0s3hb250f1qf5iWGaw5bbwP+atrX7GMAQ4nvN4rdT2oWEXPSeMijc8hN5OkeqHE/r3w+idWPc+Av/Xy72+wzvmbDnDTzXb1mwEcU7Oc0N3TvGuO1hXuqevezkNt9snF1LQX2bPcoNRkB+IARu5SYbN3dqFhqeJbpjCMvE/RgD5BtNAMXSRZ5v2DTKm1/dzeFS8SJPInqOYcr2KL3dukgWMYjGS/ZMwFjvNU7+c69cHzGI4r8RHuH+czTGuaOkxvJNGM8cTuLZGXl2hxtnYSuBo+c4Cs3asY8mTjw9cHtPSVeE8XMU/R6BjWzHf1e7OeYcprkzkcrek/Y7C+tcgXjtlrmO6TPKbDWYxzpNKcbkgFWo4paehcxdJWjKwLHP+B/bx7fgeNuzIuq8vya897qkg1sF0fbwYLs+O7AIX0gvMTh5yPbdZyq60Tx3cu+b+W7I6f6Oqjmm6OgCB1SI+O7w9yyKXOoYgfm/uQ9/ICFT/4i2Q2BuY/8OvpKV+hrje+RiPMprCOBTuV9B3/qZh/JttFnFz3SuAfs/fO4Xi0yz+jNZhzIkZUjv6M5JP9m4djku5WtK+cEXLbXotij3Je5lBGPYvz6Wj4Lma72AJ4Bm3vDfc6lLXIN0HFb/25lOqVIN05DvhNXel8Zo0Fs3QQ3INngfl7rX/QXwCaf71J07+gcxsE65SvHRMkWzrZGF7szaoB/89YtoSdZ+XHI5VTzJXDCI8+f2Gv6/JKeQ21Qh+fuDTayklvMmYB4LM/VSubM414O8HhUnaDZQ97NreT7vVGFf+9CtmdNfUq/kRijabfvE1xU+r6oDV3E5NntzL2JkMvosdHXcQ8gsGSyXcjVbQ/6IPpduPbw8Uguf3XP2H42foc40B59AuG1Zcj56Jl4X8HmRU9B8/O9+vxab3hl+dFDXgr7dow87uBO83ZL7Btlo4NT54X9rXZN5FBrfSV7eZJP7DvU4STkq9Skx/UZ4oIF+EvM4Sq5BamdR22M4t6J+I7lHrE9w/hGG/AuI86Gs2Kd/Z3F694ea9w2jZ1gaXw/+kz8C3Wd5knEtfrf6l7ualqyNWd8mpxhn3lC7xFxrFc7o5IaS4T1e54xl/plP9v9OtM8ZJkPKtb3ibF0FUe4f/3ieeA5/vT3W1yX7W5WHD83Pj/7wnV8at79zGtNzQcwyuodmoOAbDfsfz/XVXM2r5H9yFgq/if+/bpvZmku6My4wDX7gGyZr6/Mc9wbNTKv5f69O+rb3fU87jdyrI65qoFnh9wG/EHskR+8VutTfnzDe5K/Qs9mbvebj/0v17uxGHvEyxjX7RkVq0Ad1O3dA49Mjue2ncmB+/Yv/yY+Dulw5lHHnvWGZ7ELDDsg3LO32H7/nAg3FXrrVJ37NQufcKrtnIeYRMhxkI/LGs5ByG+jPH9M7pj3YW7Jsq11yO/m/WB3y50beMSNZ9Dnure2ktd9AU3TtkD/zcZC7OUVHOae5b66jEUc52lsDS+kk9FDWS313S7JZ3fIe9d4B9IvP9rgJIMc1NzHo0NMlrRu8wKtIccw07kul/u+65Ifna8gr9/fVkeDiPMxlmtT/IwXT+o1fsRl42nfL/m/hYMzjRsR3KNdp+9Ma97feS+WyZP/6FnQbYgroN+s7zSLDv3bdZsdltlm/rl8+OSa9yo+g50+D17XMR0h/lWGeUXjvTSR7QGclzv8Sqn7WMVkcyI/MSPdAeyDiKuDe8w4XnWO9nYwb/N+wXmamHLcIj2g44UWyZUfz/W1IUPBD874CY6SaREGj5JTqs/HPyl5fAr1Atk1MT1i+k12PsRlUDUSpqyI2WTYp5GeN3RBXXG3rNPHwToi1FF+NC4Zd+gztcfCdRZf407ShljifsJHDlncUGPR+Qh8Vt0/l93hd5e38eDeHkec9mRbvTzqB8j4wdmvTcXGyU5X/ho4cIj/G/uwJNwtX8t4597dLLOd8vbaWfvJva9kL9s9/RGdgQHyEORz9zd23KYqRbK+aRd7ZOvWwb0OTkfH7nrATkzaSToeQfaJaZPYyfNAdmiu5wgXxYMOqv7inCt6AtAX2C07cXukFO3pVLvT2CcYD/kI3E/Aa3az3Yd1p/eccj3anHFYp+T7zcFPavqct+1PhSOd57z/6LzG32+XR57c9xryg/3lQPlfiEG97sVn81Hf4xUOneE2NR+tsarNeIixRmQbV4duwvbWtTsaUwd+hr+rfAqGFMuM7VzVg2MfvmWcxJ6yzdpK2qsmH2mO/aC0WLbHdtsqNe7fpnPM+ts1+SrDPiTB6S1pTG3uBzpFeXv2o7aooZtlt8r+0X2xvsKv4vtoPfqheSkfOWKLysZd7r8l4w0dkyrfNX/U+rR/3ThW5974NH27nuZGGtm612D/jD8afPQjy67Keaezz7Vsy71bsfuDSjBMfj6uDOqoH0S/pBflo9jma99yG8TiBItouUf9n2PZRbquOajgfYvQ3dy3SWeXdB7PMTALUHt0jO310fIS7wXtLPuZ6gfHUzgmIljfkjt276hBm2Us7tVDzp981IvwaUY1eLDN/Nr18517TPpLxkrYIT4V45rbqBw717bScxBjIv91u5x5rvRK0e9pj0GPnN7BW55Bz7mvns321dLZXrk/mWydHfN9xnwZxuviHDfn9I3zAvulHbexzoxJ5AmGIulb1PteBWuKzta+CW5UyOSYDdQec13rmev7aa643yrlHik2iclrDDl8wx6n85c8r4iBSl92KcH1GmGHfmhfO/F+pg11Rr0m+vnoN3TuYbOR/cK4RMiBXWm9gwAYwhwLKRy+GG/hD8+prv3bPxur9GNdg2++9xec7eCK+2L9vGYwzXLchHX6G/NMahn3gr/Xs+zy78816Sna8y9tj7m0SYb853P8N2R7yKXbHgvWnn5WWuwtrktWfE4edLdw1ObfM7pm+5jic22VPxn2GksM0ajtTqvbbXnpdVoGV7p6fndm3gtc4VH/wnyOWorU3zzU/3KOMqpdtq1YTi/sZzbqtgeoYUAODLgpw0QcLPbOMT/6BnvIJ3voEdPNjGkW8tLX4M5Yz4Wc0/O5kbOU2sSS5Gjf0moMayfd132fe0XmF2xmmjnWZ6xrkxhr4CrUeE2DtcotxrHTWCYJHhp0Rjx3FtO5F51/Zfkyhq/6UL8WXWPyLNcZh4b3Cte8DjnfrOriCrr+A3VkCyM+o+pxmLPRiFfCZhoMh073oWcpUWsY4x6OairNNR2Ar2AjeUBeT+akQHxfx1rjXNqhjRLnNb5tURdLc0j3Wy+PaWeQ63tr4IjjfvicwgFBHjRei4m8AueqbNTUc26U9os9fcBxiJ0j477A35RxmHUqD9dku7kZ/Jfd6SAYlbquJ8bDXEH/V99WtUyPY5C4dGwef8VqSJReTItTx+ZwnDHvkdO1heiTOdB+XdN9VC/DCs88tmnPvte0X708ptZK6Np1k498/6SG3QnID6pyTdlDHbu865d1/VoOkNyJ+khQNxFeQ75HYhzpNTR/lGuowd0DC1DVj0ouzZRvEtcJaznJ5ygP3O4o8T4fJKelXmRkc89lPA9myP8Umd6uox44t9e9Eak5qor7InYjjX1zjJ5Hcn2OGtfd3OQiRZ3Ins7xyLn5qfpiBu5wyXtomSFxvBj3qdSLqfuYPpfnbPOvyEMb8a7XkT1AztAZsDxJ1PfUi4KlalU7LnD9GE/TWRqxsGU/CPp9mlvYp69cg8K58z1yt7NMU+KGw2Ua9sZPyWst933n6qDWkzFdhox9sZA+0uLryGpO+V3sZse5nxI+W6g7wj4UqTOcB1PEXMz+HNKBjZEdXoezhjihj7qM5NiwbxN6Ki4j9JhS5g95bGOdzTF4oa6az0nu8bzFYqQP8z3gHnj63J7syKa65bh3l/Y8yaWufEdr4t6KHa4ZZGzFrutsA2c8OmEsXBdGe2XbG+fXkrNyYvYK97oJ7mxxVGWsFviTWIeQz54x3Paki53cn5651GuJOCf2SogRs+f6WWBn9lDr9OW4/8Yax+yjYSX/t22qYUy3ou+3QuOoudVvrK3YyjnSN6jNQV1LvslxpE4shq73OfTKKOgvB+6KdApw/BirqUayVmNqSH/mXmPFAGcXtkZuATtGYVjRflxx7zbZFM5IsGKMOPjfXvchrUFvaDn/5rgEU6/GseXQVod8SJX5oR5bheMmOW/256KWf9Ubh9c91zcP5zaldyF8vtorNS2zBqjjV727/vefGf+NKXOjOQzy0K+v39lXJneKwlZeTMEvsO8/0xGq3lUwZnQMwOgnPKX1CKbEH+FfWVxDVbbT/J+fKWsW/ab6PX9Fj/PxLD5bq6IptzlXwWuVXOtvPC+pE2I20Natk25sulv2kap9J+c6VSUPkvFJjQHgGXV99wPqqD5UHRUwGs66djeqq8plOk/qeo2aBMHPHkpufl5377i3WeOHOJfUNA64F41s5ajGMROrawYuuvn3Q+zctFejXI3/I/1z7nvl+iiulaK9Cn5BYJDTOV8w1uFD/y3d64ve3IccRXie5gtdp0z3T9Xd0R5P8XmT9zX3SzV/f6tVbt3RZP+6P29ed+F+zqTIHuUvdU7z9TO/N8gDvzPmF92Psb8f3zNWh4beedK1hf3ret4nXVsZOrm65Oe13ecC9wU9NrSmOTrPsn+07YreKuCPJWq4NlwrNc6jLlr6fuou+WtV+PCfwC/XMSDG7BwLvoWqy7m/3sh/uhUzNE7E5jjePUe9VgbY4SSbCvGYKtmzeJb0jrGceVn2xy9LwQNt0pwHlwb5AYhro/5d+iGmK8ZL5P5d+xOxgkateUJNJNk6ilfp5UHeKexHWQ+P+eRRSym1hbe0OER6fZuOoaK27bu17NI/hLySe1Mxsjv3dSF3J31vZp2m3RoGwHd4ePYTX+Erv/ch75nqE3NtaV/7CeWoh+Kcb+k6+LCm3T+9Z+m8qNhFQoZ96LPLPaqequEsJWISqobdU9wNcV/LnOfvzaeumZmuU+fz2h1uvz+XwGPbu+Sz5H+n5edEFj/mdJ/l557M/Y7r2st2Mh8e1bvXBp+TDGKk52R+2uyHiOpgh1dLY1P0Rs6x5Ua9so+2jNbLso/1Wo44j3xFj8PPxXCr9wNqz9EDcxYMpZzu5+OYk64lTuhGxyW7ZmjnhV9tHdeHxjx8531v4J02c+z/rbUleyeXso6GT41e1+/tyVld8qoTr6LyyNPjrD5QcUg5S8gdS+7+muxpYTzIN69weJY7UzkSI06bfyU/qilcK7BHTmkxqG+9i1lDQGOVfPz/ofcw9k5n4FTbiThMem55p/VhcTHLnHQdeGpcJFYbrnoTZC6MelszhmoFo5F1LQKjybO6GNOr6xYX4Gny7OJwZJNPuo760ow8Ntt8ghGR+5yXHmNP4T2sgdu3XMZY0r9Dbb/CAYN+Cfeu+I3TKuzMoUO/uSQxOFWdO1rXFNaJ9LZVb8wTEsZ+Vio2zzgZFve9lUKMl9DeT/arKcwhhX0xYE5BiU13A9hDcs/tsjeylu9G/K1dKhj2u39qlOJ204LGEa/lalZpTw+jOtsvMGjuh+/GHlWdHu1xkjng/UK+XL//+JawycguVM/m2rcnNfdp9+R8hMTvL/tnMUbPyvXIxysOKnbTrTImkH6eOTfL3rAYPiPhkzzBJzF9nUccDth98Wv+mEdpPdSOhfw2tG5GXqUR1k+5C8UNFPtsWpO98JhbifHPHNP9u9i8aP2keWlkT1Y5xqr25OM7PnKqbCVPVEHPg3MaI/aXltdJu1cKl43GCtQ5npTx3jlen03yyzyOP6kzzbUP7a8Ib1PnueQ+FdFvX40j5JyJ1i/228dc7DyOW1Rtkv+LPoZ5VecB+m4z6ieua1zG+b3npa2FiZES8qg+9hfrXtnomnT5o54Vzs0jFizkBuIZ6fMb3V/P0XOM1QSupKz7dKf63ZL7NsJlu+m9Y/AVxc5CTp8buWcWXJEB5/XIx2u6lQAY52Zcnv4bOPD/dIy57wy6Q/rMjNGnxGJCmRKPqxRojoBPzTiNs1T/mmQm7QXVBzkwcf3oud0uja08LD3qxCjeEpdP0BWGDDZrsYxn2lFsBrrCHhSd7bxK8jO2JxNYHBpnivwbzptkupGO+pEcn8JCCXUYYznQussZKlwa5YtgCCk8e5qrX71h4d7Z+JlXjXGU0rM9tirn8a5yft+gj/bX2RvCri3q5zzUwTRJxQ8qXWAulMk2IJsu6rk3+qvU+5Ats7syhqeXaWS66JNi3C39HoXfjRJq1At/NUrLc2L8QaPMtboPeFxs/2UEW8jE7JzX8r+n45cT4oZzxHJLF9hPWZLff9E7CW6Yw7I0ihmuG2tXelJzqr6pTuexMR83zlyfzLVSGne4fyZdBj+d/RqpRbwoG60C3ElwG98aVY6dk466rqa3l5ZaS+ethpwTML+AP+aw7YO6U/9WtGa3YoA+nPdwf5PsQI51mMAKC8/IZanj9iRfyKZtbjRvOI13xb30JFeUjFXYIw507R01KIq/9IPGatZULYfBvK14fcE9pvBVzBoy8plrrpJP4Vwtmcd5jLoz1IU1lrrPF3EYt4KcGsdfNowrT9+jP0FiJmSzSQ0zvWsRdeu8t0mWsQ0NDC31rJ5fZxkEHB9eS+a5QD0a8FRpj5D+YSyYt53ueQzjKyo+2UVPg8V4c17x8Dbu0DvRXNY76hmFL3DVBp805o9HPATGp5Ke1DXJi7K17Nwb2e5mqWS//K6968KfIbntI2fIcqWzvoTnya3k23SmFs7WHbhOMIzJR9WDRrb2AbWy6IFDHwKfJeTiydch//reLkkfP3xW0i20T3KIudIcFfLhOMAbCUx7GYfG1oC+YFw6fS9wVyT7xmn8XC/Y3ZC8fBwT2UWX7/4GnDDHmdc5PtOnbzXgA7u3FAws/TytB1ezGjg9oBsKeyfocCz0ybW0loXwWtrrzhOdKGsezou2Cc7CxZG+B9SzmjO5jvUVZPC1o/ZCUpYq3+7jfbj6LThV+nmyb8kHVHVZx99zsVVfup4j9uh+/lvs2+4NPUfAuYCvOnQGZc9akY89MGIb7J+oMwMbimVgLP6jOafJLxjSnpIajtIK8luwJZlrAHIn1yB/oO/sSB55TfAzNPBukHtp9TKM/QT8ClW3AtuEsT4R/864pyntudZOet4apcNfb6jR36XjrSX6NdhnjcVIvOYJ+7aZWVnzevGOfhelEz60bQQbB9gu83GTc9AKP4l0Bfam9dnez4NZ7XJ+y5BfnHn5xDz78RwVYs3AOIDvkzY/Uj9NPry67hCf02Wi/wQ4RculYHC44Hu5oNcT7yL1MuF8fTjhM7AulxPwl1ATiv7DgeWCC+7UiGFLbEnfCOYT8GNIJz/G/Ew8Iq8LbJW7wsEhXd4RObUh+0LhjhnX7KWH7HJQdpmMKdyDwcixXWC18n5Ji6NCB/g3kk21RKya4wRFYCwHUm/UP0i/K9kJ5cqls+kvW7fCNQWfQp3bc/DupdnhSrbwc8MzjWuZE4ix7Og32heVmiN8j9y7XIccipLxxrueq2M38g14Xys8OpqXGZ1j4zzLOSRbkv/P/vh4slT23e8Uefdb+wxvyE8p3aHlI+4DLh/PffC3pWc4GsuRzkae5i8xbugf95Vsd2ccYRjR2LYYu+YPC0x8w8heRz9iOI/sY/IzSvOhY4W4H7iXlr826oO0/CXfcK8xOJijWb0n2Qh7/Z5NuzliG/sW6cqh5U4lNsW4JRH2lWC02bKnApzpHfkrZ/iQ0POtOuraq/fpaGLx2BEXWXPtBOIEx2mY1y+C35pkJOTC9+81HabeK+rj3hSs1xJ0QlH6Luou+YPN47ya15jeB6UzXjqjrbLt42Oh7zJd9BAZ8+EE3WLafGB+YfsAAxdy8YkuJj97/sEYLDtd/1XMkl1tvTHH0+qrsf5ulGnNS78+G+Xlk/0XjUHJCXVvte6I7e1gX9phTaH5G47NAbsI+6FkzBt9PrKCSt/Oj4bO/LUPs8nAipDcKnMlbvHuJP+yrdR1NO2kaO3asXm/GHtrS/oiH451TmeS5gJnao28VDT3qxWeC569t9r1OFnndJ720DJsN32OwevcvL3s8f80O8nALN5P0G8z3jJ/V+i36r7yOjCcOC63fkct603el55Djoh/75Q71869cJmWC5lOeUv/LTPd8vLSGU1s+u7SLRduHZKxjL1f7t864C8F5zS9j3E2RCbw2WjsvTr9vnp9od/x+Cfruf9eQ7wBft1K76WztpUnpB9pL5wb5c4xvL5cuND1v9X4k3vpQP/fwIaeeYzJtEjUR8A3BGeYiQV6/NMeQW5IyeifyGGTnv9B60i+9uDi39FvpG13lQPeI/YCTH13zXExwcyCr4a1Oaf3NcxXc5LPr+vCHr7x6764aY+7t1m28MOsrwAWBNmPJE8OVnfTyb6ufdJxUb2IjkGk5yrmcTyhOzinv4dVmPyt1EDQ7++VG/ZDZ9O4dO9+au8DanGUL/npc0xb+Ojxro9YbmnPEh746JmNTOeO/vflpXtL7cHZT7j2+ctnAKP002fsIKynf6P5tDp3h/anz7Yz85bsBxovF2t+9IHp4+bh9zJv4pO1JBt2Is/euTv/Jr4P/f+M3kTWUYzpTPfUMYjqaa8x0wTveT5Pn0vuO+E+NcFd4nE9YjgZ64peptn41yfpTYV1mY/iEtnOZxz/xzbypPaN9boH+yo4zyrMK3tvZ9j/oP/bK/QF/Hmc33hXxNPD2pqDGUvTdTZkU6XPNb4nvYS6lMtc1vIqc9y0wYtAaxxiyknfEc+Zsu+j+E0z+yQXQXYnrdvZvz3JQ4TfRzkI2CTztVyjbDYtoxXW90n7hypuMDl+3UuW/p/Kb5A9PxGMY5FV3J8wE2w2w47rdvpkBHgWeijiMbnIVqueZg/vHb6XspWhH5O+Z7BCLQg4FCa7iTo/q8vTHhN9b8ZJrKKWdNlGHFLsng/0A4rPHF032zV3adf1OOeHue1y/7BPPnXqM8uF9GtLVhjPQM5y4mGvsX2VA79ROH82zZnjPMYxJd/RAoZx4ybxO9QwwPdTNUbniCuQ+yLJDw4+GHe83v3UOWzUOY8C8m+rg46jMecyiB3aa9LzOdVzDc7CDXxz01/mvGcmTza+A05E1AtyvHMyhv8Xi51tp9wrmFN1kYwHbPhrRXlWDeee7KLLgfs5ed8rPWhistCzSOdcgUncpD0BX/mu4qOcIxJ+xulxmiW7Cb+leXivbz/7ViWMS7aXxz55pZ2hQzaqZfeGwIgEXirqhzkmJZyMtD4X9OvQ/iN5N9iyv3q73gVLrn/ys8FdcvfOKcUvbhk6P8/XcjxhOuvQcZzWRDb3hov+Z75WsNo/B6tzybZIuS/X2f6pW7pbk3L/c/1zsOzWKk3gVO4Ee5H2/na2q+xNPMam4pKAP4ux9IaGvcBYIvK81s0nfYuauCnJS+s83/j70k7xctMaR/GTfqqvP6wOHJqrcB8Mse9p7fy1mRuYYM10HGYRxSBW8Nt27dJR47WZcZVof0scSOFzV7dT9rvJrrlFPCOq3w19V5nxfTAHnqnq080I7naXa2PmnDcbkC3LPJ272Q1YgKxHTt1yH+sH3ztP/j1qOax20O31rTMwusBT1g17C5mnQXIA/q2Sf89EOOOLIe9pweslOxDPEm6bAH0cavydQ8wG5D4qVeNXPjzjRj2W9kZN3Tcw8jqjgro2Pm9qbXTsJ5+2tpO9e5zVyP5QMZ9WYj+EcY16+Jv8d+JB2pfw7/bPps283ec+2Y/gFEUtZv9ml51tvt92qv2hxjX0umfErhP2zr6fgW3lnIEdO0cPHThVMrlPsl1hfwTgCiCdix5q8G7HMEcFYzmcA8GXRW+Vwnxu/40Y1Zvscf3dh64jbowssk8LS+FViL6HDsZc0Rqteh7JxlJSDuZ0nFZysfCxMmKTeFmJD6H/okn+zXu9//lWH5zx7hrPrlGVvTlgjM5Gov+2GDCnrDmefeEDuG3tIM/yjJ/J1zWF16CUrKfkWC3tX/IJR3bka321d80YaC1vAZ+/U4jFGCHLA6XPUmKAzI2Sts//pzeOzsIrzSPJNuiSMefvHM01+BjbQ03PvGyb8844H50hMCleDuRv3l/L/VNnfbh2yg2rteG43u/O0Cb7foDc6zF1nFKvBM4fi8bzDOdD3eOUl5wiMHj7xyfv/Ykccm+jMfVkPN97V14reVbZynf+uEaRzOLeSW1voHZijzrWbnG0zb+SvkQePdKd23zPLdvSZ0V6J6ohZO6lqtSdcf5O64b7O+xRb3Wcl5ZXeg7r2dISdYaopSg20FNv5kCdmK+AcVaBE3FTnAQKu3xOcqa6Bl+C5C5hS1+Wg2r39QtOAjrnA/ARLIWfNs5dRPO38KTWYuHdtN4qmjz3klvbCNZoAk9Rrt9FvI6e8tk59hLmhoOFygOk9yOqmor5ONi2VM5ffzb1gOGzVLFTthmHIwu1cc2q47pNZ+sm+0tlTHvuO0ZsQXDeq/kF2VngYl8IBxnZT3X0ZG4/uP4Nvf/26Rari613g1lt8vG2Q99/DrX+O465KL39+Ezkco9sC0x3/OyHHInkXMDXl/8LOhLzZPIXmc9VuPN3zh8+eyb5oX4duLxfXcN9G2vyMckWcqJxRXV8bH8gF849BPB/d7Arcxvyr8I9oWItCexQkse1YJvgFTFqRPRn8EWje8Rkpsr/e6ZvmzG4QvU6PO6nWK2Bmlv4LqzDTTsNdQjqPs+wT1kGcP3wUPrMgBsbm6M6Y/ro+VC2XeGv1u6cRc+M/8AD/4h3qzkJEHcTvEBlxyMWJLwEsf3bvhWivtL9dt9yLcSl0p6t37cQnn+Je4p+9VYW5AWwifzYugPL96RygQkcNNnD2r4F3sehv62Wh7bbd+JnLr2ePfL3OZ9FNiew6nuDiiNnHjz3HnoMyE6kf3sZGza+OuvFz+4dveVkC1nV15GVawpPBmpvz+inEjlg8f1S6pnRryL+Ff6T2glwMLKPtmf/qcb+YyB9jarP3gqGnU2B84Fh770nayGYAi+PsZJbsYO+u0l2G8nlekfbYSuuGdlxLBz+PfejNGq2zdxwdB5hLzP+jTdg3B4+d+N+2nPW9L0FPzji3WOsH6nN2QWBWWsysuevwn0Trzl5XKfphs7VqQ1sMxpbqzbd0v7eTWjfzEo58FW3PcudNOoX2hNd2luXD3BKD+38a3/9aHu8jwM6Z/1Ynw384lntmlZDD24C6XUYrki+xs9t1A8TnjsT5/4p1rWKs0ScCutkzVaxQfq8kcBwj91b9p5ZOx8kdY1w26XUaihZxNiF6Ccz7qvrWcM+n4Y5zsA6Pulb/ppfUGL7wpUm+b2rwVV1Zw5dld8D34XKBZnjgm4t0zlz+k7AvD5DZwD+mKZbTWBWRDIzvHdclwgGmpK3J46nhPrkz5wnyCXMdt1HzrHSqjlyquTrgKsiwd0T/x1zMSmc/ETNXWws8F9S6xzSavWY2yC4fHyHKwW5hVdgbQxtE9s/C16UxHzwPgs5PLZujea+OjJ5PP7eXgtx/xuxfqDL0pwjL4mHnsJ/p+OyDzl5vQclny1rUwm6fa71DSpJXoS0/Yd3Zmy1dEyncD7+8z0Y41NJ1W/AnuTcZHz+LlKrrvtzGBPyY3azLcZl4zrY1HgUOBZOkOH8zNsTLBU5p8ArlvmTv5lXEONp6fqGjZMxuRaHlepomNjz87XqJ1Uxavk98tLdHs1ZcejkUP/RHAXMA9VzgmDR3+bd0bb/bC5nai7CfYP4eTLe5O+Za4LfgYZt+hIKS9KwkWrbhL0V8s2SbVE4NEgv8vlSeT/UDHVGjWx7U/jolF6ur5vOpVOufCrsR/QdSr58fPnRHzcxlpH6+yPs/SotLeDStDzr2Fh+gRm2JjuP93Mj32PbHXXX2m9boRbod+9e+NHBGWUu7i43zvRGuRRe5+2xsf6GTcTcbYOg52mbNtRvPFe0/0awlWAvp/vL8nt9lhzakzPmrFf1+eKfC6/Fk3eP4o+PfW5RPeLVeivbdxlLyPMln5f8J7EB/T3LbY4TSp+LqjVAn1J9cAjHrnvSb9sV4rjANSQ7LRfv2UmtPYtxcqT4frDTDax93oc404KbPT7e2xny+dd5xoblnBbjCV+WIY+ya8VruVLsnGSeIq0XzdF5ZRW/SMdKECxw3ZsW52yI26fPfBju64JvWk/D5xKc+IbBl6ywHQ7QsXRuOXZM5++mdTZ63Kee4DagDuLNK6L/5u5xTUdA9hy4Xq8aM3w55f8X+8DAJf01Hjj9NFwI2KxcW022R6nvdNuuWxxJ7cUvrl3gnHCaLV9Bb8sqgOx5rw907fEH92uvMVdSWyz8iQ2xqQWDjPY5144pO8msny7Ees5DP59sd4xT6vuqwkXiddHLfH+r5S2ZP3BM5LNSP7hifkeWUcg/SbyGY5p+ir+APTZX6xDhF6zCuWmRz9eO5l/lk8hOQx1ttgjs5FidRXp8QfNMoj45uLwhLm3nIz+h/Mgb8v+R92bNiWvNtuh/2a/77LsRmKrSjbgPBgNGNDadaN6MZAxGNKvApvn1N0fmnNKUkDCutb5vnxMnVqyoKhvUzCZnNiPHQH+8r3McMS6yeThXjc7XOi8SKwMXvENst4PNnwy51xu/O/i1t22WbTJ6UZBT29QfDuRjvMV8XBoXcM9s0XPRYpwM54XCtQfuDeiQpJ515dS9IZzK0DfnfmPoKsK37lLsW+f4NBMPG+Uhl9xzKhgxjdfkHLOc837AmM7Heoi7dYC/COy/wJEADvFRXnF5i2/048u6dS1d7/eSMw/1IMypDX5VjrkFe3FgPrtRfrJ8HkrMJ5yx/swrBNBT+HgptHTP7NU6euQ/8vU/BpbtDCyHLOMcPvFnLL5H34H5uVzXGSwuP4dxGFTBCeD23JBTDppE+5noy5SqnVxQ6pe9q8/GvQ7w89jvDu6u2JnEeQZ8pWAlaR0Ai6X7yb589qe3zRcYg5Jax90pnm/UY6yfcR1wlh/U3BXPPmu8/+J812T1C3WYGTBxqj9Ff8YCb4r5mUk+WDauvidzxny91vQZU90DN+tjPBvmfWpunvN74fMH5DPHng3YwSD2GeZnj31mjef/E7xGbFxWzMcYGwcvH/xIjNWe/UUXmPTYz9+jny+/2vNRXsttV3pufZN83+t2Q2P/ad5rfCYiF8J1u0Z4ZtOeXdoUF3ZZjxU5GOTO+laMU/JtJnmUZ/QNd5d2q1+xR80y5+6Qi7Zhw76e4yu8JhefFfuunn2n9gr6yT75fBI7Lzjxzpd74Up+KP1/jIHEwQP9DJfvp54xOtfg51Fs93Cf4KVN5bu5uE90nYsalNKwpVhw1I1yuMBehf4bznqpjaCXNsU3CmsIht8ltZd1C2tDn3sxP/Oi9zzJacD93No/vMBRKazR4U3xEV17hhj26cpaMmw2eBG2z67rPKH/knHjObs3ovh0UKVYNDcv9Zd+tZsaT7h34BhT8XkueoflWxO4+JHuX4n7OlIXKJ5T88EVxnqmcLEfoRn6jn568KNRvL0Gnoh8+/l4Bc1xiikfSxRXlvbgW0fOFjiZqDcuNectPMQpeSQ5S97++2lhe80V8BrH3ahc5NzrrGyb+aJza53bPJ83n42HXz8ijk8X37Omo9Iv7gcetT3mh308Cr5z3aXfc26I/JZf2+eT932bWtvpuF/1Rsl8cH4BGmfuvNONuIMTZ3S10q0E/PdkDivUPQrxwxIHp++TeC54rHR0Gcuuc4vQXk7kFBXfiOTKRiXE1CFv0eiSs0j5I/G4CT469zGyL6w/q3styO/qFbXWplGni+p6ElPG17X0zSI++LNrNtdcH9sK32twSrsH1zhHbC9EA+Yx7FdHf1Woca2w3J+M6QjftajrzDN1He2LZuhxpPQz53UvszWlNfwDa3l0svzX8/2u/e7YOsaW+y1jfUHR+CRy9ek82irHzzpj58ueQPm5yuG3oSXfde2S63br5Dte5hNr4N5r/8aaMTmeG496zOPjnDh/gnF+F4/DUGt/5HmYMhajHOkIRzoLjnAs6meNekN3kQb5BRczsJbS2yH32EqMVNH5wsTv4jlG/fMwT+iWnqH5wRrqzBdwwd1LczvnvTQsKDxQ+VKnHf0hKgfAmndK25nx0Ki3NXr3n/XH+/DdJZco147V3EXX4oRaL9t+aG1W8bm32PponkrP4DEcLINKN64Xw7z8XA+v7g9p95M8Gn2WcQbge3OAd/DjueHiwR9Jfvi1kLvgjBMsBZ+Zcr9zqt4p8wvymhLsAedHG/wcb9s0zU4fz605J8GDKX0u60u+LuYI2OJMULh56DQE8LuBBxixVgfW1UB0Ky+/T3EjnWmP7Sm/SzUnPgbzEV7WHiVWdj/8wI70QZhP4DgXzWb+3Qo4J+/E3OIU90d7J8uv0+M8zEfX5lhI9sRMMLFz4MxnMuZJW6Q4OPD9BcaOa+iC+TDuXy//emNsKY1oQq9H8BPWPn6tgMeD30f4PMBRoTgiqzbridFaFf4wio/T+LuTWI9m6OOFz7XTWA9jHar3xLtoPEnHHMuduUdS7heuBd6zXHuUf8t5kdtH9tcya/vIk4b7VdU9omfXOmPMFyM/i+/bhHaM2muZfq5x/gCbwDqY0HEfjvkesg5ScD3Xv/cJLIkHPJKbS5sLtebZLuu/x3EiiKmHh3Q8RJTjSOBzkvnuuG1lLq90LnzEDrE1pp7TeA/ZE3i3kH9B5e4aBm99yv56B7eE9uMVdhz6NWuOtcpyX11D9qEVtRBsQcctOaovyrCPA/pMFXlX8EB/+OXLvKbgUHgPxsfH3f1o9p34eYazIiXeyrxGJ4E5enSDr2qh6lq/61Xh4JtwH6PsAdgz1NGkh5+/u/6qJprNbxb7vcGh5ORfhsAlh5wFRl/x/Rq+qSM9yRGHF/vAwTvb/AxevNjaGtiV7iCpQQafGGMo40Q2wHgW5rdFPSRxprTQ95gfyZkB3lSL+w/KpQ36HzzdN4HcNdblSHLs4D16EZ5WzsdjD4zhA4xKOv/+FvbW9dh28LprpuM25PvDYrGhNFowRrE4BP3JjN+WGjLyTrSWWJ9WeOPs/MtQOAjrSn9zVEC+zpG5Rl7dZZ3Kw7X6s+kzDirBjOKdQVfHsYNix3Uza6gyl/G6aAD8DzhemHuXtSyVThzycxk1nQgjEO0HbZ8aybUCriasJyun15/GAWxTMWkhps6aT/IJ3AVdCzX6RG33TOfcwcvPPw0sjsbzAdPwOa0dF2PyoTV/ZlJ7W+MXonNKY0+ccwLXS+szUD5nXdW460r3ELgE2M37jRfs1h29r6P3bqm4Z61wICZfaXYMpMcy6qHnPZLBTSp7ge7PNczagMc/qsWiT0rztbn+FRwAv6fG61xi3aqdHq2//sBxupb77BocB7F9jj9H7TQce/LMjLgHU/WtwnlRWOMB6642suqsl7hSjJn5DDoGVb8LpmS7FN7R9y+5ZRmPk/S3I5yw+lzIU0BnQ3OluWEjvyfC4YY4pwQ+twPbwPsa/VC9pfvgVu2HXqX61M1d4olfWL+iuFYxxUnZo5P4OYyFkbgoUPumdz+P3jdYOpaVsQa4Vj+frpeb62spKwa+l7yB4FxO3rr+6YOvLT+n2BWclp7smfR94kQ4IU/2SoaP3nh0bp237ddzw/7IdmzwUCSeeZsyvpl22gW/XG4+6Fs+sC6ljgXe/UEyhg1x2WI/0uaxvR1z3cCX+LA8P92aNwp5sG/KC0nuNRkbxHHnfjBepD1j8j3+LXawMBnWNZfIycSn0N97/rAIDMs6uca9mie5D5Vj9iS/HL1vIdo3/7r1pXpoY7rl7AOY2oPKj6ivFa/oVbsej3na6Ccppp5TOsaq2nLu/fNrKvTpQq6WvDyP5nS5/T3inCF+3l0ou6lySZ6ZR3pH7vtV8fi2JNYx+2YYQ9q3gJdlDtvOYGkPu4O7xJ5UeV9oEAsHxGFi7Q6jyPeIn3OuHfKZ6/hAMFOwsZoTfN+PuDSNdaQ5qwuxvZDOAc2+WXi9c708VvUH2pOBPF94PSviFTX23VP0nOZ8XowTnz8hp3Uij1s/lWovoznw3DTeRe4HQ30Cc3O3eekhRsO16ZymNX4QrDnqFMCbR32Ln8IXaqsz3YNWbG6cggOH769yn8CibX06o4x8JOdtW6F+BbQqcrzO8TzAXqava9HHJjvmN7LG29DOHRUwxjbmdKa5TcHV4i+y6k3+Q2dQfO4vgwf45W7OLSuf6XmwDB57F2uOayNmXYD7sFJsZwexSwd7RfPO6nWT0HqmvXiCfqcX9qG2Gpl1uFh/dXHrVe2wH63xWKJ1PIddcjzmrqPfW/aOYq/DeFV91xxWuh9YnQf8Ps217td9i+dXNZ8pMLz0XfAXZ3GtO1bJ7SyPTseSdUmxT4/2brkX6ofENe9EGyOKS4CNRR7Gp/XmDwVLp/jhga07so7KSvOPmhw6wD8et+hVmdK4NMoZtYYQm4M8lHu+5KJVewE4msLkk8Zjr2Jo8DT1egPf6S/Jp7Ymz/2q2+667cz6o36HdG60a+8bAAPMfid6cy6e2b3E9kf5U6kBPLv7PLAR3io4NMpxfO8f+L8fOu+hrw+u4AirTHuU/q0wgMZ9E7WHEGvW1XUhe1hI5nj228a5qnvTt03NmzEsQu8FvOnBZd5sKdxr7zmyL9Yq5Cz/bm4sJQ+bxbOoa8saBxmO+/DyZ8PzZt9yszR3XfRynswxSbtGU8UZRj6h1Rk4Vdj/qBaVXQtX8flbGMOsVG8Fn4k4K/n360SudM798ND7Gk5WmDvwr45Ez4lxKVPBG+/U9XdqbNXvkhyJTkA+oeR5BPfDz6DXYcfIrZk+2jX/jezrWrgW43kA/X7os9f3zKo/Kv4XaPZsmef8ssen36tULvo/9HXlTObzAtp1ziDH+mrMk4240F26mfXrV86hBcyf87QwY72c9F0gtnIVB9LFXDGHTvR+Z+aEyFMMj3NZeJoYR4++d2VvBP++UeeWI/ymWboZvtTneB1Wc855K89nCXacteYsyYnR+i1B84r1pkfys1FeuHKj7+Fc685pPT1Ak4U/n6HFzdxAa8ZNY1/gPD2p/mqMU6jhx/uD1oK3Zr7vXEPq+Fk4BXAVLqbqLKbrhLxcZId03BbjovbC3gjlj4ffb18bt1CfCnMSYRTC82Qbx/QonU/MXwKLonysK9omfmTHmMMpVu9Sez2q84wKXDNMrTnN4nm6cO8zPyJrE9N1lX6mfi553mOYv4s+O0jp17BXz8OIY+rKdeN+e6w3mHEr3BtD7yI6pHmNaZd7NMNe3niNhPdS30rYv+h6Yc8T7zfaFwnbNVnjvBonemV4L2p/rwfcTFfNd+i3k9+qOAokv39pXzJ6zMbbePyi4rtzbpO4b+gzp8Tol/F7eszG3GHPfWuKmHOan0yTun3k8itMhIydth/0HdFEC8AVhedyFR9YttZl0gf5ph23ofWAuQb/WGS3r+W4LnAsFNN4wmmyivV46Vz2B/ldZKPbQeJ+SotucKWu4pQGObeFvqmR9odzGtPUrlOs8ah4wdP3WwH7Ges3JT9urNdEXtzwcc3+debhMvxb+BbBKfJpJ+TPBgPoMcNH71s+ahQdYEKTPoSse2U/NLagbOD9Qg6BIsd9Jv9QuibcBZYh1S5xziC8X7wmKjWU7qxbdZxu0ElicTTff+T3rKP+i0a6nYhirXAeOEZgzlXhBTvE5zg+p6l96zI+0DFjbo48vbc698P9ovmXo/u4yf10cV9jHKTPMalNYawvpZ/cnnl56/MlP0ja7kt7XZgXR8KXbNN+Yf5n0aOaT1grhLmt2uzj0BRCR418Hs7TjIc9aHcxf/dMcYrh98KxZdmwF3ev/JniJ2NM6F7pXI0GHtRqt+idq4OgKzgjfN9q95Er6rrOYMQY+sSaHRbJH4K2ucWaTq+nzV/dQXEILq3X/O4H8wfozwT732SzTI5neU7X1pzrK6VV9Bb73tqyb9B407hbe8xaiNz7OHVOZGMK9c8xeCALpSJ6gKbvouvWw/udrHfndLzCv3aM9rY+Dy176z2OoQWc6V8lMXCRrl/FaiKGHgb4O7h8diE3nsV4FTsxptsvuMj5nZ+H9XhNKsoTMP/CswutjbY3hebbNf6c6lW/OuyX66y4V87Q5kvDVQnHT7K3rpHIBw2qbrlfCR5GlvOMeyd12bSuhuJfMfcc+TPg+YRu0xf8J+XW26Dmznndrdo7H7Vn/H1Ik1gTrh7NyQk/4HUI3XVaR2tcf4/8nuIJPrxxnqfghlzv6MVRuZ8QxxGvmxcD8BFyv9ZD/a2xMM8LVV8mf5171RkjIZzL4HpsnO5P9fLmTXEu/dU6XMHy0DnfLEzm3gK8gvVPXTdAvBfxgSDPY+em0HdI6wljLpF75v1QfGQRrgV9C5ZToTXWGvZKv3TPQ7cCHY72gGJks++B1uKElvgRuu/hZzu54zPrjl/p2eAancJWoe7ULHT3XtnTuMUYz4nCmm2/p/3K/Sa6j2PFXGnleaJf4At+lKw+kl7I1232+kgOXs7W0qBCc+F2wc1ecitzsTVib7M0Ni0vjxqg6g1bTUR3gP4EB0jjK43QR/cseYAJYo08eKWxpvxRW3zcwF556/b2FbXh9xy0UaHxvlTrW927uKJYcO6DO6F8/5+s1/Fwf7h4p2u1hBt7SEzMbrIfBhhJ5DYEt/rG/ZfTfOuTYsG9jLm3FS0E9BiAWyuO31Q9+YKhRG1mWD0xL8XCf+3TNToj1ibmfoKn4HhunOaM8x/1gLPfl50y80LMfeZpGHz0M/Ll+j7MywD9Eslxaf8evqfwLlR3R2glNBb3zKdWf7hTNkL+3VhshMN94Laxv0R7l3s2LvUrY7wKZKtqrMv6MS4sw15GYHxEWzreZ5zwdcWmGJwL5JvngM00vh/Ptwge9QKLybhghaMlG4I81tZ/yIHfPXrHzHhJrpk+hnPy0+eiKaL0xRppeFyK08DpbvC/8140+nIZY9CB3wP9RtEig/Ya68JrneOs/JLGDlPcos4HP8FvgbpelX3OqBci4sLKjOdr0AnkmtVMr3k1FzEdJ9YiLDjkj3TPzQJ6nV1oin1K74pwWUf9KAPoo0qt5FQ8wD+sVzQXsk/vOi/xOKbXThjH78XOHwtceDulm0Sxt0s2Xv3MlVicfKZ3lc9c0P5kba7EWIpWQW3wMbIEczayYJvv189G709zqMfD+08n9gzMHbCRXHUATrPwPrQGeZ86Z9rPeeb+ozPYCn//LNgz8mncd9aECd+nOBvlgRsE197yAlOuNez0mRtp0ivu9iF40rtaZz31nFU6CQG0ImAvDL5v5PbQ58+6eZynjOdQwnwm4hWdz5pYNvdopmCZw/FFXVl403gvhjqs+n0a6dh1S86d6/UV2k/BGD17V56V/A7mcXhZt8Qfp9hkUpM+6qZgliNtW5djGHD17MHD/cK85cGN/vbl/4bedK6VyplpaiaE+0VjReN7Nm28LmLRsMa0MfJwOucj+a9YrvmW2NTQ1pV8uOZZysJEmXlwc2y5BoX1SfOwY11N6AoYmsSjSJuRcQLQO3ZlfSOHSOe3vR7lJY+G77qPjjXJzqGaepDnlO+9OXlrCz4PjiUCW3ESeT8UZwfrhkwL3c0or9bCY3smcR7nqxlnncivGv36TsA16u/YX+ToIn7IW7j1NIfAG8+x5g3usT6FWf88TEbhe/I6SMG/f/r54szgswyvfdEPn+HnpsfIkX81He6ZM0HzC7RqvwrMzwA+CfIHJw8Wn/ngHEixC5GGN3JMA+Hr83JZ3ClfxoPPg4rbC/kgBkdwXVeGrt0fQHOpaiO+oHixLbo95GNAq+WSRzN6v8m6XZyuWhm9wLGxjtaJ5O6/yXkS5eYS/JZGPktpI12uuZRnFzyF0oyO2QMD45/WZ2T0DIQcoxxLmdeMNK2lJ7n+uMvYs5u/jO/x/hP/BjWQULd00X7vhjzw0eePUyeKYdPxBKNcRh8W3nEpWjMF+iximJ7S+DgVE9oc7U/RArWMsS7mW71b+mhjdcHYOCvcd0aNMLueccPZtDbqhxf3NX+nao/XanTx7+qz3YUPBVyPwzbXv/W54nW7+LWN38lzRbiN5GcjTMaN902p0cXOywt+HdFKMffC08JY+4+5lF6VLsWHwftI99ml73te48Y6Yj/ni5yp8GiezL3RpvjP/ngZ0p8qhpE1usQ5sHCso+jfCP8INHIO0/NY4mjm2aBrCE/OWtbm/SGOgcuyXT70sQPUyLoucriTlPrC9/kTYhyf0XlUgFa6wTl8AKdCkjNS+U637OXwPZrrsWjXXJyTUY3d8JXBwXHSmtvZGjmy1uKaO6nXu/S9zTXh2tAmw3pTNj9mC2J1suy1H7te3LZo3E3MX4z6T9TzqLHG50sb1ibKvtfneB3yQ8x94x7Ms1xmbRxodDGmy7Ns9hGB+dU9IuwXqpxO13Vqfctpow4Tr3FWc+RPIi/O8Vvjko9b5RDZ/r1PhsHBL4f769r+CXW8/87eiXETqNzt93xBrRsd4ejAmzJhruji+yudax7ry5Zy3smONKPywan1fg/NMvQxnSY9a0n7ZjctF88vZY69NUcy8C/IiaT3ACVjL4Onenjy6NnaJ8WTh7W1UVi+s+6hc4Q3J3uNxzG+0b9DbDRiUOQxKrau2TZjNQ3vrnXBwV2ymFcjyjuFfUv4rjxDJ4sX+BZOWMyzA/FUxET9ios8NMVC7Vs454V3sMDPiLgTtXnmfR7nXT/+bi1eX7Rf9y+jjp3QV70NAxZ/7tR84f8AVku4ZZRNzOrbGFTdFo1tBWPqLoO+1NgtZ5CzKBZt17M5J6L5VhhX1eemMMcWa+JVBPvQDd8H2Nemed9c16G4tk/2p91z222KER565YxeuQRuIr4e5Xwc5SOszrd4jyvqOb7mM76R+xjxfNDuu+6gM3DA6RDxJOi4/qInUPKAsZ7V89abLu4ZJ/0UHD90zg7jAP091qQ05wLxjKU+x3v0ONM6VHSuCU9jADu7/ND6msmeP7Jle9S5GV+gfQCzV75iD+ms6IETmPbSzzAWYPxctcD+G3OiwV6XPtvvwh8PXQl8hu153lf2vGRfz7PgLHB30IdxCrqnBHGHJbkW6X9Ra8/3NdYhmm/w5JTIX2o7A4vzv+Y8xNdcXGMgGCPHzWsK95HnSeTRmf9fc8iafeh/GzMrPWncU6644S54BRgXG+Sy7B8/m+gb+Jb05Xr7ifqzOYSGEbgdW5pjYEX2hcaL4y5gSnKqJ23fHGk7SvNKMYzmTld9rpmxmJGTO9I5uavH6+JmfcDM6xTIruWujLmhL8d56TS9HuY7o3ua3yu8cP5YbD/WFWoO3PMAvP4Dc6XNJ4x/T8Eqq/7CCAcTnjERtl6dx9PVr70PjYpVNLa0FnJ63AS7dbBvwI3bogWbOK/Lh8aNedE/uHfYt2Wr+f2DfoGozpvNUz4vDXJvyfOfPsf9s1tVm9RjjXpf0fz9l5zKeszyFIc8tjfTQrgH03ulU3hDVP6N15eXPwaT0f2mFeeW1tpIPe0Taj2sEM88qFaY/9tqz9xKQL617boptsZD7nHlzoy41/StuAaV2Adb4fmOamhZ/cRpOU41FhEv0GW+KZ03W2NBV5NPzldSXKnq6wYP0D/BZ2r4Gnz9Yn+UC/rk8z02Lrg3l2HdVf8cZ43SKrr4neKljPrmgEupHDknOMpFZ1ualnhaXE2+OmLE3434uXgD56PGJ1DcfkrHJ1yL6RVPE/l/Ej9cYAWyOEUz4rmI1+nwhprzIHCcbmVgYBWTPHAqn5DC0eJBX+uwaZRXbNNFCxK+aMFlXWHvnNCxYm0ysj0L7qOnz8m/m8voOwP6OXJJkca3/k4R/VszxBzITbGGWF5pVS9Y12MzzTM/A3B4wIavaA2uXx5D7orDtGYXVV5C6SR5Ssu8uGyO0M/U/fRFJ3pBa2s3KVvajigdkRDzvh+P3CVqGMC48vWHReHGULUw5E3o8+gHldiR7LPcO8o34Mw1sdngyNDaaXyus5a7jAedFzwOdGbSWLU20Th0Q/5F2GLhYSlCFxo5SKm5qxqncPIet5P8HM9ijEki5/MFNo9ijQ/J68CWOXNaI4HwOFMMvgpO6HfUvX26x43iux753hTXtesd8ombX3xex4Go6cZwhAsde5QeVP2sTXFmWHcwvrcVLCKP1we0tDHGZA/W+pmdk86fhxrLetw2iXHM0NPTPJkJTqKsffyo+i+M70FTT2nNhJybEe5dfMKXdRvvvaT5PoDvS83DjnveqoK7VGfbLtIqsk/AwGOem9CzpPFIsf9hbTGmoVhTmMByqSznnWjwKe4Z8lsz+fVVvvptPQjcJ9HxqT7Qmfjcf7fq/dyRYvkj2yPyp4sesFXAuKzrqbXcCTRUgT1R91O9c4qLMPoZjX3ybFZcQU6Q1EdxrH2p6W4OzX4wG412x+bD2wE6MfH7aH69+zXj3CxXcOmW+9RxJ6Xe4FjqLI9V53DL++O8FB5WsrPk6+05HmtyD8pANHzX7RxrmV7TPXjwLLM/YiLvKXFEVWNGtAaj6kk336mfs9Nw7II/ClAj7vQtcIx21nrdtbTGadIehNx54RxuaX2SzZys0Dev+moo5prP+jR2g6o7QIzSiudNwDMHXv9DOjYB97jai2Z8/1LTnPvIkRNcke9ZoPUitfmf6BuVXKFo9lxoLy58G/Yb+Ofu4IiaZia2T+fjuJc7tP+c71X38JNcJCuVqzx5a8HENKr2+WWIvm175XEdN03HROuxJuf5Dfy/z52c2wc/ej/o4jx3GQOVzK/kg7Xk5ttk/1FfnGttl49BLnh0K26v31M5Rlpbvug7fOsatKYGGrtLz2cJVieJZWDbpfgPZc82jPxtDzr2ZWNuGUNxoUUITJjWOqCz1N/4D5bo9K20TyC40/iZp57lin3L1vpADQ28pdac8+mF0jtz8oTawiFuKzzvwzpIQV+H6ybKDsrPx9DGXPDPaf5KLu3D50Fg91way97Aql7YnCu1LCcPvODx81X8AvKVWLP49DLaBpyHURo0Oq4fRbjlA3NbSh1V6Yzw86XVEEoura++WxqYNQSt65p1Viktoxn498kvZKwHczQyXqcK/tfzM8WeTcldxM6ryAZGGskYX6nX8PXRRyX8I+TPdweTFvkEdYwleNx5rONYG/rMscoYHAMvE/Gq3h8h14J7jSzBbTCeDbwflk3xSHU7DexZqJ0T7k+yhwVaqwPRKeLPLbi/9//7j//1Hzvv92K73/3379fg9WX3+t/7193+v162i//arIPTf6mf/pe3We9/b4Lg9ff/sz39x//7H/VTxSwOoLmABpsJKD5aB4jdOjUBriFgY8IadvykEYmJCDmBicWsgYUgqpjW4ATtYCghrA1H9icSUtKE2LX0dSgon2Mj06HCIDtfEVpASLe8CoGFkfBlLYj/vFAqGv/eToU0m0GffK37rfpZRxydt60AQ4TUEp9DUp4J7upCTtsI//3YtsaRmJT586J3iK7LjVZy4BqfcUGyngOgtPy27ZADWY9AyfOZaioHePCDCT8UgKchZGUGgEEViobcIMeNBHwIPoL0eMuCUyLQK/cVYXPamGQ0GVxm2fy++n4QvtSNo4pwSl8TRQ5+Trpu5jU1KJGuR9+zZnyP05yfQz9Pc3X8HDNxX5HnlIU0GDQ5f0eiTgV0OvjZRAFcRAb5GnN+/DOImadDLqy+N4P2Q6/itjtsRLowzBAfV4VXMj4AVC3uc5IkNptVVVGXAjDnhAJN5xAvalwpvNIz0PVRgPvBCbWy/y7XGCcKIwIa0WBiNmx5fzMu1G8WG+w8KiGh9w0n5508OU3lzVv7PS6okVoAL3vH1rskDQH44KIwnuHcsdoCZkWSczZGAEsHBH731JfkOgDPSPBwkfWhAvB+/H6F0icahMmZUQ2YrhQI+R0r8oxSXNVjFzXHVO2ogCuFsd1Fs9R5s271l1bzvVKk/0/4v1X2Es+gCq2c/HYQLGNNZIIH9KHaHOkCraW/9+G/iyhgGEAzwLENkYMHMuK0F4TQQZpZbiPeT38+iCCK+CEar5KBeuq6TAMj0NpKX7eZACYAwWldBZz8oODeQnMbBRE/Lg7jvJCmo6CpxJtzNC5B8mDmAkj55rGQOXFtFMi2E4yz7FPsIx6XiezVfPsxl1jbBthz3ZI5PkMgqopiFAUFfDgfpyymQ/ZzWN3JOhyrvdK1E/syAqWGQl2yX8J9LGAjNH+BBGgX+xw5aAaIG987xb6nhZ0NkJJzbmU9SwRGqtoxooIhPT8AUs3Rfvv0fn+i4FERNS0VaWb1AySftE+2CSDLGok+KWBClLHI6/n15AMoCjI+2RdDeieai+kqt0ciXxzFqzb0hkLBJcgG12j161LYyLd342Gwj2yRd/ckybHQjtBzsZOs1qU4cDescYcCBd3MGwH4Y6DgnQg6g4gqEoL26FxU4swROFiPpwaIRaS75rmgm3hDsNnzKOa8r71aCw3OW0W8vDdAI/sEyYLYoOvnh4jVouhwsi/mr8lzjcT08dM/oZkjuNfNLk8L7zfscuP94oyKnW2KiGoas0kJUFGc5GQbkhzHCCQUWCTVXpP9Us3IZwiDTuDz0FgwYWEv5b0KODfmc5Dcocg4Hf5C87IWvQtJKp4W8UbREOCBxuzlxOlatirO+qpBOCJoDhN1Vs6mfWL4GBfgMw1G2evvqOBr7WnhS5onFC96A7onBS5frN0L2x7OQWIv0h5XwVSXgkyyn7H5SpBD9K7v1QSAPvweve/6pUYxwCr4NMd92rNo39ZZRJMb52p2oTk0rrEsGT7Rbk1n9V9JHyUd6A8fso2EKEhkxF6sw70W/gzvzuR362Cm1zStvffmumrROihG9vlt+9V4IwlO8/45sYzzJ7pnytnARDpmU0LsGRB3oKhJNov/3ohsRfp3UAT94hmnw2Ad2ifyk8bk372yQLF7kL/Po7Ub+ywTCOH8If+smhOhSIobhkUU7X84sSD0qzVSDCYoGDDJVBv2gNb2lvwrn/z94prWYdishjU/qFT7g5PHIqO0RiAuijONfD2QaeDc9smPavd5rygQCV2DPjvJxb6fn1h07vL76PPr8nO+PUsG7WrcEVAzAVuhBfHV35MBCPg6OtmFOFbITod0HyQHVyjIDLRIAMWm3OStktD2CQnTpiasQWJYJ/JU865Jpm+C0gHkQQKuSXesmwXaqk1rurilfT2LgIVoJD3YWmjAANOrnyUKYlJwJTuM5pZWCMKbcMNt2FTA4lMTE6SHJm0h4JgCnK0/r4qnuzTx4NQGhUcD+C4xRRiXXIDgb46XsnzHOKmWk6+b8UVEqhWd85mEVPKsg9QY6jaw+/2afEDxU8tJcDv97mT+LglGZ1/x7lvvbgDQ8OxG04SdMkdK2JmT3J8exTW03gJP/r65nMc0IY64UI+xDlM+S+uPGwkhcpmcY6+o3zPlOSNQEIta3R9SPrMcB/Y7itVM2Phwn3J/br4+h2JyiYIywGnIKWjgAxKCIHBEk6MPYWQmorC02PG1/QUfjgG8jfL892S0jARehDRhmSBCRfEouocqknCBNPG9tOKnAoGUFAER/OgwCW8Qvb4hPqO1uZwwoS+DvBNFg7EWSbXj9kGRDuB3AgwzSINkTLMFXuT3zVV1OZGx2GYWEcj3TWnecihcgcAlwHO1ziBoUYzNDdMxwRYAzrWAwsIoHkIY+D5O1DSpWRRbd5FXMIC5EeBFC3wkQNoyHmqNwMZEIL/LcVTrYcVkCEKgTWdUdQkAGoorzjmb0IT8x0tAT5RbQBKZzmT3qROKylQr/UFAJ7QAktW43IP0k0kKasftWAktcB50WP2Af+7FGsmPn+P8Lh1MYa5tAIGxFk83vTPA/8Vvv2vu+NzJ7WedwO0PkyDV+DmFc+lCwJqLgotS8WVIn40VjydMDEtxVUohy5zfLtbrgQkOyDlwCu6Heucv9nHmM2qh+q+ENFRDAkBXYR48BCpdX48RMVZWk26KT6hJtZgQsvHnBILquY/mWXF1DV0jD2z8bdGUxNjkDeKu2/aqmWOBjZhBEHSy7qwvgIEKpEtnzn/WHyppBVIlCAO/IIytWdwdQtJ89t+nCsjE5ibZDBgngaieuckNosW0h7h5PASfi49La+v2uQmJ0zLHSvsN81gTaf+7+zyThO0rEibduPPjcq4p7kCeHE3niTNCrzOK0/YoqOsxSrf30vz03DOb9jxzDEyfxH7u34fADB2fOydDfCWax1gjF0A/FMP/Rb5p+H1j76+vzZN+H+RqPCYsGVxd27hXNAZGAVULBcg1OFdI567OWyB3YpBQpYoWax/kvRlcAgGuEYddJfRhkBT7G8qXODJgePKwverz6HektcHzLMK9bY63VJ0xucYi8oJeii0W8YR0G1NzZiCth7hN45wLgSnpdsiIf0+Z4IOf5udAwgviCLJdC/KjwppAlC/qRgA25K2Cbq8zAMiMc6e4Dp1D/kw1idySH43lsT0rlSxh/zL0w5ztxbWRMyHf9YXskZCAdM+jvDSVhaQMoyyRIo5rlZBFd8HEZSw2Rj7TiRtgLj8X5b2WY7KtArD6cr+l2moRt0e+PhRZnkljBeJ7iELDDnGjR9i4qNduusCWuub9jeQRf2CvQ+Fr5MWNXEQaqNy04fBv/Ifv2mxu1CwxcC6wS/2qU+0MQDbW7nQHRW6O6+Rs8k0vQUmx+yIGlPX07Sbgy321RZ4YMafEkrpxNR63iVhifN+z/fNH90nf/xpRqyYDzfM5i7qvXGOdcb+0s/0n1zVG7fPLcBKBbLle1u6BHEpsZXvQcQEEd1A7eyaff2buewHIOdV+xcU5OqN9T/FBaUDn6EM3u+aY0qgc5h/TGpSXFJuhOYNJy0CQQmfeB943boey89ZGXdOIcTnPg3OhKrbqNoDQ7IIUFcL2YbOtNCJmNYBe+Mxhg+b1eWNwoxkPawCXu2P/kG03+8lLReIue5/spM/nyjGIATKTPp7Oi8RthKx/1zYIwg0SSs4tXrcLfsHZ0rml8iumzz1Yy9kq42XG+1eaw1P8m+WX9iYiFaPzhGy4woagkfXLXFK8cVs3sCJW52ag7Xcb/TLzX0nyk+v5MGM+Ev4lxRgAmAJ8zoJ5V2IT47NokkNj0jUbE/mafcF1CPHd5bXQ+GnkfGwhQIr5GnpvGI3ENMZ5iJ13WAz7Iu+XJItKE3ASH4nsAvtSSpiC1vSDxULgKT7z9hs51Tfj/rYmyJ6MRDSKxUNCctVYs+I1wqsbatOlyHd4zxl1bQF763HUgudfkTZctylapCwSMtAxpzRtCPFJWNc4peSLAxsEACvEbSpO1c+Y0oQz2dLzLtU+C8UNjbrJm/EsSjBN5a7d8D4/YmIJ15/ph9TvYsII65m7N/OEflZeRtaXO52syJ+sdcX/ynPdd406/A0xvRa0TMby4Rgl73WNIIdtBF0TeCz6+TJOGph+XviIuVigQkjZvrx/wv7ymZOdQ/hOE2vSvvDn5ZqlzP16y5no56uoU/G40xkYhLFlWh4fDXDfzhl80diYTnCRZctVHuPCjguhRvrZq5sev8wPpzRV3uAjJoXgmfAhpWYcNcVdNmCHsY/x/BKzpOQAw/eJ55RUU1+UU0+uGYrtbKkhGPVTEEv40tgaeEGXyRcaBp61KT97YHB9P7Zm+ffSsH5UMdcxwFka4YBZGIX+DgGENnA/OX8IrFW0TxH7kV8bsOBV1Y6REr7U3PeXU+p+2EAADuNj1H83Sd9dcMLwDVofkZj1PMKiokmBmwTS6mQqR1fB81d3DX296i7CEIq/zU1mWhCAfP4WrXUIRqG50+kug5QGCl7LOl8ra8q4fhagftS74TlrPBZmnoPsabwpionruC5Xmr5WdwdNwv8qdSIeW71uPCt35Z5HYKU36nrAuZLf+JbM6ZHPKUJqTSabde8aIlrERERRo2Lq2LRYZO/699OuH8Z4jatjlvX8yOXtgacAMaoSzQNeqRu8Sh5vN6XfpdkBxIh0Xub6NYgFzjO/m3Zd7f8b/vqfjI3CrLV+xP3+i8+FOY2nZayhIbZu/+Qdw5zAwza2N8zYk/3e5LhHdZvE2cXE9nwfCNuzH4RGVL3WVQ0oJc8Jv0/IMrUIvSJ8Ur4Px5OKqEWuvxYxLa/g01yQoaSzluM68uM1YZX47ojTEK+YuYxlNtFA2p6vzWk8O2puBpfiL7XJbjz0dH43QSRcjOEoJYdX/XixYthI2KfVJB+cybcIyZPlubmZEb7VxXV0M+8UxKogCht1mczxlXN62bU4vS56IxBtutxPMMzjHYCv0vjj+NmNGMiviigN4++Y6Fc3XKP5HgQizizMmdE5wnuICV8xl+0ZxTBoHp7J/qGYKi2Ok7Wianv7QJrD3pL+B9t1PndPxZSmMiZKFvvIDZphY3ha3JZ9jqicZeIc6dDZUetXgsdetatx6Jl22w8iu+0vvmu3JTdDMd8HcGayl8Q+qL2WDxu9zVxlLHd2r20Zfq72yDasQZDdTZBWsB8xmw4DegayQZbNdX3aD7yW2ffiOZVehVGeawc8r+QjFEd5FlmdTfNOTKgtrf4tZzpITylGybssFttI1vMv8vnS3wPfDXVCVXcIibiZHE/W0DWbXPVGrhA9Sm/SNGrME6JKTSCPPGCX7GEXuT9XRFY6gy6I5gcXwkaJ/dUdVS2yNxt5TwMjVt0lcQ4h3gv21vABo5+7ufR5UtjXEdsO927M4t/cK8DYUPbhgqg3RGOYyc7Aj4P/d6K9vIDwoCZnSvhwUq/pW5E/dmnzGYvDtoT8iYmQNbA9HJ7ekljZncYt4ryL6mEqN3o6rMcLriNsv0cazmQH6Gl6Zzuk+2zoek/9ZVHdS79viDdtlj06Yzb5djnwU84l2i/k756tTGxpo7+Xz1gmdtmaAtMz6ltYX2RXaV3ARt9fXv8Fgg1hfOouXNhZwfPYuEajd4zbhKpgeug8T6kJZhK7vLOIcSgWqO3kXJ79dGBRkEQOPxY36LFVuQeyCVWcUacRBE1XQeBZNr8L96pEAt9sF7SgzRf2/nO8ElFdNGAiBzXCOy4v97LaTymN3Jw7IH/8CNu0v8hfyPcgAIf70bxYi0mtIr1PDwlSKWNe9H4ecPzsngcrdw0/KCWOho197g26DyOrC0GqpwSpYUq+SHyj8bC751hu2J3FCOeMMy11fhA78LmsCGtd9OG4EBP7jVh0lJfnU/udRUjFblcX9C4GPusm26zyH5xTIt8xQaDz74vlev3csYVajZC62zH/Ne1MvsH+R3V7ucetcaG+lpzrGbiS0B9Z3SqsmfTV2kKso9ZLlMsycKlWLsU3ZZ8VZyJ8WBHnjJ9HP1KJTuR7H0qY9sz9sIzZEkLGp4UWzYjy55xPRZ7qYRP18F3keyhmyCRLib+z+GpzjiN0HBY/e5QvRH7gsDAHgZjqgX5Lec+2/4fxq9ovxjinx2nktzDWj2PZFN/ZxD6ZhIFSi7FEiIruUyBf+qT2KzArlmfsb33GT8NcW3zfJojoYySOdK6+M4GCismZFIGuVa/JZ0a1okFQuXl7LVgsPAebimfj2k/tV17hvS1N1suxiMKfo78sTjKc6s+n5DNjWPtb9tuX/h/qBBG+Rvy6WGx7u++WUc9KPHOaf4aaEcX52AMJ7JsmrlV58yiGQs7vZWidTSzRCPddBauXobv8Rty0NnDqfK5EdY7lRZ4ujil+03v5mPis4GcKPvkhfD9l9/DvLtfnLghQHvmzm7R9z9hoGeO0HPYXOevJM3z0JH45k1BHsAczfq9ETKmewcjvo7eCn/vfFn8IYYiKP5YuBFweeoOjo4mu6GdddwDRvtvWbhjbp+yDqyJkau3SO/0lYlvkk7DgeaDWrponN9q/owL6hI47tWaBS5pn4Z4zfAvzLDlewXH9Q+PO2IJ/8Nw3MauHt9Yp9QxQ5DnHGfniv2n8lCCL6tFF7j1ftUBco/21cN4oDge2fir5n2+M6//83u1RHDNe2XNv1XUioqBEHJnEVEttgfdj4h0unhnnP+/p+6/3xFf5ogYLekQ4URbOiBPGpM2rIegQF8aQuLz4ybkzxIKjgEn9JxiHgHNoswhXUJxxze/RPU16t9dTzDx4QjjipM6Ef2LPrF5Gzll88cT4pJAEXbNP2q9T/vLhQpTrUdWZ/rE4QtetOI6Ys4CB7PXvCRjdYHNv8UPRX+0nMG54n1a63xjmR7hWpIUALdP2mjZ3P2NfHdhcxolWQc6Mz5uCEaFf+x1fIsS35buLf2Ne7u/a5+haebI7yGnSnKme2VnGWo6JZqTH3cjfcWwj3AB52L62mQfX9YdUW63qBjqO1rUDA5PPfndYIzIxZpL7d2a0htC3ndf1gBtzwIztG2l/o2rT51RdYu2e6b5pOPSsPFW4Bp+H4btk1lZSz6doDLLIdP/47P8bOX5F2La8KU41/K2QpCzV38pV0UvWTiPru7VebGLS6LoZOTsIx3fR24OzJsIgRTijBF6oKPV9YOJXky3ZCsEWVdH3WWRuIib+Ta/xc20jOrf+UbzVLg1flOaLSH4ixGlYY8ZDdDbhc/WtcK1m5x8M8r8r54559kbvvfyn1p5x5gQaD97rulW3R/HNt9dN7D7pts7oEUlZS4pjIOoF0DmrHOJZxm5ZtiHI7sb72qJ7XuuBvD22T+QjJfeungm5pT/z30w/OzpX2XfropaLvo2c5ldDHgb4cpWr1TwD38qjqjqc2QMVryHmj8v/PWJsxhwwMSWIXa/H1/aO7M3f8Nlv23/fyh//A3vsD2JIrhOCqNVduk83rLkz2T3k8cMYj+spNdSwNG7hONMYYJV//0793MR6cO48zJsvrYv3/b9z7f1b40Vaz1KPQy2OfLMc2xrUhGtVFnZX8X94/gr2A36rnDtptsYQ7kuv1Wb3owgGNuRwa/1onmzaU8Xzi4jG78f0PPSdYhyP+zewGlE/lozjNfzSys71hnfwKeid2lvpN7YwNnOyu8B+MoF0c9W1aO+cDWL1a/vY8XIstmr6bclxuT3/o/Ec5M9wzVtEFNYRnibw0+OIrgXBFfQq0ZnK76Hnns5d5J1ZNJn9DI7nMC+d7JiCSbTFBxsv/J/19dvi6b2ykz8dG/5W+PNlcd5f5/CMC6ewW7yW6z96Q/haRRAv6896r7XJKh1PxNirqOdj6AzwTkzkfbZO4xHj5/6Z+vUqnSw8ZW8Fr9hDvMdKiIFNnkONuTrruja/q+Q1472XTMx9DeOd9M9bH5EABHohlM8Ssxn3UmdP4Ypiwa1vcimmrydtT0zOKIvOFWf7mo7vYH5YFs5bC2bpcg4uMRzg8ONcZ0Ewgik4joh/FPUy4DM011TUt8Z8ahx7LnQPyHKXev8UrrCmEtJS90/n+NJCfGWKSSKs7gfjXvOws6o+Rp9T2LDU++seF8TcOOeZz2sd4CzD858ai02+pd7TrLlEwrogfN+t/YXvY0zAFSnPFOfUxDqYZTxDgotsB+6nkHvGPX7ImuV+kJXm/Jn11NhHeJg351z56eXfMG8X5ymNY/D6WEJPGY8J87wAi8PP6t55NWDE+Z2LT+E7cH5zMRlOPj3OT0i/spqXCx5KFs/qV7LuH/HY1qonwSaz2GhI/I3+SM09pu4hNov2HcZSxFtQ+5RaquwbcIDxnJ+cQoL3rZq7iGeFo6gUx+8ofh5jv9xuE2v74LVvKc4i4BqOZItEAOd5FP93dnwacTEbMdHP8FzP0z3cnBDtX8Ud3VovuCk2Dvv5L/3y7+VMImJ3xKbz536lkynQ9C86iw1+AIWly0OAIljJ76O+f+mHiPHrMQ+QBzGCazi6mKh8wlcy+AF0/xj5/MITaxL5r8nG0ThiXYd8cWU/7JGEP8p2QH/nKx7GUBCxu0hck9dRxKsafw56d4iSbNGDpr/j0FjD9jnnreIs8GlNWwsImr7UggN6TocSI51YOCwPfnnNyeyzsBP5ecBW4Hdn7vELKHbBvo2ueZ5wjzf5SoW2BftCv9O8yWvjexHn4fK2sTD8AbpHN4e8GZ4Z9ifzefO0hlZV7lWmc5bsT1uJCBVnLIxStVkwApyJ0zx8qdgzxsc44LiQeRz1OUL2aicx5kD4mVfBnc85J99O+NosKKfWDu3P7hoc8k+L0pT+neLfMA8e7PuR1jJwuxwne6ZfpHJw3ONDYz1NnC/fwGgqLmRw8nZinBYSP/FZzDFUXJCiTXuzxGu99WhdE6ePfIST4oYOx4mfOcQ8z3qScwz3LgtsG/+OidFH3LRpPoj0NLc+NK427B+rGp8/JbFdX/GSWowHQD8A1pPmNFYxlOaI3Zj2IonD08+AcUWODny6zF8Zw+a0lLhpFXUMk6tF964ZvBkpfNrJGhB/B3WWI8Wx9IzgBXH3PxMct4zjYl558oVbrg0OhNyE6xHg7WC+7C2dDeDHia07+L7Mm6zOexov5jAQv+1wuY70nid7wZhIWhdYQ5cxM3pSY7Y8ml/X5Bin9xmac22uoeWFD4Ee+pfhpKgw+hfn4rRW3Y9X3Xn9sU7rz4mNW8STNk/rUYx9dngu+Y00n5F8iunQWY7JHwB339CwCfQ6h1GvSLaT+8s34Fke5/d0FudsikM0L2cKBjvEzb5575s3LzDXmIXap9GrDl64gMbSXT4PQnz7t8YB79Zcq946WpesizHsSk+JEpX5m9e8tIv9HHQXaJ2n+6iX19Z+gbc2x1TVK2wnP99OIIC88G4aT3Nf076NxvNRzjrNBxG/Vmp8zrn7r/pTn04l4PvoWZcb6aVOqTHE/Vrtd/WYL2rUSsNCZ9YB6bMsTDvmHHvkczXU85ocUdHZmlWHNX22IkSlBauOOMC1t56lcyZd5bOx6Cyfx6M8xSsBeh+6G/Rd0Vmh/TjYXUtEVVtX6rft3UsYFyAOip41w16mzBG0bMCtnJP65sp4n0L4O9qfx+0FTiI1HxF8UDzU77qdN7fqlPpBu9SxgG+4exss3VK3XAoFksJxyuZaDHNl08Xb4mXY3bEGS4DaT/XD02KcgW34Y9wvTPE9rftzBTZ3IT1YrKmy//r5KZaUd/icLpVGzQBnAsd037gOX6OEnrgB7SeP/PgB43KCd803p8dU8Rgk+vbuQlE8xyI7P2rvxwM9397OmLdtJt8Vi4jF9Io+EIc3cC6vmF9FiXaLzocSmub4h86VA8YwmqMi+gEgkMg1EPItDuzbAFs96vJnL3vbbqlfcE2Zc+jC/3JgfpdI0CwSKkzJtZkc7TibuLeExtWaAE+MvAT4nymGVznNua9EOUcFrj/PtEZDRm05Y204H80V+K4Yo26HmjWy1t6by3bJrVRb/Zw/G1jV1lVc/fBuU1/dfZDPfhCfuPTUtzpvvQHjMQ7k64XvCL+dOfcLzl6fF6HGxGmZde807AhztnH9kNYD471VPjKsJ7s282ZLPw149jiXSbFoF5wZd/zdQncJTHo6H841e90mW+0Hr+W0HCxi7/Zzf2CV+svurLusOv1KVu8K+Y8r20I/MfkpU+dEcVqh/gmMUpP8FOjaTJXuUXPIfy5iel3n/fl1xELT/B7NtfQWqFwesAnQ2KJ3rp4Yl1Jg8cngtRbkGg+VbT2I770YBiCZb7bgT7t3jRQuZDxfJ2e3+4PqU7caqzf9E++8jt6ZRcd/ks2kdVY8T8GbUX47N3qc/w3n+7l//9F6GPwr3u3Zdbsd+n/WWdpuf5mOpaDzWfoBWaxyt27SXvUWNs3d3WeoQ3cS2zXmP51QBPW17P2lc4Y0P7s6hOSHAb1T/XALfu7v3DuaF4/XBtc1or2GXgbm1EjrzYAeD9knFqqFQCv048hmaUFt1Zuh+iSULRuv29yjxXtX+kOK6TXZUAvv0zt8PQYsfpx3yVa42wnqBg/3OyenNHV6JZVn4ljnxNzL9EyvI+C04eeJH89nEH0f2DJakwHZn8+xEtwGHxWdT8vpSewR56NWtskTfGFHDD29D5f/bp9QD+wiHzxkLGGxIeKc29eHHPR2WDetOQJHSWfvnI7Ll1Hdpv1CvusdevnJ5rOAPO39eso+sym28plXGlo+Otf+tKqv6+Cr1L0UNMfSP3P0pmvGEG3HefcMbaqZe/Qkn+QyVxmda6pPZQuBdtQqEGMvgStxoIeH/Mo7+M46h9mlfwHxz7jAem3yOYWY8eJIdt8QiTee/Ws/JaofkV2Hf8U99tG1aQ+cvN+0L4Al6A2WQaXbg0B2eq9MaKNG5OMOg3fRGKRYBDlBaGDQ70wReJMLbryIeJdG1eMHzjvF+XagGHrN/T7v94mxuj/MUnwOzgU/WFd7Op+klh0J1J8tvR7SrwcMQUo/VuN/fLxDbF4av5HUqL58LhUfi95l1nxtmysIjVJMccroB41j/3idwj69gKf7sU0+Q7AH3ujFsiF4vlR/Z78C+SdwCdI15sJTneqThRqbZKduqItC9N0H3xD6xeC7Hv63sC+PCs/2YHVor2yi+T+YPIw/9d+1b6LPgEatznE6cP4T9k3U9cpF2kO0P8pvh+l5fGil1EN4zM+X9+Wfgwc6D+zc7sOYq9z0NA+5N78bm/et9g31ddEiVULezFUmz5OCa8SZvgJf9OU7vGC8+Pc78i32sLPAnv5u6PEuH/nfSaHpv+mzsii2W3EfoNUwguh5QsT7Si4i3CNj4CpYQF29X3n5jz6jFkYfWd3SYOlXFfay1htA5Pna3GSdO+GaSdrxu79ju5Uert47ZHPaG+QyG+ACPXuFFFv2x/3y5PWgN57mze4NXfJPc0WydeSv5rpfjMnletV7NaP/9gLzDN7jl6qNXA/NvXUOe+SHrKl8DrGveeTi5pjn4PUxo/dK+/jM9c4axrv/s+0jn0N2Yi3Q+lFjsYDNY5zPguJv2i9F+N3w/U/t8ubYeqjnngp8jQ/F96PxEhtvVS2QbTjAdsTW1vv9oZHmd60TeHbJzctelefcNqNx/9B1FIUR+nipuXdhzv4f3tNkY6qDnNsjX4HsTtsZVOa0frvVYZVirNycYmif8ZVX7A9yWrmwzzJ8djrjF3MeI+jIKR2/9D5NxgtxP/psSjHflNbVy2ir6y0Hk5MJesLg8AcWUuNx0mMW9ilo3L3NmHzkJvs4XenBT+WW1Lzsu3UPtmbVJp/7sAZvIflZa9ary0XXoH9zrV5yLmQba9UF+F75c+hD6BWXrPMyqqsaFfhweKy4J5U1KqVXQWK2E+pDIW/pXuMjkGuCdtVrz7dn17lp14xfrKjrouaLumsu5DLpJ+rBT/TvAu273+rf4bONjDzw03pvz0a4jsU9X1L/tuwk3vZ5RHEqsAo90WsUjdDKifYJ+c2e7UGHibWIwVUjHDmtfv3WPvksvtUN7t3oHa9/ZuUWEvx8OH+mTk6Ple8PT349mk/ff+4xjgjra+uXLZ7rOHYU3Ny7aH2g5mmuDytnm/MZrVuaW44FvC/yhJGfjxwb51xcrBXEfTpnMKf36Gyb1z+D8c/wtRFzdD997qerWqzTbaHWT7ZOa71UkZNwl/AdJyrP4EHnU7jft1LbvZF3qb+Xfr6+9bOxiPReLzSGoQ2bwGQ9vS8PHP8aeuKtfuVwm5aw0sJMwbUxlxDek84jk1fpaWXWScN6d7rGspXbxjkj6H3J7vO7ct2d+RBSOLJpz5wtshfs5xSeHpaI9c+MeVijLmnTve5EOzapsYy9rbW3Axt75pPsXIhzcXL2qE/xX7o2Z4i1AU6btTC9POMpcH/FAwqsOeu4nnk9g9dqZbM+omOVHkaCbedazCg3fx5Y3ZmbC566FXs0qtH5nN+eoUU8eaSz/rG1kTFIjNOVHNoL17rU+jzNp7AfrFsrGh0751w5IY/GubpyMI3pQWP9iB70JZ+MrilyTVuu28Q80HeGhd1fjTXsGPmeqmbJOf9yzDav6UVjn9WaBDSWtH/t95dhqNuw7g/cdgfzULD8ZnXvf9n79bdxxqi9dtFDS+sX2ne6Jgmd9w20t7WGtubM+odrpCnPUN0De+SnPoP4TI00vyDUJAr5mlQ/luZktLR9IL8BHF2Wzbn1iCsqtGlh3oV+rrW2Z17BBVdlVl8g23zU/Y2+pzTO0zSeBzuz7+If4HhI9md8q48oOicUxzXPS7njtqv9Cu3fDH7WFH5Ie5i/U3Xku93o9F1uyLBOegs/7E7d82/x1Jp9LuQzXOOTvYmf629y1t50j+YXPE0XmB32X45/xF2b5KQN65Jkxxr9bcI+MYZjQ7HJblI+am6rtHyeXMOKcbzFexQLFOPhvGf8ip37kitIr+cHK7PPMsYvYTyDqVd2IwdNGr73n+K3Ca8d6gwXhH9N9rn71EOPq1z7H71fvL/7st/vyzyvYVOu8Yin5TG0/R3n51vyw5k3JqwJIx9Ssz+mj4Hq6Y5qzRR/z+gc+eDP0Zl9xXZn2ZpO34IGGsULQag31+8P7CbZG+SyHgfLavvLevu6zXpzfplrMPS86AUvrqanOcV8Fp1Vd7v2Q+dcX/zd+2CMKVZZt9Xe7FreqWLjzPzb114WPwfs14P3p7NADDGoumU6Ax5GVrvdz+2rzK+U83udQbxOLfFssJv05lefoVn2fukzvDkSzb1nxhu7NNctxkOlrI8dYgGPNdBY4+4TnFeMI5F6BzgmEKsH3LeNHin4AwobpesEL7VgCX7NEfAwYR8gYkOyAaN0TBTyOs/D+trTOJtR6wf5smTPqoeX/tabLlT9AL3a/c3bJD9/9xZk20/cs8W6BE+L7s+Qh7xSfXxaWLQvgo+Ze/wQ20jnbyAx/1Ogfkb/N3v3tK6Leb6f/GxfL9c/WeOu5nJPZTNfPXjlItnx8UJ/Dt+hOaSYjTlrf0TfL7U6A6faf6B1sKZYHrmncmnq5dtzih9Oo17pp8KO2nV6Dudwk19O8wR9Mvaj6H6TGc+JyonRfMeeFzyDw1P8Z80TP/86+Vnj3ZL6A3yuQUMrC4c6Xvhx3j/wn/XxpzHWi3u6l3VoAic7Ak9D1BM6G+VSNMrQU/iGenOevruisTp5FuarFL033aNZ6O69sn2J96D5vr6O7n8909w01pO5t25znfeyTvHVWrxf8Jqxjp5PcVD7nfOri2vvitgs9V1Pjjd6HBxaD+PidNWmddEN6u/X3y8tthwvvADrvl6uBvVeKTceej8oZp/TPiZ7Adxkbgf71XrYptW7s6753+a+oXf4US/bueno/jOqYel+2uBPx3IuecYO7ylVd/4X3Ce+fpzHPXKt5M8XS/2q1FJSxuE7nDboW7WxX/4x7mXyXVnHBbVVY0/RdcC9s3NOtpEDzsK5hvhU4Km1Pt7n9HGCfJIZq2F8yZ4F74wn03zfZNt9YLGHYX/xwmcs+Ff1DPtM8X1cB5zr9ZPdtODZg0p10CsXGcsL/3h4dvzmyfuYICans6tpcJF78p5LjQFsDsGzaDEWtzkK/dCP16G1i+cKwT29tI37fqi+GtZdJ3+V5q+0AweBIzZGzhhZP+vmQ2U7PFd9cI1BZ5T8GF5Lmq8b5whi6QYw8bE8FHOYnJ+HfH91jy5z96L+/lQQf/9ZuE6MGMMzfW1rSnZgBo0O7rtsk00p5Z7dvX+JJ2Z+J+aCYk6QUXsq/Lt0LmVwKwh3iGhBwfdX10jy9q7j3/W2TyvoWVd/p2hEvJOtOpBvNvceaa+tOhul83Ykm+MLN7A8p9YtTPq744Kz9SiGx1w4p+JfU9FhVdeNn03gDXge1Rf033u9l4qla0RrkXNiqKvtgNEqryo2/qT9eZoUJtNWf+uX15KDARZ1upij/gx7sQVPDPntlX6uTT6WM+tX7EfJk1Z0LQyY5R/A34U4xFoiB9db/pZ3WjYYP4z10keeOux5C/GMNIeyRtHjtwLfs/F5pWfytObetAa4cqALPzxvTvh9yAuNfCL6ueldyMdc8xqgvTh5t+bDU+44Qj44T2OTxzuiz8Dos1kIxjn2s/eN5O1wjQWND9m+etmfe7Xl+ik/2VM8OB/mK5HOyym3n0g9CXma3y031+D5L5v6e6J7MllZOXof+PE5VafQen6xOeBaJ61HitmRe7Gfe/FrKc2/5LwNOq7z2HUpxsrNS8LLUAJvDp6lB363rrJz3sl4Hth8oyaqeehpn342C8BVu4HSEv/qGSUPUQA32yDChef9zbhQp/H69cn95LUqxm7fHB7n4wXj1GmfsL3aO6fYXNEeKOn6Qpy7orpnvZKX0dtvJ1fS+fQfzmm3nnANsOtz3qIma4r2Vx9aro7kj1ZTWsO6btNabP5qnVtiJ4Ap1L7uosh2HzrxyE2xdvOae3igrS7r4qFyap07Vnsh96L3/SF7DfgjujY9A89VX9Y82WFw6h7p7MJeTuHSZ14bPvegVcZxCfygQRe95u9cP+i9QV+RtU0Y3/B+afM0LurZjeOkGv09ct7gA7FD7NTJ1zVEWt/IqQJHXNT6r3J2gH8uP9gavzfwO57VTsFHiK12aG+rvo8T8v7R+Ypcv+Tb2qg7SO4/HN9MPyHE8UfP/yb9/Y9kk3re74bck3wN8KiBa4L1W36izvE81JiQXxu2R6fcuiH+xRv8f6cgfDPOKZOnDLGD/Xra/BVfK4e1nPHeD8HG6PuQLUReKw/8Avk0qwB58qljlUpu5Y1zPN3cnGI4imkHXIOhNT3nuLM5RH5iuf6qFzfUX7fa9Q73/6Em2gGe5bHnduvuwIE286Bv1WPXx3h3c8GgR/H4KGe7brUEDUP1/ApLn8ozEavxxM8Ksu2CibLREya24byl8e3aX/AW2vAto3xLEfiLDeI6f9Q+NbHuFjb6fTZ4bsaM67OymtthHp7Rc7I4hnF72A/wIP1vzceo5yZtvUac/rR+HrbZtdKwb6WoeHgRb1DM8nC/Y384oxdf7MDmSh3xi7x6yv3S+k9uvz7nqoSXU50Lz8PbbTXycZ3H9mbcr1ttOjMbZEek7n7UezTpf26vraWUXqoYl0fIq/JgrV9qbXU+4ayZg3vgY9qzduNhnfuAOE9GvnRzaJzry7RzorMLbceae95mPvmmSkcke90/wjc5nsk/VefS8ZO+e248wjaz1s+d5MVhY4qMnR0VBBfV6KEn50j+l/jDNC7C/7WGrlJxN81XlxTz3DUSftDo6vNk5GJZW6y1o1Ah5Db9znmMOX5aQ6fdmo+HVf4f/uAtmslZ/6OfG9yq2MdGbuui9tzkOj351DS2/sky+k/vfgD/01TPMx5W1iPRfUrre4xiSuT/KXaaPnY3r9AZCLg2Bb52cCOqM9AJ8T7gsZiuGB/APBKjPNnNx5LKHQs/7hVuOXuadwSDE9jguy2MrF/IbdUveLw0LnrtflCMpHqR7/8a9w5/NVa7H4j143Eery+uq/mjlubEjd6Fz1njXdk/nqNvimLNZWovi9YKmjLPNOxA2BPNXHBka8/PI5UbRu7r5PelrseYnp4/LGINrQ3uiTqt+R35HowxGECH5RH6GtuzV7Ds2dd9iWeDy3VOceVGzrVxDvkG9e7wOTdyn3kxXashjAvssB+5Ci7iJXMfDEQ3XJ6Re8x4/BRPh2tfxREIl8cm4u2rLsk309ik7Ze58YUNHbAcxw49iyLe+o7WR4fO61Zv0CYf3oI2kuBzLafUv6rHF/b80flwQC811ur5afHrk3xqXS/47Zx+rf92Th9+P8W8E+ZbtIIbrpeWfwf3hyW9fKomo+vwYT+vNZPcLXqNWZeD9xM4HxWf6Qm2Gzy9kyF6A9X6VDh9wZGk19zH9OzYvyqmbhj9dqrmcoS/vvMfg8MEf46cHT3bAmeEN3LBKxH9bCU9ZOV1+30C3xrnUtT3ehl7r8APJfno5553fOoPPlr9Jf1fx/8H54B4Graow/1NdK6A55fs4K9oDZe382Z589fLeTttPNR3rd4h3yx76ya0h871Q+t0d2i+V47051HFbucxdKxG5EedEYt3wY2l40hg0AQ3Sv4eakqNHg3BCjn49rlejepDsHOe2svP/QHdJ+Xaeh7C69+fWDesBhsEXYOWrcb1Y5APuJ7RN+KARo35c7l/C3VWOjeLXm0Qvjv5sMi5GHw7wnWX+p7y3SgWlTP48+Wxu58y3qC08h6s3Cv4gxAjYh3U3CcjjuWaw/MI13HPzaC95RzzQOrlOD8nvfmM8Tjn69fRZybm1ENP40r6cqP3elu33u/Pzfd7WgcV+rOyVjrn4bpCDMrfXaTN3SHXfmhtWatyUUJec+edcwf6O++7kYVaCuspzMJzi9Yz+qOnSl/b/CxjXOjMEr/s8Bf6KjyKy5jjms4j0en25fthD8w21KYwbZDiS8AZATzedlL+lf5uK/LZjflSPiFsWkNjbWFnW1oPvXYnZ6+2U6IR/fu5X2kozEFi3SNH1S3SORRpaCw81r+DD+bl0atYPZFvhLNF+pPywQ+ccxGHap37N6d833D8Fs75uPFr1u55Ndm+PuLag19NGoPp8PCfem2KzUZtjHzHfu6o35OfQe+3CuxZUeJ6eWdww32oOduJBjly8MewF1bsG9+Dc9ysdS481LSvuptpHn5nxXZyPkV7Hse60XWKzGlD83Gu1+gcUXyBtDY4j1+vCi4x4pu1XBex7qD4qHT7qgNLYQNEEw3XMJ5DtHlhLxEDTx7bnOtooDZXO9IeBrYqt/ffPeA/TowD65WGjNtU/bnk34zoPHnqWnat586hZdTpUGwrZ37avgdHrGD+MdfqmjQnR8a+T+RdPnrV7mBQUfd4DG37x2TNtQOsu13rfH/XZN4DlYMhHxqYZ+YJ4jO5dHp2IxsJrjlP1qxtjPFK9ARorTzsw7XnvW15v43X7lbyBXP4wMsp52o2kkesIb7p7oDx9sJaencWXVt655oV5mmV51V/l2c8QHuYYhzmq1ValsWQW7d58rYXcy9rO2P+q73OMhjQ2Y5elF53oHpTxJ6G79ZHbpn2D7jyUs7PD/XOs6n63PPQsV6G0tcYnZlje3jyfomP0NmHPA/9u3WzFp2jo86W7JX73qhxLZ97OSNOiMP6uUZ7EvXfkeZAsEKOjBhWAPNJHsElnjOyU1pLWOeWaG0shZPSZz+Eecu0vwuMJ846xrw6iIs57zKh8wHcaPQd08bsYus2lQclxCSBMxHvwHzHjEtfXOuz9/Y9XP9kvTunY+j/NI33uo7NuMoplh7PF7pL7tMfxbk9BpWg02UfHr5APZn36fTcUvWrXE2WjoFpv42/36pj/hXnxyHtzNLrQNvyVu8YfV9zT3T+8P5qDJt05nRy1ad+rujQny2aF+1v0/zYg2e3VBpYXN9PO8fUmRv6DAvn9If6CKzxx/O2w5mV4dvvkZMC9z96z6TOLXy75JuDozDeX0Nzz3iaqq1t26cHDBYwekb/8v8V/basvTdI9pOlzNWcuY+aJz/qoR7BfhX3L9BiWMyZi+G5j17E+0Ojv9sIZ90v4AaAy0cNaNtcWb9hbxo17ne0W7VfBXBSXLmf1GcKwIoF7EOHPb8qv+UUDLwFY49KHG9rzJBwBA9+gJNB/CRXOCdue8dPHt8/vHcMcwG9K9QjHvmaB87PB8ePNP78hszLJ65/8Z1FynPkJs6w2nUHy4EdYjoYb7H8+eW1vu71E8z40F7wvikXZ6wlbZFfTza8l8Evi3EDR0S81+w4H6/IbklvFnAzH1H9T+PiBh/hHuUehdC/vVKbuOVaRe4LY80dXrPej7Cm8/euG2nhCG5s/bTmPsHMNdxAzuy059qF3ieRhinFfax1WSySL79ujFLzVyrfpHq9CqxNh7WX0kd5mVORmssX60Llw4Tzqnu+mSPsMfbusb0U2QKbYmrBBgJPF+UDgXtsZeRWIy44E0sjve3uh2gpcQ1zJ7y5jKdBzhl+62zM+PK9yren2nTjugcbfpmJecK4+nl3oc92aNf56IVi/V+OrX/Uy1XWTCK/9gP+tzqrduOhE1CcaP7+p55T5nR92LyB207zgApnRfXEPx8Wd+w7ca9HiXw+pX1aC+t7zB8T+Rwlxty7rtN6WpQ2/mP3gJiYc+vvrUProfIZ6YUgr2sfpEeNue2AUf+c0H1b59JZfUbnPIX38xyNGZ+/D7H87r5eabe7sf2Ue2sKB+BfNO/MGcQ8a53EZ4aD+HUe7vbxtVxaka//DtwMxxcPm8/muXJqc+4JOYzNGb0/snds9cxvnyqfu24+7pXO5+FHZ+hAe66v/i29I0Pb8stvFvcPjS744z7A1zNdvDHenM7lD9o72+c+c58AP4A+2M+Xs51DPvppNaGzvk3Oih+Of6tfL/Bzlu+OMg/3F/Hod5+xue7Se96B62Gue2ka/dx/TshHVD0hH9P87qK2FH3P5s+/5oNVo1z9fDkFkY8fYgoC++L7K+TC8H5vGIOU7xh2SPqEoL25e1rcn1uPLWP9qHei9dY2/Ci2EauAca+tsBZRkj1RtQ/gt57mOz/qDx3Lu/z9VvRMaUxw3VGrIXu3mhsjP1LwIwwD502Fq8nw2fecZ2Gfq7OPfe/tcn/WV8XP+tsFvkLwimSDaG1AR4RzEeLXJzSOLzkKbvAnj8BRiZbHw1uCzyRTqy7ei9+bg4drN83X355oPY0e7teNQmpvPvoOz62+s2r15wGd3++T1fjQ7neKT31/2VoNzk8P9bvWeZlrn+sU11aO7ffqqg2e1gSvsanFEfaPu6EmCNaRcGkoHRHjnbhujLj+eVhkn0cwdqq2CVyQW3JGltvrQ+c+whZiHR1Q80xi+WJzozCIgu9rkX+OHM997JqqvorvX+vXEu5b5nCOrj+itTMORJNS9+s2HnfQH6x0XbvaD8bcD2viMBG3h/cnP4j7UZDPecxd7/FRdSLwuZrnJM4u1tAONc/vNuiXB6fHKOc+ueiv5VpI1xKe9DvkC8KzBLgSI6/z6TPfhJHXYbsL7YflTbosdB6glxh5rlnkJ7tnmfvDumlyJsH3Rp9pbD2hTlpFL/biKz8ca206JH/gAZhPS2Oj430Li/tP0Qmty5lRtnMvteBs9B5sNYY8/bPVnPHZO2C/EVPSn8Xx0Nql9koswv6I9U2cAdmYZeXnDC5xy73jNPGzT/HxkvznWf1V1UKzhtq0/YEayLRscp4ur9fa8kWLNQo1N22BNV9noSY3965x3A1NENFuYGw/xew1F3lpcJW+vwzd8xccftvp6fjpnY7A/vKY3DCeId8cOHlg5xJ29BsYubnGBwI/8a4w1PQs9T+IyTXOLsnjtPxJ70Y+WJCHbqb6Pvx30e3pFXOTwmbN+OehHxjYM84PUgwc/u7mODzMS9A+RWxDPg7XBujf6HPzV7TeChRH0X3Ve+Gds7B0Zi8nzi62w9AC0fhr8g/D/uJmnp69xpyTH+PCkuIt8uFq9XWUmw17sJRuEce7u4bBGfzas1Vs5n0I3sXbQWdLehECPytPp/0W1ECNdx/Q+DsUb31KPy7wifyZD86n9q0dfCrFowNMy2dz7W4nDzn0pB/1Z8Ft+AyOh4fKT+mvK0a5k/dx/hrWBc9CtnQ5kRzRRr5PZ9KpWGaeqVzwrM7O7d/L5dKeRZ76lNtPV7/2wqNgCU/G5c/hj+1fFNc0NJC+i9dxTtbd62oMjB1iR7Jv7Q00soDpaw5a+ufwudbQiYE98iSXM9N4KsW/Dv4L8nN2WNOH9tn7Mh5O9pE2dY1SbBzZhFvyq1pngXvkL7nLHtW+O/kKh989Nwthb8Wnaetee8XDa7IP+4tcKetKlI8/Ha2bdd4uOG8Sr0FoDSfh30xwjtFZb0V8ZD5zc4acp0OfOU9nN/NYv22Uzfk0NDOKTa1lfCqqGvqSeyKYQ2CNfhhwgh4OGXneSJfVDfttNZ8S8rxnOkdUzI7zUeH3qjZrNbJ+Zj7Sw4UPjLNpcrqZ5wV518BjP35ghxoVeeRRXO4/CfvC84orA/w54nNpfZA4rq4WPS9yZVrPjOdhHfKzmO+tdX5pnLjH2cTp/0h/JuDp/KsaLSEn/jrCZjInEuZu5Z6wLicu+jJ0PzR6FZCb+yNsH84l9NCt4/wyqk6d7MFh7gy2UeAqPDMOpeDz31N5kqUm/4FcFvYUzqpJoZXCl8h9CgobyDh9vqaBUUDd4oq2abwPZVjQHFvRnIY9I9F8JfsiLsc4Z3BdnfyWyh0BM9bI4P9ZN1dcw2cMC2MYRw76nniu2J5pDPx5+zmW/sRgIvq7eZp39vVH6TxcN1xf+x9YDxEGI+w1Q46yl4K3NLC0TfKpp8Nf69nIske95YfcC5zjMX8MZ9bn5N0C9+K78CgndK2VT6Bwm5tp3hGOtWFnNxlR7Ar8Vt+CH3YLV4ncb3GMtIay75Xs782Ie2SNQ+tkeMqdnoLcLsKnHg374vo3aq/G9lMz2Rsle2F7NQ6/Mn7IcU/z453SsE3hHaK1u1aYUIUBgI4YvVOEmc4jNnJPHB8O4phowS52wSFk2lZgTlYT9B6Cx7uXraFCNvOvhrHfmqbvF9rc7pnxN8PJeda5vd8Un4cGIL0f8KipHJpp3O6ZOoHICQzbtA4CcBFnn2WLucJMHBljgBo+PQfZv9j64nNxOgzO6AMb5982gpcChndf0Nipf5vNW/ixeVW8iDvHgoaiXTHmYRqf25t5zlCLeVC+PONn49yE5P+cJDYx8/LMUcM9e8XYORnZBeYhiuzjN7HmN9xX+VzQiJNcsHfe0J5AXDW3xgvuHU87OyN7ubBori3yoyx75ua2WXnEP9ciiPEkCR7YbdfB4RPy9gyCfn9QHXRyb1naBBTzS6/z6Io/1DD8HeBpyGcG/s421nEqlyZyLKKzHMzAoyn9j8gXqNpVpCsMbSHmBfICm/zi+WemLvOwSPN//ATW8xXntPh5vLY0D5b4TpwXC3X4cLYZffNn4bMsBtOyb9NYon6HXH2O7E8O3CDMW5ffFvyyFfENYO+D15HmwinkGn/Yn3R4ZazdHeN+moO6jpMYq4bYCXHFtGYXsa61do3q+1hSnHTwTnP0V5IdovM9fu7evg8e0QuEHH4irgxKzqBCtlzFTBm4HENfY/AN/rALrMzxlvNyvPDT5+B0vMDANAoXGJRbni/RnxO7BvBF2yTnUq9it5iLLGXdQx96kvexlvmcmiC2Rz45z9yVM8G5+uAaOnONU/gFFT+y6OwKz9whgxvGLkjcgbgP3IPgCGyztim0Kqdkp6aSF072Pa15rUO/4X18bj+0rKeH+8Ks9wVvoOWTjamn1vGhCTJh/U7hUKEzRnSsFpzL3dM77V57VpgfonjB8sCTte4gt7uVmLYNvG4qz+MF9yHrmQ4yniU407wFnG8vx/1axoOsEvZ7Rfus0LrJjjfVtb3Tr1z7vVVI7P/3psqnjwXfAQ0FaANumNOx7B1b761EXYX7c8ArBs4y7i3VeTXFbUk2hp93idwU690BTxgfD2AShQ+1LL/Xawo1F+6dLdD6G9XRZ7lxRLOatabTOBAU/pr7Vvm5axTPDI/Lp5Uzn8R0PK/j6yargPYxem/5z3/MDzP933CPhX6X5nFMzW1b0xXzk7LtwLmGtaY5KxTmADofzMsEX0dxf3AOAucY7SPhhk7HIKwUVhq9Ou8T1rOW+Ww87m2Fs03jTUnLV4Rxi34+8Pcmrp2lEVIDB4Rge95uzqHF+CG1Rqnihsy0ezdeW2FEAua1RY+hqSGt+dvchPaUxC22qcsd5UhsYB524IocIi+XpzlFbx/3PHD+YKt6ovdT9ISST0H/Vt8p5ls9r3Er1376+tzG93pe82mG2t2ayzSN4zjkb6GzYD8mfwraTPBXJujDsFAbc1BbFW2y0Rw1GWOdsp4hf/+LusppEscphvcFBtStvH2wTi3zYu5Oo96vdWQbbcZbcT8lbGPMplupNl3ho8xx5V7e51F032TfbKyWjljwbPF3DF6Zv+DvG3wyx9EtdS9oFtD5zZoGK2jN0c8W/it9ZzPMV/avge03KMZyyHbyfeFD9IrtVM3Xy1qI8KmvweMG7DW0p4H/D3kJtmTv+IxVnDmM3YaOOfSmm+XLWrFeo6NoXdtf9dYJLzNwSXefWfMWYt9UHtnLvwkX0OkofdZf3iPGh4V5fzP7rG++DrTAyKdqrsI9qPq+u6hhGDk0e0GxJ/nCjI285rNxzze4CnoD+2lg2Q505oBD7wd2r+tW3a7bhi4I+iKfbnnOMC9jMe7g3a8wd3pzMgoeGDslekof05O3k/V7S48l+UOsHW8hX0C+Gvn+iC96Mpbax0/zh1LuAc7i8/OIx+aCOyk2Vmv3g/bSdHTpa2ybBo6Cxhx84SfRwnWwZrYZfKx8H2DYzeehuOZH/fGwztRigA/TTzzHBe9HdeWz7hrz6NAztKcvvd3xKcj9uLYXmf9nOKF5rb/Bd1Y9KfMJ8EOLomB8ov6hRM1q+ePLfV7L4HNKvl8v4nWS53Gmrf79jxHjUPTzaG4gb52J78ecnaJrxbiehK/rOnZE1+UXc6ll8vWWu3YqdyGem3NI4HlN4+D9Q64N5FKPEs8/WAuKR4tmzuNK7e9fVeu7rhXKvFLM8Su94zXEXGEvfwBuSg94BvJVxuD/jLR4r3O8iS6lOe5aN8BWWpU4P9GvTPFGa3M75/l17ZR/XnNTNCGdfOhTcMz/xOMw+PCgAT6637ROy/WX+UDW8K7YoqW02Zi6No1YLuH+o3U1Hw89ydYmdRx7lh7nXStdXxd7GjH4gWz6ntYIclMn71y32oEt+M2RrE/h+nXvxqw/orn86RzLy1mdwfMb9pZwbr4/ziXyVpyjMTgT8nSucj6Zzr0PxGtevrqSc7AbYnX8xVIwV5Lf+fBCbJxnJ7gM/oAbqpOyPvYB2W2FYaHY7UQxFuImnBXDA/mN7j7GM6ExnF9hE/Jci6J5PMAPWtPfD+SfFMV2VHcT8BEiL4a413L6HelD489MC6VcunZEar75ROM4w/cmefeD9vyW4o4frff73FOZr4k9rHNuvycjioV7R4WRVhxA37JVrNsUf/+VaFCH3ELlq2NBz1vh/QZ9DfO58DOyT/K8+PsQvuPR8k4JDJjMwcfzkDnQgNGJrxnkI2ivNgzc5TONb6sXTFtubtfqj7ep62DUQo6VniXgGgD+/iJ1AxUrs0/72+f8j98b5PAevuVJ3vyMnD90FqY1T36Pvba4FWfio+4Z7oPpopibWrbSZXtDzYJsk4N665Zzpsj35qrdzqC+nrnWJY+Uimt5jJT+weU7y173RAflLDpIRn96zf5N5yvqQTnBzBTXWLM098AxnKSWgGtzfukLTi5/7stYog/2B/eEFciWP2xTY6yn906+dabnOe2BJxSMRBhzXo9dUCsBZpeelezTMlXDJa2uKzgF9M0E3MM2Em0Y5FkOrfP9ifZUof0Fbih+b8WZPqqn68ggnuKcHLR8WANHa/xwztI512kMOud2/+3w5X3Rd0LXYD2Zi/wezjX5ffhORj6Ue29Fo2AmuDesA5VbRPwnOZiv5pfmjvHBXJNsMrcOxTzCsYKxRe3NxIsoTUrRLfuqpuWYuQSN60jhuYre/W5PNmE/Pf3623yyHakff4I7aPLY+tRxy+3PK/WZMKej9T5Fj47zTPBhZW4ibabwZ+AaLdAZE9hzX8471g1q9b5cixa09VBj0vyUU/DBca5Yx9GirzWRnu0t56OV3tN05azoPsUWNH/IP/DKSvcpJTcq9YA27VPyx2vVIr33fFLO5CtkfxncdOIvAzNsYnfnZI/ojIQ9orMRmna6Zxzv3Qv8Af79otayzik4hRzZxt26ufB+hzWiBMYdmn+vQ9Q9Otvs/uOArwm+vGQ9SGlkh+dkUmec+/bX7bNwinXXwFLhLNPafHz+j3icEmfyd2rMmfmazHgk813DmjnHXb+dE/Sjwnkx/MQ0X6D7SX7Hx7O8j9KZsr7uwVP6JeNTEX3M2wnZyYif2Z+hrxl5azpnN+oM0tgOpTl15DP6echndhoGkWM/lY/fhfz11d0Gul0TnpvqiXyTHPuKPaklsB2CLVywzhX/bMz9zFxHwt6bgwcJ+pXf6PvfOGKvhMfAsCMT6IA9oidS1TqMMdDPMtbP8q37XdhKvG/Oh21Ejsz4vcYiU5w4E94GD/US1E9uXo/6+7ROcszhgPE96xqM6BGp3kPOCQrnR8h58Sf3ArZrltBf4DOG19mQ81lhjQh99dfqQMoX0hpj9qQWvJOvIRpytL6eQv2x7lTWVNd/HjrzScac/FvrRFE9jnV7yIeI8qKWHdX51V5uRO9J91e1jwfgvO93iCHIF+S9lbKnDqxPdLYUXiDyrZtpfeq0V6bgfWLMaIn5xIEna5y8D/LpQj833v9z2KAWp+0I9hzzHjA2IVq/pp33JPc1bQW572m7XceaPPcGXfB9ON1cseRW3d4XOtA32DFolCD327lqy1J89HBdkk0+vPaQz3EP8vfQH/4pfpDPeEmNz6V9Ap/zt9LvgX4u+Ro7u/WPajDbTrfSnnVyx1JvYM06S+gQ0v+nvzteYvfD9ypLnamp4jReq+m1z0+6zrupR0N+xUyuB91mnfsKPvj3gsvm+hNrrK7RMwlcNt0nnSfvD2poqVikL8dA8RS9mdpadbVXL+PVzRu0YeM1d32O39v1WpSHkRrsBnxmKofTnY24Di95HODds/Izyf2qMZcNXpe636p40jG4c86l4QDQ94y+IFUz3tE5e1zjHaA9OuU4+177e29Objty6UyhGEPF4/frV+CYvjoTzetGfuQb89+RL0vXa7hWh++lfEn63Zv8e7W35HlMTAXwq6IrHHG2+fa/XFfya9sezo9e343e/e96GbaW/gzXwfznrLd8a5zu181ltXR7jim97yjUVSzfy94sl8SWAavD+5PGuLr30Y9BH8N5evZOpWepD7qtCWuI1Dc+uAUYS9T5YFxrpY3YK7QfClsPLVLFbyccgc4ZWjZVcNPSnuW6/XEKjB35dS/DKmp/kucqtK1pP7durSiWPt/fTVaV4tNwQHtqcNfuu+/tfL04WQ3yT2Q32rVBrt2/z4/7rWM7P1mR3UWcfG7VBuen/sCavLsB+RHWhGJn+u0SvmRjseWYc5IfXGjlKbzqz5iWQmBrHWvR/iv70XNSnKhijLM/RC8D6roBdFuWBo8sa8ixXRc9PcXNij43iuVGJdiDI3oQtP2cxesDe+QhJivXwHdE3H+vJw825jgy8IQeOCwwT7Vgzlijs7Nsnb3DU20yf+oHQbtG4/IwsMZnf/E0nATt92A5PneD9sPg0F5Vzq2+v6L7LZHPaJ1LQeu8tNrDMdmhZbGNMR7SaNY661lqHSPMTZsxon5uc3+o2jM0SZkz/9So7pUfxhrZyH2qPWkhb7CK67rHzhHoir1LHr1rcW0d+ZFh9QQfJMQjrIDTcU8vw0kxrGm79k6v7WFBYbZZg3u5U7UOpY0ezrPtmLzOlp1vWdE6js/DYd1wc/o6xjxGMZ6JzcPZp5959P93911NbitJl//lvs7ONwDZlMSN2Ac6kEDTNCzNW5PopgPNiGTTROx/3zxZVXBEG92r++3sPigkdZMwZbLSnDxH4KtQj37NxsRFOo9/Qo/2V8aiLXLGs3JwfHLDVA9O+Bqu+slaM6pnzk8wzhF7OgqV34xe6Wfg8cv2Lu7nzuBPnB3FB+ix0uGrMg4qwHzuZb/27zrff20Nquf/v7YmGCNnpdaF9JXa72l+/s1r4aMx0Kq+24KW9q/Me3ASuuZYY87/G+/5C3MNnKI6E6CRLDFlX55/ocULH1dfzDZHoQH2n7Qn/rRtuGTPRVnf+pWxibHKyT1UP2rMtf0eVv/P+HzpOCDBvV2iSZuxntP0eok15XjMFhnfJq3vMCqPbxzfjJw9+A0y/lFjhjPw+6e+022n+p6q3Oea8PDKNd53PINiU4rxHzvg9XN473U51+E0GVvpFZ3llbcR/CC9incV+DiDdQeS2ofwa4EVvhbv0/f6zDC+tM6au28CUzQDd3zTDpw6dFgonne8L2GZGLdGz3f+NtgyBmkLHlBbM3zbvzw5etXz/fNHmK0B2VjGbc3a4avo0QCGzVq+DIFJvqy66349aBk9Twtffd3ofY4r4/3zMIN2BrB17z5PxodJrd0q7BJyOODoBnbnJnHAKQ2JiqpXFePwC3BpbEtQM/K0dc/7s+POY469y/7wk2tfB6s949j+zFiZkWM6/gPFjboFjYCgFT15URVazoa/nC2/OHanqQ7cCMbcOEncKvaIyH9ti3VsRb+hyIsrTlyKKOh59LoPfIlWHXnrwB1pXBMTzxRVm8yj4/d78ud1W7u82lfGBjx5reDV14Kes0z+7/lB317jXCzqOyzeH3FO5W5ujtAqcF2/0nSDOrQw311PyDvROuI+UXCZ0p5+lXpVsq+DuVHAkbOdjL4+RrMSbL6+yH1f5HTBnyMwk9wXA6wH6sGifgpudNGfePc78D4EVWCJhHYl70FTXlP+rGRVmLu9MF9VsE7lcwteYMvy1n3Lb4F79ktr/NLd9mG3j2P3Qv92FuMN7L3Mjf+ajeH9B71viod0svvgT4r+lG0p96CXeyE/6eEr+y7jSyg+6VQfK/RlgHOcDtkH04BX+oI9SfEHxX4UOBFRF1d9mzgDP/n9Z/Y9ze1kaOMh9wEm7+FiTIPNeIR+KPBLvv+5mI8gxgiv37Mj5GcBl2NBu5Zir8ue83l/wgcNRA057T8wTz3n7ngPCP7uR9iW1gL2jnkqmY+p3Jvb5L/g/T1wG/oC2z0tnb+Wg0l6IeV8XtDriNrLIfaXmrrgXW9zP1dV5iVyeyt5DrOd9AWYLfAv+vPnUW8e98EP7RP5HOhvQB4UWFf2XU0DdqJP+4i1HpDDvJmw07XsfbBuaa2yDrnE9dFcABNcUb7cd/r9DvfEH6GDKjk8G3Vb+Zd8nXZQ4vzsph91s9pGdM0K6sPV2ZJm5rwHBwH5mPXS1NNjfV2akxNq0oPt5AjOW+BnaLznqufRjfpP3rIieiKYq0nhq6ROSqDtB8m1pZaFPhVanvwzWiMO+jy39HNRCwZfqfTpXjuX7/CvRT9qAPxZZbAMmW+I5pP5bMAnTevvm3U116LHzjxA10tws8wO8d4wJFcW40o4pyX0vEo8V9+sUnWDuuMHn6fYoXpQ2lWW4KGRHGiRJjTMLynbDVxN0qM7gp/e9nEf9J7tp8uwymMjcow2nQXo1W3K9Tl/Oe/mYrxRe+aa7u5xdGTuNNhk1O0p1qB9O1kAc2vdjtUG+gDK0Wl8ra2xd6fb/kJyzu0mmwdw9x+fwTk7Oki9BfAW6sDfwe69TdviWb02aqDnBTDlFCed0ftH9oTsF7/zluYl/l7Cn9mq0kF/FRyaDvfVma1Y96Hn+roVGL3to8f3PkA7m3G9TX0zZj7zy4niiSM4YidiD8brjc5a7icO24v97FoRZ7q4TpwDpPfbvQjc4zreiwH89uDEdQFvL8emjpi0+qR4PyR3RJfW3qwEfh2ytd6Rxma+EBx04w1+ZkLDTe8bQaMOzYSBrxlN9tOWddfxjRbt+YFnrLcF786/97RKbxhA98LyoLEwOCue2jHf8+nL1+c5qDKvrafeIdqQbb5Mmxp44j0nsOfkKzVt/zzP758ntvtRPNbp67zKurbVgeaHVaF4uRyQHRoPJ9GA7PUL+TR8n8b51IWtZ64Y7R8vqXcxxfMhb4cYcB7rTegB3qnNdcncu0Pfi+y9Do5mGq94TaNPc8z370vtQNojpYvS/N2LdRz3HOymQr/3UDAH5PdEvuvD7wnrvk5jqVt98lus4TqA7u33GFdiHL93lw/wLzT208p9coDlfRSOKD/e/sWwdbIFZdyPYkGDeZPimMBsGR7qAegxwvzJHPv0RdoEtb6x31Jn+b+sLG8fYnu6VwWaLYbXELyS6vfcH5z5fZg8t3petq2Ca3F2zesysk93SOV4to9u9D3FN4trCLvjSW0WwT8Vz8fdnGtGQGf6K/n/LUejGEIHH0LQDIxqm8a/4fpOC3qpj97h8Q7fQ/NQ8HxZ3vJU3gV6Uhb6JCm+H4/sHbTb0nkniouZxyzJJTGP7zdpa9BPH4GDEwtErc+ES7pwncreRuNV8BZEB+D/4Zfn1yXzhuiH88htYb3EvfKsazi8IFYaBKhB+2fYVt5X4Fk1hW7kB3NcOOZkaw1vpMHXd+jP7N3xlbXQby9ybN9dh5pj0F559SN+zr4jsLw8t6mfHd49q8t0hozMeKzH24i1GAcbkQt8/fKYm1uy/eCiAx/e8m59toU+RXfDvlyBDaKYMZhQjBC8OmvD8oCTCLLjOUh4j+OzZViWPb/e/jv705hr/DvJRSFn+2+6x7eeNz5ILB+tPeABA99ZzbevFAeQ7dKn6OmJjt9V/AicreCpAR9fJr7KrHVgpl8DTb5vXeKn+QzHeYb67mraCcAHvzM3qmcNWFVpx2i/Z32CyqvUdWUMKdnAuR30aH38wLim3/06BWax9LBN3V975vpmXfr1821A4zc06mQHHeg6OYEfuMPY1ovnfXXX9P16xk+ZkD+Dc37KnP/z/UtZe3y1Y7+oHpIt92l/zUr6wle88exDw68lH1r51X6fxhA9zNK3pHNNYHFwTRqPNmsYfc/6ENp9TER+FN2/NHXRT1WxputKFGocdzA/cqrfCvu0NLxZYbdzjH3mgdSDY/+C16T8P93L7qgYoKrikPR58F29py3jrVfv/hrge5o1oLHS1/jfHamlUe5fx9cqOC/1qdA60MHTzjZDcKSQf9k6xdz7buXfsFWxPegci8d6hDn/dL77nuYEXovON+9YFbqJjD+Fn64FsY+I+Iv89kj1ajlV2CbrOsvy9MbPlMWyAl8M/Crz3Iv+kyijg5TjUWL+mTg/vI//3W2E5HNG+Bn/Tevy8G5c2pbrqhH9gnZSXfGSvKOLJHWeV8XcLgl/u6YX98nFmg0pXynWqnyHk0T05j2NRD4l9pFz+YNB+TfzeL7HO5DVSb7niQGevAOd+v5+RjG04HwUeSfWW28FyPu5Adtu3cj1WhXnydvmNtFxwdgZB/ZJIpyTQa+Qr6YghzSWuYAR77FFKsdSWItK+jVFjiTmH0tz6iq+O9o/v1k/POaw+JRD5725T/oAyH6BN3pUX0wbzO8gcCHA+9/7Ax/mAmnOEx4NWWPDdRI9vvyaT+pDoYxJ4GuE6Ockf4nmAvxvgpNUxgHPo73gYSkZlXf4GOQ1z8ClXQWOGXOD3Bf34dBZP5Y4XeZmfp2xphN8b5w1li5wu5fkDP8ofikLjgXROwSMKHMM5DBNX45/vjEHwCYC18U3js+Zkwa2sq/O93PCO1gRNRXm3VK5iVaWKzTFZSzWYJI/s2itkf/GPCPdZNz+BntRq/66bdC+v8c1OSyYV9iPj/danWxNqh4Zx4I90UMtz5GPbYOIPUeCb/8Nfitj2zlX1/tlG32fu73w2aX6Hn95Hr7Cq3lvI4Re3Oc26l5fbhNtTKMqai9B9dWk2JnW+uuI+60qr6PrTI5FXcf4ci66gfo36hDrxz/+xx//NV8eF6fpv867n+vXaHc+/Gv/cxeeZsflbvvP5/3yn7ttdP3nz5fo5fnw8l/XTfTH//xDlPp2cz9LfVX3W6qFr06uiKIv9jEFAhZg79+mLGdSz8P/1WMukR5ECAg5laF4DUmxC+i5s5ulJH26br2QolpBMWQ7l6LLOSraki6g6BtAJivH523v8+vxsAkaGBVixFTuro5ULbbAaTrc35Klp82LqeILW8yO3EbJ6YwL6BzOL3Za4qW/QvszZK/isXSrotQ+/BPXa6gWTvMtBTu+dbOSGsc0rVByX5b6So/ZmlzJG9p7v9pON2VZqDod0X06qkB7r2dkoaQENmCjkOBaSBnTLHU7r4N6LIWN9cKhV41T4zBLTLHyIuR/uUQ4a+7mVuf43WzHlGiCoskQUEy5fe6ey7rWNtayrsbsJNok7ZOgHaP32XL54srfb3LL6txajucJrbBof2F6YdFGeRKUFLXqk1vb5sZ9XjzudfVONOeindJsjJkidXzVaZyqZ1rXmflLvqsDrr0WNGL+1uxcfjAEe6ODznybvp9cNxTO2seXW70KqPTde2zrLFuckvA9hUN9CSj3ayf1+S23K+4njfX8daQ9Stmy1WR4Rtu3kqxFGALJQ05bULQqKJCwFtoJ7ZBaG8/D8beM3NbHc3nXZoR3T/bo4lfnNDHv+fty+7NYL90Nt9HNKbScW7k9YbYL90SS5mzobJ55zaXcqo/WkijRVCQFItZUslYLW4uXX7/2exSJcnwVnOK9sZGtO3/hmbaKVhCuSfgqW/F4bFPrrKjd+r1nyrWp8R6MKTkFjYyOc2qOFndaf3rXM7XuqqbFaRpJ3UH7cE/rRGNb1WzpiUxdcM6dU0z5D0opmSYieynSrLiO3WxdJk2/0l/VF72bSdbUP9P/H3q3+bl/W0S922Q1WfUexqs5uR9j+v3s2l+Zd9C8PHQBlH6DZW39Uj58ZQ9zO0aXae/rP14bqfkqLRZmJ08voCTudHI3aUwgw5cL5ZEemiGd3YB9CtaCftY4wFbLtOXHY8ShSHDuDlmSr9Zvriu9Wz8ae/510FyQLQlWY29e6jetdQ8w/raxGW9sGq1w3V/NUTa7Zp5JlNVzUJk6l2O7oDjZMr38N7NB49t4eKA536bPc+X32BtyWxt1KR1E9g6S6DTvkj55zu0X9PvpBmVd/RiORAoSJWjaqyg3q/Jbeg5pv43zz+Z5euDaGqA/i/rfOJdMq0xhu2l775yRjUrelp6EHGgFsAtp31PXbIUWha6BHVVNlNpGumU4q7tr83OK9tR6NRc26diDr/k1RWGD2dCjcPiD1hf5CUNOS2fvbRynZsNc+1o18NfyvVyyGaOH+Sg6nLtetOgOJ+HLzT6/uvacTFzh9x/xnJxqGB/RYgg77baCutNYL4X9u7/H3bVAYy6v52iR7xpBY6QFQ6THR1ql7vm+uFYnP4f1cOQd5kzfeQ9Jmg6vtaXVsuq+XBsm2djXZf1leKsdB+TrTiL9e79J5zeuc9/qF7e4Pbn2bjo8si0saPekdYO1ungLc/cbbFM+aROSGQEkP/fTdpXsYqiTT8zrj57rH3j3JKw379qN7LXhOUHVdfxx1Vw6yVqk8eTxNuLfZfaDKaiEdp9df7aBZOd4Tt+P39vMjelks07bIvYhyBYZKq2EMJ72+tGhvccQE/Y99TOd3xRK1lNUvyLN0B2mWgtlumV2/k3ruy0gMl1X5+t+IT74cgwUn5WNOvmLE/IvhXwS01QOnf1kM8Z9o5d2RP/nsPfD745LoOKg8f7V6wgY0rw7ovFZ2rsJj/vl1hXS6Te+nmhh4H/TdUWpht41ZKimcSW/c5mzc+TbOW8sa7esLf2W4btNbc1/N8y5b9D+bFUHDv0JjNB1A8ewo8h3/P6T0/KrPbce05jTHDV+c1wW+z1mOx6f0/Sqo0RynJAdmSxrx+6QZUuP3Mr38XdXoJrBWfOr1xHxbu34QmNksY9sz6ed3lFKRuN6QlJx25NzKMrfkP1FnIG9/+iaj0wT3q4gtVaaxPB/X8X6ao/V1Tmq4DJ4Zl+VAQExb9TVd+eIj3Bvjg1GgLzQ3jTqLs2FjMdFW6m6x2QYrOFvpOKauHw/uIvpFPWNiMtmHTrX0foF6Omor+JAcc2rkJjBc4n0MafThM9P8eNYlFek/yBoBxFj0T318RZpTv/YW9mnXlM+Tyem2gP06QSbg+fur2pK/jWieG0v05ApCsOiGHiXtOuTjwnpm/zvVGk+7d9wHIGxiqmeqqK9AJRerdqlN7T1gTc+j70e+Z8zvdem/zd7D73m7GHi9Urj0vg2aJsP/aGxod+Xe6vx9a41oplrkwWtzurrPofwrd7xOdpCyhhUTrMO+cPL2jm3/5FDuHGZbwj6ddFmDagUzYuATKXzJG0pld2y9OfhZW22BQQR5VXEGyI9XBctgg2d153ZMmzXFb5fGmoBmmKeh3O2NTtc5cbDcOr+OjQCo+q5rRb5os73l+t97iG/NrsbUC3Zhf4dYhp6vx95Wwi4GNkBfXqtn59HdaSi99PceTTUD4n9RSvrUpfQxDr7dY+uiMXobPXtwOo4gaPO5ju/Q9Hzmm05njgfBH3wEXAOs2F1yOa+ClrHyH9y89esHclPRBvQdexWkXdCG/abI68rpQ+ZarZL72ZuY3lLZT+EtNfSwX3MwLe4tDLSohZd+5QbH3X9uXxG2LplOKR7IBe4mc3J67BonpqepvfdwK5a2blb0hmxYWnGrbXolpCuBm1MtSWuK6Q/u5tUSzDs6TvPnV5Lnz9/Eqs4cbq7zlSQZCtVGxmg5XMZN4PWTtLKGmvkTzknQTE/7L1saeI4nf0ewKa2wTkvUZKPPx1t8Rq0ql3Hf7hbx7IN4X4PG/XmSKM9FFQzc/8nY59qXkbJB00FpIq1qotWC/I7e57WR9lzYAeOFax9xH8X63f5ah0u72mQaLZGva2IA+JxWZrIl8X74gIpMrIVsVQdrQcfeyueb1BAe7q5xN7hlgWm8bGPgtr1Yf60pPN8NKa1RPbhLh6fUTywSPswK+Q7FYUnl4hWx+vTUJT8BX3XQsioNsyEQk3QgS+YinmpK9rvtwS60zv2vDHZu8sZn+lux5fuhq+5fARNiSyn0LhOTdkemJJHhP+mhaPecuRRXBRNDH8dtV0/oDUu7OosOixpP3ApiCWZpUSdGWnVpxGuGZxR/qV1cIylFRtWOBClVlClT02cpYBdsJRvhipwOXIPS7th/vzgPvtsaZzLqnJ/i9oG5pnGm2K7B+QuSt1ShdZp3o9HWxHD0W1br7J8tdOKOqDyRlyWrAtxdsCWzMp12s9sizYMNyV7YZWP37vraE17CTYU+WBBpyhbCdmWeLsk/tStwIuqltMwc1QzCkZvp/ZJpn2q5fqh4es21lFsHwXVDMPp6VwE5Aj+pcov17a0b0/u0Km+urM/advyYy0kgWn9nk1Q/5AvB5+F/JU0jaSi64zHIe8LfMGXL6b+H6qWicsBNCAz8gnUPWi+56BIovgH+aFbpt4zlL5w8u5vaYkxuUfy9kPRE8+7vknzXvvx1AjtoS/tlzvL5xsUdbGAJtC67nYA5wcsPRcbd8x8WZhrbNN2tOxG3AKAlsMvj283LQ/ppmRTBSROUNI38nK/dVle5n0dt4BB/gOwTsh1fXhPsi3WNbYLLB8ddoKb/P7QCSzLWUeG08iPkyyzkm9eQENZfRrSuMEH3USQKJpaevG5RJ8V5ybZlDv5VLJfLEurKMro+ZJ95ViOFnhBIww/Go8sXFfZsjB88nRIgseUjvQOsQ0h36njrw2WCkjfR+Yt8L6q7QJQjvg8/4Uxg++44+fbBFslISP9BchLVkH/otqok9YpJQcB+Gl0BgxAwVa5Va9dhbRghd4T9VuWmphsIaktoBYMB6IYbQIZnK29zZ/t8bmC9qDGosStFi3D868z2W44Zqqh95+7IuAzo16uhSw5xx8boRhj0XogfYbg1SMbaWsXA1Ijvt67o733jeiJ5qTptTI57z1iH7pneQy6tWzrYEE+nOUTFux/bhHnU9zRovPAa5X6w/HDpDnWx6tJ1L8Fy75nn/tNuzLx1tfxyn4YNCebfrNX6jXDzdirfR6Xqdin/aH9OubiNkUhCL+u8HdJ3eXeN2MYUHP3K/bzLteKWoHKEeEMAvU9jWHEZ/19fUQTNQnUqp3FC9dx1mfOW6h8Qty+LiQ96FpJ3F9L1ST/XE35vzeXIMdb0Zama1RKRlD52TI/cIrzhRtJ683tSeKzSZz5H17zeicWoLMKMo6gCD6jLmQ2a/k9zzUhsuWgqY4kJcFi2knVq1MxF637b/G6ydCdyb1kSCoMF5TFfeQoEE/J/EFSPxLnCei6FO1dUvsn3we1/8/qRh1XycPc51YkdeP9eAQtw6Wzwn+nDlSQc4klUR7zrefwASej4I3GcD8DFJbi5twzihqGzC9C3plz0tt+ZLYWhu3be5PrxvSZfFxt6OG712oIqRlT1oS715Q/uQ5sT+9bFHu5Q1fsRbTuSXpqjqmet625WC9JjSczLkU1nvd8tPd9sx3qFuxnCXj1gW0f4INLSDNdOAa6y10jN3oHOY19u5PPMEpAj6srYHE4lwrYpquX+uS7hYhv2tFhWrbfMvUa5G0hMyn8zy2o+0RdTsDz785CjlsEhQ6d80tZb18OljgD+0+AD49uBvI4ruOaB3PDZz/93rwMhr1L3wtXk6GvjVd+ZdBslXFW9Yb2rbcalwZNv8R0Ybf5w9hbrAdtIzKXdxR1S2WX7C35BJv+zlzt6DnqX8Qwadde0ywxjTU93x11wkbUr9LXnpSqoGg5MX7FBUWKozO9IaDvgkoauXWKgyrIr+zHZYqBVzWyWbVKz1sv72Hu2M99xO4YN4GhKtfhk3Fc1x2Ny6LdoEox9OUtbDCO5MjYtFIin8Sy6MOg3B05NMYHYKtW41Ht+tGY+Rnp7Aq3KNA99y8UC5urfVu0jp6XGRm0NZ0jm+pn37m/Z+YaBs0wbC0wfrQe1sKGdhuIY0FZZzURj5M9WA5W9eq7fnGZ5RCnLEtWtiBps5DXX0Oel6WTt+TPAdIKiYHUGhBz0rr0miyfVwUtsGwBz+9p7KvbU8AxyT2Or6xs+ddwgYKKoug6XOcSzzhStBC6Ogu47oy2r+5GR2vJ3Vol/+CvxK0Mw/4M8/il69yt79lfptxn/1/Ysje05HxJlm+jgyr/3biFbSjNKY03ngOy2s0UXlDzGZeB+FGfJmsD0ttyXn0L8PHVM8VTWD9stzt39VO2H6A8ztvm1Bo496962iYfJ2W03yOHP7+3wQW+MtNrrPSrpT/Qz368ce0hqD5568sEeAuvFch6vcIo1C0v6r8GK7LN66Dj+pXZlNaTagnHGvQwnoF81wBU8r05ncG77vKwH+iXE937rXutp2Mgl1t1Rc3+KQisJqS56dreSB9fRlowcBr2Np9bR1sQJOszkoXqnZaXbThE/VbKFHrHeO9PkYsU0kp78o8v+ZwOclCZ/GWnt+P4M0CraCr3aBxLFAdzvgMxfCY+RJ4NsbCYv1se9wT8WbhkOTG+XyHFcXtcTc70ipAW6kzQ7oG8CmLk75C4fRqOVX5EybzsB5De2/yoTpaVA9u6ItmWdLzbwfltnyAL6ANnc12gRvKG1pVRSUdtfS9jf7wz2tkiEevPQNlK5629lb8/TQUVxWZ6rYC2RHx2VX+js/Ly4TO0L+RTsgwPzYuO+8j3ifMOic8D/8qDLI74PGpXL22V25ir7ys6l22hnF6yp3PXbe0oRqfzrUr+3OwnzujH1LOBMnzUrGF/xXS5j+7xo+cQknZr6zAtmXfP4ht3vhHZ8B/kf0p5j6Z25z8+rR4yOX3IlvlGQJ4jY5VFjal5F3eqM+G31YNDsvuhiqE7f15eU8aAuXgMOSKLfBNZUybbQrFLUusS76pqB9/y9fqhsrfuWdbfnPCvxr89z/9baulF8TTeN87XKdx5R9DydjeyFnxNyYJuMrnDTJxVmAP80jUzdMOF11Y08ZIaXtXpRDx/raj5OcXvqH4WKHuVxJFFmAKOiQtr33FtfY/cbZqKNq53oN4MqgHGIhTgKdVezZy/f3c8LKVdt2p9pqVd5Z5v/EYs439S/bC0QG2Ia4jI4Ybt8dy6gmatIEan50LdGTXGnquVH+9yL5BCZQwP+X7AevB5eie5O7jW19N76T2xBj2N4rLFarakNXmt3st7pelUr9oatEIUf5+414RjfG0t32l5L7lwX8+Tda6Pa3ppzMQv1O+eIdE5ms+7axoT8okm10pvPCR/uNOjeJTiBdrXM0HhjvwbvWNwjfcifMXRZM9xz9ISdbalI39n/kIeJSUZ94v1R1FHqoEC9jzV1L7s55/lbg8IrHD/yQvq5LcGg6CpLa3MujDns06EHoRT71o7jq+1bSw7KnMnU7TEb0A3Et0G5WxN67HTr4CaICRbMV2Sz9X8pTWzfCxl60DmOvWsDSt8vFo1Jes0WJrfw5U+JVvFPiL9zZKzjAEW8tzAKtCYATe/gG8rJVf93ayx/mlmsMlj7dU1D7NrFA5Ksa/DUrfhcg1aqO/crrm1d2HEvu22SK4lvU+Ts0OLZiy3W7sba5orKSfyoZ9SJJkscnC56yGHzWc/rTXayzSPwanQjxTnzy/Xlf1S9I2Cnap4F7lO8/XidI6wbVUQ2yZ46dZxEOjTXkOrjNzdGs8p+qrmO1N+9qmpab3VWht44zL9XTLvapgKA0N+KN0jd6ZWU/f8xxMwlQk2nuIlxw6CIvsz2d/jkSqRwFRK6sP72sQ0ztfHvlX/L/tN/eZ/n9+UroePSibFJnk/50uS6omPI7+XitGOsa/bljR0296bpGjCNWs9z1j3vXWp124hJ1nue3X6//wGmcRB27/1N/1N77ZYDpr0Lvg9JBrnn/aZQBpR+Veq7qN8+rR/JWvR9n8DvjFCbayglhZjczsTYHxA7eDWF3R/1KYgt6v8HOQDKXavqvgxVds9pzG3jNt9F99b+wQT2QpNJW1/X9uRFLL3PS1xPfy3+XEZ/Jisqzdz1/tF3z6Heeu7fuiipuxplRgLpN6ZbGo0Aa2gsC+3dE2uGCfw/6cfGt+He2bOuO4dfgq2tgsK2iWtQfLf3sN2Mo62Ad/o4zn45HrnyU0jXyNVBxr25ikZca7Z3PkmbUgiP+zMZdKPnfbvukO1llIU91ft0l/q5KMBB+vTXmmdxDXNfTpPBuya7INP0WVynUefXa2QzuVlsA5c159Yjm8vE2wIeqxB7WUBG6LWLGPx+JpkS0PuhdHTeLjYF8lj5jK9nq7wl8zl8f37FPgxBfN9nlzND9fIdHhcP9P8dke1D/AE8izJ51ZT/qa9LOYEKK4r6bKOz3R41+62XonParf2jw+wan8dD0Z+9lf9tcR/5rpcqd+4fAErxpLfv4IP++idkvx2SfhGoBGbre7odBbhHc4yg9tSfU1cy7HK9RXb2rieoOx4/CzYL9sUDkphTcX39QRrmpd7T2NW76R7P8J56ZmYaztyE6xaJkf0CaZL2aEPaht4nwyNv9qfn+DZCu3dJ/dRNRyWDVGyoUXjcI85/Q04tASLBZlpyEueIG8wXo21J3f2U0nYdTfkPyayZzLH60TvyeGmc7n/z2Gz7tf6fzM2q9iWPg/Hou9P9I7R35BTQE5QUPnc+cgj4bOidj9pGxXEDAOvxhKPmfrf6j72Sfmbh6Qf7DyP/aW4jywIY6pHmuN8T4GkihT4qwIJdI4PY38vjkf+PtzWX4u/BPYM8Q6f20mdm2XSSyL/nv8drZOj7NGg34WoQUf/yVgv5Rt/Da/2t3EYqLip8cy9NK35BDik0nwupKicyGwJ6Q/krmeQdMLa4/4wxLDkM7lcl9YkJmEu6UX5vP57+m0K+83+XHyKPJ6v17218+r69ru9a4Lenfv79pPG7+/7f6S4Q9jG2lL4n723VM7FdYL6k0/nkqdbk67Y16Bdp7/J717CpyI/xK1xL92v9bdBdhNUZn7Vasx3vhY06Uxt+dcD2fba3XkTlhZ79LRKunD6/o/3c8m0hjiPBtwQ+nWuP9L9HIbfovkLnCc/Wr8p+nzyx5hLxuR+3/3FFH2Tv5YP/qWxFLYSfaMK54rnFP18xsAxuOdkzjkwg/yBNcve+I6v29mzhOcEfpKKbe7GJRkPjh+3AgPkfwX3p+zhG53DpYGbetYb+XPIIXkUyzHGwOe4tUv70LqZOuqXku+F/ILwDbKqVrA+WkM6T4eOb/nzb5avfbOC/vOjO0EuBtSGqFOgzi5i3dJFn21rXxgDpsF8kz367BebRdI0tA8fS/4958FvjWG4RncMgUtoV8sFUkMirqQY+Olc/Izd4f0zPjbmc9WvQXvsjLyqOFuBxTF+3udY57vUvap0jjDPVrzPbhfQj66n6Ll0ab8J7hPmGDCbrcf38rVBydgLOmeRt0eeNc51Cbpz5L8k11FdSMLTfoU/EkocZE5eZDdWMiL8vJaQMCmYPxrjaNaoXfr3Me9pYu+y/iidT++dBzEn3yYAnWUpf474et9Evo/PL+DJGvWWF/Uk1tjZ0edBEYgeSvD3AddywveekadjSd/1ZzVWxCq2v662RtriiZZzXEueIBeJPFhEMYdedz2NzgeyV8E7+TXfsJ4cyE/hPAv6hr+Kc8ARcNg40ws/t/z8emQn3aD5+fX4c194PlcLJjFmvhTAR8AZmYyF3vdcg87kYF2c95PjgfkZpajUv3hd+nc0pNjNIJfeGBZg3IOo7qWeoWBOJravJ+/yTh41fU+TbKk/0iaWR2eHLyTD/C88a+H3fmevuvARjg+57+p0rt+erzXyNfN4bLKvZfvDnlg67+LcVia2XVbgA+3MuzVt7pHzIT/kMvD8U89b0x8Tf87m8j63xfai+WHu8G12O4o6HnpxU/mBLsd782Xx2o2f49pbmvf9qtJXEvs7zY20Po3cw1rUwNDDimfIcCeFL7fWoT/S4s8U70XhN9FzvoUFHERs+/ndH6o9l3th2KY9NbUSOQu3vnvvL5FNZH8Gtel8TVjNkXls/EsbN+23Y7utdUc2GehGN2ycte6TM+83/tE9tmva2EasJ/MC8+Xz0DmNXTObG8hRLad7DESMapPtxPpxbuHKhn+4nqo+AmAfRuFPWkdq7cytJjk/1/oPxKVYV+RXJH6YWIfv9zXk7QTbV+fVWUcDSICwBF1E32/q/zCNCnw54Oa+DbXWcbhpHV9WtePAPbyNRgetV9bWBfehZwR3C3AOOs2rfjSbs3MPefHWgnx6H1jC23OeW+nX+x5o/V7iHGLuGXDGVCG1SGu6cK9Nl2uJG3lgnOZjIyyys8A0f2InIaGYtXuQangejufv3HffbVXIL/Pf7V2F1H2+JnCP/13k83ump+mGpWs/reuPE11r1y3XVyPRR6okJL7PGpUy/MBJIHto28eIfMIr9x+MajuLa/nrn/JvfH713NbfJo35eXob0zzm9359krevFKMe8Q4T1NIaeoX+2GZjtmUOC9rjZNv6jlv8jJ/URuJrA+swpVgkaNR07t1O2RfaPzvUOOha10xevyH4w9ALzpKZumN4QS3juybXzq1POudFvT29hqs/yS8rT6Mq3292za/pcAdeDrMVtf2bJnIpjdpxtqxD3i56B4+UxVm0H7g+JvzQr8Q7mM/7GEfRXrO9w7jjc8MwwhhO28xnBqr+gRNYFPcHfb+Ryb9jP4GDxCCbI/G2ZH/aRpnOwu2L5EIwG/b19c7WJeeDegaal4WIGb9oi4CjAM9spm7Yn02XjAfisUzwEL8wP20H+3D+1PjCmI76qzHZ43fseJnOjSOtrx9367t0PKGnaVQS9p3ObdEL1mwV8PtJvO9G+hLKljcf/pHl/KsGgVEPgrwNjfHCdYGtE/wLH37/vucwjumKavgiFyV8/JizErUJigE6gt9P5MzoWYSkK8UHMkcf825hDsn34rEXnLDcC7ni3H0j4b/7W3JUrWw8IbGpQkqwzOOVzk8JO1Lgx3q65ef7W9PxVDpnKM+rvw8TCt7D340jaEV92w/pjLMmZA+8r+AGclilgmvGPDmN/srO5wfjulpq/O9qMgVzwZxJtl9pgd/jXW6fFA+xrFv8rt5TkTcpz3PfDdCH9tNs1sr9nI2HXWA5jHKv+tjQ9184E48zgSt48mEPG/qb2QIWu7/zhnS+eXqFufSGP+auxOnQfopmGp9p1ZchOA7pOwbkCaJV2GJb1J2MoqbgZKOz5ZZcw1ZyT0ZcQ6j2vNr+P6tPFvad7t85kk+weBUSbsfaaKQtkdeclqqa3XA4TjSXOX4WsnVPzfPWN9ZbcKx8cvaBFzQS529x7iyPIRX40ZSsUG7+J019al3JTpbNtzGd9QmfFySTaDw4joJUSHB6Hs2/da8/3sKNce2WLX26jLnKTsyhfb3j/NjT/szLGgnuPb0q97+9mzSO6B/iXsLuqEV+7uzIfAcjyFVUVvxzVwevmCYlrg+MIW4ip6ed4v6NjcBoos8ulq7yuJ8OUhwxv/WT19If3cp6MlR9MshvXWidIscd5GqimRox41SfUcP3NPBmipr3xj8xV3Jb531A/jvjLsf0zBSblPodDTIoayHrt/6MqyYr87QR9aZRSdq2xmL9qB+2CXZ0dsDzDG8Ui969YzTtGXe8vWx/871kX5qjkvgu5iN9f9T8XYFp3dLeSEtSXfrueo9nu6+HSlz3SvJsBYct9vpkE21Zvkm7LMab4IA+K4onyB7PTpCTRG9TzNG1VXbeP3G/8Ih5rrejNF7o47nRepibVD/GXS1jwxKC0eyG3lXOd35trMqTtynZXZbZKV3itf2L63Cfx0gjF/TYkdce9fZYh9w7mPoZ+gcHd9gfkUeQa21N70S+xuK75PbZTxqzb2oddZEnEr0w/PPM/LqQpU/GerBNxo6+VxKyhcHNuu3jf3dT0lUvKSl1llkTOH+ORy2dbXYr/v01qnY5r+C8cix00/3ZNoju+vbv477ETnqf49e6wNInuagUVge5sTp67G4vo94Jdj2MDpcR1vTVSvcmhI+iH+DXbPcd/xdzDJPvaQtcgVsDZyuw3ZBn59hitD2qc6t6l3e/1v3ndqEfK+plHSlDPbTewIsISXClg8ASnOhFap/nggu6umSe5w54EgPUb0VNGTWBtkV+dFIH784L+Ho7wRn9qRPuYR5zTVv0h+vcg92Npa1lLe/+nP0yd/ln1/6VWqeQC/wt+ju4X2rOzYL7f54DSPrkBc9gPhdz16+UwhSbHBfH/T5SR4PiknafzsrojfwPPRuLQUa66nJddcQ5IPRJrsGjMaF3+LA/KJcz+0saQW5q/7q6lEuTPIpfGDPGSQ25Xn2cZTghHorrrr/52SWX6h4yoMiRfp4nwRwybqDQp6M9uoas5Ljk53P6f5nf71n56Bi35D53/Imip1jw6ttB0HL9YGBrPrjrFyF4z5k/5KOeJmAwg+tU9I0Lrl0vtrm0fy6cT5R7+jSjOAdScjnc3TJ17yWdpSzt90Qr9rEAX5t6N4wbuBAOzKmOGgt6bnCG8bjzv+les+NEyP8CK0HjMT+yL+PWLj36jEs+vh3by/1C4rXm5KdA/v1KMWTd1hlv6CH+U/uQcQxBYCCfFOPKaQ0DKw4uO/S3O6qPk7EHRgCs4kgPXK8xScaXzjIpFww9gPwcWU6L5RR95i4I+jaew/HQd5bUR+/ij7+4fjA39HtofnxhnQOnSb4Ynanv2DOp/5DgMOg8BeZG1QCmPVerjAJRr3lc2kWxmMb+rWu+oeaG+DXDxeEW8HDO38dYf3KmA2dL/ku16LxYfmrbyw58qrdYrm97x+u/mjX+IsaheH73s5V5luOSSNmSj/LMelqV7affHUHfyqGf+0fwFtJ5AH6PvzJeb/l58MHlQZfwo+iV9j00DdJrA3vtyV/tcv0aH+DIP1ufI7F2uolcfYVxVKJv9ZN4+x5zXnhWx/6lo1OsenvsAC8dgGuFfOnDNunhnH17uYbgUdmRn8znYX9ln5B3UjbgsZ3HPlsGneVeYFiTEUusgo8jzQexplg5EN9tRNXXkfYhVlhiNxcz8gfs69fGDr7DuLzfZHUC64n/73Kt8BfyJTU6T3VwQM17zVmZfNTjc8nZ45lobreW3O/W7cBcf0qPY1aC3oGuNLhkPqEP/OsR2McUnxLt88U3aEeQPWyajdla7sttfq5lHT4qqANh3X9Pcmn9qW3oVTw714lbtbWsoSMfnlmf1tX5cE98dZ9b1zqwnmRbkbc6f7YPUauje1TPSSzyBV9UyYMW227lf7/G2CfX/lcx3sH/M7zHhbl42aP7W880SBhLTcH4nd/t8U14URjDPN1AzrW6FPkn8Mix5OrX6ybw98qfnjuxzK30Z9/Hrye+6ltu/vL1msOsAG8XY8n8StdbV0fgmaDrQKMmiiWAgcW+Co6dsZvRD9JY23JYWUx5ffQj2AOuNcrPC9lho9ItwkKOFhTr1fJcSJvnIsyFfKa4F+ymVclnu7NvX+q5V/xGec545Mny3Ec5G2xGWRtpRtpPc/nh3O3R5wupZ9o7wAjc9bupeWMeeNfivhnX1+sOOLDWQc/xWWcq1Vdifn8n33N9J5+S47GqrUyD62pHoXvD/PFZLpOO4MoZX+si/1UG5u7CvU/A2XFfEXDezP9gSm0briHOp8jXXvPrr08xwJn5F1DXEJhSiqO4lot/Q6tLF3y3bM/1xUtD51ya2TTP/BnGLf6YWzd9F3Ycet8Z6pda2KnfBssfb1r3X4yV0cZT+xg2qtrYPGrdpn2otmta9+GkjZvOopHnl8z14zUE9pJif4qfw/qkgxwQegCRk6Cfi3yLkvieQ/MTfEEy/pxz7EFxFO0BHbkLOS4RtELEuBTvme5ylquPgpvXOECuHNxaRZhJu0Q2bvgwl9rFov681NP7M5rh3sPgitppumY4uHLPCuoimEP53Tq4OlQf1u2zmiifefk+920aT5quAYq1UYAlRJ3pqzVSsZfv63I+7Y2+61egh/FkR33anxPDuXu2lJZvqi8gng+j+jbeYl9Oot+K7xe1vZ8vtbseI4mTd4qfX/JQMM6esWa/FjsBY0zXVn5WorPnVsLHa/x7ri9nfh/o33vuWYfGID7THfXEdTTd6F4r8IdonfRfRR8g+w5LganTb59jEj7UB2Rfqztcf+F+AocjMYOilrgxNNq3ffi/T6MomgEnca1bkv+YbElwY57AVA3TZy7UvuaiDtY6Ri++yHsiRkpdA1yLJ2CSg1TtAzize//Pgp95nUj/VdbREm0L3qtagabFnebGvLd62PQEFhz6f9Fn52RKL/CTsftsju5jgewZp/1b+hgFfox5h3F6nBc858jafDF+Xn7VLhbogOmztuC4TflPtcmwdemvgs2gbZf6Q7M08Wb6eOVrvaatDYZ+pbcxtUFzXpqs7Ft/VStPNq3zF3gyFG6l2A91s5gR5C5GpWgNW1b8O+aUpDOvwGZyr/P825/zpVlTjzWcZldwIQUn4POfh+EJPe1f7Wv843/8Ee5mh3/t9od/7X/uwtPsuNxt//m8X/5zt42u//z5Er08H17+axP+8T//MK/1Bt8IxQUWGhPOa5owTQGBGpFy8HYJwKeDB2ExNRRkcLBxw4NwRuNAaQ3gBBNDL1EoiW5KiFs6/wDiRrEjW7q8yeKCSM5IEopuo96Wz3rteb2D2bLq3vpAf086bkD/b1t0sEcnFG9BxJIiBp7jmSCyJkiBTVx7NQXh7nZ9MlsMQniztfWbIgjKJa/hYDFQ6Vk1YbRbcxloXFNjdCIfkgtBaEKGQFbIzX16xCQkHRRv8O7GCWTskyEAGhibjFjQ3NND2rTmPGlqq0PwUzQZubVVvzm+9W875ZTkSGyLFzk7eZLgmZvS5rtH263TWM2wKVdoVmSnkQwNGn1pHB9SAoiLSVs1iT6oBo9YeJiCBRZ3Z8CPW5dEqyjIYBytSAhpRXg/muOHeQDHq5MQ+JodJdgU3GJQWUJmz04TNhIc39m2LtbG+yTMIPtD4kOR4K/SZLy4lxAQFwACdgI7/f2LJP3E4TOB8PzQWePd0HTjRv0nbykIZkFYVvSM6vpwjuG4KeJdCEmKZ1Gir4nzngg0xI78d772SDr83OyDAAUEOfUrgqwxC9LWM06Y2WphPQO8lFmf001QNpFoGEnCxg2IEEFGVpH70J/7homEzWaCRlMp2hYLD0lRPXr+Ne1DkG5IksTgAfPRHbJAYNwMDZIWBCg0H/I9+mw/YiIlFD3Ve7WtiEmTsH4YgN2a59ZxYqBB7HntxcJzUvQeYEIUwDkxj8amnvswt6WwnhT0pDmunlDAmsaiCLooer4rqpg23HXtGYHNMNzJOUfj1002dikAjip03Z4blcoUJEWpwi6NszsBSRGtOwgtgJhYEJeATEvXyT4tAYZUxAqKlNLT+laOrJJFf9m20CHEZC5yDt97fnaMtz0VhOzV99OkSWTz4vkWiZZ72zwFeI7J00B6h/ntwb6niCEe5jHox61jb8XrfXZNf65yg+Alr+WEUP/UWJk0H2GEd0IQl25yjhut5TPxe+Ea6XW91KWQ4EeCr7Q24BB2+Dw5F8znlccfwDhxXgFkvKIAEOIcBzSsksNSkd/LJFpU83J2HkACGKl1uqI9R/uPzpMhCySyKJEgBoQAhxSXkQLvLExK54BYw7RmOwHWb3wfgDyT89nZ0Rmro3kVgDqz7aCRiUkD/I5FZ7K+kM8QN2TwvGONGvSOo/5RntVIuutsG7c9mo/+gmybzjY8JqI3dPr+frKJ2OYpoq4ukzxbEOcT5P1k05lMsrTYzxpViBjh3a5T3ruVqFtWpPTVG4uNcgGzvlACAGFnfcgQ+0qgvCCMFPt+smE7zvaKEy6b/n7WRnKEAjqQHmzCG+89AM0LBCinIyazWsOJApmYEJaazVPCUgfTsHo+7XOcTWEDpMFCWIrXxojnbDuRNiQRlYLtRzBPPxOiUnQG5GzgCLZPJsS3wSln2/89LZkJkd31HO8/tq1IOnOBXjaJthf0rAucq489Olt9cdZemVyNxgJFXbGn7ppOlU3fyzHGHx8Ch2YLBB7kZ3AzM703zjNxxiMhQXNHc1DCvfmsI//LGdA4CRJKsZeEnco0s4rgfbY8w3aUeB01Pm4oVXPNdht7Dw2sbuY+RU2ltHYrDNTlM2RUP5DNiIQfhXcBkNE6iTGBj1glGwlyj/riRQCDD2I+Jnv4mWh4U3/T5yGegfvj/IYDDjtOZx58qx7ZMTHXOBNzexdN4FvY+czebesR2TfpVwgCG+yHZ6wPecZCHFg0D2fOsszZkSFIbTykG3ZpHgxNrrX4jBE2WPgw2HOCgAIgD/ZF9ekGhRsFsIzXU7qQBHtB/tps7vo0Xu0JB8X5M0u+UyxChAQh+Z4QSJLjkyTrk/UhSSZxlnMCDSLJqXcFeKdDwec1SXwjuIRPNL2ykC+ucWS7xkQcfB7dQvZx+7AJffodzwfb2yHt0TLAzT2OEVCcEs+4iOT6fJss6zs8B92P/EKQhfqp+IeLYHTf2UElWQUBHK018u2ey8GZ147wN5hoWuw39oPxDouQhekd5fvK94/H+DvOQ0GsLsYgTeimzo4X9sW1xP9j/4vWokgeixiM1h3ZPU2ITOM8jDA/8syH6IvDhFr0XRZ+6EmB367PwK94HifyHBB2WqzTnL2W/mxfn456heJTmfMmIaKHX6ZzAgokkyUmiWRbImyCxYTBArAjCFwwNgDNueSD0d7zQJprtqqW0+rNVfOHEGJwdhgbZccEMUc9IaO/gnTq4Y33XNlEDEHPe9En0tdTwMiE8IfOB8Q2caOLRZ/lpgxxHihylhwpC/myOq1Bk9f1vQ+SsYdq/XQBwMEzl+tR4l/A1z7QeEE4ieIJuj4LiXOThM/7RpwZKZAU+YIhgDd0ztF5s2PfDonvMp33iZCYHG86YZGsGZHf2orB3TRuVbLP54MQRMRYRFuZMD/hjKa5AfF5CoCKxHGVfCesP2Hj6AzBZ7eIuxAL4Xme0w0LdOah4ZtJkzEOpehM6+nKRZqOXE/0b+QG+DrcvFj9N9aQiHESu6p8ZJqPB3GtwkIK7W+K0e8KENivHHcuZiiybAIQVLMP8sJkCAHAVGrNZ/a2z01+MpeCHMlwQj5MuEOshwZAJu9t0znV3iPGPo15TOGHH/VZQxFM0Rprs0jUFeMjzqC0UPLDY1/ciwsdglAVPpuMKUaL1ZRiLJ5DPjt1Lnw8b7Bmec6UjVe5kHkKwPfZ+4oGUrIjPvswdzFxQsTWEABIMeYxeGUuwSsHFf/zuSIJ27oqJr7Cz8R1Ae6s05jwvhXPzXa2LsdY2c7krEhih+RstEfW0RT7YQkS4RRJEr+PWJd8rbrfUnmUOgNQZ4g1QdKxCeQc+iq24sYXtbe6LifyAAq4ieIYPyeTFc1g9yWYNeUfKJtvOY1qCtx8Fs2ibZXTytgkGqf1nEEleE9a205Mloq4/AKB9TPtw/24zHZ6M9lwbF1KzpZQT+XWMrbnmcFlFbKFlvLDlrAZJkDymLvET0a+bi+IeWRuJxvnZmMfmVfrDhdv8EmcVsXr6g752SAuJd9WW/iBUXsbb6ooZtJZTDZc5NFunDODLybm58ZimMIOJmtV/C5dyEvZBUnM1DyIYmCHwdUUF01A+HtL5Tzj9UH2ukw25GnKZMfRIeQzyNiE7BMaALPQXCT2St4/Vax7kEXXc2bdUHz7NpW2lvbFOcSzDPNiFAn4PH62VtTqNkSsmnrftB1O1qpbl4IaQnSnWxJxGeLOqfJLaK/QPXBm8N4EeYmMFyhG15SfJkDdPIYTJphCvkP40zjbs2cHYjiQ9WK+M+dIOhfk4lyIDlPxLpwfQb5lepU+a+xXiPemOWim11Fe2I7OEkWOJ3ygIa1Zuo5cv1sRi8d7nXMbfL4KPxJFiJ+c/5QEt0yu02LhVc7vAijEObXYf6qnmhJj3/YUikIGx81jFas0Yl8Pf2BXYiL6lO39ns1fsyBVyp9TdlM2AUh/JguCfnhsRNmmXLU3BeES4uLZWy5eXsGvEHnpOHeAYld8PmRzBQ8ozC0mm/GbeB62W7Rf9xxHS0HlG5+Z7MMhZnaiVN40nTcok+95ED5esOeGeD6r8O5GVrz0g9w+AChi7yXxrjr3MzFoyo+hvYKGIZFz5IYPkeOGf0FrG/YD77+UwADkmm9dGkv2ActoAr8s4E+JZ1O5EswNmohEUR+FeeWfDxCrUBxH98c5JvLesEc0bzHBIY83wNAW/g1A9HYyiv2dG+wE2wgASK7CHqXWdJNzUuU+3n0wvXJsBwI6DWCIsWzwCpPzm/adIGGk/b0alyH+oey3IqpCTEh+Xgn+WQW+xFo8z+UA32W61OO4Q+WIVP4yez6gBiTPmRL5cOS/i/ONzxwueNEz19XZksRgc9Eo49ZNT7u06DOtGLwkACorkedI2QJBWH8UMR6fawKIuO3Tfqnxehe5p7MUqQNIjH1+Ef/hbBVnMfn8k5hkWDbe0N6JhP8sztG4ZiCb2RdZG0f+hgvgHWohyEnCT+H4OAo5f8LrEfOxfBbx1FzFSLwfO7KuRusqzoG/E1eouhPHQe24yXkuz9ElYnfkgpn8NUVkLwX3BJGSHlre2nkKQFpG9nFa5lht+cJ+JdnCkvQLeT1yLubR16qDuGGJ7Jw7smNfHnlCWg8q33QvjJIIFcvcpvMKgsQu1zeiLflsV+Hfx+R9mRgIRVoWpdiS3WK/p/IWGlUVo79BbBExIz0Dx4oMqOmEeLZKinjvkM7TCJsTvKZqYunfn2KB98zvL3R/Y/USVDMgnVFpwmtnEp+T0kfd0JncZl/mxHktnLu0Fse8pu3U+Xl5VU2Q9K4nFgGHTxVUlZAd4mXhi4hrN103HZ/yz1Ixbr08ZhJHWnNkXwSpgYN4Db6SLmKSCeJxmROI7cCBvneMc1RDAcSYXe/Pe1Gz5M9xHVjUONlfxXV5HiYg4aZYIJ2LUfeYyWfkhrgkNwP/df0sYglcB7lm3u88XiJfw/uSzjuKjXQ8O8A+JwmmS48BA+3Vs8dkJPE7JnvH9W3OqdO+3ajzRM1HElPwma4IkigeGGdjzNbe87QkBwG/RzazZsZtilwM3g85L4DIRr3vgpQZc2LAvgu7xzUNzuWo8zQGvIl319I1aNEcJ2qk8L2v+L7wXZC7rdyytZiKBV9YkfunGm6iSVMXYh+u2OPper0Ekq7EOc7rRuWaczlmkdOjc+HGtVLk8XHWij12HON8GtIzw1cuw0fwi3JygizRFedfOicn8sdZkRI5dvDD4KPSNaNv8O0a893KvNbbKZ+e13baL4RdmW0FGE8JDHblWTSQtbRsLSZcxBiGIUSP6AwY2t8FRkKcASJ3oy9e+OyAr4PnFfUqOufWOJ+V7y9yAbzeWTBMfgb5AFWDUXGjEJRcpmIdzk0ht2qovNPRNKwnr3UxHKPasP1+V5K1W55vdBwp8qrei31EGvv0+3VzdZcCn6Lo7I8FW2Qza+r5H+be5gfEGG+czyj3jvzde/9czPmQz0G8h2HTuWNrUc/1DW7kko1elr8OMDfp72P82K/Li1fI+dpPBXnBYSL8xi7Foao+GI9nN5vrgs+8T3yz7JrrlkAU1Mv4nkXAa46/xDxpBXHjqbHUJKGLJGFJCfCmhDa+qZxoguFR66LKGAPOoyEXyM/Kn43XCK1TbniH3Z1wXSrGYqzzMVc+dp+Vg5VoxOc5wjiSbWQbrfMZt1Tnw13e8rt8X84Fch5yaFQEDiZYcA6V1lIK4KvAn/nc+XpaEnm0sCHFl4tqGpnYwYoovizRs1zhUwl/VzTiy8Z7fcbxB743oTOBfL0hclK9dGw4T5ob4pwXfHfU0KWdLHw2tbfgA3LNIRUHcgyDs1nur5Oo3zP5imjsEDm9M+aAziXkndYqB8r4GpzfqflL5w9o/abtRlxLVrn55xI9J+r4iEdLlRX8UbUOgS9JA5Qxh7RXDylyebLfxz1iGVkzWYmxRn5B4obobA5F8w+fdxJTgzkMvPVxAMxTN86RJfWapO7GxMXfVE4F8Tb2EWxnjIMgP787Cm7i3LEEzme7To0trZsEUC2bZnhMY1zJLA2+prXxzII+1j4UglWiYWiYJrhifwk+0Rtiapob2Zx6oOvWERNh7fNeU41tqK9AYIpxQSAUIlsq/XIVB3dofs1waCJXu8Q+VHlRxpoNkROOcR3kmwuQKDfUSDvGa2cZ3tIYLhZFRYOdAN0C1wBfgWNFepcdYu+uFNIWTYmog4aIRWOCQVVHdYw+5svztTnHo/Tvx0C3s+/J8zbnM/y9OJybOoQPJQGhbD9gl2O/BvnQCYtu+MqfS85J4TtjbVdy+bIb5/HKtszhPjDWReXpGE/DeWPUVWns4eOkyMmkvx43FqUwfrxHJkNuclJ+RFPitx4bEcZd7vMNYgY9S4jW6esifjNk7Y3PyCO9exS2/Vw+B/uA/agY+5P4qxOamz189x0aPwbzWLwCDYfIQWtc6y1uyOLffZFMQYne6RPac5zTaFi2HTjmk+vw3+aybg8DAJsrLfrjB7plBa2gQT/DOd1yyGH6UqM/CNSAI/xi453yc98Zs/g8kjaV82EM3IWAEtaLYXmIzwGwlfVghRFTPuaJ4uaFypnjGWVtCj4AkwanbOCbwmyk8FO3XF79qHJNwBFgbce+c4w96FemXH85vD3Dd2VCGq45bEI0UdLey8QNnDuk/7czucRDrrEl5Q/Bt64LHGj6XMa+JT+MYzjpJ9CeI/taWYv8ofQB03GoW03bis14FBywJ8yWwF9ONyHnCyYb42eMexHn4ULlepL5VbmnpCaSqh/F+1Lidsh29d9UXU7azkydIan9KNK7VO0+bYvaiMUvbxL78Z3r1CPEjhdhX1qKxOMcxy2pa7JvmfYfEUdOkAce1VTuKq4bwN+whxPGH7NfndgUrqPTGtFDjttUnY2J02VeUtTR4jy6sLHSHzqLenaj2nfWLeCh32Tz16Un83FBMH+z18bAvVbbaFS+w0eXHoowk4qAmOb0GE3oncRnBN4jxmsmeVIWFMYYIrcPHw/5SAGKX9yAVeK4IbZhCeaAxuZ//fG///f/Aa8MrxM=', 'base64')).toString('utf8'));
const ap2Branch = 'ops/production-api-only-release-20261101';
const ap2StatePath = 'docs/platform-v7/autopilot/autopilot-state.json';
const ap2ReviewPath = 'docs/platform-v7/autopilot/prompts/current-review-task.md';
const ap2Paths = Object.keys(ap2FixtureData.payload);

function ap2Fixture(t, mutation = '') {
  const context = fixture(t, ap2Branch);
  const accepted = {
    allowedCurrentScope: ['**'],
    current: 'unchanged CORE prerequisite', fullTzReadinessPercent: 5,
    approvedConcurrentScopes: { 'owned/prior': ['README.md'] },
    coordinationAdmissions: { 'pc-api-only-20261101': structuredClone(ap2FixtureData.purpose) },
  };
  let text = JSON.stringify(accepted);
  let review = '\n## AP2\n' + ap2FixtureData.record;
  if (mutation === 'base-purpose-missing') {
    delete accepted.coordinationAdmissions['pc-api-only-20261101']; text = JSON.stringify(accepted);
  }
  if (mutation === 'base-purpose-extra') {
    accepted.coordinationAdmissions['pc-api-only-20261101'].unrelatedAuthority = true; text = JSON.stringify(accepted);
  }
  if (mutation === 'base-duplicate-json') text = text.replace('"owner":"ACCOUNT_1_CORE"', '"owner":"ACCOUNT_1_CORE","owner":"ACCOUNT_1_CORE"');
  if (mutation === 'base-ap2-changed') review = review.replace('API-only scope.', 'Whole-stack scope.');
  if (mutation === 'base-ap2-duplicate') review += '\n## AP2\n```json\n{}\n```\n';
  write(context.root, ap2StatePath, text);
  write(context.root, ap2ReviewPath, review);
  if (mutation === 'base-source-existing') write(context.root, ap2Paths[0], 'old existing source\n');
  commit(context.root, 'purpose-only profile; no source vector');
  const raw = Buffer.from(ap2FixtureData.originCommit, 'base64');
  const imported = spawnSync('git', ['hash-object', '-w', '-t', 'commit', '--stdin'], { cwd: context.root, input: raw, encoding: 'utf8' });
  assert.equal(imported.status, 0, imported.stderr);
  const origin = imported.stdout.trim();
  assert.equal(origin, '19c157cee4b598175401d3266856450788a8d8ae');
  // Preserve the signed origin bytes and make its unavailable older history
  // an ordinary Git shallow boundary; do not replace or forge its parents.
  fs.writeFileSync(path.join(context.root, '.git', 'shallow'), origin + '\n');
  // A real Git child of the exact accepted origin avoids ancestry mocks. The
  // unrelated historical tree is never checked out or executed by the fixture.
  const tree = git(context.root, ['rev-parse', 'HEAD^{tree}']);
  const parent = mutation === 'base-unrelated-lineage' ? git(context.root, ['rev-parse', 'HEAD']) : origin;
  const created = spawnSync('git', ['commit-tree', tree, '-p', parent], { cwd: context.root, input: 'accepted AP2 fixture\n', encoding: 'utf8' });
  assert.equal(created.status, 0, created.stderr);
  context.baseline = created.stdout.trim();
  git(context.root, ['reset', '--hard', context.baseline]);
  context.acceptedText = text;
  context.accepted = accepted;
  return context;
}
function ap2WriteSource(context) {
  for (const [file, encoded] of Object.entries(ap2FixtureData.payload)) write(context.root, file, Buffer.from(encoded, 'base64'), 0o644);
  const scopes = JSON.stringify(context.accepted.approvedConcurrentScopes);
  const insertion = ',' + JSON.stringify(ap2Branch) + ':' + JSON.stringify(ap2Paths);
  const expected = scopes.slice(0, -1) + insertion + '}';
  assert.equal(context.acceptedText.split(scopes).length, 2);
  write(context.root, ap2StatePath, context.acceptedText.replace(scopes, expected));
}
function ap2Trusted(t, context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ap2-trusted-guard-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const trusted = path.join(directory, 'guard.sh');
  write(directory, 'guard.sh', git(context.root, ['show', `${context.baseline}:scripts/p7-autopilot-guard.sh`]));
  return spawnSync('bash', [trusted], { cwd: context.root, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, BASE_REF: context.baseline, HEAD_REF: git(context.root, ['rev-parse', 'HEAD']), GITHUB_HEAD_REF: ap2Branch } });
}
test('AP2 atomic7 trusted BASE accepts exact source6 plus single vector insertion without executing payloads', t => {
  const context = ap2Fixture(t); ap2WriteSource(context); commit(context.root, 'exact atomic source7');
  const result = ap2Trusted(t, context);
  assert.equal(result.status, 0, output(result));
  assert.match(result.stdout, /Scope guard passed\./u);
  assert.equal(fs.existsSync(path.join(context.root, 'CANDIDATE_EXECUTED')), false);
  assert.equal(git(context.root, ['status', '--porcelain']), '');
});
for (const mutation of ['base-purpose-missing', 'base-purpose-extra', 'base-duplicate-json',
  'base-ap2-changed', 'base-ap2-duplicate', 'base-source-existing', 'base-unrelated-lineage']) {
  test(`AP2 atomic7 trusted BASE rejects ${mutation}`, t => {
    // Each fixture receives an independent copy, including the compact purpose.
    const context = ap2Fixture(t, mutation); ap2WriteSource(context); commit(context.root, 'inadmissible atomic source');
    const result = ap2Trusted(t, context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /API_ONLY_SOURCE_SCOPE:/u);
  });
}
for (const mutation of ['missing-source', 'extra-path', 'changed-helper', 'changed-controller',
  'source-executable', 'source-symlink', 'candidate-purpose-addition', 'candidate-state-other',
  'candidate-state-compaction', 'candidate-state-duplicate', 'candidate-state-mode',
  'candidate-state-invalid-utf8', 'candidate-state-utf8-bom', 'candidate-vector-reordered',
  'candidate-reviewdoc', 'candidate-guard']) {
  test(`AP2 atomic7 trusted BASE rejects ${mutation}`, t => {
    const context = ap2Fixture(t); ap2WriteSource(context);
    const state = path.join(context.root, ap2StatePath);
    if (mutation === 'missing-source') fs.rmSync(path.join(context.root, ap2Paths[5]));
    if (mutation === 'extra-path') write(context.root, 'scripts/release/unrelated.py', 'inert\n');
    if (mutation === 'changed-helper') write(context.root, ap2Paths[0], 'throw new Error("CANDIDATE_EXECUTED");\n');
    if (mutation === 'changed-controller') write(context.root, ap2Paths[2], 'raise SystemExit("CANDIDATE_EXECUTED")\n');
    if (mutation === 'source-executable') fs.chmodSync(path.join(context.root, ap2Paths[0]), 0o755);
    if (mutation === 'source-symlink') { fs.rmSync(path.join(context.root, ap2Paths[0])); fs.symlinkSync('test-api-schema-source-parity.mjs', path.join(context.root, ap2Paths[0])); }
    if (mutation === 'candidate-purpose-addition') { const data = JSON.parse(fs.readFileSync(state, 'utf8')); data.coordinationAdmissions['attacker'] = { accepted: true }; fs.writeFileSync(state, JSON.stringify(data)); }
    if (mutation === 'candidate-state-other') { const data = JSON.parse(fs.readFileSync(state, 'utf8')); data.fullTzReadinessPercent = 100; fs.writeFileSync(state, JSON.stringify(data)); }
    if (mutation === 'candidate-state-compaction') fs.writeFileSync(state, JSON.stringify(JSON.parse(fs.readFileSync(state, 'utf8')), null, 2));
    if (mutation === 'candidate-state-duplicate') fs.writeFileSync(state, fs.readFileSync(state, 'utf8').replace('"owner":"ACCOUNT_1_CORE"', '"owner":"ACCOUNT_1_CORE","owner":"ACCOUNT_1_CORE"'));
    if (mutation === 'candidate-state-mode') fs.chmodSync(state, 0o755);
    if (mutation === 'candidate-state-utf8-bom') fs.writeFileSync(state, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fs.readFileSync(state)]));
    if (mutation === 'candidate-state-invalid-utf8') { const bytes = fs.readFileSync(state); bytes[bytes.indexOf(Buffer.from('unchanged'))] = 0xff; fs.writeFileSync(state, bytes); }
    if (mutation === 'candidate-vector-reordered') { const data = JSON.parse(fs.readFileSync(state, 'utf8')); data.approvedConcurrentScopes[ap2Branch].reverse(); fs.writeFileSync(state, JSON.stringify(data)); }
    if (mutation === 'candidate-reviewdoc') fs.appendFileSync(path.join(context.root, ap2ReviewPath), '\nnew owner authority\n');
    if (mutation === 'candidate-guard') write(context.root, 'scripts/p7-autopilot-guard.sh', '#!/usr/bin/env bash\ntouch CANDIDATE_EXECUTED\nexit 0\n', 0o755);
    commit(context.root, 'rejected source7 mutation');
    const result = ap2Trusted(t, context);
    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /API_ONLY_SOURCE_SCOPE:/u);
    assert.equal(fs.existsSync(path.join(context.root, 'CANDIDATE_EXECUTED')), false);
  });
}
test('AP2 atomic7 native workflow routes trusted BASE on both entry points and excludes candidate scope runners', () => {
  const workflow = fs.readFileSync(sourceWorkflow, 'utf8');
  const job = name => workflow.split('\n  ' + name + ':\n')[1].split(/\n  [a-z][a-z0-9_-]*:\n/u)[0];
  const trusted = job('trusted-immutable-scope');
  assert.ok(trusted.includes("github.event.pull_request.head.ref == '" + ap2Branch + "'"));
  assert.ok(trusted.includes('|' + ap2Branch + '|'));
  assert.match(trusted, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/u);
  assert.match(trusted, /HEAD_REPOSITORY.*GITHUB_REPOSITORY/u);
  const defense = job('guard');
  assert.ok(defense.includes("github.head_ref == '" + ap2Branch + "'"));
  assert.ok(defense.includes('|' + ap2Branch + '|'));
  assert.ok(defense.includes('git show "$BASE_SHA:scripts/p7-autopilot-guard.sh"'));
  const standard = defense.split('      - name: Validate standard branch scope on PR head\n')[1];
  assert.ok(standard.includes("github.head_ref != '" + ap2Branch + "'"));
  const active = job('standard_validation').split('      - name: Validate active platform-v7 autopilot scope\n')[1];
  assert.ok(active.includes("github.head_ref != '" + ap2Branch + "'"));
  for (const file of ap2Paths) assert.ok(workflow.includes("      - '" + file + "'\n"), file);
});
test('AP2 atomic7 blocks real promisor lazy-fetch and never invokes a permitted local transport helper', t => {
  const context = ap2Fixture(t); ap2WriteSource(context); commit(context.root, 'exact atomic source before missing local blob');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ap2-promisor-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const marker = path.join(directory, 'HELPER_EXECUTED');
  assert.match(marker, /^[A-Za-z0-9_.\/-]+$/u);
  const helper = path.join(directory, 'helper.sh');
  write(directory, 'helper.sh', "#!/bin/sh\n: > '" + marker + "'\nexit 1\n", 0o700);
  git(context.root, ['config', 'core.repositoryformatversion', '1']);
  git(context.root, ['config', 'extensions.partialClone', 'origin']);
  git(context.root, ['config', 'remote.origin.url', 'ext::' + helper]);
  git(context.root, ['config', 'remote.origin.promisor', 'true']);
  git(context.root, ['config', 'remote.origin.partialclonefilter', 'blob:none']);
  git(context.root, ['config', 'protocol.ext.allow', 'always']);
  const file = ap2Paths[2];
  const blob = git(context.root, ['rev-parse', 'HEAD:' + file]);
  fs.rmSync(path.join(context.root, '.git', 'objects', blob.slice(0, 2), blob.slice(2)));
  // Positive canary: ordinary Git really attempts this harmless local helper.
  // It performs no network action and never returns a replacement object.
  const control = spawnSync('/usr/bin/git', ['show', 'HEAD:' + file], { cwd: context.root,
    encoding: 'utf8', timeout: 3000, env: { PATH: '/usr/bin:/bin', LC_ALL: 'C',
      GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_LAZY_FETCH: '0', GIT_ALLOW_PROTOCOL: 'ext' } });
  assert.notEqual(control.status, 0);
  assert.equal(fs.existsSync(marker), true, control.stderr);
  fs.rmSync(marker);
  const result = ap2Trusted(t, context);
  assert.notEqual(result.status, 0, output(result));
  assert.match(output(result), /API_ONLY_SOURCE_SCOPE:GIT_OBSERVATION_FAILED/u);
  assert.equal(fs.existsSync(marker), false);
});
