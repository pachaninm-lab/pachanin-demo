import { describe, expect, it } from 'vitest';
import {
  applyPlatformV7RuntimeAction,
  createPlatformV7ExecutionState,
  type PlatformV7ExecutionStateMode,
} from '@/lib/platform-v7/execution-state-spine';

const FORBIDDEN_CLAIM_TERMS = [
  'production-ready',
  'fully live',
  'fully integrated',
  'live bank',
  'live integration',
  'live callback',
  'guaranteed payment',
  'autonomous release',
  'automatic release',
  'platform releases money',
  'platform guarantees payment',
  'bank confirmed',
  'деньги выпущены',
  'банк подтвердил',
  'платёж гарантирован',
  'автоматический выпуск',
] as const;

const ALL_MODES: readonly PlatformV7ExecutionStateMode[] = [
  'contract_only',
  'simulated_runtime',
  'pre_integration',
  'external_confirmed',
];

const SAFE_NON_DEFAULT_MODES: readonly PlatformV7ExecutionStateMode[] = [
  'contract_only',
  'pre_integration',
  'external_confirmed',
];

describe('platform-v7 honesty mode guards', () => {
  it('default mode is simulated_runtime — never pre_integration, never external_confirmed', () => {
    const state = createPlatformV7ExecutionState('deal-hmg-001');

    expect(state.mode).toBe('simulated_runtime');
    expect(state.mode).not.toBe('pre_integration');
    expect(state.mode).not.toBe('external_confirmed');
    expect(state.mode).not.toBe('contract_only');
  });

  it('mode can be set explicitly to any of the four values — nothing more', () => {
    for (const mode of ALL_MODES) {
      const state = createPlatformV7ExecutionState('deal-hmg-002', mode);
      expect(state.mode).toBe(mode);
    }
  });

  it('applying actions in simulated_runtime mode always produces simulated_runtime audit source', () => {
    const state = createPlatformV7ExecutionState('deal-hmg-003', 'simulated_runtime');
    const [nextState, result] = applyPlatformV7RuntimeAction(state, {
      actionId: 'support.create_case',
      actorRole: 'seller',
      entityType: 'support',
      entityId: 'case-hmg-001',
      idempotencyKey: 'idem-hmg-001',
    });

    expect(result.ok).toBe(true);
    expect(nextState.auditEvents).toHaveLength(1);
    expect(nextState.auditEvents[0].source).toBe('simulated_runtime');
    expect(nextState.auditEvents[0].source).not.toBe('external_system');
    expect(nextState.auditEvents[0].source).not.toBe('pre_integration_adapter');
  });

  it('mode is not mutated by action dispatch — spine never promotes mode to external_confirmed', () => {
    for (const mode of ALL_MODES) {
      const state = createPlatformV7ExecutionState('deal-hmg-004', mode);
      const [nextState] = applyPlatformV7RuntimeAction(state, {
        actionId: 'support.create_case',
        actorRole: 'seller',
        entityType: 'support',
        entityId: 'case-hmg-002',
        idempotencyKey: `idem-hmg-002-${mode}`,
      });

      expect(nextState.mode).toBe(mode);
    }
  });

  it('bank actions in simulated_runtime mode return requires_bank_confirmation_adapter — not a live release', () => {
    const state = createPlatformV7ExecutionState('deal-hmg-005', 'simulated_runtime');
    const [nextState, result] = applyPlatformV7RuntimeAction(state, {
      actionId: 'bank.confirm_money_released',
      actorRole: 'bank',
      entityType: 'money',
      entityId: 'money-hmg-001',
      idempotencyKey: 'idem-hmg-003',
    });

    expect(result.ok).toBe(false);
    expect(result.moneyImpact).toBe('requires_bank_confirmation_adapter');
    expect(result.stateChanged).toBe(false);
    expect(nextState.money).toBeNull();
  });

  it('bank actions in pre_integration mode are still blocked — pre_integration does not imply live bank confirmation', () => {
    const state = createPlatformV7ExecutionState('deal-hmg-006', 'pre_integration');
    const [nextState, result] = applyPlatformV7RuntimeAction(state, {
      actionId: 'bank.confirm_money_released',
      actorRole: 'bank',
      entityType: 'money',
      entityId: 'money-hmg-002',
      idempotencyKey: 'idem-hmg-004',
    });

    expect(result.ok).toBe(false);
    expect(result.moneyImpact).toBe('requires_bank_confirmation_adapter');
    expect(result.stateChanged).toBe(false);
    expect(nextState.money).toBeNull();
  });

  it('bank actions in external_confirmed mode are still adapter-blocked — no fake release even in highest mode', () => {
    const state = createPlatformV7ExecutionState('deal-hmg-007', 'external_confirmed');
    const [nextState, result] = applyPlatformV7RuntimeAction(state, {
      actionId: 'bank.confirm_money_reserved',
      actorRole: 'bank',
      entityType: 'money',
      entityId: 'money-hmg-003',
      idempotencyKey: 'idem-hmg-005',
    });

    expect(result.ok).toBe(false);
    expect(result.moneyImpact).toBe('requires_bank_confirmation_adapter');
    expect(nextState.money).toBeNull();
  });

  it('blocked reason strings from the spine do not contain forbidden English claim terms', () => {
    const blockedResults: Array<{ role: Parameters<typeof applyPlatformV7RuntimeAction>[1]['actorRole']; actionId: Parameters<typeof applyPlatformV7RuntimeAction>[1]['actionId']; key: string }> = [
      { role: 'bank', actionId: 'bank.confirm_money_released', key: 'idem-hmg-f1' },
      { role: 'bank', actionId: 'bank.confirm_money_reserved', key: 'idem-hmg-f2' },
      { role: 'bank', actionId: 'bank.mark_money_ready_to_release', key: 'idem-hmg-f3' },
      { role: 'seller', actionId: 'bank.confirm_money_released', key: 'idem-hmg-f4' },
      { role: 'investor', actionId: 'support.create_case', key: 'idem-hmg-f5' },
    ];

    const state = createPlatformV7ExecutionState('deal-hmg-008');

    for (const { role, actionId, key } of blockedResults) {
      const [, result] = applyPlatformV7RuntimeAction(state, {
        actionId,
        actorRole: role,
        entityType: 'money',
        entityId: 'money-hmg-check',
        idempotencyKey: key,
      });

      expect(result.ok, `${role}:${actionId} should be blocked`).toBe(false);

      for (const term of FORBIDDEN_CLAIM_TERMS) {
        const reason = result.blockedReason ?? '';
        expect(reason, `blocked reason for ${role}:${actionId} must not contain "${term}"`).not.toContain(term);
      }
    }
  });

  it('simulated_runtime mode cannot reach external_confirmed — mode set must be explicit and stable', () => {
    const states = SAFE_NON_DEFAULT_MODES.map((mode) => createPlatformV7ExecutionState('deal-hmg-009', mode));

    for (const state of states) {
      expect(state.mode).not.toBe('simulated_runtime');
    }

    const defaultState = createPlatformV7ExecutionState('deal-hmg-010');
    expect(SAFE_NON_DEFAULT_MODES).not.toContain(defaultState.mode);
  });

  it('audit events produced by simulated actions are honest about their source — never external_system', () => {
    const ACCEPTED_ACTIONS: Array<{ actionId: Parameters<typeof applyPlatformV7RuntimeAction>[1]['actionId']; actorRole: Parameters<typeof applyPlatformV7RuntimeAction>[1]['actorRole']; entityType: string }> = [
      { actionId: 'support.create_case', actorRole: 'seller', entityType: 'support' },
      { actionId: 'driver.confirm_checkpoint', actorRole: 'driver', entityType: 'trip' },
      { actionId: 'document.attach', actorRole: 'seller', entityType: 'document' },
      { actionId: 'trip.open_incident', actorRole: 'driver', entityType: 'trip' },
    ];

    let state = createPlatformV7ExecutionState('deal-hmg-011', 'simulated_runtime');

    ACCEPTED_ACTIONS.forEach(({ actionId, actorRole, entityType }, i) => {
      const [nextState, result] = applyPlatformV7RuntimeAction(state, {
        actionId,
        actorRole,
        entityType,
        entityId: `entity-hmg-${i}`,
        idempotencyKey: `idem-hmg-audit-${i}`,
        payload: i === 1 ? { checkpoint: 'arrived_to_loading' } : i === 3 ? { incidentRef: `inc-${i}` } : undefined,
      });

      expect(result.ok, `${actionId} should succeed`).toBe(true);
      state = nextState;
    });

    for (const event of state.auditEvents) {
      expect(event.source, `audit event ${event.id} must not claim external system`).not.toBe('external_system');
      expect(event.source, `audit event ${event.id} must not claim pre-integration adapter`).not.toBe('pre_integration_adapter');
      expect(event.source).toBe('simulated_runtime');
    }
  });
});
