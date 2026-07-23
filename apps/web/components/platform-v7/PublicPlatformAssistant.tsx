'use client';

import * as React from 'react';
import { BookOpenCheck, ExternalLink, Loader2, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';
import {
  AiGatewayStreamError,
  consumeAiGatewayStream,
  type AiGatewayFinalResponse,
} from '@/lib/platform-v7/ai-gateway-stream';

type Locale = 'ru' | 'en' | 'zh';
type Catalog = {
  knowledgeVersion: string;
  dataMode: 'public_knowledge';
  actionAllowed: false;
  title: string;
  description: string;
  starterPrompts: string[];
};
type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: AiGatewayFinalResponse;
};
type ContextPayload = { context: string; prompts: string[] };

type Copy = {
  open: string;
  close: string;
  title: string;
  subtitle: string;
  publicMode: string;
  noAccountData: string;
  greeting: string;
  placeholder: string;
  send: string;
  stop: string;
  newChat: string;
  error: string;
  retry: string;
  facts: string;
  maturity: string;
  sources: string;
  confidence: string;
  high: string;
  medium: string;
  low: string;
  knowledge: string;
  processing: string;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    open: 'Спросить о платформе',
    close: 'Закрыть помощника по платформе',
    title: 'Помощник по платформе',
    subtitle: 'Публичный ИИ без доступа к личным кабинетам',
    publicMode: 'Публичный режим',
    noAccountData: 'Нет доступа к данным ЛК',
    greeting: 'Расскажу, как устроены Сделка, роли, аукцион, логистика, документы, деньги, споры, безопасность и внешние подключения. В публичном режиме я не вижу пользователей и реальные сделки.',
    placeholder: 'Спроси, как работает платформа…',
    send: 'Отправить',
    stop: 'Остановить',
    newChat: 'Новый диалог',
    error: 'Подтверждённый read-only ИИ сейчас недоступен. Статический ответ не подставлен.',
    retry: 'Повторить',
    facts: 'Подтверждённые факты',
    maturity: 'Основание и ограничения',
    sources: 'Источники',
    confidence: 'Уверенность',
    high: 'Высокая',
    medium: 'Средняя',
    low: 'Низкая',
    knowledge: 'Версия знаний',
    processing: 'Получаю подтверждённый ответ…',
  },
  en: {
    open: 'Ask about the platform',
    close: 'Close platform assistant',
    title: 'Platform assistant',
    subtitle: 'Public AI with no workspace access',
    publicMode: 'Public mode',
    noAccountData: 'No account data access',
    greeting: 'I can explain the Deal, roles, auction, logistics, documents, money, disputes, security and external connections. Public mode has no access to users or real deals.',
    placeholder: 'Ask how the platform works…',
    send: 'Send',
    stop: 'Stop',
    newChat: 'New chat',
    error: 'The admitted read-only AI is unavailable. No static answer was substituted.',
    retry: 'Retry',
    facts: 'Verified facts',
    maturity: 'Basis and limitations',
    sources: 'Sources',
    confidence: 'Confidence',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    knowledge: 'Knowledge version',
    processing: 'Receiving a verified answer…',
  },
  zh: {
    open: '询问平台',
    close: '关闭平台助手',
    title: '平台助手',
    subtitle: '不访问工作区数据的公共 AI',
    publicMode: '公共模式',
    noAccountData: '无法访问账户数据',
    greeting: '我可以解释交易、角色、竞价、物流、文件、资金、争议、安全和外部连接。公共模式无法访问用户或真实交易。',
    placeholder: '询问平台如何运作…',
    send: '发送',
    stop: '停止',
    newChat: '新对话',
    error: '已准入的只读 AI 当前不可用，系统未替换为静态回答。',
    retry: '重试',
    facts: '已验证事实',
    maturity: '依据和限制',
    sources: '来源',
    confidence: '置信度',
    high: '高',
    medium: '中',
    low: '低',
    knowledge: '知识版本',
    processing: '正在接收已验证回答…',
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

function messageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function focusable(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
    .filter((node) => !node.hasAttribute('hidden') && node.getAttribute('aria-hidden') !== 'true');
}

function formatTime(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function confidenceLabel(value: AiGatewayFinalResponse['decision']['confidence'], locale: Locale) {
  const ui = COPY[locale];
  if (value === 'high') return ui.high;
  if (value === 'medium') return ui.medium;
  return ui.low;
}

export function PublicPlatformAssistant() {
  const [locale, setLocale] = React.useState<Locale>('ru');
  const [open, setOpen] = React.useState(false);
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [lastQuestion, setLastQuestion] = React.useState('');
  const [contextualPrompts, setContextualPrompts] = React.useState<string[]>([]);
  const [contextName, setContextName] = React.useState('platform');
  const panelRef = React.useRef<HTMLElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const messagesRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const ui = COPY[locale];
  const starterPrompts = contextualPrompts.length ? contextualPrompts : (catalog?.starterPrompts || []);

  React.useEffect(() => {
    const nextLocale = resolveLocale();
    setLocale(nextLocale);
    setMessages([{ id: messageId('assistant'), role: 'assistant', text: COPY[nextLocale].greeting }]);
  }, []);

  React.useEffect(() => {
    const handleContext = (event: Event) => {
      const detail = (event as CustomEvent<ContextPayload>).detail;
      if (!detail || !Array.isArray(detail.prompts)) return;
      setContextName(typeof detail.context === 'string' ? detail.context : 'platform');
      setContextualPrompts(detail.prompts.filter((prompt) => typeof prompt === 'string').slice(0, 6));
      setOpen(true);
      trackEvent('contextual_ai_prompt_opened', { context: detail.context || 'platform', source: 'public_contact_dock' });
    };
    window.addEventListener('pc:public-assistant-context', handleContext);
    return () => window.removeEventListener('pc:public-assistant-context', handleContext);
  }, []);

  React.useEffect(() => {
    if (!open || catalog) return;
    const controller = new AbortController();
    void fetch(`/api/public-platform-assistant?locale=${encodeURIComponent(locale)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as Catalog;
      if (payload.dataMode === 'public_knowledge') setCatalog(payload);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [catalog, locale, open]);

  React.useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = focusable(panelRef.current);
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
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 60);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    };
  }, [open]);

  const reset = () => {
    abortRef.current?.abort();
    setMessages([{ id: messageId('assistant'), role: 'assistant', text: ui.greeting }]);
    setInput('');
    setError('');
    setLastQuestion('');
    setSending(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
    trackEvent('public_platform_assistant_reset');
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
  };

  const submit = async (question: string) => {
    const normalized = question.trim().slice(0, 1_200);
    if (!normalized || sending) return;
    const streamMessageId = messageId('assistant-stream');
    setMessages((current) => [
      ...current,
      { id: messageId('user'), role: 'user', text: normalized },
      { id: streamMessageId, role: 'assistant', text: '' },
    ]);
    setInput('');
    setError('');
    setLastQuestion(normalized);
    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    trackEvent('public_platform_assistant_question', { length: normalized.length, locale, context: contextName });

    try {
      const response = await fetch('/api/public-platform-assistant', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        signal: controller.signal,
        body: JSON.stringify({ message: normalized, locale }),
      });
      await consumeAiGatewayStream(response, {
        onToken: (_delta, answer) => {
          setMessages((current) => current.map((message) => (
            message.id === streamMessageId ? { ...message, text: answer } : message
          )));
        },
        onDone: (finalResponse) => {
          setMessages((current) => current.map((message) => (
            message.id === streamMessageId
              ? { ...message, text: finalResponse.answer, response: finalResponse }
              : message
          )));
          trackEvent('public_platform_assistant_answer', {
            confidence: finalResponse.decision.confidence,
            provider: finalResponse.provider,
            intent: finalResponse.decision.intent,
          });
        },
      });
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setMessages((current) => current.filter((message) => message.id !== streamMessageId || Boolean(message.text)));
      setError(ui.error);
      trackEvent('public_platform_assistant_error', {
        code: reason instanceof AiGatewayStreamError ? reason.code : 'PUBLIC_ASSISTANT_REQUEST_FAILED',
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  return (
    <div className='pc-public-assistant' data-public-platform-assistant='true' data-ai-transport='sse-read-only'>
      <button
        ref={triggerRef}
        type='button'
        className='pc-public-assistant-shortcut'
        aria-haspopup='dialog'
        aria-expanded={open}
        aria-controls='pc-public-assistant-panel'
        onClick={() => {
          window.dispatchEvent(new CustomEvent('pc:public-assistant-context-request'));
          setOpen(true);
          trackEvent('public_platform_assistant_opened', { source: 'home_shortcut' });
        }}
      >
        <span className='pc-public-assistant-shortcut-icon' aria-hidden='true'><Sparkles size={20} /></span>
        <span className='pc-public-assistant-shortcut-copy'><strong>{ui.open}</strong><small>{ui.noAccountData}</small></span>
      </button>

      {open ? (
        <>
          <button className='pc-public-assistant-backdrop' type='button' aria-label={ui.close} onClick={() => setOpen(false)} />
          <section
            ref={panelRef}
            id='pc-public-assistant-panel'
            role='dialog'
            aria-modal='true'
            aria-labelledby='pc-public-assistant-title'
            className='pc-public-assistant-panel'
            data-knowledge-version={catalog?.knowledgeVersion || 'loading'}
            data-context={contextName}
          >
            <header className='pc-public-assistant-header'>
              <div className='pc-public-assistant-identity'>
                <span className='pc-public-assistant-mark' aria-hidden='true'><Sparkles size={20} /></span>
                <div><strong id='pc-public-assistant-title'>{ui.title}</strong><span>{ui.subtitle}</span></div>
              </div>
              <button type='button' className='pc-public-assistant-icon-button' onClick={() => setOpen(false)} aria-label={ui.close}><X size={20} aria-hidden='true' /></button>
            </header>

            <div className='pc-public-assistant-boundary' role='note'>
              <span><BookOpenCheck size={16} aria-hidden='true' />{ui.publicMode}</span>
              <span><ShieldCheck size={16} aria-hidden='true' />{ui.noAccountData}</span>
            </div>

            <div ref={messagesRef} className='pc-public-assistant-messages' aria-live='polite'>
              {messages.map((message) => (
                <article key={message.id} className='pc-public-assistant-message' data-role={message.role}>
                  <div className='pc-public-assistant-bubble'>
                    {message.response ? <strong className='pc-public-assistant-answer-title'>{message.response.decision.summary}</strong> : null}
                    <p>{message.text}</p>
                  </div>
                  {message.response ? (
                    <div className='pc-public-assistant-answer'>
                      {message.response.decision.evidence.length ? (
                        <section>
                          <h3>{ui.facts}</h3>
                          <ul>{message.response.decision.evidence.map((fact, index) => <li key={`${fact.kind}-${index}`}>{fact.value}</li>)}</ul>
                        </section>
                      ) : null}
                      <section className='pc-public-assistant-maturity'>
                        <h3>{ui.maturity}</h3>
                        <p>{message.response.decision.reason || message.response.limitations.join(' ')}</p>
                      </section>
                      <footer>
                        <span>{ui.confidence}: <strong>{confidenceLabel(message.response.decision.confidence, locale)}</strong></span>
                        <span>{formatTime(message.response.generatedAt, locale)}</span>
                      </footer>
                      {message.response.citations.length ? (
                        <nav aria-label={ui.sources}>
                          <strong>{ui.sources}</strong>
                          <div>{message.response.citations.map((source, index) => source.href ? (
                            <a key={`${source.href}-${index}`} href={source.href} onClick={() => trackEvent('public_platform_assistant_source_opened', { intent: message.response?.decision.intent, href: source.href })}>
                              {source.label}<ExternalLink size={14} aria-hidden='true' />
                            </a>
                          ) : <span key={`${source.label}-${index}`}>{source.label}</span>)}</div>
                        </nav>
                      ) : null}
                      {message.response.decision.followUps.length ? (
                        <div className='pc-public-assistant-suggestions'>
                          {message.response.decision.followUps.map((suggestion) => <button key={suggestion} type='button' onClick={() => void submit(suggestion)}>{suggestion}</button>)}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
              {sending ? <div className='pc-public-assistant-processing' role='status'><Loader2 size={17} aria-hidden='true' /><span>{ui.processing}</span></div> : null}
            </div>

            {!messages.some((message) => message.response) && starterPrompts.length ? (
              <div className='pc-public-assistant-starters' data-context={contextName}>
                {starterPrompts.map((prompt) => <button key={prompt} type='button' onClick={() => { trackEvent('contextual_ai_prompt_opened', { context: contextName, action: 'selected' }); void submit(prompt); }}>{prompt}</button>)}
              </div>
            ) : null}

            {error ? (
              <div className='pc-public-assistant-error' role='alert'>
                <span>{error}</span>
                <button type='button' disabled={!lastQuestion || sending} onClick={() => void submit(lastQuestion)}>{ui.retry}</button>
              </div>
            ) : null}

            <form className='pc-public-assistant-form' onSubmit={(event) => { event.preventDefault(); void submit(input); }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 1_200))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submit(input);
                  }
                }}
                rows={2}
                maxLength={1_200}
                placeholder={ui.placeholder}
                aria-label={ui.placeholder}
              />
              <div className='pc-public-assistant-form-actions'>
                <button type='button' className='pc-public-assistant-secondary' onClick={reset}>{ui.newChat}</button>
                {sending
                  ? <button type='button' className='pc-public-assistant-primary' onClick={stop}>{ui.stop}</button>
                  : <button type='submit' className='pc-public-assistant-primary' disabled={!input.trim()}><Send size={16} aria-hidden='true' />{ui.send}</button>}
              </div>
            </form>

            <small className='pc-public-assistant-version'>{ui.knowledge}: {catalog?.knowledgeVersion || '—'}</small>
          </section>
        </>
      ) : null}
    </div>
  );
}
