import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_RELEASE_SAFETY_ROUTE } from '@/lib/platform-v7/release-safety-route';
import { PLATFORM_V7_COMMAND_SECTION_ITEMS } from '@/lib/platform-v7/command';

describe('platform-v7 release-safety route contract', () => {
  it('route string is stable', () => {
    expect(PLATFORM_V7_RELEASE_SAFETY_ROUTE).toBe('/platform-v7/bank/release-safety');
  });

  it('command entry points to release-safety route', () => {
    const item = PLATFORM_V7_COMMAND_SECTION_ITEMS.find((i) => i.id === 'sec-release-safety');
    expect(item).toBeDefined();
    expect(item?.href).toBe(PLATFORM_V7_RELEASE_SAFETY_ROUTE);
  });
});
