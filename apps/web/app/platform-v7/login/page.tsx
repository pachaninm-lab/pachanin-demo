import { ArrowLeft, Lock, ScrollText, ShieldCheck } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { getPublicLoginCopy } from '@/i18n/public-login-copy';
import { LoginFormClient } from './LoginFormClient';

type AuthLocale = 'ru' | 'en' | 'zh';

const AUTH_ASSURANCE: Record<AuthLocale, {
  trustLabel: string;
  secureConnection: string;
  twoFactor: string;
  audited: string;
  serviceNote: string;
}> = {
  ru: {
    trustLabel: 'Защита входа',
    secureConnection: 'Защищённое соединение',
    twoFactor: 'Вход по двухфакторной проверке',
    audited: 'Все действия в системе журналируются',
    serviceNote: 'Рабочая платформа исполнения зерновой сделки',
  },
  en: {
    trustLabel: 'Sign-in protection',
    secureConnection: 'Encrypted connection',
    twoFactor: 'Two-factor sign-in',
    audited: 'Every action in the system is logged',
    serviceNote: 'Working platform for grain deal execution',
  },
  zh: {
    trustLabel: '登录保护',
    secureConnection: '加密连接',
    twoFactor: '双因素登录验证',
    audited: '系统中的所有操作均被记录',
    serviceNote: '粮食交易执行工作平台',
  },
};

function resolveAuthLocale(locale: string): AuthLocale {
  return locale === 'en' || locale === 'zh' ? locale : 'ru';
}

export default async function LoginPage() {
  const locale = await getLocale();
  const { publicNav, brandTagline, backHome, form } = getPublicLoginCopy(locale);
  const chrome = await getTranslations('publicEntry.chrome');
  const assurance = AUTH_ASSURANCE[resolveAuthLocale(locale)];
  const buildStamp = (process.env.NEXT_PUBLIC_BUILD_ID || 'runtime').slice(0, 12);
  const year = new Date().getUTCFullYear();

  return (
    <main id='main-content' className='pc-v7-public-entry pc-auth-page'>
      <a className='pc-skip-link' href='#pc-login-title'>{chrome('skipToContent')}</a>
      <PublicSiteHeader
        ariaLabel={publicNav}
        tagline={brandTagline}
        brandHomeLabel={chrome('brandHomeLabel')}
        navLabel={chrome('navLabel')}
        menuLabel={chrome('menuLabel')}
        localeControl={<PublicLocaleLink />}
        actions={(
          <a className='pc-site-action' href='/platform-v7' aria-label={backHome} title={backHome}>
            <ArrowLeft size={20} aria-hidden='true' />
            <span>{backHome}</span>
          </a>
        )}
      />
      <LoginFormClient copy={form} />

      <div className='pc-auth-extras'>
        <aside className='pc-auth-trust' aria-label={assurance.trustLabel}>
          <span className='pc-auth-trust-title'>{assurance.trustLabel}</span>
          <ul>
            <li>
              <Lock size={18} aria-hidden='true' />
              <span>{assurance.secureConnection}</span>
            </li>
            <li>
              <ShieldCheck size={18} aria-hidden='true' />
              <span>{assurance.twoFactor}</span>
            </li>
            <li>
              <ScrollText size={18} aria-hidden='true' />
              <span>{assurance.audited}</span>
            </li>
          </ul>
        </aside>
      </div>

      <footer className='pc-auth-servicebar'>
        <span>{assurance.serviceNote}</span>
        <span className='pc-auth-servicebar-meta'>
          <span>© {year} Прозрачная Цена</span>
          <span aria-hidden='true'>·</span>
          <span className='pc-auth-build'>сборка {buildStamp}</span>
        </span>
      </footer>
    </main>
  );
}
