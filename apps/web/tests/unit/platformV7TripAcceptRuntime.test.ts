import { describe, expect, it } from 'vitest';
import {
  applyPlatformV7RuntimeAction,
  createPlatformV7ExecutionState,
  type PlatformV7ExecutionState,
  type PlatformV7RuntimeActionCommand,
} from '@/lib/platform-v7/execution-state-spine';

function stateWithTrip(overrides: Partial<PlatformV7ExecutionState> = {}): PlatformV7ExecutionState {
  return {
    ...createPlatformV7ExecutionState('deal-trip-001'),
    dealStatus: 'awaiting_acceptance',
    trip: { status: 'unloaded', checkpoints: [], incidents: [] },
    ...overrides,
  };
}

function acceptTripCommand(overrides: Partial<PlatformV7RuntimeActionCommand> = {}): PlatformV7RuntimeActionCommand {
  return {
    actionId: 'trip.accept',
    actorRole: 'elevator',
    entityType: 'trip',
    entityId: 'trip-001',
    idempotencyKey: 'idem-trip-accept-001',
    ...overrides,
  };
}

describe('platform-v7 trip acceptance runtime', () => {
  it('moves an unloaded trip to completed and sends the deal to lab review', () => {
    const [nextState, result] = applyPlatformV7RuntimeAction(
      stateWithTrip(),
      acceptTripCommand(),
      () => '2026-05-11T03:30:00.000Z',
    );

    expect(result.ok).toBe(true);
    expect(result.stateChanged).toBe(true);
    expect(result.tripImpact).toBe('checkpoint_advanced');
    expect(result.moneyImpact).toBe('none');
    expect(result.documentImpact).toBe('none');
    expect(nextState.dealStatus).toBe('awaiting_lab');
    expect(nextState.trip?.status).toBe('completed');
    expect(nextState.money).toBeNull();
    expect(nextState.documents).toHaveLength(0);
    expect(nextState.auditEvents).toHaveLength(1);
  });

  it('keeps trip acceptance idempotent', () => {
    const [nextState] = applyPlatformV7RuntimeAction(
      stateWithTrip(),
      acceptTripCommand({ entityId: 'trip-002', idempotencyKey: 'idem-trip-accept-002' }),
      () => '2026-05-11T03:31:00.000Z',
    );

    const [afterDuplicate, duplicateResult] = applyPlatformV7RuntimeAction(
      nextState,
      acceptTripCommand({ entityId: 'trip-002', idempotencyKey: 'idem-trip-accept-002' }),
      () => '2026-05-11T03:32:00.000Z',
    );

    expect(duplicateResult.ok).toBe(true);
    expect(duplicateResult.stateChanged).toBe(false);
    expect(afterDuplicate).toBe(nextState);
    expect(afterDuplicate.auditEvents).toHaveLength(1);
  });

  it('blocks acceptance without trip state', () => {
    const state = { ...createPlatformV7ExecutionState('deal-no-trip'), dealStatus: 'awaiting_acceptance' as const };
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      acceptTripCommand({ entityId: 'trip-003', idempotencyKey: 'idem-trip-accept-003' }),
      () => '2026-05-11T03:33:00.000Z',
    );

    expect(result.ok).toBe(false);
    expect(result.blockedReason).toBe('Нет рейса для приёмки.');
    expect(nextState.trip).toBeNull();
    expect(nextState.auditEvents).toHaveLength(0);
  });

  it('blocks acceptance before deal acceptance status', () => {
    const state = stateWithTrip({ dealStatus: 'in_transit' });
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      acceptTripCommand({ entityId: 'trip-004', idempotencyKey: 'idem-trip-accept-004' }),
      () => '2026-05-11T03:34:00.000Z',
    );

    expect(result.ok).toBe(false);
    expect(result.blockedReason).toBe('Нельзя принять рейс из статуса сделки in_transit.');
    expect(nextState).toBe(state);
  });

  it('blocks acceptance before unloading', () => {
    const state = stateWithTrip({ trip: { status: 'in_transit', checkpoints: [], incidents: [] } });
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      acceptTripCommand({ entityId: 'trip-005', idempotencyKey: 'idem-trip-accept-005' }),
      () => '2026-05-11T03:35:00.000Z',
    );

    expect(result.ok).toBe(false);
    expect(result.blockedReason).toBe('Нельзя завершить рейс из статуса in_transit.');
    expect(nextState.trip?.status).toBe('in_transit');
  });

  it('keeps buyer out of trip acceptance', () => {
    const [nextState, result] = applyPlatformV7RuntimeAction(
      stateWithTrip(),
      acceptTripCommand({ actorRole: 'buyer', entityId: 'trip-006', idempotencyKey: 'idem-trip-accept-006' }),
      () => '2026-05-11T03:36:00.000Z',
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(nextState.dealStatus).toBe('awaiting_acceptance');
    expect(nextState.auditEvents).toHaveLength(0);
  });
});
