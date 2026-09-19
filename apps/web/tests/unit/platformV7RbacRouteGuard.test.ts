import { describe, expect, it } from 'vitest';
import {
  evaluatePlatformV7RouteGuard,
  platformV7RouteGuardRequest,
} from '@/lib/platform-v7/rbac-route-guard';
import type { PlatformV7AccessActor } from '@/lib/platform-v7/access-control';

const bankActor: PlatformV7AccessActor = {
  userId: 'bank-1',
  organizationId: 'bank-1',
  roles: ['bankOfficer'],
  activeRole: 'bankOfficer',
};

const driverActor: PlatformV7AccessActor = {
  userId: 'driver-1',
  organizationId: 'carrier-1',
  roles: ['driver'],
  activeRole: 'driver',
};

const executiveActor: PlatformV7AccessActor = {
  userId: 'exec-1',
  organizationId: 'exec-1',
  roles: ['executiveViewer'],
  activeRole: 'executiveViewer',
};

describe('platform-v7 route RBAC guard', () => {
  it('allows the intended role through the guarded driver, bank and executive surfaces', () => {
    expect(evaluatePlatformV7RouteGuard(platformV7RouteGuardRequest('driver_field', driverActor)).allowed).toBe(true);
    expect(evaluatePlatformV7RouteGuard(platformV7RouteGuardRequest('bank_workspace', bankActor)).allowed).toBe(true);
    expect(evaluatePlatformV7RouteGuard(platformV7RouteGuardRequest('executive_workspace', executiveActor)).allowed).toBe(true);
  });

  it('denies cross-role access and emits the denied payload', () => {
    const bankToDriver = evaluatePlatformV7RouteGuard(platformV7RouteGuardRequest('driver_field', bankActor));
    const driverToBank = evaluatePlatformV7RouteGuard(platformV7RouteGuardRequest('bank_workspace', driverActor));

    expect(bankToDriver.allowed).toBe(false);
    expect(bankToDriver.deniedPayload).toMatchObject({
      eventType: 'access.denied',
      role: 'bankOfficer',
      action: 'read',
      resourceType: 'trip',
      correlationId: 'route-driver_field',
      auditId: 'audit-driver_field',
    });

    expect(driverToBank.allowed).toBe(false);
    expect(driverToBank.deniedPayload).toMatchObject({
      eventType: 'access.denied',
      role: 'driver',
      action: 'read',
      resourceType: 'money',
      correlationId: 'route-bank_workspace',
      auditId: 'audit-bank_workspace',
    });
  });
});
