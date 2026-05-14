import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');
const themeSync = () => read('apps/web/components/v7r/PlatformThemeSync.tsx');

describe('platform-v7 theme default', () => {
  it('uses light theme when there is no explicit dark preference', () => {
    const source = themeSync();

    expect(source).toContain("return value === 'dark' ? 'dark' : 'light';");
    expect(source).toContain("return 'light';");
    expect(source).not.toContain("return value === 'light' ? 'light' : 'dark';");
    expect(source).not.toContain("return 'dark';\n  }\n}");
  });

  it('keeps dark available only as an explicit theme value', () => {
    const source = themeSync();

    expect(source).toContain("type PlatformV7Theme = 'light' | 'dark';");
    expect(source).toContain("theme === 'dark' ? '#06110f' : '#f8fafc'");
    expect(source).toContain("document.documentElement.setAttribute('data-theme', theme)");
  });

  it('migrates old dark storage to stored light unless the current theme version is present', () => {
    const source = themeSync();

    expect(source).toContain('PLATFORM_V7_THEME_VERSION_KEY');
    expect(source).toContain('PLATFORM_V7_LIGHT_DEFAULT_VERSION');
    expect(source).toContain("storedTheme === 'dark' && storedVersion !== PLATFORM_V7_LIGHT_DEFAULT_VERSION");
    expect(source).toContain("writeStoredTheme('light')");
    expect(source).not.toContain('window.localStorage.removeItem(PLATFORM_V7_THEME_STORAGE_KEY)');
  });

  it('forces boot-time dark DOM writes back to stored light unless dark is explicitly stored', () => {
    const source = themeSync();

    expect(source).toContain('function hasExplicitDarkPreference()');
    expect(source).toContain("window.localStorage.getItem(PLATFORM_V7_THEME_STORAGE_KEY) === 'dark'");
    expect(source).toContain("window.localStorage.getItem(PLATFORM_V7_THEME_VERSION_KEY) === PLATFORM_V7_LIGHT_DEFAULT_VERSION");
    expect(source).toContain('const bootedAt = Date.now();');
    expect(source).toContain("Date.now() - bootedAt < 2500");
    expect(source).toContain("writeStoredTheme('light')");
    expect(source).toContain("applyPlatformTheme('light')");
  });

  it('keeps bank work surface light instead of using hardcoded dark cards', () => {
    const bankPage = read('apps/web/app/platform-v7/bank/page.tsx');

    expect(bankPage).toContain('const focusCard =');
    expect(bankPage).toContain('Деньги не двигаются, пока нет основания');
    expect(bankPage).not.toContain('const darkCard =');
    expect(bankPage).not.toContain('background: \'linear-gradient(135deg,#0F172A 0%,#111827');
    expect(bankPage).not.toContain("color: '#fff', borderRadius: 26");
  });
});
