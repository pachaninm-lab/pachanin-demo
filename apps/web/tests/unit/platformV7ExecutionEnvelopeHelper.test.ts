import { describe, expect, it } from 'vitest';
import {
  assertPlatformV7ExecutionEnvelope,
  buildPlatformV7ExecutionEnvelope,
  validatePlatformV7ExecutionEnvelope,
} from '@/lib/platform-v7/execution-envelope-helper';

describe('platform-v7 execution envelope helper', () => {
  it('builds a valid money envelope with payload, idempotency and audit event', () => {
    const envelope = buildPlatformV7ExecutionEnvelope({
      boundaryId: 'confirm_money_released',
      actorId: 'bank-1',
      actorRole: 'bank',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: {
        dealId: 'deal-1',
        amountMinor: 964800000,
        currency: 'RUB',
        bankReferenceId: 'BANK-REF-1',
        confirmedAt: '2026-05-07T10:00:00.000Z',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Bank boundary recorded.',
      attemptId: 'first',
    });

    expect(envelope.contractOnly).toBe(true);
    expect(envelope.affectsMoney).toBe(true);
    expect(envelope.auditEvent.idempotencyKey).toBe(envelope.idempotencyKey);
    expect(envelope.auditEvent.affectsMoney).toBe(true);
    expect(envelope.auditEvent.severity).toBe('critical');
    expect(validatePlatformV7ExecutionEnvelope(envelope)).toEqual({ ok: true, issues: [], payloadIssues: [] });
  });

  it('rejects an envelope when required evidence payload is missing', () => {
    const envelope = buildPlatformV7ExecutionEnvelope({
      boundaryId: 'open_dispute',
      actorId: 'seller-1',
      actorRole: 'seller',
      entityId: 'dispute-1',
      entityType: 'dispute',
      payload: {
        dealId: 'deal-1',
        reason: 'Quality issue',
        claimAmountMinor: 1200000,
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Dispute boundary recorded.',
      attemptId: 'first',
    });

    const result = validatePlatformV7ExecutionEnvelope(envelope);

    expect(result.ok).toBe(false);
    expect(result.payloadIssues.map((issue) => issue.code)).toContain('missing_required_field');
    expect(result.payloadIssues.map((issue) => issue.code)).toContain('missing_evidence_reference');
  });

  it('rejects an envelope when audit idempotency key diverges', () => {
    const envelope = buildPlatformV7ExecutionEnvelope({
      boundaryId: 'mark_trip_arrived',
      actorId: 'driver-1',
      actorRole: 'driver',
      entityId: 'trip-1',
      entityType: 'trip',
      payload: {
        dealId: 'deal-1',
        tripId: 'trip-1',
        arrivedAt: '2026-05-07T10:00:00.000Z',
        geoPoint: { lat: 52.1, lon: 39.2 },
      },
      evidenceRefs: ['geo-1'],
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Trip arrival boundary recorded.',
    });

    const brokenEnvelope = {
      ...envelope,
      auditEvent: {
        ...envelope.auditEvent,
        idempotencyKey: 'p7:broken:actor-driver-1:entity-trip-1:deal-deal-1:amount-none:currency-none:attempt-none',
      },
    };

    const result = validatePlatformV7ExecutionEnvelope(brokenEnvelope);

    expect(result.ok).toBe(false);
    expect(result.issues).toContain('Audit event must reference the same idempotency key as the envelope.');
  });

  it('asserts valid envelopes and throws for invalid envelopes', () => {
    const valid = buildPlatformV7ExecutionEnvelope({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: {
        dealId: 'deal-1',
        amountMinor: 100,
        currency: 'RUB',
        reason: 'Reserve request.',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Reserve boundary recorded.',
    });

    expect(assertPlatformV7ExecutionEnvelope(valid)).toBe(valid);

    const invalid = buildPlatformV7ExecutionEnvelope({
      boundaryId: 'confirm_money_released',
      actorId: 'bank-1',
      actorRole: 'bank',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: { dealId: 'deal-1' },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Incomplete boundary.',
    });

    expect(() => assertPlatformV7ExecutionEnvelope(invalid)).toThrow('Required field amountMinor is missing');
  });
});
