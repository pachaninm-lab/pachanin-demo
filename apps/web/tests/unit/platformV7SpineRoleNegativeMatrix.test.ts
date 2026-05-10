import { describe, expect, it } from 'vitest';
import {
  applyPlatformV7RuntimeAction,
  createPlatformV7ExecutionState,
} from '@/lib/platform-v7/execution-state-spine';
import type { PlatformV7RuntimeActionCommand } from '@/lib/platform-v7/execution-state-spine';

function makeCmd(overrides: Partial<PlatformV7RuntimeActionCommand>): PlatformV7RuntimeActionCommand {
  return {
    actionId: 'bank.confirm_money_released',
    actorRole: 'seller',
    entityType: 'money',
    entityId: 'money-001',
    idempotencyKey: 'idem-spine-001',
    ...overrides,
  };
}

const initialState = createPlatformV7ExecutionState('deal-spine-001');

describe('platform-v7 spine role negative matrix', () => {
  it('blocks seller from bank money release at the spine level — no state change, moneyImpact none', () => {
    const [nextState, result] = applyPlatformV7RuntimeAction(
      initialState,
      makeCmd({ actorRole: 'seller', actionId: 'bank.confirm_money_released', idempotencyKey: 'idem-sn-001' }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.moneyImpact).toBe('none');
    expect(result.blockedReason).toBeTruthy();
    expect(nextState.money).toBeNull();
    expect(nextState.auditEvents).toHaveLength(0);
  });

  it('blocks buyer from bank money reservation at the spine level — no state change', () => {
    const [nextState, result] = applyPlatformV7RuntimeAction(
      initialState,
      makeCmd({ actorRole: 'buyer', actionId: 'bank.confirm_money_reserved', idempotencyKey: 'idem-sn-002' }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.moneyImpact).toBe('none');
    expect(nextState.money).toBeNull();
    expect(nextState.auditEvents).toHaveLength(0);
  });

  it('blocks logistics from bank money confirmation at the spine level', () => {
    const [nextState, result] = applyPlatformV7RuntimeAction(
      initialState,
      makeCmd({ actorRole: 'logistics', actionId: 'bank.confirm_money_released', idempotencyKey: 'idem-sn-003' }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.moneyImpact).toBe('none');
    expect(nextState.money).toBeNull();
  });

  it('blocks lab from bank money confirmation at the spine level', () => {
    const [nextState, result] = applyPlatformV7RuntimeAction(
      initialState,
      makeCmd({ actorRole: 'lab', actionId: 'bank.confirm_money_released', idempotencyKey: 'idem-sn-004' }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.moneyImpact).toBe('none');
    expect(nextState.money).toBeNull();
  });

  it('blocks elevator from bank money confirmation at the spine level', () => {
    const [nextState, result] = applyPlatformV7RuntimeAction(
      initialState,
      makeCmd({ actorRole: 'elevator', actionId: 'bank.confirm_money_released', idempotencyKey: 'idem-sn-005' }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.moneyImpact).toBe('none');
    expect(nextState.money).toBeNull();
  });

  it('blocks surveyor from bank money confirmation at the spine level', () => {
    const [nextState, result] = applyPlatformV7RuntimeAction(
      initialState,
      makeCmd({ actorRole: 'surveyor', actionId: 'bank.confirm_money_released', idempotencyKey: 'idem-sn-006' }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.moneyImpact).toBe('none');
    expect(nextState.money).toBeNull();
  });

  it('blocks compliance from bank money release at the spine level', () => {
    const [nextState, result] = applyPlatformV7RuntimeAction(
      initialState,
      makeCmd({ actorRole: 'compliance', actionId: 'bank.confirm_money_released', idempotencyKey: 'idem-sn-007' }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.moneyImpact).toBe('none');
    expect(nextState.money).toBeNull();
  });

  it('blocks arbitrator from bank money release at the spine level', () => {
    const [nextState, result] = applyPlatformV7RuntimeAction(
      initialState,
      makeCmd({ actorRole: 'arbitrator', actionId: 'bank.confirm_money_released', idempotencyKey: 'idem-sn-008' }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.moneyImpact).toBe('none');
    expect(nextState.money).toBeNull();
  });

  it('distinguishes permission-blocked (moneyImpact: none) from adapter-blocked (moneyImpact: requires_bank_confirmation_adapter)', () => {
    const [, sellerResult] = applyPlatformV7RuntimeAction(
      initialState,
      makeCmd({ actorRole: 'seller', actionId: 'bank.confirm_money_released', idempotencyKey: 'idem-sn-009' }),
    );

    const [, bankResult] = applyPlatformV7RuntimeAction(
      initialState,
      makeCmd({ actorRole: 'bank', actionId: 'bank.confirm_money_released', idempotencyKey: 'idem-sn-010' }),
    );

    // wrong role → permission boundary → moneyImpact: none
    expect(sellerResult.ok).toBe(false);
    expect(sellerResult.moneyImpact).toBe('none');

    // correct role but no adapter → BANK_MONEY_ACTIONS guard → moneyImpact: requires_bank_confirmation_adapter
    expect(bankResult.ok).toBe(false);
    expect(bankResult.moneyImpact).toBe('requires_bank_confirmation_adapter');
  });

  it('blocks seller from trip acceptance — seller cannot confirm physical receipt', () => {
    const [nextState, result] = applyPlatformV7RuntimeAction(
      initialState,
      makeCmd({
        actorRole: 'seller',
        actionId: 'trip.accept',
        entityType: 'trip',
        entityId: 'trip-001',
        idempotencyKey: 'idem-sn-011',
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.tripImpact).toBe('none');
    expect(nextState.trip).toBeNull();
  });

  it('blocks buyer from trip acceptance — buyer cannot confirm physical receipt', () => {
    const [nextState, result] = applyPlatformV7RuntimeAction(
      initialState,
      makeCmd({
        actorRole: 'buyer',
        actionId: 'trip.accept',
        entityType: 'trip',
        entityId: 'trip-002',
        idempotencyKey: 'idem-sn-012',
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.tripImpact).toBe('none');
    expect(nextState.trip).toBeNull();
  });

  it('no role blocks leave any state change — spine guarantees clean no-mutation on permission failure', () => {
    const blockedCases: Array<{ actorRole: PlatformV7RuntimeActionCommand['actorRole']; actionId: PlatformV7RuntimeActionCommand['actionId'] }> = [
      { actorRole: 'seller', actionId: 'bank.confirm_money_released' },
      { actorRole: 'buyer', actionId: 'bank.confirm_money_reserved' },
      { actorRole: 'logistics', actionId: 'bank.confirm_money_released' },
      { actorRole: 'lab', actionId: 'bank.confirm_money_released' },
      { actorRole: 'elevator', actionId: 'bank.confirm_money_released' },
      { actorRole: 'surveyor', actionId: 'bank.confirm_money_released' },
    ];

    blockedCases.forEach(({ actorRole, actionId }, i) => {
      const [nextState, result] = applyPlatformV7RuntimeAction(
        initialState,
        makeCmd({ actorRole, actionId, idempotencyKey: `idem-sn-batch-${i}` }),
      );

      expect(result.stateChanged, `${actorRole}:${actionId}`).toBe(false);
      expect(nextState.auditEvents, `${actorRole}:${actionId}`).toHaveLength(0);
      expect(nextState.money, `${actorRole}:${actionId}`).toBeNull();
    });
  });
});
