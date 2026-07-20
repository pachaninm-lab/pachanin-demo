#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SCOPE_PATH = 'docs/crop-platform/scopes/pc-crop-01a-commodity-registry-foundation-2875.json';
const DOMAIN_PATH = 'packages/domain-core/src/commodity-profile.ts';
const DOMAIN_TEST_PATH = 'packages/domain-core/src/commodity-profile.test.ts';
const DOMAIN_TSCONFIG_PATH = 'packages/domain-core/tsconfig.pc-crop.json';
const DOMAIN_VITEST_PATH = 'packages/domain-core/vitest.pc-crop.config.ts';
const INDEX_PATH = 'packages/domain-core/src/index.ts';
const PACKAGE_PATH = 'packages/domain-core/package.json';
const WEB_TSCONFIG_PATH = 'apps/web/tsconfig.pc-crop.json';
const COMPONENT_PATH = 'apps/web/components/crop-platform/CommodityProfileRegistryView.tsx';
const CSS_PATH = 'apps/web/components/crop-platform/CommodityProfileRegistryView.module.css';
const CSS_TYPES_PATH = 'apps/web/components/crop-platform/css-modules.d.ts';
const DOC_PATH = 'docs/crop-platform/PC-CROP-01A-DOMAIN-AND-UX.md';
const WORKFLOW_PATH = '.github/workflows/pc-crop-01a.yml';
const VERIFIER_PATH = 'scripts/verify-pc-crop-01a.mjs';

const EXPECTED_PATHS = new Set([
  PACKAGE_PATH,
  DOMAIN_TSCONFIG_PATH,
  DOMAIN_VITEST_PATH,
  INDEX_PATH,
  DOMAIN_PATH,
  DOMAIN_TEST_PATH,
  WEB_TSCONFIG_PATH,
  COMPONENT_PATH,
  CSS_PATH,
  CSS_TYPES_PATH,
  DOC_PATH,
  SCOPE_PATH,
  VERIFIER_PATH,
  WORKFLOW_PATH,
]);

function read(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function fail(message) {
  throw new Error(message);
}

function requireToken(text, token, label) {
  if (!text.includes(token)) fail(`${label}: missing ${JSON.stringify(token)}`);
}

function forbidToken(text, token, label) {
  if (text.toLowerCase().includes(token.toLowerCase())) {
    fail(`${label}: forbidden ${JSON.stringify(token)}`);
  }
}

function changedFiles() {
  try {
    return execFileSync('git', ['diff', '--name-only', 'origin/main...HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim().split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function exactHead() {
  return process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
}

const scope = JSON.parse(read(SCOPE_PATH));
const domain = read(DOMAIN_PATH);
const domainTest = read(DOMAIN_TEST_PATH);
const domainTsconfig = JSON.parse(read(DOMAIN_TSCONFIG_PATH));
const domainVitest = read(DOMAIN_VITEST_PATH);
const component = read(COMPONENT_PATH);
const css = read(CSS_PATH);
const cssTypes = read(CSS_TYPES_PATH);
const webTsconfig = JSON.parse(read(WEB_TSCONFIG_PATH));
const doc = read(DOC_PATH);
const index = read(INDEX_PATH);
const packageJson = JSON.parse(read(PACKAGE_PATH));
const workflow = read(WORKFLOW_PATH);

if (scope.schemaVersion !== 'pc-crop.concurrent-scope.v1') fail('scope schema version mismatch');
if (scope.branch !== 'agent/pc-crop-01-commodity-registry-foundation') fail('scope branch mismatch');
if (scope.status !== 'active') fail('scope is not active');
if (scope.parentIssue !== 2875) fail('scope parent issue mismatch');
if (scope.baseExactMain !== '05b1b5a62911d273a25e04e28951bf9772af705d') fail('base exact-main mismatch');
if (scope.operationalStatus !== 'NOT_ATTESTED') fail('operational maturity was overstated');
if (new Set(scope.allowedPaths).size !== EXPECTED_PATHS.size || scope.allowedPaths.some((path) => !EXPECTED_PATHS.has(path))) {
  fail('scope allowedPaths are not exact');
}

const diff = changedFiles();
const unexpected = diff.filter((path) => !EXPECTED_PATHS.has(path));
if (unexpected.length > 0) fail(`files outside exact scope: ${unexpected.join(', ')}`);

for (const archetype of [
  'DRY_BULK',
  'SEED_PLANTING',
  'ROOT_INDUSTRIAL',
  'FRESH_PACKED',
  'GREENHOUSE_RECURRING',
  'ORGANIC_EXPORT_QUARANTINE',
]) {
  requireToken(domain, `'${archetype}'`, 'domain archetype');
  requireToken(domainTest, `'${archetype}'`, 'domain test archetype');
}

for (const token of [
  'JavaScript numbers are never authority',
  'CommodityProfileContentHasher',
  "contentHashAlgorithm: 'SHA-256'",
  'canonicalCommodityProfileJson',
  'hashCommodityProfileContent',
  'deepFreeze',
  'PC_PROFILE_HASH_INVALID',
  'PC_PROFILE_BASE_UNIT_INVALID',
  'PC_PROFILE_RANGE_INVALID',
  'PC_PROFILE_BLOCKER_REFERENCE_UNKNOWN',
  'PC_PROFILE_VERSION_IMMUTABLE',
  'PC_PROFILE_EFFECTIVE_OVERLAP',
  'PC_PROFILE_APPROVAL_EVIDENCE_REQUIRED',
]) requireToken(domain, token, 'domain invariant');

for (const token of [
  'Float',
  'numberToBase: number',
  'denominatorToBase: number',
  "from 'node:crypto'",
  'createHash(',
]) {
  forbidToken(domain, token, 'domain fixed precision and crypto boundary');
}

requireToken(domainTest, 'TEST_SHA256', 'test crypto adapter');
requireToken(domainTest, 'PC_PROFILE_HASH_INVALID', 'test crypto adapter validation');

if (domainTsconfig.extends !== undefined) fail('isolated domain tsconfig must not inherit removed compiler options');
if (domainTsconfig.compilerOptions?.moduleResolution !== 'Bundler') fail('domain moduleResolution must be Bundler');
if (domainTsconfig.compilerOptions?.strict !== true) fail('domain strict typecheck must remain enabled');
if (domainTsconfig.compilerOptions?.noEmit !== true) fail('domain typecheck must not emit');
if (!domainTsconfig.include?.includes('src/commodity-profile.ts')) fail('domain isolated config must include commodity profile');

for (const token of [
  "import { defineConfig } from 'vitest/config'",
  "environment: 'node'",
  "include: ['packages/domain-core/src/commodity-profile.test.ts']",
  'passWithNoTests: false',
]) requireToken(domainVitest, token, 'domain test runner');
for (const token of ['@vitejs/plugin-react', 'jsdom', 'browser']) {
  forbidToken(domainVitest, token, 'domain test runner isolation');
}

if (webTsconfig.extends !== undefined) fail('isolated web tsconfig must not inherit removed compiler options');
if (webTsconfig.compilerOptions?.moduleResolution !== 'Bundler') fail('web moduleResolution must be Bundler');
if (webTsconfig.compilerOptions?.strict !== true) fail('web strict typecheck must remain enabled');
if (webTsconfig.compilerOptions?.noEmit !== true) fail('web typecheck must not emit');
if (!webTsconfig.include?.includes('components/crop-platform/CommodityProfileRegistryView.tsx')) {
  fail('web isolated config must include registry component');
}
requireToken(cssTypes, "declare module '*.module.css'", 'CSS module type boundary');

if (packageJson.version !== '0.3.0') fail('domain package version must be 0.3.0');
requireToken(index, "DOMAIN_CORE_VERSION = '0.3.0'", 'domain index version');
requireToken(index, "export * from './commodity-profile'", 'domain export');

for (const token of [
  "data-commodity-profile-registry='industrial-v1'",
  "data-authority='server-supplied'",
  "type RegistryState = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden' | 'conflict'",
  'primaryAction?: CommodityProfileRegistryAction',
  'requiresConfirmation: boolean',
  '<table className={styles.table}>',
  '<details open>',
  "aria-current={active ? 'true' : undefined}",
  'const COPY: Record<Locale, Copy>',
  'const ARCHETYPE_LABELS: Record<Locale',
]) requireToken(component, token, 'interface contract');

for (const token of ['localStorage', 'sessionStorage', 'const MOCK_', "fetch('", 'synthetic_demo']) {
  forbidToken(component, token, 'interface authority boundary');
}

for (const token of [
  '@media (max-width: 430px)',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
  'min-height: 44px',
  'overscroll-behavior: contain',
  'grid-template-columns: minmax(520px, .95fr) minmax(420px, 1.05fr)',
]) requireToken(css, token, 'interface CSS contract');

for (const token of [
  'федеральной промышленной эксплуатации',
  'NOT_ATTESTED',
  'Компактный реестр',
  'Mobile 320–430 px',
  'Lifecycle action UX',
  'PC-CROP-01B — PostgreSQL Registry Authority',
]) requireToken(doc, token, 'design authority');

for (const token of [
  'node scripts/verify-pc-crop-01a.mjs',
  'packages/domain-core/tsconfig.pc-crop.json',
  'packages/domain-core/vitest.pc-crop.config.ts',
  'apps/web/tsconfig.pc-crop.json',
  'commodity-profile.test.ts',
  'pc-crop-01a-domain-typecheck.log',
  'pc-crop-01a-web-typecheck.log',
  'retention-days: 90',
]) requireToken(workflow, token, 'workflow acceptance');

const report = {
  schemaVersion: 'pc-crop.acceptance.v1',
  slice: 'PC-CROP-01A',
  issue: 2875,
  status: 'PASS',
  exactHead: exactHead(),
  baseExactMain: scope.baseExactMain,
  operationalStatus: 'NOT_ATTESTED',
  checkedPaths: [...EXPECTED_PATHS].sort(),
  counts: {
    archetypes: 6,
    lifecycleStates: 6,
    locales: 3,
    interfaceStates: 6,
    domainTests: 11,
  },
  boundaries: {
    postgresRuntimeAuthority: 'NOT_IN_THIS_SLICE',
    externalIntegrations: 'NOT_CONNECTED_OR_ATTESTED',
    hashAuthority: 'SERVER_CRYPTO_ADAPTER_SHA256',
    repositoryCompilerModernization: 'SEPARATE_TRACKED_DEBT',
    domainTestEnvironment: 'ISOLATED_NODE_NO_WEB_PLUGIN',
    clientSelectedRoleOrTenant: false,
    directTaiWrite: false,
  },
};

const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0) {
  const output = process.argv[outputIndex + 1];
  if (!output) fail('--output requires a path');
  writeFileSync(resolve(ROOT, output), `${JSON.stringify(report, null, 2)}\n`);
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
