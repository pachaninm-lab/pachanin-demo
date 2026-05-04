import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 global theme sync', () => {
  const layout = readFileSync(join(process.cwd(), 'app/platform-v7/layout.tsx'), 'utf8');
  const sync = readFileSync(join(process.cwd(), 'components/v7r/PlatformThemeSync.tsx'), 'utf8');
  const appShell = readFileSync(join(process.cwd(), 'components/v7r/AppShellV3.tsx'), 'utf8');

  it('mounts theme sync before runtime visual normalizers', () => {
    expect(layout).toContain('PlatformThemeSync');
    expect(layout.indexOf('<PlatformThemeSync />')).toBeGreaterThan(-1);
    expect(layout.indexOf('<PlatformThemeSync />')).toBeLessThan(layout.indexOf('<ShellCopyNormalizer />'));
  });

  it('uses the same persisted storage key as the existing theme toggle', () => {
    expect(sync).toContain("PLATFORM_V7_THEME_STORAGE_KEY = 'pc-theme'");
    expect(appShell).toContain("localStorage.getItem('pc-theme')");
    expect(appShell).toContain("localStorage.setItem('pc-theme'");
  });

  it('syncs theme changes across pages, tabs and route restores', () => {
    expect(sync).toContain('BroadcastChannel');
    expect(sync).toContain('PLATFORM_V7_THEME_CHANNEL');
    expect(sync).toContain("window.addEventListener('storage'");
    expect(sync).toContain("window.addEventListener('focus'");
    expect(sync).toContain("window.addEventListener('pageshow'");
  });

  it('persists legacy data-theme changes made by existing toggles', () => {
    expect(sync).toContain('MutationObserver');
    expect(sync).toContain("attributeFilter: ['data-theme']");
    expect(sync).toContain('writeStoredTheme(theme)');
    expect(sync).toContain('channel?.postMessage({ theme })');
  });

  it('applies theme to the document and mobile browser chrome', () => {
    expect(sync).toContain("document.documentElement.setAttribute('data-theme', theme)");
    expect(sync).toContain("document.body?.setAttribute('data-theme', theme)");
    expect(sync).toContain('style.colorScheme = theme');
    expect(sync).toContain('meta[name="theme-color"]');
  });
});
