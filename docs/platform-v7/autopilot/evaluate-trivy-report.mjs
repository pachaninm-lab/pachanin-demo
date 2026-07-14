#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const REPORT_PATH = resolve(process.env.TRIVY_REPORT_JSON ?? 'artifacts/security/trivy-container.json');
const EXCEPTIONS_PATH = resolve('docs/platform-v7/autopilot/security-exceptions.json');
const OUTPUT_PATH = resolve(process.env.TRIVY_EVALUATION_REPORT ?? 'artifacts/security/trivy-container-evaluation.json');
const EXACT_HEAD = String(process.env.SECURITY_EXACT_HEAD ?? '').trim();
const SCANNER = String(process.env.TRIVY_SCANNER ?? 'trivy-container').trim();
const SCAN_RESULT = String(process.env.TRIVY_SCAN_RESULT ?? 'unknown').trim();

function readJson(path, label) {
  try {
    return { value: JSON.parse(readFileSync(path, 'utf8')), error: null };
  } catch (error) {
    return {
      value: null,
      error: `${label} is missing or invalid JSON at ${path}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function normalizeSeverity(value) {
  return String(value ?? '').trim().toUpperCase();
}

function collectVulnerabilities(report) {
  const findings = [];
  for (const result of Array.isArray(report?.Results) ? report.Results : []) {
    for (const vulnerability of Array.isArray(result?.Vulnerabilities) ? result.Vulnerabilities : []) {
      findings.push({
        findingId: String(vulnerability?.VulnerabilityID ?? '').trim(),
        severity: normalizeSeverity(vulnerability?.Severity),
        target: String(result?.Target ?? 'unknown'),
        class: String(result?.Class ?? ''),
        type: String(result?.Type ?? ''),
        package: String(vulnerability?.PkgName ?? 'unknown'),
        packageId: String(vulnerability?.PkgID ?? ''),
        installedVersion: String(vulnerability?.InstalledVersion ?? ''),
        fixedVersion: String(vulnerability?.FixedVersion ?? ''),
        status: String(vulnerability?.Status ?? ''),
        primaryUrl: String(vulnerability?.PrimaryURL ?? ''),
        purl: String(vulnerability?.PkgIdentifier?.PURL ?? ''),
        title: String(vulnerability?.Title ?? vulnerability?.Description ?? 'Container vulnerability'),
      });
    }
  }

  const deduplicated = new Map();
  for (const finding of findings) {
    const key = [finding.findingId, finding.target, finding.package, finding.installedVersion].join(':');
    if (!deduplicated.has(key)) deduplicated.set(key, finding);
  }
  return [...deduplicated.values()];
}

const registryRead = readJson(EXCEPTIONS_PATH, 'security exception registry');
const reportRead = existsSync(REPORT_PATH)
  ? readJson(REPORT_PATH, 'Trivy report')
  : { value: null, error: `Trivy report is missing at ${REPORT_PATH}.` };
const registry = registryRead.value ?? { exceptions: [] };
const report = reportRead.value;
const now = Date.now();
const blocked = [];
const excepted = [];
const warnings = [];

if (!/^[0-9a-f]{40}$/.test(EXACT_HEAD)) {
  blocked.push({
    findingId: 'TRIVY_EXACT_HEAD',
    severity: 'CRITICAL',
    package: 'security-gate',
    title: 'Exact commit SHA is missing or invalid.',
    reason: 'Security evidence cannot be tied to a reproducible source revision.',
  });
}

if (registryRead.error) {
  blocked.push({
    findingId: 'TRIVY_EXCEPTION_REGISTRY',
    severity: 'CRITICAL',
    package: 'security-gate',
    title: registryRead.error,
    reason: 'Exception governance cannot be evaluated.',
  });
}

if (SCAN_RESULT !== 'success') {
  blocked.push({
    findingId: 'TRIVY_SCANNER_EXECUTION',
    severity: 'CRITICAL',
    package: 'trivy',
    title: `Trivy collection step outcome was ${SCAN_RESULT || 'unknown'}.`,
    reason: 'Scanner execution failures must fail closed.',
  });
}

if (reportRead.error) {
  blocked.push({
    findingId: 'TRIVY_REPORT',
    severity: 'CRITICAL',
    package: 'trivy',
    title: reportRead.error,
    reason: 'Missing or malformed scanner evidence must fail closed.',
  });
}

const hasRecognizedShape = Boolean(report && Array.isArray(report.Results));
if (report && !hasRecognizedShape) {
  blocked.push({
    findingId: 'TRIVY_REPORT_SHAPE',
    severity: 'CRITICAL',
    package: 'trivy',
    title: 'Trivy report does not contain a Results array.',
    reason: 'Unrecognized scanner output cannot be accepted.',
  });
}

const activeExceptions = new Map();
for (const exception of Array.isArray(registry?.exceptions) ? registry.exceptions : []) {
  if (exception?.scanner !== SCANNER) continue;
  if (exception?.severity !== 'HIGH') continue;
  const expiresAt = new Date(exception?.expiresAt ?? 0).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now) continue;
  activeExceptions.set(String(exception.findingId), {
    id: String(exception.id),
    ticket: String(exception.ticket),
    expiresAt: String(exception.expiresAt),
    owner: String(exception.owner),
    approvedBy: String(exception.approvedBy),
    rationale: String(exception.rationale),
  });
}

const allFindings = hasRecognizedShape ? collectVulnerabilities(report) : [];
const relevantFindings = allFindings.filter((finding) => ['HIGH', 'CRITICAL'].includes(finding.severity));

for (const finding of relevantFindings) {
  if (!finding.findingId) {
    blocked.push({ ...finding, reason: 'Finding has no stable identifier.' });
    continue;
  }
  if (finding.severity === 'CRITICAL') {
    blocked.push({ ...finding, reason: 'CRITICAL findings cannot be excepted.' });
    continue;
  }

  const exception = activeExceptions.get(finding.findingId);
  if (!exception) {
    blocked.push({ ...finding, reason: 'HIGH finding has no active formal exception.' });
    continue;
  }
  excepted.push({ ...finding, exception });
}

if (relevantFindings.length === 0 && blocked.length === 0) {
  warnings.push('No HIGH or CRITICAL findings were reported for the canonical API image.');
}

const evaluation = {
  schemaVersion: 1,
  repository: 'pachaninm-lab/pachanin-demo',
  commitSha: EXACT_HEAD,
  evaluatedAt: new Date().toISOString(),
  scanner: SCANNER,
  scannerResult: SCAN_RESULT,
  reportPath: REPORT_PATH,
  recognizedReportShape: hasRecognizedShape,
  summary: {
    totalFindings: allFindings.length,
    highOrCritical: relevantFindings.length,
    excepted: excepted.length,
    blocked: blocked.length,
  },
  findings: relevantFindings,
  excepted,
  blocked,
  warnings,
  passed: blocked.length === 0,
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(evaluation, null, 2)}\n`);

if (blocked.length > 0) {
  console.error(`Trivy release evaluation failed: ${blocked.length} blocking finding(s).`);
  for (const finding of blocked) {
    console.error(`- ${finding.severity} ${finding.findingId} ${finding.package}: ${finding.title}`);
  }
  process.exit(1);
}

console.log(`Trivy release evaluation passed: ${relevantFindings.length} HIGH/CRITICAL finding(s), ${excepted.length} formally excepted.`);
console.log(`Evaluation report: ${OUTPUT_PATH}`);
