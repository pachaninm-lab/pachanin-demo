'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  CalendarClock,
  CircleDollarSign,
  ExternalLink,
  FileCheck2,
  Loader2,
  Maximize2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';
import {
  AiGatewayStreamError,
  consumeAiGatewayStream,
  type AiGatewayDecision,
  type AiGatewayFinalResponse,
} from '@/lib/platform-v7/ai-gateway-stream';

type Locale = 'ru' | 'en' | 'zh';
type Variant = 'floating' | 'workspace';
type Availability = 'checking' | 'ready' | 'disabled';

type Catalog = Readonly<{
  starterPrompts?: readonly string[];
}>;

type Message = Readonly<{
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: AiGatewayFinalResponse;
}>;

type ReadinessResponse = Readonly<{
  status?: unknown;
  mode?: unknown;
  actionAllowed?: unknown;
  runtime?: unknown;
}>;

type Copy = Readonly<{
  open: string;
  close: string;
  title: string;
  subtitle: string;
  readOnly: string;
  checking: string;
  ready: string;
  unavailable: string;
  unavailableBody: string;
  placeholder: string;
  send: string;
  stop: string;
  newChat: string;
  fullPage: string;
  retry: string;
  error: string;
  sources: string;
  limitations: string;
  summary: string;
  reason: string;
  nextAction: string;
  owner: string;
  deadline: string;
  money: string;
  confidence: string;
  confidenceHigh: string;
  confidenceMedium: string;
  confidenceLow: string;
  evidence: string;
  greetingMorning: string;
  greetingDay: string;
  greetingEvening: string;
  greetingBody: string;
  serverBoundary: string;
  processing: string;
  starterPrompts: readonly string[];
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    open: 'Открыть ИИ-помощника', close: 'Закрыть ИИ-помощника', title: 'Помощник сделки',
    subtitle: 'Ролевой read-only контур платформы', readOnly: 'Только чтение', checking: 'Проверяю контур',
    ready: 'Готов', unavailable: 'Контур недоступен',
    unavailableBody: 'Admitted read-only runtime не подтверждён. Ответы и статические подмены отключены.',
    placeholder: 'Напиши: что происходит, что делать и где риск…', send: 'Отправить', stop: 'Остановить',
    newChat: 'Новый диалог', fullPage: 'Открыть на весь экран', retry: 'Повторить проверку',
    error: 'Подтверждённый ответ не получен. Догадки не подставлены.', sources: 'Основания ответа',
    limitations: 'Ограничения', summary: 'Суть', reason: 'Причина', nextAction: 'Следующий шаг',
    owner: 'Ответственный контур', deadline: 'Срок', money: 'Деньги под контролем', confidence: 'Уверенность',
    confidenceHigh: 'Высокая', confidenceMedium: 'Средняя', confidenceLow: 'Низкая', evidence: 'Подтверждённые факты',
    greetingMorning: 'Доброе утро.', greetingDay: 'Добрый день.', greetingEvening: 'Добрый вечер.',
    greetingBody: 'Я работаю только в пределах твоей серверно подтверждённой роли. Могу объяснить доступную сделку, блокер, следующий шаг, документы, логистику, деньги или спор.',
    serverBoundary: 'Роль, организация, доступ к Сделке и факты проверяются сервером при каждом вопросе.',
    processing: 'Сверяю доступ, факты и источники…',
    starterPrompts: ['Что требует моего внимания?', 'Объясни текущую сделку простыми словами', 'Почему сделка может остановиться?', 'Есть ли деньги под риском?'],
  },
  en: {
    open: 'Open AI assistant', close: 'Close AI assistant', title: 'Deal assistant',
    subtitle: 'Role-scoped read-only platform runtime', readOnly: 'Read-only', checking: 'Checking runtime',
    ready: 'Ready', unavailable: 'Runtime unavailable',
    unavailableBody: 'The admitted read-only runtime is not verified. Answers and static substitutions are disabled.',
    placeholder: 'Ask what is happening, what to do, and where the risk is…', send: 'Send', stop: 'Stop',
    newChat: 'New chat', fullPage: 'Open full screen', retry: 'Check again',
    error: 'A verified answer was not received. No guesswork was substituted.', sources: 'Answer sources',
    limitations: 'Limitations', summary: 'Summary', reason: 'Reason', nextAction: 'Next action',
    owner: 'Responsible scope', deadline: 'Deadline', money: 'Money under control', confidence: 'Confidence',
    confidenceHigh: 'High', confidenceMedium: 'Medium', confidenceLow: 'Low', evidence: 'Verified facts',
    greetingMorning: 'Good morning.', greetingDay: 'Good afternoon.', greetingEvening: 'Good evening.',
    greetingBody: 'I work only inside your server-confirmed role. I can explain an accessible Deal, blocker, next action, documents, logistics, money or a dispute.',
    serverBoundary: 'Role, organization, Deal access and facts are verified by the server for every question.',
    processing: 'Checking access, facts and sources…',
    starterPrompts: ['What needs my attention?', 'Explain the current Deal in plain language', 'Why may the Deal stop?', 'Is any money at risk?'],
  },
  zh: {
    open: '打开 AI 助手', close: '关闭 AI 助手', title: '交易助手', subtitle: '按角色隔离的只读平台运行时',
    readOnly: '只读', checking: '正在检查运行时', ready: '就绪', unavailable: '运行时不可用',
    unavailableBody: '尚未验证已准入的只读运行时。回答和静态替代均已禁用。',
    placeholder: '询问发生了什么、下一步和风险在哪里…', send: '发送', stop: '停止', newChat: '新对话',
    fullPage: '全屏打开', retry: '重新检查', error: '未收到已验证回答，系统未用猜测替代。',
    sources: '回答依据', limitations: '限制', summary: '摘要', reason: '原因', nextAction: '下一步',
    owner: '责任范围', deadline: '期限', money: '受控资金', confidence: '置信度', confidenceHigh: '高',
    confidenceMedium: '中', confidenceLow: '低', evidence: '已验证事实', greetingMorning: '早上好。',
    greetingDay: '下午好。', greetingEvening: '晚上好。',
    greetingBody: '我只在服务器确认的角色范围内工作，可以解释可访问交易、阻塞、下一步、文件、物流、资金或争议。',
    serverBoundary: '每个问题都会在服务器端验证角色、组织、交易访问权限和事实。',
    processing: '正在核对访问权限、事实和来源…',
    starterPrompts: ['现在什么需要我关注？', '用简单语言解释当前交易', '交易为什么可能停止？', '是否有资金风险？'],
  },
};

function resolveLocale(): Locale {
  if (typeof document === 'undefined') return 'ru';
  const query = new URLSearchParams(window.location.search).get('lang');
  const language = document.documentElement.lang.toLowerCase();
  if (query === 'zh' || language.startsWith('zh')) return 'zh';
  if (query === 'en' || language.startsWith('en')) return 'en';
  return 'ru';
}

function dealIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/platform-v7\/deals\/([^/]+)/u);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function timeGreeting(locale: Locale): string {
  const hour = new Date().getHours();
  if (hour < 12) return COPY[locale].greetingMorning;
  if (hour < 18) return COPY[locale].greetingDay;
  return COPY[locale].greetingEvening;
}

function formatDateTime(value: string | null | undefined, locale: Locale): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date);
}

function formatMoney(value: string | null, locale: Locale): string {
  if (!value || !/^-?\d+$/u.test(value)) return '';
  const amount = Number(BigInt(value)) / 100;
  if (!Number.isFinite(amount)) return '';
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: 2,
  }).format(amount);
}

function confidenceLabel(decision: AiGatewayDecision, locale: Locale): string {
  if (decision.confidence === 'high') return COPY[locale].confidenceHigh;
  if (decision.confidence === 'medium') return COPY[locale].confidenceMedium;
  return COPY[locale].confidenceLow;
}

function DecisionCard({ decision, locale }: { decision: AiGatewayDecision; locale: Locale }) {
  const ui = COPY[locale];
  const deadline = formatDateTime(decision.deadlineAt, locale);
  const money = formatMoney(decision.moneyAtRiskKopecks, locale);
  const details = [
    decision.reason ? { icon: <FileCheck2 size={15} />, label: ui.reason, value: decision.reason } : null,
    decision.nextAction ? { icon: <Sparkles size={15} />, label: ui.nextAction, value: decision.nextAction } : null,
    decision.ownerRole ? { icon: <UserRoundCheck size={15} />, label: ui.owner, value: decision.ownerRole } : null,
    deadline ? { icon: <CalendarClock size={15} />, label: ui.deadline, value: deadline } : null,
    money ? { icon: <CircleDollarSign size={15} />, label: ui.money, value: money } : null,
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; value: string }>;
  return (
    <section className='p7-ai-decision' aria-label={ui.summary}>
      <div className='p7-ai-decision-head'><span>{ui.summary}</span><strong>{decision.summary}</strong></div>
      {details.length ? <div className='p7-ai-decision-grid'>{details.map((item) => (
        <div key={`${item.label}-${item.value}`}><span>{item.icon}{item.label}</span><strong>{item.value}</strong></div>
      ))}</div> : null}
      <div className='p7-ai-confidence'><span>{ui.confidence}</span><strong data-confidence={decision.confidence}>{confidenceLabel(decision, locale)}</strong><small>{formatDateTime(decision.dataFreshnessAt, locale)}</small></div>
      {decision.evidence.length ? <details className='p7-ai-evidence'><summary>{ui.evidence} · {decision.evidence.length}</summary><div>{decision.evidence.slice(0, 8).map((item, index) => <p key={`${item.kind}-${index}`}><strong>{item.label}</strong><span>{item.value}</span></p>)}</div></details> : null}
    </section>
  );
}

export function AiAssistantPanel({ variant = 'floating' }: { variant?: Variant }) {
  const pathname = usePathname() || '/platform-v7';
  const [locale, setLocale] = React.useState<Locale>('ru');
  const [open, setOpen] = React.useState(variant === 'workspace');
  const [availability, setAvailability] = React.useState<Availability>('checking');
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [lastQuestion, setLastQuestion] = React.useState('');
  const panelRef = React.useRef<HTMLElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const messagesRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const ui = COPY[locale];
  const dealId = dealIdFromPath(pathname);

  const checkReadiness = React.useCallback(async () => {
    setAvailability('checking');
    try {
      const response = await fetch('/api/proxy/ai-assistant/readiness', {
        cache: 'no-store', headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => null) as ReadinessResponse | null;
      const ready = response.ok && payload?.status === 'READY' && payload.mode === 'read_only'
        && payload.actionAllowed === false && Boolean(payload.runtime);
      setAvailability(ready ? 'ready' : 'disabled');
    } catch {
      setAvailability('disabled');
    }
  }, []);

  React.useEffect(() => {
    const next = resolveLocale();
    setLocale(next);
    setMessages([{ id: randomId('assistant'), role: 'assistant', content: `${timeGreeting(next)} ${COPY[next].greetingBody}` }]);
    void checkReadiness();
    const controller = new AbortController();
    void fetch('/api/proxy/ai-assistant/catalog', {
      cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal,
    }).then(async (response) => {
      if (response.ok) setCatalog(await response.json() as Catalog);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [checkReadiness]);

  React.useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  React.useEffect(() => {
    if (variant !== 'floating' || !open) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    body.style.position = 'fixed'; body.style.top = `-${scrollY}px`; body.style.width = '100%'; body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea:not([disabled])'));
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => {
      window.clearTimeout(timer); document.removeEventListener('keydown', onKeyDown);
      Object.assign(body.style, previous); window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    };
  }, [open, variant]);

  const stop = () => { abortRef.current?.abort(); abortRef.current = null; setSending(false); };
  const reset = () => {
    stop(); setMessages([{ id: randomId('assistant'), role: 'assistant', content: `${timeGreeting(locale)} ${ui.greetingBody}` }]);
    setInput(''); setError(''); setLastQuestion(''); window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const submit = async (question: string) => {
    const normalized = question.trim().slice(0, 4_000);
    if (!normalized || sending || availability !== 'ready') return;
    const history = messages.slice(-10).map((item) => ({ role: item.role, content: item.content.slice(0, 1_200) }));
    const streamId = randomId('assistant-stream');
    setMessages((current) => [...current, { id: randomId('user'), role: 'user', content: normalized }, { id: streamId, role: 'assistant', content: '' }]);
    setInput(''); setError(''); setLastQuestion(normalized); setSending(true);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const response = await fetch('/api/proxy/ai-assistant/chat/stream', {
        method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ message: normalized, locale, dealId, pagePath: pathname, history }),
      });
      await consumeAiGatewayStream(response, {
        onToken: (_delta, answer) => setMessages((current) => current.map((item) => item.id === streamId ? { ...item, content: answer } : item)),
        onDone: (finalResponse) => setMessages((current) => current.map((item) => item.id === streamId ? { ...item, content: finalResponse.answer, response: finalResponse } : item)),
      });
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setMessages((current) => current.filter((item) => item.id !== streamId || Boolean(item.content)));
      setError(reason instanceof AiGatewayStreamError ? `${ui.error} (${reason.code})` : ui.error);
      if (reason instanceof AiGatewayStreamError && reason.code.includes('HTTP_503')) setAvailability('disabled');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false); window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const latest = [...messages].reverse().find((item) => item.response)?.response;
  const statusText = availability === 'ready' ? ui.ready : availability === 'checking' ? ui.checking : ui.unavailable;
  const panel = (
    <section ref={panelRef} className={`p7-ai-panel ${variant === 'workspace' ? 'p7-ai-panel-workspace' : ''}`} role={variant === 'floating' ? 'dialog' : 'region'} aria-modal={variant === 'floating' ? 'true' : undefined} aria-label={ui.title} data-testid='role-scoped-ai-assistant' data-ai-mode='read-only' data-ai-data-mode='authoritative' data-ai-transport='sse-read-only'>
      <header className='p7-ai-head'>
        <span className='p7-ai-brand' aria-hidden='true'><BrandMark size='100%' shadow={false} /></span>
        <div className='p7-ai-heading'><div className='p7-ai-title-row'><strong>{ui.title}</strong><span className={`p7-ai-presence is-${availability}`}><i />{statusText}</span><span className='p7-ai-readonly'><ShieldCheck size={13} />{ui.readOnly}</span></div><p>{ui.subtitle}</p></div>
        <div className='p7-ai-head-actions'><button type='button' onClick={reset} aria-label={ui.newChat}><Sparkles size={18} /></button>{variant === 'floating' ? <Link href='/platform-v7/assistant' aria-label={ui.fullPage}><Maximize2 size={18} /></Link> : null}{variant === 'floating' ? <button type='button' onClick={() => setOpen(false)} aria-label={ui.close}><X size={20} /></button> : null}</div>
      </header>
      <div className='p7-ai-mode-strip'><strong>{ui.readOnly}</strong><span>{ui.serverBoundary}</span></div>
      {availability === 'disabled' ? <div className='p7-ai-runtime-off' role='status'><ShieldCheck size={20} /><div><strong>{ui.unavailable}</strong><p>{ui.unavailableBody}</p></div><button type='button' onClick={() => void checkReadiness()}><RefreshCw size={16} />{ui.retry}</button></div> : null}
      <div ref={messagesRef} className='p7-ai-messages' aria-live='polite'>
        {messages.map((message) => <article key={message.id} className={`p7-ai-message p7-ai-message-${message.role}`}><span className='p7-ai-avatar' aria-hidden='true'>{message.role === 'assistant' ? <Bot size={17} /> : 'Я'}</span><div className='p7-ai-bubble'><div className='p7-ai-content'>{message.content}</div>{message.response ? <DecisionCard decision={message.response.decision} locale={locale} /> : null}{message.response?.citations.length ? <details className='p7-ai-citations'><summary>{ui.sources}</summary><div>{message.response.citations.map((citation, index) => citation.href ? <Link key={`${citation.href}-${index}`} href={citation.href}>{citation.label}<ExternalLink size={13} /></Link> : <span key={`${citation.label}-${index}`}>{citation.label}</span>)}</div></details> : null}{message.response?.limitations.length ? <details className='p7-ai-limitations'><summary>{ui.limitations}</summary><ul>{message.response.limitations.map((item) => <li key={item}>{item}</li>)}</ul></details> : null}</div></article>)}
        {sending ? <article className='p7-ai-message p7-ai-message-assistant'><span className='p7-ai-avatar'><Bot size={17} /></span><div className='p7-ai-bubble p7-ai-thinking'><Loader2 className='p7-ai-spin' size={17} /><strong>{ui.processing}</strong><button type='button' onClick={stop}>{ui.stop}</button></div></article> : null}
      </div>
      {!sending && latest?.decision.followUps.length ? <div className='p7-ai-followups'>{latest.decision.followUps.slice(0, 3).map((prompt) => <button key={prompt} type='button' onClick={() => void submit(prompt)}>{prompt}</button>)}</div> : messages.length <= 1 ? <div className='p7-ai-starters'>{(catalog?.starterPrompts?.length ? catalog.starterPrompts : ui.starterPrompts).slice(0, 5).map((prompt) => <button key={prompt} type='button' disabled={availability !== 'ready'} onClick={() => void submit(prompt)}>{prompt}</button>)}</div> : null}
      {error ? <div className='p7-ai-error' role='alert'><span>{error}</span><button type='button' disabled={!lastQuestion || sending || availability !== 'ready'} onClick={() => void submit(lastQuestion)}>{ui.retry}</button></div> : null}
      <form className='p7-ai-composer' onSubmit={(event) => { event.preventDefault(); void submit(input); }}><textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(input); } }} rows={2} maxLength={4_000} placeholder={ui.placeholder} aria-label={ui.placeholder} disabled={availability !== 'ready'} /><button type='submit' disabled={!input.trim() || sending || availability !== 'ready'} aria-label={ui.send}>{sending ? <Loader2 className='p7-ai-spin' size={20} /> : <Send size={20} />}</button></form>
    </section>
  );
  if (variant === 'workspace') return <><div className='p7-ai-workspace-wrap'>{panel}</div><style>{css}</style></>;
  return <><button ref={triggerRef} type='button' className='p7-ai-trigger' onClick={() => setOpen(true)} aria-label={ui.open} aria-haspopup='dialog' aria-expanded={open}><MessageCircle size={23} /><span>AI</span><i /></button>{open ? <div className='p7-ai-backdrop' onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>{panel}</div> : null}<style>{css}</style></>;
}

const css = `
.p7-ai-trigger{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));z-index:3500;width:62px;height:54px;border:1px solid rgba(255,255,255,.55);border-radius:18px;background:#087a3b;color:#fff;box-shadow:0 14px 34px rgba(7,54,33,.28);display:inline-flex;align-items:center;justify-content:center;gap:5px;cursor:pointer;font:800 11px/1 system-ui}.p7-ai-trigger>i{position:absolute;right:7px;top:7px;width:9px;height:9px;border:2px solid #087a3b;border-radius:50%;background:#6ee7a8}.p7-ai-backdrop{position:fixed;inset:0;z-index:4000;display:flex;align-items:flex-end;justify-content:flex-end;padding:24px;background:rgba(4,18,12,.52);backdrop-filter:blur(4px)}
.p7-ai-panel{box-sizing:border-box;width:min(570px,100%);height:min(850px,calc(100dvh - 48px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(7,22,17,.16);border-radius:22px;background:#fff;box-shadow:0 28px 100px rgba(7,22,17,.36);color:#071611;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.p7-ai-panel *{box-sizing:border-box;min-width:0}.p7-ai-panel-workspace{width:100%;height:min(850px,calc(100dvh - 210px));min-height:640px;box-shadow:0 18px 60px rgba(7,22,17,.12)}.p7-ai-workspace-wrap{width:100%}
.p7-ai-head{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:15px;border-bottom:1px solid #dfe8e2;background:linear-gradient(135deg,#f7faf8,#eef8f2)}.p7-ai-brand{display:inline-flex;width:44px;height:44px}.p7-ai-heading p{margin:4px 0 0;color:#52615b;font-size:12px;font-weight:600}.p7-ai-title-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.p7-ai-title-row>strong{font-size:17px}.p7-ai-title-row>span{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:999px;font-size:10px;font-weight:850;text-transform:uppercase}.p7-ai-presence{border:1px solid #b9d7c4;background:#edf8f1;color:#075b31}.p7-ai-presence>i{width:7px;height:7px;border-radius:50%;background:#19a35b}.p7-ai-presence.is-checking>i{background:#d49a20}.p7-ai-presence.is-disabled{color:#8a341f;border-color:#ecc5ba;background:#fff4f0}.p7-ai-presence.is-disabled>i{background:#d4512f}.p7-ai-readonly{border:1px solid #d4dfd8;background:#fff;color:#405249}.p7-ai-head-actions{display:flex;gap:5px}.p7-ai-head-actions button,.p7-ai-head-actions a{width:40px;height:40px;border:1px solid #cfdcd4;border-radius:12px;background:#fff;color:#071611;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none}
.p7-ai-mode-strip{display:grid;gap:3px;padding:9px 15px;border-bottom:1px solid #e4ece7;background:#fbfdfb;color:#405249;font-size:11px}.p7-ai-mode-strip strong{color:#087a3b;font-size:10px;text-transform:uppercase}.p7-ai-runtime-off{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:12px 15px;border-bottom:1px solid #f0c8bc;background:#fff6f2;color:#6f2d1c}.p7-ai-runtime-off p{margin:3px 0 0;font-size:12px}.p7-ai-runtime-off button{display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid #d99b8b;border-radius:10px;background:#fff;color:#6f2d1c;font-weight:750;cursor:pointer}
.p7-ai-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:15px;background:linear-gradient(#fff,#fbfdfb)}.p7-ai-message{display:grid;grid-template-columns:32px minmax(0,1fr);gap:9px;align-items:start;max-width:96%}.p7-ai-message-user{align-self:flex-end;grid-template-columns:minmax(0,1fr) 32px}.p7-ai-message-user .p7-ai-avatar{grid-column:2}.p7-ai-message-user .p7-ai-bubble{grid-column:1;grid-row:1;background:#087a3b;color:#fff;border-color:#087a3b}.p7-ai-avatar{width:32px;height:32px;border-radius:11px;background:#edf8f1;color:#087a3b;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:850}.p7-ai-message-user .p7-ai-avatar{background:#e9eef7;color:#344b70}.p7-ai-bubble{border:1px solid #dfe8e2;border-radius:5px 17px 17px;background:#fff;box-shadow:0 8px 24px rgba(7,22,17,.06);overflow:hidden}.p7-ai-message-user .p7-ai-bubble{border-radius:17px 5px 17px 17px}.p7-ai-content{padding:12px 14px;white-space:pre-wrap;font-size:14px;line-height:1.55}.p7-ai-thinking{padding:12px 14px;display:flex;align-items:center;gap:9px}.p7-ai-thinking button{margin-left:auto;border:0;background:transparent;color:#087a3b;font-weight:750;cursor:pointer}.p7-ai-spin{animation:p7-ai-spin 1s linear infinite}
.p7-ai-decision{border-top:1px solid #e4ece7;background:#fbfdfb;padding:12px}.p7-ai-decision-head{display:grid;gap:3px}.p7-ai-decision-head span,.p7-ai-decision-grid span,.p7-ai-confidence span{color:#65736c;font-size:10px;font-weight:800;text-transform:uppercase}.p7-ai-decision-head strong{font-size:14px}.p7-ai-decision-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.p7-ai-decision-grid>div{padding:9px;border:1px solid #e0e9e3;border-radius:11px;background:#fff}.p7-ai-decision-grid span{display:flex;align-items:center;gap:5px}.p7-ai-decision-grid strong{display:block;margin-top:5px;font-size:12px;line-height:1.4}.p7-ai-confidence{display:flex;align-items:center;gap:8px;margin-top:10px}.p7-ai-confidence strong{font-size:11px;color:#087a3b}.p7-ai-confidence small{margin-left:auto;color:#69766f}.p7-ai-evidence summary,.p7-ai-citations summary,.p7-ai-limitations summary{cursor:pointer;color:#087a3b;font-size:11px;font-weight:800}.p7-ai-evidence{margin-top:10px}.p7-ai-evidence p{display:grid;gap:2px;margin:7px 0;font-size:12px}.p7-ai-evidence span{color:#52615b}
.p7-ai-citations,.p7-ai-limitations{padding:0 14px 12px}.p7-ai-citations div{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}.p7-ai-citations a,.p7-ai-citations span{display:inline-flex;align-items:center;gap:4px;padding:6px 8px;border:1px solid #dbe7df;border-radius:9px;color:#075b31;font-size:11px;text-decoration:none}.p7-ai-limitations ul{margin:8px 0 0;padding-left:18px;color:#52615b;font-size:11px}.p7-ai-followups,.p7-ai-starters{display:flex;gap:7px;overflow-x:auto;padding:10px 15px;border-top:1px solid #e5ece8}.p7-ai-followups button,.p7-ai-starters button{flex:0 0 auto;max-width:260px;padding:8px 10px;border:1px solid #cfe1d5;border-radius:11px;background:#f5fbf7;color:#075b31;font-size:11px;font-weight:700;cursor:pointer}.p7-ai-followups button:disabled,.p7-ai-starters button:disabled{opacity:.45;cursor:not-allowed}.p7-ai-error{display:flex;align-items:center;gap:10px;padding:10px 15px;border-top:1px solid #efc0b3;background:#fff5f1;color:#7b301e;font-size:12px}.p7-ai-error button{margin-left:auto;border:1px solid #dba493;border-radius:9px;background:#fff;padding:6px 9px;color:#7b301e;font-weight:750;cursor:pointer}.p7-ai-composer{display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:8px;padding:12px 15px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid #dfe8e2;background:#fff}.p7-ai-composer textarea{resize:none;min-height:48px;max-height:130px;border:1px solid #cfdcd4;border-radius:13px;padding:10px 12px;font:500 14px/1.4 inherit;outline:none}.p7-ai-composer textarea:focus{border-color:#087a3b;box-shadow:0 0 0 3px rgba(8,122,59,.1)}.p7-ai-composer button{border:0;border-radius:13px;background:#087a3b;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}.p7-ai-composer button:disabled{opacity:.4;cursor:not-allowed}
@keyframes p7-ai-spin{to{transform:rotate(360deg)}}
@media(max-width:720px){.p7-ai-backdrop{padding:0;align-items:stretch}.p7-ai-panel{width:100%;height:100dvh;border:0;border-radius:0}.p7-ai-panel-workspace{height:calc(100dvh - 120px);min-height:520px;border:1px solid #dfe8e2;border-radius:16px}.p7-ai-head{grid-template-columns:38px minmax(0,1fr) auto;padding:11px}.p7-ai-brand{width:38px;height:38px}.p7-ai-heading p{display:none}.p7-ai-head-actions button,.p7-ai-head-actions a{width:38px;height:38px}.p7-ai-runtime-off{grid-template-columns:auto 1fr}.p7-ai-runtime-off button{grid-column:1/-1;justify-self:start}.p7-ai-messages{padding:12px}.p7-ai-decision-grid{grid-template-columns:1fr}.p7-ai-trigger{right:12px;bottom:max(12px,env(safe-area-inset-bottom,0px))}}
@media(prefers-reduced-motion:reduce){.p7-ai-spin{animation:none}.p7-ai-messages{scroll-behavior:auto}}
`;
