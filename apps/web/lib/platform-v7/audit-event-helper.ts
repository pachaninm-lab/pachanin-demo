import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';
import { getPlatformV7ApiBoundary } from './api-boundary-contracts';
import { validatePlatformV7IdempotencyKey } from './idempotency-key-helper';

export type PlatformV7AuditEventSeverity = 'info' | 'warning' | 'critical';

export type PlatformV7AuditEventInput = {
  readonly boundaryId: PlatformV7ApiBoundaryId;
  readonly actorId: string;
  readonly actorRole: string;
  readonly entityId: string;
  readonly entityType: string;
  readonly dealId?: string;
  readonly idempotencyKey?: string;
  readonly occurredAt: string;
  readonly summary: string;
  readonly evidenceRefs?: readonly string[];
  readonly moneyAmountMinor?: number;
  readonly currency?: string;
};

export type PlatformV7AuditEvent = PlatformV7AuditEventInput & {
  readonly eventId: string;
  readonly appendOnly: true;
  readonly userDeletable: false;
  readonly affectsMoney: boolean;
  readonly severity: PlatformV7AuditEventSeverity;
};

export type PlatformV7AuditEventValidationResult = {
  readonly ok: boolean;
  readonly issues: readonly string[];
};

const normalize = (value: string | number | undefined): string =>
  String(value ?? 'none')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export function buildPlatformV7AuditEvent(input: PlatformV7AuditEventInput): PlatformV7AuditEvent {
  const boundary = getPlatformV7ApiBoundary(input.boundaryId);
  const affectsMoney = boundary?.affectsMoney === true;
  const severity: PlatformV7AuditEventSeverity = affectsMoney
    ? 'critical'
    : input.evidenceRefs?.length
      ? 'warning'
      : 'info';

  return {
    ...input,
    eventId: ['p7-audit', normalize(input.boundaryId), normalize(input.actorId), normalize(input.entityId), normalize(input.occurredAt)].join(':'),
    appendOnly: true,
    userDeletable: false,
    affectsMoney,
    severity,
  };
}

export function validatePlatformV7AuditEvent(event: PlatformV7AuditEvent): PlatformV7AuditEventValidationResult {
  const issues: string[] = [];
  const boundary = getPlatformV7ApiBoundary(event.boundaryId);

  if (!event.eventId.startsWith('p7-audit:')) {
    issues.push('Audit event id must use p7-audit namespace.');
  }

  if (!event.actorId.trim()) {
    issues.push('Audit event must include actor id.');
  }

  if (!event.actorRole.trim()) {
    issues.push('Audit event must include actor role.');
  }

  if (!event.entityId.trim()) {
    issues.push('Audit event must include entity id.');
  }

  if (!event.entityType.trim()) {
    issues.push('Audit event must include entity type.');
  }

  if (!event.occurredAt.trim()) {
    issues.push('Audit event must include occurredAt timestamp.');
  }

  if (!event.summary.trim()) {
    issues.push('Audit event must include summary.');
  }

  if (event.appendOnly !== true) {
    issues.push('Audit event must be append-only.');
  }

  if (event.userDeletable !== false) {
    issues.push('Audit event must not be user-deletable.');
  }

  if (boundary?.requiresDealId && !event.dealId?.trim()) {
    issues.push('Audit event must include deal id for deal-bound boundary.');
  }

  if (boundary?.requiresIdempotencyKey && !event.idempotencyKey?.trim()) {
    issues.push('Audit event must include idempotency key for idempotent boundary.');
  }

  if (event.idempotencyKey && !validatePlatformV7IdempotencyKey(event.idempotencyKey).ok) {
    issues.push('Audit event idempotency key is invalid.');
  }

  if (event.affectsMoney && (event.moneyAmountMinor === undefined || !event.currency?.trim())) {
    issues.push('Money-affecting audit event must include amount and currency.');
  }

  return { ok: issues.length === 0, issues };
}

export function isPlatformV7AuditEventAppendOnly(event: PlatformV7AuditEvent): boolean {
  return event.appendOnly === true && event.userDeletable === false;
}

export function getPlatformV7AuditEventReadModel(event: PlatformV7AuditEvent) {
  return {
    eventId: event.eventId,
    boundaryId: event.boundaryId,
    actorRole: event.actorRole,
    entityType: event.entityType,
    entityId: event.entityId,
    dealId: event.dealId ?? null,
    occurredAt: event.occurredAt,
    affectsMoney: event.affectsMoney,
    severity: event.severity,
    summary: event.summary,
  };
}
