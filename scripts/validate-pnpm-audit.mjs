#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical'];

/**
 * Severities that stop a merge.
 *
 * Was 'critical' alone. Extended to 'high' because ASVS 5.0 V15.1.1 asks for a
 * documented remediation time frame and V15.2.1 asks that components respect
 * it - and a time frame nothing enforces is a statement of intent, not a
 * control. Measured on the production graph before tightening: 0 critical,
 * 0 high, 16 moderate, 1 low. Blocking high therefore costs nothing today and
 * makes the written window real from the moment it is written.
 *
 * Moderate and low stay unblocked deliberately: sixteen of them exist, and a
 * policy that fails immediately would be reverted rather than respected. The
 * document says so plainly instead of inventing a window nothing keeps.
 */
const BLOCKING_SEVERITIES = ['critical', 'high'];

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
  for (const severity of BLOCKING_SEVERITIES) {
    const listed = Object.values(advisories).filter((advisory) => advisory?.severity === severity);
    if (listed.length > counts[severity]) {
      throw new Error(
        `pnpm audit report is contradictory: ${severity} advisories exceed metadata count`,
      );
    }
  }

  const totalDependencies = report.metadata?.totalDependencies;
  if (!Number.isInteger(totalDependencies) || totalDependencies < 1) {
    throw new Error('pnpm audit report has an invalid totalDependencies count');
  }

  const blocking = BLOCKING_SEVERITIES.filter((severity) => counts[severity] > 0);
  const accepted = blocking.length === 0;
  const result = {
    accepted,
    policy: 'critical-and-high',
    pnpm_exit_status: rawExitStatus,
    total_dependencies: totalDependencies,
    vulnerabilities: counts,
  };
  if (!accepted) {
    const error = new Error(
      `pnpm audit rejected: ${blocking.map((s) => `${counts[s]} ${s}`).join(', ')} vulnerabilities found`,
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
