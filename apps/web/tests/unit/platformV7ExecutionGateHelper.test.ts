import { describe, expect, it } from 'vitest';
import {
  assertPlatformV7ExecutionGate,
  canPlatformV7ExecutionGateProceedToRuntime,
  checkPlatformV7ExecutionGate,
} from '@/lib/platform-v7/execution-gate-helper';

describe('platform-v7 execution gate helper', () => {
  it('passes a valid boundary only up to contract-only runtime gate', () => {
    const result = checkPlatformV7ExecutionGate({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: {
        dealId: 'deal-1',
        amountMinor: 100,
        currency: 'RUB',
        reason: 'Reserve request.',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Reserve boundary recorded.',
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([
      {
        code: 'contract_only_boundary',
        message: 'Boundary request_money_reserve is contract-only and requires server runtime before real execution.',
      },
    ]);
    expect(canPlatformV7ExecutionGateProceedToRuntime(result)).toBe(true);
  });

  it('blocks unknown actor roles before runtime', () => {
    const result = checkPlatformV7ExecutionGate({
      boundaryId: 'request_money_reserve',
      actorId: 'unknown-1',
      actorRole: 'external_admin',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: {
        dealId: 'deal-1',
        amountMinor: 100,
        currency: 'RUB',
        reason: 'Reserve request.',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Unknown actor role boundary attempt.',
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('role_not_allowed');
    expect(canPlatformV7ExecutionGateProceedToRuntime(result)).toBe(false);
  });

  it('blocks roles from calling forbidden money boundaries', () => {
    const result = checkPlatformV7ExecutionGate({
      boundaryId: 'confirm_money_released',
      actorId: 'driver-1',
      actorRole: 'driver',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: {
        dealId: 'deal-1',
        amountMinor: 100,
        currency: 'RUB',
        bankReferenceId: 'BANK-REF-1',
        confirmedAt: '2026-05-07T10:00:00.000Z',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Boundary recorded.',
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('role_not_allowed');
    expect(canPlatformV7ExecutionGateProceedToRuntime(result)).toBe(false);
  });

  it('blocks incomplete money payloads before runtime', () => {
    const result = checkPlatformV7ExecutionGate({
      boundaryId: 'confirm_money_released',
      actorId: 'bank-1',
      actorRole: 'bank',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: {
        dealId: 'deal-1',
        currency: 'RUB',
        confirmedAt: '2026-05-07T10:00:00.000Z',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Incomplete boundary.',
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('envelope_invalid');
    expect(result.issues.map((issue) => issue.code)).toContain('money_boundary_incomplete');
    expect(result.payloadIssues.some((issue) => issue.includes('amountMinor'))).toBe(true);
  });

  it('assert helper ignores contract-only warning but throws for blocking issues', () => {
    expect(() =>
      assertPlatformV7ExecutionGate({
        boundaryId: 'mark_trip_arrived',
        actorId: 'driver-1',
        actorRole: 'driver',
        entityId: 'trip-1',
        entityType: 'trip',
        payload: {
          dealId: 'deal-1',
          tripId: 'trip-1',
          arrivedAt: '2026-05-07T10:00:00.000Z',
          geoPoint: { lat: 52.1, lon: 39.2 },
        },
        evidenceRefs: ['geo-1'],
        occurredAt: '2026-05-07T10:00:00.000Z',
        summary: 'Trip arrival boundary recorded.',
      }),
    ).not.toThrow();

    expect(() =>
      assertPlatformV7ExecutionGate({
        boundaryId: 'confirm_money_reserved',
        actorId: 'driver-1',
        actorRole: 'driver',
        entityId: 'money-1',
        entityType: 'money_record',
        payload: { dealId: 'deal-1' },
        occurredAt: '2026-05-07T10:00:00.000Z',
        summary: 'Invalid boundary.',
      }),
    ).toThrow('Role driver cannot call boundary confirm_money_reserved.');
  });
});
