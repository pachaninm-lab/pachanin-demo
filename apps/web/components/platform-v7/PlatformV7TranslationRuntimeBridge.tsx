'use client';

import * as React from 'react';
import { PLATFORM_V7_MANUAL_DICTIONARY_OVERRIDES } from '@/lib/platform-v7/i18n/manual-dictionary-overrides';
import {
  applyTranslationToDom,
  buildDictionaries,
  clearLegacyDictionaryCache,
  fetchRemoteDictionaryState,
  isLanguageCode,
  readCachedDictionaryState,
  readLocaleCookie,
  startTranslationObserver,
  subscribeToLanguageChanges,
  type DictionarySet,
  type LanguageCode,
} from '@/lib/platform-v7/i18n/translation-runtime';

const PRODUCTION_PUBLIC_OVERRIDES: DictionarySet = {
  en: {
    'Гекта': 'Gekta',
    'Открыть Гекту': 'Open Gekta',
    'Поддержка': 'Support',
    'Открыть поддержку': 'Open support',
    'Позвонить': 'Call',
    'Позвонить по номеру 8 916 277-89-89': 'Call 8 916 277-89-89',
    'Связь и помощь': 'Help and contact',
    'Шапка сайта': 'Site header',
    'Прозрачная Цена — на главную': 'Transparent Price — home',
    'Разделы': 'Sections',
    'Открыть меню': 'Open menu',
    'Шапка страницы обращения': 'Contact page header',
    'Назад': 'Back',
    'Справка': 'Help',
  },
  zh: {
    'Гекта': 'Gekta',
    'Открыть Гекту': '打开 Gekta',
    'Поддержка': '支持',
    'Открыть поддержку': '打开支持',
    'Позвонить': '致电',
    'Позвонить по номеру 8 916 277-89-89': '拨打 8 916 277-89-89',
    'Связь и помощь': '帮助与联系',
    'Шапка сайта': '网站页眉',
    'Прозрачная Цена — на главную': '透明价格 — 返回首页',
    'Разделы': '页面导航',
    'Открыть меню': '打开菜单',
    'Шапка страницы обращения': '联系页面页眉',
    'Назад': '返回',
    'Справка': '帮助',
  },
};

function mergeOverrides(base: DictionarySet): DictionarySet {
  return {
    en: {
      ...base.en,
      ...PLATFORM_V7_MANUAL_DICTIONARY_OVERRIDES.en,
      ...PRODUCTION_PUBLIC_OVERRIDES.en,
    },
    zh: {
      ...base.zh,
      ...PLATFORM_V7_MANUAL_DICTIONARY_OVERRIDES.zh,
      ...PRODUCTION_PUBLIC_OVERRIDES.zh,
    },
  };
}

function resolveAuthoritativeLanguage(): LanguageCode {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 'ru';

  try {
    const query = new URL(window.location.href).searchParams.get('lang');
    if (isLanguageCode(query)) return query;
  } catch {
    // Fall through to server-declared html lang and persisted locale.
  }

  const html = String(document.documentElement.lang || '').toLowerCase();
  if (html === 'en' || html.startsWith('en-')) return 'en';
  if (html === 'zh' || html.startsWith('zh-')) return 'zh';
  if (html === 'ru' || html.startsWith('ru-')) return 'ru';

  return readLocaleCookie() ?? 'ru';
}

/**
 * Production bridge for the mixed Platform V7 localization architecture.
 *
 * New public entry routes render locale-native SSR copy. Older public and
 * protected surfaces still contain canonical Russian source text and rely on
 * the source-controlled dictionary runtime. This bridge restores that fallback
 * without browser auto-translation, auth changes, or route rewriting.
 */
export function PlatformV7TranslationRuntimeBridge() {
  const languageRef = React.useRef<LanguageCode>('ru');
  const dictionariesRef = React.useRef<DictionarySet>(
    mergeOverrides(buildDictionaries(null)),
  );

  React.useEffect(() => {
    let active = true;
    clearLegacyDictionaryCache();

    languageRef.current = resolveAuthoritativeLanguage();
    dictionariesRef.current = mergeOverrides(
      buildDictionaries(readCachedDictionaryState()),
    );
    applyTranslationToDom(languageRef.current, dictionariesRef.current);

    const stopObserver = startTranslationObserver(
      () => languageRef.current,
      () => dictionariesRef.current,
    );

    const stopLanguageSubscription = subscribeToLanguageChanges((language) => {
      languageRef.current = language;
      applyTranslationToDom(languageRef.current, dictionariesRef.current);
    });

    void fetchRemoteDictionaryState().then((remote) => {
      if (!active || !remote) return;
      dictionariesRef.current = mergeOverrides(buildDictionaries(remote));
      applyTranslationToDom(languageRef.current, dictionariesRef.current);
    });

    return () => {
      active = false;
      stopLanguageSubscription();
      stopObserver();
    };
  }, []);

  return null;
}
