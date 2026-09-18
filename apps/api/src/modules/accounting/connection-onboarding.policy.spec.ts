import {
  CONNECTION_STATUSES,
  AccountingSystemChoice,
  ConnectionHandoffAction,
  ConnectionOnboardingPolicyError,
  ConnectionStatus,
  OneCLocationChoice,
  decideConnectionOnboarding,
  isExactPublicConnectionSummary,
  validatePublicConnectionSummary,
} from './connection-onboarding.policy';

describe('Connection Center onboarding contract', () => {
  it('pins the exact public connection status vocabulary from §22', () => {
    expect(CONNECTION_STATUSES).toEqual([
      'NOT_CONNECTED',
      'CONNECTING',
      'HEALTHY',
      'DEGRADED',
      'ACTION_REQUIRED',
      'OFFLINE',
      'REVOKED',
      'SECURITY_HOLD',
    ]);
  });

  it('routes 1C:Fresh explicitly', () => {
    expect(
      decideConnectionOnboarding({
        accountingSystem: AccountingSystemChoice.ONE_C,
        oneCLocation: OneCLocationChoice.FRESH,
      }),
    ).toEqual({
      route: 'ONE_C_FRESH',
      handoffActions: [],
      userMessageKey: 'CONNECT_ONE_C_FRESH',
    });
  });

  it('routes local/server 1C to the connector path', () => {
    expect(
      decideConnectionOnboarding({
        accountingSystem: AccountingSystemChoice.ONE_C,
        oneCLocation: OneCLocationChoice.LOCAL_OR_SERVER,
      }),
    ).toMatchObject({ route: 'ONE_C_CONNECTOR' });
  });

  it('routes serviced 1C to the company/admin handoff instead of asking the farmer for technical details', () => {
    expect(
      decideConnectionOnboarding({
        accountingSystem: AccountingSystemChoice.ONE_C,
        oneCLocation: OneCLocationChoice.SERVICE_COMPANY,
      }),
    ).toEqual({
      route: 'ONE_C_SERVICE_COMPANY',
      handoffActions: [ConnectionHandoffAction.SEND_TO_ONE_C_ADMIN],
      userMessageKey: 'CONTACT_SERVICE_COMPANY',
    });
  });

  it('turns “не знаю” into human handoff actions, not a dead technical form', () => {
    expect(
      decideConnectionOnboarding({
        accountingSystem: AccountingSystemChoice.UNKNOWN,
        oneCLocation: null,
      }),
    ).toEqual({
      route: 'NEEDS_HELP',
      handoffActions: [
        ConnectionHandoffAction.SEND_TO_ACCOUNTANT,
        ConnectionHandoffAction.SEND_TO_ONE_C_ADMIN,
      ],
      userMessageKey: 'ASK_ACCOUNTANT_OR_ONE_C_ADMIN',
    });

    expect(
      decideConnectionOnboarding({
        accountingSystem: AccountingSystemChoice.ONE_C,
        oneCLocation: OneCLocationChoice.UNKNOWN,
      }).handoffActions,
    ).toEqual([
      ConnectionHandoffAction.SEND_TO_ACCOUNTANT,
      ConnectionHandoffAction.SEND_TO_ONE_C_ADMIN,
    ]);
  });

  it('keeps another accounting system explicit without pretending it is 1C', () => {
    expect(
      decideConnectionOnboarding({
        accountingSystem: AccountingSystemChoice.OTHER,
        oneCLocation: null,
      }),
    ).toEqual({
      route: 'OTHER_ACCOUNTING',
      handoffActions: [ConnectionHandoffAction.SEND_TO_ACCOUNTANT],
      userMessageKey: 'OTHER_ACCOUNTING_MANUAL_OR_ADAPTER',
    });
  });

  it('refuses a 1C location when the accounting system is OTHER', () => {
    expect(() =>
      decideConnectionOnboarding({
        accountingSystem: AccountingSystemChoice.OTHER,
        oneCLocation: OneCLocationChoice.LOCAL_OR_SERVER,
      }),
    ).toThrow('oneCLocation must be empty');
  });

  it('requires a 1C location when 1C was selected', () => {
    expect(() =>
      decideConnectionOnboarding({
        accountingSystem: AccountingSystemChoice.ONE_C,
        oneCLocation: null,
      }),
    ).toThrow('1C location is required');
  });

  it('keeps the public connection card to five safe fields only', () => {
    const card = validatePublicConnectionSummary({
      kind: 'ACCOUNTING_ONE_C',
      status: ConnectionStatus.ACTION_REQUIRED,
      title: '1С',
      safeDescription: 'Нужно выбрать организацию в базе 1С.',
      nextAction: 'Выбрать организацию',
    });
    expect(isExactPublicConnectionSummary(card)).toBe(true);

    for (const secretField of [
      { odata: 'http://internal' },
      { oauthScopes: ['all'] },
      { client_secret: 'secret' },
      { endpoint: 'https://internal' },
      { refreshToken: 'secret' },
    ]) {
      expect(isExactPublicConnectionSummary({ ...card, ...secretField })).toBe(false);
    }
  });

  it('does not allow an invented connection status', () => {
    expect(() =>
      validatePublicConnectionSummary({
        kind: 'EDO',
        status: 'CONNECTED_OK' as ConnectionStatus,
        title: 'ЭДО',
        safeDescription: 'x',
        nextAction: null,
      }),
    ).toThrow(ConnectionOnboardingPolicyError);
  });
});
