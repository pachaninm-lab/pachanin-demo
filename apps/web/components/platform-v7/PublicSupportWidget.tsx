'use client';

import * as React from 'react';
import { CheckCircle2, MessageCircle, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import styles from './PublicSupportWidget.module.css';

type SubmitState = 'idle' | 'sending' | 'sent';
type Topic = 'platform' | 'onboarding' | 'bank_partner' | 'region' | 'technical' | 'other';

const TOPIC_KEYS: Topic[] = ['platform', 'onboarding', 'bank_partner', 'region', 'technical', 'other'];

function clean(value: string, limit: number) {
  return value.trim().replace(/\s+/g, ' ').slice(0, limit);
}

export function PublicSupportWidget() {
  const t = useTranslations('publicEntry.support');
  const [open, setOpen] = React.useState(false);
  const [topic, setTopic] = React.useState<Topic>('platform');
  const [name, setName] = React.useState('');
  const [contact, setContact] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  const [state, setState] = React.useState<SubmitState>('idle');
  const [error, setError] = React.useState('');
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'sending') return;

    const payload = {
      source: 'public_support',
      type: topic,
      name: clean(name, 80),
      organization: '',
      contact: clean(contact, 120),
      message: message.trim().slice(0, 2000),
      consent: consent ? 'yes' : 'no',
      website: '',
    };

    if (payload.name.length < 2) return setError(t('errors.name'));
    if (payload.contact.length < 5) return setError(t('errors.contact'));
    if (!payload.message) return setError(t('errors.message'));
    if (!consent) return setError(t('errors.consent'));

    setState('sending');
    setError('');

    try {
      const response = await fetch('/api/platform-v7/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({} as { sent?: boolean; delivered?: boolean }));

      if (!response.ok || result.sent === false || result.delivered === false) {
        throw new Error('delivery_failed');
      }

      setState('sent');
      setMessage('');
      setConsent(false);
    } catch {
      setState('idle');
      setError(t('errors.delivery'));
    }
  }

  return (
    <div className={styles.root}>
      <button
        ref={triggerRef}
        className={styles.trigger}
        type='button'
        aria-label={open ? t('close') : t('open')}
        aria-expanded={open}
        aria-controls='public-support-dialog'
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={24} aria-hidden='true' /> : <MessageCircle size={24} aria-hidden='true' />}
      </button>

      {open ? (
        <aside
          id='public-support-dialog'
          className={styles.panel}
          role='dialog'
          aria-modal='false'
          aria-labelledby='public-support-title'
          aria-describedby='public-support-description'
        >
          <header className={styles.header}>
            <div>
              <strong id='public-support-title'>{t('title')}</strong>
              <span id='public-support-description'>{t('description')}</span>
            </div>
            <button ref={closeRef} className={styles.close} type='button' onClick={close} aria-label={t('close')}>
              <X size={19} aria-hidden='true' />
            </button>
          </header>

          {state === 'sent' ? (
            <section className={styles.success} role='status' aria-live='polite'>
              <CheckCircle2 size={40} aria-hidden='true' />
              <strong>{t('success.title')}</strong>
              <p>{t('success.text')}</p>
              <button type='button' onClick={() => setState('idle')}>{t('success.another')}</button>
            </section>
          ) : (
            <form className={styles.form} onSubmit={submit} noValidate>
              <label>
                <span>{t('topic')}</span>
                <select value={topic} onChange={(event) => setTopic(event.target.value as Topic)} disabled={state === 'sending'}>
                  {TOPIC_KEYS.map((key) => <option key={key} value={key}>{t(`topics.${key}`)}</option>)}
                </select>
              </label>
              <label>
                <span>{t('name')}</span>
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete='name' maxLength={80} disabled={state === 'sending'} />
              </label>
              <label>
                <span>{t('contact')}</span>
                <input value={contact} onChange={(event) => setContact(event.target.value)} autoComplete='email' inputMode='email' maxLength={120} disabled={state === 'sending'} />
              </label>
              <label>
                <span>{t('message')}</span>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t('messagePlaceholder')} rows={5} maxLength={2000} disabled={state === 'sending'} />
              </label>
              <label className={styles.consent}>
                <input type='checkbox' checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={state === 'sending'} />
                <span>{t('consent')}</span>
              </label>
              {error ? <p ref={errorRef} className={styles.error} role='alert' aria-live='assertive' tabIndex={-1}>{error}</p> : null}
              <button className={styles.submit} type='submit' disabled={state === 'sending'} aria-busy={state === 'sending'}>
                {state === 'sending' ? t('sending') : t('send')}
                <Send size={17} aria-hidden='true' />
              </button>
            </form>
          )}
        </aside>
      ) : null}
    </div>
  );
}
