'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import styles from './login.module.css';

const ENTRY_COOKIE = 'pc_v7_entry_seen';
const LOGIN_FACT_KEYS = ['account', 'permissions', 'session'] as const;

function surfaceRole(role: string | undefined): PlatformRole {
  const normalized = String(role ?? '').toUpperCase();
  if (normalized === 'BUYER') return 'buyer';
  if (normalized === 'FARMER' || normalized === 'SELLER') return 'seller';
  if (normalized === 'LOGISTICIAN' || normalized === 'LOGISTICS') return 'logistics';
  if (normalized === 'DRIVER') return 'driver';
  if (normalized === 'ELEVATOR') return 'elevator';
  if (normalized === 'LAB') return 'lab';
  if (normalized === 'SURVEYOR') return 'surveyor';
  if (normalized === 'ACCOUNTING' || normalized === 'BANK') return 'bank';
  if (normalized === 'COMPLIANCE_OFFICER' || normalized === 'COMPLIANCE') return 'compliance';
  if (normalized === 'ARBITRATOR') return 'arbitrator';
  if (normalized === 'EXECUTIVE') return 'executive';
  return 'operator';
}

function markEntrySeen() {
  const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ENTRY_COOKIE}=true; Path=/; Max-Age=14400; SameSite=Lax${secure}`;
}

export default function LoginPage() {
  const t = useTranslations('publicEntry.login');
  const router = useRouter();
  const setRole = usePlatformV7RStore((state) => state.setRole);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(t('unavailable'));
      }

      const role = surfaceRole(payload?.user?.role ?? payload?.role);
      const sessionBody = payload?.demo === true ? { role } : {};
      const sessionResponse = await fetch('/api/platform-v7/cabinet-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionBody),
        cache: 'no-store',
      });
      if (!sessionResponse.ok) {
        throw new Error(t('unavailable'));
      }

      markEntrySeen();
      globalThis.sessionStorage?.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, role);
      setRole(role);
      router.replace(platformV7RoleHome(role));
      router.refresh();
    } catch {
      setError(t('unavailable'));
    } finally {
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
          <h1 id='pc-login-title'>{t('title')}</h1>
          <p>{t('lead')}</p>
          <div className={styles.facts}>
            {LOGIN_FACT_KEYS.map((key) => (
              <span key={key}><CheckCircle2 size={17} aria-hidden='true' />{t(`facts.${key}`)}</span>
            ))}
          </div>
        </aside>

        <form className={styles.card} onSubmit={onSubmit} noValidate aria-describedby={errorId}>
          <label>
            <span>{t('email')}</span>
            <div className={styles.field}>
              <Mail size={19} aria-hidden='true' />
              <input
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
                aria-describedby={errorId}
              />
            </div>
          </label>
          <label>
            <span>{t('password')}</span>
            <div className={styles.field}>
              <LockKeyhole size={19} aria-hidden='true' />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete='current-password'
                placeholder={t('passwordPlaceholder')}
                disabled={submitting}
                aria-invalid={Boolean(error)}
                aria-describedby={errorId}
              />
              <button
                type='button'
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                title={showPassword ? t('hidePassword') : t('showPassword')}
              >
                {showPassword ? <EyeOff size={19} aria-hidden='true' /> : <Eye size={19} aria-hidden='true' />}
              </button>
            </div>
          </label>

          <div className={styles.links}>
            <Link href='/platform-v7/forgot-password'>{t('forgot')}</Link>
            <Link href='/platform-v7/register'>{t('register')}</Link>
          </div>

          {error ? (
            <p
              ref={errorRef}
              id='pc-login-error'
              className={styles.error}
              role='alert'
              aria-live='assertive'
              tabIndex={-1}
            >
              {error}
            </p>
          ) : null}
          <button className={styles.submit} type='submit' disabled={submitting} aria-busy={submitting}>
            {submitting ? t('loading') : t('submit')}
          </button>
          <p className={styles.note}>{t('note')}</p>
        </form>
      </section>
    </main>
  );
}
