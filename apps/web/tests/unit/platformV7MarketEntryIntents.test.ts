import { describe, expect, it } from 'vitest';
import { marketIntentActionLabel, marketIntentTargetHref } from '@/lib/platform-v7/market-entry-intents';

describe('market entry intent helpers', () => {
  it('routes sell intent to lot creation', () => {
    expect(marketIntentActionLabel('sell')).toBe('Создать лот продавца');
    expect(marketIntentTargetHref('sell')).toBe('/platform-v7/lots/create');
  });

  it('routes buy intent to RFQ creation', () => {
    expect(marketIntentActionLabel('buy')).toBe('Создать RFQ покупателя');
    expect(marketIntentTargetHref('buy')).toBe('/platform-v7/buyer/rfq/new');
  });
});
