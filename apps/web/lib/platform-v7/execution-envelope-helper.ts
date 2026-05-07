import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';
import { getPlatformV7ApiBoundary } from './api-boundary-contracts';
import { buildPlatformV7AuditEvent, validatePlatformV7AuditEvent, type PlatformV7AuditEvent } from './audit-event-helper';
import { validatePlatformV7ApiPayload, type PlatformV7PayloadValidationIssue } from './api-payload-validator';
import { buildPlatformV7IdempotencyKey, validatePlatformV7IdempotencyKey } from './idempotency-key-helper';

export type PlatformV7ExecutionEnvelopeInput = {
  readonly boundaryId: PlatformV7ApiBoundaryId;
  readonly actorId: string;
  readonly actorRole: string;
  readonly entityId: string;
  readonly entityType: string;
  readonly payload: Record<string, unknown>;
  readonly dealId?: string;
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly attemptId?: string;
  readonly occurredAt: string;
  readonly summary: string;
  readonly evidenceRefs?: readonly string[];
};

export type PlatformV7ExecutionEnvelope = {
  readonly boundaryId: PlatformV7ApiBoundaryId;
  readonly payload: Record<string, unknown>;
  readonly idempotencyKey: string;
  readonly auditEvent: PlatformV7AuditEvent;
  readonly affectsMoney: boolean;
  readonly contractOnly: true;
};

export type PlatformV7ExecutionEnvelopeValidationResult = {
  readonly ok: boolean;
  readonly issues: readonly string[];
  readonly payloadIssues: readonly PlatformV7PayloadValidationIssue[];
};

const readString = (payload: Record<string, unknown>, field: string): string | undefined => {
  const value = payload[field];

  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

const readNumber = (payload: Record<string, unknown>, field: string): number | undefined => {
  const value = payload[field];

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

export function buildPlatformV7ExecutionEnvelope(input: PlatformV7ExecutionEnvelopeInput): PlatformV7ExecutionEnvelope {
  const boundary = getPlatformV7ApiBoundary(input.boundaryId);
  const dealId = input.dealId ?? readString(input.payload, 'dealId');
  const amountMinor = input.amountMinor ?? readNumber(input.payload, 'amountMinor') ?? readNumber(input.payload, 'claimAmountMinor');
  const currency = input.currency ?? readString(input.payload, 'currency');
  const idempotencyKey = buildPlatformV7IdempotencyKey({
    boundaryId: input.boundaryId,
    actorId: input.actorId,
    entityId: input.entityId,
    dealId,
    amountMinor,
    currency,
    attemptId: input.attemptId,
  });

  const auditEvent = buildPlatformV7AuditEvent({
    boundaryId: input.boundaryId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    entityId: input.entityId,
    entityType: input.entityType,
    dealId,
    idempotencyKey,
    occurredAt: input.occurredAt,
    summary: input.summary,
    evidenceRefs: input.evidenceRefs,
    moneyAmountMinor: amountMinor,
    currency,
  });

  return {
    boundaryId: input.boundaryId,
    payload: input.payload,
    idempotencyKey,
    auditEvent,
    affectsMoney: boundary?.affectsMoney === true,
    contractOnly: true,
  };
}

export function validatePlatformV7ExecutionEnvelope(
  envelope: PlatformV7ExecutionEnvelope,
): PlatformV7ExecutionEnvelopeValidationResult {
  const payloadResult = validatePlatformV7ApiPayload(envelope.boundaryId, envelope.payload);
  const auditResult = validatePlatformV7AuditEvent(envelope.auditEvent);
  const idempotencyResult = validatePlatformV7IdempotencyKey(envelope.idempotencyKey);
  const issues: string[] = [];

  if (envelope.contractOnly !== true) {
    issues.push('Execution envelope must remain contract-only.');
  }

  if (envelope.auditEvent.idempotencyKey !== envelope.idempotencyKey) {
    issues.push('Audit event must reference the same idempotency key as the envelope.');
  }

  if (envelope.auditEvent.boundaryId !== envelope.boundaryId) {
    issues.push('Audit event boundary must match envelope boundary.');
  }

  if (envelope.affectsMoney && !envelope.auditEvent.affectsMoney) {
    issues.push('Money-affecting envelope must have money-affecting audit event.');
  }

  if (!auditResult.ok) {
    issues.push(...auditResult.issues);
  }

  if (!idempotencyResult.ok) {
    issues.push(...idempotencyResult.issues);
  }

  return {
    ok: payloadResult.ok && issues.length === 0,
    issues,
    payloadIssues: payloadResult.issues,
  };
}

export function assertPlatformV7ExecutionEnvelope(envelope: PlatformV7ExecutionEnvelope) {
  const result = validatePlatformV7ExecutionEnvelope(envelope);

  if (!result.ok) {
    throw new Error([...result.issues, ...result.payloadIssues.map((issue) => issue.message)].join(' '));
  }

  return envelope;
}
