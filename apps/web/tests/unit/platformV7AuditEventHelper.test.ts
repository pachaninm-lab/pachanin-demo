import { describe, expect, it } from 'vitest';
import {
  buildPlatformV7AuditEvent,
  getPlatformV7AuditEventReadModel,
  isPlatformV7AuditEventAppendOnly,
  validatePlatformV7AuditEvent,
} from '@/lib/platform-v7/audit-event-helper';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';

describe('platform-v7 audit event helper', () => {
  const moneyKey = buildPlatformV7IdempotencyKey({
    boundaryId: 'confirm_money_released',
    actorId: 'bank-1',
    entityId: 'money-1',
    dealId: 'deal-1',
    amountMinor: 100,
    currency: 'RUB',
    attemptId: 'first',
  });

  it('builds append-only non-user-deletable audit events', () => {
    const event = buildPlatformV7AuditEvent({
      boundaryId: 'confirm_money_released',
      actorId: 'bank-1',
      actorRole: 'bank',
      entityId: 'money-1',
      entityType: 'money_record',
      dealId: 'deal-1',
      idempotencyKey: moneyKey,
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Bank confirmed money release.',
      moneyAmountMinor: 100,
      currency: 'RUB',
    });

    expect(event.eventId).toContain('p7-audit:confirm_money_released');
    expect(isPlatformV7AuditEventAppendOnly(event)).toBe(true);
    expect(event.appendOnly).toBe(true);
    expect(event.userDeletable).toBe(false);
    expect(validatePlatformV7AuditEvent(event)).toEqual({ ok: true, issues: [] });
  });

  it('marks money-affecting events as critical', () => {
    const event = buildPlatformV7AuditEvent({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'money-1',
      entityType: 'money_record',
      dealId: 'deal-1',
      idempotencyKey: buildPlatformV7IdempotencyKey({
        boundaryId: 'request_money_reserve',
        actorId: 'buyer-1',
        entityId: 'money-1',
        dealId: 'deal-1',
        amountMinor: 100,
        currency: 'RUB',
      }),
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Buyer requested reserve.',
      moneyAmountMinor: 100,
      currency: 'RUB',
    });

    expect(event.affectsMoney).toBe(true);
    expect(event.severity).toBe('critical');
  });

  it('rejects money-affecting events without amount and currency', () => {
    const event = buildPlatformV7AuditEvent({
      boundaryId: 'confirm_money_reserved',
      actorId: 'bank-1',
      actorRole: 'bank',
      entityId: 'money-1',
      entityType: 'money_record',
      dealId: 'deal-1',
      idempotencyKey: moneyKey,
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Bank confirmed reserve.',
    });

    expect(validatePlatformV7AuditEvent(event)).toMatchObject({ ok: false });
    expect(validatePlatformV7AuditEvent(event).issues).toContain('Money-affecting audit event must include amount and currency.');
  });

  it('rejects deal-bound events without deal id or idempotency key', () => {
    const event = buildPlatformV7AuditEvent({
      boundaryId: 'accept_trip',
      actorId: 'elevator-1',
      actorRole: 'elevator',
      entityId: 'trip-1',
      entityType: 'trip',
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Elevator accepted trip.',
      moneyAmountMinor: 100,
      currency: 'RUB',
    });

    const result = validatePlatformV7AuditEvent(event);

    expect(result.ok).toBe(false);
    expect(result.issues).toContain('Audit event must include deal id for deal-bound boundary.');
    expect(result.issues).toContain('Audit event must include idempotency key for idempotent boundary.');
  });

  it('returns a compact read model without mutable flags', () => {
    const event = buildPlatformV7AuditEvent({
      boundaryId: 'mark_trip_arrived',
      actorId: 'driver-1',
      actorRole: 'driver',
      entityId: 'trip-1',
      entityType: 'trip',
      dealId: 'deal-1',
      idempotencyKey: buildPlatformV7IdempotencyKey({
        boundaryId: 'mark_trip_arrived',
        actorId: 'driver-1',
        entityId: 'trip-1',
        dealId: 'deal-1',
      }),
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Driver arrived.',
      evidenceRefs: ['photo-1'],
    });

    expect(getPlatformV7AuditEventReadModel(event)).toEqual({
      eventId: event.eventId,
      boundaryId: 'mark_trip_arrived',
      actorRole: 'driver',
      entityType: 'trip',
      entityId: 'trip-1',
      dealId: 'deal-1',
      occurredAt: '2026-05-07T10:00:00.000Z',
      affectsMoney: false,
      severity: 'warning',
      summary: 'Driver arrived.',
    });
  });
});
