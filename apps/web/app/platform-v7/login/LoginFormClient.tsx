'use client';

import * as React from 'react';
import { Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

type LoginStep = 'password' | 'mfa' | 'backup-codes';
type MfaMethod = 'totp' | 'backup_code';

type LoginResponse = {
  ok?: boolean;
  mfaRequired?: boolean;
  redirectTo?: string;
  methods?: MfaMethod[];
  enrollmentRequired?: boolean;
  setupSecret?: string | null;
  backupCodes?: string[];
};

export type LoginCopy = {
  title: string;
  mfaTitle: string;
  backupCodesTitle: string;
  lead: string;
  mfaLead: string;
  backupCodesLead: string;
  required: string;
  unavailable: string;
  mfaError: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  hidePassword: string;
  showPassword: string;
  forgot: string;
  register: string;
  loading: string;
  submit: string;
  note: string;
  enrollmentTitle: string;
  enrollmentLead: string;
  setupSecretLabel: string;
  mfaCode: string;
  totpMethod: string;
  backupMethod: string;
  mfaCodePlaceholder: string;
  backupCodePlaceholder: string;
  mfaLoading: string;
  mfaSubmit: string;
  mfaBack: string;
};

async function requestJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const payload = await response.json().catch(() => ({})) as LoginResponse;
    return { response, payload };
  } finally {
    window.clearTimeout(timer);
  }
}

export function LoginFormClient({ copy }: { copy: LoginCopy }) {
  const [step, setStep] = React.useState<LoginStep>('password');
  const [method, setMethod] = React.useState<MfaMethod>('totp');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [code, setCode] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [setupSecret, setSetupSecret] = React.useState('');
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [redirectTo, setRedirectTo] = React.useState('');
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const codeRef = React.useRef<HTMLInputElement>(null);
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  React.useEffect(() => {
    if (step === 'mfa') codeRef.current?.focus();
  }, [step, method]);

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(copy.required);
      emailRef.current?.focus();
      return;
    }
    if (!password) {
      setError(copy.required);
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { response, payload } = await requestJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      if (!response.ok || !payload.ok) throw new Error('login_failed');

      if (payload.mfaRequired) {
        setSetupSecret(payload.enrollmentRequired ? String(payload.setupSecret || '') : '');
        setMethod('totp');
        setCode('');
        setPassword('');
        setStep('mfa');
        return;
      }

      if (!payload.redirectTo?.startsWith('/platform-v7/')) throw new Error('invalid_redirect');
      globalThis.location.assign(payload.redirectTo);
    } catch {
      setError(copy.unavailable);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setError(copy.mfaError);
      codeRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { response, payload } = await requestJson('/api/auth/mfa-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode, method }),
      });
      if (!response.ok || !payload.ok || !payload.redirectTo?.startsWith('/platform-v7/')) {
        throw new Error('mfa_failed');
      }

      if (Array.isArray(payload.backupCodes) && payload.backupCodes.length > 0) {
        setBackupCodes(payload.backupCodes);
        setRedirectTo(payload.redirectTo);
        setStep('backup-codes');
        return;
      }
      globalThis.location.assign(payload.redirectTo);
    } catch {
      setError(copy.mfaError);
    } finally {
      setSubmitting(false);
    }
  }

  async function returnToPassword() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/auth/mfa-login/cancel', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
      });
    } finally {
      setStep('password');
      setMethod('totp');
      setCode('');
      setSetupSecret('');
      setError('');
      setSubmitting(false);
      window.setTimeout(() => emailRef.current?.focus(), 0);
    }
  }

  return (
    <section className='pc-auth-shell' aria-labelledby='pc-login-title'>
      <div className='pc-auth-heading'>
        <h1 id='pc-login-title'>
          {step === 'password' ? copy.title : step === 'mfa' ? copy.mfaTitle : copy.backupCodesTitle}
        </h1>
        <p>{step === 'password' ? copy.lead : step === 'mfa' ? copy.mfaLead : copy.backupCodesLead}</p>
      </div>

      {step === 'password' ? (
        <form className='pc-auth-card' onSubmit={submitPassword} noValidate>
          <label className='pc-auth-label'>
            <span>{copy.email}</span>
            <span className='pc-auth-field'>
              <Mail size={19} aria-hidden='true' />
              <input
                ref={emailRef}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type='email'
                inputMode='email'
                autoComplete='username'
                autoCapitalize='none'
                spellCheck={false}
                placeholder={copy.emailPlaceholder}
                disabled={submitting}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'pc-auth-error' : undefined}
              />
            </span>
          </label>

          <label className='pc-auth-label'>
            <span>{copy.password}</span>
            <span className='pc-auth-field'>
              <LockKeyhole size={19} aria-hidden='true' />
              <input
                ref={passwordRef}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete='current-password'
                autoCapitalize='none'
                spellCheck={false}
                placeholder={copy.passwordPlaceholder}
                disabled={submitting}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'pc-auth-error' : undefined}
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

          <div className='pc-auth-links'>
            <a href='/platform-v7/forgot-password'>{copy.forgot}</a>
            <a href='/platform-v7/register'>{copy.register}</a>
          </div>

          {error ? <p ref={errorRef} id='pc-auth-error' className='pc-auth-error' role='alert' tabIndex={-1}>{error}</p> : null}

          <button className='pc-auth-submit' type='submit' disabled={submitting} aria-busy={submitting}>
            {submitting ? copy.loading : copy.submit}
          </button>
          <p className='pc-auth-note'>{copy.note}</p>
        </form>
      ) : null}

      {step === 'mfa' ? (
        <form className='pc-auth-card' onSubmit={submitMfa} noValidate>
          {setupSecret ? (
            <section className='pc-auth-enrollment' aria-labelledby='pc-auth-enrollment-title'>
              <ShieldCheck size={24} aria-hidden='true' />
              <div>
                <h2 id='pc-auth-enrollment-title'>{copy.enrollmentTitle}</h2>
                <p>{copy.enrollmentLead}</p>
                <span>{copy.setupSecretLabel}</span>
                <code>{setupSecret}</code>
              </div>
            </section>
          ) : null}

          <div className='pc-auth-methods' role='group' aria-label={copy.mfaCode}>
            <button type='button' aria-pressed={method === 'totp'} onClick={() => { setMethod('totp'); setCode(''); setError(''); }}>
              <ShieldCheck size={18} aria-hidden='true' />{copy.totpMethod}
            </button>
            <button type='button' aria-pressed={method === 'backup_code'} onClick={() => { setMethod('backup_code'); setCode(''); setError(''); }}>
              <KeyRound size={18} aria-hidden='true' />{copy.backupMethod}
            </button>
          </div>

          <label className='pc-auth-label'>
            <span>{copy.mfaCode}</span>
            <span className='pc-auth-field'>
              <KeyRound size={19} aria-hidden='true' />
              <input
                ref={codeRef}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                type='text'
                inputMode={method === 'totp' ? 'numeric' : 'text'}
                autoComplete={method === 'totp' ? 'one-time-code' : 'off'}
                autoCapitalize='characters'
                spellCheck={false}
                placeholder={method === 'totp' ? copy.mfaCodePlaceholder : copy.backupCodePlaceholder}
                disabled={submitting}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'pc-auth-error' : undefined}
              />
            </span>
          </label>

          {error ? <p ref={errorRef} id='pc-auth-error' className='pc-auth-error' role='alert' tabIndex={-1}>{error}</p> : null}

          <button className='pc-auth-submit' type='submit' disabled={submitting} aria-busy={submitting}>
            {submitting ? copy.mfaLoading : copy.mfaSubmit}
          </button>
          <button className='pc-auth-secondary' type='button' onClick={returnToPassword} disabled={submitting}>{copy.mfaBack}</button>
        </form>
      ) : null}

      {step === 'backup-codes' ? (
        <section className='pc-auth-card pc-auth-backup-codes' aria-live='polite'>
          <ShieldCheck size={36} aria-hidden='true' />
          <div className='pc-auth-code-grid'>{backupCodes.map((item) => <code key={item}>{item}</code>)}</div>
          <button className='pc-auth-submit' type='button' onClick={() => globalThis.location.assign(redirectTo)}>{copy.submit}</button>
        </section>
      ) : null}
    </section>
  );
}
