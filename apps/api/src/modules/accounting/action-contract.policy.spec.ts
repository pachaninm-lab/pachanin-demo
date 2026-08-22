import {
  INTEGRATION_ACTION_STATES,
  IntegrationActionContractError,
  IntegrationActionState,
  actionAllowsMutation,
  isActionTerminalSuccess,
  isIntegrationActionState,
  validateIntegrationActionContract,
} from './action-contract.policy';

describe('integration action contract', () => {
  it('pins the exact six action states from §61', () => {
    expect(INTEGRATION_ACTION_STATES).toEqual([
      'AVAILABLE',
      'DISABLED_WITH_REASON',
      'RUNNING',
      'UNKNOWN_RESULT',
      'FAILED',
      'SUCCEEDED',
    ]);
  });

  it('refuses an invented silent state', () => {
    expect(isIntegrationActionState('DISABLED')).toBe(false);
    expect(isIntegrationActionState('DONE_MAYBE')).toBe(false);
  });

  it('requires a reason when disabled', () => {
    expect(() =>
      validateIntegrationActionContract({
        actionId: 'connect-1c',
        state: IntegrationActionState.DISABLED_WITH_REASON,
        reason: null,
        sensitive: false,
        fullConfirmationRequired: false,
        correlationId: null,
      }),
    ).toThrow('DISABLED_WITH_REASON requires a human-readable reason');
  });

  it('requires a reason on failure', () => {
    expect(() =>
      validateIntegrationActionContract({
        actionId: 'send-upd',
        state: IntegrationActionState.FAILED,
        reason: '   ',
        sensitive: false,
        fullConfirmationRequired: false,
        correlationId: 'corr-1',
      }),
    ).toThrow('FAILED requires a human-readable reason');
  });

  it('requires UNKNOWN_RESULT to explain reconciliation rather than looking successful', () => {
    expect(() =>
      validateIntegrationActionContract({
        actionId: 'send-upd',
        state: IntegrationActionState.UNKNOWN_RESULT,
        reason: null,
        sensitive: false,
        fullConfirmationRequired: false,
        correlationId: 'corr-1',
      }),
    ).toThrow('UNKNOWN_RESULT requires an explanation');

    const unknown = validateIntegrationActionContract({
      actionId: 'send-upd',
      state: IntegrationActionState.UNKNOWN_RESULT,
      reason: 'Внешняя система не подтвердила результат. Нужна сверка перед повтором.',
      sensitive: false,
      fullConfirmationRequired: false,
      correlationId: 'corr-1',
    });
    expect(isActionTerminalSuccess(unknown)).toBe(false);
    expect(actionAllowsMutation(unknown)).toBe(false);
  });

  it('requires a traceable correlation id while an action is running', () => {
    expect(() =>
      validateIntegrationActionContract({
        actionId: 'pair-1c',
        state: IntegrationActionState.RUNNING,
        reason: null,
        sensitive: false,
        fullConfirmationRequired: false,
        correlationId: null,
      }),
    ).toThrow('RUNNING requires a correlationId');
  });

  it('allows mutation only from AVAILABLE', () => {
    expect(
      actionAllowsMutation({
        actionId: 'check-connection',
        state: IntegrationActionState.AVAILABLE,
        reason: null,
        sensitive: false,
        fullConfirmationRequired: false,
        correlationId: null,
      }),
    ).toBe(true);

    expect(
      actionAllowsMutation({
        actionId: 'check-connection',
        state: IntegrationActionState.SUCCEEDED,
        reason: null,
        sensitive: false,
        fullConfirmationRequired: false,
        correlationId: 'corr-1',
      }),
    ).toBe(false);
  });

  it('recognizes success only from explicit SUCCEEDED', () => {
    expect(
      isActionTerminalSuccess({
        actionId: 'check-connection',
        state: IntegrationActionState.SUCCEEDED,
        reason: null,
        sensitive: false,
        fullConfirmationRequired: false,
        correlationId: 'corr-1',
      }),
    ).toBe(true);

    expect(
      isActionTerminalSuccess({
        actionId: 'check-connection',
        state: IntegrationActionState.RUNNING,
        reason: null,
        sensitive: false,
        fullConfirmationRequired: false,
        correlationId: 'corr-1',
      }),
    ).toBe(false);
  });

  it('forces sensitive actions to declare full confirmation', () => {
    expect(() =>
      validateIntegrationActionContract({
        actionId: 'revoke-connector',
        state: IntegrationActionState.AVAILABLE,
        reason: null,
        sensitive: true,
        fullConfirmationRequired: false,
        correlationId: null,
      }),
    ).toThrow('sensitive action requires full confirmation dialog');

    expect(() =>
      validateIntegrationActionContract({
        actionId: 'revoke-connector',
        state: IntegrationActionState.AVAILABLE,
        reason: null,
        sensitive: true,
        fullConfirmationRequired: true,
        correlationId: null,
      }),
    ).not.toThrow();
  });

  it('fails closed on an unknown state at runtime', () => {
    expect(() =>
      validateIntegrationActionContract({
        actionId: 'x',
        state: 'SILENT' as IntegrationActionState,
        reason: null,
        sensitive: false,
        fullConfirmationRequired: false,
        correlationId: null,
      }),
    ).toThrow(IntegrationActionContractError);
  });
});
