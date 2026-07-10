import { ArrowLeft } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { isAppLocale, type AppLocale } from '@/i18n/locale';
import { ForgotPasswordFormClient, type ForgotPasswordCopy } from './ForgotPasswordFormClient';

export default async function ForgotPasswordPage() {
  const t = await getTranslations('publicEntry.forgot');
  const localeValue = await getLocale();
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : 'ru';
  const copy = {
    email: t('email'),
    emailPlaceholder: t('emailPlaceholder'),
    submit: t('submit'),
    loading: t('loading'),
    successTitle: t('successTitle'),
    successText: t('successText'),
    invalidEmail: t('invalidEmail'),
    unavailable: t('unavailable'),
    backToLogin: t('backToLogin'),
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
        <ForgotPasswordFormClient copy={copy} locale={locale} />
      </section>
    </main>
  );
}
