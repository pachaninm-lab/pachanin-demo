'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  ExternalLink,
  Loader2,
  Maximize2,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';

type Locale = 'ru' | 'en' | 'zh';
type ChatRole = 'user' | 'assistant';
type Variant = 'floating' | 'workspace';

type Citation = {
  source: 'platform' | 'deal_registry' | 'deal_workspace';
  label: string;
  href: string | null;
  asOf: string;
};

type ServerAnswer = {
  requestId: string;
  answer: string;
  provider: 'local-deterministic' | 'openai-compatible';
  mode: 'read_only';
  role: string;
  dealId: string | null;
  generatedAt: string;
  citations: Citation[];
  limitations: string[];
};

type Message = {
  id: string;
  role: ChatRole;
  content: string;
  citations?: Citation[];
  provider?: ServerAnswer['provider'];
  generatedAt?: string;
};

type Copy = {
  open: string;
  close: string;
  title: string;
  subtitle: string;
  readOnly: string;
  placeholder: string;
  send: string;
  sending: string;
  newChat: string;
  fullPage: string;
  error: string;
  retry: string;
  sources: string;
  localProvider: string;
  externalProvider: string;
  greeting: string;
  dealContext: string;
  roleBoundary: string;
  starterPrompts: string[];
};

const COPY: Record<Locale, Copy> = {
  ru: {
    open: 'Открыть ИИ-помощника',
    close: 'Закрыть ИИ-помощника',
    title: 'Помощник сделки',
    subtitle: 'Знает только твой ролевой контур и доступные сделки',
    readOnly: 'Только чтение',
    placeholder: 'Спроси о сделке, документах, логистике, деньгах или споре…',
    send: 'Отправить',
    sending: 'Формирую ответ…',
    newChat: 'Новый диалог',
    fullPage: 'Открыть на весь экран',
    error: 'Помощник не получил подтверждённый ответ сервера. Данные не были заменены демонстрационными.',
    retry: 'Повторить',
    sources: 'Основания ответа',
    localProvider: 'Локальный защищённый режим',
    externalProvider: 'Подключённая корпоративная модель',
    greeting: 'Я работаю внутри твоего личного кабинета. Могу объяснить доступные сделки, статусы, сроки, документы, логистику, расчёт и спор. Чужие кабинеты и скрытые данные мне недоступны.',
    dealContext: 'Контекст текущей сделки определяется сервером после проверки доступа.',
    roleBoundary: 'Права и данные проверяются сервером при каждом запросе.',
    starterPrompts: [
      'Что требует моего внимания?',
      'Покажи мои доступные сделки',
      'Объясни статус текущей сделки',
      'Почему расчёт может быть заблокирован?',
    ],
  },
  en: {
    open: 'Open AI assistant', close: 'Close AI assistant', title: 'Deal assistant',
    subtitle: 'Knows only your role scope and accessible deals', readOnly: 'Read-only',
    placeholder: 'Ask about a deal, documents, logistics, money or a dispute…', send: 'Send', sending: 'Preparing the answer…',
    newChat: 'New chat', fullPage: 'Open full screen',
    error: 'The assistant did not receive a server-confirmed answer. No synthetic data was substituted.', retry: 'Retry', sources: 'Answer sources',
    localProvider: 'Protected local mode', externalProvider: 'Connected corporate model',
    greeting: 'I work inside your workspace. I can explain accessible deals, status, deadlines, documents, logistics, settlement and disputes. Other workspaces and hidden data are unavailable.',
    dealContext: 'The current deal context is resolved by the server after access verification.', roleBoundary: 'Permissions and data are checked by the server on every request.',
    starterPrompts: ['What needs my attention?', 'Show my accessible deals', 'Explain the current deal status', 'What may block settlement?'],
  },
  zh: {
    open: '打开 AI 助手', close: '关闭 AI 助手', title: '交易助手', subtitle: '只了解你的角色范围和可访问交易', readOnly: '只读',
    placeholder: '询问交易、文件、物流、资金或争议…', send: '发送', sending: '正在生成回答…', newChat: '新对话', fullPage: '全屏打开',
    error: '助手未收到服务器确认的回答，也没有用演示数据替代。', retry: '重试', sources: '回答依据', localProvider: '受保护的本地模式', externalProvider: '已连接企业模型',
    greeting: '我在你的工作区内运行，可以解释可访问交易的状态、期限、文件、物流、结算和争议。其他工作区及隐藏数据不可访问。',
    dealContext: '服务器在验证访问权限后确定当前交易上下文。', roleBoundary: '每次请求都会在服务器端检查权限和数据。',
    starterPrompts: ['什么需要我关注？', '显示我可访问的交易', '解释当前交易状态', '什么会阻止结算？'],
  },
};

function resolveLocale(): Locale {
  if (typeof document === 'undefined') return 'ru';
  const html = document.documentElement.lang.toLowerCase();
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'zh' || html.startsWith('zh')) return 'zh';
  if (query === 'en' || html.startsWith('en')) return 'en';
  return 'ru';
}

function dealIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/platform-v7\/deals\/([^/]+)/u);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function focusableElements(root: HTMLElement) {
  const selector = 'a[href],button:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((node) => !node.hasAttribute('hidden') && node.getAttribute('aria-hidden') !== 'true');
}

function formatTime(value: string | undefined, locale: Locale) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function AiAssistantPanel({ variant = 'floating' }: { variant?: Variant }) {
  const pathname = usePathname() || '/platform-v7';
  const [locale, setLocale] = React.useState<Locale>('ru');
  const [open, setOpen] = React.useState(variant === 'workspace');
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [lastQuestion, setLastQuestion] = React.useState('');
  const panelRef = React.useRef<HTMLElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const messagesRef = React.useRef<HTMLDivElement>(null);
  const ui = COPY[locale];
  const dealId = dealIdFromPath(pathname);

  React.useEffect(() => {
    const next = resolveLocale();
    setLocale(next);
    setMessages((current) => current.length ? current : [{ id: randomId('assistant'), role: 'assistant', content: COPY[next].greeting }]);
  }, []);

  React.useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  React.useEffect(() => {
    if (variant !== 'floating' || !open) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
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
      if (!items.length) return;
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
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    };
  }, [open, variant]);

  const reset = () => {
    setMessages([{ id: randomId('assistant'), role: 'assistant', content: ui.greeting }]);
    setInput('');
    setError('');
    setLastQuestion('');
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const submit = async (question: string) => {
    const normalized = question.trim().slice(0, 4_000);
    if (!normalized || sending) return;
    const userMessage: Message = { id: randomId('user'), role: 'user', content: normalized };
    const previous = messages;
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setSending(true);
    setError('');
    setLastQuestion(normalized);

    try {
      const response = await fetch('/api/proxy/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          message: normalized,
          locale,
          dealId,
          pagePath: pathname,
          history: previous.slice(-8).map((item) => ({ role: item.role, content: item.content.slice(0, 1_000) })),
        }),
      });
      const payload = await response.json().catch(() => null) as ServerAnswer | { message?: string } | null;
      if (!response.ok || !payload || !('answer' in payload) || typeof payload.answer !== 'string') {
        throw new Error(payload && 'message' in payload && typeof payload.message === 'string' ? payload.message : `http_${response.status}`);
      }
      setMessages((current) => [...current, {
        id: payload.requestId || randomId('assistant'),
        role: 'assistant',
        content: payload.answer,
        citations: Array.isArray(payload.citations) ? payload.citations : [],
        provider: payload.provider,
        generatedAt: payload.generatedAt,
      }]);
    } catch {
      setError(ui.error);
    } finally {
      setSending(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(input);
  };

  const onTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit(input);
    }
  };

  const panel = (
    <section
      ref={panelRef}
      className={`p7-ai-panel ${variant === 'workspace' ? 'p7-ai-panel-workspace' : ''}`}
      role={variant === 'floating' ? 'dialog' : 'region'}
      aria-modal={variant === 'floating' ? 'true' : undefined}
      aria-label={ui.title}
      data-testid='role-scoped-ai-assistant'
      data-ai-mode='read-only'
    >
      <header className='p7-ai-head'>
        <span className='p7-ai-brand' aria-hidden='true'><BrandMark size='100%' shadow={false} /></span>
        <div className='p7-ai-heading'>
          <div className='p7-ai-title-row'>
            <strong>{ui.title}</strong>
            <span><ShieldCheck size={13} aria-hidden='true' /> {ui.readOnly}</span>
          </div>
          <p>{ui.subtitle}</p>
        </div>
        <div className='p7-ai-head-actions'>
          <button type='button' onClick={reset} aria-label={ui.newChat} title={ui.newChat}><Sparkles size={18} /></button>
          {variant === 'floating' ? <Link href='/platform-v7/assistant' aria-label={ui.fullPage} title={ui.fullPage}><Maximize2 size={18} /></Link> : null}
          {variant === 'floating' ? <button type='button' onClick={() => setOpen(false)} aria-label={ui.close}><X size={20} /></button> : null}
        </div>
      </header>

      <div className='p7-ai-security-strip'>
        <span><ShieldCheck size={15} aria-hidden='true' /> {ui.roleBoundary}</span>
        {dealId ? <small>{ui.dealContext}</small> : null}
      </div>

      <div ref={messagesRef} className='p7-ai-messages' aria-live='polite'>
        {messages.map((message) => (
          <article key={message.id} className={`p7-ai-message p7-ai-message-${message.role}`}>
            <span className='p7-ai-avatar' aria-hidden='true'>{message.role === 'assistant' ? <Bot size={17} /> : <span>Я</span>}</span>
            <div className='p7-ai-bubble'>
              <div className='p7-ai-content'>{message.content}</div>
              {message.role === 'assistant' && message.provider ? (
                <small className='p7-ai-provider'>{message.provider === 'local-deterministic' ? ui.localProvider : ui.externalProvider}{message.generatedAt ? ` · ${formatTime(message.generatedAt, locale)}` : ''}</small>
              ) : null}
              {message.citations?.length ? (
                <details className='p7-ai-citations'>
                  <summary>{ui.sources}</summary>
                  <div>
                    {message.citations.map((citation, index) => citation.href ? (
                      <Link key={`${citation.source}-${index}`} href={citation.href}>
                        {citation.label}<ExternalLink size={13} aria-hidden='true' />
                      </Link>
                    ) : <span key={`${citation.source}-${index}`}>{citation.label}</span>)}
                  </div>
                </details>
              ) : null}
            </div>
          </article>
        ))}
        {sending ? (
          <article className='p7-ai-message p7-ai-message-assistant' aria-label={ui.sending}>
            <span className='p7-ai-avatar' aria-hidden='true'><Bot size={17} /></span>
            <div className='p7-ai-bubble p7-ai-thinking'><Loader2 size={17} className='p7-ai-spin' /> {ui.sending}</div>
          </article>
        ) : null}
      </div>

      {messages.length <= 1 ? (
        <div className='p7-ai-starters'>
          {ui.starterPrompts.map((prompt) => <button key={prompt} type='button' onClick={() => void submit(prompt)}>{prompt}</button>)}
        </div>
      ) : null}

      {error ? (
        <div className='p7-ai-error' role='alert'>
          <span>{error}</span>
          <button type='button' disabled={!lastQuestion || sending} onClick={() => void submit(lastQuestion)}>{ui.retry}</button>
        </div>
      ) : null}

      <form className='p7-ai-composer' onSubmit={onSubmit}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onTextareaKeyDown}
          rows={2}
          maxLength={4_000}
          placeholder={ui.placeholder}
          aria-label={ui.placeholder}
        />
        <button type='submit' disabled={!input.trim() || sending} aria-label={ui.send} title={ui.send}>
          {sending ? <Loader2 className='p7-ai-spin' size={20} /> : <Send size={20} />}
        </button>
      </form>
    </section>
  );

  if (variant === 'workspace') return <><div className='p7-ai-workspace-wrap'>{panel}</div><style>{css}</style></>;

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        className='p7-ai-trigger'
        onClick={() => setOpen(true)}
        aria-label={ui.open}
        aria-haspopup='dialog'
        aria-expanded={open}
      >
        <MessageCircle size={23} strokeWidth={2.2} />
        <span>AI</span>
      </button>
      {open ? <div className='p7-ai-backdrop' onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>{panel}</div> : null}
      <style>{css}</style>
    </>
  );
}

const css = `
.p7-ai-trigger{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));z-index:3500;width:58px;height:52px;border:1px solid rgba(255,255,255,.55);border-radius:16px;background:#087a3b;color:#fff;box-shadow:0 12px 30px rgba(7,54,33,.24);display:inline-flex;align-items:center;justify-content:center;gap:4px;cursor:pointer;touch-action:manipulation;font:800 11px/1 system-ui}.p7-ai-trigger:hover{background:#066b34}.p7-ai-backdrop{position:fixed;inset:0;z-index:4000;display:flex;align-items:flex-end;justify-content:flex-end;padding:24px;background:rgba(4,18,12,.5);backdrop-filter:blur(3px)}
.p7-ai-panel{box-sizing:border-box;width:min(500px,100%);height:min(820px,calc(100dvh - 48px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(7,22,17,.16);border-radius:18px;background:#fff;box-shadow:0 26px 90px rgba(7,22,17,.34);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.p7-ai-panel,.p7-ai-panel *{box-sizing:border-box;min-width:0}.p7-ai-panel-workspace{width:100%;height:min(820px,calc(100dvh - 210px));min-height:620px;box-shadow:0 18px 60px rgba(7,22,17,.12)}.p7-ai-workspace-wrap{width:100%;padding:0}
.p7-ai-head{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:12px;align-items:center;padding:15px;border-bottom:1px solid #dfe8e2;background:#f7faf8}.p7-ai-brand{display:inline-flex;width:42px;height:42px}.p7-ai-heading strong{font-size:17px;line-height:1.2;font-weight:850;letter-spacing:-.02em}.p7-ai-heading p{margin:4px 0 0;color:#52615b;font-size:12px;line-height:1.35;font-weight:600}.p7-ai-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.p7-ai-title-row>span{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border:1px solid #b9d7c4;border-radius:999px;background:#edf8f1;color:#075b31;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.03em}.p7-ai-head-actions{display:flex;gap:5px}.p7-ai-head-actions button,.p7-ai-head-actions a{width:40px;height:40px;border:1px solid #cfdcd4;border-radius:11px;background:#fff;color:#071611;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none}.p7-ai-security-strip{display:grid;gap:3px;padding:9px 15px;border-bottom:1px solid #e4ece7;background:#fbfdfb;color:#405249;font-size:11px;line-height:1.35}.p7-ai-security-strip span{display:flex;align-items:center;gap:6px;font-weight:760}.p7-ai-security-strip svg{color:#087a3b}.p7-ai-security-strip small{padding-left:21px;color:#69766f}
.p7-ai-messages{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:16px;display:flex;flex-direction:column;gap:14px;background:#fff}.p7-ai-message{display:grid;grid-template-columns:30px minmax(0,1fr);gap:9px;align-items:start;max-width:94%}.p7-ai-message-user{align-self:flex-end;grid-template-columns:minmax(0,1fr) 30px}.p7-ai-message-user .p7-ai-avatar{grid-column:2}.p7-ai-message-user .p7-ai-bubble{grid-column:1;grid-row:1;background:#087a3b;color:#fff;border-color:#087a3b}.p7-ai-avatar{width:30px;height:30px;border-radius:10px;background:#edf8f1;color:#087a3b;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:850}.p7-ai-message-user .p7-ai-avatar{background:#e9eef7;color:#344b70}.p7-ai-bubble{padding:11px 13px;border:1px solid #dbe6df;border-radius:4px 14px 14px 14px;background:#f7faf8}.p7-ai-message-user .p7-ai-bubble{border-radius:14px 4px 14px 14px}.p7-ai-content{white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.55;font-weight:570}.p7-ai-provider{display:block;margin-top:8px;color:#6a776f;font-size:10px;font-weight:700}.p7-ai-message-user .p7-ai-provider{color:rgba(255,255,255,.75)}.p7-ai-thinking{display:flex;align-items:center;gap:8px;color:#52615b}.p7-ai-spin{animation:p7-ai-spin 1s linear infinite}@keyframes p7-ai-spin{to{transform:rotate(360deg)}}
.p7-ai-citations{margin-top:9px;padding-top:8px;border-top:1px solid #dbe6df}.p7-ai-citations summary{cursor:pointer;color:#087a3b;font-size:11px;font-weight:800}.p7-ai-citations>div{display:grid;gap:6px;margin-top:7px}.p7-ai-citations a,.p7-ai-citations span{display:flex;align-items:center;gap:5px;color:#405249;font-size:11px;line-height:1.35;font-weight:680;text-decoration:none}.p7-ai-citations a:hover{text-decoration:underline}.p7-ai-starters{display:flex;gap:7px;overflow-x:auto;padding:0 16px 12px;background:#fff}.p7-ai-starters button{flex:0 0 auto;max-width:260px;min-height:38px;padding:8px 11px;border:1px solid #cfe0d5;border-radius:10px;background:#f7faf8;color:#075b31;font-size:12px;line-height:1.25;font-weight:760;cursor:pointer;text-align:left}.p7-ai-error{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 16px 10px;padding:10px 12px;border-left:4px solid #b54708;border-radius:8px;background:#fff5eb;color:#7a2e0e;font-size:12px;line-height:1.4;font-weight:700}.p7-ai-error button{min-height:36px;padding:0 11px;border:1px solid #e2b795;border-radius:8px;background:#fff;color:#7a2e0e;font-weight:800;cursor:pointer}.p7-ai-composer{display:grid;grid-template-columns:minmax(0,1fr) 48px;gap:9px;align-items:end;padding:12px 15px max(12px,env(safe-area-inset-bottom,0px));border-top:1px solid #dfe8e2;background:#f7faf8}.p7-ai-composer textarea{width:100%;min-height:52px;max-height:160px;padding:13px;border:1px solid #cbd8d0;border-radius:12px;background:#fff;color:#071611;font:600 16px/1.4 inherit;resize:none;outline:none}.p7-ai-composer textarea:focus{border-color:#087a3b;box-shadow:0 0 0 3px rgba(8,122,59,.1)}.p7-ai-composer>button{width:48px;height:48px;border:0;border-radius:12px;background:#087a3b;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.p7-ai-composer>button:disabled{opacity:.45;cursor:not-allowed}.p7-ai-trigger:focus-visible,.p7-ai-panel button:focus-visible,.p7-ai-panel a:focus-visible,.p7-ai-panel textarea:focus-visible{outline:3px solid #17649b;outline-offset:3px}
@media(max-width:720px){.p7-ai-trigger{right:max(12px,env(safe-area-inset-right,0px));bottom:max(12px,env(safe-area-inset-bottom,0px))}.p7-ai-backdrop{padding:0;align-items:flex-end}.p7-ai-panel{width:100%;height:calc(100dvh - max(10px,env(safe-area-inset-top,0px)));border-radius:18px 18px 0 0;border-bottom:0}.p7-ai-panel-workspace{height:calc(100dvh - 150px);min-height:560px;border-radius:14px}.p7-ai-head{grid-template-columns:38px minmax(0,1fr) auto;padding:12px;gap:9px}.p7-ai-brand{width:38px;height:38px}.p7-ai-head-actions button,.p7-ai-head-actions a{width:38px;height:38px}.p7-ai-head-actions a{display:none}.p7-ai-messages{padding:13px}.p7-ai-message{max-width:98%}.p7-ai-content{font-size:14px}.p7-ai-starters{padding:0 13px 10px}.p7-ai-composer{padding-left:12px;padding-right:12px}}
@media(prefers-reduced-motion:reduce){.p7-ai-spin{animation:none}.p7-ai-messages{scroll-behavior:auto}}
`;
