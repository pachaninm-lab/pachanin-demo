import { describe, expect, it } from 'vitest';
import { MARKET_TRUST_PROFILES, trustRiskLabel } from '@/lib/platform-v7/market-entry-trust';

describe('market entry trust profiles', () => {
  it('marks profiles requiring review before deal launch', () => {
    expect(trustRiskLabel(MARKET_TRUST_PROFILES[0])).toBe('допуск возможен');
    expect(trustRiskLabel(MARKET_TRUST_PROFILES[1])).toBe('требует проверки');
  });
});
