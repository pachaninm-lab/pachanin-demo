import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_LEXICON, platformV7ActionLabel, platformV7NavLabel } from '@/lib/platform-v7/lexicon';

describe('platform-v7 lexicon', () => {
  it('uses one Russian label for the control tower', () => {
    expect(platformV7NavLabel('controlTower')).toBe('Центр управления');
  });

  it('keeps environment labels centralized', () => {
    expect(PLATFORM_V7_LEXICON.env.pilot).toBe('Пилотный режим');
    expect(PLATFORM_V7_LEXICON.env.sandbox).toBe('Тестовая среда');
  });

  it('keeps common action labels centralized', () => {
    expect(platformV7ActionLabel('openDeal')).toBe('Открыть сделку');
    expect(platformV7ActionLabel('openBank')).toBe('Открыть банк');
  });
});
