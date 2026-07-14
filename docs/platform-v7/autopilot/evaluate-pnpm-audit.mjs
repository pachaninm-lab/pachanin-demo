#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const AUDIT_PATH = resolve(process.env.PNPM_AUDIT_JSON ?? 'artifacts/security/pnpm-audit.json');
const EXCEPTIONS_PATH = resolve('docs/platform-v7/autopilot/security-exceptions.json');
const REPORT_PATH = resolve(process.env.PNPM_AUDIT_REPORT ?? 'artifacts/security/pnpm-audit-evaluation.json');
const EXACT_HEAD = process.env.SECURITY_EXACT_HEAD ?? '';

function parseJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is missing or invalid JSON at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeSeverity(value) {
  return String(value ?? '').trim().toUpperCase();
}

function collectFindings(audit) {
  const findings = [];
  if (audit?.advisories && typeof audit.advisories === 'object') {
    for (const [key, advisory] of Object.entries(audit.advisories)) {
      findings.push({
        findingId: String(advisory?.id ?? advisory?.github_advisory_id ?? advisory?.cves?.[0] ?? key),
        severity: normalizeSeverity(advisory?.severity),
        package: String(advisory?.module_name ?? advisory?.name ?? 'unknown'),
        title: String(advisory?.title ?? advisory?.overview ?? 'Dependency advisory'),
        url: String(advisory?.url ?? advisory?.recommendation ?? ''),
      });
    }
  }

  if (audit?.vulnerabilities && typeof audit.vulnerabilities === 'object') {
    for (const [packageName, vulnerability] of Object.entries(audit.vulnerabilities)) {
      const via = Array.isArray(vulnerability?.via) ? vulnerability.via : [];
      const objectVia = via.filter((entry) => entry && typeof entry === 'object');
      if (objectVia.length === 0) {
        findings.push({
          findingId: String(vulnerability?.source ?? vulnerability?.name ?? packageName),
          severity: normalizeSeverity(vulnerability?.severity),
          package: packageName,
          title: String(vulnerability?.title ?? 'Dependency vulnerability'),
          url: String(vulnerability?.url ?? ''),
        });
      } else {
        for (const advisory of objectVia) {
          findings.push({
            findingId: String(advisory?.source ?? advisory?.id ?? advisory?.cve ?? advisory?.url ?? packageName),
            severity: normalizeSeverity(advisory?.severity ?? vulnerability?.severity),
            package: packageName,
            title: String(advisory?.title ?? 'Dependency vulnerability'),
            url: String(advisory?.url ?? ''),
          });
        }
      }
    }
  }

  const deduplicated = new Map();
  for (const finding of findings) {
    const key = `${finding.findingId}:${finding.package}:${finding.severity}`;
    if (!deduplicated.has(key)) deduplicated.set(key, finding);
  }
  return [...deduplicated.values()];
}

const audit = parseJson(AUDIT_PATH, 'pnpm audit report');
const registry = parseJson(EXCEPTIONS_PATH, 'security exception registry');
const activeExceptions = new Set(
  (Array.isArray(registry.exceptions) ? registry.exceptions : [])
    .filter((exception) => exception?.scanner === 'pnpm-audit' && new Date(exception?.expiresAt ?? 0).getTime() > Date.now())
    .map((exception) => String(exception.findingId)),
);
const findings = collectFindings(audit).filter((finding) => ['HIGH', 'CRITICAL'].includes(finding.severity));
const blocked = [];
const excepted = [];

for (const finding of findings) {
  if (finding.severity === 'CRITICAL') {
    blocked.push({ ...finding, reason: 'CRITICAL findings cannot be excepted.' });
  } else if (activeExceptions.has(finding.findingId)) {
    excepted.push(finding);
  } else {
    blocked.push({ ...finding, reason: 'HIGH finding has no active formal exception.' });
  }
}

const metadata = audit?.metadata ?? {};
const reportedTotal = metadata?.vulnerabilities
  ? Object.values(metadata.vulnerabilities).reduce((sum, value) => sum + (Number(value) || 0), 0)
  : null;
const report = {
  schemaVersion: 1,
  repository: 'pachaninm-lab/pachanin-demo',
  commitSha: EXACT_HEAD,
  evaluatedAt: new Date().toISOString(),
  scanner: 'pnpm-audit',
  reportedTotal,
  highOrCriticalFindings: findings,
  excepted,
  blocked,
  passed: blocked.length === 0,
};
mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

if (blocked.length > 0) {
  console.error(`pnpm audit blocked the release: ${blocked.length} HIGH/CRITICAL finding(s).`);
  for (const finding of blocked) {
    console.error(`- ${finding.severity} ${finding.findingId} ${finding.package}: ${finding.title}`);
  }
  process.exit(1);
}

console.log(`pnpm audit accepted: ${findings.length} HIGH/CRITICAL finding(s), ${excepted.length} formally excepted.`);
