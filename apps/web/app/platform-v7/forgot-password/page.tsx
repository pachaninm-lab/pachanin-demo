'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import styles from '../recovery.module.css';

export default function ForgotPasswordPage() {
  const t = useTranslations('publicEntry.recovery');
  const locale = useLocale();
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState('');
  const [cooldown, setCooldown] = React.useState(0);
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || cooldown > 0) return;

    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      setError(t('invalidEmail'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, locale }),
        cache: 'no-store',
      });
      if (!response.ok && response.status !== 202) throw new Error('request_failed');
      const payload = await response.json().catch(() => ({} as { cooldownSeconds?: number }));
      setSent(true);
      setCooldown(Math.max(60, Number(payload.cooldownSeconds || 60)));
    } catch {
      setError(t('unavailable'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <PublicSiteHeader
        brand={t('brand')}
        tagline={t('tagline')}
        ariaLabel={t('header')}
        homeAriaLabel={t('home')}
        actions={(
          <Link className='pc-site-action' href='/platform-v7/login' aria-label={t('backToLogin')}>
            <ArrowLeft size={20} aria-hidden='true' />
            <span>{t('back')}</span>
          </Link>
        )}
      />

      <section className={styles.layout} aria-labelledby='forgot-password-title'>
        <div className={styles.card}>
          <span className={styles.icon}><KeyRound size={26} aria-hidden='true' /></span>
          <h1 id='forgot-password-title'>{t('requestTitle')}</h1>
          <p className={styles.lead}>{t('requestLead')}</p>

          <form className={styles.form} onSubmit={submit} noValidate>
            <label>
              <span>{t('email')}</span>
              <div className={styles.field}>
                <Mail size={19} aria-hidden='true' />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type='email'
                  inputMode='email'
                  autoComplete='username'
                  autoCapitalize='none'
                  spellCheck={false}
                  placeholder={t('emailPlaceholder')}
                  disabled={submitting}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'forgot-password-error' : undefined}
                />
              </div>
            </label>

            {sent ? <p className={styles.message} role='status' aria-live='polite'>{t('universalSuccess')}</p> : null}
            {error ? <p ref={errorRef} id='forgot-password-error' className={styles.error} role='alert' aria-live='assertive' tabIndex={-1}>{error}</p> : null}

            <button className={styles.submit} type='submit' disabled={submitting || cooldown > 0} aria-busy={submitting}>
              {submitting ? t('sending') : cooldown > 0 ? t('retryIn', { seconds: cooldown }) : t('sendLink')}
            </button>
          </form>

          <p className={styles.note}>{t('requestNote')}</p>
        </div>
      </section>
    </main>
  );
}
