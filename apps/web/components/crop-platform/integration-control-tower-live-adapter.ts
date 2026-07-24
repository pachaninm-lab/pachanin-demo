export type IntegrationControlTowerLocale = 'ru' | 'en' | 'zh';
export type IntegrationHonestStatus =
  | 'CONFIRMED_LIVE'
  | 'TEST'
  | 'ADAPTER_READY'
  | 'MANUAL'
  | 'UNAVAILABLE'
  | 'DEGRADED'
  | 'REVOKED';
export type IntegrationReconciliationState =
  | 'NOT_REQUESTED'
  | 'PENDING'
  | 'SENT'
  | 'FAILED'
  | 'DEAD_LETTER';
export type IntegrationEventState =
  | 'RECEIVED'
  | 'VERIFIED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'RETRY'
  | 'QUARANTINED'
  | 'DEAD';

export type IntegrationControlTowerAction = Readonly<{
  id: 'REDRIVE' | 'RECONCILE';
  label: string;
  allowed: boolean;
  reasonCode: string;
  reason: string;
  requiresConfirmation: true;
  owner: 'OPERATOR' | 'COMPLIANCE';
  impact: 'HIGH';
  entryId: string | null;
}>;

export type IntegrationControlTowerEvent = Readonly<{
  id: string;
  provider: string;
  externalEventId: string;
  state: IntegrationEventState;
  schemaVersion: string;
  mappingVersion: string;
  receivedAt: string;
  occurredAt: string;
  attempts: number;
  nextAttemptAt: string | null;
  providerAcknowledgedAt: string | null;
  businessAcceptedAt: string | null;
  lastErrorCode: string | null;
  lastErrorCategory: string | null;
  correlationId: string;
  version: string;
}>;

export type IntegrationControlTowerRecord = Readonly<{
  adapterCode: string;
  adapterVersion: string;
  provider: string;
  capabilities: string[];
  environment: string;
  honestStatus: IntegrationHonestStatus;
  schemaVersion: string;
  mappingVersion: string;
  freshnessAt: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  inboxDepth: number;
  oldestEventAt: string | null;
  retryCount: number;
  quarantineCount: number;
  deadCount: number;
  processingCount: number;
  conflictCount: number;
  providerAcknowledgedCount: number;
  businessAcceptedCount: number;
  reconciliationState: IntegrationReconciliationState;
  reconciliationUpdatedAt: string | null;
  credentialReferenceExpiresAt: null;
  credentialMetadataAvailable: false;
  aggregateVersion: string;
  primaryAction: IntegrationControlTowerAction;
  recentEvents: IntegrationControlTowerEvent[];
}>;

export type ParsedIntegrationControlTowerPage = Readonly<{
  items: IntegrationControlTowerRecord[];
  nextCursor: string | null;
}>;

export const INTEGRATION_CONTROL_TOWER_MAX_PAGES = 20;
export const INTEGRATION_CONTROL_TOWER_MAX_ITEMS = 2_000;

const STATUSES = new Set<IntegrationHonestStatus>([
  'CONFIRMED_LIVE', 'TEST', 'ADAPTER_READY', 'MANUAL', 'UNAVAILABLE', 'DEGRADED', 'REVOKED',
]);
const RECONCILIATION_STATES = new Set<IntegrationReconciliationState>([
  'NOT_REQUESTED', 'PENDING', 'SENT', 'FAILED', 'DEAD_LETTER',
]);
const EVENT_STATES = new Set<IntegrationEventState>([
  'RECEIVED', 'VERIFIED', 'PROCESSING', 'PROCESSED', 'RETRY', 'QUARANTINED', 'DEAD',
]);
const ACTIONS = new Set(['REDRIVE', 'RECONCILE']);
const OWNERS = new Set(['OPERATOR', 'COMPLIANCE']);
const INTEGER = /^(0|[1-9][0-9]{0,18})$/;

type JsonRecord = Record<string, unknown>;

const ACTION_COPY: Record<IntegrationControlTowerLocale, Record<string, string>> = {
  ru: { REDRIVE: 'Вернуть событие в обработку', RECONCILE: 'Запустить сверку' },
  en: { REDRIVE: 'Redrive event', RECONCILE: 'Start reconciliation' },
  zh: { REDRIVE: '重新处理事件', RECONCILE: '启动核对' },
};

const REASON_COPY: Record<IntegrationControlTowerLocale, Record<string, string>> = {
  ru: {
    ALLOWED: 'Действие разрешено серверной политикой.',
    AUTH_CONTEXT_INCOMPLETE: 'Сервер не подтвердил полный контекст пользователя.',
    ROLE_DENIED: 'Текущая роль имеет доступ только к разрешённому обзору.',
    STAFF_AUTHORITY_REQUIRED: 'Нужна активная служебная роль управления интеграциями.',
    MFA_REQUIRED: 'Нужно повторно подтвердить MFA.',
    JIT_AUTHORITY_REQUIRED: 'Нужно временное JIT-полномочие.',
    HUMAN_REASON_REQUIRED: 'Нужно указать проверяемое основание.',
    ACTION_NOT_AVAILABLE: 'Для текущего состояния действие недоступно.',
  },
  en: {
    ALLOWED: 'The server policy allows this action.',
    AUTH_CONTEXT_INCOMPLETE: 'The server did not confirm the full user context.',
    ROLE_DENIED: 'The current role has view-only access.',
    STAFF_AUTHORITY_REQUIRED: 'An active integration staff authority is required.',
    MFA_REQUIRED: 'MFA must be confirmed again.',
    JIT_AUTHORITY_REQUIRED: 'A time-bound JIT authority is required.',
    HUMAN_REASON_REQUIRED: 'A verifiable human reason is required.',
    ACTION_NOT_AVAILABLE: 'The action is unavailable for the current state.',
  },
  zh: {
    ALLOWED: '服务器策略允许此操作。',
    AUTH_CONTEXT_INCOMPLETE: '服务器未确认完整用户上下文。',
    ROLE_DENIED: '当前角色仅有查看权限。',
    STAFF_AUTHORITY_REQUIRED: '需要有效的集成管理权限。',
    MFA_REQUIRED: '需要重新确认 MFA。',
    JIT_AUTHORITY_REQUIRED: '需要有时限的 JIT 权限。',
    HUMAN_REASON_REQUIRED: '需要填写可核验的操作依据。',
    ACTION_NOT_AVAILABLE: '当前状态不允许此操作。',
  },
};

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function requiredString(source: JsonRecord, field: string, max = 500): string | null {
  const value = source[field];
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}

function optionalString(source: JsonRecord, field: string, max = 500): string | null | undefined {
  const value = source[field];
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' && value.length <= max ? value : undefined;
}

function timestamp(source: JsonRecord, field: string, nullable = false): string | null | undefined {
  const value = source[field];
  if (nullable && (value === null || value === undefined || value === '')) return null;
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

function count(source: JsonRecord, field: string): number | null {
  const value = source[field];
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function stringArray(value: unknown, max = 100): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item || item.length > 200) return null;
    result.push(item);
  }
  return result;
}

function parseAction(value: unknown, locale: IntegrationControlTowerLocale): IntegrationControlTowerAction | null {
  const source = record(value);
  if (!source) return null;
  const id = requiredString(source, 'id', 32);
  const reasonCode = requiredString(source, 'reasonCode', 80);
  const owner = requiredString(source, 'owner', 32);
  const entryId = optionalString(source, 'entryId', 240);
  if (
    !id || !ACTIONS.has(id)
    || !reasonCode
    || typeof source.allowed !== 'boolean'
    || source.requiresConfirmation !== true
    || !owner || !OWNERS.has(owner)
    || source.impact !== 'HIGH'
    || entryId === undefined
  ) return null;
  return {
    id: id as 'REDRIVE' | 'RECONCILE',
    label: ACTION_COPY[locale][id] ?? id,
    allowed: source.allowed,
    reasonCode,
    reason: REASON_COPY[locale][reasonCode] ?? reasonCode,
    requiresConfirmation: true,
    owner: owner as 'OPERATOR' | 'COMPLIANCE',
    impact: 'HIGH',
    entryId,
  };
}

function parseEvent(value: unknown): IntegrationControlTowerEvent | null {
  const source = record(value);
  if (!source) return null;
  const id = requiredString(source, 'id', 240);
  const provider = requiredString(source, 'provider', 64);
  const externalEventId = requiredString(source, 'externalEventId', 255);
  const state = requiredString(source, 'state', 24);
  const schemaVersion = requiredString(source, 'schemaVersion', 64);
  const mappingVersion = requiredString(source, 'mappingVersion', 64);
  const receivedAt = timestamp(source, 'receivedAt');
  const occurredAt = timestamp(source, 'occurredAt');
  const nextAttemptAt = timestamp(source, 'nextAttemptAt', true);
  const providerAcknowledgedAt = timestamp(source, 'providerAcknowledgedAt', true);
  const businessAcceptedAt = timestamp(source, 'businessAcceptedAt', true);
  const lastErrorCode = optionalString(source, 'lastErrorCode', 64);
  const lastErrorCategory = optionalString(source, 'lastErrorCategory', 32);
  const correlationId = requiredString(source, 'correlationId', 240);
  const version = requiredString(source, 'version', 20);
  const attempts = count(source, 'attempts');
  if (
    !id || !provider || !externalEventId || !state || !EVENT_STATES.has(state as IntegrationEventState)
    || !schemaVersion || !mappingVersion || !receivedAt || !occurredAt
    || nextAttemptAt === undefined || providerAcknowledgedAt === undefined || businessAcceptedAt === undefined
    || lastErrorCode === undefined || lastErrorCategory === undefined
    || !correlationId || !version || !INTEGER.test(version) || attempts === null
  ) return null;
  return {
    id, provider, externalEventId, state: state as IntegrationEventState,
    schemaVersion, mappingVersion, receivedAt, occurredAt, attempts,
    nextAttemptAt, providerAcknowledgedAt, businessAcceptedAt,
    lastErrorCode, lastErrorCategory, correlationId, version,
  };
}

export function parseIntegrationControlTowerRecord(
  value: unknown,
  locale: IntegrationControlTowerLocale,
): IntegrationControlTowerRecord | null {
  const source = record(value);
  if (!source) return null;
  const adapterCode = requiredString(source, 'adapterCode', 64);
  const adapterVersion = requiredString(source, 'adapterVersion', 32);
  const provider = requiredString(source, 'provider', 64);
  const capabilities = stringArray(source.capabilities);
  const environment = requiredString(source, 'environment', 24);
  const honestStatus = requiredString(source, 'honestStatus', 32);
  const schemaVersion = requiredString(source, 'schemaVersion', 64);
  const mappingVersion = requiredString(source, 'mappingVersion', 64);
  const freshnessAt = timestamp(source, 'freshnessAt');
  const lastSuccessAt = timestamp(source, 'lastSuccessAt', true);
  const lastErrorAt = timestamp(source, 'lastErrorAt', true);
  const lastErrorCode = optionalString(source, 'lastErrorCode', 64);
  const oldestEventAt = timestamp(source, 'oldestEventAt', true);
  const reconciliationState = requiredString(source, 'reconciliationState', 32);
  const reconciliationUpdatedAt = timestamp(source, 'reconciliationUpdatedAt', true);
  const aggregateVersion = requiredString(source, 'aggregateVersion', 20);
  const primaryAction = parseAction(source.primaryAction, locale);
  const numericFields = [
    'inboxDepth', 'retryCount', 'quarantineCount', 'deadCount', 'processingCount',
    'conflictCount', 'providerAcknowledgedCount', 'businessAcceptedCount',
  ] as const;
  const counts = Object.fromEntries(numericFields.map((field) => [field, count(source, field)]));
  if (
    !adapterCode || !adapterVersion || !provider || !capabilities || !environment
    || !honestStatus || !STATUSES.has(honestStatus as IntegrationHonestStatus)
    || !schemaVersion || !mappingVersion || !freshnessAt
    || lastSuccessAt === undefined || lastErrorAt === undefined || lastErrorCode === undefined
    || oldestEventAt === undefined
    || !reconciliationState || !RECONCILIATION_STATES.has(reconciliationState as IntegrationReconciliationState)
    || reconciliationUpdatedAt === undefined
    || source.credentialReferenceExpiresAt !== null
    || source.credentialMetadataAvailable !== false
    || !aggregateVersion || !INTEGER.test(aggregateVersion)
    || !primaryAction
    || Object.values(counts).some((item) => item === null)
  ) return null;
  const eventSource = source.recentEvents;
  const recentEvents: IntegrationControlTowerEvent[] = [];
  if (eventSource !== undefined) {
    if (!Array.isArray(eventSource) || eventSource.length > 100) return null;
    for (const item of eventSource) {
      const event = parseEvent(item);
      if (!event) return null;
      recentEvents.push(event);
    }
  }
  return {
    adapterCode, adapterVersion, provider, capabilities, environment,
    honestStatus: honestStatus as IntegrationHonestStatus,
    schemaVersion, mappingVersion, freshnessAt, lastSuccessAt, lastErrorAt, lastErrorCode,
    inboxDepth: counts.inboxDepth!, oldestEventAt,
    retryCount: counts.retryCount!, quarantineCount: counts.quarantineCount!, deadCount: counts.deadCount!,
    processingCount: counts.processingCount!, conflictCount: counts.conflictCount!,
    providerAcknowledgedCount: counts.providerAcknowledgedCount!, businessAcceptedCount: counts.businessAcceptedCount!,
    reconciliationState: reconciliationState as IntegrationReconciliationState,
    reconciliationUpdatedAt,
    credentialReferenceExpiresAt: null,
    credentialMetadataAvailable: false,
    aggregateVersion,
    primaryAction,
    recentEvents,
  };
}

export function parseIntegrationControlTowerPage(
  payload: unknown,
  locale: IntegrationControlTowerLocale,
): ParsedIntegrationControlTowerPage | null {
  const envelope = record(payload);
  if (!envelope || !Array.isArray(envelope.items)) return null;
  const nextCursor = optionalString(envelope, 'nextCursor', 4096);
  if (nextCursor === undefined) return null;
  const items: IntegrationControlTowerRecord[] = [];
  for (const item of envelope.items) {
    const parsed = parseIntegrationControlTowerRecord(item, locale);
    if (!parsed) return null;
    items.push(parsed);
  }
  return { items, nextCursor };
}

export async function collectIntegrationControlTowerPages(
  fetchPage: (cursor: string | null) => Promise<unknown>,
  locale: IntegrationControlTowerLocale,
): Promise<IntegrationControlTowerRecord[] | null> {
  const items = new Map<string, IntegrationControlTowerRecord>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  for (let pageIndex = 0; pageIndex < INTEGRATION_CONTROL_TOWER_MAX_PAGES; pageIndex += 1) {
    const page = parseIntegrationControlTowerPage(await fetchPage(cursor), locale);
    if (!page) return null;
    for (const item of page.items) {
      const existing = items.get(item.adapterCode);
      if (existing && JSON.stringify(existing) !== JSON.stringify(item)) return null;
      items.set(item.adapterCode, item);
      if (items.size > INTEGRATION_CONTROL_TOWER_MAX_ITEMS) return null;
    }
    if (page.nextCursor === null) return [...items.values()];
    if (seenCursors.has(page.nextCursor)) return null;
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  return null;
}
