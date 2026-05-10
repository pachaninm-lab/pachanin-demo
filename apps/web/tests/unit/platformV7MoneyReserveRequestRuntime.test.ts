import { describe, expect, it } from 'vitest';
import {
  applyPlatformV7RuntimeAction,
  createPlatformV7ExecutionState,
  type PlatformV7RuntimeActionCommand,
} from '@/lib/platform-v7/execution-state-spine';

function reserveCommand(overrides: Partial<PlatformV7RuntimeActionCommand> = {}): PlatformV7RuntimeActionCommand {
  return {
    actionId: 'money.request_reserve',
    actorRole: 'buyer',
    entityType: 'money',
    entityId: 'deal-money-001',
    idempotencyKey: 'idem-reserve-001',
    payload: { requestedAmountRub: 12_500_000 },
    ...overrides,
  };
}

describe('platform-v7 money reserve request runtime', () => {
  it('records buyer reserve request as awaiting bank event without confirming reserved money', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      reserveCommand(),
      () => '2026-05-10T22:30:00.000Z',
    );

    expect(result.ok).toBe(true);
    expect(result.stateChanged).toBe(true);
    expect(result.moneyImpact).toBe('requires_bank_confirmation');
    expect(result.nextAction).toBe('Ожидается подтверждение банка по резерву денег.');

    expect(nextState.money).not.toBeNull();
    expect(nextState.money?.totalDealAmountRub).toBe(12_500_000);
    expect(nextState.money?.reservedAmountRub).toBe(0);
    expect(nextState.money?.readyToReleaseRub).toBe(0);
    expect(nextState.money?.releasedAmountRub).toBe(0);
    expect(nextState.money?.reconciliationStatus).toBe('awaiting_bank_event');

    expect(nextState.auditEvents).toHaveLength(1);
    expect(nextState.auditEvents[0]).toMatchObject({
      actorRole: 'buyer',
      actionId: 'money.request_reserve',
      entityType: 'money',
      entityId: 'deal-money-001',
      result: 'accepted',
      idempotencyKey: 'idem-reserve-001',
      source: 'simulated_runtime',
    });
  });

  it('keeps reserve request idempotent and does not create duplicate audit entries', () => {
    const state = createPlatformV7ExecutionState('deal-002');
    const [nextState] = applyPlatformV7RuntimeAction(
      state,
      reserveCommand({ entityId: 'deal-money-002', idempotencyKey: 'idem-reserve-002' }),
      () => '2026-05-10T22:31:00.000Z',
    );

    const [afterDuplicate, duplicateResult] = applyPlatformV7RuntimeAction(
      nextState,
      reserveCommand({ entityId: 'deal-money-002', idempotencyKey: 'idem-reserve-002' }),
      () => '2026-05-10T22:32:00.000Z',
    );

    expect(duplicateResult.ok).toBe(true);
    expect(duplicateResult.stateChanged).toBe(false);
    expect(duplicateResult.moneyImpact).toBe('none');
    expect(afterDuplicate).toBe(nextState);
    expect(afterDuplicate.auditEvents).toHaveLength(1);
    expect(afterDuplicate.money?.reservedAmountRub).toBe(0);
  });

  it('keeps seller out of reserve requests at the permission boundary', () => {
    const state = createPlatformV7ExecutionState('deal-003');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      reserveCommand({ actorRole: 'seller', idempotencyKey: 'idem-reserve-003' }),
      () => '2026-05-10T22:33:00.000Z',
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.moneyImpact).toBe('none');
    expect(nextState.money).toBeNull();
    expect(nextState.auditEvents).toHaveLength(0);
  });

  it('still blocks bank confirmation without an external adapter after a buyer reserve request', () => {
    const state = createPlatformV7ExecutionState('deal-004');
    const [nextState] = applyPlatformV7RuntimeAction(
      state,
      reserveCommand({ entityId: 'deal-money-004', idempotencyKey: 'idem-reserve-004' }),
      () => '2026-05-10T22:34:00.000Z',
    );

    const [, bankResult] = applyPlatformV7RuntimeAction(
      nextState,
      {
        actionId: 'bank.confirm_money_reserved',
        actorRole: 'bank',
        entityType: 'money',
        entityId: 'deal-money-004',
        idempotencyKey: 'idem-bank-reserve-004',
      },
      () => '2026-05-10T22:35:00.000Z',
    );

    expect(bankResult.ok).toBe(false);
    expect(bankResult.stateChanged).toBe(false);
    expect(bankResult.moneyImpact).toBe('requires_bank_confirmation_adapter');
    expect(nextState.money?.reservedAmountRub).toBe(0);
  });
});
