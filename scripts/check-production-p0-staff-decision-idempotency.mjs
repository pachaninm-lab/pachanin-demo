import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const paths = {
  route: 'apps/web/app/api/staff/[...path]/route.ts',
  test: 'apps/web/tests/unit/p0FirstCustomerCompletion.test.ts',
  scope: 'docs/platform-v7/autopilot/scopes/production-p0-staff-decision-idempotency-3750.json',
};
const selfTest = process.argv.includes('--self-test');
const failures = [];

const read = (path) => {
  if (!fs.existsSync(path)) {
    failures.push(`${path}: missing`);
    return '';
  }
  return fs.readFileSync(path, 'utf8');
};
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const replaceOnce = (source, from, to, label) => {
  const count = source.split(from).length - 1;
  if (count !== 1) {
    failures.push(`${label}: expected one replacement anchor, received ${count}`);
    return source;
  }
  return source.replace(from, to);
};

const route = read(paths.route);
const test = read(paths.test);
const scopeSource = read(paths.scope);
let scope = {};
try {
  scope = JSON.parse(scopeSource || '{}');
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

const allowedPaths = [paths.route, paths.test];
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push(`${paths.scope}: schemaVersion mismatch`);
if (scope.branch !== 'fix/production-p0-staff-decision-idempotency-3750') failures.push(`${paths.scope}: branch mismatch`);
if (JSON.stringify(scope.allowedPaths) !== JSON.stringify(allowedPaths)) failures.push(`${paths.scope}: allowedPaths mismatch`);

const routeVariableAnchor = `  const registrationDeliveryKey = registrationDecision
    ? String(process.env.REGISTRATION_DELIVERY_KEY || '').trim()
    : '';
`;
const routeVariableAccepted = `${routeVariableAnchor}  const idempotencyKey = registrationDecision
    ? String(request.headers.get('idempotency-key') || '').trim()
    : '';
`;
const routeValidationAnchor = `  if (registrationDecision && registrationDeliveryKey.length < 32) {
    return json({ ok: false, code: 'REGISTRATION_NOTIFICATION_UNAVAILABLE', correlationId }, 503);
  }
`;
const routeValidationAccepted = `${routeValidationAnchor}  if (registrationDecision && (idempotencyKey.length < 16 || idempotencyKey.length > 128)) {
    return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', correlationId }, 400);
  }
`;
const routeHeaderAnchor = `        ...(registrationDecision ? { 'x-registration-delivery-key': registrationDeliveryKey } : {}),`;
const routeHeaderAccepted = `        ...(registrationDecision ? {
          'idempotency-key': idempotencyKey,
          'x-registration-delivery-key': registrationDeliveryKey,
        } : {}),`;
const testAnchor = String.raw`    expect(proxy).toContain('/^registration\\/applications\\/[^/]+\\/decision$/');
`;
const testAccepted = `${testAnchor}    expect(proxy).toContain("request.headers.get('idempotency-key')");
    expect(proxy).toContain("'idempotency-key': idempotencyKey");
    expect(proxy).toContain("code: 'IDEMPOTENCY_KEY_REQUIRED'");
`;

const buildAccepted = (baselineRoute, baselineTest) => ({
  route: replaceOnce(
    replaceOnce(
      replaceOnce(baselineRoute, routeVariableAnchor, routeVariableAccepted, 'route idempotency extraction'),
      routeValidationAnchor,
      routeValidationAccepted,
      'route idempotency validation',
    ),
    routeHeaderAnchor,
    routeHeaderAccepted,
    'route idempotency forwarding',
  ),
  test: replaceOnce(baselineTest, testAnchor, testAccepted, 'P0 staff BFF assertions'),
});

if (selfTest) {
  if (sha256(route) !== scope.baselineSha256?.[paths.route]) failures.push(`${paths.route}: baseline SHA-256 mismatch`);
  if (sha256(test) !== scope.baselineSha256?.[paths.test]) failures.push(`${paths.test}: baseline SHA-256 mismatch`);
  const accepted = buildAccepted(route, test);
  if (sha256(accepted.route) !== scope.acceptedSha256?.[paths.route]) failures.push(`${paths.route}: synthesized accepted SHA-256 mismatch`);
  if (sha256(accepted.test) !== scope.acceptedSha256?.[paths.test]) failures.push(`${paths.test}: synthesized accepted SHA-256 mismatch`);
} else {
  const headRef = String(process.env.GITHUB_HEAD_REF || '').trim();
  if (headRef && headRef !== scope.branch) failures.push(`GITHUB_HEAD_REF mismatch: expected ${scope.branch}, received ${headRef}`);
  if (sha256(route) !== scope.acceptedSha256?.[paths.route]) failures.push(`${paths.route}: accepted SHA-256 mismatch`);
  if (sha256(test) !== scope.acceptedSha256?.[paths.test]) failures.push(`${paths.test}: accepted SHA-256 mismatch`);
  for (const needle of [
    "request.headers.get('idempotency-key')",
    "'idempotency-key': idempotencyKey",
    "code: 'IDEMPOTENCY_KEY_REQUIRED'",
    "'x-registration-delivery-key': registrationDeliveryKey",
  ]) {
    if (!route.includes(needle) && !test.includes(needle)) failures.push(`accepted contract missing ${JSON.stringify(needle)}`);
  }
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  if (diff.status !== 0) {
    failures.push(`git diff failed: ${diff.stderr.trim()}`);
  } else {
    const changed = diff.stdout.trim().split(/\r?\n/).filter(Boolean);
    if (JSON.stringify(changed) !== JSON.stringify(allowedPaths)) {
      failures.push(`changed paths must be exactly ${JSON.stringify(allowedPaths)}; received ${JSON.stringify(changed)}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Production P0 staff decision idempotency contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(selfTest
  ? 'PASS: baseline files synthesize the exact reviewed staff-decision idempotency patch.'
  : 'PASS: staff BFF validates and forwards the required idempotency key with only the exact P0 contract test change.');
