import type {
  ProviderAcknowledgementState,
  RegulatoryIntegrationState,
} from './regulatory-integration.types';

const ALLOWED_TRANSITIONS: Readonly<
  Record<RegulatoryIntegrationState, readonly RegulatoryIntegrationState[]>
> = {
  RECEIVED: ['VERIFIED', 'QUARANTINED', 'DEAD'],
  VERIFIED: ['PROCESSING', 'QUARANTINED', 'DEAD'],
  PROCESSING: ['PROCESSED', 'RETRY', 'QUARANTINED', 'DEAD'],
  PROCESSED: [],
  RETRY: ['PROCESSING', 'QUARANTINED', 'DEAD'],
  QUARANTINED: [],
  DEAD: [],
};

export class RegulatoryIntegrationStateTransitionError extends Error {
  readonly currentState: RegulatoryIntegrationState;
  readonly nextState: RegulatoryIntegrationState;

  constructor(
    currentState: RegulatoryIntegrationState,
    nextState: RegulatoryIntegrationState,
  ) {
    super(`Invalid regulatory integration transition: ${currentState} -> ${nextState}`);
    this.name = 'RegulatoryIntegrationStateTransitionError';
    this.currentState = currentState;
    this.nextState = nextState;
  }
}

export function canTransitionRegulatoryIntegrationState(
  currentState: RegulatoryIntegrationState,
  nextState: RegulatoryIntegrationState,
): boolean {
  return ALLOWED_TRANSITIONS[currentState].includes(nextState);
}

export function assertRegulatoryIntegrationStateTransition(
  currentState: RegulatoryIntegrationState,
  nextState: RegulatoryIntegrationState,
): RegulatoryIntegrationState {
  if (!canTransitionRegulatoryIntegrationState(currentState, nextState)) {
    throw new RegulatoryIntegrationStateTransitionError(currentState, nextState);
  }

  return nextState;
}

export type RegulatoryReplayDecision =
  | 'DETERMINISTIC_REPLAY'
  | 'SECURITY_CONFLICT';

export function decideRegulatoryReplay(
  existingRawBodySha256: string,
  incomingRawBodySha256: string,
): RegulatoryReplayDecision {
  return existingRawBodySha256 === incomingRawBodySha256
    ? 'DETERMINISTIC_REPLAY'
    : 'SECURITY_CONFLICT';
}

export function providerAcknowledgementEligibility(
  durableInsertCommitted: boolean,
): ProviderAcknowledgementState {
  return durableInsertCommitted
    ? 'ELIGIBLE_AFTER_DURABLE_COMMIT'
    : 'NOT_ELIGIBLE';
}
