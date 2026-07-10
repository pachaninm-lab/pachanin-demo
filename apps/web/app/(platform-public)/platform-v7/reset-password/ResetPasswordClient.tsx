'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { postPublicJson } from '@/lib/client/public-request';
import styles from '../../../platform-v7/recovery.module.css';

const RESET_TIMEOUT_MS = 12_000;

type ResetPayload = { code?: string; success?: boolean; sessionsRevoked?: boolean };
type FocusTarget = 'password' | 'confirm' | 'alert';
type ErrorField = 'password' | 'confirm' | null;

function meetsPolicy(password: string) {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  return password.length >= 12 && password.length <= 128 && classes >= 3;
}

export function ResetPasswordClient({ token }: { token: string }) {
  const t = useTranslations('publicEntry.recovery');
  const loginT = useTranslations('publicEntry.login');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState('');
  const [errorField, setErrorField] = React.useState<ErrorField>(null);
  const [focusTarget, setFocusTarget] = React.useState<FocusTarget | null>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const confirmRef = React.useRef<HTMLInputElement>(null);
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (!error || !focusTarget) return;
    const target = focusTarget === 'password'
      ? passwordRef.current
      : focusTarget === 'confirm'
        ? confirmRef.current
        : errorRef.current;
    target?.focus();
    setFocusTarget(null);
  }, [error, focusTarget]);

  React.useEffect(() => {
    if (!token && !success) errorRef.current?.focus();
  }, [token, success]);

  function showError(message: string, target: FocusTarget, field: ErrorField = null) {
    setError(message);
    setErrorField(field);
    setFocusTarget(target);
  }

  function networkMessage(code: string) {
    if (code === 'REQUEST_TIMEOUT') return loginT('timeout');
    if (code === 'NETWORK_OFFLINE') return loginT('offline');
    if (code === 'NETWORK_ERROR') return loginT('networkError');
    if (code === 'AUTH_SERVICE_UNAVAILABLE') return loginT('serviceUnavailable');
    return t('invalidLink');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || success) return;

    if (!token) {
      showError(t('invalidLink'), 'alert');
      return;
    }
    if (!meetsPolicy(password)) {
      showError(t('passwordPolicyError'), 'password', 'password');
      return;
    }
    if (password !== confirmPassword) {
      showError(t('passwordMismatch'), 'confirm', 'confirm');
      return;
    }

    setSubmitting(true);
    setError('');
    setErrorField(null);
    setFocusTarget(null);
    try {
      const { response, payload } = await postPublicJson<ResetPayload>(
        '/api/auth/reset-password',
        { token, newPassword: password },
        RESET_TIMEOUT_MS,
      );
      if (!response.ok || !payload.success) {
        const code = String(payload.code || 'PASSWORD_RESET_INVALID');
        if (code === 'PASSWORD_POLICY_FAILED') throw new Error('PASSWORD_POLICY_FAILED');
        throw new Error(code);
      }
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : 'PASSWORD_RESET_INVALID';
      if (code === 'PASSWORD_POLICY_FAILED') showError(t('passwordPolicyError'), 'password', 'password');
      else showError(networkMessage(code), 'alert');
    } finally {
      setSubmitting(false);
    }
  }

  const passwordDescribedBy = errorField === 'password'
    ? 'reset-password-error password-requirements'
    : 'password-requirements';
  const confirmDescribedBy = errorField === 'confirm'
    ? 'reset-password-error password-requirements'
    : 'password-requirements';

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
                  <input
                    ref={passwordRef}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete='new-password'
                    disabled={submitting}
                    aria-invalid={errorField === 'password'}
                    aria-describedby={passwordDescribedBy}
                  />
                  <button type='button' onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('hidePassword') : t('showPassword')}>
                    {showPassword ? <EyeOff size={19} aria-hidden='true' /> : <Eye size={19} aria-hidden='true' />}
                  </button>
                </div>
              </label>
              <label>
                <span>{t('confirmPassword')}</span>
                <div className={styles.field}>
                  <LockKeyhole size={19} aria-hidden='true' />
                  <input
                    ref={confirmRef}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete='new-password'
                    disabled={submitting}
                    aria-invalid={errorField === 'confirm'}
                    aria-describedby={confirmDescribedBy}
                  />
                </div>
              </label>
              <ul id='password-requirements' className={styles.requirements}>
                <li>{t('passwordLength')}</li><li>{t('passwordClasses')}</li>
              </ul>
              {!token && !error ? <p ref={errorRef} id='reset-password-error' className={styles.error} role='alert' tabIndex={-1}>{t('invalidLink')}</p> : null}
              {error ? <p ref={errorRef} id='reset-password-error' className={styles.error} role='alert' aria-live='assertive' tabIndex={-1}>{error}</p> : null}
              <button className={styles.submit} type='submit' disabled={submitting || !token} aria-busy={submitting}>{submitting ? t('saving') : t('savePassword')}</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
