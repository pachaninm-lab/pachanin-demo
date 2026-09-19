import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ROLE_ROUTES } from '@/lib/platform-v7/shellRoutes';

describe('platform-v7 role routes uniqueness', () => {
  it('keeps every role landing route unique', () => {
    const routes = Object.values(PLATFORM_V7_ROLE_ROUTES);

    expect(new Set(routes).size).toBe(routes.length);
  });
});
