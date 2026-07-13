import type { ReactNode } from 'react';
import { ArrowLeft, LogIn } from 'lucide-react';
import { getLocale } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import '@/styles/platform-v7-public-supporting-shell.css';

type ShellLocale = 'ru' | 'en' | 'zh';

const COPY: Record<ShellLocale, {
  header: string;
  tagline: string;
  home: string;
  login: string;
}> = {
  ru: {
    header: 'Шапка сайта',
    tagline: 'Контур исполнения сделки',
    home: 'На главную',
    login: 'Войти',
  },
  en: {
    header: 'Site header',
    tagline: 'Transaction execution circuit',
    home: 'Home',
    login: 'Sign in',
  },
  zh: {
    header: '网站页眉',
    tagline: '交易执行闭环',
    home: '返回首页',
    login: '登录',
  },
};

export async function PlatformV7PublicPageShell({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const copy = COPY[locale === 'en' || locale === 'zh' ? locale : 'ru'];

  return (
    <div data-public-supporting-shell>
      <PublicSiteHeader
        ariaLabel={copy.header}
        tagline={copy.tagline}
        showMobileMenu={false}
        localeControl={<PublicLocaleLink />}
        actions={(
          <>
            <a className='pc-site-action' href='/platform-v7' aria-label={copy.home} title={copy.home}>
              <ArrowLeft size={20} aria-hidden='true' />
              <span>{copy.home}</span>
            </a>
            <a className='pc-site-action is-primary' href='/platform-v7/login' aria-label={copy.login} title={copy.login}>
              <LogIn size={19} aria-hidden='true' />
              <span>{copy.login}</span>
            </a>
          </>
        )}
      />
      <div className='pc-public-supporting-content'>{children}</div>
    </div>
  );
}
