import { describe, expect, it, vi } from 'vitest';
import PlatformV7DomainCorePage from '@/app/platform-v7/domain-core/page';
import { PLATFORM_V7_EXECUTION_MAP_ROUTE } from '@/lib/platform-v7/routes';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

describe('PlatformV7DomainCorePage', () => {
  it('redirects weak internal route to the execution map', () => {
    expect(() => PlatformV7DomainCorePage()).toThrow(`redirect:${PLATFORM_V7_EXECUTION_MAP_ROUTE}`);
  });
});
