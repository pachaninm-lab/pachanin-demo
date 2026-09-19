import { describe, expect, it } from 'vitest';
import {
  hasPlatformV7WriteAuditTrace,
  isPlatformV7AuditEventId,
  isPlatformV7WriteResultTraceable,
  type PlatformV7WriteResult,
} from '@/lib/platform-v7/service-contracts';

const BASE_RESULT: PlatformV7WriteResult<{ readonly saved: true }> = {
  ok: true,
  mode: 'controlled_pilot',
  data: { saved: true },
  auditEventId: 'audit-1',
  idempotencyKey: 'p7:assign_driver:actor-logistics-1:entity-trip-1:deal-deal-1:amount-none:currency-none:attempt-1',
};

describe('platform-v7 write audit trace validation', () => {
  it('accepts stable platform-v7 audit event ids', () => {
    expect(isPlatformV7AuditEventId('audit-1')).toBe(true);
    expect(isPlatformV7AuditEventId('audit-money-release-1')).toBe(true);
    expect(hasPlatformV7WriteAuditTrace(BASE_RESULT)).toBe(true);
  });

  it('rejects non-audit event ids for traceable writes', () => {
    const result = { ...BASE_RESULT, auditEventId: 'event-1' };

    expect(isPlatformV7AuditEventId(result.auditEventId)).toBe(false);
    expect(hasPlatformV7WriteAuditTrace(result)).toBe(false);
    expect(isPlatformV7WriteResultTraceable(result)).toBe(false);
  });
});
