import assert from 'node:assert/strict';
import test from 'node:test';

import { validatePnpmAuditReport } from './validate-pnpm-audit.mjs';

function report(overrides = {}) {
  return {
    advisories: {},
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
      },
      dependencies: 589,
      devDependencies: 0,
      optionalDependencies: 0,
      totalDependencies: 589,
    },
    ...overrides,
  };
}

test('accepts lower-severity findings despite pnpm exit status 1', () => {
  const value = report();
  value.metadata.vulnerabilities.moderate = 9;

  assert.deepEqual(validatePnpmAuditReport(value, { rawExitStatus: 1 }), {
    accepted: true,
    policy: 'critical-only',
    pnpm_exit_status: 1,
    total_dependencies: 589,
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 9,
      high: 0,
      critical: 0,
    },
  });
});

test('rejects critical findings', () => {
  const value = report();
  value.metadata.vulnerabilities.critical = 1;
  value.advisories = {
    '112233': { severity: 'critical' },
  };

  assert.throws(
    () => validatePnpmAuditReport(value, { rawExitStatus: 1 }),
    /1 critical vulnerabilities found/,
  );
});

test('rejects operational error payloads', () => {
  assert.throws(
    () => validatePnpmAuditReport({ error: { code: 'EAI_AGAIN' } }),
    /operational error/,
  );
});

test('rejects reports without governed severity counts', () => {
  assert.throws(
    () => validatePnpmAuditReport({ advisories: {}, metadata: {} }),
    /missing metadata\.vulnerabilities/,
  );
});

test('rejects contradictory critical advisory evidence', () => {
  const value = report({
    advisories: {
      '112233': { severity: 'critical' },
    },
  });

  assert.throws(
    () => validatePnpmAuditReport(value),
    /critical advisories exceed metadata count/,
  );
});

test('rejects malformed counts and exit status', () => {
  const value = report();
  value.metadata.vulnerabilities.high = -1;
  assert.throws(() => validatePnpmAuditReport(value), /non-negative integer/);

  assert.throws(
    () => validatePnpmAuditReport(report(), { rawExitStatus: 'invalid' }),
    /exit status must be an integer/,
  );
});

test('rejects an empty dependency inventory', () => {
  const value = report();
  value.metadata.totalDependencies = 0;
  assert.throws(
    () => validatePnpmAuditReport(value),
    /invalid totalDependencies/,
  );
});
