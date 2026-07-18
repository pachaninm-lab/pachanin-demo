#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical'];

export function validatePnpmAuditReport(report, options = {}) {
  const rawExitStatus = normalizeExitStatus(options.rawExitStatus ?? 0);
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('pnpm audit report must be a JSON object');
  }
  if (Object.hasOwn(report, 'error')) {
    throw new Error(`pnpm audit returned an operational error: ${stringifyError(report.error)}`);
  }

  const vulnerabilities = report.metadata?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== 'object' || Array.isArray(vulnerabilities)) {
    throw new Error('pnpm audit report is missing metadata.vulnerabilities');
  }

  const counts = {};
  for (const severity of SEVERITIES) {
    const value = vulnerabilities[severity];
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`pnpm audit ${severity} count must be a non-negative integer`);
    }
    counts[severity] = value;
  }

  const advisories = report.advisories ?? {};
  if (!advisories || typeof advisories !== 'object' || Array.isArray(advisories)) {
    throw new Error('pnpm audit advisories must be an object');
  }
  const criticalAdvisories = Object.values(advisories).filter(
    (advisory) => advisory?.severity === 'critical',
  );
  if (criticalAdvisories.length > counts.critical) {
    throw new Error(
      'pnpm audit report is contradictory: critical advisories exceed metadata count',
    );
  }

  const totalDependencies = report.metadata?.totalDependencies;
  if (!Number.isInteger(totalDependencies) || totalDependencies < 1) {
    throw new Error('pnpm audit report has an invalid totalDependencies count');
  }

  const accepted = counts.critical === 0;
  const result = {
    accepted,
    policy: 'critical-only',
    pnpm_exit_status: rawExitStatus,
    total_dependencies: totalDependencies,
    vulnerabilities: counts,
  };
  if (!accepted) {
    const error = new Error(
      `pnpm audit rejected: ${counts.critical} critical vulnerabilities found`,
    );
    error.policyResult = result;
    throw error;
  }
  return result;
}

function normalizeExitStatus(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) {
    throw new Error('pnpm audit exit status must be an integer between 0 and 255');
  }
  return parsed;
}

function stringifyError(value) {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isDirectInvocation() {
  if (!process.argv[1]) {
    return false;
  }
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

function main() {
  const reportPath = process.argv[2];
  const rawExitStatus = process.argv[3] ?? '0';
  if (!reportPath) {
    throw new Error(
      'usage: node scripts/validate-pnpm-audit.mjs <report.json> [raw-exit-status]',
    );
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  try {
    const result = validatePnpmAuditReport(report, { rawExitStatus });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    if (error?.policyResult) {
      process.stdout.write(`${JSON.stringify(error.policyResult, null, 2)}\n`);
    }
    throw error;
  }
}

if (isDirectInvocation()) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
