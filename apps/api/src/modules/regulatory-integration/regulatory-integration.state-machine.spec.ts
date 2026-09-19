import {
  RegulatoryIntegrationStateTransitionError,
  assertRegulatoryIntegrationStateTransition,
  canTransitionRegulatoryIntegrationState,
  decideRegulatoryReplay,
  providerAcknowledgementEligibility,
} from './regulatory-integration.state-machine';

describe('regulatory integration state machine', () => {
  it.each([
    ['RECEIVED', 'VERIFIED'],
    ['RECEIVED', 'QUARANTINED'],
    ['VERIFIED', 'PROCESSING'],
    ['PROCESSING', 'PROCESSED'],
    ['PROCESSING', 'RETRY'],
    ['RETRY', 'PROCESSING'],
  ] as const)('allows %s -> %s', (currentState, nextState) => {
    expect(canTransitionRegulatoryIntegrationState(currentState, nextState))
      .toBe(true);
    expect(assertRegulatoryIntegrationStateTransition(currentState, nextState))
      .toBe(nextState);
  });

  it.each([
    ['RECEIVED', 'PROCESSED'],
    ['VERIFIED', 'RECEIVED'],
    ['PROCESSED', 'PROCESSING'],
    ['QUARANTINED', 'RECEIVED'],
    ['DEAD', 'RETRY'],
  ] as const)('fails closed for %s -> %s', (currentState, nextState) => {
    expect(canTransitionRegulatoryIntegrationState(currentState, nextState))
      .toBe(false);
    expect(() => assertRegulatoryIntegrationStateTransition(
      currentState,
      nextState,
    )).toThrow(RegulatoryIntegrationStateTransitionError);
  });

  it('returns deterministic replay only for the same immutable body hash', () => {
    expect(decideRegulatoryReplay('a'.repeat(64), 'a'.repeat(64)))
      .toBe('DETERMINISTIC_REPLAY');
    expect(decideRegulatoryReplay('a'.repeat(64), 'b'.repeat(64)))
      .toBe('SECURITY_CONFLICT');
  });

  it('never permits provider acknowledgement before the durable insert commits', () => {
    expect(providerAcknowledgementEligibility(false)).toBe('NOT_ELIGIBLE');
    expect(providerAcknowledgementEligibility(true))
      .toBe('ELIGIBLE_AFTER_DURABLE_COMMIT');
  });
});
