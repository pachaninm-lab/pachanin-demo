import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { LoginFormClient, type LoginCopy } from './LoginFormClient';

export default async function LoginPage() {
  const t = await getTranslations('publicEntry.login');
  const chrome = await getTranslations('publicEntry.chrome');
  const copy = {
    title: t('title'),
    mfaTitle: t('mfaTitle'),
    backupCodesTitle: t('backupCodesTitle'),
    lead: t('lead'),
    mfaLead: t('mfaLead'),
    backupCodesLead: t('backupCodesLead'),
    secureEyebrow: t('secureEyebrow'),
    assuranceRole: t('assuranceRole'),
    assuranceMfa: t('assuranceMfa'),
    assuranceAudit: t('assuranceAudit'),
    required: t('required'),
    invalidEmail: t('invalidEmail'),
    unavailable: t('unavailable'),
    capsLock: t('capsLock'),
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
    <main id='main-content' className='pc-v7-public-entry pc-auth-page pc-auth-world-class'>
      <a className='pc-skip-link' href='#pc-login-title'>{chrome('skipToContent')}</a>
      <PublicSiteHeader
        ariaLabel={t('publicNav')}
        tagline={t('brandTagline')}
        brandHomeLabel={chrome('brandHomeLabel')}
        navLabel={chrome('navLabel')}
        menuLabel={chrome('menuLabel')}
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
