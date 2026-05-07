import { describe, expect, it } from 'vitest';
import {
  canPlatformV7Transition,
  doesPlatformV7TransitionAffectMoney,
  getPlatformV7AllowedNextStates,
  getPlatformV7StateTransitionSummary,
  getPlatformV7TransitionGuard,
  getPlatformV7TransitionsForEntity,
} from '@/lib/platform-v7/state-transition-contracts';

describe('platform-v7 state transition contracts', () => {
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
});
