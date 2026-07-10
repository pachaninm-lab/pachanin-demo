'use client';

import * as React from 'react';
import { CheckCircle2, Mail } from 'lucide-react';

export type ForgotPasswordCopy = {
  email: string;
  emailPlaceholder: string;
  submit: string;
  loading: string;
  successTitle: string;
  successText: string;
  invalidEmail: string;
  unavailable: string;
  backToLogin: string;
  note: string;
};

export function ForgotPasswordFormClient({ copy, locale }: { copy: ForgotPasswordCopy; locale: 'ru' | 'en' | 'zh' }) {
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState('');
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized) || normalized.length > 254) {
      setError(copy.invalidEmail);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 10_000);
      let response: Response;
      try {
        response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalized, locale }),
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timer);
      }
      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok || payload.accepted !== true) throw new Error('recovery_request_failed');
      setSubmitted(true);
    } catch {
      setError(copy.unavailable);
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
            onChange={(event) => setEmail(event.target.value)}
            type='email'
            inputMode='email'
            autoComplete='email'
            autoCapitalize='none'
            spellCheck={false}
            placeholder={copy.emailPlaceholder}
            disabled={submitting}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'pc-recovery-error' : undefined}
          />
        </span>
      </label>

      {error ? <p ref={errorRef} id='pc-recovery-error' className='pc-recovery-error' role='alert' tabIndex={-1}>{error}</p> : null}

      <button className='pc-recovery-submit' type='submit' disabled={submitting} aria-busy={submitting}>
        {submitting ? copy.loading : copy.submit}
      </button>

      <a className='pc-recovery-login-link' href='/platform-v7/login'>{copy.backToLogin}</a>
      <p className='pc-recovery-note'>{copy.note}</p>
    </form>
  );
}
