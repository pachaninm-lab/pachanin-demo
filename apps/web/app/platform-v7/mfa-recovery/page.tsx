import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-auth.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-webkit-safe.css';
import { ArrowLeft, Languages } from 'lucide-react';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { MfaRecoveryClient } from './MfaRecoveryClient';

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: {
    nav: 'Навигация восстановления защиты входа',
    tagline: 'Доступ к платформе',
    home: 'На главную',
    language: 'Сменить язык',
    title: 'Восстановление защиты входа',
    lead: 'Одноразовая ссылка и текущий пароль подтверждают личность. Настройка второго фактора изменяется только после успешной проверки.',
  },
  en: {
    nav: 'Sign-in protection recovery navigation',
    tagline: 'Platform access',
    home: 'Home',
    language: 'Change language',
    title: 'Recover sign-in protection',
    lead: 'The single-use link and current password confirm identity. Two-factor protection is changed only after successful verification.',
  },
  zh: {
    nav: '登录保护恢复导航',
    tagline: '平台访问',
    home: '返回首页',
    language: '切换语言',
    title: '恢复登录保护',
    lead: '一次性链接和当前密码用于确认身份。只有验证成功后，双重验证设置才会更改。',
  },
} as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function localeFrom(value?: string): Locale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function nextLocale(locale: Locale): Locale {
  return locale === 'ru' ? 'en' : locale === 'en' ? 'zh' : 'ru';
}

export default async function MfaRecoveryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const locale = localeFrom(first(params.lang));
  const token = String(first(params.token) || '').trim().slice(0, 512);
  const copy = COPY[locale];
  const localeQuery = new URLSearchParams({ lang: nextLocale(locale) });
  if (token) localeQuery.set('token', token);

  return (
    <main className='pc-v7-public-entry pc-recovery-page'>
      <PublicSiteHeader
        ariaLabel={copy.nav}
        tagline={copy.tagline}
        localeControl={(
          <a
            className='pc-site-locale-switch'
            href={`/platform-v7/mfa-recovery?${localeQuery.toString()}`}
            aria-label={copy.language}
            title={copy.language}
          >
            <Languages size={16} strokeWidth={2.35} aria-hidden='true' />
            <span>{locale.toUpperCase()}</span>
          </a>
        )}
        actions={(
          <a className='pc-site-action' href='/platform-v7' aria-label={copy.home} title={copy.home}>
            <ArrowLeft size={20} aria-hidden='true' />
            <span>{copy.home}</span>
          </a>
        )}
      />
      <section className='pc-recovery-shell' aria-labelledby='pc-mfa-recovery-title'>
        <div className='pc-recovery-heading'>
          <h1 id='pc-mfa-recovery-title'>{copy.title}</h1>
          <p>{copy.lead}</p>
        </div>
        <MfaRecoveryClient token={token} locale={locale} />
      </section>
    </main>
  );
}
