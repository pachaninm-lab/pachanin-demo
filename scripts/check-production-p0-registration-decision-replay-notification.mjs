import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const paths = {
  service: 'apps/api/src/modules/auth/registration-decision.service.ts',
  test: 'apps/api/src/modules/auth/registration-decision.service.spec.ts',
  scope: 'docs/platform-v7/autopilot/scopes/production-p0-registration-decision-replay-notification-3750.json',
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
const sameExactPaths = (actual, expected) => Array.isArray(actual)
  && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
const replaceExactly = (source, from, to, expectedCount, label) => {
  const count = source.split(from).length - 1;
  if (count !== expectedCount) {
    failures.push(`${label}: expected ${expectedCount} replacement anchors, received ${count}`);
    return source;
  }
  return source.split(from).join(to);
};

const service = read(paths.service);
const test = read(paths.test);
const scopeSource = read(paths.scope);
let scope = {};
try {
  scope = JSON.parse(scopeSource || '{}');
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

const allowedPaths = [paths.service, paths.test];
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push(`${paths.scope}: schemaVersion mismatch`);
if (scope.branch !== 'fix/production-p0-registration-decision-replay-notification-3750') failures.push(`${paths.scope}: branch mismatch`);
if (!sameExactPaths(scope.allowedPaths, allowedPaths)) failures.push(`${paths.scope}: allowedPaths mismatch`);

const replayCallAnchor = '        return this.readResult(tx, applicationId, deliveryKey);';
const replayCallAccepted = '        return this.readResult(tx, applicationId, deliveryKey, true);';
const signatureAnchor = '  private async readResult(client: AuthSqlClient, applicationId: string, deliveryKey?: string) {';
const signatureAccepted = `  private async readResult(
    client: AuthSqlClient,
    applicationId: string,
    deliveryKey?: string,
    replayed = false,
  ) {`;
const deliveryAnchor = `      correlationId: application.correlation_id,
      notificationDelivery: deliveryAuthorized(deliveryKey)
        ? {
            email: application.email,
            status: application.status,
            reason: application.decision_reason,
          }
        : undefined,
`;
const deliveryAccepted = `      correlationId: application.correlation_id,
      replayed,
      ...(!replayed && deliveryAuthorized(deliveryKey)
        ? {
            notificationDelivery: {
              email: application.email,
              status: application.status,
              reason: application.decision_reason,
            },
          }
        : {}),
`;
const testAnchor = `  it('keeps the causal receipt inside a membership-free bounded PostgreSQL authority', () => {`;
const testAccepted = `  it('marks an exact platform decision retry as replayed before reading delivery metadata', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ application_id: 'application-1' }]),
    };
    const prisma = {
      $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const service = new RegistrationDecisionService(prisma as never, {} as never);
    const replayResult = { applicationId: 'application-1', status: 'ACTIVATED', replayed: true };
    const readResult = jest.fn().mockResolvedValue(replayResult);
    Object.assign(service as unknown as Record<string, unknown>, {
      requirePlatformDecisionAuthority: jest.fn().mockResolvedValue(undefined),
      readResult,
    });
    const deliveryKey = 'registration-delivery-key-for-replay-test';

    await expect(service.decide(
      'application-1',
      'APPROVE',
      'Verified organization details',
      { ...REVIEWER, staffRoles: ['PLATFORM_OWNER'] },
      'idempotency-decision-replay-0001',
      'correlation-replay-1',
      deliveryKey,
    )).resolves.toEqual(replayResult);

    expect(readResult).toHaveBeenCalledWith(
      tx,
      'application-1',
      deliveryKey,
      true,
    );
  });

  it('omits notification delivery metadata when readResult is replayed', async () => {
    const previousDeliveryKey = process.env.REGISTRATION_DELIVERY_KEY;
    const deliveryKey = 'registration-delivery-key-for-read-result-test';
    process.env.REGISTRATION_DELIVERY_KEY = deliveryKey;
    const { service } = createService();
    const client = {
      $queryRaw: jest.fn().mockResolvedValue([{
        id: 'application-1',
        status: 'ACTIVATED',
        version: 2n,
        correlation_id: 'correlation-1',
        email: 'applicant@example.test',
        decision_reason: 'Verified organization details',
      }]),
    };
    const readResult = (service as unknown as {
      readResult: (
        tx: typeof client,
        applicationId: string,
        providedDeliveryKey?: string,
        replayed?: boolean,
      ) => Promise<Record<string, unknown>>;
    }).readResult.bind(service);

    try {
      await expect(readResult(client, 'application-1', deliveryKey)).resolves.toMatchObject({
        replayed: false,
        notificationDelivery: { email: 'applicant@example.test' },
      });
      const replay = await readResult(client, 'application-1', deliveryKey, true);
      expect(replay).toMatchObject({ replayed: true });
      expect(replay).not.toHaveProperty('notificationDelivery');
    } finally {
      if (previousDeliveryKey === undefined) delete process.env.REGISTRATION_DELIVERY_KEY;
      else process.env.REGISTRATION_DELIVERY_KEY = previousDeliveryKey;
    }
  });

${testAnchor}`;

if (selfTest) {
  const acceptedService = replaceExactly(
    replaceExactly(
      replaceExactly(service, replayCallAnchor, replayCallAccepted, 2, 'decision replay calls'),
      signatureAnchor,
      signatureAccepted,
      1,
      'readResult replay signature',
    ),
    deliveryAnchor,
    deliveryAccepted,
    1,
    'replay-safe notification delivery',
  );
  const acceptedTest = replaceExactly(test, testAnchor, testAccepted, 1, 'replay notification unit tests');
  if (sha256(service) !== scope.baselineSha256?.service) failures.push(`${paths.service}: baseline SHA-256 mismatch`);
  if (sha256(test) !== scope.baselineSha256?.test) failures.push(`${paths.test}: baseline SHA-256 mismatch`);
  if (sha256(acceptedService) !== scope.acceptedSha256?.service) failures.push(`${paths.service}: synthesized accepted SHA-256 mismatch`);
  if (sha256(acceptedTest) !== scope.acceptedSha256?.test) failures.push(`${paths.test}: synthesized accepted SHA-256 mismatch`);
} else {
  const headRef = String(process.env.GITHUB_HEAD_REF || '').trim();
  if (headRef && headRef !== scope.branch) failures.push(`GITHUB_HEAD_REF mismatch: expected ${scope.branch}, received ${headRef}`);
  if (sha256(service) !== scope.acceptedSha256?.service) failures.push(`${paths.service}: accepted SHA-256 mismatch`);
  if (sha256(test) !== scope.acceptedSha256?.test) failures.push(`${paths.test}: accepted SHA-256 mismatch`);
  if (service.split(replayCallAccepted).length - 1 !== 2) failures.push('both registration decision replay branches must suppress notification delivery');
  for (const needle of [
    'replayed = false',
    '...(!replayed && deliveryAuthorized(deliveryKey)',
    'expect(replay).not.toHaveProperty(\'notificationDelivery\')',
  ]) {
    if (!service.includes(needle) && !test.includes(needle)) failures.push(`accepted replay contract missing ${JSON.stringify(needle)}`);
  }
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  if (diff.status !== 0) {
    failures.push(`git diff failed: ${diff.stderr.trim()}`);
  } else {
    const changed = diff.stdout.trim().split(/\r?\n/).filter(Boolean).sort();
    const expectedChanged = [...allowedPaths].sort();
    if (JSON.stringify(changed) !== JSON.stringify(expectedChanged)) {
      failures.push(`changed paths must be exactly ${JSON.stringify(allowedPaths)}; received ${JSON.stringify(changed)}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Production P0 registration decision replay notification contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(selfTest
  ? 'PASS: the exact baseline synthesizes replay-safe registration decision delivery and focused tests.'
  : 'PASS: exact registration decision replays are explicit and do not expose notification delivery metadata.');
