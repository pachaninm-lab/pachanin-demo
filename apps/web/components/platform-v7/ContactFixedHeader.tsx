import Link from 'next/link';
import { LogIn, UserPlus } from 'lucide-react';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';

type Locale = 'ru' | 'en' | 'zh';

const COPY: Record<Locale, { aria: string; brandHome: string; skip: string; login: string; register: string }> = {
  ru: { aria: 'Шапка страницы обращения', brandHome: 'Прозрачная Цена — на главную', skip: 'Перейти к содержанию', login: 'Войти', register: 'Зарегистрироваться' },
  en: { aria: 'Contact page header', brandHome: 'Transparent Price — home', skip: 'Skip to content', login: 'Sign in', register: 'Register' },
  zh: { aria: '联系页面页眉', brandHome: '透明价格 — 返回首页', skip: '跳到主要内容', login: '登录', register: '注册' },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export function ContactFixedHeader({ locale }: { locale: string }) {
  const normalizedLocale = localeOf(locale);
  const copy = COPY[normalizedLocale];

  return (
    <>
      <a className='pc-skip-link' href='#main-content'>{copy.skip}</a>
      <PublicSiteHeader
        ariaLabel={copy.aria}
        brandHomeLabel={copy.brandHome}
        actions={(
          <>
            <Link href={`/platform-v7/login?lang=${normalizedLocale}`} className='pc-site-action p7-contact-login' aria-label={copy.login}>
              <LogIn size={18} aria-hidden='true' /><span>{copy.login}</span>
            </Link>
            <Link href={`/platform-v7/register?lang=${normalizedLocale}`} className='pc-site-action p7-contact-register' aria-label={copy.register}>
              <UserPlus size={18} aria-hidden='true' /><span>{copy.register}</span>
            </Link>
          </>
        )}
      />
      <style>{css}</style>
    </>
  );
}

const css = `
html body .p7-contact-page{padding-top:78px!important}
html body .p7-contact-page .p7-contact-layout{padding-top:0!important;margin-top:0!important}
.pc-site-header:has(.p7-contact-register) .p7-contact-login,
.pc-site-header:has(.p7-contact-register) .p7-contact-register{width:auto!important;padding:0 12px!important;gap:7px!important;white-space:nowrap!important}
.pc-site-header:has(.p7-contact-register) .p7-contact-register{background:#087a3b!important;border-color:#087a3b!important;color:#fff!important;font-weight:800!important}
.pc-site-header:has(.p7-contact-register) .p7-contact-register:hover,
.pc-site-header:has(.p7-contact-register) .p7-contact-register:focus-visible{background:#07572e!important;color:#fff!important}
@media(max-width:760px){
  html body .p7-contact-page{padding-top:72px!important}
}
@media(max-width:560px){
  .pc-site-header:has(.p7-contact-register){gap:6px!important;padding-inline:10px!important}
  .pc-site-header:has(.p7-contact-register) .pc-site-brand-text{display:none!important}
  .pc-site-header:has(.p7-contact-register) .pc-site-actions{gap:4px!important}
  .pc-site-header:has(.p7-contact-register) .p7-contact-login{width:44px!important;min-width:44px!important;padding:0!important}
  .pc-site-header:has(.p7-contact-register) .p7-contact-login span{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;clip-path:inset(50%)!important;white-space:nowrap!important}
  .pc-site-header:has(.p7-contact-register) .p7-contact-register{min-height:44px!important;padding:0 10px!important;font-size:13px!important}
}
@media(max-width:340px){
  .pc-site-header:has(.p7-contact-register) .p7-contact-register{padding:0 8px!important;font-size:12px!important}
}
@media(forced-colors:active){
  .pc-site-header:has(.p7-contact-register) .p7-contact-register{border:2px solid ButtonText!important}
}
`;
