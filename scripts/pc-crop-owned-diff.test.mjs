import assert from 'node:assert/strict';
import test from 'node:test';
import {
  globToRegExp,
  selectOwnedFiles,
  validateRegistry,
} from './pc-crop-owned-diff.mjs';

function registry(overrides = {}) {
  return {
    schemaVersion: 'pc-crop.predecessor-workflow-ownership.v1',
    workflows: {
      'PC-CROP-X': {
        workflowPath: '.github/workflows/pc-crop-x.yml',
        scopeStepName: 'Enforce exact PC-CROP-X scope',
        triggerPaths: [
          '.github/workflows/pc-crop-x.yml',
          'apps/api/src/exact.ts',
          'scripts/pc-crop-x/**',
        ],
      },
    },
    ...overrides,
  };
}

test('matches exact files and owned recursive globs only', () => {
  const patterns = [
    '.github/workflows/pc-crop-x.yml',
    'apps/api/src/exact.ts',
    'scripts/pc-crop-x/**',
  ];
  assert.deepEqual(
    selectOwnedFiles([
      'apps/api/src/exact.ts',
      'apps/api/src/successor.ts',
      'scripts/pc-crop-x/a/b.mjs',
      '.github/workflows/other.yml',
    ], patterns),
    ['apps/api/src/exact.ts', 'scripts/pc-crop-x/a/b.mjs'],
  );
});

test('does not let a single star cross a directory boundary', () => {
  const matcher = globToRegExp('apps/*/file.ts');
  assert.equal(matcher.test('apps/api/file.ts'), true);
  assert.equal(matcher.test('apps/api/nested/file.ts'), false);
});

test('normalizes and sorts a valid ownership registry', () => {
  const value = validateRegistry(registry());
  assert.deepEqual(value.workflows['PC-CROP-X'].triggerPaths, [
    '.github/workflows/pc-crop-x.yml',
    'apps/api/src/exact.ts',
    'scripts/pc-crop-x/**',
  ]);
});

test('fails closed when workflow ownership is empty or excludes its workflow file', () => {
  assert.throws(() => validateRegistry(registry({
    workflows: {
      'PC-CROP-X': {
        workflowPath: '.github/workflows/pc-crop-x.yml',
        scopeStepName: 'Enforce exact PC-CROP-X scope',
        triggerPaths: [],
      },
    },
  })), /has no triggerPaths/u);
  assert.throws(() => validateRegistry(registry({
    workflows: {
      'PC-CROP-X': {
        workflowPath: '.github/workflows/pc-crop-x.yml',
        scopeStepName: 'Enforce exact PC-CROP-X scope',
        triggerPaths: ['apps/api/src/exact.ts'],
      },
    },
  })), /does not own its workflow file/u);
});

test('fails closed on duplicate or unsafe patterns', () => {
  assert.throws(() => validateRegistry(registry({
    workflows: {
      'PC-CROP-X': {
        workflowPath: '.github/workflows/pc-crop-x.yml',
        scopeStepName: 'Enforce exact PC-CROP-X scope',
        triggerPaths: [
          '.github/workflows/pc-crop-x.yml',
          '.github/workflows/pc-crop-x.yml',
        ],
      },
    },
  })), /duplicate triggerPaths/u);
  assert.throws(() => globToRegExp('../escape/**'), /unsafe ownership pattern/u);
});
