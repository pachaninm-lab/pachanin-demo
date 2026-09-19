import { describe, expect, it } from 'vitest';
import { checkPlatformV7ExecutionGate } from '@/lib/platform-v7/execution-gate-helper';
import {
  buildPlatformV7ExecutionResult,
  canPlatformV7ExecutionResultClaimExecuted,
  getPlatformV7ExecutionResultSummary,
  isPlatformV7ExecutionBlocked,
} from '@/lib/platform-v7/execution-result-helper';

describe('platform-v7 execution result helper', () => {
  it('returns contract-only result for valid gates without claiming execution', () => {
    const gate = checkPlatformV7ExecutionGate({
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

    const result = buildPlatformV7ExecutionResult(gate);

    expect(result.status).toBe('contract_only');
    expect(result.canAffectRuntime).toBe(false);
    expect(result.canClaimExecuted).toBe(false);
    expect(canPlatformV7ExecutionResultClaimExecuted(result)).toBe(false);
  });

  it('returns blocked result for forbidden role actions', () => {
    const gate = checkPlatformV7ExecutionGate({
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

    const result = buildPlatformV7ExecutionResult(gate);

    expect(result.status).toBe('blocked');
    expect(isPlatformV7ExecutionBlocked(result)).toBe(true);
    expect(result.canAffectRuntime).toBe(false);
    expect(result.canClaimExecuted).toBe(false);
    expect(result.issues.some((issue) => issue.includes('Role driver cannot call'))).toBe(true);
  });

  it('keeps incomplete payload issues separate from boundary issues', () => {
    const gate = checkPlatformV7ExecutionGate({
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

    const result = buildPlatformV7ExecutionResult(gate);

    expect(result.status).toBe('blocked');
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.payloadIssues.some((issue) => issue.includes('amountMinor'))).toBe(true);
  });

  it('returns compact summary without exposing execution as completed', () => {
    const gate = checkPlatformV7ExecutionGate({
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
    });

    const result = buildPlatformV7ExecutionResult(gate);

    expect(getPlatformV7ExecutionResultSummary(result)).toEqual({
      boundaryId: 'mark_trip_arrived',
      status: 'contract_only',
      canAffectRuntime: false,
      canClaimExecuted: false,
      issueCount: 1,
    });
  });
});
