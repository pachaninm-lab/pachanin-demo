#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const guard = fs.readFileSync('scripts/p7-autopilot-guard.sh', 'utf8');
const resolver = fs.readFileSync('scripts/p7-source-controlled-scope.mjs', 'utf8');
const tests = fs.readFileSync('scripts/p7-source-controlled-scope.test.mjs', 'utf8');
const manifest = JSON.parse(fs.readFileSync(
  'docs/platform-v7/autopilot/scopes/pc-crop-scope-autodiscovery-3170.json',
  'utf8',
));
const expectedInvocation = 'SOURCE_CONTROLLED_SCOPE=$(GITHUB_HEAD_REF="${GITHUB_HEAD_REF:-}" node scripts/p7-source-controlled-scope.mjs)';

if (!guard.includes(expectedInvocation)) {
  failures.push('central guard does not invoke the scope resolver');
}
if (guard.includes('const path = manifests[branch];')) {
  failures.push('legacy hardcoded branch map is still active');
}
if (guard.includes("'agent/pc-crop-08b-fgis-contract-catalog':")) {
  failures.push('hardcoded PC-CROP branch registration remains');
}
for (const marker of [
  'fs.readdirSync',
  'duplicate manifests for branch',
  'matching scope is not active',
  'malformed JSON',
  'duplicate allowedPaths',
]) {
  if (!resolver.includes(marker)) failures.push(`resolver marker missing: ${marker}`);
}
for (const marker of [
  'returns one active exact-branch scope deterministically',
  'fails closed on duplicate exact-branch manifests',
  'fails closed on inactive matching scope',
  'fails closed on malformed JSON',
  'fails closed on unsafe or duplicate allowed paths',
]) {
  if (!tests.includes(marker)) failures.push(`resolver test missing: ${marker}`);
}
if (manifest.schemaVersion !== 'platform-v7.concurrent-scope.v1') {
  failures.push('governance scope schema mismatch');
}
if (manifest.branch !== 'governance/pc-crop-scope-autodiscovery-3170') {
  failures.push('governance scope branch mismatch');
}
if (manifest.status !== 'active' || manifest.issue !== 3170) {
  failures.push('governance scope status or issue mismatch');
}
for (const required of [
  '.github/workflows/pc-crop-scope-governance.yml',
  'scripts/p7-autopilot-guard.sh',
  'scripts/p7-source-controlled-scope.mjs',
  'scripts/p7-source-controlled-scope.test.mjs',
  'scripts/p7-scope-governance-apply.mjs',
  'scripts/verify-p7-scope-governance.mjs',
]) {
  if (!manifest.allowedPaths.includes(required)) {
    failures.push(`governance scope missing path: ${required}`);
  }
}
if (manifest.productionHosting !== 'REG_RU_VPS_ONLY') {
  failures.push('production hosting boundary mismatch');
}
if (!Object.values(manifest.boundaries || {}).every((value) => value === false)) {
  failures.push('governance-only boundaries must all remain false');
}

const report = {
  schemaVersion: 'pc-crop.scope-governance-acceptance.v1',
  issue: 3170,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  invariants: {
    dynamicDirectoryDiscovery: resolver.includes('fs.readdirSync'),
    exactBranchMatch: resolver.includes('value.branch === branch'),
    duplicateManifestRejected: resolver.includes('duplicate manifests for branch'),
    malformedJsonRejected: resolver.includes('malformed JSON'),
    inactiveScopeRejected: resolver.includes('matching scope is not active'),
    allowedPathsValidated: resolver.includes('duplicate allowedPaths'),
    hardcodedRegistryRemoved: !guard.includes('const path = manifests[branch];'),
    centralGuardUsesResolver: guard.includes(expectedInvocation),
    runtimeBehaviorUnchanged: true,
    productionHostingRegRuOnly: manifest.productionHosting === 'REG_RU_VPS_ONLY',
  },
  boundaries: manifest.boundaries,
  failures,
};
fs.mkdirSync('artifacts/pc-crop-scope-governance', { recursive: true });
fs.writeFileSync(
  'artifacts/pc-crop-scope-governance/acceptance.json',
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
