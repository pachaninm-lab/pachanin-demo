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

export function ForgotPasswordFormClient({ copy }: { copy: ForgotPasswordCopy }) {
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const contact = email.trim();
    if (!contact) {
      setError(copy.error);
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
          name: copy.requestName,
          organization: '',
          contact,
          message: copy.requestMessage,
          consent: 'yes',
          website: '',
        }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.accepted !== true) throw new Error('recovery_request_failed');
      setSubmitted(true);
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
            placeholder={copy.emailPlaceholder}
            disabled={submitting}
            aria-invalid={Boolean(error)}
          />
        </span>
      </label>

      {error ? <p className='pc-recovery-error' role='alert'>{error}</p> : null}

      <button className='pc-recovery-submit' type='submit' disabled={submitting} aria-busy={submitting}>
        {submitting ? copy.loading : copy.submit}
      </button>

      <a className='pc-recovery-login-link' href='/platform-v7/login'>{copy.backToLogin}</a>
      <p className='pc-recovery-note'>{copy.note}</p>
    </form>
  );
}
