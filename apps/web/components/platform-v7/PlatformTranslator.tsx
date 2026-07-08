'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Languages, X } from 'lucide-react';
import {
  LANGUAGES,
  applyTranslationToDom,
  buildDictionaries,
  clearLegacyDictionaryCache,
  getLanguageMeta,
  readCachedDictionaryState,
  readStoredLanguage,
  startTranslationObserver,
  subscribeToLanguageChanges,
  writeLocaleCookie,
  writeStoredLanguage,
  type DictionarySet,
  type DictionaryState,
  type LanguageCode,
} from '@/lib/platform-v7/i18n/translation-runtime';
import { PLATFORM_V7_MANUAL_DICTIONARY_OVERRIDES } from '@/lib/platform-v7/i18n/manual-dictionary-overrides';

const HEADER_TARGETS = [
  '.pc-site-actions',
  '.entry-header-actions',
  '.login-header',
  '.login-top',
  '.p7-demo-header-actions',
  '.p7-contact-nav',
  '.p7-contact-fixed-actions',
  '.p7-register-actions',
  '.pc-v4-actions',
] as const;

const UI_COPY: Record<LanguageCode, { button: string; title: string; close: string; current: string }> = {
  ru: { button: 'Перевод', title: 'Переводчик', close: 'Закрыть переводчик', current: 'Текущий язык' },
  en: { button: 'Translate', title: 'Translator', close: 'Close translator', current: 'Current language' },
  zh: { button: '翻译', title: '翻译器', close: '关闭翻译器', current: '当前语言' },
};

function findHeaderTarget() {
  for (const selector of HEADER_TARGETS) {
    const target = document.querySelector<Element>(selector);
    if (target) return target;
  }
  return null;
}

function withManualOverrides(base: DictionarySet): DictionarySet {
  return {
    en: { ...base.en, ...PLATFORM_V7_MANUAL_DICTIONARY_OVERRIDES.en },
    zh: { ...base.zh, ...PLATFORM_V7_MANUAL_DICTIONARY_OVERRIDES.zh },
  };
}

export function PlatformTranslator() {
  const [mounted, setMounted] = useState(false);
  const [target, setTarget] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const [language, setLanguageState] = useState<LanguageCode>('ru');
  const [remoteDictionary, setRemoteDictionary] = useState<DictionaryState | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const dictionaries = useMemo(() => withManualOverrides(buildDictionaries(remoteDictionary)), [remoteDictionary]);
  const activeLanguage = useMemo(() => getLanguageMeta(language), [language]);
  const copy = UI_COPY[language];

  useEffect(() => {
    setMounted(true);
    clearLegacyDictionaryCache();
    const stored = readStoredLanguage();
    setLanguageState(stored);
    writeLocaleCookie(stored);
    const cached = readCachedDictionaryState();
    if (cached) setRemoteDictionary(cached);

    return subscribeToLanguageChanges((next) => {
      setLanguageState(next);
      writeLocaleCookie(next);
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const syncTarget = () => setTarget(findHeaderTarget());
    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', syncTarget);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncTarget);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    applyTranslationToDom(language, dictionaries);
    return startTranslationObserver(() => language, () => dictionaries);
  }, [language, dictionaries, mounted]);

  const closePanel = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanel(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      if (element && !element.closest('.p7-translator-root')) closePanel(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, closePanel]);

  const selectLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    writeStoredLanguage(code);
    setOpen(false);
  }, []);

  if (!mounted) return null;

  const button = (
    <span className='p7-translator-root p7-translator-slot' data-p7-no-translate='true'>
      <style>{css}</style>
      <button
        ref={buttonRef}
        type='button'
        className='p7-translator-button'
        onClick={() => setOpen((value) => !value)}
        aria-label={copy.title}
        title={copy.title}
        aria-expanded={open}
        aria-haspopup='dialog'
      >
        <Languages size={17} strokeWidth={2.45} />
        <span>{copy.button}</span>
        <b>{activeLanguage.short}</b>
      </button>
    </span>
  );

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          className='p7-translator-root p7-translator-panel'
          role='dialog'
          aria-label={copy.title}
          data-p7-no-translate='true'
          tabIndex={-1}
        >
          <div className='p7-translator-panel-head'>
            <strong>{copy.title}</strong>
            <button type='button' onClick={() => closePanel(true)} aria-label={copy.close} title={copy.close}><X size={16} /></button>
          </div>
          <div className='p7-translator-current'>
            {copy.current}: <b>{activeLanguage.native}</b>
          </div>
          <div className='p7-translator-list'>
            {LANGUAGES.map((item) => (
              <button
                key={item.code}
                type='button'
                lang={item.htmlLang}
                onClick={() => selectLanguage(item.code)}
                data-active={item.code === language ? 'true' : 'false'}
                aria-pressed={item.code === language}
              >
                <span><strong>{item.native}</strong><small>{item.label}</small></span>
                {item.code === language ? <Check size={16} /> : <em>{item.short}</em>}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {target ? createPortal(button, target) : <div className='p7-translator-root p7-translator-fallback' data-p7-no-translate='true'>{button}</div>}
      {panel}
    </>
  );
}

const css = `
.p7-translator-slot{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;order:60}.p7-translator-button>span{display:none}
.p7-translator-button{height:42px;min-width:42px;padding:0 11px;border-radius:14px;border:1px solid rgba(8,122,59,.18);background:rgba(8,122,59,.075);color:#087a3b;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12.5px;font-weight:950;letter-spacing:-.02em;white-space:nowrap;cursor:pointer;box-shadow:0 8px 20px rgba(7,22,17,.045)}
.p7-translator-button:hover{border-color:rgba(8,122,59,.28);background:rgba(8,122,59,.11)}
.p7-translator-button b{min-width:25px;height:24px;padding:0 5px;border-radius:999px;background:rgba(255,255,255,.76);display:inline-flex;align-items:center;justify-content:center;color:#075f32;font-size:10.5px;font-weight:950}
.pc-v4-actions .p7-translator-button{height:44px;min-width:44px;border-radius:14px;background:var(--pc-bg-card);border-color:var(--pc-border);color:var(--pc-text-secondary);box-shadow:var(--pc-shadow-sm)}
.pc-v4-actions .p7-translator-button span{display:none}.pc-v4-actions .p7-translator-button b{background:var(--pc-accent-bg);color:var(--pc-accent-strong)}
.p7-translator-fallback{position:fixed;right:12px;top:calc(env(safe-area-inset-top) + 12px);z-index:3600}
.p7-translator-panel{position:fixed;right:14px;top:calc(env(safe-area-inset-top) + 72px);z-index:3700;width:min(370px,calc(100vw - 28px));padding:14px;border-radius:22px;border:1px solid rgba(7,22,17,.12);background:rgba(255,255,255,.98);box-shadow:0 22px 70px rgba(7,22,17,.16);backdrop-filter:blur(18px);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#071611;display:grid;gap:12px}
.p7-translator-panel:focus{outline:none}.p7-translator-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.p7-translator-panel-head strong{font-size:16px;font-weight:950;letter-spacing:-.03em}
.p7-translator-panel-head button{width:36px;height:36px;border-radius:13px;border:1px solid rgba(7,22,17,.1);background:#fff;color:#071611;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.p7-translator-current{padding:10px 11px;border-radius:15px;background:rgba(8,122,59,.07);border:1px solid rgba(8,122,59,.14);font-size:12.5px;color:#526173}.p7-translator-current b{color:#087a3b}
.p7-translator-list{display:grid;gap:7px}.p7-translator-list button{min-height:48px;padding:8px 10px;border-radius:15px;border:1px solid rgba(7,22,17,.09);background:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;color:#071611;cursor:pointer;text-align:left}.p7-translator-list button[data-active='true']{border-color:rgba(8,122,59,.28);background:rgba(8,122,59,.075)}
.p7-translator-list button span{display:grid;gap:2px}.p7-translator-list button strong{font-size:13.5px;font-weight:930}.p7-translator-list button small{font-size:11.5px;color:#66758a}.p7-translator-list button em{font-style:normal;font-size:11px;font-weight:950;color:#66758a}.p7-translator-list button svg{color:#087a3b}.p7-translator-root *{box-sizing:border-box}
@media(max-width:640px){.p7-translator-button{height:40px;min-width:40px;width:40px;padding:0;border-radius:13px}.p7-translator-button span,.p7-translator-button b{display:none}.pc-v4-actions .p7-translator-button{height:38px;min-width:38px;width:38px}.p7-translator-panel{right:10px;left:10px;width:auto;top:calc(env(safe-area-inset-top) + 70px)}}
`;
