import { describe, expect, it } from 'vitest';
import { platformV7ShellModel } from '@/lib/platform-v7/shell';
import {
  PLATFORM_V7_QUICK_JUMP_ITEMS,
  platformV7QuickJumpGroups,
  platformV7QuickJumpItems,
} from '@/lib/platform-v7/shellQuickJump';
import {
  PLATFORM_V7_GO_SHORTCUT_ROUTES,
  PLATFORM_V7_SHELL_SHORTCUT_HELP,
  platformV7GoShortcutRoute,
  platformV7ShortcutHelpItems,
} from '@/lib/platform-v7/shellShortcuts';

const goShortcutKeys = ['c', 'd', 'l', 'b', 's'] as const;

describe('platform-v7 shell model shortcuts', () => {
  it('exposes shortcut and quick jump registry entries', () => {
    const model = platformV7ShellModel('/platform-v7/control-tower', 'buyer');

    expect(model.shortcuts).toEqual(platformV7ShortcutHelpItems());
    expect(model.quickJumpEntries).toEqual(platformV7QuickJumpItems());
    expect(model.shortcuts.length).toBeGreaterThan(0);
    expect(model.quickJumpEntries.length).toBeGreaterThan(0);
  });

  it('keeps quick jump helpers aligned with registry data', () => {
    expect(platformV7QuickJumpItems()).toEqual(PLATFORM_V7_QUICK_JUMP_ITEMS);
    expect(platformV7QuickJumpGroups()).toEqual(Array.from(new Set(PLATFORM_V7_QUICK_JUMP_ITEMS.map((item) => item.group))));
  });

  it('keeps quick jump hrefs inside platform v7 route families', () => {
    const model = platformV7ShellModel('/platform-v7/control-tower', 'buyer');

    for (const entry of model.quickJumpEntries) {
      expect(entry.href.startsWith('/platform-v7')).toBe(true);
      expect(entry.label.trim()).not.toBe('');
      expect(entry.group.trim()).not.toBe('');
    }
  });

  it('keeps quick jump entries unique', () => {
    const seen = new Set<string>();

    for (const entry of platformV7QuickJumpItems()) {
      const key = [entry.group, entry.label, entry.href].join('|');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('keeps quick jump role actions explicit and routed', () => {
    const actionEntries = platformV7QuickJumpItems().filter((entry) => entry.action);

    expect(actionEntries.map((entry) => entry.action).sort()).toEqual(['role:arbitrator', 'role:buyer', 'role:driver']);
    for (const entry of actionEntries) {
      expect(entry.group).toBe('Роли');
      expect(entry.href.startsWith('/platform-v7')).toBe(true);
      expect(entry.label.trim()).not.toBe('');
    }
  });

  it('keeps shortcut help entries unique and non-empty', () => {
    const keys = new Set<string>();

    expect(platformV7ShortcutHelpItems()).toEqual(PLATFORM_V7_SHELL_SHORTCUT_HELP);
    for (const item of platformV7ShortcutHelpItems()) {
      expect(keys.has(item.keys)).toBe(false);
      keys.add(item.keys);
      expect(item.label.trim()).not.toBe('');
    }
  });

  it('maps go shortcuts through the route registry', () => {
    for (const key of goShortcutKeys) {
      const route = platformV7GoShortcutRoute(key);

      expect(route).toBe(PLATFORM_V7_GO_SHORTCUT_ROUTES[key]);
      expect(route).not.toBeNull();
      if (!route) continue;
      expect(route.startsWith('/platform-v7')).toBe(true);
      expect(route.includes('/platform-v4')).toBe(false);
      expect(route.includes('/platform-v9')).toBe(false);
      expect(platformV7GoShortcutRoute(key.toUpperCase())).toBe(route);
    }

    expect(platformV7GoShortcutRoute('x')).toBeNull();
  });
});
