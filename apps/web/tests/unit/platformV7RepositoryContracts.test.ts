import { describe, expect, it } from 'vitest';
import {
  p7CreateAuditRecord,
  p7CreateOutboxRecord,
  p7OptimisticVersionMatches,
  p7ValidateRepositoryRecord,
  type P7RepositoryRecord,
} from '@/lib/platform-v7/repository-contracts';

const record: P7RepositoryRecord = {
  id: 'deal-1',
  entity: 'deal',
  organizationId: 'org-1',
  createdAt: '2026-05-22T00:00:00Z',
  updatedAt: '2026-05-22T00:00:00Z',
  version: 1,
};

describe('platform-v7 repository contracts', () => {
  it('validates minimal repository record identity and version', () => {
    expect(p7ValidateRepositoryRecord(record)).toBe(true);
    expect(p7ValidateRepositoryRecord({ ...record, version: 0 })).toBe(false);
  });

  it('guards optimistic version sequencing', () => {
    expect(p7OptimisticVersionMatches(record, { ...record, version: 2 })).toBe(true);
    expect(p7OptimisticVersionMatches(record, { ...record, version: 3 })).toBe(false);
    expect(p7OptimisticVersionMatches(record, { ...record, id: 'deal-2', version: 2 })).toBe(false);
  });

  it('creates audit records with trace ids', () => {
    const audit = p7CreateAuditRecord({
      id: 'audit-row-1',
      organizationId: 'org-1',
      actorId: 'user-1',
      actorRole: 'operator',
      action: 'request_release',
      targetEntity: 'deal',
      targetId: 'deal-1',
      correlationId: 'corr-1',
      auditId: 'audit-1',
      now: '2026-05-22T00:00:00Z',
    });

    expect(audit.entity).toBe('auditEvent');
    expect(audit.correlationId).toBe('corr-1');
    expect(audit.auditId).toBe('audit-1');
    expect(audit.version).toBe(1);
  });

  it('creates outbox records as pending external calls with idempotency', () => {
    const outbox = p7CreateOutboxRecord({
      id: 'outbox-1',
      organizationId: 'org-1',
      system: 'bank',
      operation: 'request_release',
      idempotencyKey: 'idem-1',
      correlationId: 'corr-1',
      auditId: 'audit-1',
      now: '2026-05-22T00:00:00Z',
    });

    expect(outbox.entity).toBe('externalCall');
    expect(outbox.status).toBe('pending');
    expect(outbox.idempotencyKey).toBe('idem-1');
  });
});
