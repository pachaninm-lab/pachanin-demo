#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const AUDIT_PATH = resolve(process.env.PNPM_AUDIT_JSON ?? 'artifacts/security/pnpm-audit.json');
const STDERR_PATH = resolve(process.env.PNPM_AUDIT_STDERR ?? `${dirname(AUDIT_PATH)}/pnpm-audit.stderr.txt`);
const EXCEPTIONS_PATH = resolve('docs/platform-v7/autopilot/security-exceptions.json');
const REPORT_PATH = resolve(process.env.PNPM_AUDIT_REPORT ?? 'artifacts/security/pnpm-audit-evaluation.json');
const EXACT_HEAD = process.env.SECURITY_EXACT_HEAD ?? '';
const FALLBACK_VERSION = process.env.PNPM_AUDIT_FALLBACK_VERSION ?? '11.13.0';

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

function isRetiredLegacyEndpoint(payload) {
  const code = String(payload?.error?.code ?? '');
  const message = String(payload?.error?.message ?? '');
  return code === 'ERR_PNPM_AUDIT_BAD_RESPONSE'
    && (message.includes('responded with 410') || message.includes('endpoint is being retired'));
}

function runBulkAuditFallback() {
  const command = [
    'exec',
    '--yes',
    `--package=pnpm@${FALLBACK_VERSION}`,
    '--',
    'pnpm',
    'audit',
    '--prod',
    '--json',
    '--audit-level=high',
  ];
  const manifestPath = resolve('package.json');
  const originalManifest = readFileSync(manifestPath, 'utf8');
  let result;
  try {
    const manifest = JSON.parse(originalManifest);
    manifest.packageManager = `pnpm@${FALLBACK_VERSION}`;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    result = spawnSync('npm', command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        COREPACK_ENABLE_PROJECT_SPEC: '0',
        npm_config_manage_package_manager_versions: 'false',
      },
    });
  } finally {
    writeFileSync(manifestPath, originalManifest);
  }

  const exitCode = Number.isInteger(result?.status) ? result.status : 1;
  const stderr = [
    `Legacy pnpm audit endpoint retired; retried with pinned pnpm ${FALLBACK_VERSION} bulk advisory client.`,
    `The repository packageManager field was temporarily set to pnpm@${FALLBACK_VERSION} for this isolated scanner process and restored immediately afterwards.`,
    result?.error ? String(result.error) : '',
    result?.stderr ?? '',
  ].filter(Boolean).join('\n');
  mkdirSync(dirname(STDERR_PATH), { recursive: true });
  appendFileSync(STDERR_PATH, `${stderr}\n`);

  try {
    const payload = JSON.parse(String(result?.stdout ?? '').trim());
    writeFileSync(AUDIT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
    return { payload, exitCode, stderr };
  } catch (error) {
    const payload = {
      error: {
        code: 'PNPM_BULK_AUDIT_BAD_RESPONSE',
        message: `Pinned pnpm ${FALLBACK_VERSION} did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
    writeFileSync(AUDIT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
    return { payload, exitCode, stderr };
  }
}

let scannerExit = Number(process.env.PNPM_AUDIT_EXIT ?? 'NaN');
let scannerVersion = process.env.PNPM_VERSION ?? 'repository-pinned';
let fallbackUsed = false;
let audit = parseJson(AUDIT_PATH, 'pnpm audit report');
if (isRetiredLegacyEndpoint(audit)) {
  const fallback = runBulkAuditFallback();
  audit = fallback.payload;
  scannerExit = fallback.exitCode;
  scannerVersion = FALLBACK_VERSION;
  fallbackUsed = true;
}

const registry = parseJson(EXCEPTIONS_PATH, 'security exception registry');
const activeExceptions = new Set(
  (Array.isArray(registry.exceptions) ? registry.exceptions : [])
    .filter((exception) => exception?.scanner === 'pnpm-audit' && new Date(exception?.expiresAt ?? 0).getTime() > Date.now())
    .map((exception) => String(exception.findingId)),
);
const allFindings = collectFindings(audit);
const findings = allFindings.filter((finding) => ['HIGH', 'CRITICAL'].includes(finding.severity));
const blocked = [];
const excepted = [];
const hasRecognizedAuditShape = Boolean(
  (audit?.advisories && typeof audit.advisories === 'object')
  || (audit?.vulnerabilities && typeof audit.vulnerabilities === 'object')
  || (audit?.metadata && typeof audit.metadata === 'object'),
);

if (!Number.isInteger(scannerExit) || scannerExit < 0) {
  blocked.push({
    findingId: 'PNPM_AUDIT_EXECUTION',
    severity: 'CRITICAL',
    package: 'pnpm',
    title: 'pnpm audit exit code is missing or invalid',
    url: '',
    reason: 'Scanner execution cannot be verified.',
  });
} else if (!hasRecognizedAuditShape) {
  blocked.push({
    findingId: 'PNPM_AUDIT_OUTPUT',
    severity: 'CRITICAL',
    package: 'pnpm',
    title: 'pnpm audit did not produce a recognized audit payload',
    url: '',
    reason: 'Scanner failure or registry failure must fail closed.',
  });
} else if (scannerExit !== 0 && findings.length === 0) {
  blocked.push({
    findingId: 'PNPM_AUDIT_UNEXPLAINED_EXIT',
    severity: 'CRITICAL',
    package: 'pnpm',
    title: `pnpm audit exited ${scannerExit} without HIGH or CRITICAL findings`,
    url: '',
    reason: 'An unexplained scanner failure cannot be accepted.',
  });
}

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
  scannerVersion,
  scannerExitCode: Number.isFinite(scannerExit) ? scannerExit : null,
  fallbackUsed,
  endpointContract: fallbackUsed ? 'bulk-advisory' : 'repository-pinned-client',
  recognizedAuditShape: hasRecognizedAuditShape,
  reportedTotal,
  highOrCriticalFindings: findings,
  excepted,
  blocked,
  passed: blocked.length === 0,
};
mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

if (blocked.length > 0) {
  console.error(`pnpm audit blocked the release: ${blocked.length} blocking finding(s).`);
  for (const finding of blocked) {
    console.error(`- ${finding.severity} ${finding.findingId} ${finding.package}: ${finding.title}`);
  }
  process.exit(1);
}

console.log(`pnpm audit accepted: ${findings.length} HIGH/CRITICAL finding(s), ${excepted.length} formally excepted, scanner ${scannerVersion}${fallbackUsed ? ' (bulk fallback)' : ''}.`);
