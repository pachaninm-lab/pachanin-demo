'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';

export default function ForgotPasswordPage() {
  const t = useTranslations('publicEntry.forgot');
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const contact = email.trim();
    if (!contact) {
      setError(t('error'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/platform-v7/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'technical',
          source: 'platform_v7_contact_page',
          name: t('requestName'),
          organization: '',
          contact,
          message: t('requestMessage'),
          consent: 'yes',
          website: '',
        }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.accepted !== true) throw new Error('recovery_request_failed');
      setSubmitted(true);
    } catch {
      setError(t('error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className='pc-v7-public-entry pc-recovery-page'>
      <PublicSiteHeader
        ariaLabel={t('publicNav')}
        tagline={t('brandTagline')}
        actions={(
          <Link className='pc-site-action' href='/platform-v7' aria-label={t('backHome')} title={t('backHome')}>
            <ArrowLeft size={20} aria-hidden='true' />
            <span>{t('backHome')}</span>
          </Link>
        )}
      />

      <section className='pc-recovery-shell' aria-labelledby='pc-recovery-title'>
        <div className='pc-recovery-heading'>
          <h1 id='pc-recovery-title'>{t('title')}</h1>
          <p>{t('lead')}</p>
        </div>

        {submitted ? (
          <section className='pc-recovery-card pc-recovery-success' aria-live='polite'>
            <CheckCircle2 size={42} strokeWidth={1.9} aria-hidden='true' />
            <h2>{t('successTitle')}</h2>
            <p>{t('successText')}</p>
            <Link className='pc-recovery-primary-link' href='/platform-v7/login'>{t('backToLogin')}</Link>
          </section>
        ) : (
          <form className='pc-recovery-card' onSubmit={onSubmit} noValidate>
            <label className='pc-recovery-label'>
              <span>{t('email')}</span>
              <span className='pc-recovery-field'>
                <Mail size={19} aria-hidden='true' />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type='email'
                  inputMode='email'
                  autoComplete='email'
                  placeholder={t('emailPlaceholder')}
                  disabled={submitting}
                  aria-invalid={Boolean(error)}
                />
              </span>
            </label>

            {error ? <p className='pc-recovery-error' role='alert'>{error}</p> : null}

            <button className='pc-recovery-submit' type='submit' disabled={submitting}>
              {submitting ? t('loading') : t('submit')}
            </button>

            <Link className='pc-recovery-login-link' href='/platform-v7/login'>{t('backToLogin')}</Link>
            <p className='pc-recovery-note'>{t('note')}</p>
          </form>
        )}
      </section>
    </main>
  );
}
