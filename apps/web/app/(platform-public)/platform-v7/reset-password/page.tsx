'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import styles from '../../../platform-v7/recovery.module.css';

function meetsPolicy(password: string) {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  return password.length >= 12 && password.length <= 128 && classes >= 3;
}

export default function ResetPasswordPage() {
  const t = useTranslations('publicEntry.recovery');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState('');
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || success) return;

    if (!token) return setError(t('invalidLink'));
    if (!meetsPolicy(password)) return setError(t('passwordPolicyError'));
    if (password !== confirmPassword) return setError(t('passwordMismatch'));

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({} as { code?: string; success?: boolean }));
      if (!response.ok || !payload.success) {
        const code = String(payload.code || 'PASSWORD_RESET_INVALID');
        if (code === 'PASSWORD_POLICY_FAILED') throw new Error('policy');
        if (code === 'AUTH_SERVICE_UNAVAILABLE') throw new Error('unavailable');
        throw new Error('invalid');
      }
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : 'invalid';
      setError(code === 'policy' ? t('passwordPolicyError') : code === 'unavailable' ? t('unavailable') : t('invalidLink'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <PublicSiteHeader brand={t('brand')} tagline={t('tagline')} ariaLabel={t('header')} homeAriaLabel={t('home')} actions={(
        <Link className='pc-site-action' href='/platform-v7/login' aria-label={t('backToLogin')}>
          <ArrowLeft size={20} aria-hidden='true' /><span>{t('back')}</span>
        </Link>
      )} />
      <section className={styles.layout} aria-labelledby='reset-password-title'>
        <div className={styles.card}>
          <span className={styles.icon}>{success ? <CheckCircle2 size={27} aria-hidden='true' /> : <LockKeyhole size={26} aria-hidden='true' />}</span>
          <h1 id='reset-password-title'>{success ? t('completedTitle') : t('resetTitle')}</h1>
          <p className={styles.lead}>{success ? t('completedLead') : t('resetLead')}</p>
          {success ? (
            <div className={styles.actions}>
              <p className={styles.message} role='status' aria-live='polite'>{t('sessionsRevoked')}</p>
              <Link className={styles.secondary} href='/platform-v7/login'>{t('signIn')}</Link>
            </div>
          ) : (
            <form className={styles.form} onSubmit={submit} noValidate>
              <label>
                <span>{t('newPassword')}</span>
                <div className={styles.field}>
                  <LockKeyhole size={19} aria-hidden='true' />
                  <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete='new-password' disabled={submitting} aria-invalid={Boolean(error)} aria-describedby='password-requirements' />
                  <button type='button' onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('hidePassword') : t('showPassword')}>
                    {showPassword ? <EyeOff size={19} aria-hidden='true' /> : <Eye size={19} aria-hidden='true' />}
                  </button>
                </div>
              </label>
              <label>
                <span>{t('confirmPassword')}</span>
                <div className={styles.field}>
                  <LockKeyhole size={19} aria-hidden='true' />
                  <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete='new-password' disabled={submitting} aria-invalid={Boolean(error)} aria-describedby={error ? 'reset-password-error password-requirements' : 'password-requirements'} />
                </div>
              </label>
              <ul id='password-requirements' className={styles.requirements}>
                <li>{t('passwordLength')}</li><li>{t('passwordClasses')}</li>
              </ul>
              {!token ? <p className={styles.error} role='alert'>{t('invalidLink')}</p> : null}
              {error ? <p ref={errorRef} id='reset-password-error' className={styles.error} role='alert' aria-live='assertive' tabIndex={-1}>{error}</p> : null}
              <button className={styles.submit} type='submit' disabled={submitting || !token} aria-busy={submitting}>{submitting ? t('saving') : t('savePassword')}</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
