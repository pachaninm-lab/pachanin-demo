import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_COMMAND_SECTION_ITEMS, platformV7CommandSectionItems } from '@/lib/platform-v7/command';

describe('platform-v7 command foundation', () => {
  it('keeps control tower command title in Russian', () => {
    expect(PLATFORM_V7_COMMAND_SECTION_ITEMS[0]).toMatchObject({
      id: 'sec-control',
      title: 'Центр управления',
      href: '/platform-v7/control-tower',
    });
  });

  it('keeps command section items centralized', () => {
    const items = platformV7CommandSectionItems();
    expect(items.length).toBeGreaterThanOrEqual(10);
    expect(items.map((item) => item.href)).toContain('/platform-v7/roles');
    expect(items.every((item) => item.group === 'Разделы')).toBe(true);
  });

  it('keeps legacy search keywords for compatibility without changing visible label', () => {
    const control = platformV7CommandSectionItems()[0];
    expect(control?.title).toBe('Центр управления');
    expect(control?.keywords).toContain('control tower');
  });
});
