import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_GO_SHORTCUT_ROUTES,
  platformV7GoShortcutRoute,
  platformV7ShortcutHelpItems,
} from '@/lib/platform-v7/shellShortcuts';
import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
} from '@/lib/platform-v7/routes';

describe('platform-v7 shell shortcuts', () => {
  it('keeps shortcut help items in the expected display order', () => {
    expect(platformV7ShortcutHelpItems().map((item) => item.keys)).toEqual([
      '⌘K / Ctrl+K',
      'G + C',
      'G + D',
      'G + L',
      'G + B',
      'G + S',
      'R',
      '?',
      'Esc',
    ]);
  });

  it('keeps go-shortcut routes centralized', () => {
    expect(PLATFORM_V7_GO_SHORTCUT_ROUTES).toEqual({
      c: PLATFORM_V7_CONTROL_TOWER_ROUTE,
      d: PLATFORM_V7_DEALS_ROUTE,
      l: PLATFORM_V7_LOGISTICS_ROUTE,
      b: PLATFORM_V7_BANK_ROUTE,
      s: PLATFORM_V7_DISPUTES_ROUTE,
    });
  });

  it('resolves go-shortcut keys case-insensitively', () => {
    expect(platformV7GoShortcutRoute('C')).toBe(PLATFORM_V7_CONTROL_TOWER_ROUTE);
    expect(platformV7GoShortcutRoute('d')).toBe(PLATFORM_V7_DEALS_ROUTE);
    expect(platformV7GoShortcutRoute('L')).toBe(PLATFORM_V7_LOGISTICS_ROUTE);
    expect(platformV7GoShortcutRoute('b')).toBe(PLATFORM_V7_BANK_ROUTE);
    expect(platformV7GoShortcutRoute('S')).toBe(PLATFORM_V7_DISPUTES_ROUTE);
  });

  it('returns null for unknown go-shortcut keys', () => {
    expect(platformV7GoShortcutRoute('x')).toBeNull();
    expect(platformV7GoShortcutRoute('')).toBeNull();
  });
});
