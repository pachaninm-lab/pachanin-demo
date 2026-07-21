'use client';

import * as React from 'react';
import { MessageCircle, Phone, Send, Sparkles, X } from 'lucide-react';

type Locale = 'ru' | 'en' | 'zh';

type Copy = {
  ai: string;
  support: string;
  call: string;
  group: string;
  title: string;
  subtitle: string;
  greeting: string;
  placeholder: string;
  send: string;
  close: string;
  note: string;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    ai: 'ИИ',
    support: 'Поддержка',
    call: 'Позвонить',
    group: 'Связь и помощь',
    title: 'Помощник по платформе',
    subtitle: 'Публичный режим без доступа к личным кабинетам',
    greeting: 'Расскажу, как устроены Сделка, роли, логистика, документы, деньги, спор и безопасность.',
    placeholder: 'Спроси, как работает платформа…',
    send: 'Отправить',
    close: 'Закрыть помощника',
    note: 'Ответы основаны только на публичной подтверждённой справке. Помощник не видит пользователей и реальные Сделки.',
  },
  en: {
    ai: 'AI',
    support: 'Support',
    call: 'Call',
    group: 'Help and contact',
    title: 'Platform assistant',
    subtitle: 'Public mode with no workspace access',
    greeting: 'I can explain the Deal, roles, logistics, documents, money, disputes and security.',
    placeholder: 'Ask how the platform works…',
    send: 'Send',
    close: 'Close assistant',
    note: 'Answers use verified public guidance only. The assistant cannot access users or real Deals.',
  },
  zh: {
    ai: 'AI',
    support: '支持',
    call: '致电',
    group: '帮助与联系',
    title: '平台助手',
    subtitle: '公共模式，不访问工作区',
    greeting: '我可以解释交易、角色、物流、文件、资金、争议和安全机制。',
    placeholder: '询问平台如何运作…',
    send: '发送',
    close: '关闭助手',
    note: '回答仅基于已确认的公共说明。助手无法访问用户或真实交易。',
  },
};

function resolveLocale(): Locale {
  if (typeof document === 'undefined') return 'ru';
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'en' || query === 'zh') return query;
  const html = document.documentElement.lang.toLowerCase();
  if (html.startsWith('en')) return 'en';
  if (html.startsWith('zh')) return 'zh';
  return 'ru';
}

function normalized(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function answer(question: string, locale: Locale): string {
  const value = normalized(question);
  const ru = {
    overview: '«Прозрачная Цена» — единый цифровой контур исполнения внебиржевой зерновой сделки. Главный объект системы — Сделка, а остальные функции связывают допуск, торги, логистику, приёмку, документы, деньги, спор и доказательства.',
    deal: 'Канонический путь: цена и условия → допуск → аукцион → Сделка → логистика → приёмка → лаборатория → документы → деньги → спор при необходимости → доказательства → закрытие → аналитика.',
    roles: 'Платформа поддерживает 12 ролей. Роль и организация определяются сервером после одного входа; URL и браузер не назначают права.',
    money: 'Деньги входят в исполнение Сделки: резервирование, основания выплат, частичные выплаты, release по событиям, reconciliation, audit trail и dispute. Неподключённая банковская интеграция не считается действующей.',
    security: 'Доступ ограничивается серверным RBAC и tenant-изоляцией. Помощник не расширяет права, не видит чужие Сделки и не выполняет привилегированные действия без отдельного подтверждения.',
    fallback: 'Уточни вопрос несколькими словами: путь Сделки, роли, логистика, документы, деньги, спор или безопасность.',
  };
  const en = {
    overview: 'Transparent Price is a unified digital execution layer for an OTC grain Deal. Admission, auction, logistics, acceptance, documents, money, disputes and evidence form one controlled history around the Deal.',
    deal: 'Canonical flow: terms and price → admission → auction → Deal → logistics → acceptance → laboratory → documents → money → dispute when required → evidence → closure → analytics.',
    roles: 'The platform supports 12 roles. Role and organisation are resolved by the server after one sign-in; the URL and browser do not assign permissions.',
    money: 'Money is part of Deal execution: reservation, payment bases, partial releases, event-based release, reconciliation, audit trail and dispute handling. Unconnected bank integrations are not presented as live.',
    security: 'Access is enforced by server-side RBAC and tenant isolation. The assistant cannot expand permissions, see other users’ Deals or execute privileged actions without a separate confirmation.',
    fallback: 'Please narrow the question to the Deal path, roles, logistics, documents, money, disputes or security.',
  };
  const zh = {
    overview: '“透明价格”是场外粮食交易的统一数字履约基础设施。准入、竞价、物流、验收、文件、资金、争议和证据围绕同一交易运行。',
    deal: '标准流程：条件与价格 → 准入 → 竞价 → 交易 → 物流 → 验收 → 实验室 → 文件 → 资金 → 必要时争议 → 证据 → 关闭 → 分析。',
    roles: '平台支持12种角色。统一登录后由服务器确定角色和组织，URL和浏览器不能分配权限。',
    money: '资金属于交易履约的一部分：预留、付款依据、分期释放、按事件释放、对账、审计轨迹和争议处理。未接入的银行集成不会被描述为已上线。',
    security: '访问由服务器端RBAC和租户隔离强制执行。助手不能扩大权限、查看他人交易或在没有单独确认的情况下执行高权限操作。',
    fallback: '请将问题缩小到交易流程、角色、物流、文件、资金、争议或安全。',
  };
  const copy = locale === 'en' ? en : locale === 'zh' ? zh : ru;
  if (/роль|участник|покупател|продав|водител|role|participant|buyer|seller|角色|参与/.test(value)) return copy.roles;
  if (/деньг|оплат|банк|расчет|расчёт|money|payment|bank|settlement|资金|付款|银行/.test(value)) return copy.money;
  if (/безопас|доступ|прав|защит|security|access|permission|安全|访问|权限/.test(value)) return copy.security;
  if (/этап|путь|сделк|логист|прием|приём|deal|flow|logistic|acceptance|交易|流程|物流|验收/.test(value)) return copy.deal;
  if (/что это|платформ|прозрачная цена|what is|platform|transparent price|是什么|平台|透明价格/.test(value)) return copy.overview;
  return copy.fallback;
}

export function SingleServerPublicDock() {
  const [locale, setLocale] = React.useState<Locale>('ru');
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<string[]>([]);
  const ui = COPY[locale];

  React.useEffect(() => {
    const next = resolveLocale();
    setLocale(next);
    setMessages([COPY[next].greeting]);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const openSupport = () => {
    const trigger = document.querySelector<HTMLButtonElement>('.p7-support-chat-button');
    if (trigger) trigger.click();
    else window.location.assign('/platform-v7/contact');
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const question = input.trim().slice(0, 1200);
    if (!question) return;
    setMessages((current) => [...current, question, answer(question, locale)]);
    setInput('');
  };

  return (
    <>
      <nav className='pc-ss-contact-dock' aria-label={ui.group} data-hidden={open ? 'true' : 'false'}>
        <button type='button' onClick={() => setOpen(true)} aria-label={ui.ai}>
          <Sparkles size={18} aria-hidden='true' /><strong>{ui.ai}</strong>
        </button>
        <button type='button' onClick={openSupport} aria-label={ui.support}>
          <MessageCircle size={18} aria-hidden='true' /><strong>{ui.support}</strong>
        </button>
        <a href='tel:+79162778989' aria-label={ui.call}>
          <Phone size={18} aria-hidden='true' /><strong>{ui.call}</strong>
        </a>
      </nav>

      {open ? (
        <div className='pc-ss-ai-backdrop' role='presentation' onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className='pc-ss-ai-panel' role='dialog' aria-modal='true' aria-labelledby='pc-ss-ai-title'>
            <header>
              <span aria-hidden='true'><Sparkles size={19} /></span>
              <div><strong id='pc-ss-ai-title'>{ui.title}</strong><small>{ui.subtitle}</small></div>
              <button type='button' onClick={() => setOpen(false)} aria-label={ui.close}><X size={20} /></button>
            </header>
            <div className='pc-ss-ai-messages' aria-live='polite'>
              {messages.map((message, index) => (
                <p key={`${index}-${message.slice(0, 12)}`} data-role={index % 2 === 0 ? 'assistant' : 'user'}>{message}</p>
              ))}
            </div>
            <form onSubmit={submit}>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={ui.placeholder} rows={2} maxLength={1200} />
              <button type='submit' aria-label={ui.send}><Send size={18} /></button>
            </form>
            <small className='pc-ss-ai-note'>{ui.note}</small>
          </section>
        </div>
      ) : null}

      <style>{css}</style>
    </>
  );
}

const css = `
.p7-support-chat-button{position:fixed!important;width:1px!important;height:1px!important;min-width:1px!important;min-height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;clip-path:inset(50%)!important}
.pc-ss-contact-dock{position:fixed;left:50%;bottom:max(10px,calc(env(safe-area-inset-bottom,0px) + 8px));z-index:3500;transform:translateX(-50%);width:min(380px,calc(100vw - 24px));display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;padding:2px;border:1px solid rgba(8,122,59,.58);border-radius:17px;background:rgba(255,255,255,.96);box-shadow:0 12px 30px rgba(9,33,24,.16);backdrop-filter:blur(14px);overflow:hidden}
.pc-ss-contact-dock[data-hidden='true']{visibility:hidden;pointer-events:none}
.pc-ss-contact-dock *{box-sizing:border-box;min-width:0}
.pc-ss-contact-dock button,.pc-ss-contact-dock a{min-height:48px;border:0;border-radius:12px;background:transparent;color:#092118;display:flex;align-items:center;justify-content:center;gap:7px;padding:5px 8px;font:inherit;text-decoration:none;cursor:pointer;touch-action:manipulation}
.pc-ss-contact-dock svg{color:#087a3b;flex:0 0 auto}
.pc-ss-contact-dock strong{font-size:12px;line-height:1.1;font-weight:780;white-space:nowrap}
.pc-ss-contact-dock button:first-child{background:rgba(8,122,59,.07);color:#07572e}
.pc-ss-contact-dock button:focus-visible,.pc-ss-contact-dock a:focus-visible,.pc-ss-ai-panel button:focus-visible,.pc-ss-ai-panel textarea:focus-visible{outline:3px solid #17649b;outline-offset:2px}
.pc-ss-ai-backdrop{position:fixed;inset:0;z-index:4200;display:flex;align-items:flex-end;justify-content:flex-end;padding:20px;background:rgba(4,18,12,.48);backdrop-filter:blur(3px)}
.pc-ss-ai-panel{width:min(440px,100%);max-height:min(760px,calc(100dvh - 40px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(7,22,17,.16);border-radius:18px;background:#fff;color:#071611;box-shadow:0 24px 80px rgba(7,22,17,.32);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.pc-ss-ai-panel *{box-sizing:border-box;min-width:0}
.pc-ss-ai-panel header{display:grid;grid-template-columns:40px minmax(0,1fr) 44px;align-items:center;gap:10px;padding:14px;border-bottom:1px solid #dfe8e2;background:#f7faf8}
.pc-ss-ai-panel header>span{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(8,122,59,.1);color:#087a3b}
.pc-ss-ai-panel header strong{display:block;font-size:17px;line-height:1.2;font-weight:850}.pc-ss-ai-panel header small{display:block;margin-top:3px;color:#52615b;font-size:11px;line-height:1.35;font-weight:650}
.pc-ss-ai-panel header button{width:44px;height:44px;border:1px solid #cfdcd4;border-radius:12px;background:#fff;color:#071611;display:grid;place-items:center;cursor:pointer}
.pc-ss-ai-messages{display:grid;gap:10px;padding:14px;overflow-y:auto;overscroll-behavior:contain}.pc-ss-ai-messages p{max-width:92%;margin:0;padding:11px 12px;border-radius:13px;background:#f3f7f4;color:#233c32;font-size:14px;line-height:1.45;font-weight:620}.pc-ss-ai-messages p[data-role='user']{justify-self:end;background:#087a3b;color:#fff}
.pc-ss-ai-panel form{display:grid;grid-template-columns:minmax(0,1fr) 48px;gap:8px;padding:12px 14px;border-top:1px solid #dfe8e2}.pc-ss-ai-panel textarea{width:100%;min-height:48px;max-height:130px;resize:none;border:1px solid #cbd8d0;border-radius:12px;padding:11px 12px;color:#071611;background:#fff;font:inherit;font-size:16px;line-height:1.35}.pc-ss-ai-panel form button{width:48px;height:48px;border:0;border-radius:12px;background:#087a3b;color:#fff;display:grid;place-items:center;cursor:pointer}.pc-ss-ai-note{display:block;padding:0 14px 14px;color:#607068;font-size:11px;line-height:1.4;font-weight:620}
@media(max-width:720px){.pc-ss-ai-backdrop{padding:0}.pc-ss-ai-panel{width:100%;max-height:calc(100dvh - max(10px,env(safe-area-inset-top,0px)));border-radius:18px 18px 0 0;border-bottom:0;padding-bottom:env(safe-area-inset-bottom,0px)}.pc-ss-contact-dock{width:calc(100vw - 20px);bottom:max(8px,calc(env(safe-area-inset-bottom,0px) + 6px))}}
@media(max-width:360px){.pc-ss-contact-dock button,.pc-ss-contact-dock a{gap:4px;padding-inline:5px}.pc-ss-contact-dock strong{font-size:11px}}
@media(prefers-reduced-motion:reduce){.pc-ss-contact-dock,.pc-ss-ai-panel{transition:none}}
`;
