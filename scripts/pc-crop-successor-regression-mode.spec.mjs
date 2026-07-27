import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCEPTANCE_MODES,
  determineAcceptanceMode,
  globMatches,
} from './pc-crop-successor-regression-mode.mjs';

const ownScope = {
  branch: 'agent/pc-crop-08d-fgis-signing-transport',
};
const successorScope = {
  filePath: 'docs/platform-v7/autopilot/scopes/pc-crop-08h-exchange-receipt.json',
  scope: {
    branch: 'agent/pc-crop-08h-exchange-receipt',
    issue: 3278,
    allowedPaths: [
      'apps/api/prisma/schema.prisma',
      'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-exchange-*.ts',
      'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler.ts',
      'apps/api/test/industrial/**',
    ],
  },
};

test('glob matching is slash-safe and supports exact, star and recursive patterns', () => {
  assert.equal(globMatches('apps/api/prisma/schema.prisma', 'apps/api/prisma/schema.prisma'), true);
  assert.equal(globMatches('apps/api/**', 'apps/api/test/industrial/a.ts'), true);
  assert.equal(globMatches('apps/api/*.ts', 'apps/api/a.ts'), true);
  assert.equal(globMatches('apps/api/*.ts', 'apps/api/test/a.ts'), false);
});

test('no predecessor scope leakage remains exact scope acceptance', () => {
  const result = determineAcceptanceMode({
    slice: 'PC-CROP-08D',
    eventName: 'pull_request',
    headBranch: ownScope.branch,
    ownScope,
    changedFiles: ['apps/api/src/modules/regulatory-integration/fgis-grain/a.ts'],
    outOfScopeFiles: [],
    successorScopes: [],
  });
  assert.equal(result.mode, ACCEPTANCE_MODES.EXACT_SCOPE);
  assert.equal(result.successorScopeFile, null);
});

test('own slice branch fails closed when it leaks out of its narrow scope', () => {
  assert.throws(() => determineAcceptanceMode({
    slice: 'PC-CROP-08D',
    eventName: 'pull_request',
    headBranch: ownScope.branch,
    ownScope,
    changedFiles: ['README.md'],
    outOfScopeFiles: ['README.md'],
    successorScopes: [],
  }), /exact slice branch contains out-of-scope files/u);
});

test('successor PR enters regression mode only with one covering active scope', () => {
  const changedFiles = [
    'apps/api/prisma/schema.prisma',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-exchange.contract.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler.ts',
    'apps/api/test/industrial/fgis-grain-exchange.e2e-spec.ts',
  ];
  const result = determineAcceptanceMode({
    slice: 'PC-CROP-08D',
    eventName: 'pull_request',
    headBranch: successorScope.scope.branch,
    ownScope,
    changedFiles,
    outOfScopeFiles: [changedFiles[0], changedFiles[1], changedFiles[3]],
    successorScopes: [successorScope],
  });
  assert.equal(result.mode, ACCEPTANCE_MODES.SUCCESSOR_REGRESSION);
  assert.equal(result.successorIssue, 3278);
});

test('unknown successor branch fails closed', () => {
  assert.throws(() => determineAcceptanceMode({
    slice: 'PC-CROP-08F',
    eventName: 'pull_request',
    headBranch: 'feature/unregistered',
    ownScope,
    changedFiles: ['apps/api/prisma/schema.prisma', 'README.md'],
    outOfScopeFiles: ['README.md'],
    successorScopes: [],
  }), /exactly one active source-controlled successor scope/u);
});

test('incomplete successor scope fails closed', () => {
  assert.throws(() => determineAcceptanceMode({
    slice: 'PC-CROP-08F',
    eventName: 'pull_request',
    headBranch: successorScope.scope.branch,
    ownScope,
    changedFiles: ['apps/api/prisma/schema.prisma', 'README.md'],
    outOfScopeFiles: ['README.md'],
    successorScopes: [successorScope],
  }), /does not cover changed files/u);
});

test('main push with mixed successor diff is explicit regression acceptance', () => {
  const result = determineAcceptanceMode({
    slice: 'PC-CROP-08F',
    eventName: 'push',
    headBranch: 'main',
    ownScope,
    changedFiles: ['apps/api/prisma/schema.prisma', 'apps/api/new-slice.ts'],
    outOfScopeFiles: ['apps/api/new-slice.ts'],
    successorScopes: [],
  });
  assert.equal(result.mode, ACCEPTANCE_MODES.SUCCESSOR_REGRESSION);
});
