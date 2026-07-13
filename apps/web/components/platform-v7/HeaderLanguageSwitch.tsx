'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Languages } from 'lucide-react';
import {
  LANGUAGES,
  applyTranslationToDom,
  buildDictionaries,
  clearLegacyDictionaryCache,
  fetchRemoteDictionaryState,
  getLanguageMeta,
  isLanguageCode,
  readCachedDictionaryState,
  startTranslationObserver,
  subscribeToLanguageChanges,
  writeStoredLanguage,
  type DictionaryState,
  type LanguageCode,
} from '@/lib/platform-v7/i18n/translation-runtime';
import styles from './HeaderLanguageSwitch.module.css';

const TARGETS = [
  '.pc-site-actions',
  '.entry-header-actions',
  '.pc-v4-actions',
  '.p7-flow-actions',
  '.p7-request-actions',
  '.p7-contact-nav',
  '.p7-contact-fixed-actions',
  '.p7-register-actions',
  '.login-header',
] as const;

const SUPPORTED_LANGUAGE_CODES: readonly LanguageCode[] = ['ru', 'en', 'zh'];
const SUPPORTED_LANGUAGES = LANGUAGES.filter((item) => SUPPORTED_LANGUAGE_CODES.includes(item.code));
const LANGUAGE_RELOAD_KEY = 'pc-v7-language-reload-target';

function findTarget() {
  if (typeof document === 'undefined') return null;
  for (const selector of TARGETS) {
    const target = document.querySelector<Element>(selector);
    if (target) return target;
  }
  return null;
}

function normalizeLanguage(code: LanguageCode): LanguageCode {
  return SUPPORTED_LANGUAGE_CODES.includes(code) ? code : 'ru';
}

function readLanguageFromUrl(): LanguageCode | null {
  if (typeof window === 'undefined') return null;
  try {
    const candidate = new URL(window.location.href).searchParams.get('lang');
    return isLanguageCode(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function readLanguageFromDocument(): LanguageCode {
  if (typeof document === 'undefined') return 'ru';
  const declared = String(
    document.documentElement.dataset.p7Language
    || document.documentElement.lang
    || '',
  ).toLowerCase();
  if (declared === 'en' || declared.startsWith('en-')) return 'en';
  if (declared === 'zh' || declared.startsWith('zh-')) return 'zh';
  return 'ru';
}

function readAuthoritativeLanguage(): LanguageCode {
  return normalizeLanguage(readLanguageFromUrl() ?? readLanguageFromDocument());
}

function nextLanguage(current: LanguageCode): LanguageCode {
  const safeCurrent = normalizeLanguage(current);
  const index = SUPPORTED_LANGUAGE_CODES.indexOf(safeCurrent);
  return SUPPORTED_LANGUAGE_CODES[(index + 1) % SUPPORTED_LANGUAGE_CODES.length] ?? 'ru';
}

function lockBrowserAutoTranslate(language: LanguageCode) {
  if (typeof document === 'undefined') return;
  const htmlLang = getLanguageMeta(language).htmlLang;
  document.documentElement.lang = htmlLang;
  document.documentElement.dataset.p7Language = language;
  document.documentElement.setAttribute('translate', 'no');
  document.documentElement.classList.add('notranslate');
  document.body?.setAttribute('translate', 'no');
  document.body?.classList.add('notranslate');

  let meta = document.querySelector<HTMLMetaElement>('meta[name="google"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'google';
    document.head.appendChild(meta);
  }
  meta.content = 'notranslate';
}

function reloadCurrentRouteForLanguage(language: LanguageCode) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(LANGUAGE_RELOAD_KEY, language);
  } catch {}

  const url = new URL(window.location.href);
  url.searchParams.set('lang', language);
  url.searchParams.set('l10n', String(Date.now()));
  window.location.replace(url.toString());
}

export function HeaderLanguageSwitch() {
  const [mounted, setMounted] = useState(false);
  const [target, setTarget] = useState<Element | null>(null);
  const [language, setLanguage] = useState<LanguageCode>('ru');
  const [remoteDictionary, setRemoteDictionary] = useState<DictionaryState | null>(null);
  const dictionaries = useMemo(() => buildDictionaries(remoteDictionary), [remoteDictionary]);

  useEffect(() => {
    setMounted(true);
    clearLegacyDictionaryCache();
    const stored = readAuthoritativeLanguage();
    setLanguage(stored);
    lockBrowserAutoTranslate(stored);
    const cached = readCachedDictionaryState();
    if (cached) setRemoteDictionary(cached);
    fetchRemoteDictionaryState().then((state) => {
      if (state) setRemoteDictionary(state);
    }).catch(() => undefined);
  }, []);

  useEffect(() => subscribeToLanguageChanges((next) => {
    const safeNext = normalizeLanguage(next);
    setLanguage(safeNext);
    lockBrowserAutoTranslate(safeNext);
  }), []);

  useEffect(() => {
    if (!mounted) return;
    const sync = () => setTarget(findTarget());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const current = readAuthoritativeLanguage();
    if (current !== language) setLanguage(current);
    lockBrowserAutoTranslate(current);
    applyTranslationToDom(current, dictionaries);
    return startTranslationObserver(() => readAuthoritativeLanguage(), () => dictionaries);
  }, [language, dictionaries, mounted]);

  const chooseNextLanguage = useCallback(() => {
    const current = readAuthoritativeLanguage();
    const nextCode = nextLanguage(current);
    lockBrowserAutoTranslate(nextCode);
    writeStoredLanguage(nextCode);
    setLanguage(nextCode);
    applyTranslationToDom(nextCode, dictionaries);
    reloadCurrentRouteForLanguage(nextCode);
  }, [dictionaries]);

  if (!mounted || typeof document === 'undefined') return null;

  const meta = getLanguageMeta(language);
  const next = getLanguageMeta(nextLanguage(language));
  const languagesCount = SUPPORTED_LANGUAGES.length;
  const rootClassName = target ? styles.root : `${styles.root} ${styles.fallback}`;

  const node = (
    <span className={rootClassName} data-p7-no-translate='true'>
      <button
        type='button'
        className={styles.button}
        aria-label={`Язык ${meta.short}. Нажмите для переключения на ${next.short}. Всего языков: ${languagesCount}`}
        title={`Язык: ${meta.short}. Следующий: ${next.short}`}
        onClick={chooseNextLanguage}
        data-language={meta.short}
      >
        <Languages size={16} strokeWidth={2.45} aria-hidden='true' />
        <b>{meta.short}</b>
      </button>
    </span>
  );

  return createPortal(node, target ?? document.body);
}
