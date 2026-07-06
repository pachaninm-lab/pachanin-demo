'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Languages, X } from 'lucide-react';
import {
  LANGUAGES,
  getLanguageMeta,
  readStoredLanguage,
  subscribeToLanguageChanges,
  writeStoredLanguage,
  type LanguageCode,
} from '@/lib/platform-v7/i18n/translation-runtime';

const TARGETS = ['.pc-site-actions', '.pc-v4-actions', '.p7-flow-actions', '.p7-request-actions', '.p7-contact-nav', '.p7-register-actions', '.login-header'];

function findTarget() {
  for (const selector of TARGETS) {
    const target = document.querySelector<Element>(selector);
    if (target) return target;
  }
  return null;
}

export function HeaderLanguageSwitch() {
  const [target, setTarget] = useState<Element | null>(null);
  const [language, setLanguage] = useState<LanguageCode>('ru');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLanguage(readStoredLanguage());
    return subscribeToLanguageChanges(setLanguage);
  }, []);

  useEffect(() => {
    const sync = () => setTarget(findTarget());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      if (element && !element.closest('.p7-header-lang')) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const meta = getLanguageMeta(language);
  const node = (
    <span className='p7-header-lang' data-p7-no-translate='true'>
      <style>{css}</style>
      <button type='button' className='p7-header-lang-button' aria-label='Сменить язык' title='Сменить язык' onClick={() => setOpen((value) => !value)}>
        <Languages size={17} strokeWidth={2.45} />
        <b>{meta.short}</b>
      </button>
      {open ? (
        <span className='p7-header-lang-panel' role='dialog' aria-label='Смена языка'>
          <span className='p7-header-lang-head'><strong>Смена языка</strong><button type='button' onClick={() => setOpen(false)} aria-label='Закрыть'><X size={15} /></button></span>
          {LANGUAGES.map((item) => (
            <button key={item.code} type='button' data-active={item.code === language ? 'true' : 'false'} onClick={() => { writeStoredLanguage(item.code); setLanguage(item.code); setOpen(false); }}>
              <span><strong>{item.native}</strong><small>{item.label}</small></span>{item.code === language ? <Check size={15} /> : <em>{item.short}</em>}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );

  return target ? createPortal(node, target) : createPortal(<span className='p7-header-lang p7-header-lang-fallback' data-p7-no-translate='true'><style>{css}</style>{node}</span>, document.body);
}

const css = `
.p7-header-lang{position:relative;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;order:-5!important;z-index:3800}.p7-header-lang-button{width:42px;height:42px;min-width:42px;border-radius:14px;border:1px solid rgba(8,122,59,.2);background:rgba(8,122,59,.08);color:#087a3b;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0;box-shadow:0 8px 20px rgba(7,22,17,.045);cursor:pointer}.p7-header-lang-button b{font-size:10px;font-weight:950;line-height:1;color:#075f32}.p7-header-lang-panel{position:fixed;right:12px;top:calc(env(safe-area-inset-top) + 72px);width:min(340px,calc(100vw - 24px));display:grid;gap:7px;padding:12px;border-radius:20px;border:1px solid rgba(7,22,17,.12);background:rgba(255,255,255,.98);box-shadow:0 22px 70px rgba(7,22,17,.16);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#071611}.p7-header-lang-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:2px}.p7-header-lang-head strong{font-size:15px;font-weight:950}.p7-header-lang-head button{width:34px;height:34px;border-radius:12px;border:1px solid rgba(7,22,17,.1);background:#fff;color:#071611;display:inline-flex;align-items:center;justify-content:center}.p7-header-lang-panel>button{min-height:48px;padding:8px 10px;border-radius:15px;border:1px solid rgba(7,22,17,.09);background:#fff;color:#071611;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left}.p7-header-lang-panel>button[data-active='true']{border-color:rgba(8,122,59,.28);background:rgba(8,122,59,.075)}.p7-header-lang-panel>button span{display:grid;gap:2px}.p7-header-lang-panel>button strong{font-size:13px;font-weight:930}.p7-header-lang-panel>button small{font-size:11px;color:#66758a}.p7-header-lang-panel>button em{font-style:normal;font-size:11px;font-weight:950;color:#66758a}.p7-header-lang-fallback{position:fixed;right:12px;top:calc(env(safe-area-inset-top) + 12px)}.pc-v4-actions .p7-header-lang-button{background:var(--pc-bg-card);border-color:var(--pc-border);color:var(--pc-text-secondary);box-shadow:var(--pc-shadow-sm)}@media(max-width:720px){.pc-site-actions{gap:6px!important}.pc-site-actions .entry-login{min-width:76px!important;height:40px!important;min-height:40px!important;padding:0 12px!important;font-size:14px!important}.pc-site-actions .entry-login svg{display:none!important}.pc-site-actions .entry-header-register{display:none!important}.p7-header-lang-button{width:40px;height:40px;min-width:40px;border-radius:13px}.p7-header-lang-button b{display:none}.p7-header-lang-panel{right:10px;left:10px;width:auto;top:calc(env(safe-area-inset-top) + 70px)}}
`;
