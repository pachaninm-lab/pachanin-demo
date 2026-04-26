export type P7MoneyProvider = 'sber_safe_deals' | 'manual_bank' | 'demo';

export type P7MoneyEventType =
  | 'reserve_confirmed'
  | 'hold_applied'
  | 'release_requested'
  | 'release_confirmed'
  | 'return_confirmed'
  | 'bank_mismatch';

export type P7MoneyRejectCode =
  | 'INVALID_DEAL_ID'
  | 'INVALID_EVENT_ID'
  | 'INVALID_AMOUNT'
  | 'INVALID_PROVIDER';

export type P7ReleaseBlockerCode =
  | 'NO_CONFIRMED_RESERVE'
  | 'INVALID_RELEASE_AMOUNT'
  | 'REQUEST_EXCEEDS_RESERVE'
  | 'HOLD_ACTIVE'
  | 'DISPUTE_OPEN'
  | 'DOCS_INCOMPLETE'
  | 'BANK_CALLBACK_MISSING'
  | 'TRANSPORT_GATE_BLOCKED'
  | 'FGIS_GATE_BLOCKED'
  | 'RELEASE_ALREADY_RECORDED';

export interface P7MoneyEvent {
  readonly dealId: string;
  readonly eventId: string;
  readonly type: P7MoneyEventType;
  readonly amount: number;
  readonly currency?: string;
  readonly provider: P7MoneyProvider;
  readonly providerOperationId?: string;
  readonly occurredAt: string;
  readonly payloadHash?: string;
}

export interface P7LedgerEntry {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly dealId: string;
  readonly eventId: string;
  readonly type: P7MoneyEventType;
  readonly amount: number;
  readonly currency: string;
  readonly provider: P7MoneyProvider;
  readonly providerOperationId?: string;
  readonly occurredAt: string;
  readonly acceptedAt: string;
  readonly payloadHash?: string;
}

export interface P7MoneyAppendOptions {
  readonly at?: () => string;
}

export type P7MoneyAppendResult =
  | {
      readonly status: 'accepted';
      readonly idempotencyKey: string;
      readonly entry: P7LedgerEntry;
      readonly ledger: P7LedgerEntry[];
    }
  | {
      readonly status: 'duplicate';
      readonly idempotencyKey: string;
      readonly entry: P7LedgerEntry;
      readonly ledger: P7LedgerEntry[];
    }
  | {
      readonly status: 'rejected';
      readonly idempotencyKey: string;
      readonly reasonCode: P7MoneyRejectCode;
      readonly ledger: P7LedgerEntry[];
    };

export interface P7ReleaseGuardInput {
  readonly dealId: string;
  readonly reservedAmount: number;
  readonly holdAmount: number;
  readonly requestedAmount?: number;
  readonly docsComplete: boolean;
  readonly bankCallbackConfirmed: boolean;
  readonly disputeOpen: boolean;
  readonly transportGateClear?: boolean;
  readonly fgisGateClear?: boolean;
  readonly existingReleaseIds?: string[];
  readonly releaseRequestId?: string;
}

export type P7ReleaseDecision =
  | {
      readonly state: 'blocked';
      readonly reasonCode: P7ReleaseBlockerCode;
      readonly blockers: P7ReleaseBlockerCode[];
      readonly releasableAmount: 0;
      readonly idempotencyKey: string;
    }
  | {
      readonly state: 'releasable';
      readonly reasonCode: 'READY_FOR_RELEASE';
      readonly blockers: [];
      readonly releasableAmount: number;
      readonly idempotencyKey: string;
    };

export const P7_RELEASE_BLOCKER_LABELS: Record<P7ReleaseBlockerCode, string> = {
  NO_CONFIRMED_RESERVE: 'Нет подтверждённого резерва',
  INVALID_RELEASE_AMOUNT: 'Некорректная сумма выпуска',
  REQUEST_EXCEEDS_RESERVE: 'Запрошенная сумма превышает резерв',
  HOLD_ACTIVE: 'Есть активное удержание',
  DISPUTE_OPEN: 'Открыт спор',
  DOCS_INCOMPLETE: 'Документный пакет не закрыт',
  BANK_CALLBACK_MISSING: 'Нет подтверждённого callback банка',
  TRANSPORT_GATE_BLOCKED: 'Транспортный gate блокирует выпуск',
  FGIS_GATE_BLOCKED: 'ФГИС gate блокирует выпуск',
  RELEASE_ALREADY_RECORDED: 'Выпуск уже зафиксирован в ledger',
};

function sanitizeKeyPart(value: string | number | undefined | null): string {
  const text = String(value ?? 'none').trim().toLowerCase();
  return text
    .replace(/[^a-z0-9а-яё._:-]+/giu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'none';
}

function amountFingerprint(amount: number): string {
  if (!Number.isFinite(amount)) return 'invalid';
  return String(Math.round(amount * 100));
}

function normalizeAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function buildMoneyEventIdempotencyKey(event: Pick<P7MoneyEvent, 'dealId' | 'eventId' | 'type' | 'amount' | 'currency' | 'provider' | 'providerOperationId'>): string {
  const providerRef = event.providerOperationId ?? event.eventId;
  return [
    'money',
    event.dealId,
    event.type,
    event.provider,
    providerRef,
    event.currency ?? 'RUB',
    amountFingerprint(event.amount),
  ].map(sanitizeKeyPart).join(':');
}

export function buildReleaseCommandIdempotencyKey(input: Pick<P7ReleaseGuardInput, 'dealId' | 'reservedAmount' | 'holdAmount' | 'requestedAmount' | 'releaseRequestId'>): string {
  const requestedAmount = input.requestedAmount ?? Math.max(input.reservedAmount - input.holdAmount, 0);
  return [
    'release',
    input.dealId,
    input.releaseRequestId ?? 'default',
    amountFingerprint(requestedAmount),
    amountFingerprint(input.reservedAmount),
  ].map(sanitizeKeyPart).join(':');
}

function validateMoneyEvent(event: P7MoneyEvent): P7MoneyRejectCode | null {
  if (!event.dealId.trim()) return 'INVALID_DEAL_ID';
  if (!event.eventId.trim() && !event.providerOperationId?.trim()) return 'INVALID_EVENT_ID';
  if (!Number.isFinite(event.amount) || event.amount <= 0) return 'INVALID_AMOUNT';
  if (!event.provider.trim()) return 'INVALID_PROVIDER';
  return null;
}

export function appendMoneyEventOnce(existingEntries: readonly P7LedgerEntry[], event: P7MoneyEvent, options: P7MoneyAppendOptions = {}): P7MoneyAppendResult {
  const idempotencyKey = buildMoneyEventIdempotencyKey(event);
  const duplicate = existingEntries.find((entry) => entry.idempotencyKey === idempotencyKey);

  if (duplicate) {
    return {
      status: 'duplicate',
      idempotencyKey,
      entry: duplicate,
      ledger: [...existingEntries],
    };
  }

  const reasonCode = validateMoneyEvent(event);
  if (reasonCode) {
    return {
      status: 'rejected',
      idempotencyKey,
      reasonCode,
      ledger: [...existingEntries],
    };
  }

  const acceptedAt = options.at?.() ?? new Date().toISOString();
  const entry: P7LedgerEntry = {
    id: `ledger:${idempotencyKey}`,
    idempotencyKey,
    dealId: event.dealId,
    eventId: event.eventId,
    type: event.type,
    amount: normalizeAmount(event.amount),
    currency: event.currency ?? 'RUB',
    provider: event.provider,
    providerOperationId: event.providerOperationId,
    occurredAt: event.occurredAt,
    acceptedAt,
    payloadHash: event.payloadHash,
  };

  return {
    status: 'accepted',
    idempotencyKey,
    entry,
    ledger: [...existingEntries, entry],
  };
}

export function decideMoneyRelease(input: P7ReleaseGuardInput): P7ReleaseDecision {
  const requestedAmount = input.requestedAmount ?? Math.max(input.reservedAmount - input.holdAmount, 0);
  const blockers: P7ReleaseBlockerCode[] = [];

  if (input.reservedAmount <= 0) blockers.push('NO_CONFIRMED_RESERVE');
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) blockers.push('INVALID_RELEASE_AMOUNT');
  if (requestedAmount > input.reservedAmount) blockers.push('REQUEST_EXCEEDS_RESERVE');
  if (input.holdAmount > 0) blockers.push('HOLD_ACTIVE');
  if (input.disputeOpen) blockers.push('DISPUTE_OPEN');
  if (!input.docsComplete) blockers.push('DOCS_INCOMPLETE');
  if (!input.bankCallbackConfirmed) blockers.push('BANK_CALLBACK_MISSING');
  if (input.transportGateClear === false) blockers.push('TRANSPORT_GATE_BLOCKED');
  if (input.fgisGateClear === false) blockers.push('FGIS_GATE_BLOCKED');
  if ((input.existingReleaseIds ?? []).length > 0) blockers.push('RELEASE_ALREADY_RECORDED');

  const idempotencyKey = buildReleaseCommandIdempotencyKey(input);

  if (blockers.length > 0) {
    return {
      state: 'blocked',
      reasonCode: blockers[0] ?? 'NO_CONFIRMED_RESERVE',
      blockers,
      releasableAmount: 0,
      idempotencyKey,
    };
  }

  return {
    state: 'releasable',
    reasonCode: 'READY_FOR_RELEASE',
    blockers: [],
    releasableAmount: normalizeAmount(requestedAmount),
    idempotencyKey,
  };
}
