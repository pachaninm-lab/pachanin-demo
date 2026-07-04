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

function clean(value: string, limit: number) {
  return value.trim().replace(/\s+/g, ' ').slice(0, limit);
}

function deliveryError(reason: string) {
  if (reason.includes('resend_not_configured') && reason.includes('smtp_not_configured')) {
    return 'Обращение не отправлено: не настроена почтовая отправка.';
  }
  if (reason.includes('smtp_failed')) return 'Обращение не отправлено: SMTP-сервер отклонил отправку.';
  if (reason.includes('resend_')) return 'Обращение не отправлено: почтовый провайдер отклонил отправку.';
  return 'Обращение не отправлено. Проверьте почтовые настройки.';
}

export function ChatSupportWidget() {
  const [open, setOpen] = React.useState(false);
  const [topic, setTopic] = React.useState<Topic>('platform');
  const [name, setName] = React.useState('');
  const [contact, setContact] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [state, setState] = React.useState<SubmitState>('idle');
  const [error, setError] = React.useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      source: 'support_chat',
      type: topic,
      name: clean(name, 80),
      organization: '',
      contact: clean(contact, 120),
      message: message.trim().slice(0, 2000),
      consent: 'yes',
      website: '',
    };

    if (payload.name.length < 2) return setError('Укажите имя.');
    if (payload.contact.length < 5) return setError('Укажите телефон или email для ответа.');
    if (!payload.message) return setError('Напишите вопрос.');

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
            <form className='p7-support-chat-form' onSubmit={submit}>
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
              {error ? <p className='p7-support-chat-error' role='alert'>{error}</p> : null}
              <button className='p7-support-chat-submit' type='submit' disabled={state === 'sending'}>
                {state === 'sending' ? 'Отправляем…' : 'Отправить'}
                <Send size={16} strokeWidth={2.35} />
              </button>
              <small>Не отправляйте пароли, ключи доступа, банковские реквизиты и копии документов.</small>
            </form>
          )}
        </aside>
      ) : null}

      <style>{css}</style>
    </>
  );
}

const css = `
html:has(.p7-support-chat-panel),body:has(.p7-support-chat-panel){overflow-x:hidden!important;overscroll-behavior-x:none!important}.p7-support-chat-button{position:fixed;right:max(14px,env(safe-area-inset-right,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 112px);z-index:3600;width:54px;height:54px;border:1px solid rgba(255,255,255,.38);border-radius:20px;background:#087a3b;color:#fff;box-shadow:0 18px 42px rgba(0,122,47,.28);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.p7-support-chat-panel{box-sizing:border-box;position:fixed;left:50%!important;right:auto!important;bottom:calc(env(safe-area-inset-bottom,0px) + 178px)!important;transform:translateX(-50%)!important;z-index:3600;width:min(390px,calc(100vw - 24px))!important;max-width:calc(100vw - 24px)!important;max-height:min(680px,calc(100dvh - 210px))!important;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(7,22,17,.1);border-radius:26px;background:#fff;box-shadow:0 28px 80px rgba(7,22,17,.24);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#071611;overscroll-behavior:contain}.p7-support-chat-panel *{box-sizing:border-box;max-width:100%;min-width:0}.p7-support-chat-head{display:grid;grid-template-columns:42px minmax(0,1fr) 38px;align-items:center;gap:10px;padding:14px;background:#087a3b;color:#fff}.p7-support-chat-head img{display:block;width:42px;height:42px;object-fit:contain}.p7-support-chat-head strong{display:block;font-size:15px;line-height:1.08;font-weight:950;letter-spacing:-.02em;overflow-wrap:anywhere}.p7-support-chat-head button{width:38px;height:38px;border:1px solid rgba(255,255,255,.22);border-radius:14px;background:rgba(255,255,255,.12);color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.p7-support-chat-form{display:grid;gap:11px;padding:14px;overflow:auto;overflow-x:hidden;min-width:0}.p7-support-chat-form label{display:grid;gap:6px;min-width:0}.p7-support-chat-form label span{color:#52615b;font-size:12px;font-weight:900}.p7-support-chat-form input,.p7-support-chat-form select,.p7-support-chat-form textarea{width:100%;min-width:0;border:1px solid rgba(7,22,17,.14);border-radius:15px;background:#fff;color:#071611;font:inherit;font-size:14px;font-weight:650;outline:none}.p7-support-chat-form input,.p7-support-chat-form select{min-height:46px;padding:0 12px}.p7-support-chat-form textarea{padding:12px;resize:vertical;line-height:1.4}.p7-support-chat-form input:focus,.p7-support-chat-form select:focus,.p7-support-chat-form textarea:focus{border-color:rgba(0,122,47,.52);box-shadow:0 0 0 4px rgba(0,122,47,.09)}.p7-support-chat-error{margin:0;padding:10px 12px;border-radius:14px;background:#fff4e8;color:#8a3d00;font-size:13px;line-height:1.35;font-weight:800;overflow-wrap:anywhere}.p7-support-chat-submit{min-height:48px;border:0;border-radius:16px;background:#087a3b;color:#fff;font-weight:950;font-size:14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;box-shadow:0 14px 30px rgba(0,122,47,.22)}.p7-support-chat-submit:disabled{opacity:.7;cursor:wait}.p7-support-chat-form small{color:#6b7772;font-size:11.5px;line-height:1.35;font-weight:650;overflow-wrap:anywhere}.p7-support-chat-success{display:grid;gap:10px;padding:18px;min-width:0;overflow:auto;overflow-x:hidden}.p7-support-chat-success svg{color:#087a3b}.p7-support-chat-success strong{font-size:22px;line-height:1.05;font-weight:950;letter-spacing:-.04em;overflow-wrap:anywhere}.p7-support-chat-success p{margin:0;color:#52615b;font-size:14px;line-height:1.45;font-weight:650;overflow-wrap:anywhere}.p7-support-chat-success button{min-height:46px;border-radius:15px;border:1px solid rgba(0,122,47,.22);background:#f2faf5;color:#087a3b;font-weight:950;cursor:pointer}@media(max-width:720px){.p7-support-chat-button{right:max(14px,env(safe-area-inset-right,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 118px);width:54px;height:54px;border-radius:19px}.p7-support-chat-panel{left:50%!important;right:auto!important;bottom:calc(env(safe-area-inset-bottom,0px) + 184px)!important;width:calc(100vw - 20px)!important;max-width:calc(100vw - 20px)!important;max-height:calc(100dvh - 236px)!important;border-radius:24px;transform:translateX(-50%)!important}.p7-support-chat-panel:focus-within{bottom:calc(env(safe-area-inset-bottom,0px) + 12px)!important;max-height:calc(100dvh - 28px)!important}.p7-support-chat-head{grid-template-columns:38px minmax(0,1fr) 36px;padding:12px}.p7-support-chat-head img{width:38px;height:38px}.p7-support-chat-head strong{font-size:14px}.p7-support-chat-form{padding:12px}.p7-support-chat-success{padding:16px}.p7-support-chat-success strong{font-size:20px}.p7-support-chat-success p{font-size:13px}}@media(max-width:380px){.p7-support-chat-panel{width:calc(100vw - 16px)!important;max-width:calc(100vw - 16px)!important;border-radius:22px}.p7-support-chat-head{gap:8px}.p7-support-chat-head strong{font-size:13px}.p7-support-chat-form input,.p7-support-chat-form select,.p7-support-chat-form textarea{font-size:13px}}
`;
