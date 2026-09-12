export const AccountingSystemChoice = {
  ONE_C: 'ONE_C',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN',
} as const;
export type AccountingSystemChoice =
  (typeof AccountingSystemChoice)[keyof typeof AccountingSystemChoice];

export const OneCLocationChoice = {
  FRESH: 'FRESH',
  LOCAL_OR_SERVER: 'LOCAL_OR_SERVER',
  SERVICE_COMPANY: 'SERVICE_COMPANY',
  UNKNOWN: 'UNKNOWN',
} as const;
export type OneCLocationChoice =
  (typeof OneCLocationChoice)[keyof typeof OneCLocationChoice];

export const ConnectionHandoffAction = {
  SEND_TO_ACCOUNTANT: 'SEND_TO_ACCOUNTANT',
  SEND_TO_ONE_C_ADMIN: 'SEND_TO_ONE_C_ADMIN',
} as const;
export type ConnectionHandoffAction =
  (typeof ConnectionHandoffAction)[keyof typeof ConnectionHandoffAction];

export const ConnectionStatus = {
  NOT_CONNECTED: 'NOT_CONNECTED',
  CONNECTING: 'CONNECTING',
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
  OFFLINE: 'OFFLINE',
  REVOKED: 'REVOKED',
  SECURITY_HOLD: 'SECURITY_HOLD',
} as const;
export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

export const CONNECTION_STATUSES = Object.freeze(Object.values(ConnectionStatus));

export interface ConnectionOnboardingAnswers {
  readonly accountingSystem: AccountingSystemChoice;
  readonly oneCLocation: OneCLocationChoice | null;
}

export interface ConnectionOnboardingDecision {
  readonly route: 'ONE_C_FRESH' | 'ONE_C_CONNECTOR' | 'ONE_C_SERVICE_COMPANY' | 'OTHER_ACCOUNTING' | 'NEEDS_HELP';
  readonly handoffActions: readonly ConnectionHandoffAction[];
  readonly userMessageKey:
    | 'CONNECT_ONE_C_FRESH'
    | 'CONNECT_LOCAL_ONE_C'
    | 'CONTACT_SERVICE_COMPANY'
    | 'OTHER_ACCOUNTING_MANUAL_OR_ADAPTER'
    | 'ASK_ACCOUNTANT_OR_ONE_C_ADMIN';
}

export interface PublicConnectionSummary {
  readonly kind: 'ACCOUNTING_ONE_C' | 'EDO' | 'FGIS_GRAIN' | 'TRANSPORT_DOCUMENTS' | 'OTHER';
  readonly status: ConnectionStatus;
  readonly title: string;
  readonly safeDescription: string;
  readonly nextAction: string | null;
}

export class ConnectionOnboardingPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionOnboardingPolicyError';
  }
}

export function decideConnectionOnboarding(
  answers: ConnectionOnboardingAnswers,
): ConnectionOnboardingDecision {
  if (!isAccountingSystemChoice(answers.accountingSystem)) {
    throw new ConnectionOnboardingPolicyError('unknown accounting system choice');
  }

  if (answers.accountingSystem === AccountingSystemChoice.UNKNOWN) {
    if (answers.oneCLocation !== null && !isOneCLocationChoice(answers.oneCLocation)) {
      throw new ConnectionOnboardingPolicyError('unknown 1C location choice');
    }
    return frozenDecision({
      route: 'NEEDS_HELP',
      handoffActions: [
        ConnectionHandoffAction.SEND_TO_ACCOUNTANT,
        ConnectionHandoffAction.SEND_TO_ONE_C_ADMIN,
      ],
      userMessageKey: 'ASK_ACCOUNTANT_OR_ONE_C_ADMIN',
    });
  }

  if (answers.accountingSystem === AccountingSystemChoice.OTHER) {
    if (answers.oneCLocation !== null) {
      throw new ConnectionOnboardingPolicyError(
        'oneCLocation must be empty when accountingSystem is OTHER',
      );
    }
    return frozenDecision({
      route: 'OTHER_ACCOUNTING',
      handoffActions: [ConnectionHandoffAction.SEND_TO_ACCOUNTANT],
      userMessageKey: 'OTHER_ACCOUNTING_MANUAL_OR_ADAPTER',
    });
  }

  if (answers.oneCLocation === null || !isOneCLocationChoice(answers.oneCLocation)) {
    throw new ConnectionOnboardingPolicyError('1C location is required for ONE_C');
  }

  switch (answers.oneCLocation) {
    case OneCLocationChoice.FRESH:
      return frozenDecision({
        route: 'ONE_C_FRESH',
        handoffActions: [],
        userMessageKey: 'CONNECT_ONE_C_FRESH',
      });
    case OneCLocationChoice.LOCAL_OR_SERVER:
      return frozenDecision({
        route: 'ONE_C_CONNECTOR',
        handoffActions: [],
        userMessageKey: 'CONNECT_LOCAL_ONE_C',
      });
    case OneCLocationChoice.SERVICE_COMPANY:
      return frozenDecision({
        route: 'ONE_C_SERVICE_COMPANY',
        handoffActions: [ConnectionHandoffAction.SEND_TO_ONE_C_ADMIN],
        userMessageKey: 'CONTACT_SERVICE_COMPANY',
      });
    case OneCLocationChoice.UNKNOWN:
      return frozenDecision({
        route: 'NEEDS_HELP',
        handoffActions: [
          ConnectionHandoffAction.SEND_TO_ACCOUNTANT,
          ConnectionHandoffAction.SEND_TO_ONE_C_ADMIN,
        ],
        userMessageKey: 'ASK_ACCOUNTANT_OR_ONE_C_ADMIN',
      });
  }
}

/**
 * Exact public shape for Connection Center cards. No technical authorization or
 * provider-secret fields are representable here by design.
 */
export function validatePublicConnectionSummary(
  value: PublicConnectionSummary,
): PublicConnectionSummary {
  if (!['ACCOUNTING_ONE_C', 'EDO', 'FGIS_GRAIN', 'TRANSPORT_DOCUMENTS', 'OTHER'].includes(value.kind)) {
    throw new ConnectionOnboardingPolicyError('unknown connection summary kind');
  }
  if (!isConnectionStatus(value.status)) {
    throw new ConnectionOnboardingPolicyError('unknown connection status');
  }
  nonBlank(value.title, 'title');
  nonBlank(value.safeDescription, 'safeDescription');
  if (value.nextAction !== null) nonBlank(value.nextAction, 'nextAction');
  return Object.freeze({ ...value });
}

export function isExactPublicConnectionSummary(value: unknown): value is PublicConnectionSummary {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expected = ['kind', 'nextAction', 'safeDescription', 'status', 'title'];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return false;
  }
  try {
    validatePublicConnectionSummary(record as unknown as PublicConnectionSummary);
    return true;
  } catch {
    return false;
  }
}

export function isConnectionStatus(value: unknown): value is ConnectionStatus {
  return typeof value === 'string' && (CONNECTION_STATUSES as readonly string[]).includes(value);
}

function isAccountingSystemChoice(value: unknown): value is AccountingSystemChoice {
  return (
    typeof value === 'string'
    && (Object.values(AccountingSystemChoice) as readonly string[]).includes(value)
  );
}

function isOneCLocationChoice(value: unknown): value is OneCLocationChoice {
  return (
    typeof value === 'string'
    && (Object.values(OneCLocationChoice) as readonly string[]).includes(value)
  );
}

function frozenDecision(value: ConnectionOnboardingDecision): ConnectionOnboardingDecision {
  return Object.freeze({
    ...value,
    handoffActions: Object.freeze([...value.handoffActions]),
  });
}

function nonBlank(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConnectionOnboardingPolicyError(`${field} is required`);
  }
}
