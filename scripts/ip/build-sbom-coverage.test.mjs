import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertKnownGaps,
  classifyCoverage,
  parsePnpmImporters,
  workspacePatternMatches,
} from './build-sbom-coverage.mjs';

test('workspace matching is segment-bounded', () => {
  assert.equal(workspacePatternMatches('packages/domain-core', 'packages/*'), true);
  assert.equal(workspacePatternMatches('packages/domain-core/nested', 'packages/*'), false);
  assert.equal(workspacePatternMatches('apps/api', 'apps/api'), true);
  assert.equal(workspacePatternMatches('apps/landing', 'apps/api'), false);
});

test('pnpm importer parser reads only top-level importer keys', () => {
  const importers = parsePnpmImporters(`lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    devDependencies:\n      vitest:\n        specifier: ^1\n  apps/api:\n    dependencies:\n      express:\n        specifier: ^4\n\npackages:\n  express@4.0.0:\n    resolution: {}\n`);
  assert.deepEqual([...importers], ['.', 'apps/api']);
});

test('current architecture yields one explicit landing gap and no hidden denominator', () => {
  const trackedPaths = [
    'package.json',
    'apps/api/package.json',
    'apps/web/package.json',
    'apps/landing/package.json',
    'apps/tai/pyproject.toml',
    'packages/domain-core/package.json',
    'packages/design-tokens/package.json',
    'packages/integration-sdk/package.json',
    'packages/design-system-v8/package.json',
  ];
  const records = classifyCoverage({
    trackedPaths,
    rootPackage: { workspaces: ['apps/api', 'apps/web', 'packages/*'] },
    pnpmImporters: new Set([
      '.',
      'apps/api',
      'apps/web',
      'packages/domain-core',
      'packages/design-tokens',
      'packages/integration-sdk',
      'packages/design-system-v8',
    ]),
    dedicatedSboms: [{
      manifest: 'apps/tai/pyproject.toml',
      ecosystem: 'python',
      cycloneDx: 'sbom/sbom-tai.cdx.json',
      spdx: 'sbom/sbom-tai.spdx.json',
    }],
  });

  assert.equal(records.length, 9);
  assert.equal(records.filter((record) => record.status === 'COVERED').length, 8);
  assert.deepEqual(records.filter((record) => record.status !== 'COVERED').map((record) => record.manifest), ['apps/landing/package.json']);
  assert.doesNotThrow(() => assertKnownGaps(records, [{
    manifest: 'apps/landing/package.json',
    reason: 'PACKAGE_MANIFEST_OUTSIDE_PNPM_WORKSPACE_OR_DEDICATED_SBOM',
  }]));
});

test('a dedicated SBOM can cover a package manifest without changing workspace metadata', () => {
  const records = classifyCoverage({
    trackedPaths: ['package.json', 'apps/landing/package.json'],
    rootPackage: { workspaces: [] },
    pnpmImporters: new Set(['.']),
    dedicatedSboms: [{
      manifest: 'apps/landing/package.json',
      ecosystem: 'node',
      cycloneDx: 'sbom/sbom-landing.cdx.json',
      spdx: 'sbom/sbom-landing.spdx.json',
    }],
  });

  const landing = records.find((record) => record.manifest === 'apps/landing/package.json');
  assert.equal(landing?.status, 'COVERED');
  assert.equal(landing?.reason, 'DEDICATED_CANONICAL_SBOM_GENERATED');
  assert.deepEqual(landing?.evidence, ['sbom/sbom-landing.cdx.json', 'sbom/sbom-landing.spdx.json']);
});

test('new uncovered manifest fails closed instead of silently lowering coverage', () => {
  const records = classifyCoverage({
    trackedPaths: ['package.json', 'apps/new-service/package.json'],
    rootPackage: { workspaces: [] },
    pnpmImporters: new Set(['.']),
    dedicatedSboms: [],
  });

  assert.throws(
    () => assertKnownGaps(records, []),
    /SBOM coverage scope drift/u,
  );
});

test('stale known gap fails closed after the gap disappears', () => {
  const records = classifyCoverage({
    trackedPaths: ['package.json'],
    rootPackage: { workspaces: [] },
    pnpmImporters: new Set(['.']),
    dedicatedSboms: [],
  });

  assert.throws(
    () => assertKnownGaps(records, [{
      manifest: 'apps/landing/package.json',
      reason: 'PACKAGE_MANIFEST_OUTSIDE_PNPM_WORKSPACE_OR_DEDICATED_SBOM',
    }]),
    /SBOM coverage scope drift/u,
  );
});
