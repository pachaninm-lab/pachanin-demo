'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import styles from '../../../platform-v7/login/login.module.css';
import mfaStyles from '../../../platform-v7/login/login-mfa.module.css';

const LOGIN_FACT_KEYS = ['account', 'permissions', 'session'] as const;
type LoginStep = 'password' | 'mfa';
type MfaMethod = 'totp' | 'backup_code';

export default function LoginPage() {
  const t = useTranslations('publicEntry.login');
  const router = useRouter();
  const [step, setStep] = React.useState<LoginStep>('password');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [method, setMethod] = React.useState<MfaMethod>('totp');
  const [mfaCode, setMfaCode] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const errorRef = React.useRef<HTMLParagraphElement>(null);
  const mfaInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  React.useEffect(() => {
    if (step === 'mfa') mfaInputRef.current?.focus();
  }, [step, method]);

  function errorMessage(code: string) {
    if (code === 'MFA_EXPIRED') return t('mfaExpired');
    if (code === 'MFA_RATE_LIMITED') return t('mfaRateLimited');
    if (code === 'MFA_INVALID') return t('mfaInvalid');
    return t('unavailable');
  }

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || !password) {
      setError(t('required'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({} as { ok?: boolean; code?: string; mfaRequired?: boolean; redirectTo?: string }));
      if (!response.ok || !payload.ok) throw new Error(payload.code || 'AUTH_UNAVAILABLE');

      setPassword('');
      if (payload.mfaRequired) {
        setStep('mfa');
        setMfaCode('');
        return;
      }

      router.replace(payload.redirectTo || '/platform-v7/control-tower');
      router.refresh();
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : 'AUTH_UNAVAILABLE';
      setError(code === 'RATE_LIMITED' ? t('rateLimited') : t('unavailable'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const code = mfaCode.trim();
    if ((method === 'totp' && !/^\d{6}$/.test(code)) || (method === 'backup_code' && code.length < 8)) {
      setError(t('mfaInvalid'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth/mfa-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, code }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({} as { ok?: boolean; code?: string; redirectTo?: string }));
      if (!response.ok || !payload.ok) throw new Error(payload.code || 'MFA_UNAVAILABLE');

      setMfaCode('');
      router.replace(payload.redirectTo || '/platform-v7/control-tower');
      router.refresh();
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : 'MFA_UNAVAILABLE';
      setError(errorMessage(code));
    } finally {
      setSubmitting(false);
    }
  }

  async function backToPassword() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/auth/mfa-login/cancel', { method: 'POST', cache: 'no-store' });
    } finally {
      setStep('password');
      setMethod('totp');
      setMfaCode('');
      setError('');
      setSubmitting(false);
    }
  }

  const errorId = error ? 'pc-login-error' : undefined;

  return (
    <main className={styles.page}>
      <PublicSiteHeader
        brand={t('brand')}
        ariaLabel={t('publicHeader')}
        homeAriaLabel={t('home')}
        tagline={t('brandTagline')}
        actions={(
          <Link className='pc-site-action' href='/platform-v7' aria-label={t('back')} title={t('back')}>
            <ArrowLeft size={20} aria-hidden='true' />
            <span>{t('back')}</span>
          </Link>
        )}
      />

      <section className={styles.layout} aria-labelledby='pc-login-title'>
        <aside className={styles.context} aria-label={t('brandTagline')}>
          <span className={styles.eyebrow}><ShieldCheck size={17} aria-hidden='true' />{t('eyebrow')}</span>
          <h1 id='pc-login-title'>{step === 'mfa' ? t('mfaTitle') : t('title')}</h1>
          <p>{step === 'mfa' ? t('mfaLead') : t('lead')}</p>
          <div className={styles.facts}>
            {LOGIN_FACT_KEYS.map((key) => (
              <span key={key}><CheckCircle2 size={17} aria-hidden='true' />{t(`facts.${key}`)}</span>
            ))}
          </div>
        </aside>

        {step === 'password' ? (
          <form className={styles.card} onSubmit={submitPassword} noValidate aria-describedby={errorId}>
            <label>
              <span>{t('email')}</span>
              <div className={styles.field}>
                <Mail size={19} aria-hidden='true' />
                <input value={email} onChange={(event) => setEmail(event.target.value)} type='email' inputMode='email' autoComplete='username' autoCapitalize='none' spellCheck={false} placeholder={t('emailPlaceholder')} disabled={submitting} aria-invalid={Boolean(error)} aria-describedby={errorId} />
              </div>
            </label>
            <label>
              <span>{t('password')}</span>
              <div className={styles.field}>
                <LockKeyhole size={19} aria-hidden='true' />
                <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete='current-password' placeholder={t('passwordPlaceholder')} disabled={submitting} aria-invalid={Boolean(error)} aria-describedby={errorId} />
                <button type='button' onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('hidePassword') : t('showPassword')} title={showPassword ? t('hidePassword') : t('showPassword')}>
                  {showPassword ? <EyeOff size={19} aria-hidden='true' /> : <Eye size={19} aria-hidden='true' />}
                </button>
              </div>
            </label>
            <div className={styles.links}>
              <Link href='/platform-v7/forgot-password'>{t('forgot')}</Link>
              <Link href='/platform-v7/register'>{t('register')}</Link>
            </div>
            {error ? <LoginError ref={errorRef} id='pc-login-error' message={error} /> : null}
            <button className={styles.submit} type='submit' disabled={submitting} aria-busy={submitting}>{submitting ? t('loading') : t('submit')}</button>
            <p className={styles.note}>{t('note')}</p>
          </form>
        ) : (
          <form className={styles.card} onSubmit={submitMfa} noValidate aria-describedby={errorId}>
            <div className={mfaStyles.stepHeader}>
              <KeyRound size={27} color='#087a3b' aria-hidden='true' />
              <h2>{t('mfaTitle')}</h2>
              <p>{t('mfaInstruction')}</p>
            </div>
            <div className={mfaStyles.methods} role='group' aria-label={t('mfaMethod')}>
              <button type='button' data-active={method === 'totp'} aria-pressed={method === 'totp'} onClick={() => { setMethod('totp'); setMfaCode(''); setError(''); }}>{t('mfaTotp')}</button>
              <button type='button' data-active={method === 'backup_code'} aria-pressed={method === 'backup_code'} onClick={() => { setMethod('backup_code'); setMfaCode(''); setError(''); }}>{t('mfaBackup')}</button>
            </div>
            <label>
              <span>{method === 'totp' ? t('mfaCode') : t('mfaBackupCode')}</span>
              <input ref={mfaInputRef} className={mfaStyles.codeInput} data-backup={method === 'backup_code'} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} type='text' inputMode={method === 'totp' ? 'numeric' : 'text'} autoComplete={method === 'totp' ? 'one-time-code' : 'off'} autoCapitalize='characters' spellCheck={false} maxLength={method === 'totp' ? 6 : 64} placeholder={method === 'totp' ? t('mfaCodePlaceholder') : t('mfaBackupPlaceholder')} disabled={submitting} aria-invalid={Boolean(error)} aria-describedby={errorId} />
            </label>
            {error ? <LoginError ref={errorRef} id='pc-login-error' message={error} /> : null}
            <button className={styles.submit} type='submit' disabled={submitting} aria-busy={submitting}>{submitting ? t('mfaVerifying') : t('mfaVerify')}</button>
            <button className={mfaStyles.backButton} type='button' onClick={() => void backToPassword()} disabled={submitting}>{t('backToPassword')}</button>
          </form>
        )}
      </section>
    </main>
  );
}

const LoginError = React.forwardRef<HTMLParagraphElement, { id: string; message: string }>(function LoginError({ id, message }, ref) {
  return <p ref={ref} id={id} className={styles.error} role='alert' aria-live='assertive' tabIndex={-1}>{message}</p>;
});
