import { createHash } from 'node:crypto';
import {
  SERVICE_MARKETPLACE_ACTIONS,
  isCommercialPayerMode,
  type ServiceMarketplaceAction,
  type ServiceMarketplaceStatus,
} from '../../../../../packages/domain-core/src';

type CommandBase = Readonly<{
  requestId: string;
  action: ServiceMarketplaceAction;
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  expectedStateVersion: string;
  reason: string;
}>;

export type ServiceMarketplaceCommand = CommandBase & (
  | Readonly<{
      action: 'CREATE_REQUEST';
      category: string;
      serviceStage: string;
      subjectType: string;
      subjectId: string;
      description: string;
      targetRegion: string | null;
    }>
  | Readonly<{
      action: 'SUBMIT_QUOTE';
      quoteId: string;
      serviceOfferingId: string;
      serviceOfferingVersion: string;
      quoteType: 'RULE_DECISION' | 'MANUAL_QUOTE';
      commercialDecisionId: string | null;
      amountKopecks: string;
      currency: 'RUB' | 'USD' | 'EUR' | 'CNY';
      payerMode: string;
      termsHash: string;
      expiresAt: string;
    }>
  | Readonly<{ action: 'SELECT_PROVIDER'; quoteId: string }>
  | Readonly<{
      action: 'ASSIGN_PAYER';
      payerAssignmentId: string;
      payerOrganizationId: string;
      payerMembershipId: string;
    }>
  | Readonly<{ action: 'CONFIRM_PAYER'; payerAssignmentId: string }>
  | Readonly<{ action: 'START_EXECUTION'; executionReference: string }>
  | Readonly<{ action: 'SUBMIT_EVIDENCE'; evidenceReference: string; evidenceHash: string }>
  | Readonly<{ action: 'ACCEPT_SERVICE'; acceptanceNote: string }>
  | Readonly<{
      action: 'RECORD_SETTLEMENT';
      settlementReferenceType: 'EXTERNAL' | 'SETTLEMENT_PLAN_PENDING' | 'LEDGER_PENDING';
      settlementReference: string;
    }>
);

export type ServiceMarketplaceReceipt = Readonly<{
  requestId: string;
  action: ServiceMarketplaceAction;
  status: ServiceMarketplaceStatus;
  stateVersion: string;
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  quoteId: string | null;
  payerAssignmentId: string | null;
  createsFinancialObligation: false;
  replayed: boolean;
  committedAt: string;
}>;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/u;
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9:_.\/-]{2,239}$/u;
const UPPER_KEY = /^[A-Z][A-Z0-9_]{2,79}$/u;
const REGION = /^[A-Za-z0-9][A-Za-z0-9 _.-]{1,119}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const CANONICAL_INTEGER = /^(?:0|[1-9][0-9]{0,18})$/u;
const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-](\d{2}):(\d{2}))$/u;
const MAX_SIGNED_BIGINT = 9_223_372_036_854_775_807n;

export class ServiceMarketplaceValidationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'ServiceMarketplaceValidationError';
  }
}

export function stableServiceMarketplaceJson(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(stableServiceMarketplaceJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => [key, stableServiceMarketplaceJson(item)]));
  }
  return value;
}

export function serviceMarketplaceDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableServiceMarketplaceJson(value))).digest('hex');
}

export function serviceMarketplaceCommandFingerprint(command: ServiceMarketplaceCommand): string {
  return serviceMarketplaceDigest({ schema: 'service-marketplace.command.v1', command });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ServiceMarketplaceValidationError('SERVICE_COMMAND_INVALID', 'Command must be an object.');
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const set = new Set(allowed);
  if (Object.keys(value).some((key) => !set.has(key))) {
    throw new ServiceMarketplaceValidationError('SERVICE_COMMAND_UNKNOWN_FIELD', 'Command contains an unknown field.');
  }
}

function safe(value: unknown, pattern: RegExp, code: string): string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new ServiceMarketplaceValidationError(code, `${code}: invalid value`);
  }
  return value;
}

function text(value: unknown, minimum: number, maximum: number, code: string): string {
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum) {
    throw new ServiceMarketplaceValidationError(code, `${code}: invalid text`);
  }
  return value.trim();
}

function integer(value: unknown, code: string): string {
  if (typeof value !== 'string' || !CANONICAL_INTEGER.test(value) || BigInt(value) > MAX_SIGNED_BIGINT) {
    throw new ServiceMarketplaceValidationError(code, `${code}: canonical PostgreSQL bigint string required`);
  }
  return value;
}

function timestamp(value: unknown, code: string): string {
  if (typeof value !== 'string') throw new ServiceMarketplaceValidationError(code, `${code}: timestamp required`);
  const match = ISO_TIMESTAMP.exec(value);
  if (!match) throw new ServiceMarketplaceValidationError(code, `${code}: timezone-qualified timestamp required`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const timezoneHour = match[8] === undefined ? 0 : Number(match[8]);
  const timezoneMinute = match[9] === undefined ? 0 : Number(match[9]);
  const daysInMonth = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  if (day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59
    || timezoneHour > 23 || timezoneMinute > 59 || !Number.isFinite(Date.parse(value))) {
    throw new ServiceMarketplaceValidationError(code, `${code}: real timestamp required`);
  }
  return value;
}

const BASE_KEYS = ['requestId', 'action', 'commandId', 'idempotencyKey', 'correlationId', 'expectedStateVersion', 'reason'];
const ACTION_KEYS: Readonly<Record<ServiceMarketplaceAction, readonly string[]>> = {
  CREATE_REQUEST: ['category', 'serviceStage', 'subjectType', 'subjectId', 'description', 'targetRegion'],
  SUBMIT_QUOTE: ['quoteId', 'serviceOfferingId', 'serviceOfferingVersion', 'quoteType', 'commercialDecisionId', 'amountKopecks', 'currency', 'payerMode', 'termsHash', 'expiresAt'],
  SELECT_PROVIDER: ['quoteId'],
  ASSIGN_PAYER: ['payerAssignmentId', 'payerOrganizationId', 'payerMembershipId'],
  CONFIRM_PAYER: ['payerAssignmentId'],
  START_EXECUTION: ['executionReference'],
  SUBMIT_EVIDENCE: ['evidenceReference', 'evidenceHash'],
  ACCEPT_SERVICE: ['acceptanceNote'],
  RECORD_SETTLEMENT: ['settlementReferenceType', 'settlementReference'],
};

export function normalizeServiceMarketplaceHttpCommand(
  input: unknown,
  authority: Pick<ServiceMarketplaceCommand, 'requestId' | 'action' | 'expectedStateVersion'>,
): ServiceMarketplaceCommand {
  const body = record(input);
  if (['requestId', 'action', 'expectedStateVersion'].some((key) => Object.hasOwn(body, key))) {
    throw new ServiceMarketplaceValidationError('SERVICE_COMMAND_UNKNOWN_FIELD', 'Path and If-Match authority must not be supplied in the body.');
  }
  return normalizeServiceMarketplaceCommand({ ...body, ...authority });
}

export function normalizeServiceMarketplaceCommand(input: unknown): ServiceMarketplaceCommand {
  const command = record(input);
  if (typeof command.action !== 'string' || !(SERVICE_MARKETPLACE_ACTIONS as readonly string[]).includes(command.action)) {
    throw new ServiceMarketplaceValidationError('SERVICE_ACTION_INVALID', 'Unknown service marketplace action.');
  }
  const action = command.action as ServiceMarketplaceAction;
  exactKeys(command, [...BASE_KEYS, ...ACTION_KEYS[action]]);
  const base = {
    requestId: safe(command.requestId, SAFE_ID, 'SERVICE_REQUEST_ID_INVALID'),
    action,
    commandId: safe(command.commandId, SAFE_ID, 'SERVICE_COMMAND_ID_INVALID'),
    idempotencyKey: safe(command.idempotencyKey, SAFE_ID, 'SERVICE_IDEMPOTENCY_KEY_INVALID'),
    correlationId: safe(command.correlationId, SAFE_ID, 'SERVICE_CORRELATION_ID_INVALID'),
    expectedStateVersion: integer(command.expectedStateVersion, 'SERVICE_STATE_VERSION_INVALID'),
    reason: text(command.reason, 10, 2000, 'SERVICE_REASON_INVALID'),
  } as const;
  if (action === 'CREATE_REQUEST') {
    if (base.expectedStateVersion !== '0') {
      throw new ServiceMarketplaceValidationError('SERVICE_CREATE_VERSION_INVALID', 'CREATE_REQUEST requires expectedStateVersion=0.');
    }
    return {
      ...base,
      action,
      category: safe(command.category, UPPER_KEY, 'SERVICE_CATEGORY_INVALID'),
      serviceStage: safe(command.serviceStage, UPPER_KEY, 'SERVICE_STAGE_INVALID'),
      subjectType: safe(command.subjectType, UPPER_KEY, 'SERVICE_SUBJECT_TYPE_INVALID'),
      subjectId: safe(command.subjectId, SAFE_ID, 'SERVICE_SUBJECT_ID_INVALID'),
      description: text(command.description, 10, 2000, 'SERVICE_DESCRIPTION_INVALID'),
      targetRegion: command.targetRegion === null ? null : safe(command.targetRegion, REGION, 'SERVICE_REGION_INVALID'),
    };
  }
  if (base.expectedStateVersion === '0') {
    throw new ServiceMarketplaceValidationError('SERVICE_STATE_VERSION_INVALID', 'Lifecycle commands require a positive version.');
  }
  switch (action) {
    case 'SUBMIT_QUOTE': {
      const quoteType = command.quoteType;
      if (quoteType !== 'RULE_DECISION' && quoteType !== 'MANUAL_QUOTE') {
        throw new ServiceMarketplaceValidationError('SERVICE_QUOTE_TYPE_INVALID', 'Unknown quote type.');
      }
      const commercialDecisionId = command.commercialDecisionId === null
        ? null
        : safe(command.commercialDecisionId, SAFE_ID, 'SERVICE_DECISION_ID_INVALID');
      if ((quoteType === 'RULE_DECISION') !== (commercialDecisionId !== null)) {
        throw new ServiceMarketplaceValidationError('SERVICE_QUOTE_DECISION_INVALID', 'Quote decision reference is incomplete.');
      }
      const currency = command.currency;
      if (!['RUB', 'USD', 'EUR', 'CNY'].includes(String(currency))) {
        throw new ServiceMarketplaceValidationError('SERVICE_QUOTE_CURRENCY_INVALID', 'Unknown quote currency.');
      }
      if (typeof command.payerMode !== 'string' || !isCommercialPayerMode(command.payerMode)) {
        throw new ServiceMarketplaceValidationError('SERVICE_QUOTE_PAYER_INVALID', 'Unknown payer mode.');
      }
      return {
        ...base,
        action,
        quoteId: safe(command.quoteId, SAFE_ID, 'SERVICE_QUOTE_ID_INVALID'),
        serviceOfferingId: safe(command.serviceOfferingId, SAFE_ID, 'SERVICE_OFFERING_ID_INVALID'),
        serviceOfferingVersion: integer(command.serviceOfferingVersion, 'SERVICE_OFFERING_VERSION_INVALID'),
        quoteType,
        commercialDecisionId,
        amountKopecks: integer(command.amountKopecks, 'SERVICE_QUOTE_AMOUNT_INVALID'),
        currency: currency as 'RUB' | 'USD' | 'EUR' | 'CNY',
        payerMode: command.payerMode,
        termsHash: safe(command.termsHash, HASH, 'SERVICE_QUOTE_TERMS_HASH_INVALID'),
        expiresAt: timestamp(command.expiresAt, 'SERVICE_QUOTE_EXPIRY_INVALID'),
      };
    }
    case 'SELECT_PROVIDER':
      return { ...base, action, quoteId: safe(command.quoteId, SAFE_ID, 'SERVICE_QUOTE_ID_INVALID') };
    case 'ASSIGN_PAYER':
      return {
        ...base,
        action,
        payerAssignmentId: safe(command.payerAssignmentId, SAFE_ID, 'SERVICE_PAYER_ASSIGNMENT_ID_INVALID'),
        payerOrganizationId: safe(command.payerOrganizationId, SAFE_ID, 'SERVICE_PAYER_ORGANIZATION_ID_INVALID'),
        payerMembershipId: safe(command.payerMembershipId, SAFE_ID, 'SERVICE_PAYER_MEMBERSHIP_ID_INVALID'),
      };
    case 'CONFIRM_PAYER':
      return { ...base, action, payerAssignmentId: safe(command.payerAssignmentId, SAFE_ID, 'SERVICE_PAYER_ASSIGNMENT_ID_INVALID') };
    case 'START_EXECUTION':
      return { ...base, action, executionReference: safe(command.executionReference, SAFE_REFERENCE, 'SERVICE_EXECUTION_REFERENCE_INVALID') };
    case 'SUBMIT_EVIDENCE':
      return {
        ...base,
        action,
        evidenceReference: safe(command.evidenceReference, SAFE_REFERENCE, 'SERVICE_EVIDENCE_REFERENCE_INVALID'),
        evidenceHash: safe(command.evidenceHash, HASH, 'SERVICE_EVIDENCE_HASH_INVALID'),
      };
    case 'ACCEPT_SERVICE':
      return { ...base, action, acceptanceNote: text(command.acceptanceNote, 10, 2000, 'SERVICE_ACCEPTANCE_NOTE_INVALID') };
    case 'RECORD_SETTLEMENT': {
      const type = command.settlementReferenceType;
      if (!['EXTERNAL', 'SETTLEMENT_PLAN_PENDING', 'LEDGER_PENDING'].includes(String(type))) {
        throw new ServiceMarketplaceValidationError('SERVICE_SETTLEMENT_TYPE_INVALID', 'Unknown settlement reference type.');
      }
      return {
        ...base,
        action,
        settlementReferenceType: type as 'EXTERNAL' | 'SETTLEMENT_PLAN_PENDING' | 'LEDGER_PENDING',
        settlementReference: safe(command.settlementReference, SAFE_REFERENCE, 'SERVICE_SETTLEMENT_REFERENCE_INVALID'),
      };
    }
  }
}
