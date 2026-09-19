import { describe, expect, it } from 'vitest';
import { buildPlatformV7AuditEvent } from '@/lib/platform-v7/audit-event-helper';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { checkPlatformV7ServerAuditBoundary } from '@/lib/platform-v7/server-audit-boundary';
import type { PlatformV7ApiBoundaryId } from '@/lib/platform-v7/api-boundary-contracts';
import type { PlatformV7ServerActionContractResponse } from '@/lib/platform-v7/server-action-contract-wrapper';

const response = (boundaryId: PlatformV7ApiBoundaryId): PlatformV7ServerActionContractResponse => ({
  boundaryId,
  status: 'contract_checked',
  httpStatus: 202,
  message: 'checked',
  nextAction: 'next',
  canClaimExecuted: false,
  persisted: false,
  attemptedRuntimeWrite: false,
  issueCount: 1,
  signalCount: 1,
  repositoryDurable: false,
});

const moneyKey = buildPlatformV7IdempotencyKey({
  boundaryId: 'request_money_reserve',
  actorId: 'buyer-1',
  entityId: 'money-1',
  dealId: 'deal-1',
  amountMinor: 100_000,
  currency: 'RUB',
  attemptId: 'attempt-1',
});

describe('platform-v7 server audit boundary', () => {
  it('does not require audit event for read boundaries', () => {
    const result = checkPlatformV7ServerAuditBoundary(response('list_batches'));

    expect(result).toMatchObject({
      status: 'not_required_read_boundary',
      canProceed: true,
      requiresAuditRecord: false,
      auditEventValid: true,
    });
  });

  it('blocks audited write boundaries without audit event', () => {
    const result = checkPlatformV7ServerAuditBoundary(response('create_batch'));

    expect(result).toMatchObject({
      status: 'blocked_missing_audit_event',
      canProceed: false,
      requiresAuditRecord: true,
      auditEventValid: false,
      appendOnly: false,
    });
  });

  it('blocks money boundaries without complete money audit event', () => {
    const auditEvent = buildPlatformV7AuditEvent({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'money-1',
      entityType: 'money_record',
      dealId: 'deal-1',
      idempotencyKey: moneyKey,
      occurredAt: '2026-05-08T02:00:00.000Z',
      summary: 'Money reserve requested.',
    });

    const result = checkPlatformV7ServerAuditBoundary(response('request_money_reserve'), auditEvent);

    expect(result.status).toBe('blocked_invalid_audit_event');
    expect(result.canProceed).toBe(false);
  });

  it('allows complete critical money audit events to reach append-only record check', () => {
    const auditEvent = buildPlatformV7AuditEvent({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'money-1',
      entityType: 'money_record',
      dealId: 'deal-1',
      idempotencyKey: moneyKey,
      occurredAt: '2026-05-08T02:00:00.000Z',
      summary: 'Money reserve requested.',
      moneyAmountMinor: 100_000,
      currency: 'RUB',
    });

    const result = checkPlatformV7ServerAuditBoundary(response('request_money_reserve'), auditEvent);

    expect(result).toMatchObject({
      status: 'ready_for_append_only_audit_record',
      canProceed: true,
      requiresAuditRecord: true,
      auditEventValid: true,
      appendOnly: true,
      moneyAuditComplete: true,
    });
  });
});
