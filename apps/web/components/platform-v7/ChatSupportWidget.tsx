'use client';

import * as React from 'react';
import { CheckCircle2, MessageCircle, Send, X } from 'lucide-react';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

type SubmitState = 'idle' | 'sending' | 'sent' | 'error';
type Topic = 'platform' | 'pilot' | 'bank_partner' | 'region' | 'technical' | 'other';

const TOPICS: { value: Topic; label: string }[] = [
  { value: 'platform', label: 'Платформа' },
  { value: 'pilot', label: 'Пилот' },
  { value: 'bank_partner', label: 'Банк / партнёр' },
  { value: 'region', label: 'Регион' },
  { value: 'technical', label: 'Технический вопрос' },
  { value: 'other', label: 'Другое' },
];

const textFromCodes = (codes: number[]) => String.fromCharCode(...codes);
const CONSENT_TEXT = textFromCodes([1071,32,1076,1072,1102,32,1089,1086,1075,1083,1072,1089,1080,1077,32,1085,1072,32,1086,1073,1088,1072,1073,1086,1090,1082,1091,32,1087,1077,1088,1089,1086,1085,1072,1083,1100,1085,1099,1093,32,1076,1072,1085,1085,1099,1093,32,1076,1083,1103,32,1086,1090,1074,1077,1090,1072,32,1085,1072,32,1086,1073,1088,1072,1097,1077,1085,1080,1077,32,1080,32,1087,1088,1080,1085,1080,1084,1072,1102,32,1091,1089,1083,1086,1074,1080,1103,32]);
const CONSENT_LINK_TEXT = textFromCodes([1087,1086,1083,1080,1090,1080,1082,1080,32,1082,1086,1085,1092,1080,1076,1077,1085,1094,1080,1072,1083,1100,1085,1086,1089,1090,1080]);
const CONSENT_REQUIRED_ERROR = textFromCodes([1055,1086,1076,1090,1074,1077,1088,1076,1080,1090,1077,32,1089,1086,1075,1083,1072,1089,1080,1077,32,1085,1072,32,1086,1073,1088,1072,1073,1086,1090,1082,1091,32,1076,1072,1085,1085,1099,1093,46]);

function clean(value: string, limit: number) {
  return value.trim().replace(/\s+/g, ' ').slice(0, limit);
}

function deliveryError(reason: string) {
  if (reason.includes('resend_not_configured') && reason.includes('smtp_not_configured')) return 'Обращение не отправлено: не настроена почтовая отправка.';
  if (reason.includes('smtp_failed')) return 'Обращение не отправлено: SMTP-сервер отклонил отправку.';
  if (reason.includes('resend_')) return 'Обращение не отправлено: почтовый провайдер отклонил отправку.';
  return 'Обращение не отправлено. Проверьте почтовые настройки.';
}

function syncSupportViewport() {
  if (typeof window === 'undefined') return;

  const viewport = window.visualViewport;
  const width = Math.max(320, Math.floor(viewport?.width ?? window.innerWidth));
  const height = Math.max(320, Math.floor(viewport?.height ?? window.innerHeight));
  const offsetLeft = Math.max(0, Math.floor(viewport?.offsetLeft ?? 0));
  const offsetTop = Math.max(0, Math.floor(viewport?.offsetTop ?? 0));
  const gutter = width <= 380 ? 8 : 10;
  const panelWidth = Math.max(280, Math.min(390, width - gutter * 2));
  const panelLeft = Math.max(gutter, Math.floor(offsetLeft + (width - panelWidth) / 2));
  const focusHeight = Math.max(320, height - 16);
  const root = document.documentElement;

  root.style.setProperty('--p7-support-vw', `${width}px`);
  root.style.setProperty('--p7-support-vh', `${height}px`);
  root.style.setProperty('--p7-support-left', `${panelLeft}px`);
  root.style.setProperty('--p7-support-top', `${offsetTop + 8}px`);
  root.style.setProperty('--p7-support-width', `${panelWidth}px`);
  root.style.setProperty('--p7-support-height', `${focusHeight}px`);
  root.style.setProperty('--p7-support-gutter', `${gutter}px`);
  root.style.overflowX = 'hidden';
  document.body.style.overflowX = 'hidden';

  if (window.scrollX !== 0) window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
  root.scrollLeft = 0;
  document.body.scrollLeft = 0;
}

function scrollFocusedControlIntoPanel(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return;
  window.setTimeout(() => {
    syncSupportViewport();
    const form = target.closest<HTMLElement>('.p7-support-chat-form');
    if (!form) return;
    const formRect = form.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const preferredTop = formRect.top + formRect.height * 0.34;
    const delta = targetRect.top - preferredTop;
    form.scrollBy({ top: delta, left: 0, behavior: 'smooth' });
  }, 120);
  window.setTimeout(syncSupportViewport, 280);
}

export function ChatSupportWidget() {
  const [open, setOpen] = React.useState(false);
  const [topic, setTopic] = React.useState<Topic>('platform');
  const [name, setName] = React.useState('');
  const [contact, setContact] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  const [state, setState] = React.useState<SubmitState>('idle');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    syncSupportViewport();
    const timers = [40, 120, 240, 480, 900].map((delay) => window.setTimeout(syncSupportViewport, delay));
    window.addEventListener('resize', syncSupportViewport);
    window.addEventListener('orientationchange', syncSupportViewport);
    window.visualViewport?.addEventListener('resize', syncSupportViewport);
    window.visualViewport?.addEventListener('scroll', syncSupportViewport);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('resize', syncSupportViewport);
      window.removeEventListener('orientationchange', syncSupportViewport);
      window.visualViewport?.removeEventListener('resize', syncSupportViewport);
      window.visualViewport?.removeEventListener('scroll', syncSupportViewport);
    };
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      source: 'support_chat',
      type: topic,
      name: clean(name, 80),
      organization: '',
      contact: clean(contact, 120),
      message: message.trim().slice(0, 2000),
      consent: consent ? 'yes' : 'no',
      website: '',
    };

    if (payload.name.length < 2) return setError('Укажите имя.');
    if (payload.contact.length < 5) return setError('Укажите телефон или email для ответа.');
    if (!payload.message) return setError('Напишите вопрос.');
    if (!consent) return setError(CONSENT_REQUIRED_ERROR);

    setState('sending');
    setError('');

    try {
      const response = await fetch('/api/platform-v7/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({} as { sent?: boolean; delivered?: boolean; next?: string; error?: string }));
      if (!response.ok || result.sent === false || result.delivered === false) {
        const reason = result.next || result.error || `http_${response.status}`;
        throw new Error(reason);
      }
      setState('sent');
      setMessage('');
      setConsent(false);
    } catch (err) {
      setState('error');
      const reason = err instanceof Error ? err.message : 'unknown';
      setError(deliveryError(reason));
    }
  }

  return (
    <>
      <button className='p7-support-chat-button' type='button' onClick={() => setOpen((value) => !value)} aria-label={open ? 'Закрыть поддержку' : 'Открыть поддержку'}>
        {open ? <X size={24} strokeWidth={2.4} /> : <MessageCircle size={24} strokeWidth={2.35} />}
      </button>

      {open ? (
        <aside className='p7-support-chat-panel' aria-label='Поддержка Прозрачной Цены'>
          <header className='p7-support-chat-head'>
            <img src={BRAND_LOGO_DATA_URI} alt='' draggable={false} />
            <strong>Поддержка Прозрачной Цены</strong>
            <button type='button' onClick={() => setOpen(false)} aria-label='Закрыть поддержку'>
              <X size={18} strokeWidth={2.4} />
            </button>
          </header>

          {state === 'sent' ? (
            <section className='p7-support-chat-success' role='status'>
              <CheckCircle2 size={38} strokeWidth={2.2} />
              <strong>Обращение отправлено</strong>
              <p>Вопрос принят. Ответ придёт на указанный контакт после проверки сообщения.</p>
              <button type='button' onClick={() => setState('idle')}>Отправить ещё вопрос</button>
            </section>
          ) : (
            <form className='p7-support-chat-form' onSubmit={submit} onFocusCapture={(event) => scrollFocusedControlIntoPanel(event.target)}>
              <label>
                <span>Тема</span>
                <select value={topic} onChange={(event) => setTopic(event.target.value as Topic)}>
                  {TOPICS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label>
                <span>Имя</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder='Фамилия и имя' autoComplete='name' maxLength={80} />
              </label>
              <label>
                <span>Телефон или email</span>
                <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder='+7... или email' autoComplete='email' maxLength={120} />
              </label>
              <label>
                <span>Вопрос</span>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder='Коротко опишите вопрос по платформе, пилоту, доступу, документам или техническому подключению.' rows={5} maxLength={2000} />
              </label>
              <label className='p7-support-chat-consent'>
                <input type='checkbox' checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
                <span>{CONSENT_TEXT}<a href='/platform-v7/privacy'>{CONSENT_LINK_TEXT}</a>.</span>
              </label>
              {error ? <p className='p7-support-chat-error' role='alert'>{error}</p> : null}
              <button className='p7-support-chat-submit' type='submit' disabled={state === 'sending'}>
                {state === 'sending' ? 'Отправляем…' : 'Отправить'}
                <Send size={16} strokeWidth={2.35} />
              </button>
            </form>
          )}
        </aside>
      ) : null}

      <style>{css}</style>
    </>
  );
}

const css = `
html:has(.p7-support-chat-panel),
body:has(.p7-support-chat-panel) {
  width: 100% !important;
  max-width: 100% !important;
  overflow-x: hidden !important;
  overscroll-behavior-x: none !important;
  -webkit-text-size-adjust: 100% !important;
  text-size-adjust: 100% !important;
}

.p7-support-chat-button {
  position: fixed;
  right: max(14px, env(safe-area-inset-right, 0px));
  bottom: calc(env(safe-area-inset-bottom, 0px) + 112px);
  z-index: 3600;
  width: 54px;
  height: 54px;
  border: 1px solid rgba(255,255,255,.38);
  border-radius: 20px;
  background: #087a3b;
  color: #fff;
  box-shadow: 0 18px 42px rgba(0,122,47,.28);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: manipulation;
}

.p7-support-chat-panel {
  box-sizing: border-box;
  position: fixed;
  left: var(--p7-support-left, calc((100dvw - min(390px, calc(100dvw - 24px))) / 2)) !important;
  right: auto !important;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 178px) !important;
  top: auto !important;
  transform: none !important;
  z-index: 3600;
  width: var(--p7-support-width, min(390px, calc(100dvw - 24px))) !important;
  max-width: var(--p7-support-width, min(390px, calc(100dvw - 24px))) !important;
  max-height: min(680px, calc(var(--p7-support-vh, 100dvh) - 210px)) !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  overflow-x: hidden;
  border: 1px solid rgba(7,22,17,.1);
  border-radius: 26px;
  background: #fff;
  box-shadow: 0 28px 80px rgba(7,22,17,.24);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #071611;
  overscroll-behavior: contain;
  contain: layout paint;
}

.p7-support-chat-panel:focus-within {
  top: var(--p7-support-top, 8px) !important;
  bottom: auto !important;
  height: var(--p7-support-height, calc(100dvh - 16px)) !important;
  max-height: var(--p7-support-height, calc(100dvh - 16px)) !important;
}

.p7-support-chat-panel,
.p7-support-chat-panel * {
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
}

.p7-support-chat-head {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 38px;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background: #087a3b;
  color: #fff;
  flex: 0 0 auto;
}

.p7-support-chat-head img {
  display: block;
  width: 42px;
  height: 42px;
  object-fit: contain;
}

.p7-support-chat-head strong {
  display: block;
  font-size: 15px;
  line-height: 1.08;
  font-weight: 950;
  letter-spacing: -.02em;
  overflow-wrap: anywhere;
}

.p7-support-chat-head button {
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255,255,255,.22);
  border-radius: 14px;
  background: rgba(255,255,255,.12);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: manipulation;
}

.p7-support-chat-form {
  display: grid;
  gap: 11px;
  padding: 14px;
  overflow: auto;
  overflow-x: hidden;
  min-width: 0;
  -webkit-overflow-scrolling: touch;
}

.p7-support-chat-form label {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.p7-support-chat-form label span {
  color: #52615b;
  font-size: 12px;
  font-weight: 900;
}

.p7-support-chat-form input,
.p7-support-chat-form select,
.p7-support-chat-form textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(7,22,17,.14);
  border-radius: 15px;
  background: #fff;
  color: #071611;
  font: inherit;
  font-size: 16px;
  font-weight: 650;
  outline: none;
  touch-action: manipulation;
  -webkit-appearance: none;
  appearance: none;
}

.p7-support-chat-form input,
.p7-support-chat-form select {
  min-height: 46px;
  padding: 0 12px;
}

.p7-support-chat-form textarea {
  padding: 12px;
  resize: vertical;
  line-height: 1.4;
  min-height: 142px;
  max-height: min(260px, calc(var(--p7-support-vh, 100dvh) - 260px));
}

.p7-support-chat-form input:focus,
.p7-support-chat-form select:focus,
.p7-support-chat-form textarea:focus {
  border-color: rgba(0,122,47,.52);
  box-shadow: 0 0 0 4px rgba(0,122,47,.09);
}

.p7-support-chat-consent {
  display: grid !important;
  grid-template-columns: 20px minmax(0, 1fr) !important;
  gap: 10px !important;
  align-items: start;
  padding: 10px 12px;
  border: 1px solid rgba(0,122,47,.16);
  border-radius: 15px;
  background: #f6fbf8;
}

.p7-support-chat-consent input {
  width: 18px !important;
  height: 18px !important;
  min-height: 18px !important;
  margin: 2px 0 0;
  accent-color: #087a3b;
  -webkit-appearance: auto;
  appearance: auto;
}

.p7-support-chat-consent span {
  color: #52615b !important;
  font-size: 12px !important;
  line-height: 1.35;
  font-weight: 650 !important;
  overflow-wrap: anywhere;
}

.p7-support-chat-consent a {
  color: #087a3b;
  font-weight: 850;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.p7-support-chat-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: #fff4e8;
  color: #8a3d00;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.p7-support-chat-submit {
  min-height: 48px;
  border: 0;
  border-radius: 16px;
  background: #087a3b;
  color: #fff;
  font-weight: 950;
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 14px 30px rgba(0,122,47,.22);
  touch-action: manipulation;
}

.p7-support-chat-submit:disabled {
  opacity: .7;
  cursor: wait;
}

.p7-support-chat-success {
  display: grid;
  gap: 10px;
  padding: 18px;
  min-width: 0;
  overflow: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

.p7-support-chat-success svg { color: #087a3b; }

.p7-support-chat-success strong {
  font-size: 22px;
  line-height: 1.05;
  font-weight: 950;
  letter-spacing: -.04em;
  overflow-wrap: anywhere;
}

.p7-support-chat-success p {
  margin: 0;
  color: #52615b;
  font-size: 14px;
  line-height: 1.45;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.p7-support-chat-success button {
  min-height: 46px;
  border-radius: 15px;
  border: 1px solid rgba(0,122,47,.22);
  background: #f2faf5;
  color: #087a3b;
  font-weight: 950;
  cursor: pointer;
  touch-action: manipulation;
}

@media (max-width: 720px) {
  .p7-support-chat-button {
    right: max(14px, env(safe-area-inset-right, 0px));
    bottom: calc(env(safe-area-inset-bottom, 0px) + 118px);
    width: 54px;
    height: 54px;
    border-radius: 19px;
  }

  .p7-support-chat-panel {
    left: var(--p7-support-left, 10px) !important;
    right: auto !important;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 184px) !important;
    top: auto !important;
    transform: none !important;
    width: var(--p7-support-width, calc(100dvw - 20px)) !important;
    max-width: var(--p7-support-width, calc(100dvw - 20px)) !important;
    max-height: calc(var(--p7-support-vh, 100dvh) - 236px) !important;
    border-radius: 24px;
  }

  .p7-support-chat-panel:focus-within {
    top: var(--p7-support-top, 8px) !important;
    bottom: auto !important;
    height: var(--p7-support-height, calc(100dvh - 16px)) !important;
    max-height: var(--p7-support-height, calc(100dvh - 16px)) !important;
  }

  .p7-support-chat-head {
    grid-template-columns: 38px minmax(0, 1fr) 36px;
    padding: 12px;
  }

  .p7-support-chat-head img {
    width: 38px;
    height: 38px;
  }

  .p7-support-chat-head strong {
    font-size: 14px;
  }

  .p7-support-chat-form {
    padding: 12px;
  }

  .p7-support-chat-success {
    padding: 16px;
  }

  .p7-support-chat-success strong {
    font-size: 20px;
  }

  .p7-support-chat-success p {
    font-size: 13px;
  }
}

@media (max-width: 380px) {
  .p7-support-chat-panel { border-radius: 22px; }
  .p7-support-chat-head { gap: 8px; }
  .p7-support-chat-head strong { font-size: 13px; }
  .p7-support-chat-form input,
  .p7-support-chat-form select,
  .p7-support-chat-form textarea,
  .p7-support-chat-submit { font-size: 16px; }
}
`;
