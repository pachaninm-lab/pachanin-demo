import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route trip gate', () => {
  it('exposes ready trip gate for driver arrival boundary', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'mark_trip_arrived',
      actorId: 'driver-1',
      entityId: 'trip-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'mark_trip_arrived',
      actorId: 'driver-1',
      actorRole: 'driver',
      entityId: 'trip-1',
      entityType: 'trip',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T04:40:00.000Z',
      summary: 'Trip arrival boundary checked.',
    });

    expect(result.body.tripGateSummary).toMatchObject({
      status: 'ready_for_trip_runtime_boundary',
      canReachTripRuntimeBoundary: true,
      canClaimTripStateChanged: false,
      mayAffectMoney: false,
    });
  });

  it('marks trip acceptance route boundary as money-impacting without claiming state change', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'accept_trip',
      actorId: 'elevator-1',
      entityId: 'trip-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'accept_trip',
      actorId: 'elevator-1',
      actorRole: 'elevator',
      entityId: 'trip-1',
      entityType: 'trip',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      occurredAt: '2026-05-08T04:40:00.000Z',
      summary: 'Trip acceptance boundary checked.',
    });

    expect(result.body.tripGateSummary).toMatchObject({
      status: 'ready_for_trip_runtime_boundary',
      canReachTripRuntimeBoundary: true,
      canClaimTripStateChanged: false,
      mayAffectMoney: true,
    });
  });
});
