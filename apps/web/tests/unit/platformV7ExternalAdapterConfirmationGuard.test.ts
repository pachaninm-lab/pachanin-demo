import { describe, expect, it } from 'vitest';
import { platformV7CreateMockAdapter } from '@/lib/platform-v7/external-adapters';

const systems = ['bank', 'fgis', 'edo', 'epd', 'logistics', 'lab', 'oneC', 'notification'] as const;

const ctx = {
  correlationId: 'corr-confirmation-guard',
  auditId: 'audit-confirmation-guard',
  actorId: 'operator-1',
  organizationId: 'org-1',
  role: 'operator',
};

describe('platform-v7 external adapter confirmation guard', () => {
  it('keeps every mock adapter call from confirming external execution', async () => {
    for (const system of systems) {
      const adapter = platformV7CreateMockAdapter(system);
      const result = await adapter.call({ operation: 'auditGuardCall', context: ctx });

      expect(result.provider, system).toBe('mock');
      expect(result.system, system).toBe(system);
      expect(result.doesNotConfirmExternally, system).toBe(true);
      expect(result.status, system).not.toBe('confirmed');
      expect(result.status, system).not.toBe('live');
      expect(result.status, system).not.toBe('integrated');
    }
  });
});
