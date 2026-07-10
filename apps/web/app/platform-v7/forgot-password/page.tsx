'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';

export default function ForgotPasswordPage() {
  const t = useTranslations('publicEntry.forgot');
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const contact = email.trim();
    if (!contact) {
      setError(t('error'));
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
          name: t('requestName'),
          organization: '',
          contact,
          message: t('requestMessage'),
          consent: 'yes',
          website: '',
        }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.accepted !== true) throw new Error('recovery_request_failed');
      setSubmitted(true);
    } catch {
      setError(t('error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className='pc-v7-public-entry pc-recovery-page'>
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

      <section className='pc-recovery-shell' aria-labelledby='pc-recovery-title'>
        <div className='pc-recovery-heading'>
          <h1 id='pc-recovery-title'>{t('title')}</h1>
          <p>{t('lead')}</p>
        </div>

        {submitted ? (
          <section className='pc-recovery-card pc-recovery-success' aria-live='polite'>
            <CheckCircle2 size={42} strokeWidth={1.9} aria-hidden='true' />
            <h2>{t('successTitle')}</h2>
            <p>{t('successText')}</p>
            <Link className='pc-recovery-primary-link' href='/platform-v7/login'>{t('backToLogin')}</Link>
          </section>
        ) : (
          <form className='pc-recovery-card' onSubmit={onSubmit} noValidate>
            <label className='pc-recovery-label'>
              <span>{t('email')}</span>
              <span className='pc-recovery-field'>
                <Mail size={19} aria-hidden='true' />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type='email'
                  inputMode='email'
                  autoComplete='email'
                  placeholder={t('emailPlaceholder')}
                  disabled={submitting}
                  aria-invalid={Boolean(error)}
                />
              </span>
            </label>

            {error ? <p className='pc-recovery-error' role='alert'>{error}</p> : null}

            <button className='pc-recovery-submit' type='submit' disabled={submitting}>
              {submitting ? t('loading') : t('submit')}
            </button>

            <Link className='pc-recovery-login-link' href='/platform-v7/login'>{t('backToLogin')}</Link>
            <p className='pc-recovery-note'>{t('note')}</p>
          </form>
        )}
      </section>

      <style jsx>{`
        .pc-recovery-page{--recovery-header-height:64px;min-height:100dvh;padding-top:var(--recovery-header-height);background:radial-gradient(circle at 85% 0%,rgba(8,122,59,.12),transparent 34%),linear-gradient(180deg,#f7faf7 0%,#eef5ef 58%,#f8faf8 100%);color:#102019;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-recovery-page *{box-sizing:border-box}.pc-recovery-shell{width:min(100%,560px);min-height:calc(100dvh - var(--recovery-header-height));margin:0 auto;padding:clamp(34px,7vh,74px) 18px 40px;display:flex;flex-direction:column;justify-content:center;gap:24px}.pc-recovery-heading{text-align:center}.pc-recovery-heading h1{margin:0;font-size:clamp(38px,7vw,58px);line-height:1;letter-spacing:-.055em}.pc-recovery-heading p{max-width:520px;margin:16px auto 0;color:#5c6b64;font-size:16px;line-height:1.5;font-weight:600}.pc-recovery-card{display:grid;gap:18px;padding:clamp(22px,5vw,36px);border-radius:30px;background:rgba(255,255,255,.96);border:1px solid rgba(16,32,25,.1);box-shadow:0 28px 80px rgba(27,66,45,.13)}.pc-recovery-label{display:grid;gap:8px}.pc-recovery-label>span:first-child{font-size:13px;font-weight:900;color:#31423a}.pc-recovery-field{height:56px;display:flex;align-items:center;gap:10px;padding:0 15px;border-radius:17px;background:#f9fbf9;border:1px solid rgba(16,32,25,.12);transition:border-color .15s,box-shadow .15s}.pc-recovery-field:focus-within{border-color:rgba(8,122,59,.58);box-shadow:0 0 0 4px rgba(8,122,59,.1)}.pc-recovery-field>svg{color:#708078;flex:0 0 auto}.pc-recovery-field input{width:100%;height:100%;min-width:0;border:0;outline:0;background:transparent;color:#102019;font:inherit;font-size:16px}.pc-recovery-error{margin:0;padding:12px 14px;border-radius:14px;background:#fff1f1;border:1px solid #f2c5c5;color:#9b2525;font-size:13px;font-weight:800;line-height:1.4}.pc-recovery-submit,.pc-recovery-primary-link{min-height:56px;border:0;border-radius:17px;background:linear-gradient(135deg,#087a3b,#075f31);color:#fff;font:inherit;font-size:15px;font-weight:950;display:flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;cursor:pointer;box-shadow:0 18px 36px rgba(8,122,59,.22)}.pc-recovery-submit:disabled{cursor:wait;opacity:.66}.pc-recovery-submit:focus-visible,.pc-recovery-primary-link:focus-visible,.pc-recovery-login-link:focus-visible{outline:3px solid rgba(8,122,59,.35);outline-offset:3px}.pc-recovery-login-link{justify-self:center;color:#087a3b;text-decoration:none;font-size:13px;font-weight:850}.pc-recovery-note{margin:0;color:#6b7973;font-size:12px;line-height:1.5;text-align:center}.pc-recovery-success{text-align:center;justify-items:center}.pc-recovery-success>svg{color:#087a3b}.pc-recovery-success h2{margin:0;font-size:28px;letter-spacing:-.04em}.pc-recovery-success p{margin:0;color:#5c6b64;line-height:1.55}.pc-recovery-primary-link{width:100%;margin-top:4px}@media(max-width:520px){.pc-recovery-shell{padding:28px 14px 28px;justify-content:flex-start}.pc-recovery-heading h1{font-size:38px}.pc-recovery-card{padding:22px;border-radius:24px}.pc-recovery-field{height:54px}}
      `}</style>
    </main>
  );
}
