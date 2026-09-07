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
@media(max-width:760px){html body .p7-contact-page{padding-top:72px!important}}
`;
