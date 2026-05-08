import { describe, expect, it } from 'vitest';
import { createPlatformV7MemoryPersistenceRepository, type PlatformV7PersistenceRepository } from '@/lib/platform-v7/persistence-repository';
import {
  buildPlatformV7ServerActionContractResponse,
  getPlatformV7ServerActionContractSummary,
} from '@/lib/platform-v7/server-action-contract-wrapper';

const durableRepository: PlatformV7PersistenceRepository = {
  ...createPlatformV7MemoryPersistenceRepository(),
  mode: 'durable_adapter_required',
};

describe('platform-v7 server action contract wrapper', () => {
  it('returns 403 for a role-forbidden boundary without claiming execution', () => {
    const response = buildPlatformV7ServerActionContractResponse(
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
      createPlatformV7MemoryPersistenceRepository(),
    );

    expect(response.status).toBe('not_accepted');
    expect(response.httpStatus).toBe(403);
    expect(response.canClaimExecuted).toBe(false);
    expect(response.persisted).toBe(false);
    expect(response.attemptedRuntimeWrite).toBe(false);
  });

  it('returns 202 for contract-checked boundaries without runtime execution', () => {
    const response = buildPlatformV7ServerActionContractResponse(
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
      createPlatformV7MemoryPersistenceRepository(),
    );

    expect(response.status).toBe('contract_checked');
    expect(response.httpStatus).toBe(202);
    expect(response.repositoryDurable).toBe(false);
    expect(response.canClaimExecuted).toBe(false);
  });

  it('summarizes safe response without execution claims', () => {
    const response = buildPlatformV7ServerActionContractResponse(
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
      durableRepository,
    );

    expect(getPlatformV7ServerActionContractSummary(response)).toEqual({
      boundaryId: 'mark_trip_arrived',
      actionId: 'driver.confirm_checkpoint',
      serviceName: 'trip',
      status: 'contract_checked',
      httpStatus: 202,
      canClaimExecuted: false,
      persisted: false,
      attemptedRuntimeWrite: false,
      repositoryDurable: true,
      issueCount: 1,
      signalCount: 2,
    });
  });
});
