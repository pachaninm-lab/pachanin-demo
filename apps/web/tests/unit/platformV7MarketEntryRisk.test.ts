import { describe, expect, it } from 'vitest';
import { MARKET_ENTRY_RISK_FLAGS } from '@/lib/platform-v7/market-entry-risk';

describe('market entry risk registry', () => {
  it('keeps the pre-deal risk controls explicit', () => {
    expect(MARKET_ENTRY_RISK_FLAGS.map((item) => item.id)).toEqual(['price-source', 'route-rate', 'counterparty', 'money']);
    expect(MARKET_ENTRY_RISK_FLAGS[0].action).toContain('Проверить источник');
  });
});
