#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const OUTPUT_PATH = resolve(
  process.env.SECURITY_EVALUATOR_CONTRACT_REPORT
    ?? 'artifacts/security-abuse/security-evaluator-contract.json',
);
const EXACT_HEAD = String(process.env.SECURITY_EXACT_HEAD ?? '').trim();
const EVALUATOR = resolve('docs/platform-v7/autopilot/evaluate-pnpm-audit.mjs');

const fixtures = [
  {
    id: 'clean-report-passes',
    scannerExit: 0,
    expectedExit: 0,
    payload: {
      advisories: {},
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
      },
    },
  },
  {
    id: 'high-advisory-blocks',
    scannerExit: 1,
    expectedExit: 1,
    payload: {
      advisories: {
        'fixture:9001': {
          id: 9001,
          severity: 'high',
          module_name: 'fixture-vulnerable-package',
          title: 'Deliberate HIGH fixture',
          url: 'https://example.invalid/GHSA-fixture',
        },
      },
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 },
      },
    },
  },
  {
    id: 'scanner-failure-blocks',
    scannerExit: 2,
    expectedExit: 1,
    payload: {
      error: {
        code: 'NPM_BULK_AUDIT_FAILURE',
        message: 'Deliberate scanner crash fixture',
      },
    },
  },
];

if (!/^[a-f0-9]{40}$/i.test(EXACT_HEAD)) {
  throw new Error('SECURITY_EXACT_HEAD must be a 40-character commit SHA.');
}

const directory = mkdtempSync(join(tmpdir(), 'pc-security-evaluator-'));
const results = [];
try {
  for (const fixture of fixtures) {
    const auditPath = join(directory, `${fixture.id}-audit.json`);
    const evaluationPath = join(directory, `${fixture.id}-evaluation.json`);
    const stderrPath = join(directory, `${fixture.id}-stderr.txt`);
    writeFileSync(auditPath, `${JSON.stringify(fixture.payload, null, 2)}\n`);
    writeFileSync(stderrPath, 'fixture\n');

    const execution = spawnSync(process.execPath, [EVALUATOR], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        SECURITY_EXACT_HEAD: EXACT_HEAD,
        PNPM_AUDIT_JSON: auditPath,
        PNPM_AUDIT_STDERR: stderrPath,
        PNPM_AUDIT_REPORT: evaluationPath,
        PNPM_AUDIT_EXIT: String(fixture.scannerExit),
      },
    });
    const actualExit = Number.isInteger(execution.status) ? execution.status : 1;
    const evaluation = JSON.parse(readFileSync(evaluationPath, 'utf8'));
    const passed = actualExit === fixture.expectedExit
      && (fixture.expectedExit === 0 ? evaluation.passed === true : evaluation.passed === false);
    results.push({
      id: fixture.id,
      scannerExit: fixture.scannerExit,
      expectedExit: fixture.expectedExit,
      actualExit,
      evaluatorPassedField: evaluation.passed,
      blockedFindingIds: Array.isArray(evaluation.blocked)
        ? evaluation.blocked.map((finding) => finding.findingId)
        : [],
      passed,
    });
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}

const report = {
  schemaVersion: 1,
  repository: 'pachaninm-lab/pachanin-demo',
  commitSha: EXACT_HEAD,
  generatedAt: new Date().toISOString(),
  fixtures: results,
  passed: results.every((result) => result.passed),
};
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

if (!report.passed) {
  console.error('Security evaluator fail-closed contract failed.');
  process.exit(1);
}
console.log('Security evaluator rejects HIGH findings and scanner failures without exceptions.');
