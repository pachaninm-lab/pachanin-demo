import { ArrowLeft } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { getPublicLoginCopy } from '@/i18n/public-login-copy';
import { LoginFormClient } from './LoginFormClient';

type Locale = 'ru' | 'en' | 'zh';

const SHELL_COPY: Record<Locale, { how: string; trust: string; about: string; register: string }> = {
  ru: { how: 'Как работает', trust: 'Доверие', about: 'О платформе', register: 'Зарегистрироваться' },
  en: { how: 'How it works', trust: 'Trust', about: 'About', register: 'Register' },
  zh: { how: '如何运行', trust: '信任', about: '关于平台', register: '注册' },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export default async function LoginPage() {
  const locale = await getLocale();
  const normalizedLocale = localeOf(locale);
  const { publicNav, brandTagline, backHome, form } = getPublicLoginCopy(locale);
  const chrome = await getTranslations('publicEntry.chrome');
  const shell = SHELL_COPY[normalizedLocale];
  const suffix = `?lang=${normalizedLocale}`;
  const homeHref = `/platform-v7${suffix}`;
  const nav = (
    <>
      <a href={`${homeHref}#deal-path`}>{shell.how}</a>
      <a href={`/platform-v7/trust${suffix}`}>{shell.trust}</a>
      <a href={`/platform-v7/about${suffix}`}>{shell.about}</a>
    </>
  );

  return (
    <main id='main-content' className='pc-v7-public-entry pc-auth-page'>
      <a className='pc-skip-link' href='#pc-login-title'>{chrome('skipToContent')}</a>
      <PublicSiteHeader
        ariaLabel={publicNav}
        tagline={brandTagline}
        brandHomeLabel={chrome('brandHomeLabel')}
        navLabel={chrome('navLabel')}
        menuLabel={chrome('menuLabel')}
        nav={nav}
        showMobileMenu
        localeControl={<PublicLocaleLink />}
        actions={(
          <div className='pc-v6-header-actions'>
            <a className='pc-site-action' href={homeHref} aria-label={backHome} title={backHome}>
              <ArrowLeft size={20} aria-hidden='true' />
              <span>{backHome}</span>
            </a>
            <a className='pc-v6-header-cta' href={`/platform-v7/register${suffix}`}>{shell.register}</a>
          </div>
        )}
      />
      <LoginFormClient copy={form} />
    </main>
  );
}
