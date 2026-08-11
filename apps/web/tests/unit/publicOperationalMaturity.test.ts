import { describe, expect, it } from 'vitest';
import { getPublicOperationalMaturity } from '../../lib/platform-v7/public-operational-maturity';

describe('public operational maturity copy', () => {
  it('selects RU, EN and ZH from exact and regional locale values', () => {
    expect(getPublicOperationalMaturity('ru-RU').cardLabel).toBe('Эксплуатационная зрелость');
    expect(getPublicOperationalMaturity('en-US').cardLabel).toBe('Operational maturity');
    expect(getPublicOperationalMaturity('zh-CN').cardLabel).toBe('运行成熟度');
  });

  it('uses Russian as the deterministic fallback', () => {
    expect(getPublicOperationalMaturity(undefined)).toEqual(getPublicOperationalMaturity('ru'));
    expect(getPublicOperationalMaturity('de-DE')).toEqual(getPublicOperationalMaturity('ru'));
  });

  it('keeps every locale bounded and on the canonical trust route', () => {
    for (const locale of ['ru', 'en', 'zh'] as const) {
      const copy = getPublicOperationalMaturity(locale);
      expect(copy.cardLabel.length).toBeGreaterThan(0);
      expect(copy.status.length).toBeGreaterThan(0);
      expect(copy.summary.length).toBeGreaterThan(0);
      expect(copy.points).toHaveLength(3);
      expect(copy.points.every((point) => point.length > 0)).toBe(true);
      expect(copy.cta.length).toBeGreaterThan(0);
      expect(copy.ctaHref).toBe('/platform-v7/trust');
    }
  });
});
