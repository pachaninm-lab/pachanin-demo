'use client';

import * as React from 'react';
import {
  Building2,
  Eye,
  EyeOff,
  History,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';

type LoginStep = 'password' | 'mfa' | 'backup-codes';
type MfaMethod = 'totp' | 'backup_code';
type ErrorField = 'email' | 'password' | 'code' | 'form' | null;

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
  secureEyebrow: string;
  assuranceRole: string;
  assuranceMfa: string;
  assuranceAudit: string;
  required: string;
  invalidEmail: string;
  unavailable: string;
  capsLock: string;
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
  const [capsLock, setCapsLock] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [errorField, setErrorField] = React.useState<ErrorField>(null);
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

  function clearErrorFor(field: Exclude<ErrorField, null>) {
    if (errorField === field || errorField === 'form') {
      setError('');
      setErrorField(null);
    }
  }

  function fail(message: string, field: Exclude<ErrorField, null>, target?: HTMLInputElement | null) {
    setError(message);
    setErrorField(field);
    target?.focus();
  }

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      fail(copy.required, 'email', emailRef.current);
      return;
    }
    if (emailRef.current && !emailRef.current.validity.valid) {
      fail(copy.invalidEmail, 'email', emailRef.current);
      return;
    }
    if (!password) {
      fail(copy.required, 'password', passwordRef.current);
      return;
    }

    setSubmitting(true);
    setError('');
    setErrorField(null);
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
        setCapsLock(false);
        setStep('mfa');
        return;
      }

      if (!payload.redirectTo?.startsWith('/platform-v7/')) throw new Error('invalid_redirect');
      globalThis.location.assign(payload.redirectTo);
    } catch {
      fail(copy.unavailable, 'form');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const normalizedCode = code.trim();
    if (!normalizedCode || (method === 'totp' && !/^\d{6}$/.test(normalizedCode))) {
      fail(copy.mfaError, 'code', codeRef.current);
      return;
    }

    setSubmitting(true);
    setError('');
    setErrorField(null);
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
      fail(copy.mfaError, 'code', codeRef.current);
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
      setErrorField(null);
      setSubmitting(false);
      window.setTimeout(() => emailRef.current?.focus(), 0);
    }
  }

  function updateCode(value: string) {
    const normalized = method === 'totp'
      ? value.replace(/\D/g, '').slice(0, 6)
      : value.toUpperCase().replace(/\s/g, '').slice(0, 64);
    setCode(normalized);
    clearErrorFor('code');
  }

  const statusText = submitting
    ? (step === 'mfa' ? copy.mfaLoading : copy.loading)
    : '';

  return (
    <section className='pc-auth-shell' aria-labelledby='pc-login-title' data-step={step}>
      <div className='pc-auth-heading'>
        <span className='pc-auth-eyebrow'><ShieldCheck size={16} aria-hidden='true' />{copy.secureEyebrow}</span>
        <h1 id='pc-login-title'>
          {step === 'password' ? copy.title : step === 'mfa' ? copy.mfaTitle : copy.backupCodesTitle}
        </h1>
        <p>{step === 'password' ? copy.lead : step === 'mfa' ? copy.mfaLead : copy.backupCodesLead}</p>
      </div>

      {step === 'password' ? (
        <div className='pc-auth-assurance' aria-label={copy.secureEyebrow}>
          <span><Building2 size={17} aria-hidden='true' />{copy.assuranceRole}</span>
          <span><ShieldCheck size={17} aria-hidden='true' />{copy.assuranceMfa}</span>
          <span><History size={17} aria-hidden='true' />{copy.assuranceAudit}</span>
        </div>
      ) : null}

      <p className='pc-auth-live-status' role='status' aria-live='polite' aria-atomic='true'>{statusText}</p>

      {step === 'password' ? (
        <form className='pc-auth-card' onSubmit={submitPassword} noValidate aria-describedby='pc-auth-note'>
          <label className='pc-auth-label' htmlFor='pc-auth-email'>
            <span>{copy.email}</span>
            <span className='pc-auth-field'>
              <Mail size={19} aria-hidden='true' />
              <input
                id='pc-auth-email'
                name='email'
                ref={emailRef}
                value={email}
                onChange={(event) => { setEmail(event.target.value); clearErrorFor('email'); }}
                type='email'
                inputMode='email'
                autoComplete='username'
                autoCapitalize='none'
                spellCheck={false}
                required
                maxLength={254}
                enterKeyHint='next'
                autoFocus
                disabled={submitting}
                aria-invalid={errorField === 'email'}
                aria-errormessage={errorField === 'email' ? 'pc-auth-error' : undefined}
              />
            </span>
          </label>

          <label className='pc-auth-label' htmlFor='pc-auth-password'>
            <span>{copy.password}</span>
            <span className='pc-auth-field'>
              <LockKeyhole size={19} aria-hidden='true' />
              <input
                id='pc-auth-password'
                name='password'
                ref={passwordRef}
                value={password}
                onChange={(event) => { setPassword(event.target.value); clearErrorFor('password'); }}
                onKeyDown={(event) => setCapsLock(event.getModifierState('CapsLock'))}
                onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
                onBlur={() => setCapsLock(false)}
                type={showPassword ? 'text' : 'password'}
                autoComplete='current-password'
                autoCapitalize='none'
                spellCheck={false}
                required
                maxLength={256}
                enterKeyHint='go'
                disabled={submitting}
                aria-invalid={errorField === 'password'}
                aria-errormessage={errorField === 'password' ? 'pc-auth-error' : undefined}
              />
              <button
                type='button'
                className='pc-auth-password-toggle'
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                title={showPassword ? copy.hidePassword : copy.showPassword}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={19} aria-hidden='true' /> : <Eye size={19} aria-hidden='true' />}
              </button>
            </span>
          </label>

          {capsLock ? <p className='pc-auth-inline-hint' role='status'>{copy.capsLock}</p> : null}

          <div className='pc-auth-links'>
            <a href='/platform-v7/forgot-password'>{copy.forgot}</a>
            <a href='/platform-v7/register'>{copy.register}</a>
          </div>

          {error ? <p ref={errorRef} id='pc-auth-error' className='pc-auth-error' role='alert' tabIndex={-1}>{error}</p> : null}

          <button className='pc-auth-submit' type='submit' disabled={submitting} aria-busy={submitting}>
            <span>{submitting ? copy.loading : copy.submit}</span>
          </button>
          <p id='pc-auth-note' className='pc-auth-note'>{copy.note}</p>
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
            <button type='button' aria-pressed={method === 'totp'} onClick={() => { setMethod('totp'); setCode(''); setError(''); setErrorField(null); }}>
              <ShieldCheck size={18} aria-hidden='true' />{copy.totpMethod}
            </button>
            <button type='button' aria-pressed={method === 'backup_code'} onClick={() => { setMethod('backup_code'); setCode(''); setError(''); setErrorField(null); }}>
              <KeyRound size={18} aria-hidden='true' />{copy.backupMethod}
            </button>
          </div>

          <label className='pc-auth-label' htmlFor='pc-auth-code'>
            <span>{copy.mfaCode}</span>
            <span className='pc-auth-field'>
              <KeyRound size={19} aria-hidden='true' />
              <input
                id='pc-auth-code'
                name='verification-code'
                ref={codeRef}
                value={code}
                onChange={(event) => updateCode(event.target.value)}
                type='text'
                inputMode={method === 'totp' ? 'numeric' : 'text'}
                autoComplete={method === 'totp' ? 'one-time-code' : 'off'}
                autoCapitalize='characters'
                spellCheck={false}
                required
                maxLength={method === 'totp' ? 6 : 64}
                pattern={method === 'totp' ? '[0-9]{6}' : undefined}
                enterKeyHint='done'
                placeholder={method === 'totp' ? copy.mfaCodePlaceholder : copy.backupCodePlaceholder}
                disabled={submitting}
                aria-invalid={errorField === 'code'}
                aria-errormessage={errorField === 'code' ? 'pc-auth-error' : undefined}
              />
            </span>
          </label>

          {error ? <p ref={errorRef} id='pc-auth-error' className='pc-auth-error' role='alert' tabIndex={-1}>{error}</p> : null}

          <button className='pc-auth-submit' type='submit' disabled={submitting} aria-busy={submitting}>
            <span>{submitting ? copy.mfaLoading : copy.mfaSubmit}</span>
          </button>
          <button className='pc-auth-secondary' type='button' onClick={returnToPassword} disabled={submitting}>{copy.mfaBack}</button>
        </form>
      ) : null}

      {step === 'backup-codes' ? (
        <section className='pc-auth-card pc-auth-backup-codes' aria-live='polite'>
          <ShieldCheck size={36} aria-hidden='true' />
          <div className='pc-auth-code-grid'>{backupCodes.map((item) => <code key={item}>{item}</code>)}</div>
          <button className='pc-auth-submit' type='button' onClick={() => globalThis.location.assign(redirectTo)}><span>{copy.submit}</span></button>
        </section>
      ) : null}
    </section>
  );
}
