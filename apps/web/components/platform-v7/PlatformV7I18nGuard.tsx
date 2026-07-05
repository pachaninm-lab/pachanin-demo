'use client';

const LEGACY_CACHE_KEYS = [
  'pc-v7-translation-dictionaries-v1',
  'pc-v7-translation-dictionaries-v2',
  'pc-v7-translation-dictionaries-v3',
  'pc-v7-translation-dictionaries-v4',
];

let cacheCleared = false;

function clearLegacyTranslationCache() {
  if (cacheCleared || typeof window === 'undefined') return;
  cacheCleared = true;
  try {
    LEGACY_CACHE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  } catch {
  }
}

export function PlatformV7I18nGuard() {
  clearLegacyTranslationCache();
  return null;
}
