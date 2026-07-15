'use client';

import * as React from 'react';
import { CheckCircle2, MessageCircle, Send, X } from 'lucide-react';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

type SubmitState = 'idle' | 'sending' | 'sent' | 'error';
type Topic = 'platform' | 'pilot' | 'bank_partner' | 'region' | 'technical' | 'other';
type SupportLocale = 'ru' | 'en' | 'zh';
type SupportProfile = { name: string; contact: string; organization: string };

const SUPPORT_PROFILE_PRIMARY_KEY = 'pc_v7_support_profile';
const SUPPORT_PROFILE_KEYS = [SUPPORT_PROFILE_PRIMARY_KEY, 'pc_v7_registration_profile', 'pc_v7_profile'];

const SUPPORT_COPY = {
  ru: {
    open: 'Открыть поддержку', close: 'Закрыть поддержку', title: 'Поддержка Прозрачной Цены',
    intro: 'Опишите вопрос. Не указывайте пароль, платёжные реквизиты или данные реальной сделки.',
    topic: 'Тема', name: 'Имя', namePlaceholder: 'Как к вам обращаться', contact: 'Телефон или email', contactPlaceholder: 'Контакт для ответа',
    question: 'Вопрос', questionPlaceholder: 'Коротко опишите вопрос по доступу, документам, подключению или работе платформы.',
    profile: 'Данные из личного кабинета', consent: 'Я согласен на обработку персональных данных для ответа на обращение и принимаю условия ',
    privacy: 'политики конфиденциальности', send: 'Отправить', sending: 'Отправляем…', sent: 'Обращение отправлено',
    sentNote: 'Вопрос принят. Ответ придёт на указанный контакт после проверки сообщения.', again: 'Отправить ещё вопрос',
    requiredName: 'Укажите имя.', requiredContact: 'Укажите телефон или email для ответа.', requiredQuestion: 'Напишите вопрос.', requiredConsent: 'Подтвердите согласие на обработку данных.',
    deliveryError: 'Обращение не отправлено. Повторите попытку позже или используйте страницу контактов.',
    topics: { platform: 'Платформа', pilot: 'Подключение организации', bank_partner: 'Банк / партнёр', region: 'Регион', technical: 'Технический вопрос', other: 'Другое' },
  },
  en: {
    open: 'Open support', close: 'Close support', title: 'Transparent Price support',
    intro: 'Describe your question. Do not provide passwords, payment credentials or real deal data.',
    topic: 'Topic', name: 'Name', namePlaceholder: 'How should we address you?', contact: 'Phone or email', contactPlaceholder: 'Contact for the reply',
    question: 'Question', questionPlaceholder: 'Briefly describe your question about access, documents, connection or platform operation.',
    profile: 'Data from your workspace', consent: 'I agree to personal data processing for the purpose of replying and accept the ',
    privacy: 'privacy policy', send: 'Send', sending: 'Sending…', sent: 'Request sent',
    sentNote: 'Your question has been accepted. A reply will be sent to the provided contact after review.', again: 'Send another question',
    requiredName: 'Enter your name.', requiredContact: 'Enter a phone number or email for the reply.', requiredQuestion: 'Enter your question.', requiredConsent: 'Confirm consent to personal data processing.',
    deliveryError: 'The request was not sent. Try again later or use the contact page.',
    topics: { platform: 'Platform', pilot: 'Organisation connection', bank_partner: 'Bank / partner', region: 'Region', technical: 'Technical question', other: 'Other' },
  },
  zh: {
    open: '打开支持', close: '关闭支持', title: '透明价格支持',
    intro: '请描述问题。不要提供密码、支付凭据或真实交易数据。',
    topic: '主题', name: '姓名', namePlaceholder: '如何称呼你', contact: '电话或邮箱', contactPlaceholder: '用于回复的联系方式',
    question: '问题', questionPlaceholder: '请简要描述有关访问、文件、接入或平台运行的问题。',
    profile: '工作台中的资料', consent: '我同意为回复本次咨询处理个人数据，并接受',
    privacy: '隐私政策', send: '发送', sending: '发送中…', sent: '咨询已发送',
    sentNote: '问题已接收。审核后将通过所填联系方式回复。', again: '再次发送问题',
    requiredName: '请输入姓名。', requiredContact: '请输入用于回复的电话或邮箱。', requiredQuestion: '请输入问题。', requiredConsent: '请确认同意处理个人数据。',
    deliveryError: '咨询未发送。请稍后重试或使用联系页面。',
    topics: { platform: '平台', pilot: '组织接入', bank_partner: '银行 / 合作伙伴', region: '地区', technical: '技术问题', other: '其他' },
  },
} as const;

function clean(value: string, limit: number) {
  return value.trim().replace(/\s+/g, ' ').slice(0, limit);
}

function pickText(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string') {
      const cleaned = clean(value, 160);
      if (cleaned) return cleaned;
    }
  }
  return '';
}

function parseProfile(raw: string | null): SupportProfile | null {
  if (!raw) return null;
  try {
    const source = JSON.parse(raw) as Record<string, unknown>;
    const name = pickText(source, ['name', 'fullName', 'fio', 'responsibleName', 'contactName']);
    const email = pickText(source, ['email', 'login']);
    const phone = pickText(source, ['phone', 'tel']);
    const contact = pickText(source, ['contact']) || email || phone;
    const organization = pickText(source, ['organization', 'company', 'orgName']);
    if (!name && !contact && !organization) return null;
    return { name, contact, organization };
  } catch {
    return null;
  }
}

function readCabinetSupportProfile(): SupportProfile | null {
  if (typeof window === 'undefined') return null;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    for (const key of SUPPORT_PROFILE_KEYS) {
      const profile = parseProfile(storage.getItem(key));
      if (profile) return profile;
    }
  }
  return null;
}

function storeSupportProfile(profile: Partial<SupportProfile>) {
  if (typeof window === 'undefined') return;
  const existing = readCabinetSupportProfile();
  const next: SupportProfile = {
    name: clean(profile.name || existing?.name || '', 80),
    contact: clean(profile.contact || existing?.contact || '', 120),
    organization: clean(profile.organization || existing?.organization || '', 120),
  };
  if (!next.name && !next.contact && !next.organization) return;
  const value = JSON.stringify(next);
  try { window.sessionStorage.setItem(SUPPORT_PROFILE_PRIMARY_KEY, value); } catch {}
  try { window.localStorage.setItem(SUPPORT_PROFILE_PRIMARY_KEY, value); } catch {}
}

function labelledFieldValue(root: ParentNode, labels: string[]) {
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  for (const label of Array.from(root.querySelectorAll('label'))) {
    const labelText = (label.textContent || '').toLowerCase();
    if (!normalizedLabels.some((needle) => labelText.includes(needle))) continue;
    const field = label.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select');
    if (field && 'value' in field) return clean(field.value, 160);
  }
  return '';
}

function rememberSupportProfileFromSurface(surface: ParentNode) {
  const name = labelledFieldValue(surface, ['фио ответственного', 'ответственный', 'имя', 'name']);
  const phone = labelledFieldValue(surface, ['телефон', 'phone']);
  const email = labelledFieldValue(surface, ['email', 'электронная почта']);
  const login = labelledFieldValue(surface, ['логин', 'login']);
  const contact = clean(email || phone || login, 120);
  const organization = clean(labelledFieldValue(surface, ['название организации', 'организация', 'компания', 'organisation', 'organization', 'company']), 120);
  if (!name && !contact && !organization) return;
  storeSupportProfile({ name, contact, organization });
}

function resolveLocale(): SupportLocale {
  if (typeof window === 'undefined') return 'ru';
  const query = new URLSearchParams(window.location.search).get('lang');
  const html = document.documentElement.lang.toLowerCase();
  if (query === 'zh' || html.startsWith('zh')) return 'zh';
  if (query === 'en' || html.startsWith('en')) return 'en';
  return 'ru';
}

function focusableElements(root: HTMLElement) {
  const selector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((node) => !node.hasAttribute('hidden') && node.getAttribute('aria-hidden') !== 'true');
}

export function ChatSupportWidget() {
  const [open, setOpen] = React.useState(false);
  const [locale, setLocale] = React.useState<SupportLocale>('ru');
  const [topic, setTopic] = React.useState<Topic>('platform');
  const [name, setName] = React.useState('');
  const [contact, setContact] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  const [state, setState] = React.useState<SubmitState>('idle');
  const [error, setError] = React.useState('');
  const [cabinetProfile, setCabinetProfile] = React.useState<SupportProfile | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLElement>(null);
  const firstControlRef = React.useRef<HTMLSelectElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const ui = SUPPORT_COPY[locale];

  React.useEffect(() => setLocale(resolveLocale()), []);

  React.useEffect(() => {
    const rememberFromTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return;
      const surface = target.closest<HTMLElement>('.login-form, .p7-register-page, .p7-contact-form');
      if (surface) rememberSupportProfileFromSurface(surface);
    };
    const remember = (event: Event) => rememberFromTarget(event.target);
    document.addEventListener('input', remember, true);
    document.addEventListener('submit', remember, true);
    return () => {
      document.removeEventListener('input', remember, true);
      document.removeEventListener('submit', remember, true);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const profile = readCabinetSupportProfile();
    setCabinetProfile(profile);
    if (profile?.name && !name) setName(profile.name);
    if (profile?.contact && !contact) setContact(profile.contact);
  }, [open, name, contact]);

  React.useEffect(() => {
    if (!open) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = focusableElements(panelRef.current);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const focusTimer = window.setTimeout(() => firstControlRef.current?.focus(), 40);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    };
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      source: 'support_chat',
      type: topic,
      name: clean(name || cabinetProfile?.name || '', 80),
      organization: clean(cabinetProfile?.organization || '', 120),
      contact: clean(contact || cabinetProfile?.contact || '', 120),
      message: message.trim().slice(0, 2000),
      consent: consent ? 'yes' : 'no',
      website: '',
    };

    if (payload.name.length < 2) return setError(ui.requiredName);
    if (payload.contact.length < 5) return setError(ui.requiredContact);
    if (!payload.message) return setError(ui.requiredQuestion);
    if (!consent) return setError(ui.requiredConsent);

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
      if (!response.ok || result.sent === false || result.delivered === false) throw new Error(`http_${response.status}`);
      setState('sent');
      setMessage('');
      setConsent(false);
      storeSupportProfile({ name: payload.name, contact: payload.contact, organization: payload.organization });
    } catch {
      setState('error');
      setError(ui.deliveryError);
    }
  }

  const hasCabinetIdentity = Boolean((cabinetProfile?.name || '').trim() && (cabinetProfile?.contact || '').trim());

  return (
    <>
      <button
        ref={triggerRef}
        className='p7-support-chat-button'
        type='button'
        onClick={() => setOpen(true)}
        aria-label={ui.open}
        aria-haspopup='dialog'
        aria-expanded={open}
      >
        <MessageCircle size={24} strokeWidth={2.2} />
      </button>

      {open ? (
        <div
          className='p7-support-chat-backdrop'
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <section
            ref={panelRef}
            className='p7-support-chat-panel'
            role='dialog'
            aria-modal='true'
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
          >
            <header className='p7-support-chat-head'>
              <img src={BRAND_LOGO_DATA_URI} alt='' draggable={false} />
              <div>
                <strong id={titleId}>{ui.title}</strong>
                <p id={descriptionId}>{ui.intro}</p>
              </div>
              <button type='button' onClick={() => setOpen(false)} aria-label={ui.close}>
                <X size={20} strokeWidth={2.3} />
              </button>
            </header>

            {state === 'sent' ? (
              <section className='p7-support-chat-success' role='status'>
                <CheckCircle2 size={38} strokeWidth={2.1} />
                <strong>{ui.sent}</strong>
                <p>{ui.sentNote}</p>
                <button type='button' onClick={() => setState('idle')}>{ui.again}</button>
              </section>
            ) : (
              <form className='p7-support-chat-form' onSubmit={submit} noValidate>
                <label>
                  <span>{ui.topic}</span>
                  <select ref={firstControlRef} value={topic} onChange={(event) => setTopic(event.target.value as Topic)}>
                    {(Object.keys(ui.topics) as Topic[]).map((key) => <option key={key} value={key}>{ui.topics[key]}</option>)}
                  </select>
                </label>

                {hasCabinetIdentity ? (
                  <section className='p7-support-chat-profile' aria-label={ui.profile}>
                    <span>{ui.profile}</span>
                    <strong>{cabinetProfile?.name}</strong>
                    <small>{cabinetProfile?.contact}</small>
                  </section>
                ) : (
                  <div className='p7-support-chat-identity'>
                    <label>
                      <span>{ui.name}</span>
                      <input value={name} onChange={(event) => setName(event.target.value)} autoComplete='name' placeholder={ui.namePlaceholder} maxLength={80} />
                    </label>
                    <label>
                      <span>{ui.contact}</span>
                      <input value={contact} onChange={(event) => setContact(event.target.value)} autoComplete='email' inputMode='email' placeholder={ui.contactPlaceholder} maxLength={120} />
                    </label>
                  </div>
                )}

                <label>
                  <span>{ui.question}</span>
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={ui.questionPlaceholder} rows={5} maxLength={2000} />
                </label>

                <label className='p7-support-chat-consent'>
                  <input type='checkbox' checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  <span>{ui.consent}<a href='/platform-v7/privacy'>{ui.privacy}</a>.</span>
                </label>
                {error ? <p className='p7-support-chat-error' role='alert'>{error}</p> : null}
                <button className='p7-support-chat-submit' type='submit' disabled={state === 'sending'}>
                  {state === 'sending' ? ui.sending : ui.send}
                  <Send size={17} strokeWidth={2.2} />
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}

      <style>{css}</style>
    </>
  );
}

const css = `
.p7-support-chat-button {
  position: fixed;
  right: max(16px, env(safe-area-inset-right, 0px));
  bottom: max(16px, env(safe-area-inset-bottom, 0px));
  z-index: 3500;
  width: 48px;
  height: 48px;
  border: 1px solid rgba(255,255,255,.5);
  border-radius: 14px;
  background: #087a3b;
  color: #fff;
  box-shadow: 0 10px 26px rgba(7,54,33,.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: manipulation;
}
.p7-support-chat-button:focus-visible,
.p7-support-chat-panel button:focus-visible,
.p7-support-chat-panel input:focus-visible,
.p7-support-chat-panel select:focus-visible,
.p7-support-chat-panel textarea:focus-visible,
.p7-support-chat-panel a:focus-visible {
  outline: 3px solid #17649b;
  outline-offset: 3px;
}
.p7-support-chat-backdrop {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 24px;
  background: rgba(4,18,12,.52);
  backdrop-filter: blur(2px);
}
.p7-support-chat-panel {
  box-sizing: border-box;
  width: min(430px, 100%);
  max-height: min(760px, calc(100dvh - 48px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(7,22,17,.16);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 80px rgba(7,22,17,.32);
  color: #071611;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.p7-support-chat-panel,
.p7-support-chat-panel * { box-sizing: border-box; min-width: 0; }
.p7-support-chat-head {
  display: grid;
  grid-template-columns: 40px minmax(0,1fr) 44px;
  align-items: start;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #dfe8e2;
  background: #f7faf8;
}
.p7-support-chat-head img { width: 40px; height: 40px; object-fit: contain; }
.p7-support-chat-head strong { display: block; font-size: 17px; line-height: 1.2; font-weight: 850; letter-spacing: -.02em; }
.p7-support-chat-head p { margin: 5px 0 0; color: #52615b; font-size: 12px; line-height: 1.45; font-weight: 600; }
.p7-support-chat-head button {
  width: 44px; height: 44px; border: 1px solid #cfdcd4; border-radius: 12px; background: #fff; color: #071611;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; touch-action: manipulation;
}
.p7-support-chat-form {
  display: grid;
  gap: 14px;
  padding: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.p7-support-chat-form label { display: grid; gap: 7px; }
.p7-support-chat-form label > span { color: #405249; font-size: 13px; line-height: 1.3; font-weight: 760; }
.p7-support-chat-identity { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.p7-support-chat-form input,
.p7-support-chat-form select,
.p7-support-chat-form textarea {
  width: 100%; border: 1px solid #cbd8d0; border-radius: 10px; background: #fff; color: #071611;
  font: inherit; font-size: 16px; font-weight: 600; outline: none; touch-action: manipulation;
}
.p7-support-chat-form input,
.p7-support-chat-form select { min-height: 48px; padding: 0 12px; }
.p7-support-chat-form textarea { min-height: 132px; padding: 12px; resize: vertical; line-height: 1.45; }
.p7-support-chat-form input:focus,
.p7-support-chat-form select:focus,
.p7-support-chat-form textarea:focus { border-color: #087a3b; box-shadow: 0 0 0 3px rgba(8,122,59,.1); }
.p7-support-chat-profile { display: grid; gap: 4px; padding: 12px; border: 1px solid #cfe0d5; border-radius: 10px; background: #f7faf8; }
.p7-support-chat-profile span { color: #087a3b; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
.p7-support-chat-profile strong { font-size: 15px; }
.p7-support-chat-profile small { color: #52615b; font-size: 13px; }
.p7-support-chat-consent { grid-template-columns: 24px minmax(0,1fr) !important; align-items: start; gap: 10px !important; padding: 12px; border: 1px solid #d5e2da; border-radius: 10px; background: #f7faf8; }
.p7-support-chat-consent input { width: 20px !important; height: 20px !important; min-height: 20px !important; margin: 1px 0 0; accent-color: #087a3b; }
.p7-support-chat-consent span { color: #405249 !important; font-size: 12px !important; line-height: 1.45; font-weight: 600 !important; }
.p7-support-chat-consent a { color: #087a3b; font-weight: 760; text-underline-offset: 2px; }
.p7-support-chat-error { margin: 0; padding: 11px 12px; border-left: 4px solid #b54708; background: #fff5eb; color: #7a2e0e; font-size: 13px; line-height: 1.4; font-weight: 700; }
.p7-support-chat-submit {
  min-height: 50px; border: 0; border-radius: 10px; background: #087a3b; color: #fff; font-size: 16px; font-weight: 800;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; touch-action: manipulation;
}
.p7-support-chat-submit:disabled { opacity: .65; cursor: wait; }
.p7-support-chat-success { display: grid; gap: 12px; padding: 24px; overflow-y: auto; }
.p7-support-chat-success svg { color: #087a3b; }
.p7-support-chat-success strong { font-size: 24px; line-height: 1.15; letter-spacing: -.025em; }
.p7-support-chat-success p { margin: 0; color: #52615b; font-size: 14px; line-height: 1.5; }
.p7-support-chat-success button { min-height: 48px; border: 1px solid #bcd3c4; border-radius: 10px; background: #f7faf8; color: #075b31; font-weight: 800; cursor: pointer; }
@media (max-width: 720px) {
  .p7-support-chat-button { right: max(12px, env(safe-area-inset-right, 0px)); bottom: max(12px, env(safe-area-inset-bottom, 0px)); }
  .p7-support-chat-backdrop { align-items: flex-end; padding: 0; }
  .p7-support-chat-panel {
    width: 100%; max-height: calc(100dvh - max(12px, env(safe-area-inset-top, 0px)));
    border-radius: 16px 16px 0 0; border-bottom: 0;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .p7-support-chat-head { position: sticky; top: 0; z-index: 1; grid-template-columns: 36px minmax(0,1fr) 44px; padding: 14px; }
  .p7-support-chat-head img { width: 36px; height: 36px; }
  .p7-support-chat-identity { grid-template-columns: minmax(0,1fr); }
  .p7-support-chat-form { padding: 14px; }
}
@media (max-width: 360px) {
  .p7-support-chat-head { gap: 9px; }
  .p7-support-chat-head strong { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .p7-support-chat-backdrop, .p7-support-chat-panel, .p7-support-chat-button { scroll-behavior: auto; transition: none; animation: none; }
}
@media (forced-colors: active) {
  .p7-support-chat-button, .p7-support-chat-submit, .p7-support-chat-head button { border: 2px solid ButtonText; }
}
`;
