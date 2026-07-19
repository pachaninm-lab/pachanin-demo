'use client';

import * as React from 'react';
import { BookOpenCheck, ExternalLink, Loader2, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';

type Locale = 'ru' | 'en' | 'zh';
type Confidence = 'high' | 'medium';

type Source = {
  label: string;
  href: string;
};

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

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  answer?: Answer;
};

type Copy = {
  open: string;
  close: string;
  title: string;
  subtitle: string;
  publicMode: string;
  noAccountData: string;
  introEyebrow: string;
  introTitle: string;
  greeting: string;
  starterTitle: string;
  starterPrompts: string[];
  placeholder: string;
  send: string;
  stop: string;
  newChat: string;
  error: string;
  facts: string;
  maturity: string;
  sources: string;
  confidence: string;
  high: string;
  medium: string;
  knowledge: string;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    open: 'Спросить ИИ',
    close: 'Закрыть ИИ-помощника',
    title: 'ИИ-помощник',
    subtitle: 'Публичный режим · без доступа к данным сделок',
    publicMode: 'Публичные знания',
    noAccountData: 'Без данных сделок',
    introEyebrow: 'Операционный помощник платформы',
    introTitle: 'Что нужно узнать?',
    greeting: 'Объясню, как устроены аукцион, Сделка, логистика, документы, безопасная оплата и спор. Отвечаю только по подтверждённым публичным материалам.',
    starterTitle: 'Быстрые сценарии',
    starterPrompts: [
      'Как проходит сделка от аукциона до оплаты?',
      'Как работает безопасная оплата?',
      'Какие документы нужны для сделки?',
      'Как подключить организацию?',
    ],
    placeholder: 'Задай вопрос о платформе',
    send: 'Спросить',
    stop: 'Остановить',
    newChat: 'Начать заново',
    error: 'Не удалось получить подтверждённый ответ из публичной базы знаний.',
    facts: 'Ключевые факты',
    maturity: 'Статус зрелости',
    sources: 'Открыть разделы',
    confidence: 'Уверенность',
    high: 'Высокая',
    medium: 'Средняя',
    knowledge: 'Версия знаний',
  },
  en: {
    open: 'Ask AI',
    close: 'Close AI assistant',
    title: 'AI assistant',
    subtitle: 'Public mode · no access to deal data',
    publicMode: 'Public knowledge',
    noAccountData: 'No deal data',
    introEyebrow: 'Platform operations assistant',
    introTitle: 'What do you need to know?',
    greeting: 'I can explain the auction, Deal, logistics, documents, secure payment and disputes. Answers use confirmed public platform materials only.',
    starterTitle: 'Quick paths',
    starterPrompts: [
      'How does a deal run from auction to payment?',
      'How does secure payment work?',
      'Which documents are required for a deal?',
      'How can an organisation connect?',
    ],
    placeholder: 'Ask a question about the platform',
    send: 'Ask',
    stop: 'Stop',
    newChat: 'Start over',
    error: 'A confirmed answer from the public knowledge base was not available.',
    facts: 'Key facts',
    maturity: 'Maturity status',
    sources: 'Open sections',
    confidence: 'Confidence',
    high: 'High',
    medium: 'Medium',
    knowledge: 'Knowledge version',
  },
  zh: {
    open: '询问 AI',
    close: '关闭 AI 助手',
    title: 'AI 助手',
    subtitle: '公共模式 · 无权访问交易数据',
    publicMode: '公共知识',
    noAccountData: '无交易数据',
    introEyebrow: '平台运营助手',
    introTitle: '你想了解什么？',
    greeting: '我可以解释竞价、交易、物流、文件、安全付款和争议流程。回答仅基于已确认的公开平台资料。',
    starterTitle: '快捷场景',
    starterPrompts: [
      '交易如何从竞价推进到付款？',
      '安全付款如何运作？',
      '交易需要哪些文件？',
      '机构如何接入平台？',
    ],
    placeholder: '询问平台相关问题',
    send: '询问',
    stop: '停止',
    newChat: '重新开始',
    error: '无法从公共知识库获得已确认回答。',
    facts: '关键事实',
    maturity: '成熟度状态',
    sources: '打开相关页面',
    confidence: '置信度',
    high: '高',
    medium: '中',
    knowledge: '知识版本',
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

function shouldAutofocusComposer() {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 721px)').matches;
}

export function PublicPlatformAssistant() {
  const [locale, setLocale] = React.useState<Locale>('ru');
  const [open, setOpen] = React.useState(false);
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const panelRef = React.useRef<HTMLElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const messagesRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const ui = COPY[locale];
  const hasConversation = messages.length > 0 || sending;
  const starterPrompts = catalog?.starterPrompts?.length ? catalog.starterPrompts : ui.starterPrompts;

  React.useEffect(() => {
    const nextLocale = resolveLocale();
    setLocale(nextLocale);

    const controller = new AbortController();
    void fetch(`/api/public-platform-assistant?locale=${encodeURIComponent(nextLocale)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as Catalog;
      if (payload.dataMode === 'public_knowledge') setCatalog(payload);
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);

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
    const timer = window.setTimeout(() => {
      if (shouldAutofocusComposer()) textareaRef.current?.focus();
    }, 60);
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
    if (shouldAutofocusComposer()) window.setTimeout(() => textareaRef.current?.focus(), 0);
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
    setMessages((current) => [...current, { id: messageId('user'), role: 'user', text: normalized }]);
    setInput('');
    setError('');
    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    trackEvent('public_platform_assistant_question', { length: normalized.length, locale });

    try {
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
          setOpen(true);
          trackEvent('public_platform_assistant_opened', { source: 'home_shortcut' });
        }}
      >
        <span className='pc-public-assistant-shortcut-icon' aria-hidden='true'><Sparkles size={20} /></span>
        <span className='pc-public-assistant-shortcut-copy'>
          <strong>{ui.open}</strong>
          <small>{ui.publicMode}</small>
        </span>
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
            data-conversation={hasConversation ? 'true' : 'false'}
            data-knowledge-version={catalog?.knowledgeVersion || 'loading'}
          >
            <header className='pc-public-assistant-header'>
              <div className='pc-public-assistant-identity'>
                <span className='pc-public-assistant-mark' aria-hidden='true'><Sparkles size={20} /></span>
                <div>
                  <strong id='pc-public-assistant-title'>{ui.title}</strong>
                  <span>{ui.subtitle}</span>
                </div>
              </div>
              <button type='button' className='pc-public-assistant-icon-button' onClick={() => setOpen(false)} aria-label={ui.close}>
                <X size={20} aria-hidden='true' />
              </button>
            </header>

            <div className='pc-public-assistant-boundary' role='note'>
              <span><BookOpenCheck size={16} aria-hidden='true' />{ui.publicMode}</span>
              <span><ShieldCheck size={16} aria-hidden='true' />{ui.noAccountData}</span>
            </div>

            {!hasConversation ? (
              <>
                <section className='pc-public-assistant-welcome'>
                  <span className='pc-public-assistant-welcome-eyebrow'><Sparkles size={15} aria-hidden='true' />{ui.introEyebrow}</span>
                  <strong>{ui.introTitle}</strong>
                  <p>{ui.greeting}</p>
                </section>
                <section className='pc-public-assistant-starter-block' aria-labelledby='pc-public-assistant-starter-title'>
                  <strong id='pc-public-assistant-starter-title'>{ui.starterTitle}</strong>
                  <div className='pc-public-assistant-starters'>
                    {starterPrompts.slice(0, 4).map((prompt) => (
                      <button key={prompt} type='button' onClick={() => void submit(prompt)}>{prompt}</button>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <div ref={messagesRef} className='pc-public-assistant-messages' aria-live='polite'>
                {messages.map((message) => (
                  <article key={message.id} className='pc-public-assistant-message' data-role={message.role}>
                    <div className='pc-public-assistant-bubble'>
                      {message.answer ? <strong className='pc-public-assistant-answer-title'>{message.answer.title}</strong> : null}
                      <p>{message.text}</p>
                    </div>
                    {message.answer ? (
                      <div className='pc-public-assistant-answer'>
                        <section>
                          <h3>{ui.facts}</h3>
                          <ul>{message.answer.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
                        </section>
                        <section className='pc-public-assistant-maturity'>
                          <h3>{ui.maturity}</h3>
                          <p>{message.answer.maturity}</p>
                        </section>
                        <footer>
                          <span>{ui.confidence}: <strong>{message.answer.confidence === 'high' ? ui.high : ui.medium}</strong></span>
                          <span>{formatTime(message.answer.generatedAt, locale)}</span>
                        </footer>
                        {message.answer.sources.length ? (
                          <nav aria-label={ui.sources}>
                            <strong>{ui.sources}</strong>
                            <div>
                              {message.answer.sources.map((source) => (
                                <a key={`${source.href}-${source.label}`} href={source.href} onClick={() => trackEvent('public_platform_assistant_source_opened', { topic: message.answer?.topic, href: source.href })}>
                                  {source.label}<ExternalLink size={14} aria-hidden='true' />
                                </a>
                              ))}
                            </div>
                          </nav>
                        ) : null}
                        {message.answer.suggestions.length ? (
                          <div className='pc-public-assistant-suggestions'>
                            {message.answer.suggestions.map((suggestion) => (
                              <button key={suggestion} type='button' onClick={() => void submit(suggestion)}>{suggestion}</button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))}
                {sending ? (
                  <div className='pc-public-assistant-processing' role='status'>
                    <Loader2 size={17} aria-hidden='true' />
                    <span>{locale === 'en' ? 'Checking the public knowledge base…' : locale === 'zh' ? '正在检查公共知识库…' : 'Сверяю публичную базу знаний…'}</span>
                  </div>
                ) : null}
              </div>
            )}

            {error ? <div className='pc-public-assistant-error' role='alert'>{error}</div> : null}

            <form className='pc-public-assistant-form' data-single-action={!hasConversation ? 'true' : 'false'} onSubmit={(event) => { event.preventDefault(); void submit(input); }}>
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
                {hasConversation ? <button type='button' className='pc-public-assistant-secondary' onClick={reset}>{ui.newChat}</button> : null}
                {sending ? (
                  <button type='button' className='pc-public-assistant-primary' onClick={stop}>{ui.stop}</button>
                ) : (
                  <button type='submit' className='pc-public-assistant-primary' disabled={!input.trim()}>
                    <Send size={16} aria-hidden='true' />{ui.send}
                  </button>
                )}
              </div>
            </form>

            <small className='pc-public-assistant-version'>{ui.knowledge}: {catalog?.knowledgeVersion || '—'}</small>
          </section>
        </>
      ) : null}
    </div>
  );
}
