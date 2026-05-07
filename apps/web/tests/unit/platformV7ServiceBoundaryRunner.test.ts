import { describe, expect, it } from 'vitest';
import { createPlatformV7MemoryPersistenceRepository } from '@/lib/platform-v7/persistence-repository';
import {
  canPlatformV7ServiceBoundaryPersist,
  getPlatformV7ServiceBoundarySummary,
  runPlatformV7ServiceBoundary,
} from '@/lib/platform-v7/service-boundary-runner';

describe('platform-v7 service boundary runner', () => {
  it('returns contract-only result without runtime write or persistence', () => {
    const repository = createPlatformV7MemoryPersistenceRepository();
    const run = runPlatformV7ServiceBoundary(
      {
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
      },
      repository,
    );

    expect(run.result.status).toBe('contract_only');
    expect(run.attemptedRuntimeWrite).toBe(false);
    expect(run.persisted).toBe(false);
    expect(run.repository.durable).toBe(false);
    expect(canPlatformV7ServiceBoundaryPersist(run)).toBe(false);
  });

  it('returns blocked result and observability signals for forbidden role action', () => {
    const repository = createPlatformV7MemoryPersistenceRepository();
    const run = runPlatformV7ServiceBoundary(
      {
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
      },
      repository,
    );

    expect(run.result.status).toBe('blocked');
    expect(run.observabilitySignals.map((signal) => signal.kind)).toContain('execution_money_boundary');
    expect(run.attemptedRuntimeWrite).toBe(false);
    expect(run.persisted).toBe(false);
  });

  it('returns compact summary without claiming execution', () => {
    const repository = createPlatformV7MemoryPersistenceRepository();
    const run = runPlatformV7ServiceBoundary(
      {
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
      },
      repository,
    );

    expect(getPlatformV7ServiceBoundarySummary(run)).toEqual({
      boundaryId: 'mark_trip_arrived',
      status: 'contract_only',
      attemptedRuntimeWrite: false,
      persisted: false,
      repositoryDurable: false,
      signalCount: 2,
      canPersist: false,
    });
  });
});
