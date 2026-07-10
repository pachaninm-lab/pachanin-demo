import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { ResetPasswordFormClient, type ResetPasswordCopy } from './ResetPasswordFormClient';

export const metadata: Metadata = {
  title: 'Установить новый пароль',
  robots: { index: false, follow: false, nocache: true },
};

export default async function ResetPasswordPage({ searchParams }: { searchParams?: { token?: string } }) {
  const t = await getTranslations('publicEntry.reset');
  const token = String(searchParams?.token || '').trim().slice(0, 512);
  const copy = {
    newPassword: t('newPassword'),
    newPasswordPlaceholder: t('newPasswordPlaceholder'),
    confirmPassword: t('confirmPassword'),
    confirmPasswordPlaceholder: t('confirmPasswordPlaceholder'),
    showPassword: t('showPassword'),
    hidePassword: t('hidePassword'),
    policy: t('policy'),
    mismatch: t('mismatch'),
    invalid: t('invalid'),
    unavailable: t('unavailable'),
    rateLimited: t('rateLimited'),
    submit: t('submit'),
    loading: t('loading'),
    successTitle: t('successTitle'),
    successText: t('successText'),
    sessionsRevoked: t('sessionsRevoked'),
    backToLogin: t('backToLogin'),
  } satisfies ResetPasswordCopy;

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

      <section className='pc-recovery-shell' aria-labelledby='pc-reset-title'>
        <div className='pc-recovery-heading'>
          <h1 id='pc-reset-title'>{t('title')}</h1>
          <p>{t('lead')}</p>
        </div>
        <ResetPasswordFormClient token={token} copy={copy} />
      </section>
    </main>
  );
}
