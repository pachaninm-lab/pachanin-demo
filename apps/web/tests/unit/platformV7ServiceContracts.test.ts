import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_EXECUTION_SERVICE_NAMES,
  doesPlatformV7ExecutionRegistryRequireTripBoundary,
} from '@/lib/platform-v7/execution-service-registry-contract';
import {
  hasPlatformV7WriteAuditTrace,
  hasPlatformV7WriteIdempotencyTrace,
  isPlatformV7WriteResultTraceable,
  PLATFORM_V7_REQUIRED_SERVICE_NAMES,
  type PlatformV7WriteResult,
} from '@/lib/platform-v7/service-contracts';

const REQUIRED = [
  'batch',
  'lot',
  'rfq',
  'proposal',
  'deal',
  'money',
  'document',
  'logistics',
  'dispute',
  'support',
  'rating',
  'audit',
  'notification',
  'integrations',
] as const;

describe('platform-v7 service contracts', () => {
  it('keeps the full controlled-pilot backend service boundary explicit', () => {
    expect(PLATFORM_V7_REQUIRED_SERVICE_NAMES).toEqual(REQUIRED);
  });

  it('keeps the trip service inside the execution registry', () => {
    expect(doesPlatformV7ExecutionRegistryRequireTripBoundary()).toBe(true);
    expect(PLATFORM_V7_EXECUTION_SERVICE_NAMES).toContain('trip');
  });

  it('does not mark service boundary as production-ready', () => {
    expect(PLATFORM_V7_REQUIRED_SERVICE_NAMES.join(' ')).not.toMatch(/production-ready|fully live|fully integrated/i);
  });

  it('requires audit and idempotency traces before a write result is treated as traceable', () => {
    const base: PlatformV7WriteResult<{ readonly saved: true }> = {
      ok: true,
      mode: 'controlled_pilot',
      data: { saved: true },
    };

    expect(hasPlatformV7WriteAuditTrace(base)).toBe(false);
    expect(hasPlatformV7WriteIdempotencyTrace(base)).toBe(false);
    expect(isPlatformV7WriteResultTraceable(base)).toBe(false);
    expect(
      isPlatformV7WriteResultTraceable({
        ...base,
        auditEventId: 'audit-1',
        idempotencyKey: 'p7:assign_driver:actor-logistics-1:entity-trip-1:deal-deal-1:amount-none:currency-none:attempt-1',
      }),
    ).toBe(true);
  });

  it('keeps test-mode write results non-traceable even with local traces', () => {
    expect(
      isPlatformV7WriteResultTraceable({
        ok: true,
        mode: 'test',
        auditEventId: 'audit-1',
        idempotencyKey: 'p7:test:actor-1:entity-1:deal-none:amount-none:currency-none:attempt-1',
      }),
    ).toBe(false);
  });
});
