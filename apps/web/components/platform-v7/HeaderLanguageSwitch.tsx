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

  useEffect(() => {
    return subscribeToLanguageChanges((next) => {
      const safeNext = normalizeLanguage(next);
      setLanguage(safeNext);
      lockBrowserAutoTranslate(safeNext);
    });
  }, []);

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

  const node = (
    <span className='p7-header-lang' data-p7-no-translate='true'>
      <style>{css}</style>
      <button
        type='button'
        className='p7-header-lang-button'
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

  const portalTarget = target ?? document.body;
  return createPortal(target ? node : <span className='p7-header-lang p7-header-lang-fallback' data-p7-no-translate='true'><style>{css}</style>{node}</span>, portalTarget);
}

const css = `
.p7-register-actions .p7-register-action-exit{display:none!important}
.p7-header-lang{position:relative;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;z-index:3800}.p7-header-lang-button{inline-size:54px!important;min-inline-size:54px!important;max-inline-size:54px!important;block-size:42px!important;min-block-size:42px!important;max-block-size:42px!important;border-radius:14px!important;border:1px solid rgba(8,122,59,.22)!important;background:rgba(8,122,59,.08)!important;color:#087a3b!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:4px!important;padding:0!important;box-shadow:0 8px 20px rgba(7,22,17,.045)!important;cursor:pointer!important;appearance:none!important;-webkit-tap-highlight-color:transparent!important;white-space:nowrap!important}.p7-header-lang-button:hover{border-color:rgba(8,122,59,.34)!important;background:rgba(8,122,59,.12)}.p7-header-lang-button:focus-visible{outline:3px solid rgba(8,122,59,.30)!important;outline-offset:3px!important}.p7-header-lang-button b{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:19px!important;font-size:10.5px!important;font-weight:950!important;line-height:1!important;color:#075f32!important;letter-spacing:.02em!important}.p7-header-lang-fallback{position:fixed!important;right:12px!important;top:calc(env(safe-area-inset-top) + 12px)!important}.pc-site-actions .p7-header-lang,.entry-header-actions .p7-header-lang,.pc-v4-actions .p7-header-lang,.p7-flow-actions .p7-header-lang,.p7-request-actions .p7-header-lang,.p7-contact-nav .p7-header-lang,.p7-contact-fixed-actions .p7-header-lang,.p7-register-actions .p7-header-lang{order:-5!important}.pc-v4-actions .p7-header-lang-button{background:var(--pc-bg-card)!important;border-color:var(--pc-border)!important;color:var(--pc-text-secondary)!important;box-shadow:var(--pc-shadow-sm)!important}.pc-v4-actions .p7-header-lang-button b{color:var(--pc-text-primary)!important}.login-header>.login-brand{order:1!important}.login-header>.p7-header-lang{order:2!important;margin-left:auto!important}.login-header>.login-back{order:3!important}.login-header>.p7-header-lang .p7-header-lang-button{inline-size:56px!important;min-inline-size:56px!important;max-inline-size:56px!important;block-size:56px!important;min-block-size:56px!important;max-block-size:56px!important;border-radius:18px!important;background:#fff!important;color:#087a3b!important;border-color:rgba(7,22,17,.1)!important;box-shadow:0 10px 26px rgba(7,22,17,.06)!important}.login-header>.p7-header-lang .p7-header-lang-button b{font-size:11px!important;color:#087a3b!important}@media(max-width:767px){.pc-site-actions{gap:6px!important}.pc-site-actions .entry-login{min-width:76px!important;height:40px!important;min-height:40px!important;padding:0 12px!important;font-size:14px!important}.pc-site-actions .entry-login svg{display:none!important}.pc-site-actions .entry-header-register{display:none!important}.p7-header-lang-button{inline-size:50px!important;min-inline-size:50px!important;max-inline-size:50px!important;block-size:40px!important;min-block-size:40px!important;max-block-size:40px!important;border-radius:13px!important}.p7-header-lang-button svg{width:15px!important;height:15px!important}.p7-header-lang-button b{display:inline-flex!important;font-size:10px!important;min-width:18px!important}.pc-v4-actions .p7-header-lang-button{inline-size:46px!important;min-inline-size:46px!important;max-inline-size:46px!important;block-size:38px!important;min-block-size:38px!important;max-block-size:38px!important}.login-header>.p7-header-lang .p7-header-lang-button{inline-size:52px!important;min-inline-size:52px!important;max-inline-size:52px!important;block-size:52px!important;min-block-size:52px!important;max-block-size:52px!important;border-radius:17px!important}.login-header>.p7-header-lang .p7-header-lang-button b{font-size:10px!important}}@media(max-width:374px){.p7-header-lang-button{inline-size:46px!important;min-inline-size:46px!important;max-inline-size:46px!important}.p7-header-lang-button svg{width:14px!important;height:14px!important}.p7-header-lang-button b{font-size:9.5px!important}.login-header>.p7-header-lang .p7-header-lang-button{inline-size:48px!important;min-inline-size:48px!important;max-inline-size:48px!important;block-size:48px!important;min-block-size:48px!important;max-block-size:48px!important;border-radius:17px!important}}
`;
