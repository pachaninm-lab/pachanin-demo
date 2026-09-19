import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_COMMAND_ROUTE_SURFACE, PLATFORM_V7_DOMAIN_CORE_ROUTE, PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES, PLATFORM_V7_SHELL_ROUTE_SURFACE } from '@/lib/platform-v7/routes';
import { platformV7QuickJumpItems } from '@/lib/platform-v7/shellQuickJump';

describe('platform-v7 domain core routing', () => {
  it('keeps domain core as an internal technical route constant only', () => {
    expect(PLATFORM_V7_DOMAIN_CORE_ROUTE).toBe('/platform-v7/domain-core');
  });

  it('does not expose domain core in public route surfaces', () => {
    expect(PLATFORM_V7_COMMAND_ROUTE_SURFACE).not.toContain(PLATFORM_V7_DOMAIN_CORE_ROUTE);
    expect(PLATFORM_V7_SHELL_ROUTE_SURFACE).not.toContain(PLATFORM_V7_DOMAIN_CORE_ROUTE);
    expect(PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES).not.toContain(PLATFORM_V7_DOMAIN_CORE_ROUTE);
  });

  it('does not expose domain core in quick jump', () => {
    expect(platformV7QuickJumpItems()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: PLATFORM_V7_DOMAIN_CORE_ROUTE }),
      ])
    );
  });
});
