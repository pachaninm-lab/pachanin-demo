import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const paths = {
  controller: 'apps/api/src/modules/staff-access/staff-access.controller.ts',
  test: 'apps/api/src/modules/staff-access/registration-decision-session-boundary.spec.ts',
  scope: 'docs/platform-v7/autopilot/scopes/production-p0-staff-decision-session-3750.json',
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
const replaceOnce = (source, from, to, label) => {
  const count = source.split(from).length - 1;
  if (count !== 1) {
    failures.push(`${label}: expected one replacement anchor, received ${count}`);
    return source;
  }
  return source.replace(from, to);
};

const controller = read(paths.controller);
const test = selfTest ? '' : read(paths.test);
const scopeSource = read(paths.scope);
let scope = {};
try {
  scope = JSON.parse(scopeSource || '{}');
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

const allowedPaths = [paths.controller, paths.test];
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push(`${paths.scope}: schemaVersion mismatch`);
if (scope.branch !== 'fix/production-p0-staff-decision-session-3750') failures.push(`${paths.scope}: branch mismatch`);
if (!sameExactPaths(scope.allowedPaths, allowedPaths)) failures.push(`${paths.scope}: allowedPaths mismatch`);

const controllerAnchor = `  @Post('registration/applications/:applicationId/decision')
  @RateLimit({ name: 'staff_registration_application_decision', scope: 'user', limit: 20, windowSeconds: 900, includeParams: ['applicationId'] })
`;
const controllerAccepted = `  @Post('registration/applications/:applicationId/decision')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.STAFF_REQUEST_APPROVE)
  @RateLimit({ name: 'staff_registration_application_decision', scope: 'user', limit: 20, windowSeconds: 900, includeParams: ['applicationId'] })
`;
const acceptedTest = `import { GUARDS_METADATA } from '@nestjs/common/constants';
import { STAFF_ACCESS_MODES_KEY } from './staff-access-modes.decorator';
import { StaffAccessController } from './staff-access.controller';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAccessMode, StaffPermission } from './staff-access.types';
import { STAFF_PERMISSIONS_KEY } from './staff-permissions.decorator';

describe('registration decision staff access session boundary', () => {
  const handler = StaffAccessController.prototype.registrationApplicationDecision;

  it('requires an active CONTROL_PLANE grant with STAFF_REQUEST_APPROVE', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([StaffAccessGuard]);
    expect(Reflect.getMetadata(STAFF_ACCESS_MODES_KEY, handler)).toEqual([
      StaffAccessMode.CONTROL_PLANE,
    ]);
    expect(Reflect.getMetadata(STAFF_PERMISSIONS_KEY, handler)).toEqual([
      StaffPermission.STAFF_REQUEST_APPROVE,
    ]);
  });

  it('retains the durable assignment ceiling before executing the decision', async () => {
    const access = {
      requirePermission: jest.fn().mockResolvedValue(undefined),
    };
    const registrationDecisions = {
      decide: jest.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new StaffAccessController(
      access as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      registrationDecisions as never,
    );
    const user = { id: 'staff-reviewer' } as never;

    await controller.registrationApplicationDecision(
      { user } as never,
      'application-1',
      { decision: 'APPROVED', reason: 'verified' } as never,
      'decision-idempotency-key-1',
      'correlation-1',
      'delivery-key-1',
    );

    expect(access.requirePermission).toHaveBeenCalledWith(
      user,
      StaffPermission.STAFF_REQUEST_APPROVE,
    );
    expect(registrationDecisions.decide).toHaveBeenCalledWith(
      'application-1',
      'APPROVED',
      'verified',
      user,
      'decision-idempotency-key-1',
      'correlation-1',
      'delivery-key-1',
    );
  });
});
`;

const acceptedController = selfTest
  ? replaceOnce(
      controller,
      controllerAnchor,
      controllerAccepted,
      'registration decision staff-session decorators',
    )
  : controller;

if (selfTest) {
  if (fs.existsSync(paths.test)) failures.push(`${paths.test}: must not exist in the governance baseline`);
  if (sha256(controller) !== scope.baselineSha256?.controller) failures.push(`${paths.controller}: baseline SHA-256 mismatch`);
  if (sha256(acceptedController) !== scope.acceptedSha256?.controller) failures.push(`${paths.controller}: synthesized accepted SHA-256 mismatch`);
  if (sha256(acceptedTest) !== scope.acceptedSha256?.test) failures.push(`${paths.test}: synthesized accepted SHA-256 mismatch`);
} else {
  const headRef = String(process.env.GITHUB_HEAD_REF || '').trim();
  if (headRef && headRef !== scope.branch) failures.push(`GITHUB_HEAD_REF mismatch: expected ${scope.branch}, received ${headRef}`);
  if (sha256(controller) !== scope.acceptedSha256?.controller) failures.push(`${paths.controller}: accepted SHA-256 mismatch`);
  if (sha256(test) !== scope.acceptedSha256?.test) failures.push(`${paths.test}: accepted SHA-256 mismatch`);
  for (const needle of [
    '@UseGuards(StaffAccessGuard)',
    '@StaffAccessModes(StaffAccessMode.CONTROL_PLANE)',
    '@StaffPermissions(StaffPermission.STAFF_REQUEST_APPROVE)',
    'await this.access.requirePermission(request.user, StaffPermission.STAFF_REQUEST_APPROVE);',
  ]) {
    if (!controller.includes(needle)) failures.push(`accepted controller contract missing ${JSON.stringify(needle)}`);
  }
  for (const needle of ['GUARDS_METADATA', 'STAFF_ACCESS_MODES_KEY', 'STAFF_PERMISSIONS_KEY']) {
    if (!test.includes(needle)) failures.push(`accepted test contract missing ${JSON.stringify(needle)}`);
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
  console.error('Production P0 staff decision session contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(selfTest
  ? 'PASS: the exact baseline synthesizes the reviewed staff-session decision boundary and its unit contract.'
  : 'PASS: registration decisions require an active CONTROL_PLANE staff session with STAFF_REQUEST_APPROVE.');
