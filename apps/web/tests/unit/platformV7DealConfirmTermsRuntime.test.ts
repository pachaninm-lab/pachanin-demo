import { describe, expect, it } from 'vitest';
import {
  applyPlatformV7RuntimeAction,
  createPlatformV7ExecutionState,
  type PlatformV7RuntimeActionCommand,
} from '@/lib/platform-v7/execution-state-spine';

function confirmTermsCommand(overrides: Partial<PlatformV7RuntimeActionCommand> = {}): PlatformV7RuntimeActionCommand {
  return {
    actionId: 'deal.confirm_terms',
    actorRole: 'buyer',
    entityType: 'deal',
    entityId: 'deal-terms-001',
    idempotencyKey: 'idem-confirm-terms-001',
    ...overrides,
  };
}

describe('platform-v7 deal terms confirmation runtime', () => {
  it('moves a draft deal to awaiting reserve without touching money, documents or trip state', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      confirmTermsCommand(),
      () => '2026-05-10T22:45:00.000Z',
    );

    expect(result.ok).toBe(true);
    expect(result.stateChanged).toBe(true);
    expect(result.moneyImpact).toBe('none');
    expect(result.documentImpact).toBe('none');
    expect(result.tripImpact).toBe('none');
    expect(result.nextAction).toBe('Запросить резерв денег у банка.');

    expect(nextState.dealStatus).toBe('awaiting_reserve');
    expect(nextState.money).toBeNull();
    expect(nextState.documents).toHaveLength(0);
    expect(nextState.trip).toBeNull();

    expect(nextState.auditEvents).toHaveLength(1);
    expect(nextState.auditEvents[0]).toMatchObject({
      actorRole: 'buyer',
      actionId: 'deal.confirm_terms',
      entityType: 'deal',
      entityId: 'deal-terms-001',
      result: 'accepted',
      idempotencyKey: 'idem-confirm-terms-001',
      source: 'simulated_runtime',
    });
  });

  it('keeps seller and buyer symmetric for terms confirmation', () => {
    const state = createPlatformV7ExecutionState('deal-002');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      confirmTermsCommand({ actorRole: 'seller', entityId: 'deal-terms-002', idempotencyKey: 'idem-confirm-terms-002' }),
      () => '2026-05-10T22:46:00.000Z',
    );

    expect(result.ok).toBe(true);
    expect(nextState.dealStatus).toBe('awaiting_reserve');
    expect(nextState.auditEvents[0]?.actorRole).toBe('seller');
    expect(nextState.money).toBeNull();
  });

  it('keeps confirmation idempotent and does not duplicate audit events', () => {
    const state = createPlatformV7ExecutionState('deal-003');
    const [nextState] = applyPlatformV7RuntimeAction(
      state,
      confirmTermsCommand({ entityId: 'deal-terms-003', idempotencyKey: 'idem-confirm-terms-003' }),
      () => '2026-05-10T22:47:00.000Z',
    );

    const [afterDuplicate, duplicateResult] = applyPlatformV7RuntimeAction(
      nextState,
      confirmTermsCommand({ entityId: 'deal-terms-003', idempotencyKey: 'idem-confirm-terms-003' }),
      () => '2026-05-10T22:48:00.000Z',
    );

    expect(duplicateResult.ok).toBe(true);
    expect(duplicateResult.stateChanged).toBe(false);
    expect(afterDuplicate).toBe(nextState);
    expect(afterDuplicate.auditEvents).toHaveLength(1);
    expect(afterDuplicate.dealStatus).toBe('awaiting_reserve');
  });

  it('blocks terms confirmation once the deal is already past draft', () => {
    const state = createPlatformV7ExecutionState('deal-004');
    const [awaitingReserveState] = applyPlatformV7RuntimeAction(
      state,
      confirmTermsCommand({ entityId: 'deal-terms-004', idempotencyKey: 'idem-confirm-terms-004' }),
      () => '2026-05-10T22:49:00.000Z',
    );

    const [afterBlocked, blockedResult] = applyPlatformV7RuntimeAction(
      awaitingReserveState,
      confirmTermsCommand({ entityId: 'deal-terms-004b', idempotencyKey: 'idem-confirm-terms-004b' }),
      () => '2026-05-10T22:50:00.000Z',
    );

    expect(blockedResult.ok).toBe(false);
    expect(blockedResult.stateChanged).toBe(false);
    expect(blockedResult.moneyImpact).toBe('none');
    expect(blockedResult.blockedReason).toBe('Нельзя подтвердить условия сделки из статуса awaiting_reserve.');
    expect(afterBlocked).toBe(awaitingReserveState);
    expect(afterBlocked.auditEvents).toHaveLength(1);
  });

  it('keeps observer roles out of deal terms confirmation', () => {
    const state = createPlatformV7ExecutionState('deal-005');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      confirmTermsCommand({ actorRole: 'investor', entityId: 'deal-terms-005', idempotencyKey: 'idem-confirm-terms-005' }),
      () => '2026-05-10T22:51:00.000Z',
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(nextState.dealStatus).toBe('draft');
    expect(nextState.auditEvents).toHaveLength(0);
  });
});
