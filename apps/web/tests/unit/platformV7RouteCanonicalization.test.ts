import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_CANONICAL_ROUTES,
  canonicalizePlatformV7Route,
  isPlatformV7KnownAlias,
} from '@/lib/platform-v7/route-canonicalization';

describe('platform-v7 route canonicalization', () => {
  it('canonicalizes integration and connector terminology to connectors', () => {
    expect(canonicalizePlatformV7Route('/platform-v7/integrations')).toBe(PLATFORM_V7_CANONICAL_ROUTES.connectors);
    expect(isPlatformV7KnownAlias('/platform-v7/integrations')).toBe(true);
  });

  it('canonicalizes singular dispute detail routes to plural disputes', () => {
    expect(canonicalizePlatformV7Route('/platform-v7/dispute/DSP-100')).toBe('/platform-v7/disputes/DSP-100');
    expect(isPlatformV7KnownAlias('/platform-v7/dispute/DSP-100')).toBe(true);
  });

  it('canonicalizes marketplace and market routes away from marketplace positioning', () => {
    expect(canonicalizePlatformV7Route('/platform-v7/marketplace')).toBe(PLATFORM_V7_CANONICAL_ROUTES.lots);
    expect(canonicalizePlatformV7Route('/platform-v7/market')).toBe(PLATFORM_V7_CANONICAL_ROUTES.lots);
  });

  it('canonicalizes the generic field route to the driver field shell', () => {
    expect(canonicalizePlatformV7Route('/platform-v7/field')).toBe(PLATFORM_V7_CANONICAL_ROUTES.driverField);
  });

  it('does not pretend unknown routes are valid aliases', () => {
    expect(canonicalizePlatformV7Route('/platform-v7/unknown-route')).toBeUndefined();
    expect(isPlatformV7KnownAlias('/platform-v7/unknown-route')).toBe(false);
  });
});
