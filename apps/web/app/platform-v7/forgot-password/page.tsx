import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-auth.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-webkit-safe.css';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { ForgotPasswordFormClient, type ForgotPasswordCopy } from './ForgotPasswordFormClient';

export default async function ForgotPasswordPage() {
  const t = await getTranslations('publicEntry.forgot');
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
    </main>
  );
}
