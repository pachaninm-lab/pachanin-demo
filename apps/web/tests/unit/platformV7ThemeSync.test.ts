import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const forbiddenCopyNormalizer = ['Shell', 'CopyNormalizer'].join('');

describe('platform-v7 global theme sync', () => {
  const runtime = readFileSync(join(process.cwd(), 'components/platform-v7/PlatformV7ProtectedRuntime.tsx'), 'utf8');
  const protectedShell = readFileSync(join(process.cwd(), 'components/platform-v7/PlatformV7ProtectedShell.tsx'), 'utf8');
  const sync = readFileSync(join(process.cwd(), 'components/v7r/PlatformThemeSync.tsx'), 'utf8');
  const appShell = readFileSync(join(process.cwd(), 'components/v7r/AppShellV3.tsx'), 'utf8');

  it('mounts the theme provider without a runtime copy or surface normalizer', () => {
    expect(runtime).toContain('PlatformThemeSync');
    expect(runtime).toContain('<PlatformThemeSync />');
    expect(runtime).not.toContain(forbiddenCopyNormalizer);
    expect(protectedShell).not.toContain(forbiddenCopyNormalizer);
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

  it('persists explicit theme changes made by existing toggles', () => {
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
