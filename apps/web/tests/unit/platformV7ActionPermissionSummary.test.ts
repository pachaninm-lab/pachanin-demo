import { describe, expect, it } from 'vitest';
import { getPlatformV7ActionPermissionBoundarySummary } from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 action permission summary', () => {
  it('keeps the action boundary contract explicit', () => {
    expect(getPlatformV7ActionPermissionBoundarySummary()).toEqual({
      mode: 'contract_only_requires_runtime',
      actionCount: 22,
      serviceCount: 11,
      needsDurableWrite: true,
      needsAuditEvent: true,
      needsIdempotencyKey: true,
    });
  });
});
