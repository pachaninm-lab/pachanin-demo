import { describe, expect, it } from 'vitest';
import {
  canPlatformV7Transition,
  doesPlatformV7TransitionAffectMoney,
  getPlatformV7AllowedNextStates,
  getPlatformV7StateTransitionSummary,
  getPlatformV7TransitionGuard,
  getPlatformV7TransitionsForEntity,
  PLATFORM_V7_STATE_TRANSITIONS,
} from '@/lib/platform-v7/state-transition-contracts';

describe('platform-v7 state transition contracts', () => {
  const transitionsForRole = (role: string) =>
    PLATFORM_V7_STATE_TRANSITIONS.filter((transition) => transition.actorRoles.includes(role));

  it('keeps core entity state maps covered', () => {
    expect(getPlatformV7StateTransitionSummary()).toMatchObject({
      entities: ['lot', 'rfq', 'proposal', 'deal', 'money', 'document', 'trip', 'dispute'],
      mode: 'contract_only_requires_runtime_state_machine',
    });
    expect(getPlatformV7TransitionsForEntity('deal').length).toBeGreaterThan(4);
    expect(getPlatformV7TransitionsForEntity('money').length).toBeGreaterThan(4);
  });

  it('blocks direct deal closure before execution and money decision', () => {
    expect(canPlatformV7Transition('deal', 'draft', 'closed')).toBe(false);
    expect(canPlatformV7Transition('deal', 'terms_confirmed', 'closed')).toBe(false);
    expect(canPlatformV7Transition('deal', 'money_decision', 'closed')).toBe(true);
    expect(getPlatformV7TransitionGuard('deal', 'money_decision', 'closed')).toBe('decision_required');
  });

  it('blocks direct money release before ready-to-release boundary', () => {
    expect(canPlatformV7Transition('money', 'not_requested', 'released')).toBe(false);
    expect(canPlatformV7Transition('money', 'reserved', 'released')).toBe(false);
    expect(canPlatformV7Transition('money', 'ready_to_release', 'released')).toBe(true);
    expect(getPlatformV7TransitionGuard('money', 'ready_to_release', 'released')).toBe('external_confirmation_required');
  });

  it('keeps uploaded documents away from accepted state without review', () => {
    expect(canPlatformV7Transition('document', 'uploaded', 'accepted')).toBe(false);
    expect(canPlatformV7Transition('document', 'uploaded', 'under_review')).toBe(true);
    expect(canPlatformV7Transition('document', 'under_review', 'accepted')).toBe(true);
    expect(doesPlatformV7TransitionAffectMoney('document', 'under_review', 'accepted')).toBe(true);
  });

  it('keeps trip incidents and acceptance money-sensitive', () => {
    expect(getPlatformV7AllowedNextStates('trip', 'arrived')).toEqual(['accepted', 'incident_opened']);
    expect(doesPlatformV7TransitionAffectMoney('trip', 'arrived', 'accepted')).toBe(true);
    expect(doesPlatformV7TransitionAffectMoney('trip', 'arrived', 'incident_opened')).toBe(true);
  });

  it('requires evidence and decision chain for disputes', () => {
    expect(canPlatformV7Transition('dispute', 'draft', 'resolved')).toBe(false);
    expect(getPlatformV7TransitionGuard('dispute', 'draft', 'opened')).toBe('evidence_required');
    expect(getPlatformV7TransitionGuard('dispute', 'decision_ready', 'resolved')).toBe('decision_required');
  });

  it('keeps external confirmations away from commercial, field and observer roles', () => {
    const nonConfirmingRoles = new Set([
      'seller',
      'buyer',
      'logistics',
      'driver',
      'elevator',
      'lab',
      'surveyor',
      'investor',
      'executive',
    ]);
    const externalTransitions = PLATFORM_V7_STATE_TRANSITIONS.filter(
      (transition) => transition.guard === 'external_confirmation_required',
    );

    expect(externalTransitions.length).toBeGreaterThan(0);

    for (const transition of externalTransitions) {
      expect(transition.actorRoles.some((role) => nonConfirmingRoles.has(role))).toBe(false);
    }
  });

  it('keeps observer roles out of operational state mutations', () => {
    expect(transitionsForRole('investor')).toEqual([]);
    expect(transitionsForRole('executive')).toEqual([]);
  });

  it('keeps driver authority inside the trip field boundary', () => {
    const driverTransitions = transitionsForRole('driver');

    expect(driverTransitions.length).toBeGreaterThan(0);
    for (const transition of driverTransitions) {
      expect(transition.entity).toBe('trip');
      expect(['loading_started', 'in_transit', 'arrived', 'incident_opened']).toContain(transition.to);
      expect(transition.to).not.toBe('accepted');
      expect(transition.to).not.toBe('released');
    }
  });

  it('keeps non-bank roles away from bank money confirmation boundaries', () => {
    const bankMoneyTransitions = PLATFORM_V7_STATE_TRANSITIONS.filter(
      (transition) => transition.entity === 'money' && transition.guard === 'external_confirmation_required',
    );
    const forbiddenMoneyActors = new Set([
      'seller',
      'buyer',
      'logistics',
      'driver',
      'elevator',
      'lab',
      'surveyor',
      'operator',
      'compliance',
      'arbitrator',
      'investor',
      'executive',
    ]);

    expect(bankMoneyTransitions.length).toBeGreaterThan(0);
    for (const transition of bankMoneyTransitions) {
      expect(transition.actorRoles).toEqual(['bank']);
      expect(transition.actorRoles.some((role) => forbiddenMoneyActors.has(role))).toBe(false);
    }
  });

  it('keeps specialist roles from crossing into final money release', () => {
    const releaseTransition = PLATFORM_V7_STATE_TRANSITIONS.find(
      (transition) => transition.entity === 'money' && transition.from === 'ready_to_release' && transition.to === 'released',
    );
    const specialistRoles = ['elevator', 'lab', 'surveyor', 'logistics', 'driver', 'compliance', 'arbitrator'];

    expect(releaseTransition?.actorRoles).toEqual(['bank']);
    for (const role of specialistRoles) {
      expect(releaseTransition?.actorRoles).not.toContain(role);
    }
  });

  it('keeps arbitration authority inside the dispute path', () => {
    const arbitratorTransitions = transitionsForRole('arbitrator');

    expect(arbitratorTransitions.length).toBeGreaterThan(0);
    for (const transition of arbitratorTransitions) {
      expect(transition.entity).toBe('dispute');
      expect(transition.affectsMoney).toBe(true);
      expect(transition.to).not.toBe('released');
    }
  });

  it('keeps final money release bank-confirmed and non-autonomous', () => {
    const moneyReleaseTransition = PLATFORM_V7_STATE_TRANSITIONS.find(
      (transition) => transition.entity === 'money' && transition.from === 'ready_to_release' && transition.to === 'released',
    );

    expect(moneyReleaseTransition).toMatchObject({
      guard: 'external_confirmation_required',
      actorRoles: ['bank'],
      affectsMoney: true,
    });
    expect(moneyReleaseTransition?.summary).toContain('platform does not release money by itself');
    expect(moneyReleaseTransition?.summary.toLowerCase()).not.toMatch(/automatic release|autonomous release|platform releases money/);
  });

  it('keeps transition contract copy away from live-production claims', () => {
    const transitionCopy = [
      getPlatformV7StateTransitionSummary().mode,
      ...PLATFORM_V7_STATE_TRANSITIONS.map((transition) => transition.summary),
    ]
      .join('\n')
      .toLowerCase();

    expect(transitionCopy).not.toMatch(/production-ready|fully live|fully integrated|live bank|live integration|guarantees payment/);
  });
});
