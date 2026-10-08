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
    policy: 'critical-and-high',
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

test('rejects high findings, which the earlier critical-only policy accepted', () => {
  // ASVS 5.0 V15.1.1 asks for a documented remediation window and V15.2.1 asks
  // that components respect it. A window nothing enforces is a statement of
  // intent. Measured on the production graph before tightening: 0 critical,
  // 0 high, 16 moderate, 1 low - so blocking high cost nothing on the day it
  // was written.
  const value = report();
  value.metadata.vulnerabilities.high = 2;
  value.advisories = { 445566: { severity: 'high' } };

  assert.throws(
    () => validatePnpmAuditReport(value, { rawExitStatus: 1 }),
    /2 high vulnerabilities found/,
  );
});

test('moderate and low stay unblocked, and the policy says so rather than pretending', () => {
  const value = report();
  value.metadata.vulnerabilities.moderate = 16;
  value.metadata.vulnerabilities.low = 1;

  const result = validatePnpmAuditReport(value, { rawExitStatus: 1 });
  assert.equal(result.accepted, true);
  assert.equal(result.vulnerabilities.moderate, 16);
});

test('a contradictory high count is rejected the same way a critical one is', () => {
  const value = report();
  value.metadata.vulnerabilities.high = 0;
  value.advisories = { 778899: { severity: 'high' } };

  assert.throws(
    () => validatePnpmAuditReport(value, { rawExitStatus: 1 }),
    /high advisories exceed metadata count/,
  );
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
