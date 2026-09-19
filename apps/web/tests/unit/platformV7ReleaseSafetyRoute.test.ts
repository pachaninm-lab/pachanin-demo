import { PLATFORM_V7_COMMAND_SECTION_ITEMS } from '@/lib/platform-v7/command';
import { PLATFORM_V7_RELEASE_SAFETY_ROUTE } from '@/lib/platform-v7/release-safety-route';

describe('platform-v7 release safety route contract', () => {
  it('keeps the release safety route stable', () => {
    expect(PLATFORM_V7_RELEASE_SAFETY_ROUTE).toBe('/platform-v7/bank/release-safety');
  });

  it('keeps the command palette entry aligned with the route', () => {
    const command = PLATFORM_V7_COMMAND_SECTION_ITEMS.find((item) => item.id === 'sec-release-safety');
    expect(command?.href).toBe(PLATFORM_V7_RELEASE_SAFETY_ROUTE);
  });
});
