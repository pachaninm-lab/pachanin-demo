import { describe, expect, it } from 'vitest';
import {
  normalizePlatformV7Environment,
  platformV7CanShowAsLive,
  platformV7EnvironmentInfo,
  platformV7EnvironmentLabel,
} from '@/lib/platform-v7/environment';

describe('platform-v7 environment', () => {
  it('normalizes unknown values to pilot', () => {
    expect(normalizePlatformV7Environment(undefined)).toBe('pilot');
    expect(normalizePlatformV7Environment('unknown')).toBe('pilot');
    expect(normalizePlatformV7Environment('production')).toBe('production');
  });

  it('uses centralized Russian labels', () => {
    expect(platformV7EnvironmentLabel('pilot')).toBe('Пилотный режим');
    expect(platformV7EnvironmentLabel('sandbox')).toBe('Тестовая среда');
    expect(platformV7EnvironmentLabel('demo')).toBe('Демо-данные');
    expect(platformV7EnvironmentLabel('production')).toBe('Боевой контур');
  });

  it('does not allow non-production modes to be shown as live', () => {
    expect(platformV7CanShowAsLive('pilot')).toBe(false);
    expect(platformV7CanShowAsLive('sandbox')).toBe(false);
    expect(platformV7CanShowAsLive('demo')).toBe(false);
    expect(platformV7CanShowAsLive('production')).toBe(true);
  });

  it('keeps pilot tone conservative', () => {
    expect(platformV7EnvironmentInfo('pilot')).toMatchObject({
      environment: 'pilot',
      label: 'Пилотный режим',
      tone: 'amber',
      canShowAsLive: false,
    });
  });
});
