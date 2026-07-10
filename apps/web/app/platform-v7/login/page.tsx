'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';

type LoginStep = 'password' | 'mfa' | 'backup-codes';
type MfaMethod = 'totp' | 'backup_code';

type LoginResponse = {
  ok?: boolean;
  mfaRequired?: boolean;
  redirectTo?: string;
  methods?: MfaMethod[];
  enrollmentRequired?: boolean;
  setupSecret?: string | null;
  otpAuthUri?: string | null;
  backupCodes?: string[];
  message?: string;
};

async function requestJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
    const payload = await response.json().catch(() => ({})) as LoginResponse;
    return { response, payload };
  } finally {
    window.clearTimeout(timer);
  }
}

export default function LoginPage() {
  const t = useTranslations('publicEntry.login');
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
    if (!normalizedEmail || !password) {
      setError(t('required'));
      emailRef.current?.focus();
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
      if (!response.ok || !payload.ok) throw new Error(t('unavailable'));

      if (payload.mfaRequired) {
        setSetupSecret(payload.enrollmentRequired ? String(payload.setupSecret || '') : '');
        setMethod('totp');
        setCode('');
        setPassword('');
        setStep('mfa');
        return;
      }

      if (!payload.redirectTo?.startsWith('/platform-v7/')) throw new Error(t('unavailable'));
      globalThis.location.assign(payload.redirectTo);
    } catch {
      setError(t('unavailable'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setError(t('mfaError'));
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
        throw new Error(t('mfaError'));
      }

      if (Array.isArray(payload.backupCodes) && payload.backupCodes.length > 0) {
        setBackupCodes(payload.backupCodes);
        setRedirectTo(payload.redirectTo);
        setStep('backup-codes');
        return;
      }
      globalThis.location.assign(payload.redirectTo);
    } catch {
      setError(t('mfaError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function returnToPassword() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/auth/mfa-login/cancel', { method: 'POST', cache: 'no-store' });
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
    <main className='pc-v7-public-entry pc-auth-page'>
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

      <section className='pc-auth-shell' aria-labelledby='pc-login-title'>
        <div className='pc-auth-heading'>
          <h1 id='pc-login-title'>{step === 'password' ? t('title') : step === 'mfa' ? t('mfaTitle') : t('backupCodesTitle')}</h1>
          <p>{step === 'password' ? t('lead') : step === 'mfa' ? t('mfaLead') : t('backupCodesLead')}</p>
        </div>

        {step === 'password' ? (
          <form className='pc-auth-card' onSubmit={submitPassword} noValidate>
            <label className='pc-auth-label'>
              <span>{t('email')}</span>
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
                  placeholder={t('emailPlaceholder')}
                  disabled={submitting}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'pc-auth-error' : undefined}
                />
              </span>
            </label>

            <label className='pc-auth-label'>
              <span>{t('password')}</span>
              <span className='pc-auth-field'>
                <LockKeyhole size={19} aria-hidden='true' />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete='current-password'
                  autoCapitalize='none'
                  spellCheck={false}
                  placeholder={t('passwordPlaceholder')}
                  disabled={submitting}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'pc-auth-error' : undefined}
                />
                <button
                  type='button'
                  className='pc-auth-password-toggle'
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  title={showPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showPassword ? <EyeOff size={19} aria-hidden='true' /> : <Eye size={19} aria-hidden='true' />}
                </button>
              </span>
            </label>

            <div className='pc-auth-links'>
              <Link href='/platform-v7/forgot-password'>{t('forgot')}</Link>
              <Link href='/platform-v7/register'>{t('register')}</Link>
            </div>

            {error ? <p ref={errorRef} id='pc-auth-error' className='pc-auth-error' role='alert' tabIndex={-1}>{error}</p> : null}

            <button className='pc-auth-submit' type='submit' disabled={submitting} aria-busy={submitting}>
              {submitting ? t('loading') : t('submit')}
            </button>
            <p className='pc-auth-note'>{t('note')}</p>
          </form>
        ) : null}

        {step === 'mfa' ? (
          <form className='pc-auth-card' onSubmit={submitMfa} noValidate>
            {setupSecret ? (
              <section className='pc-auth-enrollment' aria-labelledby='pc-auth-enrollment-title'>
                <ShieldCheck size={24} aria-hidden='true' />
                <div>
                  <h2 id='pc-auth-enrollment-title'>{t('enrollmentTitle')}</h2>
                  <p>{t('enrollmentLead')}</p>
                  <span>{t('setupSecretLabel')}</span>
                  <code>{setupSecret}</code>
                </div>
              </section>
            ) : null}

            <div className='pc-auth-methods' role='group' aria-label={t('mfaCode')}>
              <button type='button' aria-pressed={method === 'totp'} onClick={() => { setMethod('totp'); setCode(''); setError(''); }}>
                <ShieldCheck size={18} aria-hidden='true' />{t('totpMethod')}
              </button>
              <button type='button' aria-pressed={method === 'backup_code'} onClick={() => { setMethod('backup_code'); setCode(''); setError(''); }}>
                <KeyRound size={18} aria-hidden='true' />{t('backupMethod')}
              </button>
            </div>

            <label className='pc-auth-label'>
              <span>{t('mfaCode')}</span>
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
                  placeholder={method === 'totp' ? t('mfaCodePlaceholder') : t('backupCodePlaceholder')}
                  disabled={submitting}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'pc-auth-error' : undefined}
                />
              </span>
            </label>

            {error ? <p ref={errorRef} id='pc-auth-error' className='pc-auth-error' role='alert' tabIndex={-1}>{error}</p> : null}

            <button className='pc-auth-submit' type='submit' disabled={submitting} aria-busy={submitting}>
              {submitting ? t('mfaLoading') : t('mfaSubmit')}
            </button>
            <button className='pc-auth-secondary' type='button' onClick={returnToPassword} disabled={submitting}>{t('mfaBack')}</button>
          </form>
        ) : null}

        {step === 'backup-codes' ? (
          <section className='pc-auth-card pc-auth-backup-codes' aria-live='polite'>
            <ShieldCheck size={36} aria-hidden='true' />
            <div className='pc-auth-code-grid'>{backupCodes.map((item) => <code key={item}>{item}</code>)}</div>
            <button className='pc-auth-submit' type='button' onClick={() => globalThis.location.assign(redirectTo)}>{t('submit')}</button>
          </section>
        ) : null}
      </section>

      <style jsx>{`
        .pc-auth-page{--auth-header-height:64px;min-height:100dvh;padding-top:var(--auth-header-height);background:radial-gradient(circle at 12% 0%,rgba(8,122,59,.12),transparent 34%),linear-gradient(180deg,#f7faf7 0%,#eef5ef 58%,#f8faf8 100%);color:#102019;font-family:var(--font-inter),Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-auth-page *{box-sizing:border-box}.pc-auth-shell{width:min(100%,560px);min-height:calc(100dvh - var(--auth-header-height));margin:0 auto;padding:clamp(34px,7vh,74px) 18px 40px;display:flex;flex-direction:column;justify-content:center;gap:24px}.pc-auth-heading{text-align:center}.pc-auth-heading h1{margin:0;font-size:clamp(38px,7vw,58px);line-height:1;letter-spacing:-.055em}.pc-auth-heading p{max-width:520px;margin:16px auto 0;color:#5c6b64;font-size:16px;line-height:1.5;font-weight:600}.pc-auth-card{display:grid;gap:18px;padding:clamp(22px,5vw,36px);border-radius:30px;background:rgba(255,255,255,.96);border:1px solid rgba(16,32,25,.1);box-shadow:0 28px 80px rgba(27,66,45,.13)}.pc-auth-label{display:grid;gap:8px}.pc-auth-label>span:first-child{font-size:13px;font-weight:900;color:#31423a}.pc-auth-field{height:56px;display:flex;align-items:center;gap:10px;padding:0 15px;border-radius:17px;background:#f9fbf9;border:1px solid rgba(16,32,25,.12);transition:border-color .15s,box-shadow .15s}.pc-auth-field:focus-within{border-color:rgba(8,122,59,.58);box-shadow:0 0 0 4px rgba(8,122,59,.1)}.pc-auth-field>svg{color:#708078;flex:0 0 auto}.pc-auth-field input{width:100%;height:100%;min-width:0;border:0;outline:0;background:transparent;color:#102019;font:inherit;font-size:16px}.pc-auth-password-toggle{width:38px;height:38px;flex:0 0 38px;border:0;border-radius:11px;background:transparent;color:#607068;display:grid;place-items:center;cursor:pointer}.pc-auth-password-toggle:focus-visible,.pc-auth-secondary:focus-visible,.pc-auth-methods button:focus-visible{outline:3px solid rgba(8,122,59,.28);outline-offset:2px}.pc-auth-links{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}.pc-auth-links a{color:#087a3b;text-decoration:none;font-size:13px;font-weight:850}.pc-auth-links a:focus-visible{outline:3px solid rgba(8,122,59,.28);outline-offset:3px;border-radius:6px}.pc-auth-error{margin:0;padding:12px 14px;border-radius:14px;background:#fff1f1;border:1px solid #f2c5c5;color:#9b2525;font-size:13px;font-weight:800;line-height:1.4}.pc-auth-submit,.pc-auth-secondary{min-height:56px;border-radius:17px;font:inherit;font-size:15px;font-weight:950;cursor:pointer}.pc-auth-submit{border:0;background:linear-gradient(135deg,#087a3b,#075f31);color:#fff;box-shadow:0 18px 36px rgba(8,122,59,.22)}.pc-auth-secondary{border:1px solid rgba(8,122,59,.18);background:#fff;color:#087a3b}.pc-auth-submit:disabled,.pc-auth-secondary:disabled{cursor:wait;opacity:.66}.pc-auth-submit:focus-visible{outline:3px solid rgba(8,122,59,.35);outline-offset:3px}.pc-auth-note{margin:0;color:#6b7973;font-size:12px;line-height:1.5;text-align:center}.pc-auth-methods{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pc-auth-methods button{min-height:48px;border:1px solid rgba(16,32,25,.12);border-radius:14px;background:#f7faf7;color:#42524b;font:inherit;font-size:13px;font-weight:850;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}.pc-auth-methods button[aria-pressed='true']{border-color:rgba(8,122,59,.5);background:rgba(8,122,59,.08);color:#087a3b}.pc-auth-enrollment{display:flex;gap:12px;padding:14px;border-radius:16px;border:1px solid rgba(8,122,59,.18);background:rgba(8,122,59,.055)}.pc-auth-enrollment>svg{flex:0 0 auto;color:#087a3b}.pc-auth-enrollment h2{margin:0;font-size:16px}.pc-auth-enrollment p{margin:5px 0 10px;color:#5c6b64;font-size:13px;line-height:1.45}.pc-auth-enrollment span{display:block;color:#5c6b64;font-size:11px;font-weight:850}.pc-auth-enrollment code{display:block;margin-top:4px;overflow-wrap:anywhere;color:#17362a;font-size:13px}.pc-auth-backup-codes{text-align:center;justify-items:center}.pc-auth-code-grid{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px}.pc-auth-code-grid code{padding:10px;border-radius:10px;background:#f1f5f2;color:#17362a;font-size:12px;font-weight:800}.pc-auth-backup-codes .pc-auth-submit{width:100%}@media(max-width:520px){.pc-auth-shell{padding:28px 14px 28px;justify-content:flex-start}.pc-auth-heading h1{font-size:38px}.pc-auth-card{padding:22px;border-radius:24px}.pc-auth-links{align-items:flex-start;flex-direction:column}.pc-auth-field{height:54px}.pc-auth-methods,.pc-auth-code-grid{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
