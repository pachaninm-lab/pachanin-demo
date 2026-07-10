import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { LoginFormClient, type LoginCopy } from './LoginFormClient';

export default async function LoginPage() {
  const t = await getTranslations('publicEntry.login');
  const copy = {
    title: t('title'),
    mfaTitle: t('mfaTitle'),
    backupCodesTitle: t('backupCodesTitle'),
    lead: t('lead'),
    mfaLead: t('mfaLead'),
    backupCodesLead: t('backupCodesLead'),
    required: t('required'),
    unavailable: t('unavailable'),
    mfaError: t('mfaError'),
    email: t('email'),
    emailPlaceholder: t('emailPlaceholder'),
    password: t('password'),
    passwordPlaceholder: t('passwordPlaceholder'),
    hidePassword: t('hidePassword'),
    showPassword: t('showPassword'),
    forgot: t('forgot'),
    register: t('register'),
    loading: t('loading'),
    submit: t('submit'),
    note: t('note'),
    enrollmentTitle: t('enrollmentTitle'),
    enrollmentLead: t('enrollmentLead'),
    setupSecretLabel: t('setupSecretLabel'),
    mfaCode: t('mfaCode'),
    totpMethod: t('totpMethod'),
    backupMethod: t('backupMethod'),
    mfaCodePlaceholder: t('mfaCodePlaceholder'),
    backupCodePlaceholder: t('backupCodePlaceholder'),
    mfaLoading: t('mfaLoading'),
    mfaSubmit: t('mfaSubmit'),
    mfaBack: t('mfaBack'),
  } satisfies LoginCopy;

  return (
    <main className='pc-v7-public-entry pc-auth-page'>
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
      <LoginFormClient copy={copy} />
    </main>
  );
}
