import { describe, expect, it } from 'vitest';
import {
  applyPlatformV7RuntimeAction,
  createPlatformV7ExecutionState,
} from '@/lib/platform-v7/execution-state-spine';
import type { PlatformV7RuntimeActionCommand } from '@/lib/platform-v7/execution-state-spine';

function makeCmd(
  overrides: Partial<PlatformV7RuntimeActionCommand>,
): PlatformV7RuntimeActionCommand {
  return {
    actionId: 'support.create_case',
    actorRole: 'seller',
    entityType: 'support',
    entityId: 'case-001',
    idempotencyKey: 'idem-001',
    ...overrides,
  };
}

describe('platform-v7 runtime action apply', () => {
  it('permission denied does not change state', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    // investor is not in support participant roles
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      makeCmd({ actorRole: 'investor', actionId: 'support.create_case' }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.blockedReason).toBeTruthy();
    expect(nextState.support).toHaveLength(0);
    expect(nextState.auditEvents).toHaveLength(0);
  });

  it('support.create_case by seller creates state change and audit event', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      makeCmd({ actorRole: 'seller', actionId: 'support.create_case', entityId: 'case-101' }),
    );

    expect(result.ok).toBe(true);
    expect(result.stateChanged).toBe(true);
    expect(result.supportImpact).toBe('case_created');
    expect(result.moneyImpact).toBe('none');
    expect(result.auditEventId).toMatch(/^audit-/);
    expect(nextState.support).toHaveLength(1);
    expect(nextState.support[0].entityId).toBe('case-101');
    expect(nextState.auditEvents).toHaveLength(1);
    expect(nextState.auditEvents[0].result).toBe('accepted');
    expect(nextState.auditEvents[0].source).toBe('simulated_runtime');
  });

  it('driver.confirm_checkpoint changes trip state and writes audit event', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      makeCmd({
        actorRole: 'driver',
        actionId: 'driver.confirm_checkpoint',
        entityType: 'trip',
        entityId: 'trip-001',
        payload: { checkpoint: 'arrived_to_loading' },
        idempotencyKey: 'idem-drv-001',
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.tripImpact).toBe('checkpoint_advanced');
    expect(result.moneyImpact).toBe('none');
    expect(nextState.trip).not.toBeNull();
    expect(nextState.trip?.checkpoints).toHaveLength(1);
    expect(nextState.trip?.checkpoints[0].checkpoint).toBe('arrived_to_loading');
    expect(nextState.auditEvents).toHaveLength(1);
  });

  it('document.attach changes document state but does not affect money', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      makeCmd({
        actorRole: 'seller',
        actionId: 'document.attach',
        entityType: 'document',
        entityId: 'doc-001',
        payload: { documentRef: 'sdiz-2024-001' },
        idempotencyKey: 'idem-doc-001',
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.documentImpact).toBe('attached');
    expect(result.moneyImpact).toBe('none');
    expect(nextState.documents).toHaveLength(1);
    expect(nextState.documents[0].documentRef).toBe('sdiz-2024-001');
    expect(nextState.money).toBeNull();
  });

  it('trip.open_incident opens incident but does not release money', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      makeCmd({
        actorRole: 'driver',
        actionId: 'trip.open_incident',
        entityType: 'trip',
        entityId: 'trip-002',
        payload: { incidentRef: 'inc-weight-mismatch' },
        idempotencyKey: 'idem-inc-001',
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.tripImpact).toBe('incident_opened');
    expect(result.moneyImpact).toBe('none');
    expect(nextState.trip?.incidents).toContain('inc-weight-mismatch');
    expect(nextState.money).toBeNull();
  });

  it('bank.confirm_money_released without adapter returns blocked with requires_bank_confirmation_adapter', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      makeCmd({
        actorRole: 'bank',
        actionId: 'bank.confirm_money_released',
        entityType: 'money',
        entityId: 'money-001',
        idempotencyKey: 'idem-bank-001',
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.moneyImpact).toBe('requires_bank_confirmation_adapter');
    // State untouched — no fake release
    expect(nextState.money).toBeNull();
    expect(nextState.auditEvents).toHaveLength(0);
  });

  it('investor cannot perform durable writes', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      makeCmd({ actorRole: 'investor', actionId: 'document.attach', idempotencyKey: 'idem-inv-001' }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(nextState.documents).toHaveLength(0);
  });

  it('executive cannot perform durable writes', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      makeCmd({ actorRole: 'executive', actionId: 'support.create_case', idempotencyKey: 'idem-exec-001' }),
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(nextState.support).toHaveLength(0);
  });

  it('idempotencyKey is present on every accepted runtime action result', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    const [, result] = applyPlatformV7RuntimeAction(
      state,
      makeCmd({ idempotencyKey: 'idem-stable-001' }),
    );

    expect(result.idempotencyKey).toBe('idem-stable-001');
  });

  it('repeated idempotencyKey does not create duplicate audit event', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    const cmd = makeCmd({ idempotencyKey: 'idem-dup-001' });

    const [state1] = applyPlatformV7RuntimeAction(state, cmd);
    const [state2, result2] = applyPlatformV7RuntimeAction(state1, cmd);

    expect(state2.auditEvents).toHaveLength(1);
    expect(result2.stateChanged).toBe(false);
  });

  it('mode does not claim external or live', () => {
    const state = createPlatformV7ExecutionState('deal-001');

    expect(state.mode).not.toBe('external_confirmed');
    expect(state.mode).not.toContain('live');
    expect(state.mode).not.toContain('production');
  });
});
