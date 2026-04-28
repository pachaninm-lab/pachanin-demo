import { describe, expect, it, vi } from 'vitest';
import {
  getPlatformV7Environment,
  platformV7CanShowAsLive,
  platformV7EnvironmentInfo,
  normalizePlatformV7Environment,
  type PlatformEnvironment,
} from '@/lib/platform-v7/environment';
import { platformV7ShellModel } from '@/lib/platform-v7/shell';

const environments: PlatformEnvironment[] = ['pilot', 'sandbox', 'demo', 'production'];
const forbiddenClaims = [
  'production ready',
  'fully live',
  'live integration completed',
  'guaranteed payment',
  'no risk',
  'all integrations completed',
];

describe('platform-v7 shell model environment', () => {
  it('uses environment helper for shell model environment', () => {
    const model = platformV7ShellModel('/platform-v7/control-tower', 'buyer');

    expect(model.environment).toEqual(getPlatformV7Environment());
  });

  it('defaults unknown or missing env values to pilot', () => {
    expect(normalizePlatformV7Environment(undefined)).toBe('pilot');
    expect(normalizePlatformV7Environment('')).toBe('pilot');
    expect(normalizePlatformV7Environment('live')).toBe('pilot');
  });

  it('keeps every environment label, description, and tone explicit', () => {
    for (const environment of environments) {
      const info = platformV7EnvironmentInfo(environment);

      expect(info.environment).toBe(environment);
      expect(info.label.trim()).not.toBe('');
      expect(info.description.trim()).not.toBe('');
      expect(info.tone.trim()).not.toBe('');
    }
  });

  it('does not show pilot, sandbox, or demo environments as live', () => {
    expect(platformV7CanShowAsLive('pilot')).toBe(false);
    expect(platformV7CanShowAsLive('sandbox')).toBe(false);
    expect(platformV7CanShowAsLive('demo')).toBe(false);
    expect(platformV7CanShowAsLive('production')).toBe(true);
  });

  it('does not introduce forbidden maturity claims in environment copy', () => {
    for (const environment of environments) {
      const info = platformV7EnvironmentInfo(environment);
      const haystack = `${info.label} ${info.description}`.toLowerCase();

      for (const claim of forbiddenClaims) {
        expect(haystack).not.toContain(claim);
      }
    }
  });

  it('keeps shell model environment in pilot mode when env variable is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_V7_ENVIRONMENT', undefined);

    const model = platformV7ShellModel('/platform-v7/control-tower', 'buyer');

    expect(model.environment.environment).toBe('pilot');
    expect(model.environment.canShowAsLive).toBe(false);

    vi.unstubAllEnvs();
  });
});
