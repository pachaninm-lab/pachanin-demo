import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
  type PlatformV7ShellRouteSurface,
} from './routes';

export type PlatformV7ShortcutChord = '⌘K / Ctrl+K' | 'G + C' | 'G + D' | 'G + L' | 'G + B' | 'G + S' | 'R' | '?' | 'Esc';
export type PlatformV7GoShortcutKey = 'c' | 'd' | 'l' | 'b' | 's';

export interface PlatformV7ShortcutHelpItem {
  keys: PlatformV7ShortcutChord;
  label: string;
}

export const PLATFORM_V7_SHELL_SHORTCUT_HELP: PlatformV7ShortcutHelpItem[] = [
  { keys: '⌘K / Ctrl+K', label: 'Быстрый переход по платформе' },
  { keys: 'G + C', label: 'Центр управления' },
  { keys: 'G + D', label: 'Сделки' },
  { keys: 'G + L', label: 'Логистика' },
  { keys: 'G + B', label: 'Банк' },
  { keys: 'G + S', label: 'Споры' },
  { keys: 'R', label: 'Обновить страницу' },
  { keys: '?', label: 'Показать это окно' },
  { keys: 'Esc', label: 'Закрыть модальное окно' },
];

export const PLATFORM_V7_GO_SHORTCUT_ROUTES: Record<PlatformV7GoShortcutKey, PlatformV7ShellRouteSurface> = {
  c: PLATFORM_V7_CONTROL_TOWER_ROUTE,
  d: PLATFORM_V7_DEALS_ROUTE,
  l: PLATFORM_V7_LOGISTICS_ROUTE,
  b: PLATFORM_V7_BANK_ROUTE,
  s: PLATFORM_V7_DISPUTES_ROUTE,
};

export function platformV7ShortcutHelpItems(): PlatformV7ShortcutHelpItem[] {
  return PLATFORM_V7_SHELL_SHORTCUT_HELP;
}

export function platformV7GoShortcutRoute(key: string): PlatformV7ShellRouteSurface | null {
  const normalized = key.toLowerCase();

  if (normalized === 'c' || normalized === 'd' || normalized === 'l' || normalized === 'b' || normalized === 's') {
    return PLATFORM_V7_GO_SHORTCUT_ROUTES[normalized];
  }

  return null;
}
