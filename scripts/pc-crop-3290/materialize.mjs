import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function read(file) {
  return readFileSync(file, 'utf8');
}

function write(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

function replaceExact(content, needle, replacement, expected, label) {
  const count = content.split(needle).length - 1;
  if (count !== expected) {
    throw new Error(`${label}: expected ${expected} occurrences, found ${count}`);
  }
  return content.replaceAll(needle, replacement);
}

function removeYamlPath(content, path, expected = 2) {
  return replaceExact(
    content,
    `      - '${path}'\n`,
    '',
    expected,
    `remove YAML trigger ${path}`,
  );
}

function removeJsPath(content, path) {
  return replaceExact(
    content,
    `    '${path}',\n`,
    '',
    1,
    `remove governance path ${path}`,
  );
}

const dispatchShared = [
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler.spec.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler.ts',
  'apps/api/test/industrial/fgis-grain-dispatch.e2e-spec.ts',
];
const projectionShared = [
  'apps/api/prisma/schema.prisma',
  'apps/api/src/modules/regulatory-integration/regulatory-integration.module.ts',
];

const workflow08d = '.github/workflows/pc-crop-08d.yml';
let content08d = read(workflow08d);
for (const path of dispatchShared) content08d = removeYamlPath(content08d, path);
write(workflow08d, content08d);

const workflow08f = '.github/workflows/pc-crop-08f.yml';
let content08f = read(workflow08f);
for (const path of projectionShared) content08f = removeYamlPath(content08f, path);
write(workflow08f, content08f);

const predecessorScript = 'scripts/pc-crop-predecessor-trigger-governance.mjs';
let predecessor = read(predecessorScript);
for (const path of dispatchShared) predecessor = removeJsPath(predecessor, path);
write(predecessorScript, predecessor);

const contractPath = 'scripts/pc-crop-successor-trigger-governance.mjs';
write(contractPath, `#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const EVIDENCE_DIR = process.env.EVIDENCE_DIR || 'artifacts/pc-crop-predecessor-trigger-governance';
const files = {
  d: '.github/workflows/pc-crop-08d.yml',
  f: '.github/workflows/pc-crop-08f.yml',
  h: '.github/workflows/pc-crop-08h.yml',
};
const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

function onBlock(content, file) {
  const start = content.indexOf('\\non:\\n');
  const end = content.indexOf('\\npermissions:\\n');
  if (start < 0 || end <= start) throw new Error(\\`\\${file}: on/permissions boundaries are missing\\`);
  return content.slice(start + 1, end);
}

function tail(content, file) {
  const end = content.indexOf('\\npermissions:\\n');
  if (end < 0) throw new Error(\\`\\${file}: permissions boundary is missing\\`);
  return content.slice(end + 1);
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function requireCount(haystack, needle, expected, label) {
  const actual = count(haystack, needle);
  if (actual !== expected) throw new Error(\\`\\${label}: expected \\${expected}, actual \\${actual}\\`);
}

const triggers = Object.fromEntries(Object.entries(source).map(([key, content]) => [key, onBlock(content, files[key])]));
const tails = Object.fromEntries(Object.entries(source).map(([key, content]) => [key, tail(content, files[key])]));

const dispatchShared = ${JSON.stringify(dispatchShared, null, 2)};
const projectionShared = ${JSON.stringify(projectionShared, null, 2)};
const dOwned = [
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.contract.spec.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.contract.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.fail-closed.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.signing-policy.generated.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-dispatch.repository.ts',
  'docs/platform-v7/autopilot/scopes/pc-crop-08d-fgis-signing-transport.json',
  'docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.signing-policy.json',
  'docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.signing-policy.lock.json',
  'scripts/pc-crop-08d/**',
];
const fOwned = [
  '.github/workflows/pc-crop-08f.yml',
  'apps/api/prisma/migrations/20260724190000_fgis_grain_sdiz_projection/**',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-*.ts',
  'apps/api/test/industrial/fgis-grain-sdiz-projection.e2e-spec.ts',
  'docs/platform-v7/autopilot/scopes/pc-crop-08f-sdiz-projection.json',
  'scripts/pc-crop-08f/**',
];

for (const path of dispatchShared) {
  requireCount(triggers.d, path, 0, \\`08D predecessor trigger handoff for \\${path}\\`);
  requireCount(triggers.h, path, 2, \\`08H successor ownership for \\${path}\\`);
}
for (const path of projectionShared) {
  requireCount(triggers.f, path, 0, \\`08F predecessor trigger handoff for \\${path}\\`);
  requireCount(triggers.h, path, 2, \\`08H successor ownership for \\${path}\\`);
}
for (const path of dOwned) requireCount(triggers.d, path, 2, \\`08D retained trigger \\${path}\\`);
for (const path of fOwned) requireCount(triggers.f, path, 2, \\`08F retained trigger \\${path}\\`);

for (const [key, content] of Object.entries(tails)) {
  if (/continue-on-error\\s*:/u.test(content)) throw new Error(\\`\\${files[key]}: continue-on-error is forbidden\\`);
}
requireCount(tails.d, 'fgis-grain-outbox-dispatch.handler.spec.ts', 1, '08D dispatch unit regression retained');
requireCount(tails.d, 'test/industrial/fgis-grain-dispatch.e2e-spec.ts', 1, '08D PostgreSQL dispatch regression retained');
requireCount(tails.f, 'fgis-grain-sdiz-projection.contract.spec.ts', 1, '08F SDIZ contract regression retained');
requireCount(tails.f, 'test/industrial/fgis-grain-sdiz-projection.e2e-spec.ts', 1, '08F PostgreSQL SDIZ regression retained');
requireCount(tails.h, 'fgis-grain-outbox-dispatch.handler.spec.ts', 1, '08H transferred dispatch unit regression present');
requireCount(tails.h, 'test/industrial/fgis-grain-dispatch.e2e-spec.ts', 1, '08H transferred dispatch PostgreSQL regression present');

const predecessor = readFileSync('scripts/pc-crop-predecessor-trigger-governance.mjs', 'utf8');
for (const path of dispatchShared) requireCount(predecessor, \\`    '\\${path}',\\`, 0, \\`canonical predecessor map excludes \\${path}\\`);

const report = {
  schemaVersion: 'pc-crop.successor-trigger-handoff-acceptance.v1',
  issue: 3290,
  exactHead: process.env.GITHUB_SHA || 'LOCAL',
  status: 'PASS',
  invariants: {
    dispatchSharedPathsOwnedBy08H: true,
    projectionSharedPathsOwnedBy08H: true,
    predecessorSpecificTriggersRetained: true,
    predecessorRegressionJobsRetained: true,
    noContinueOnError: true,
    canonicalApplyMapUpdated: true,
  },
  boundaries: {
    runtimeProductMutation: false,
    acceptanceWeakening: false,
    securityException: false,
    productionDeployment: false,
  },
  operationalStatus: 'NOT_ATTESTED',
  productionHosting: 'REG_RU_VPS_ONLY',
  failures: [],
};
mkdirSync(EVIDENCE_DIR, { recursive: true });
writeFileSync(\\`\\${EVIDENCE_DIR}/successor-trigger-handoff.json\\`, \\`\\${JSON.stringify(report, null, 2)}\\n\\`, 'utf8');
process.stdout.write(\\`\\${JSON.stringify(report)}\\n\\`);
`);

const governanceWorkflow = '.github/workflows/pc-crop-predecessor-trigger-governance.yml';
let governance = read(governanceWorkflow);
governance = replaceExact(
  governance,
  "      - '.github/workflows/pc-crop-08d.yml'\n",
  "      - '.github/workflows/pc-crop-08d.yml'\n      - '.github/workflows/pc-crop-08f.yml'\n",
  1,
  'add 08F governance trigger',
);
governance = replaceExact(
  governance,
  "      - 'docs/platform-v7/autopilot/scopes/pc-crop-predecessor-trigger-isolation-3170.json'\n",
  "      - 'docs/platform-v7/autopilot/scopes/pc-crop-predecessor-trigger-isolation-3170.json'\n      - 'docs/platform-v7/autopilot/scopes/pc-crop-successor-trigger-handoff-3290.json'\n",
  1,
  'add successor handoff scope trigger',
);
governance = replaceExact(
  governance,
  "      - 'scripts/pc-crop-predecessor-trigger-governance.mjs'\n",
  "      - 'scripts/pc-crop-predecessor-trigger-governance.mjs'\n      - 'scripts/pc-crop-successor-trigger-governance.mjs'\n",
  1,
  'add successor governance script trigger',
);
governance = replaceExact(
  governance,
  "      - name: Apply idempotent trigger isolation and verify immutable jobs\n        run: node scripts/pc-crop-predecessor-trigger-governance.mjs --apply\n",
  "      - name: Apply canonical predecessor triggers\n        run: node scripts/pc-crop-predecessor-trigger-governance.mjs --apply\n\n      - name: Prove successor trigger handoff contract\n        run: node scripts/pc-crop-successor-trigger-governance.mjs\n",
  1,
  'add successor handoff contract step',
);
governance = replaceExact(
  governance,
  "          test -f docs/platform-v7/autopilot/pc-crop-predecessor-trigger-lock.json\n",
  "          test -f docs/platform-v7/autopilot/pc-crop-predecessor-trigger-lock.json\n          test ! -s \"$EVIDENCE_DIR/working-tree-files.txt\"\n",
  1,
  'enforce idempotent clean working tree',
);
governance = replaceExact(
  governance,
  "            .github/workflows/pc-crop-08d.yml\n",
  "            .github/workflows/pc-crop-08d.yml\n            .github/workflows/pc-crop-08f.yml\n",
  1,
  'upload 08F governed workflow',
);
write(governanceWorkflow, governance);

const scopePath = 'docs/platform-v7/autopilot/scopes/pc-crop-successor-trigger-handoff-3290.json';
write(scopePath, `${JSON.stringify({
  schemaVersion: 'platform-v7.concurrent-scope.v1',
  branch: 'fix/pc-crop-successor-trigger-handoff-3290',
  status: 'active',
  issue: 3290,
  baseCommit: '1af525d5ce0cc6663a510f788ab9ee3a36ff9c65',
  operationalStatus: 'NOT_ATTESTED',
  allowedPaths: [
    '.github/workflows/pc-crop-08d.yml',
    '.github/workflows/pc-crop-08f.yml',
    '.github/workflows/pc-crop-predecessor-trigger-governance.yml',
    'docs/platform-v7/autopilot/scopes/pc-crop-successor-trigger-handoff-3290.json',
    'scripts/pc-crop-predecessor-trigger-governance.mjs',
    'scripts/pc-crop-successor-trigger-governance.mjs',
  ],
  boundaries: {
    runtimeProductMutation: false,
    acceptanceWeakening: false,
    securityException: false,
    requiredTestRemoval: false,
    productionDeployment: false,
  },
  productionHosting: 'REG_RU_VPS_ONLY',
}, null, 2)}\n`);

rmSync('scripts/pc-crop-3290', { recursive: true, force: true });
rmSync('.github/workflows/pc-crop-3290-materialize.yml', { force: true });
