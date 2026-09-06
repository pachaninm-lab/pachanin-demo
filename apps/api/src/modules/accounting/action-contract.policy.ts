export const IntegrationActionState = {
  AVAILABLE: 'AVAILABLE',
  DISABLED_WITH_REASON: 'DISABLED_WITH_REASON',
  RUNNING: 'RUNNING',
  UNKNOWN_RESULT: 'UNKNOWN_RESULT',
  FAILED: 'FAILED',
  SUCCEEDED: 'SUCCEEDED',
} as const;
export type IntegrationActionState =
  (typeof IntegrationActionState)[keyof typeof IntegrationActionState];

export const INTEGRATION_ACTION_STATES = Object.freeze(
  Object.values(IntegrationActionState),
);

export interface IntegrationActionContract {
  readonly actionId: string;
  readonly state: IntegrationActionState;
  readonly reason: string | null;
  readonly sensitive: boolean;
  readonly fullConfirmationRequired: boolean;
  readonly correlationId: string | null;
}

export class IntegrationActionContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrationActionContractError';
  }
}

/**
 * Validate the user-facing action contract from §61. No silent disabled state,
 * no silent failure, and UNKNOWN_RESULT remains visibly unresolved instead of
 * being rendered as a success. Sensitive actions carry an explicit requirement
 * for the future UI to show a full confirmation dialog.
 */
export function validateIntegrationActionContract(
  action: IntegrationActionContract,
): IntegrationActionContract {
  nonBlank(action.actionId, 'actionId');
  if (!isIntegrationActionState(action.state)) {
    throw new IntegrationActionContractError('unknown integration action state');
  }

  if (
    (action.state === IntegrationActionState.DISABLED_WITH_REASON
      || action.state === IntegrationActionState.FAILED)
    && blank(action.reason)
  ) {
    throw new IntegrationActionContractError(
      `${action.state} requires a human-readable reason`,
    );
  }

  if (action.state === IntegrationActionState.UNKNOWN_RESULT && blank(action.reason)) {
    throw new IntegrationActionContractError(
      'UNKNOWN_RESULT requires an explanation and reconciliation next step',
    );
  }

  if (action.state === IntegrationActionState.RUNNING && blank(action.correlationId)) {
    throw new IntegrationActionContractError(
      'RUNNING requires a correlationId for traceability',
    );
  }

  if (action.sensitive && !action.fullConfirmationRequired) {
    throw new IntegrationActionContractError(
      'sensitive action requires full confirmation dialog',
    );
  }

  if (!action.sensitive && action.fullConfirmationRequired) {
    // Allowed: callers may deliberately require stronger confirmation than the
    // minimum. This must never be a reason to weaken a sensitive action.
  }

  return Object.freeze({ ...action });
}

export function isIntegrationActionState(value: unknown): value is IntegrationActionState {
  return (
    typeof value === 'string'
    && (INTEGRATION_ACTION_STATES as readonly string[]).includes(value)
  );
}

export function isActionTerminalSuccess(action: IntegrationActionContract): boolean {
  validateIntegrationActionContract(action);
  return action.state === IntegrationActionState.SUCCEEDED;
}

export function actionAllowsMutation(action: IntegrationActionContract): boolean {
  validateIntegrationActionContract(action);
  return action.state === IntegrationActionState.AVAILABLE;
}

function nonBlank(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new IntegrationActionContractError(`${field} is required`);
  }
}

function blank(value: string | null): boolean {
  return value === null || value.trim() === '';
}
