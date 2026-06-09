import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route trip gate', () => {
  it('blocks driver arrival when trip id is missing', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'mark_trip_arrived',
      actorId: 'driver-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'mark_trip_arrived',
      actorId: 'driver-1',
      actorRole: 'driver',
      entityId: 'deal-1',
      entityType: 'deal',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T04:40:00.000Z',
      summary: 'Trip arrival boundary checked.',
      payload: {
        dealId: 'deal-1',
        arrivedAt: '2026-05-08T06:10:00.000Z',
        geoPoint: { lat: 47.23, lon: 39.7 },
        evidenceRefs: ['evidence/trip-1-arrival-photo.jpg'],
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.body.tripGateSummary).toMatchObject({
      status: 'blocked_missing_trip_id',
      canReachTripRuntimeBoundary: false,
      canClaimTripStateChanged: false,
      mayAffectMoney: false,
    });
  });

  it('exposes ready trip gate for driver arrival boundary with explicit trip id', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'mark_trip_arrived',
      actorId: 'driver-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'mark_trip_arrived',
      actorId: 'driver-1',
      actorRole: 'driver',
      entityId: 'deal-1',
      entityType: 'deal',
      tripId: 'trip-1',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T04:40:00.000Z',
      summary: 'Trip arrival boundary checked.',
      payload: {
        tripId: 'trip-1',
        dealId: 'deal-1',
        arrivedAt: '2026-05-08T06:10:00.000Z',
        geoPoint: { lat: 47.23, lon: 39.7 },
        evidenceRefs: ['evidence/trip-1-arrival-photo.jpg'],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.tripGateSummary).toMatchObject({
      status: 'ready_for_trip_runtime_boundary',
      canReachTripRuntimeBoundary: true,
      canClaimTripStateChanged: false,
      mayAffectMoney: false,
    });
  });

  it('accepts trip id from payload for clients that cannot send top-level fields', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'mark_trip_arrived',
      actorId: 'driver-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'mark_trip_arrived',
      actorId: 'driver-1',
      actorRole: 'driver',
      entityId: 'deal-1',
      entityType: 'deal',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T04:40:00.000Z',
      summary: 'Trip arrival boundary checked.',
      payload: {
        tripId: 'trip-1',
        dealId: 'deal-1',
        arrivedAt: '2026-05-08T06:10:00.000Z',
        geoPoint: { lat: 47.23, lon: 39.7 },
        evidenceRefs: ['evidence/trip-1-arrival-photo.jpg'],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.tripGateSummary).toMatchObject({
      status: 'ready_for_trip_runtime_boundary',
      canReachTripRuntimeBoundary: true,
    });
  });

  it('marks trip acceptance route boundary as money-impacting without claiming state change', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'accept_trip',
      actorId: 'elevator-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'accept_trip',
      actorId: 'elevator-1',
      actorRole: 'elevator',
      entityId: 'deal-1',
      entityType: 'deal',
      tripId: 'trip-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      occurredAt: '2026-05-08T04:40:00.000Z',
      summary: 'Trip acceptance boundary checked.',
      payload: {
        dealId: 'deal-1',
        tripId: 'trip-1',
        acceptedAt: '2026-05-08T07:30:00.000Z',
        weightTons: 24.6,
        acceptanceEventId: 'acceptance-1',
        evidenceRefs: ['evidence/trip-1-acceptance-act.pdf'],
      },
    });

    expect(result.body.tripGateSummary).toMatchObject({
      status: 'ready_for_trip_runtime_boundary',
      canReachTripRuntimeBoundary: true,
      canClaimTripStateChanged: false,
      mayAffectMoney: true,
    });
  });

  it('allows trip acceptance without treating it as a direct money operation', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'accept_trip',
      actorId: 'elevator-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'accept_trip',
      actorId: 'elevator-1',
      actorRole: 'elevator',
      entityId: 'deal-1',
      entityType: 'deal',
      tripId: 'trip-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      occurredAt: '2026-05-08T04:40:00.000Z',
      summary: 'Trip acceptance boundary checked.',
      payload: {
        dealId: 'deal-1',
        tripId: 'trip-1',
        acceptedAt: '2026-05-08T07:30:00.000Z',
        weightTons: 24.6,
        acceptanceEventId: 'acceptance-1',
        evidenceRefs: ['evidence/trip-1-acceptance-act.pdf'],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.tripGateSummary).toMatchObject({
      status: 'ready_for_trip_runtime_boundary',
      canReachTripRuntimeBoundary: true,
      canClaimTripStateChanged: false,
      mayAffectMoney: true,
    });
    expect(result.body.auditSummary).toMatchObject({
      canProceed: true,
      moneyAuditComplete: true,
    });
    expect(result.body.moneyGuardSummary).toMatchObject({
      status: 'not_money_boundary',
      canReachMoneyRuntimeBoundary: true,
      canClaimMoneyMoved: false,
      amountValid: true,
    });
  });

  it('allows incident opening without treating it as a direct money operation', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'open_incident',
      actorId: 'driver-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'open_incident',
      actorId: 'driver-1',
      actorRole: 'driver',
      entityId: 'deal-1',
      entityType: 'deal',
      tripId: 'trip-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      occurredAt: '2026-05-08T04:40:00.000Z',
      summary: 'Trip incident boundary checked.',
      payload: {
        dealId: 'deal-1',
        tripId: 'trip-1',
        reason: 'weight_mismatch',
        evidenceRefs: ['evidence/trip-1-weight.pdf'],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.tripGateSummary).toMatchObject({
      status: 'ready_for_trip_runtime_boundary',
      canReachTripRuntimeBoundary: true,
      canClaimTripStateChanged: false,
      mayAffectMoney: true,
    });
    expect(result.body.moneyGuardSummary).toMatchObject({
      status: 'not_money_boundary',
      canReachMoneyRuntimeBoundary: true,
      canClaimMoneyMoved: false,
      amountValid: true,
    });
  });
});
