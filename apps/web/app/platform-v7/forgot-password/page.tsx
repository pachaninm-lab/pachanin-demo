import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-auth.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-webkit-safe.css';
import { ArrowLeft, ScrollText, ShieldCheck, UserCheck } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { ForgotPasswordFormClient, type ForgotPasswordCopy } from './ForgotPasswordFormClient';

type RecoveryLocale = 'ru' | 'en' | 'zh';

const RECOVERY_ASSURANCE: Record<RecoveryLocale, {
  trustLabel: string;
  identityChecked: string;
  noAccountLeak: string;
  audited: string;
  serviceNote: string;
}> = {
  ru: {
    trustLabel: 'Безопасное восстановление',
    identityChecked: 'Доступ восстанавливается после проверки владельца',
    noAccountLeak: 'Наличие учётной записи не раскрывается',
    audited: 'Все запросы восстановления журналируются',
    serviceNote: 'Рабочая платформа исполнения зерновой сделки',
  },
  en: {
    trustLabel: 'Secure recovery',
    identityChecked: 'Access is restored only after owner verification',
    noAccountLeak: 'Whether an account exists is never disclosed',
    audited: 'Every recovery request is logged',
    serviceNote: 'Working platform for grain deal execution',
  },
  zh: {
    trustLabel: '安全找回',
    identityChecked: '仅在验证持有人后才恢复访问',
    noAccountLeak: '不会透露账户是否存在',
    audited: '每次找回请求均被记录',
    serviceNote: '粮食交易执行工作平台',
  },
};

function resolveRecoveryLocale(locale: string): RecoveryLocale {
  return locale === 'en' || locale === 'zh' ? locale : 'ru';
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('publicEntry.forgot');
  const locale = await getLocale();
  const assurance = RECOVERY_ASSURANCE[resolveRecoveryLocale(locale)];
  const buildStamp = (process.env.NEXT_PUBLIC_BUILD_ID || 'runtime').slice(0, 12);
  const year = new Date().getUTCFullYear();
  const copy = {
    error: t('error'),
    requestName: t('requestName'),
    requestMessage: t('requestMessage'),
    successTitle: t('successTitle'),
    successText: t('successText'),
    backToLogin: t('backToLogin'),
    email: t('email'),
    emailPlaceholder: t('emailPlaceholder'),
    loading: t('loading'),
    submit: t('submit'),
    note: t('note'),
  } satisfies ForgotPasswordCopy;

  return (
    <main className='pc-v7-public-entry pc-recovery-page'>
      <PublicSiteHeader
        ariaLabel={t('publicNav')}
        tagline={t('brandTagline')}
        localeControl={<PublicLocaleLink />}
        actions={(
          <a className='pc-site-action' href='/platform-v7' aria-label={t('backHome')} title={t('backHome')}>
            <ArrowLeft size={20} aria-hidden='true' />
            <span>{t('backHome')}</span>
          </a>
        )}
      />

      <section className='pc-recovery-shell' aria-labelledby='pc-recovery-title'>
        <div className='pc-recovery-heading'>
          <h1 id='pc-recovery-title'>{t('title')}</h1>
          <p>{t('lead')}</p>
        </div>
        <ForgotPasswordFormClient copy={copy} />
      </section>

      <div className='pc-auth-extras'>
        <aside className='pc-auth-trust' aria-label={assurance.trustLabel}>
          <span className='pc-auth-trust-title'>{assurance.trustLabel}</span>
          <ul>
            <li>
              <UserCheck size={18} aria-hidden='true' />
              <span>{assurance.identityChecked}</span>
            </li>
            <li>
              <ShieldCheck size={18} aria-hidden='true' />
              <span>{assurance.noAccountLeak}</span>
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
