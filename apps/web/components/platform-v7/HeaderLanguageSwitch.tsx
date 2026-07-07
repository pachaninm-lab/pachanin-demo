'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Languages } from 'lucide-react';
import {
  LANGUAGES,
  getLanguageMeta,
  readStoredLanguage,
  subscribeToLanguageChanges,
  writeStoredLanguage,
  type LanguageCode,
} from '@/lib/platform-v7/i18n/translation-runtime';

const TARGETS = [
  '.pc-site-actions',
  '.pc-v4-actions',
  '.p7-flow-actions',
  '.p7-request-actions',
  '.p7-contact-nav',
  '.p7-register-actions',
  '.login-header',
];

function findTarget() {
  if (typeof document === 'undefined') return null;
  for (const selector of TARGETS) {
    const target = document.querySelector<Element>(selector);
    if (target) return target;
  }
  return null;
}

function nextLanguage(current: LanguageCode): LanguageCode {
  const index = LANGUAGES.findIndex((item) => item.code === current);
  return LANGUAGES[(index + 1) % LANGUAGES.length]?.code ?? 'ru';
}

export function HeaderLanguageSwitch() {
  const [mounted, setMounted] = useState(false);
  const [target, setTarget] = useState<Element | null>(null);
  const [language, setLanguage] = useState<LanguageCode>('ru');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLanguage(readStoredLanguage());
    return subscribeToLanguageChanges(setLanguage);
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

  if (!mounted || typeof document === 'undefined') return null;

  const meta = getLanguageMeta(language);
  const next = getLanguageMeta(nextLanguage(language));
  const chooseNextLanguage = () => {
    const nextCode = nextLanguage(language);
    writeStoredLanguage(nextCode);
    setLanguage(nextCode);
  };

  const node = (
    <span className='p7-header-lang' data-p7-no-translate='true'>
      <style>{css}</style>
      <button
        type='button'
        className='p7-header-lang-button'
        aria-label={`Язык: ${meta.short}. Переключить на ${next.short}`}
        title={`Язык: ${meta.short}. Следующий: ${next.short}`}
        onClick={chooseNextLanguage}
      >
        <Languages size={16} strokeWidth={2.45} />
        <b>{meta.short}</b>
      </button>
    </span>
  );

  const portalTarget = target ?? document.body;
  return createPortal(target ? node : <span className='p7-header-lang p7-header-lang-fallback' data-p7-no-translate='true'><style>{css}</style>{node}</span>, portalTarget);
}

const css = `
.p7-header-lang{position:relative;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;z-index:3800}.p7-header-lang-button{height:42px;min-width:48px;border-radius:14px;border:1px solid rgba(8,122,59,.2);background:rgba(8,122,59,.08);color:#087a3b;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 9px;box-shadow:0 8px 20px rgba(7,22,17,.045);cursor:pointer;appearance:none;-webkit-tap-highlight-color:transparent}.p7-header-lang-button:hover{border-color:rgba(8,122,59,.34);background:rgba(8,122,59,.12)}.p7-header-lang-button:focus-visible{outline:3px solid rgba(8,122,59,.30);outline-offset:3px}.p7-header-lang-button b{display:inline-block!important;min-width:18px;font-size:10px;font-weight:950;line-height:1;color:#075f32;letter-spacing:.02em}.p7-header-lang-fallback{position:fixed;right:12px;top:calc(env(safe-area-inset-top) + 12px)}.pc-site-actions .p7-header-lang,.pc-v4-actions .p7-header-lang,.p7-flow-actions .p7-header-lang,.p7-request-actions .p7-header-lang,.p7-contact-nav .p7-header-lang,.p7-register-actions .p7-header-lang{order:-5!important}.pc-v4-actions .p7-header-lang-button{background:var(--pc-bg-card);border-color:var(--pc-border);color:var(--pc-text-secondary);box-shadow:var(--pc-shadow-sm)}.pc-v4-actions .p7-header-lang-button b{color:var(--pc-text-primary)}.login-header>.login-brand{order:1}.login-header>.p7-header-lang{order:2;margin-left:auto}.login-header>.login-back{order:3}.login-header>.p7-header-lang .p7-header-lang-button{width:56px;height:56px;min-width:56px;border-radius:18px;background:#fff;color:#087a3b;border-color:rgba(7,22,17,.1);box-shadow:0 10px 26px rgba(7,22,17,.06)}.login-header>.p7-header-lang .p7-header-lang-button b{font-size:11px;color:#087a3b}@media(max-width:767px){.pc-site-actions{gap:6px!important}.pc-site-actions .entry-login{min-width:76px!important;height:40px!important;min-height:40px!important;padding:0 12px!important;font-size:14px!important}.pc-site-actions .entry-login svg{display:none!important}.pc-site-actions .entry-header-register{display:none!important}.p7-header-lang-button{height:40px;min-width:44px;border-radius:13px;padding:0 8px;gap:4px}.p7-header-lang-button b{display:inline-block!important;font-size:9.5px}.pc-v4-actions .p7-header-lang-button{height:38px!important;min-width:42px!important;border-radius:13px!important;padding:0 7px!important}.login-header>.p7-header-lang .p7-header-lang-button{width:auto;height:52px;min-width:52px;border-radius:17px}.login-header>.p7-header-lang .p7-header-lang-button b{font-size:10px}}@media(max-width:374px){.p7-header-lang-button{min-width:40px;padding:0 6px}.p7-header-lang-button svg{width:14px;height:14px}.p7-header-lang-button b{font-size:9px}.login-header>.p7-header-lang .p7-header-lang-button{min-width:48px;height:48px}}
`;
