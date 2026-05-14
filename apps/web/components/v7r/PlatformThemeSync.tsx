'use client';

import * as React from 'react';

export const PLATFORM_V7_THEME_STORAGE_KEY = 'pc-theme';
export const PLATFORM_V7_THEME_VERSION_KEY = 'pc-theme-version';
export const PLATFORM_V7_LIGHT_DEFAULT_VERSION = 'light-default-2026-05-14';
export const PLATFORM_V7_THEME_CHANNEL = 'platform-v7-theme';

type PlatformV7Theme = 'light' | 'dark';

type ThemeMessage = {
  theme?: unknown;
};

function normalizeTheme(value: unknown): PlatformV7Theme {
  return value === 'dark' ? 'dark' : 'light';
}

function readStoredTheme(): PlatformV7Theme {
  try {
    const storedTheme = window.localStorage.getItem(PLATFORM_V7_THEME_STORAGE_KEY);
    const storedVersion = window.localStorage.getItem(PLATFORM_V7_THEME_VERSION_KEY);
    if (storedTheme === 'dark' && storedVersion !== PLATFORM_V7_LIGHT_DEFAULT_VERSION) {
      window.localStorage.removeItem(PLATFORM_V7_THEME_STORAGE_KEY);
      return 'light';
    }
    return normalizeTheme(storedTheme);
  } catch {
    return 'light';
  }
}

function hasExplicitDarkPreference(): boolean {
  try {
    return (
      window.localStorage.getItem(PLATFORM_V7_THEME_STORAGE_KEY) === 'dark' &&
      window.localStorage.getItem(PLATFORM_V7_THEME_VERSION_KEY) === PLATFORM_V7_LIGHT_DEFAULT_VERSION
    );
  } catch {
    return false;
  }
}

function writeStoredTheme(theme: PlatformV7Theme) {
  try {
    window.localStorage.setItem(PLATFORM_V7_THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(PLATFORM_V7_THEME_VERSION_KEY, PLATFORM_V7_LIGHT_DEFAULT_VERSION);
  } catch {
    // storage can be unavailable in private mode; DOM theme still applies.
  }
}

function applyPlatformTheme(theme: PlatformV7Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  document.body?.setAttribute('data-theme', theme);

  const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'dark' ? '#06110f' : '#f8fafc');
  }
}

function getDomTheme(): PlatformV7Theme {
  return normalizeTheme(document.documentElement.getAttribute('data-theme'));
}

export function PlatformThemeSync() {
  React.useEffect(() => {
    const bootedAt = Date.now();
    let lastTheme = readStoredTheme();
    let channel: BroadcastChannel | null = null;

    applyPlatformTheme(lastTheme);

    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(PLATFORM_V7_THEME_CHANNEL);
      channel.onmessage = (event: MessageEvent<ThemeMessage>) => {
        const nextTheme = normalizeTheme(event.data?.theme);
        if (nextTheme === lastTheme) return;
        lastTheme = nextTheme;
        writeStoredTheme(nextTheme);
        applyPlatformTheme(nextTheme);
      };
    }

    function publish(theme: PlatformV7Theme) {
      writeStoredTheme(theme);
      applyPlatformTheme(theme);
      channel?.postMessage({ theme });
    }

    function syncFromStorage() {
      const nextTheme = readStoredTheme();
      if (nextTheme === lastTheme) return;
      lastTheme = nextTheme;
      applyPlatformTheme(nextTheme);
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== PLATFORM_V7_THEME_STORAGE_KEY && event.key !== PLATFORM_V7_THEME_VERSION_KEY) return;
      const nextTheme = readStoredTheme();
      if (nextTheme === lastTheme) return;
      lastTheme = nextTheme;
      applyPlatformTheme(nextTheme);
    }

    const themeObserver = new MutationObserver(() => {
      const nextTheme = getDomTheme();
      if (nextTheme === lastTheme) return;
      const isBootShellDarkWrite = nextTheme === 'dark' && !hasExplicitDarkPreference() && Date.now() - bootedAt < 2500;
      if (isBootShellDarkWrite) {
        lastTheme = 'light';
        applyPlatformTheme('light');
        return;
      }
      lastTheme = nextTheme;
      publish(nextTheme);
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', syncFromStorage);
    window.addEventListener('pageshow', syncFromStorage);

    return () => {
      themeObserver.disconnect();
      channel?.close();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', syncFromStorage);
      window.removeEventListener('pageshow', syncFromStorage);
    };
  }, []);

  return null;
}
