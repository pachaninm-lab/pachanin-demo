'use client';

import * as React from 'react';
import { CheckCircle2, Mail } from 'lucide-react';

export type ForgotPasswordCopy = {
  error: string;
  requestName: string;
  requestMessage: string;
  successTitle: string;
  successText: string;
  backToLogin: string;
  email: string;
  emailPlaceholder: string;
  loading: string;
  submit: string;
  note: string;
};

type RecoveryResponse = {
  accepted?: boolean;
  code?: string;
  correlationId?: string;
};

function currentLocale() {
  const value = document.documentElement.lang.toLowerCase();
  return value.startsWith('zh') ? 'zh' : value.startsWith('en') ? 'en' : 'ru';
}

export function ForgotPasswordFormClient({ copy }: { copy: ForgotPasswordCopy }) {
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState('');
  const [correlationId, setCorrelationId] = React.useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(copy.error);
      return;
    }

    setSubmitting(true);
    setError('');
    setCorrelationId('');

    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 10_000);
      let response: Response;
      try {
        response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, locale: currentLocale() }),
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timer);
      }

      const payload = await response.json().catch(() => ({} as RecoveryResponse)) as RecoveryResponse;
      setCorrelationId(String(payload.correlationId || ''));
      if (!response.ok || payload.accepted !== true) throw new Error('recovery_request_failed');
      setSubmitted(true);
      setEmail('');
    } catch {
      setError(copy.error);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className='pc-recovery-card pc-recovery-success' aria-live='polite'>
        <CheckCircle2 size={42} strokeWidth={1.9} aria-hidden='true' />
        <h2>{copy.successTitle}</h2>
        <p>{copy.successText}</p>
        {correlationId ? <p className='pc-recovery-note'>ID: {correlationId}</p> : null}
        <a className='pc-recovery-primary-link' href='/platform-v7/login'>{copy.backToLogin}</a>
      </section>
    );
  }

  return (
    <form className='pc-recovery-card' onSubmit={onSubmit} noValidate>
      <label className='pc-recovery-label'>
        <span>{copy.email}</span>
        <span className='pc-recovery-field'>
          <Mail size={19} aria-hidden='true' />
          <input
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError('');
            }}
            type='email'
            inputMode='email'
            autoComplete='email'
            autoCapitalize='none'
            spellCheck={false}
            maxLength={254}
            required
            placeholder={copy.emailPlaceholder}
            disabled={submitting}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'pc-recovery-error' : undefined}
          />
        </span>
      </label>

      {error ? (
        <p id='pc-recovery-error' className='pc-recovery-error' role='alert'>
          {error}{correlationId ? ` ID: ${correlationId}` : ''}
        </p>
      ) : null}

      <button className='pc-recovery-submit' type='submit' disabled={submitting} aria-busy={submitting}>
        {submitting ? copy.loading : copy.submit}
      </button>

      <a className='pc-recovery-login-link' href='/platform-v7/login'>{copy.backToLogin}</a>
      <p className='pc-recovery-note'>{copy.note}</p>
    </form>
  );
}
