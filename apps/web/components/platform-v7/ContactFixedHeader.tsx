import Link from 'next/link';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';

type Locale = 'ru' | 'en' | 'zh';

const COPY: Record<Locale, { aria: string; brandHome: string; skip: string; login: string; register: string; how: string; trust: string; about: string; menu: string }> = {
  ru: { aria: 'Шапка страницы обращения', brandHome: 'Прозрачная Цена — на главную', skip: 'Перейти к содержанию', login: 'Войти', register: 'Зарегистрироваться', how: 'Как работает', trust: 'Доверие', about: 'О платформе', menu: 'Меню' },
  en: { aria: 'Contact page header', brandHome: 'Transparent Price — home', skip: 'Skip to content', login: 'Sign in', register: 'Register', how: 'How it works', trust: 'Trust', about: 'About', menu: 'Menu' },
  zh: { aria: '联系页面页眉', brandHome: '透明价格 — 返回首页', skip: '跳到主要内容', login: '登录', register: '注册', how: '如何运行', trust: '信任', about: '关于平台', menu: '菜单' },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export function ContactFixedHeader({ locale }: { locale: string }) {
  const normalizedLocale = localeOf(locale);
  const copy = COPY[normalizedLocale];
  const suffix = `?lang=${normalizedLocale}`;
  const home = `/platform-v7${suffix}`;
  const nav = (
    <>
      <Link href={`${home}#deal-path`}>{copy.how}</Link>
      <Link href={`/platform-v7/trust${suffix}`}>{copy.trust}</Link>
      <Link href={`/platform-v7/about${suffix}`}>{copy.about}</Link>
    </>
  );

  return (
    <>
      <a className='pc-skip-link' href='#main-content'>{copy.skip}</a>
      <PublicSiteHeader
        ariaLabel={copy.aria}
        brandHomeLabel={copy.brandHome}
        navLabel={copy.aria}
        menuLabel={copy.menu}
        nav={nav}
        showMobileMenu
        localeControl={<PublicLocaleLink />}
        actions={(
          <div className='pc-v6-header-actions'>
            <Link href={`/platform-v7/login${suffix}`} className='entry-login p7-contact-login'>{copy.login}</Link>
            <Link href={`/platform-v7/register${suffix}`} className='pc-v6-header-cta p7-contact-register'>{copy.register}</Link>
          </div>
        )}
      />
      <style>{css}</style>
    </>
  );
}

const css = `
html body .p7-contact-page{padding-top:78px!important}
html body .p7-contact-page .p7-contact-layout{padding-top:0!important;margin-top:0!important}
.pc-site-header:has(.p7-contact-register) .p7-contact-login,.pc-site-header:has(.p7-contact-register) .p7-contact-register{width:auto;min-height:44px;padding:0 12px;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;text-decoration:none;font-size:13px;font-weight:760}
.pc-site-header:has(.p7-contact-register) .p7-contact-login{border:1px solid #c6d5cb;background:#fff;color:#173d2b}
.pc-site-header:has(.p7-contact-register) .p7-contact-register{border:1px solid #087a3b;background:#087a3b;color:#fff}
.pc-site-header:has(.p7-contact-register) .p7-contact-register:hover,.pc-site-header:has(.p7-contact-register) .p7-contact-register:focus-visible{background:#07572e;color:#fff}
@media(max-width:760px){html body .p7-contact-page{padding-top:72px!important}}
@media(max-width:560px){.pc-site-header:has(.p7-contact-register) .p7-contact-login{display:none}.pc-site-header:has(.p7-contact-register) .p7-contact-register{padding-inline:10px;font-size:12px}}
`;
