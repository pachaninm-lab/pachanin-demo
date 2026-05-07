import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleCallApiBoundary,
  getPlatformV7ApiBoundariesForCommand,
  getPlatformV7ApiBoundariesForRole,
  getPlatformV7ApiBoundary,
  getPlatformV7ApiBoundaryReadinessSummary,
  getPlatformV7MoneyAffectingApiBoundaries,
  PLATFORM_V7_API_BOUNDARIES,
} from '@/lib/platform-v7/api-boundary-contracts';

describe('platform-v7 api boundary contracts', () => {
  it('keeps API surface explicitly contract-only', () => {
    expect(getPlatformV7ApiBoundaryReadinessSummary()).toMatchObject({
      total: 22,
      mode: 'contract_only_requires_server_routes',
    });
    expect(PLATFORM_V7_API_BOUNDARIES.every((boundary) => boundary.runtimeStatus === 'contract_only')).toBe(true);
  });

  it('requires auth and entity ACL for every boundary', () => {
    expect(PLATFORM_V7_API_BOUNDARIES.every((boundary) => boundary.requiresAuth)).toBe(true);
    expect(PLATFORM_V7_API_BOUNDARIES.every((boundary) => boundary.requiresEntityAcl)).toBe(true);
  });

  it('requires idempotency and audit on every write endpoint', () => {
    const writes = PLATFORM_V7_API_BOUNDARIES.filter((boundary) => boundary.method !== 'GET');

    expect(writes.length).toBeGreaterThan(15);
    expect(writes.every((boundary) => boundary.requiresIdempotencyKey)).toBe(true);
    expect(writes.every((boundary) => boundary.writesAuditEvent)).toBe(true);
  });

  it('keeps money-affecting endpoints deal-bound and audited', () => {
    const moneyBoundaries = getPlatformV7MoneyAffectingApiBoundaries();

    expect(moneyBoundaries.length).toBeGreaterThan(7);
    expect(moneyBoundaries.every((boundary) => boundary.requiresDealId)).toBe(true);
    expect(moneyBoundaries.every((boundary) => boundary.requiresIdempotencyKey)).toBe(true);
    expect(moneyBoundaries.every((boundary) => boundary.writesAuditEvent)).toBe(true);
  });

  it('keeps bank-only confirmation endpoints externally confirmed', () => {
    expect(getPlatformV7ApiBoundary('confirm_money_reserved')).toMatchObject({
      actorRoles: ['bank'],
      affectsMoney: true,
      requiresExternalConfirmation: true,
    });
    expect(getPlatformV7ApiBoundary('confirm_money_released')).toMatchObject({
      actorRoles: ['bank'],
      affectsMoney: true,
      requiresExternalConfirmation: true,
    });
  });

  it('does not expose money or bank confirmation endpoints to the driver', () => {
    const driverBoundaryIds = getPlatformV7ApiBoundariesForRole('driver').map((boundary) => boundary.id);

    expect(driverBoundaryIds).toEqual(['mark_trip_arrived', 'open_incident', 'create_support_case', 'append_support_message']);
    expect(canPlatformV7RoleCallApiBoundary('driver', 'confirm_money_reserved')).toBe(false);
    expect(canPlatformV7RoleCallApiBoundary('driver', 'confirm_money_released')).toBe(false);
    expect(canPlatformV7RoleCallApiBoundary('driver', 'read_audit_events')).toBe(false);
  });

  it('maps command-backed endpoints to execution commands', () => {
    expect(getPlatformV7ApiBoundariesForCommand('confirm_money_released').map((boundary) => boundary.id)).toEqual([
      'confirm_money_released',
    ]);
    expect(getPlatformV7ApiBoundariesForCommand('mark_trip_arrived').map((boundary) => boundary.id)).toEqual([
      'mark_trip_arrived',
    ]);
  });
});
