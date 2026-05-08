import { describe, expect, it } from 'vitest';
import {
  buildPlatformV7ServerActionInputFromRouteBody,
  handlePlatformV7ServerActionRouteBody,
} from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route handler', () => {
  it('rejects incomplete route body without claiming execution', () => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'request_money_reserve',
      actorRole: 'buyer',
    });

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      ok: false,
      status: 'not_accepted',
      canClaimExecuted: false,
      persisted: false,
      attemptedRuntimeWrite: false,
    });
  });

  it('builds envelope input from route body with safe defaults', () => {
    const input = buildPlatformV7ServerActionInputFromRouteBody({
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
    });

    expect(input).toMatchObject({
      boundaryId: 'mark_trip_arrived',
      actorId: 'driver-1',
      actorRole: 'driver',
      entityId: 'trip-1',
      entityType: 'trip',
      occurredAt: '1970-01-01T00:00:00.000Z',
      summary: 'Platform-v7 action boundary checked.',
      evidenceRefs: ['geo-1'],
    });
  });

  it('returns contract-checked result without runtime persistence claim', () => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: {
        dealId: 'deal-1',
        amountMinor: 100_000,
        currency: 'RUB',
        reason: 'Reserve request.',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Reserve boundary checked.',
    });

    expect(result.status).toBe(202);
    expect(result.body.ok).toBe(true);
    expect(result.body.response).toMatchObject({
      boundaryId: 'request_money_reserve',
      actionId: 'money.request_reserve',
      serviceName: 'money',
      status: 'contract_checked',
      canClaimExecuted: false,
      persisted: false,
      attemptedRuntimeWrite: false,
      repositoryDurable: false,
    });
  });

  it('rejects forbidden role through server route handler', () => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'confirm_money_released',
      actorId: 'driver-1',
      actorRole: 'driver',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: {
        dealId: 'deal-1',
        amountMinor: 100_000,
        currency: 'RUB',
        bankReferenceId: 'BANK-REF-1',
        confirmedAt: '2026-05-07T10:00:00.000Z',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Release boundary checked.',
    });

    expect(result.status).toBe(403);
    expect(result.body.response).toMatchObject({
      boundaryId: 'confirm_money_released',
      actionId: 'bank.confirm_money_released',
      serviceName: 'money',
      status: 'not_accepted',
      canClaimExecuted: false,
      persisted: false,
      attemptedRuntimeWrite: false,
    });
  });
});
