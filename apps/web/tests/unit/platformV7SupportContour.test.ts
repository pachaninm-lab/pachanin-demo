import { describe, expect, it } from 'vitest';
import { SUPPORT_CASES, SUPPORT_MESSAGES } from '@/lib/platform-v7/support-data';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_PRIORITY_LABELS, supportFormatRub, supportLastMessage, supportObjectLabel, supportOwner, supportPriority, supportSlaDueAt, supportSlaHours, supportSortCases, supportStatusByOwner } from '@/lib/platform-v7/support-helpers';

describe('platform-v7 support contour', () => {
  it('keeps support cases attached to a platform object', () => {
    for (const supportCase of SUPPORT_CASES) {
      expect(supportCase.relatedEntityId).toBeTruthy();
      expect(supportObjectLabel(supportCase)).toContain(supportCase.relatedEntityId);
      expect(supportCase.owner).toBeTruthy();
      expect(supportCase.nextAction).toBeTruthy();
      expect(supportCase.slaDueAt).toBeTruthy();
    }
  });

  it('sorts urgent and money-risk cases first', () => {
    const sorted = supportSortCases(SUPPORT_CASES);
    expect(sorted[0].priority).toBe('P0');
    expect(sorted[0].moneyAtRiskRub).toBeGreaterThan(0);
  });

  it('calculates SLA and priority deterministically', () => {
    expect(supportSlaHours('P0')).toBe(2);
    expect(supportSlaDueAt('P1', '2026-05-05T09:00:00.000Z')).toBe('2026-05-05T17:00:00.000Z');
    expect(supportPriority('money', 1000, 'выпуск остановлен')).toBe('P0');
    expect(supportPriority('documents', 0, 'нужен документ')).toBe('P1');
  });

  it('maps category to owner and status', () => {
    expect(SUPPORT_CATEGORY_LABELS.money).toBe('Деньги');
    expect(SUPPORT_PRIORITY_LABELS.P0).toBe('Критично');
    expect(supportOwner('logistics')).toBe('Логистика');
    expect(supportStatusByOwner('Логистика')).toBe('assigned_logistics');
  });

  it('keeps user-facing messages and money formatting readable', () => {
    expect(supportLastMessage('SC-9103', SUPPORT_MESSAGES)).toContain('Проверяются');
    expect(supportFormatRub(12840000)).toBe('12 840 000 ₽');
  });
});
