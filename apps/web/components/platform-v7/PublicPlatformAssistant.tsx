'use client';

import * as React from 'react';
import { BookOpenCheck, ExternalLink, Loader2, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';
import { readGatewayStream, type GatewayStreamStatus } from '@/lib/platform-v7/ai-gateway-stream';
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
/**
 * A message produced by the gateway stream rather than by the knowledge-base
 * lookup. Kept separate from `answer` on purpose: the two are different claims,
 * and a reader must be able to tell a generated answer from a looked-up one.
 */
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
    open: 'Спросить о платформе', close: 'Закрыть помощника по платформе', title: 'Помощник по платформе', subtitle: 'Публичные знания без доступа к личным кабинетам', publicMode: 'Публичный режим', noAccountData: 'Нет доступа к данным ЛК', greeting: 'Расскажу, как устроены Сделка, роли, аукцион, логистика, документы, деньги, споры, безопасность и внешние подключения. В публичном режиме я не вижу пользователей и реальные сделки.', placeholder: 'Спроси, как работает платформа…', send: 'Отправить', stop: 'Остановить', newChat: 'Новый диалог', error: 'Не удалось получить подтверждённый ответ из публичной базы знаний.', facts: 'Ключевые факты', maturity: 'Статус зрелости', sources: 'Открыть разделы', confidence: 'Уверенность', high: 'Высокая', medium: 'Средняя', knowledge: 'Версия знаний',
  },
  en: {
    open: 'Ask about the platform', close: 'Close platform assistant', title: 'Platform assistant', subtitle: 'Public knowledge with no workspace access', publicMode: 'Public mode', noAccountData: 'No account data access', greeting: 'I can explain the Deal, roles, auction, logistics, documents, money, disputes, security and external connections. Public mode has no access to users or real deals.', placeholder: 'Ask how the platform works…', send: 'Send', stop: 'Stop', newChat: 'New chat', error: 'A confirmed answer from the public knowledge base was not available.', facts: 'Key facts', maturity: 'Maturity status', sources: 'Open sections', confidence: 'Confidence', high: 'High', medium: 'Medium', knowledge: 'Knowledge version',
  },
  zh: {
    open: '询问平台', close: '关闭平台助手', title: '平台助手', subtitle: '公共知识，不访问工作区数据', publicMode: '公共模式', noAccountData: '无法访问账户数据', greeting: '我可以解释交易、角色、竞价、物流、文件、资金、争议、安全和外部连接。公共模式无法访问用户或真实交易。', placeholder: '询问平台如何运作…', send: '发送', stop: '停止', newChat: '新对话', error: '无法从公共知识库获得已确认回答。', facts: '关键事实', maturity: '成熟度状态', sources: '打开相关页面', confidence: '置信度', high: '高', medium: '中', knowledge: '知识版本',
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
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
}

/**
 * What a refusal says to a reader.
 *
 * Written as a refusal, not as an apology that trails off into a suggestion —
 * the reader has to be able to tell that no answer was produced, which is the
 * whole point of refusing rather than filling the gap.
 */
function refusalCopy(locale: Locale, refusal: GatewayRefusal | null): string {
  const copy: Record<Locale, Record<string, string>> = {
    ru: {
      ABSTAINED_NO_DATA: 'У меня нет подтверждённого основания для ответа на этот вопрос, и я не буду его придумывать. Переформулируйте вопрос или выберите тему ниже.',
      UPSTREAM_ERROR: 'Ответ не был завершён, поэтому я его не показываю: незаконченный ответ выглядел бы как готовый вывод, к которому помощник не пришёл.',
      DEFAULT: 'Ответ не получен.',
    },
    en: {
      ABSTAINED_NO_DATA: 'I have no verified basis for answering this, and I will not invent one. Rephrase the question or pick a topic below.',
      UPSTREAM_ERROR: 'The answer did not finish, so I am not showing it: an unfinished answer would read as a conclusion the assistant never reached.',
      DEFAULT: 'No answer was produced.',
    },
    zh: {
      ABSTAINED_NO_DATA: '我没有可靠依据回答这个问题，也不会编造答案。请改写问题或选择下面的主题。',
      UPSTREAM_ERROR: '回答没有完成，因此不予显示：未完成的回答会被读作助手并未得出的结论。',
      DEFAULT: '未生成回答。',
    },
  };
  return copy[locale][refusal ?? 'DEFAULT'] ?? copy[locale].DEFAULT;
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
      cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal,
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
    setSending(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
    trackEvent('public_platform_assistant_reset');
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
  };

  /**
   * Try the gateway stream before the knowledge-base lookup.
   *
   * Returns false only when the gateway is simply not switched on in this
   * deployment, which is the one case where falling back to the verified public
   * knowledge base is honest — that lookup never claims to be a model answer.
   * Every other refusal is shown as a refusal: replacing it with a prepared
   * answer is precisely how an assistant comes to look like it concluded
   * something it did not.
   */
  const streamAnswer = async (question: string, controller: AbortController): Promise<boolean> => {
    const id = messageId('assistant');
    let opened = false;

    const paint = (snapshot: Parameters<NonNullable<Parameters<typeof readGatewayStream>[1]['onSnapshot']>>[0]) => {
      const stream: StreamedAnswer = {
        status: snapshot.status,
        refusal: snapshot.refusal,
        citations: snapshot.citations.map((citation) => ({ sourceId: citation.sourceId, title: citation.title, uri: citation.uri })),
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
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        signal: controller.signal, body: JSON.stringify({ message: question, locale }),
      });
    } catch {
      // The stream could not even be opened. That is a transport problem, not a
      // statement about the gateway, so the knowledge base may still answer.
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
      id, role: 'assistant', text: refusalCopy(locale, snapshot.refusal),
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
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, signal: controller.signal, body: JSON.stringify({ message: normalized, locale }),
      });
      const payload = await response.json().catch(() => null) as Answer | null;
      if (!response.ok || !payload || payload.dataMode !== 'public_knowledge' || typeof payload.answer !== 'string') throw new Error(`public_assistant_http_${response.status}`);
      setMessages((current) => [...current, { id: payload.requestId || messageId('assistant'), role: 'assistant', text: payload.answer, answer: payload }]);
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
        <span className='pc-public-assistant-shortcut-copy'><strong>{ui.open}</strong><small>{ui.noAccountData}</small></span>
      </button>

      {open ? (
        <>
          <button className='pc-public-assistant-backdrop' type='button' aria-label={ui.close} onClick={() => setOpen(false)} />
          <section ref={panelRef} id='pc-public-assistant-panel' role='dialog' aria-modal='true' aria-labelledby='pc-public-assistant-title' className='pc-public-assistant-panel' data-knowledge-version={catalog?.knowledgeVersion || 'loading'} data-context={contextName}>
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
                <article key={message.id} className='pc-public-assistant-message' data-role={message.role} data-stream-status={message.stream?.status} data-stream-refusal={message.stream?.refusal ?? undefined}>
                  <div className='pc-public-assistant-bubble'>{message.answer ? <strong className='pc-public-assistant-answer-title'>{message.answer.title}</strong> : null}<p>{message.text}</p></div>
                  {message.stream ? (
                    <div className='pc-public-assistant-stream' data-status={message.stream.status}>
                      {message.stream.status === 'streaming' ? (
                        // Marked provisional for as long as it is provisional. If the
                        // stream never completes this whole message is removed, so an
                        // unfinished answer is never left on screen looking validated.
                        <p className='pc-public-assistant-stream-provisional' role='status'>
                          <Loader2 size={15} aria-hidden='true' />
                          {locale === 'en' ? 'Answer in progress — not yet complete' : locale === 'zh' ? '回答生成中——尚未完成' : 'Ответ ещё формируется — он пока не завершён'}
                        </p>
                      ) : null}
                      {message.stream.status === 'answered' && message.stream.citations.length ? (
                        <nav aria-label={ui.sources}><strong>{ui.sources}</strong><div>{message.stream.citations.map((citation) => <a key={citation.uri} href={citation.uri}>{citation.title}<ExternalLink size={14} aria-hidden='true' /></a>)}</div></nav>
                      ) : null}
                      {message.stream.modelIdentity ? <small className='pc-public-assistant-model'>{locale === 'en' ? 'Admitted model' : locale === 'zh' ? '已准入模型' : 'Допущенная модель'}: {message.stream.modelIdentity}</small> : null}
                    </div>
                  ) : null}
                  {message.answer ? (
                    <div className='pc-public-assistant-answer'>
                      <section><h3>{ui.facts}</h3><ul>{message.answer.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul></section>
                      <section className='pc-public-assistant-maturity'><h3>{ui.maturity}</h3><p>{message.answer.maturity}</p></section>
                      <footer><span>{ui.confidence}: <strong>{message.answer.confidence === 'high' ? ui.high : ui.medium}</strong></span><span>{formatTime(message.answer.generatedAt, locale)}</span></footer>
                      {message.answer.sources.length ? (
                        <nav aria-label={ui.sources}><strong>{ui.sources}</strong><div>{message.answer.sources.map((source) => <a key={`${source.href}-${source.label}`} href={source.href} onClick={() => trackEvent('public_platform_assistant_source_opened', { topic: message.answer?.topic, href: source.href })}>{source.label}<ExternalLink size={14} aria-hidden='true' /></a>)}</div></nav>
                      ) : null}
                      {message.answer.suggestions.length ? <div className='pc-public-assistant-suggestions'>{message.answer.suggestions.map((suggestion) => <button key={suggestion} type='button' onClick={() => void submit(suggestion)}>{suggestion}</button>)}</div> : null}
                    </div>
                  ) : null}
                </article>
              ))}
              {sending ? <div className='pc-public-assistant-processing' role='status'><Loader2 size={17} aria-hidden='true' /><span>{locale === 'en' ? 'Checking the public knowledge base…' : locale === 'zh' ? '正在检查公共知识库…' : 'Сверяю публичную базу знаний…'}</span></div> : null}
            </div>

            {!messages.some((message) => message.answer) && starterPrompts.length ? (
              <div className='pc-public-assistant-starters' data-context={contextName}>
                {starterPrompts.map((prompt) => <button key={prompt} type='button' onClick={() => { trackEvent('contextual_ai_prompt_opened', { context: contextName, action: 'selected' }); void submit(prompt); }}>{prompt}</button>)}
              </div>
            ) : null}

            {error ? <div className='pc-public-assistant-error' role='alert'>{error}</div> : null}

            <form className='pc-public-assistant-form' onSubmit={(event) => { event.preventDefault(); void submit(input); }}>
              <textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value.slice(0, 1_200))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(input); } }} rows={2} maxLength={1_200} placeholder={ui.placeholder} aria-label={ui.placeholder} />
              <div className='pc-public-assistant-form-actions'>
                <button type='button' className='pc-public-assistant-secondary' onClick={reset}>{ui.newChat}</button>
                {sending ? <button type='button' className='pc-public-assistant-primary' onClick={stop}>{ui.stop}</button> : <button type='submit' className='pc-public-assistant-primary' disabled={!input.trim()}><Send size={16} aria-hidden='true' />{ui.send}</button>}
              </div>
            </form>

            <small className='pc-public-assistant-version'>{ui.knowledge}: {catalog?.knowledgeVersion || '—'}</small>
          </section>
        </>
      ) : null}
    </div>
  );
}
