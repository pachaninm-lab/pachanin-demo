import { describe, expect, it } from 'vitest';
import {
  formatSupportRub,
  getOperatorSupportQueue,
  getSupportCase,
  getSupportMoneyAtRisk,
  getSupportOpenCases,
  getSupportSlaLabel,
  platformV7SupportCases,
  supportCategoryLabel,
  supportCreateDefaults,
  supportEntityLabel,
  supportPriorityLabel,
  supportRoleLabel,
  supportStatusLabel,
} from '@/lib/platform-v7/support-center';

describe('platform-v7 support center model', () => {
  it('contains execution-linked support cases', () => {
    expect(platformV7SupportCases.length).toBeGreaterThanOrEqual(4);

    for (const supportCase of platformV7SupportCases) {
      expect(supportCase.id).toMatch(/^SUP-/);
      expect(supportCase.title.length).toBeGreaterThan(6);
      expect(supportCase.description.length).toBeGreaterThan(12);
      expect(supportStatusLabel[supportCase.status]).toBeTruthy();
      expect(supportPriorityLabel[supportCase.priority]).toBeTruthy();
      expect(supportCategoryLabel[supportCase.category]).toBeTruthy();
      expect(supportRoleLabel[supportCase.requesterRole]).toBeTruthy();
      expect(supportEntityLabel[supportCase.relatedEntityType]).toBeTruthy();
      expect(supportCase.relatedEntityId.length).toBeGreaterThan(0);
      expect(supportCase.slaDueAt).toContain('T');
      expect(supportCase.createdAt).toContain('T');
      expect(supportCase.updatedAt).toContain('T');
      expect(supportCase.messages.length).toBeGreaterThan(0);
      expect(supportCase.auditEvents.length).toBeGreaterThan(0);
    }
  });

  it('calculates open cases and money at risk', () => {
    const openCases = getSupportOpenCases();

    expect(openCases.length).toBe(platformV7SupportCases.length);
    expect(getSupportMoneyAtRisk()).toBeGreaterThan(18_000_000);
    expect(formatSupportRub(18420000)).toBe('18 420 000 ₽');
  });

  it('sorts operator queue by priority and SLA', () => {
    const queue = getOperatorSupportQueue();

    expect(queue[0]?.priority).toBe('P0');
    expect(queue[0]?.id).toBe('SUP-2406-001');
    expect(queue.map((item) => item.id)).toContain('SUP-2406-002');
    expect(queue.map((item) => item.id)).toContain('SUP-2406-003');
  });

  it('returns case details and SLA labels', () => {
    const supportCase = getSupportCase('SUP-2406-001');

    expect(supportCase?.dealId).toBe('DL-9106');
    expect(supportCase?.tripId).toBe('TR-77-014');
    expect(supportCase?.blocker).toContain('СДИЗ');
    expect(supportCase ? getSupportSlaLabel(supportCase) : '').toContain('ч');
    expect(getSupportCase('missing')).toBeUndefined();
  });

  it('keeps create form options in sync with labels', () => {
    for (const category of supportCreateDefaults.categories) expect(supportCategoryLabel[category]).toBeTruthy();
    for (const role of supportCreateDefaults.requesterRoles) expect(supportRoleLabel[role]).toBeTruthy();
    for (const entity of supportCreateDefaults.relatedEntities) expect(supportEntityLabel[entity]).toBeTruthy();
  });
});
