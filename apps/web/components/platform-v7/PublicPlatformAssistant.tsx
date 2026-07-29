'use client';

import * as React from 'react';
import { ExternalLink, Loader2, RotateCcw, Send, Sparkles, Square, X } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';
import { readGatewayStream, refusalCopy, type GatewayStreamStatus } from '@/lib/platform-v7/ai-gateway-stream';
import type { GatewayRefusal } from '@pc/ai-assistant-stream-contract';

type Locale = 'ru' | 'en' | 'zh';
type Confidence = 'high' | 'medium';

type Source = { label: string; href: string };
type Catalog = {
  knowledgeVersion: string;
  dataMode: 'public_knowledge';
  actionAllowed: false;
  title: string;
  description: string;
  starterPrompts: string[];
};
type Answer = {
  requestId: string;
  generatedAt: string;
  knowledgeVersion: string;
  dataMode: 'public_knowledge';
  mode: 'read_only';
  topic: string;
  title: string;
  answer: string;
  facts: string[];
  maturity: string;
  confidence: Confidence;
  actionAllowed: false;
  sources: Source[];
  suggestions: string[];
  limitations: string[];
};
type StreamedAnswer = {
  status: GatewayStreamStatus;
  refusal: GatewayRefusal | null;
  citations: readonly { sourceId: string; title: string; uri: string }[];
  modelIdentity: string | null;
};
type Message = { id: string; role: 'user' | 'assistant'; text: string; answer?: Answer; stream?: StreamedAnswer };
type ContextPayload = { context: string; prompts: string[] };

type Copy = {
  open: string;
  shortcutHint: string;
  close: string;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyBody: string;
  placeholder: string;
  send: string;
  stop: string;
  newChat: string;
  error: string;
  sources: string;
  details: string;
  confidence: string;
  high: string;
  medium: string;
  privacy: string;
  processing: string;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    open: 'Спросить ИИ',
    shortcutHint: 'О платформе',
    close: 'Закрыть ИИ-помощника',
    title: 'ИИ Прозрачной Цены',
    subtitle: 'Помощник по платформе',
    emptyTitle: 'Что нужно узнать?',
    emptyBody: 'Объясню, как работает платформа, Сделка, роли и связанные процессы.',
    placeholder: 'Задай вопрос о платформе',
    send: 'Отправить',
    stop: 'Остановить ответ',
    newChat: 'Новый диалог',
    error: 'Не удалось получить подтверждённый ответ. Попробуй ещё раз.',
    sources: 'Источники',
    details: 'Основание ответа',
    confidence: 'Уверенность',
    high: 'высокая',
    medium: 'средняя',
    privacy: 'Публичный режим · без доступа к данным личных кабинетов',
    processing: 'Формирую ответ…',
  },
  en: {
    open: 'Ask AI',
    shortcutHint: 'About the platform',
    close: 'Close AI assistant',
    title: 'Transparent Price AI',
    subtitle: 'Platform assistant',
    emptyTitle: 'What would you like to know?',
    emptyBody: 'I can explain the platform, the Deal, roles and related processes.',
    placeholder: 'Ask a question about the platform',
    send: 'Send',
    stop: 'Stop answer',
    newChat: 'New chat',
    error: 'A verified answer was not available. Try again.',
    sources: 'Sources',
    details: 'Basis of the answer',
    confidence: 'Confidence',
    high: 'high',
    medium: 'medium',
    privacy: 'Public mode · no access to workspace data',
    processing: 'Preparing the answer…',
  },
  zh: {
    open: '询问 AI',
    shortcutHint: '关于平台',
    close: '关闭 AI 助手',
    title: '透明价格 AI',
    subtitle: '平台助手',
    emptyTitle: '你想了解什么？',
    emptyBody: '我可以解释平台、交易、角色和相关流程。',
    placeholder: '询问平台相关问题',
    send: '发送',
    stop: '停止回答',
    newChat: '新对话',
    error: '暂时无法获得经过验证的回答，请重试。',
    sources: '来源',
    details: '回答依据',
    confidence: '置信度',
    high: '高',
    medium: '中',
    privacy: '公共模式 · 无法访问工作区数据',
    processing: '正在生成回答…',
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
  return Array.from(root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])'))
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

export function PublicPlatformAssistant() {
  const [locale, setLocale] = React.useState<Locale>('ru');
  const [open, setOpen] = React.useState(false);
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [contextualPrompts, setContextualPrompts] = React.useState<string[]>([]);
  const [contextName, setContextName] = React.useState('platform');
  const panelRef = React.useRef<HTMLElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const messagesRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const ui = COPY[locale];
  const starterPrompts = (contextualPrompts.length ? contextualPrompts : (catalog?.starterPrompts || [])).slice(0, 3);
  const hasConversation = messages.length > 0;
  const hasStreamingMessage = messages.some((message) => message.stream?.status === 'streaming');

  React.useEffect(() => {
    setLocale(resolveLocale());
  }, []);

  React.useEffect(() => {
    const handleContext = (event: Event) => {
      const detail = (event as CustomEvent<ContextPayload>).detail;
      if (!detail || !Array.isArray(detail.prompts)) return;
      setContextName(typeof detail.context === 'string' ? detail.context : 'platform');
      setContextualPrompts(detail.prompts.filter((prompt) => typeof prompt === 'string').slice(0, 3));
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
    setMessages([]);
    setInput('');
    setError('');
    setSending(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
    trackEvent('public_platform_assistant_reset');
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
  };

  const streamAnswer = async (question: string, controller: AbortController): Promise<boolean> => {
    const id = messageId('assistant');
    let opened = false;

    const paint = (snapshot: Parameters<NonNullable<Parameters<typeof readGatewayStream>[1]['onSnapshot']>>[0]) => {
      const stream: StreamedAnswer = {
        status: snapshot.status,
        refusal: snapshot.refusal,
        citations: snapshot.citations.map((citation) => ({
          sourceId: citation.sourceId,
          title: citation.title,
          uri: citation.uri,
        })),
        modelIdentity: snapshot.modelIdentity,
      };
      setMessages((current) => {
        const next = opened ? current.slice(0, -1) : current;
        opened = true;
        return [...next, { id, role: 'assistant', text: snapshot.text, stream }];
      });
    };

    const dropProvisional = () => {
      if (opened) setMessages((current) => current.filter((message) => message.id !== id));
      opened = false;
    };

    let response: Response;
    try {
      response = await fetch('/api/public-platform-assistant?stream=1', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        signal: controller.signal,
        body: JSON.stringify({ message: question, locale }),
      });
    } catch {
      return false;
    }

    const snapshot = await readGatewayStream(response, { mode: 'public', onSnapshot: paint, signal: controller.signal });

    if (snapshot.status === 'answered') {
      trackEvent('public_platform_assistant_stream_answer', { locale, context: contextName });
      return true;
    }

    dropProvisional();

    if (snapshot.refusal === 'FEATURE_DISABLED' || snapshot.refusal === 'MODEL_NOT_ADMITTED' || snapshot.refusal === null) {
      return false;
    }
    if (snapshot.refusal === 'CANCELLED') return true;

    setMessages((current) => [...current, {
      id,
      role: 'assistant',
      text: refusalCopy(locale, snapshot.refusal),
      stream: { status: 'refused', refusal: snapshot.refusal, citations: [], modelIdentity: snapshot.modelIdentity },
    }]);
    trackEvent('public_platform_assistant_stream_refusal', { refusal: snapshot.refusal, locale });
    return true;
  };

  const submit = async (question: string) => {
    const normalized = question.trim().slice(0, 1_200);
    if (!normalized || sending) return;
    setMessages((current) => [...current, { id: messageId('user'), role: 'user', text: normalized }]);
    setInput('');
    setError('');
    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    trackEvent('public_platform_assistant_question', { length: normalized.length, locale, context: contextName });

    try {
      if (await streamAnswer(normalized, controller)) return;

      const response = await fetch('/api/public-platform-assistant', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ message: normalized, locale }),
      });
      const payload = await response.json().catch(() => null) as Answer | null;
      if (!response.ok || !payload || payload.dataMode !== 'public_knowledge' || typeof payload.answer !== 'string') {
        throw new Error(`public_assistant_http_${response.status}`);
      }
      setMessages((current) => [...current, {
        id: payload.requestId || messageId('assistant'),
        role: 'assistant',
        text: payload.answer,
        answer: payload,
      }]);
      trackEvent('public_platform_assistant_answer', { topic: payload.topic, confidence: payload.confidence });
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(ui.error);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  return (
    <div className='pc-public-assistant' data-public-platform-assistant='true'>
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
        <span className='pc-public-assistant-shortcut-copy'><strong>{ui.open}</strong><small>{ui.shortcutHint}</small></span>
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
            data-has-conversation={String(hasConversation)}
          >
            <header className='pc-public-assistant-header'>
              <div className='pc-public-assistant-identity'>
                <span className='pc-public-assistant-mark' aria-hidden='true'><Sparkles size={20} /></span>
                <div><strong id='pc-public-assistant-title'>{ui.title}</strong><span>{ui.subtitle}</span></div>
              </div>
              {hasConversation ? (
                <button type='button' className='pc-public-assistant-header-action' onClick={reset} aria-label={ui.newChat} title={ui.newChat}>
                  <RotateCcw size={18} aria-hidden='true' />
                </button>
              ) : null}
              <button type='button' className='pc-public-assistant-icon-button' onClick={() => setOpen(false)} aria-label={ui.close}>
                <X size={20} aria-hidden='true' />
              </button>
            </header>

            <div ref={messagesRef} className='pc-public-assistant-messages' aria-live='polite'>
              {!hasConversation ? (
                <section className='pc-public-assistant-empty' aria-labelledby='pc-public-assistant-empty-title'>
                  <div className='pc-public-assistant-empty-copy'>
                    <h2 id='pc-public-assistant-empty-title'>{ui.emptyTitle}</h2>
                    <p>{ui.emptyBody}</p>
                  </div>
                  {starterPrompts.length ? (
                    <div className='pc-public-assistant-quick-actions' data-context={contextName}>
                      {starterPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          type='button'
                          onClick={() => {
                            trackEvent('contextual_ai_prompt_opened', { context: contextName, action: 'selected' });
                            void submit(prompt);
                          }}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {messages.map((message) => (
                <article
                  key={message.id}
                  className='pc-public-assistant-message'
                  data-role={message.role}
                  data-stream-status={message.stream?.status}
                  data-stream-refusal={message.stream?.refusal ?? undefined}
                  data-model-identity={message.stream?.modelIdentity ?? undefined}
                >
                  {message.text || message.answer?.title ? (
                    <div className='pc-public-assistant-bubble'>
                      {message.answer ? <strong className='pc-public-assistant-answer-title'>{message.answer.title}</strong> : null}
                      {message.text ? <p>{message.text}</p> : null}
                    </div>
                  ) : null}

                  {message.stream?.status === 'streaming' ? (
                    <p className='pc-public-assistant-stream-provisional' role='status'>
                      <Loader2 size={15} aria-hidden='true' />
                      {ui.processing}
                    </p>
                  ) : null}

                  {message.stream?.status === 'answered' && message.stream.citations.length ? (
                    <div className='pc-public-assistant-answer'>
                      <div className='pc-public-assistant-source-list' role='navigation' aria-label={ui.sources}>
                        {message.stream.citations.map((citation) => (
                          <a key={citation.uri} href={citation.uri}>
                            {citation.title}<ExternalLink size={14} aria-hidden='true' />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {message.answer ? (
                    <div className='pc-public-assistant-answer'>
                      {message.answer.sources.length ? (
                        <div className='pc-public-assistant-source-list' role='navigation' aria-label={ui.sources}>
                          {message.answer.sources.map((source) => (
                            <a
                              key={`${source.href}-${source.label}`}
                              href={source.href}
                              onClick={() => trackEvent('public_platform_assistant_source_opened', {
                                topic: message.answer?.topic,
                                href: source.href,
                              })}
                            >
                              {source.label}<ExternalLink size={14} aria-hidden='true' />
                            </a>
                          ))}
                        </div>
                      ) : null}

                      <details className='pc-public-assistant-details'>
                        <summary>{ui.details}</summary>
                        <div className='pc-public-assistant-details-body'>
                          {message.answer.facts.length ? (
                            <ul>{message.answer.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
                          ) : null}
                          {message.answer.maturity ? <p>{message.answer.maturity}</p> : null}
                          <div className='pc-public-assistant-answer-meta'>
                            <span>{ui.confidence}: {message.answer.confidence === 'high' ? ui.high : ui.medium}</span>
                            <time dateTime={message.answer.generatedAt}>{formatTime(message.answer.generatedAt, locale)}</time>
                          </div>
                        </div>
                      </details>

                      {message.answer.suggestions.length ? (
                        <div className='pc-public-assistant-followups'>
                          {message.answer.suggestions.slice(0, 3).map((suggestion) => (
                            <button key={suggestion} type='button' onClick={() => void submit(suggestion)}>{suggestion}</button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}

              {sending && !hasStreamingMessage ? (
                <div className='pc-public-assistant-processing' role='status'>
                  <Loader2 size={17} aria-hidden='true' /><span>{ui.processing}</span>
                </div>
              ) : null}
            </div>

            {error ? <div className='pc-public-assistant-error' role='alert'>{error}</div> : null}

            <form className='pc-public-assistant-composer' onSubmit={(event) => { event.preventDefault(); void submit(input); }}>
              <div className='pc-public-assistant-composer-shell'>
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
                  rows={1}
                  maxLength={1_200}
                  placeholder={ui.placeholder}
                  aria-label={ui.placeholder}
                />
                {sending ? (
                  <button type='button' className='pc-public-assistant-composer-button' data-kind='stop' onClick={stop} aria-label={ui.stop} title={ui.stop}>
                    <Square size={17} aria-hidden='true' />
                  </button>
                ) : (
                  <button type='submit' className='pc-public-assistant-composer-button' disabled={!input.trim()} aria-label={ui.send} title={ui.send}>
                    <Send size={18} aria-hidden='true' />
                  </button>
                )}
              </div>
              <p className='pc-public-assistant-privacy'>{ui.privacy}</p>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}
