'use client';

import * as React from 'react';
import { CheckCircle2, Eye, EyeOff, LockKeyhole } from 'lucide-react';

export type ResetPasswordCopy = {
  newPassword: string;
  newPasswordPlaceholder: string;
  confirmPassword: string;
  confirmPasswordPlaceholder: string;
  showPassword: string;
  hidePassword: string;
  policy: string;
  mismatch: string;
  invalid: string;
  unavailable: string;
  rateLimited: string;
  submit: string;
  loading: string;
  successTitle: string;
  successText: string;
  sessionsRevoked: string;
  backToLogin: string;
};

function meetsPolicy(password: string) {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  return password.length >= 12 && password.length <= 128 && classes >= 3;
}

export function ResetPasswordFormClient({ token, copy }: { token: string; copy: ResetPasswordCopy }) {
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const [error, setError] = React.useState(token ? '' : copy.invalid);
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !token) return;
    if (!meetsPolicy(password)) {
      setError(copy.policy);
      return;
    }
    if (password !== confirm) {
      setError(copy.mismatch);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 10_000);
      let response: Response;
      try {
        response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword: password }),
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timer);
      }
      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok || payload.ok !== true) {
        if (payload.code === 'RATE_LIMITED') throw new Error('RATE_LIMITED');
        if (payload.code === 'AUTH_SERVICE_UNAVAILABLE') throw new Error('UNAVAILABLE');
        throw new Error('INVALID');
      }
      setPassword('');
      setConfirm('');
      setCompleted(true);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'UNAVAILABLE';
      setError(reason === 'RATE_LIMITED' ? copy.rateLimited : reason === 'INVALID' ? copy.invalid : copy.unavailable);
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <section className='pc-recovery-card pc-recovery-success' aria-live='polite'>
        <CheckCircle2 size={42} strokeWidth={1.9} aria-hidden='true' />
        <h2>{copy.successTitle}</h2>
        <p>{copy.successText}</p>
        <p>{copy.sessionsRevoked}</p>
        <a className='pc-recovery-primary-link' href='/platform-v7/login'>{copy.backToLogin}</a>
      </section>
    );
  }

  return (
    <form className='pc-recovery-card' onSubmit={onSubmit} noValidate>
      <label className='pc-recovery-label'>
        <span>{copy.newPassword}</span>
        <span className='pc-recovery-field'>
          <LockKeyhole size={19} aria-hidden='true' />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? 'text' : 'password'}
            autoComplete='new-password'
            autoCapitalize='none'
            spellCheck={false}
            placeholder={copy.newPasswordPlaceholder}
            disabled={submitting || !token}
            aria-invalid={Boolean(error)}
            aria-describedby='pc-reset-policy pc-reset-error'
          />
          <button
            type='button'
            className='pc-auth-password-toggle'
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? copy.hidePassword : copy.showPassword}
            title={showPassword ? copy.hidePassword : copy.showPassword}
          >
            {showPassword ? <EyeOff size={19} aria-hidden='true' /> : <Eye size={19} aria-hidden='true' />}
          </button>
        </span>
      </label>

      <label className='pc-recovery-label'>
        <span>{copy.confirmPassword}</span>
        <span className='pc-recovery-field'>
          <LockKeyhole size={19} aria-hidden='true' />
          <input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            type={showPassword ? 'text' : 'password'}
            autoComplete='new-password'
            autoCapitalize='none'
            spellCheck={false}
            placeholder={copy.confirmPasswordPlaceholder}
            disabled={submitting || !token}
            aria-invalid={Boolean(error)}
            aria-describedby='pc-reset-policy pc-reset-error'
          />
        </span>
      </label>

      <p id='pc-reset-policy' className='pc-recovery-note'>{copy.policy}</p>
      {error ? <p ref={errorRef} id='pc-reset-error' className='pc-recovery-error' role='alert' tabIndex={-1}>{error}</p> : null}

      <button className='pc-recovery-submit' type='submit' disabled={submitting || !token} aria-busy={submitting}>
        {submitting ? copy.loading : copy.submit}
      </button>
      <a className='pc-recovery-login-link' href='/platform-v7/login'>{copy.backToLogin}</a>
    </form>
  );
}
