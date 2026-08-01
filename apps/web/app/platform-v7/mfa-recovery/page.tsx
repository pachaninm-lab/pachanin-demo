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
  ru: { nav: 'Навигация восстановления MFA', tagline: 'Цифровая платформа агросделок', home: 'На главную', language: 'Сменить язык', title: 'Безопасное восстановление MFA', lead: 'Одноразовая ссылка и текущий пароль подтверждают личность. Администратор организации не может отключить MFA самостоятельно.' },
  en: { nav: 'MFA recovery navigation', tagline: 'Digital agricultural deal platform', home: 'Home', language: 'Change language', title: 'Secure MFA recovery', lead: 'The single-use link and current password confirm identity. An organization administrator cannot disable MFA unilaterally.' },
  zh: { nav: 'MFA 恢复导航', tagline: '农业交易数字平台', home: '返回首页', language: '切换语言', title: '安全恢复 MFA', lead: '一次性链接和当前密码用于确认身份。组织管理员不能单方面禁用 MFA。' },
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
