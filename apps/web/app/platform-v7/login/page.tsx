'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const ENTRY_COOKIE = 'pc_v7_entry_seen';

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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError(t('required'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || t('unavailable'));
      }

      const role = surfaceRole(payload?.user?.role ?? payload?.role);
      const sessionBody = payload?.demo === true ? { role } : {};
      const sessionResponse = await fetch('/api/platform-v7/cabinet-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionBody),
        cache: 'no-store',
      });
      if (!sessionResponse.ok) throw new Error(t('unavailable'));

      markEntrySeen();
      globalThis.sessionStorage?.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, role);
      setRole(role);
      router.replace(platformV7RoleHome(role));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('unavailable'));
    } finally {
      setSubmitting(false);
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
          <h1 id='pc-login-title'>{t('title')}</h1>
          <p>{t('lead')}</p>
        </div>

        <form className='pc-auth-card' onSubmit={onSubmit} noValidate>
          <label className='pc-auth-label'>
            <span>{t('email')}</span>
            <span className='pc-auth-field'>
              <Mail size={19} aria-hidden='true' />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type='email'
                inputMode='email'
                autoComplete='username'
                placeholder={t('emailPlaceholder')}
                disabled={submitting}
                aria-invalid={Boolean(error)}
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
                placeholder={t('passwordPlaceholder')}
                disabled={submitting}
                aria-invalid={Boolean(error)}
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

          {error ? <p className='pc-auth-error' role='alert'>{error}</p> : null}

          <button className='pc-auth-submit' type='submit' disabled={submitting}>
            {submitting ? t('loading') : t('submit')}
          </button>

          <p className='pc-auth-note'>{t('note')}</p>
        </form>
      </section>

      <style jsx>{`
        .pc-auth-page{--auth-header-height:64px;min-height:100dvh;padding-top:var(--auth-header-height);background:radial-gradient(circle at 12% 0%,rgba(8,122,59,.12),transparent 34%),linear-gradient(180deg,#f7faf7 0%,#eef5ef 58%,#f8faf8 100%);color:#102019;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-auth-page *{box-sizing:border-box}.pc-auth-shell{width:min(100%,560px);min-height:calc(100dvh - var(--auth-header-height));margin:0 auto;padding:clamp(34px,7vh,74px) 18px 40px;display:flex;flex-direction:column;justify-content:center;gap:24px}.pc-auth-heading{text-align:center}.pc-auth-heading h1{margin:0;font-size:clamp(38px,7vw,58px);line-height:1;letter-spacing:-.055em}.pc-auth-heading p{max-width:520px;margin:16px auto 0;color:#5c6b64;font-size:16px;line-height:1.5;font-weight:600}.pc-auth-card{display:grid;gap:18px;padding:clamp(22px,5vw,36px);border-radius:30px;background:rgba(255,255,255,.96);border:1px solid rgba(16,32,25,.1);box-shadow:0 28px 80px rgba(27,66,45,.13)}.pc-auth-label{display:grid;gap:8px}.pc-auth-label>span:first-child{font-size:13px;font-weight:900;color:#31423a}.pc-auth-field{height:56px;display:flex;align-items:center;gap:10px;padding:0 15px;border-radius:17px;background:#f9fbf9;border:1px solid rgba(16,32,25,.12);transition:border-color .15s,box-shadow .15s}.pc-auth-field:focus-within{border-color:rgba(8,122,59,.58);box-shadow:0 0 0 4px rgba(8,122,59,.1)}.pc-auth-field>svg{color:#708078;flex:0 0 auto}.pc-auth-field input{width:100%;height:100%;min-width:0;border:0;outline:0;background:transparent;color:#102019;font:inherit;font-size:16px}.pc-auth-password-toggle{width:38px;height:38px;flex:0 0 38px;border:0;border-radius:11px;background:transparent;color:#607068;display:grid;place-items:center;cursor:pointer}.pc-auth-password-toggle:focus-visible{outline:3px solid rgba(8,122,59,.28);outline-offset:2px}.pc-auth-links{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}.pc-auth-links a{color:#087a3b;text-decoration:none;font-size:13px;font-weight:850}.pc-auth-links a:focus-visible{outline:3px solid rgba(8,122,59,.28);outline-offset:3px;border-radius:6px}.pc-auth-error{margin:0;padding:12px 14px;border-radius:14px;background:#fff1f1;border:1px solid #f2c5c5;color:#9b2525;font-size:13px;font-weight:800;line-height:1.4}.pc-auth-submit{height:56px;border:0;border-radius:17px;background:linear-gradient(135deg,#087a3b,#075f31);color:#fff;font:inherit;font-size:15px;font-weight:950;cursor:pointer;box-shadow:0 18px 36px rgba(8,122,59,.22)}.pc-auth-submit:disabled{cursor:wait;opacity:.66}.pc-auth-submit:focus-visible{outline:3px solid rgba(8,122,59,.35);outline-offset:3px}.pc-auth-note{margin:0;color:#6b7973;font-size:12px;line-height:1.5;text-align:center}@media(max-width:520px){.pc-auth-shell{padding:28px 14px 28px;justify-content:flex-start}.pc-auth-heading h1{font-size:38px}.pc-auth-card{padding:22px;border-radius:24px}.pc-auth-links{align-items:flex-start;flex-direction:column}.pc-auth-field{height:54px}}
      `}</style>
    </main>
  );
}
