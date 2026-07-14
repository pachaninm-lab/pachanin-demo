#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const EXCEPTIONS_PATH = resolve('docs/platform-v7/autopilot/security-exceptions.json');
const SCHEMA_PATH = resolve('docs/platform-v7/autopilot/security-exceptions.schema.json');
const WORKFLOW_PATH = resolve('.github/workflows/security-quality-gate.yml');
const REPORT_PATH = resolve(process.env.SECURITY_POLICY_REPORT ?? 'artifacts/security/security-policy-validation.json');
const TRIVY_IGNORE_PATH = resolve(process.env.TRIVY_IGNORE_PATH ?? 'artifacts/security/.trivyignore');
const EXACT_HEAD = process.env.SECURITY_EXACT_HEAD ?? '';
const MAX_EXCEPTION_DAYS = 90;
const ALLOWED_SCANNERS = new Set(['trivy-container', 'trivy-filesystem', 'trivy-iac', 'pnpm-audit']);

function parseJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function headSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'UNKNOWN';
  }
}

function check(errors, condition, message) {
  if (!condition) errors.push(message);
}

const errors = [];
const warnings = [];
const validatedCommit = headSha();
const registry = parseJson(EXCEPTIONS_PATH);
const schema = parseJson(SCHEMA_PATH);
const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
const now = new Date();

check(errors, /^[0-9a-f]{40}$/.test(EXACT_HEAD), 'SECURITY_EXACT_HEAD must be a full commit SHA.');
check(errors, validatedCommit === EXACT_HEAD, `Checked out commit ${validatedCommit} does not match exact head ${EXACT_HEAD}.`);
check(errors, schema?.properties?.schemaVersion?.const === 1, 'Security exception schema version must remain 1.');
check(errors, registry.schemaVersion === 1, 'Security exception registry schemaVersion must equal 1.');
check(errors, registry.policy?.criticalExceptionsAllowed === false, 'Critical vulnerability exceptions are forbidden.');
check(errors, registry.policy?.maximumExceptionDays === MAX_EXCEPTION_DAYS, `maximumExceptionDays must equal ${MAX_EXCEPTION_DAYS}.`);
check(errors, Array.isArray(registry.exceptions), 'exceptions must be an array.');

const exceptions = Array.isArray(registry.exceptions) ? registry.exceptions : [];
const ids = new Set();
const findingKeys = new Set();
const activeTrivyFindings = [];

for (const exception of exceptions) {
  const id = String(exception?.id ?? '');
  const scanner = String(exception?.scanner ?? '');
  const findingId = String(exception?.findingId ?? '');
  const createdAt = new Date(exception?.createdAt ?? 'invalid');
  const expiresAt = new Date(exception?.expiresAt ?? 'invalid');
  const durationDays = (expiresAt.getTime() - createdAt.getTime()) / 86_400_000;
  const findingKey = `${scanner}:${findingId}`;

  check(errors, /^SEC-[0-9]{4}-[0-9]{3,}$/.test(id), `${id || '<missing>'}: invalid exception id.`);
  check(errors, !ids.has(id), `${id}: duplicate exception id.`);
  ids.add(id);
  check(errors, ALLOWED_SCANNERS.has(scanner), `${id}: unsupported scanner ${scanner}.`);
  check(errors, findingId.length >= 3, `${id}: findingId is required.`);
  check(errors, !findingKeys.has(findingKey), `${id}: duplicate scanner/findingId pair ${findingKey}.`);
  findingKeys.add(findingKey);
  check(errors, exception?.severity === 'HIGH', `${id}: only HIGH findings may be excepted.`);
  check(errors, typeof exception?.owner === 'string' && exception.owner.trim().length >= 2, `${id}: owner is required.`);
  check(errors, typeof exception?.approvedBy === 'string' && exception.approvedBy.trim().length >= 2, `${id}: approvedBy is required.`);
  check(errors, /^#[0-9]+$/.test(String(exception?.ticket ?? '')), `${id}: ticket must reference a GitHub issue.`);
  check(errors, typeof exception?.rationale === 'string' && exception.rationale.trim().length >= 20, `${id}: rationale is too short.`);
  check(errors, !Number.isNaN(createdAt.getTime()), `${id}: createdAt must be ISO date-time.`);
  check(errors, !Number.isNaN(expiresAt.getTime()), `${id}: expiresAt must be ISO date-time.`);
  check(errors, durationDays > 0 && durationDays <= MAX_EXCEPTION_DAYS, `${id}: exception duration must be 1-${MAX_EXCEPTION_DAYS} days.`);
  check(errors, expiresAt.getTime() > now.getTime(), `${id}: exception expired at ${exception?.expiresAt}.`);

  if (scanner.startsWith('trivy-') && findingId.length >= 3 && expiresAt.getTime() > now.getTime()) {
    activeTrivyFindings.push(findingId);
  }
}

const forbiddenWorkflowPatterns = [
  [/\|\|\s*true/g, 'blocking workflow must not suppress failures with || true'],
  [/continue-on-error:\s*true/g, 'blocking workflow must not use continue-on-error: true'],
  [/exit-code:\s*['"]?0['"]?/g, 'blocking Trivy scans must not use exit-code 0'],
  [/@master\b/g, 'GitHub Actions must not use mutable @master refs'],
  [/apps\/api\/Dockerfile/g, 'workflow must build the canonical infra/docker/Dockerfile.api'],
];
for (const [pattern, message] of forbiddenWorkflowPatterns) {
  if (pattern.test(workflow)) errors.push(message);
}

const requiredWorkflowFragments = [
  'ref: ${{ env.EXACT_HEAD }}',
  'infra/docker/Dockerfile.api',
  'aquasecurity/trivy-action@v0.36.0',
  "exit-code: '1'",
  'scan-type: config',
  'pnpm audit --json',
  'check-security-release-gate.mjs',
  'evaluate-pnpm-audit.mjs',
  'Security Gate · all blocking checks',
  'security-events: write',
];
for (const fragment of requiredWorkflowFragments) {
  check(errors, workflow.includes(fragment), `Security workflow is missing required fragment: ${fragment}`);
}

check(errors, existsSync(resolve('infra/docker/Dockerfile.api')), 'Canonical API Dockerfile is missing.');
check(errors, existsSync(resolve('docker-compose.yml')), 'Production-like Docker Compose definition is missing.');

mkdirSync(dirname(REPORT_PATH), { recursive: true });
mkdirSync(dirname(TRIVY_IGNORE_PATH), { recursive: true });
writeFileSync(TRIVY_IGNORE_PATH, activeTrivyFindings.length ? `${[...new Set(activeTrivyFindings)].sort().join('\n')}\n` : '');

if (exceptions.length === 0) warnings.push('No active HIGH security exceptions.');

const report = {
  schemaVersion: 1,
  repository: 'pachaninm-lab/pachanin-demo',
  validatedCommit,
  validatedAt: new Date().toISOString(),
  valid: errors.length === 0,
  policy: {
    criticalExceptionsAllowed: false,
    maximumExceptionDays: MAX_EXCEPTION_DAYS,
  },
  activeExceptions: exceptions.map(({ id, scanner, findingId, severity, owner, approvedBy, ticket, expiresAt }) => ({
    id,
    scanner,
    findingId,
    severity,
    owner,
    approvedBy,
    ticket,
    expiresAt,
  })),
  generatedTrivyIgnorePath: 'artifacts/security/.trivyignore',
  errors,
  warnings,
};
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

if (errors.length > 0) {
  console.error(`Security release policy is invalid (${errors.length} error(s)).`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Security release policy is valid at ${validatedCommit}.`);
console.log(`Active HIGH exceptions: ${exceptions.length}. Critical exceptions: forbidden.`);
console.log(`Policy report: ${REPORT_PATH}`);
