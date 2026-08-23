import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COVERAGE_STATUS,
  classifyComponent,
  declaresNoDependencies,
  ecosystemFor,
  evaluateExclusion,
  isDependencyManifest,
  summarise,
} from './sbom-coverage-model.mjs';
import { pythonComponentOf, thirdPartyImports, toCsv } from './build-sbom-coverage.mjs';

const NODE_SBOM = ['sbom/sbom-node.cdx.json', 'sbom/sbom-node.spdx.json'];

function heldExclusion(reason = 'NOT_RUNTIME') {
  return { reason, authority: 'inventory', conditions: [{ condition: 'not deployed', holds: true, evidence: 'proven' }] };
}

test('a new manifest with no SBOM mapping fails closed', () => {
  const record = classifyComponent({
    component: 'apps/new-service',
    manifest: 'apps/new-service/package.json',
    ecosystem: 'npm',
    dependencyBearing: true,
    coveringSbom: [],
    exclusion: null,
  });
  assert.equal(record.status, COVERAGE_STATUS.UNKNOWN);
  assert.equal(record.reason, 'DEPENDENCY_ROOT_WITHOUT_SBOM_OR_JUSTIFICATION');
  assert.equal(summarise([record]).complete, false);
});

test('an unrecognised ecosystem fails closed rather than being ignored', () => {
  const record = classifyComponent({
    component: 'services/edge',
    manifest: 'services/edge/deps.toml',
    ecosystem: null,
    dependencyBearing: true,
    coveringSbom: [],
    exclusion: heldExclusion(),
  });
  assert.equal(record.status, COVERAGE_STATUS.UNKNOWN);
  assert.equal(record.reason, 'UNRECOGNISED_ECOSYSTEM');
});

test('a runtime component without an SBOM is never counted as covered', () => {
  const report = summarise([
    classifyComponent({ component: 'apps/api', manifest: 'apps/api/package.json', ecosystem: 'npm', dependencyBearing: true, coveringSbom: NODE_SBOM }),
    classifyComponent({ component: 'apps/ghost', manifest: 'apps/ghost/package.json', ecosystem: 'npm', dependencyBearing: true, coveringSbom: [] }),
  ]);
  assert.equal(report.totals.covered, 1);
  assert.equal(report.totals.unknown, 1);
  assert.equal(report.complete, false);
});

test('a justified non-runtime exclusion is permitted', () => {
  const record = classifyComponent({
    component: 'apps/ml',
    manifest: null,
    ecosystem: 'python',
    dependencyBearing: true,
    coveringSbom: [],
    exclusion: heldExclusion('DECLARED_NOT_DEPLOYABLE_OPTIONAL_RUNTIME'),
  });
  assert.equal(record.status, COVERAGE_STATUS.NOT_RUNTIME_WITH_JUSTIFICATION);
  assert.equal(summarise([record]).complete, true);
});

test('an exclusion collapses as soon as one of its conditions stops holding', () => {
  const record = classifyComponent({
    component: 'apps/ml',
    manifest: null,
    ecosystem: 'python',
    dependencyBearing: true,
    coveringSbom: [],
    exclusion: {
      reason: 'NOT_RUNTIME',
      authority: 'inventory',
      conditions: [
        { condition: 'not deployed', holds: true, evidence: 'proven' },
        { condition: 'no container image', holds: false, evidence: 'Dockerfile.ml appeared' },
      ],
    },
  });
  assert.equal(record.status, COVERAGE_STATUS.UNKNOWN);
  assert.equal(record.reason, 'EXCLUSION_CONDITIONS_NO_LONGER_HOLD');
});

test('an empty condition list is not a justification', () => {
  assert.equal(evaluateExclusion([]).satisfied, false);
  assert.equal(evaluateExclusion(undefined).satisfied, false);
});

test('completeness cannot be claimed while anything is uncovered', () => {
  const report = summarise([
    classifyComponent({ component: 'a', manifest: 'a/package.json', ecosystem: 'npm', dependencyBearing: true, coveringSbom: NODE_SBOM }),
    classifyComponent({ component: 'b', manifest: 'b/package.json', ecosystem: 'npm', dependencyBearing: true, coveringSbom: [] }),
  ]);
  assert.ok(report.totals.coveragePercent < 100);
  assert.equal(report.complete, false);
  assert.equal(report.totals.uncovered, 1);
});

test('a rounded percentage can never stand in for completeness', () => {
  const records = Array.from({ length: 10000 }, (_, index) => classifyComponent({
    component: `c${index}`,
    manifest: `c${index}/package.json`,
    ecosystem: 'npm',
    dependencyBearing: true,
    coveringSbom: index === 0 ? [] : NODE_SBOM,
  }));
  const report = summarise(records);
  assert.equal(report.totals.coveragePercent, 99.99);
  assert.equal(report.complete, false, 'one uncovered root must block completeness however small the fraction');
});

test('a manifest declaring no dependencies has nothing to cover', () => {
  assert.equal(declaresNoDependencies({ name: 'x', private: true }), true);
  assert.equal(declaresNoDependencies({ dependencies: {}, devDependencies: {} }), true);
  assert.equal(declaresNoDependencies({ dependencies: { next: '14.2.35' } }), false);
  const record = classifyComponent({ component: 'packages/domain-core', manifest: 'packages/domain-core/package.json', ecosystem: 'npm', dependencyBearing: false, coveringSbom: [] });
  assert.equal(record.status, COVERAGE_STATUS.RUNTIME_COVERED);
  assert.equal(record.reason, 'NO_DECLARED_DEPENDENCIES');
});

test('evidence is deterministic and ordered by component', () => {
  const build = () => summarise([
    classifyComponent({ component: 'zeta', manifest: 'zeta/package.json', ecosystem: 'npm', dependencyBearing: true, coveringSbom: [...NODE_SBOM].reverse() }),
    classifyComponent({ component: 'alpha', manifest: 'alpha/package.json', ecosystem: 'npm', dependencyBearing: true, coveringSbom: NODE_SBOM }),
  ]);
  const first = build();
  const second = build();
  assert.deepEqual(first, second);
  assert.deepEqual(first.records.map((r) => r.component), ['alpha', 'zeta']);
  assert.deepEqual(first.records[1].coveringSbom, NODE_SBOM, 'covering artifacts are sorted, not source-ordered');
});

test('the CSV binds every row to the exact source SHA', () => {
  const sha = 'a'.repeat(40);
  const report = summarise([
    classifyComponent({ component: 'apps/api', manifest: 'apps/api/package.json', ecosystem: 'npm', dependencyBearing: true, coveringSbom: NODE_SBOM }),
  ]);
  const csv = toCsv(report, sha);
  const [header, row] = csv.trim().split('\n');
  assert.equal(header.split(',')[0], 'source_sha');
  assert.ok(row.startsWith(`${sha},apps/api,`));
});

test('ecosystem detection spans more than npm and pyproject', () => {
  assert.equal(ecosystemFor('go.mod'), 'go');
  assert.equal(ecosystemFor('svc/Cargo.toml'), 'rust');
  assert.equal(ecosystemFor('svc/requirements-dev.txt'), 'python');
  assert.equal(ecosystemFor('svc/pom.xml'), 'maven');
  assert.equal(ecosystemFor('svc/App.csproj'), 'nuget');
  assert.equal(ecosystemFor('README.md'), null);
  assert.ok(isDependencyManifest('apps/api/package.json'));
  assert.ok(!isDependencyManifest('apps/api/tsconfig.json'));
});

test('third-party imports exclude stdlib and sibling first-party modules', () => {
  const sources = [
    { path: 'apps/ml/main.py', text: 'import os\nimport logging\nfrom fastapi import FastAPI\nfrom routers import health\n' },
    { path: 'apps/ml/routers/health.py', text: 'import psycopg2\n' },
  ];
  assert.deepEqual(thirdPartyImports(sources), ['fastapi', 'psycopg2']);
});

test('a component is a directory, not each individual file', () => {
  assert.equal(pythonComponentOf('scripts/a.py'), 'scripts');
  assert.equal(pythonComponentOf('scripts/nested/b.py'), 'scripts');
  assert.equal(pythonComponentOf('apps/ml/main.py'), 'apps/ml');
  assert.equal(pythonComponentOf('apps/ml/routers/health.py'), 'apps/ml');
});
