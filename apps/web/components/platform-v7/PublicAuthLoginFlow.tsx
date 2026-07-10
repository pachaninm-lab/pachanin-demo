'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { PublicSiteHeader } from './PublicSiteHeader';
import styles from './PublicAuthLoginFlow.module.css';

type Step = 'password' | 'mfa' | 'backup-codes';
type Method = 'totp' | 'backup_code';
type Payload = {
  ok?: boolean;
  mfaRequired?: boolean;
  redirectTo?: string;
  enrollmentRequired?: boolean;
  setupSecret?: string | null;
  backupCodes?: string[];
};

async function postJson(url: string, body: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    });
    return { response, payload: await response.json().catch(() => ({})) as Payload };
  } finally {
    window.clearTimeout(timer);
  }
}

export function PublicAuthLoginFlow() {
  const login = useTranslations('publicEntry.login');
  const mfa = useTranslations('publicEntry.mfa');
  const [step, setStep] = React.useState<Step>('password');
  const [method, setMethod] = React.useState<Method>('totp');
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

  React.useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  React.useEffect(() => { if (step === 'mfa') codeRef.current?.focus(); }, [step, method]);

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError(login('required'));
      emailRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { response, payload } = await postJson('/api/auth/login', { email: normalizedEmail, password });
      if (!response.ok || !payload.ok) throw new Error();
      if (payload.mfaRequired) {
        setSetupSecret(payload.enrollmentRequired ? String(payload.setupSecret || '') : '');
        setPassword('');
        setCode('');
        setMethod('totp');
        setStep('mfa');
        return;
      }
      if (!payload.redirectTo?.startsWith('/platform-v7/')) throw new Error();
      globalThis.location.assign(payload.redirectTo);
    } catch {
      setError(login('unavailable'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!code.trim()) {
      setError(mfa('error'));
      codeRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { response, payload } = await postJson('/api/auth/mfa-login', { code: code.trim(), method });
      if (!response.ok || !payload.ok || !payload.redirectTo?.startsWith('/platform-v7/')) throw new Error();
      if (Array.isArray(payload.backupCodes) && payload.backupCodes.length) {
        setBackupCodes(payload.backupCodes);
        setRedirectTo(payload.redirectTo);
        setStep('backup-codes');
        return;
      }
      globalThis.location.assign(payload.redirectTo);
    } catch {
      setError(mfa('error'));
    } finally {
      setSubmitting(false);
    }
  }

  async function backToPassword() {
    if (submitting) return;
    setSubmitting(true);
    try { await fetch('/api/auth/mfa-login/cancel', { method: 'POST', cache: 'no-store' }); } finally {
      setStep('password');
      setCode('');
      setError('');
      setSetupSecret('');
      setSubmitting(false);
      window.setTimeout(() => emailRef.current?.focus(), 0);
    }
  }

  const title = step === 'password' ? login('title') : step === 'mfa' ? mfa('title') : mfa('backupCodesTitle');
  const lead = step === 'password' ? login('lead') : step === 'mfa' ? mfa('lead') : mfa('backupCodesLead');

  return (
    <main className={styles.page}>
      <PublicSiteHeader
        ariaLabel={login('publicNav')}
        tagline={login('brandTagline')}
        actions={<Link className='pc-site-action' href='/platform-v7' aria-label={login('backHome')} title={login('backHome')}><ArrowLeft size={20} aria-hidden='true' /></Link>}
      />
      <section className={styles.shell} aria-labelledby='public-login-title'>
        <div className={styles.heading}>
          <h1 id='public-login-title'>{title}</h1>
          <p>{lead}</p>
        </div>

        {step === 'password' ? (
          <form className={styles.card} onSubmit={submitPassword} noValidate>
            <label className={styles.label}>
              <span>{login('email')}</span>
              <span className={styles.field}><Mail size={19} aria-hidden='true' /><input ref={emailRef} value={email} onChange={(e) => setEmail(e.target.value)} type='email' inputMode='email' autoComplete='username' autoCapitalize='none' spellCheck={false} placeholder={login('emailPlaceholder')} disabled={submitting} aria-invalid={Boolean(error)} aria-describedby={error ? 'public-auth-error' : undefined} /></span>
            </label>
            <label className={styles.label}>
              <span>{login('password')}</span>
              <span className={styles.field}><LockKeyhole size={19} aria-hidden='true' /><input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} autoComplete='current-password' autoCapitalize='none' spellCheck={false} placeholder={login('passwordPlaceholder')} disabled={submitting} aria-invalid={Boolean(error)} aria-describedby={error ? 'public-auth-error' : undefined} /><button className={styles.iconButton} type='button' onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? login('hidePassword') : login('showPassword')}>{showPassword ? <EyeOff size={19} aria-hidden='true' /> : <Eye size={19} aria-hidden='true' />}</button></span>
            </label>
            <div className={styles.links}><Link href='/platform-v7/forgot-password'>{login('forgot')}</Link><Link href='/platform-v7/register'>{login('register')}</Link></div>
            {error ? <p ref={errorRef} id='public-auth-error' className={styles.error} role='alert' tabIndex={-1}>{error}</p> : null}
            <button className={styles.submit} type='submit' disabled={submitting} aria-busy={submitting}>{submitting ? login('loading') : login('submit')}</button>
            <p className={styles.note}>{login('note')}</p>
          </form>
        ) : null}

        {step === 'mfa' ? (
          <form className={styles.card} onSubmit={submitMfa} noValidate>
            {setupSecret ? <section className={styles.enrollment}><ShieldCheck size={24} aria-hidden='true' /><div><h2>{mfa('enrollmentTitle')}</h2><p>{mfa('enrollmentLead')}</p><span>{mfa('setupSecret')}</span><code>{setupSecret}</code></div></section> : null}
            <div className={styles.methods} role='group' aria-label={mfa('code')}>
              <button type='button' aria-pressed={method === 'totp'} onClick={() => { setMethod('totp'); setCode(''); setError(''); }}><ShieldCheck size={18} aria-hidden='true' />{mfa('totp')}</button>
              <button type='button' aria-pressed={method === 'backup_code'} onClick={() => { setMethod('backup_code'); setCode(''); setError(''); }}><KeyRound size={18} aria-hidden='true' />{mfa('backup')}</button>
            </div>
            <label className={styles.label}>
              <span>{mfa('code')}</span>
              <span className={styles.field}><KeyRound size={19} aria-hidden='true' /><input ref={codeRef} value={code} onChange={(e) => setCode(e.target.value)} type='text' inputMode={method === 'totp' ? 'numeric' : 'text'} autoComplete={method === 'totp' ? 'one-time-code' : 'off'} autoCapitalize='characters' spellCheck={false} placeholder={method === 'totp' ? mfa('totpPlaceholder') : mfa('backupPlaceholder')} disabled={submitting} aria-invalid={Boolean(error)} aria-describedby={error ? 'public-auth-error' : undefined} /></span>
            </label>
            {error ? <p ref={errorRef} id='public-auth-error' className={styles.error} role='alert' tabIndex={-1}>{error}</p> : null}
            <button className={styles.submit} type='submit' disabled={submitting} aria-busy={submitting}>{submitting ? mfa('loading') : mfa('submit')}</button>
            <button className={styles.secondary} type='button' onClick={backToPassword} disabled={submitting}>{mfa('back')}</button>
          </form>
        ) : null}

        {step === 'backup-codes' ? <section className={`${styles.card} ${styles.codes}`} aria-live='polite'><ShieldCheck size={36} aria-hidden='true' /><div className={styles.codeGrid}>{backupCodes.map((item) => <code key={item}>{item}</code>)}</div><button className={styles.submit} type='button' onClick={() => globalThis.location.assign(redirectTo)}>{mfa('continue')}</button></section> : null}
      </section>
    </main>
  );
}
