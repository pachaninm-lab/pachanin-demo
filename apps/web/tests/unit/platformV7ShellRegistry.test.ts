import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_SHELL_REGISTRY,
  platformV7ShellRegistryEntries,
  platformV7ShellRegistryById,
  platformV7ShellRegistryBySurface,
  platformV7ShellRegistryBySection,
  platformV7ShellRegistryShortcutEntries,
  platformV7ShellRegistryBreadcrumbLabel,
  platformV7ShellRegistrySearchEntries,
} from '@/lib/platform-v7/shellRegistry';
import { PLATFORM_V7_SHELL_ROUTE_SURFACE } from '@/lib/platform-v7/routes';
import { platformV7ShellModel } from '@/lib/platform-v7/shell';

const APPROVED_PREFIXES = ['/platform-v7', '/platform-v7r'] as const;

const BANNED_CLAIMS = [
  'production ready',
  'fully live',
  'guaranteed payment',
  'all integrations completed',
  'no risk',
  'полностью готово',
  'боевой контур подтверждён',
  'все интеграции завершены',
  'live integration completed',
];

describe('platform-v7 shell registry', () => {
  it('returns the same reference from platformV7ShellRegistryEntries()', () => {
    expect(platformV7ShellRegistryEntries()).toBe(PLATFORM_V7_SHELL_REGISTRY);
  });

  it('contains at least 17 entries (all shell surface routes)', () => {
    expect(PLATFORM_V7_SHELL_REGISTRY.length).toBeGreaterThanOrEqual(17);
  });

  it('all IDs are unique', () => {
    const ids = platformV7ShellRegistryEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all labels are non-empty', () => {
    platformV7ShellRegistryEntries().forEach((e) => {
      expect(e.label.trim()).not.toBe('');
    });
  });

  it('all breadcrumbLabels are non-empty', () => {
    platformV7ShellRegistryEntries().forEach((e) => {
      expect(e.breadcrumbLabel.trim()).not.toBe('');
    });
  });

  it('all descriptions are non-empty', () => {
    platformV7ShellRegistryEntries().forEach((e) => {
      expect(e.description.trim()).not.toBe('');
    });
  });

  it('all commandKeywords arrays are non-empty', () => {
    platformV7ShellRegistryEntries().forEach((e) => {
      expect(e.commandKeywords.length).toBeGreaterThan(0);
    });
  });

  it('all hrefs start with an approved platform-v7 prefix — no platform-v4, platform-v9', () => {
    platformV7ShellRegistryEntries().forEach((e) => {
      const startsWithApproved = APPROVED_PREFIXES.some((prefix) => e.href.startsWith(prefix));
      expect(startsWithApproved).toBe(true);
      expect(e.href).not.toContain('platform-v4');
      expect(e.href).not.toContain('platform-v9');
    });
  });

  it('surface-route entries (no path param) are in PLATFORM_V7_SHELL_ROUTE_SURFACE', () => {
    const surfaceRoutes = new Set<string>(PLATFORM_V7_SHELL_ROUTE_SURFACE);
    platformV7ShellRegistryEntries()
      .filter((e) => !e.href.includes('/', e.href.indexOf('/', 1) + 1))
      .forEach((e) => {
        expect(surfaceRoutes.has(e.href)).toBe(true);
      });
  });

  it('deal sub-path entries resolve under /platform-v7/deals', () => {
    platformV7ShellRegistryEntries()
      .filter((e) => e.href.startsWith('/platform-v7/deals/'))
      .forEach((e) => {
        expect(e.href).toMatch(/^\/platform-v7\/deals\/[A-Z0-9-]+$/);
        expect(e.section).toBe('Сделки');
      });
  });

  it('dispute sub-path entries resolve under /platform-v7/disputes', () => {
    platformV7ShellRegistryEntries()
      .filter((e) => e.href.startsWith('/platform-v7/disputes/'))
      .forEach((e) => {
        expect(e.href).toMatch(/^\/platform-v7\/disputes\/[A-Z0-9-]+$/);
        expect(e.section).toBe('Споры');
      });
  });

  it('shortcuts are unique across all entries', () => {
    const shortcuts = platformV7ShellRegistryEntries()
      .map((e) => e.shortcut)
      .filter(Boolean) as string[];
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });

  it('shortcut entries have at least 1 entry and all have shortcut defined', () => {
    const shortcutEntries = platformV7ShellRegistryShortcutEntries();
    expect(shortcutEntries.length).toBeGreaterThan(0);
    shortcutEntries.forEach((e) => {
      expect(e.shortcut).toBeTruthy();
    });
  });

  it('no banned claims in label or description', () => {
    platformV7ShellRegistryEntries().forEach((e) => {
      const combined = `${e.label} ${e.description}`.toLowerCase();
      BANNED_CLAIMS.forEach((claim) => {
        expect(combined).not.toContain(claim);
      });
    });
  });

  it('platformV7ShellRegistryById returns correct entry', () => {
    const entry = platformV7ShellRegistryById('deals');
    expect(entry).not.toBeNull();
    expect(entry?.label).toBe('Сделки');
    expect(entry?.href).toBe('/platform-v7/deals');
  });

  it('platformV7ShellRegistryById returns null for unknown id', () => {
    expect(platformV7ShellRegistryById('unknown-route-xyz')).toBeNull();
  });

  it('platformV7ShellRegistryBySurface returns only matching entries', () => {
    const moneyEntries = platformV7ShellRegistryBySurface('money');
    expect(moneyEntries.length).toBeGreaterThan(0);
    moneyEntries.forEach((e) => expect(e.surface).toBe('money'));
  });

  it('platformV7ShellRegistryBySection filters correctly', () => {
    const sectionEntries = platformV7ShellRegistryBySection('Сделки');
    expect(sectionEntries.length).toBeGreaterThan(0);
    sectionEntries.forEach((e) => expect(e.section).toBe('Сделки'));
  });

  it('platformV7ShellRegistryBreadcrumbLabel resolves by id', () => {
    const label = platformV7ShellRegistryBreadcrumbLabel('deals');
    expect(label).toBe('Сделки');
  });

  it('platformV7ShellRegistryBreadcrumbLabel returns null for unknown segment', () => {
    expect(platformV7ShellRegistryBreadcrumbLabel('unknown-xyz-segment')).toBeNull();
  });

  it('platformV7ShellRegistrySearchEntries finds control-tower by keyword', () => {
    const results = platformV7ShellRegistrySearchEntries('дашборд');
    expect(results.some((e) => e.id === 'control-tower')).toBe(true);
  });

  it('platformV7ShellRegistrySearchEntries returns all on empty query', () => {
    expect(platformV7ShellRegistrySearchEntries('').length).toBe(PLATFORM_V7_SHELL_REGISTRY.length);
  });

  it('core surfaces cover control-tower, deals, buyer, seller, procurement', () => {
    const coreIds = new Set(platformV7ShellRegistryBySurface('core').map((e) => e.id));
    expect(coreIds.has('control-tower')).toBe(true);
    expect(coreIds.has('deals')).toBe(true);
    expect(coreIds.has('buyer')).toBe(true);
    expect(coreIds.has('seller')).toBe(true);
    expect(coreIds.has('procurement')).toBe(true);
  });

  it('logistics surface covers logistics, field, driver, elevator entries', () => {
    const logIds = new Set(platformV7ShellRegistryBySurface('logistics').map((e) => e.id));
    expect(logIds.has('logistics')).toBe(true);
    expect(logIds.has('field')).toBe(true);
    expect(logIds.has('driver')).toBe(true);
    expect(logIds.has('elevator')).toBe(true);
  });

  it('disputes surface covers disputes, arbitrator, and DL-9102 deal', () => {
    const dispIds = new Set(platformV7ShellRegistryBySurface('disputes').map((e) => e.id));
    expect(dispIds.has('disputes')).toBe(true);
    expect(dispIds.has('arbitrator')).toBe(true);
    expect(dispIds.has('deal-dl-9102')).toBe(true);
  });

  it('all enabled flags are true (sandbox mode — all surfaces active)', () => {
    platformV7ShellRegistryEntries().forEach((e) => {
      expect(e.enabled).toBe(true);
    });
  });
});

describe('platform-v7 shell model registry wiring', () => {
  it('model includes registryEntries from the unified registry', () => {
    const model = platformV7ShellModel('/platform-v7/deals', 'operator');
    expect(model.registryEntries).toBe(PLATFORM_V7_SHELL_REGISTRY);
    expect(model.registryEntries.length).toBeGreaterThan(0);
  });

  it('model shortcuts come from shellShortcuts registry', () => {
    const model = platformV7ShellModel('/platform-v7/bank', 'operator');
    expect(model.shortcuts.length).toBeGreaterThan(0);
    model.shortcuts.forEach((s) => {
      expect(s.keys).toBeTruthy();
      expect(s.label.trim()).not.toBe('');
    });
  });

  it('model quickJumpEntries come from shellQuickJump registry', () => {
    const model = platformV7ShellModel('/platform-v7/disputes', 'operator');
    expect(model.quickJumpEntries.length).toBeGreaterThan(0);
    model.quickJumpEntries.forEach((item) => {
      expect(item.href).toBeTruthy();
      expect(item.label.trim()).not.toBe('');
    });
  });

  it('model registryShortcutEntries are a subset of registryEntries', () => {
    const model = platformV7ShellModel('/platform-v7/control-tower', 'operator');
    const allIds = new Set(model.registryEntries.map((e) => e.id));
    model.registryShortcutEntries.forEach((e) => {
      expect(allIds.has(e.id)).toBe(true);
      expect(e.shortcut).toBeTruthy();
    });
  });

  it('model has unreadNotifications and criticalNotifications from notification registry', () => {
    const model = platformV7ShellModel('/platform-v7/logistics', 'operator');
    expect(Array.isArray(model.unreadNotifications)).toBe(true);
    expect(Array.isArray(model.criticalNotifications)).toBe(true);
    model.criticalNotifications.forEach((n) => expect(n.severity).toBe('critical'));
    model.unreadNotifications.forEach((n) => expect(n.read).toBe(false));
  });

  it('quickJumpEntries contain no platform-v4 or platform-v9 hrefs', () => {
    const model = platformV7ShellModel('/platform-v7/deals', 'buyer');
    model.quickJumpEntries.forEach((item) => {
      expect(item.href).not.toContain('platform-v4');
      expect(item.href).not.toContain('platform-v9');
    });
  });
});
