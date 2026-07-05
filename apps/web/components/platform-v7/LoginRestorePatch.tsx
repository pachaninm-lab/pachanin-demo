'use client';

import { useEffect } from 'react';

const LANG_KEY = 'pc-v7-language';
const title = { ru: 'Выберите один рабочий кабинет', en: 'Select one workspace', zh: '选择一个工作区' } as const;

function lang() {
  const value = window.localStorage.getItem(LANG_KEY);
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function patchTitle() {
  const h1 = document.querySelector<HTMLElement>('.pc-v7-login-single .login-work-title h1');
  if (h1) h1.textContent = title[lang()];
}

export function LoginRestorePatch() {
  useEffect(() => {
    patchTitle();
    const id = window.setInterval(patchTitle, 500);
    window.addEventListener('storage', patchTitle);
    return () => { window.clearInterval(id); window.removeEventListener('storage', patchTitle); };
  }, []);

  return <style>{css}</style>;
}

const css = `.pc-v7-login-single .login-header{display:none!important}.pc-v7-login-single .login-card{max-width:560px!important;padding:24px!important;border-radius:30px!important}.pc-v7-login-single .login-work-title{display:block!important;margin-bottom:16px!important}.pc-v7-login-single .login-work-title h1{font-size:21px!important;line-height:1.15!important;letter-spacing:0!important;color:#5b6963!important}.pc-v7-login-single .login-work-title span{display:none!important}.pc-v7-login-single .login-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important;margin-bottom:22px!important}.pc-v7-login-single .login-grid button{min-height:90px!important;border-radius:21px!important;padding:12px!important;background:#fff!important;border:1px solid rgba(0,122,47,.18)!important;color:#087a3b!important}.pc-v7-login-single .login-grid button.active{background:#03130d!important;border-color:#03130d!important;color:#fff!important}.pc-v7-login-single .login-grid button.active b{color:#fff!important}.pc-v7-login-single .login-grid b{font-size:20px!important;color:#071611!important}.pc-v7-login-single .login-grid small{display:none!important}.pc-v7-login-single .login-form input{height:58px!important;border-radius:19px!important;font-size:20px!important;font-weight:900!important}.pc-v7-login-single .submit-button{min-height:62px!important;border-radius:19px!important;font-size:23px!important}.pc-v7-login-single[data-login-lang='zh'] *{letter-spacing:0!important}@media(max-width:560px){.pc-v7-login-single{padding:0 12px 28px!important}.pc-v7-login-single .login-grid{gap:10px!important}.pc-v7-login-single .login-grid button{min-height:88px!important}.pc-v7-login-single .login-grid b{font-size:19px!important}}`;
