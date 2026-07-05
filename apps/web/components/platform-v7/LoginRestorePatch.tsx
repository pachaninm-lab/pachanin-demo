'use client';

import { useEffect } from 'react';

const ROLE_KEY = 'pc_v7_pending_role';
const LANG_KEY = 'pc-v7-language';

const titles = {
  ru: 'Вход в кабинет',
  en: 'Sign in',
  zh: '登录',
} as const;

function readLang() {
  const lang = window.localStorage.getItem(LANG_KEY);
  return lang === 'en' || lang === 'zh' ? lang : 'ru';
}

function ensureRole() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('role') || window.sessionStorage.getItem(ROLE_KEY)) return;
  window.sessionStorage.setItem(ROLE_KEY, 'operator');
  url.searchParams.set('role', 'operator');
  window.location.replace(url.toString());
}

function patchTitle() {
  const h1 = document.querySelector<HTMLElement>('.pc-v7-login-single .login-work-title h1');
  if (h1) h1.textContent = titles[readLang()];
}

export function LoginRestorePatch() {
  useEffect(() => {
    ensureRole();
    patchTitle();
    const id = window.setInterval(patchTitle, 400);
    window.addEventListener('storage', patchTitle);
    return () => { window.clearInterval(id); window.removeEventListener('storage', patchTitle); };
  }, []);

  return <style>{css}</style>;
}

const css = `.pc-v7-login-single{padding:12px!important}.pc-v7-login-single .login-header,.pc-v7-login-single .login-card{max-width:560px!important}.pc-v7-login-single .login-grid{display:none!important}.pc-v7-login-single .login-card{padding:24px!important;border-radius:30px!important}.pc-v7-login-single .login-work-title{display:grid!important;align-items:start!important;justify-content:start!important;gap:8px!important;margin-bottom:18px!important}.pc-v7-login-single .login-work-title h1{font-size:clamp(34px,8vw,54px)!important;line-height:1!important;letter-spacing:-.055em!important}.pc-v7-login-single .login-work-title span{width:max-content;max-width:100%;padding:8px 11px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:12px;font-weight:950}.pc-v7-login-single .login-form{display:grid!important;gap:12px!important}.pc-v7-login-single .submit-button{min-height:52px!important}.pc-v7-login-single[data-login-lang='zh'] .login-work-title h1{line-height:1.12!important;letter-spacing:0!important}@media(max-width:560px){.pc-v7-login-single .login-card{padding:22px!important;border-radius:26px!important}.pc-v7-login-single .login-brand b{font-size:19px!important}.pc-v7-login-single .login-brand small{font-size:11.5px!important}}`;
