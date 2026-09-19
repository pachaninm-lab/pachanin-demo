import { describe, expect, it } from 'vitest';
import {
  platformV7BreadcrumbSegmentLabel,
  platformV7Breadcrumbs,
  shouldShowPlatformV7Breadcrumbs,
} from '@/lib/platform-v7/breadcrumbs';

describe('platform-v7 breadcrumbs', () => {
  it('uses unified labels from lexicon', () => {
    expect(platformV7BreadcrumbSegmentLabel('platform-v7')).toBe('Прозрачная Цена');
    expect(platformV7BreadcrumbSegmentLabel('control-tower')).toBe('Центр управления');
    expect(platformV7BreadcrumbSegmentLabel('notifications')).toBe('Уведомления');
  });

  it('builds route breadcrumbs with hrefs', () => {
    expect(platformV7Breadcrumbs('/platform-v7/control-tower')).toEqual([
      { href: '/platform-v7', label: 'Прозрачная Цена', isLast: false },
      { href: '/platform-v7/control-tower', label: 'Центр управления', isLast: true },
    ]);
  });

  it('hides breadcrumbs on root and roles entry', () => {
    expect(shouldShowPlatformV7Breadcrumbs('/platform-v7')).toBe(false);
    expect(shouldShowPlatformV7Breadcrumbs('/platform-v7/roles')).toBe(false);
    expect(shouldShowPlatformV7Breadcrumbs('/platform-v7/deals')).toBe(true);
  });
});
