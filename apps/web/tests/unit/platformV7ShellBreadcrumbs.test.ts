import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_SHELL_BREADCRUMB_LABELS,
  platformV7BuildShellBreadcrumbs,
  platformV7ShellBreadcrumbLabel,
} from '@/lib/platform-v7/shellBreadcrumbs';

describe('platform-v7 shell breadcrumbs', () => {
  it('keeps core platform shell labels centralized', () => {
    expect(PLATFORM_V7_SHELL_BREADCRUMB_LABELS['platform-v7']).toBe('Прозрачная Цена');
    expect(PLATFORM_V7_SHELL_BREADCRUMB_LABELS['platform-v7r']).toBe('Прозрачная Цена');
    expect(PLATFORM_V7_SHELL_BREADCRUMB_LABELS['control-tower']).toBe('Центр управления');
    expect(PLATFORM_V7_SHELL_BREADCRUMB_LABELS.deals).toBe('Сделки');
    expect(PLATFORM_V7_SHELL_BREADCRUMB_LABELS.bank).toBe('Банк');
    expect(PLATFORM_V7_SHELL_BREADCRUMB_LABELS.disputes).toBe('Споры');
  });

  it('builds breadcrumbs from a platform-v7 pathname', () => {
    expect(platformV7BuildShellBreadcrumbs('/platform-v7/control-tower/canonical-reconciliation')).toEqual([
      { label: 'Прозрачная Цена', href: '/platform-v7', isLast: false },
      { label: 'Центр управления', href: '/platform-v7/control-tower', isLast: false },
      { label: 'Сверка показателей', href: '/platform-v7/control-tower/canonical-reconciliation', isLast: true },
    ]);
  });

  it('builds breadcrumbs from a platform-v7r pathname', () => {
    expect(platformV7BuildShellBreadcrumbs('/platform-v7r/driver')).toEqual([
      { label: 'Прозрачная Цена', href: '/platform-v7r', isLast: false },
      { label: 'Водитель', href: '/platform-v7r/driver', isLast: true },
    ]);
  });

  it('strips query and hash fragments before building breadcrumbs', () => {
    expect(platformV7BuildShellBreadcrumbs('/platform-v7/deals/DL-9102?tab=money#timeline')).toEqual([
      { label: 'Прозрачная Цена', href: '/platform-v7', isLast: false },
      { label: 'Сделки', href: '/platform-v7/deals', isLast: false },
      { label: 'DL-9102', href: '/platform-v7/deals/DL-9102', isLast: true },
    ]);
  });

  it('falls back to the original segment for dynamic identifiers', () => {
    expect(platformV7ShellBreadcrumbLabel('DL-9102')).toBe('DL-9102');
    expect(platformV7ShellBreadcrumbLabel('DK-2024-89')).toBe('DK-2024-89');
  });
});
