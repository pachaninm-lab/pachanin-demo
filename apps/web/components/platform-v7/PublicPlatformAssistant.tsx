'use client';

import * as React from 'react';
import {
  Copy as CopyIcon,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';
import {
  readGatewayStream,
  refusalCopy,
  type GatewayStreamSnapshot,
  type GatewayStreamStatus,
} from '@/lib/platform-v7/ai-gateway-stream';
import type { GatewayRefusal } from '@pc/ai-assistant-stream-contract';

type Locale = 'ru' | 'en' | 'zh';
type Confidence = 'high' | 'medium';
type AnswerOrigin = 'local_qwen' | 'verified_knowledge' | 'knowledge_fallback' | 'policy' | 'refusal';
type AnswerMode = 'verified_platform' | 'general_agro' | null;

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
type StreamAssessment = {
  source: AnswerOrigin;
  answerMode: AnswerMode;
  currentDataRequired: boolean;
  modelIdentity: string | null;
  latencyMs: number | null;
  truncated: boolean;
  finishReason: string | null;
  safetyFlags: string[];
};
type StreamedAnswer = {
  status: GatewayStreamStatus;
  refusal: GatewayRefusal | null;
  citations: readonly { sourceId: string; title: string; uri: string }[];
  modelIdentity: string | null;
  assessment: StreamAssessment;
};
type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  answer?: Answer;
  stream?: StreamedAnswer;
  origin?: AnswerOrigin;
};
type ContextPayload = { context: string; prompts: string[] };
type HistoryTurn = { role: 'user' | 'assistant'; text: string };

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
  resetConfirm: string;
  fullscreen: string;
  compact: string;
  error: string;
  sources: string;
  details: string;
  privacy: string;
  processing: string;
  copy: string;
  copied: string;
  retry: string;
  useful: string;
  inaccurate: string;
  truncated: string;
  currentLimited: string;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    open: 'Спросить Гекту',
    shortcutHint: 'Аграрный интеллект',
    close: 'Закрыть Гекту',
    title: 'Гекта',
    subtitle: 'ИИ для сельского хозяйства и агробизнеса от «Прозрачной Цены»',
    emptyTitle: 'Чем я могу вам помочь?',
    emptyBody: 'Разберу вопрос по земле, растениям, урожаю, сельскому хозяйству, агробизнесу и возможностям «Прозрачной Цены».',
    placeholder: 'Спроси Гекту о земле, урожае или агробизнесе',
    send: 'Отправить',
    stop: 'Остановить ответ',
    newChat: 'Новый диалог',
    resetConfirm: 'Удалить текущий диалог?',
    fullscreen: 'Развернуть на весь экран',
    compact: 'Вернуть компактный режим',
    error: 'Ответ не получен. Проверь соединение и повтори запрос.',
    sources: 'Источники',
    details: 'Основание ответа',
    privacy: 'Публичный режим · без доступа к данным личных кабинетов · не вводи пароли, токены и персональные данные',
    processing: 'Гекта анализирует…',
    copy: 'Копировать ответ',
    copied: 'Скопировано',
    retry: 'Повторить запрос',
    useful: 'Ответ полезен',
    inaccurate: 'Сообщить об ошибке',
    truncated: 'Ответ ограничен по длине',
    currentLimited: 'Нет подтверждённых актуальных данных',
  },
  en: {
    open: 'Ask Gekta',
    shortcutHint: 'Agricultural intelligence',
    close: 'Close Gekta',
    title: 'Gekta',
    subtitle: 'AI for farming and agribusiness by Prozrachnaya Tsena',
    emptyTitle: 'How can I help you?',
    emptyBody: 'Ask Gekta about land, crops, agriculture, agribusiness, or Transparent Price capabilities.',
    placeholder: 'Ask Gekta about land, crops or agribusiness',
    send: 'Send',
    stop: 'Stop answer',
    newChat: 'New chat',
    resetConfirm: 'Delete the current conversation?',
    fullscreen: 'Open full screen',
    compact: 'Return to compact mode',
    error: 'No answer was received. Check the connection and try again.',
    sources: 'Sources',
    details: 'Basis of the answer',
    privacy: 'Public mode · no access to workspace data · do not enter passwords, tokens or personal data',
    processing: 'Gekta is analysing…',
    copy: 'Copy answer',
    copied: 'Copied',
    retry: 'Retry request',
    useful: 'Useful answer',
    inaccurate: 'Report an error',
    truncated: 'Length-limited response',
    currentLimited: 'No verified current data',
  },
  zh: {
    open: '询问 Gekta',
    shortcutHint: '农业智能',
    close: '关闭 Gekta',
    title: 'Gekta',
    subtitle: '“透明价格”推出的农业与农业经营 AI',
    emptyTitle: '我可以帮您做什么？',
    emptyBody: '可以向 Gekta 咨询土地、作物、农业、农业经营或“透明价格”平台。',
    placeholder: '向 Gekta 咨询土地、作物或农业经营',
    send: '发送',
    stop: '停止回答',
    newChat: '新对话',
    resetConfirm: '删除当前对话？',
    fullscreen: '全屏显示',
    compact: '返回紧凑模式',
    error: '未收到回答。请检查连接后重试。',
    sources: '来源',
    details: '回答依据',
    privacy: '公共模式 · 无法访问工作区数据 · 请勿输入密码、令牌或个人数据',
    processing: 'Gekta 正在分析…',
    copy: '复制回答',
    copied: '已复制',
    retry: '重试问题',
    useful: '回答有用',
    inaccurate: '报告错误',
    truncated: '回答受长度限制',
    currentLimited: '没有经过验证的当前数据',
  },
};

const actionStyle: React.CSSProperties = {
  display: 'inline-flex',
  minWidth: 44,
  minHeight: 44,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '8px 10px',
  border: '1px solid #cfdcd4',
  borderRadius: 10,
  background: '#fff',
  color: '#07572e',
  font: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  minHeight: 28,
  alignItems: 'center',
  padding: '4px 8px',
  border: '1px solid #cfdcd4',
  borderRadius: 999,
  background: '#f5f8f6',
  color: '#52635b',
  fontSize: 11,
  lineHeight: 1.2,
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

function sanitizeDisplayText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]+\)/gu, '$1')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/\*\*([^*]+)\*\*/gu, '$1')
    .replace(/__([^_]+)__/gu, '$1')
    .replace(/^\s*#{1,6}\s+/gmu, '')
    .replace(/^\s*\*\s+/gmu, '• ')
    .replace(/[ \t]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function defaultAssessment(): StreamAssessment {
  return {
    source: 'local_qwen',
    answerMode: null,
    currentDataRequired: false,
    modelIdentity: null,
    latencyMs: null,
    truncated: false,
    finishReason: null,
    safetyFlags: [],
  };
}

/**
 * The assessment has two layers and they answer different questions.
 *
 * The outer record is the route's own account: which grounding it used, which
 * answer mode it resolved, whether it forwarded frames incrementally. When a
 * real model answered, how *generation* ended lives one level down, under
 * `upstream` — because the relay reports what it did, and the model reports what
 * it did, and flattening the two would let a clean relay hide a truncated
 * answer. The grounded paths (`policy`, `verified_knowledge`) have no upstream
 * model, so they state their outcome at the top level and are read there.
 *
 * Reading only the top level is what stranded this component after the route
 * moved to real streaming: it silently saw `truncated: false, finishReason:
 * null, safetyFlags: []` for every model answer, so a truncated reply looked
 * indistinguishable from a complete one.
 */
function parseAssessment(value: string | null): StreamAssessment {
  if (!value) return defaultAssessment();
  try {
    const row = JSON.parse(value) as Record<string, unknown>;
    const source: AnswerOrigin = row.source === 'verified_knowledge'
      || row.source === 'knowledge_fallback'
      || row.source === 'policy'
      || row.source === 'refusal'
      ? row.source
      : 'local_qwen';
    const answerMode: AnswerMode = row.answerMode === 'verified_platform' || row.answerMode === 'general_agro'
      ? row.answerMode
      : null;
    // Present only on the incremental model path; absent on grounded answers.
    const upstream = row.upstream !== null && typeof row.upstream === 'object' && !Array.isArray(row.upstream)
      ? row.upstream as Record<string, unknown>
      : null;
    const outcome = upstream ?? row;
    return {
      source,
      answerMode,
      currentDataRequired: row.currentDataRequired === true,
      // The public contour publishes no model identity. A string here would be
      // a leak, not a value to display, so nothing is read into it.
      modelIdentity: null,
      latencyMs: null,
      truncated: outcome.truncated === true,
      finishReason: typeof outcome.finishReason === 'string' ? outcome.finishReason : null,
      safetyFlags: Array.isArray(outcome.safetyFlags)
        ? outcome.safetyFlags.filter((item): item is string => typeof item === 'string').slice(0, 12)
        : [],
    };
  } catch {
    return { ...defaultAssessment(), safetyFlags: ['ASSESSMENT_UNPARSEABLE'] };
  }
}

function sessionKey(locale: Locale) {
  return `pc-gekta-assistant-v1:${locale}`;
}

function legacySessionKeys(locale: Locale) {
  return [`pc-public-assistant-v2:${locale}`] as const;
}

function safeStoredMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-40).flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (row.role !== 'user' && row.role !== 'assistant') return [];
    if (typeof row.text !== 'string' || !row.text.trim()) return [];
    return [{
      id: typeof row.id === 'string' ? row.id : messageId(String(row.role)),
      role: row.role,
      text: sanitizeDisplayText(row.text).slice(0, 12_000),
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
      origin: row.origin === 'verified_knowledge'
        || row.origin === 'knowledge_fallback'
        || row.origin === 'policy'
        || row.origin === 'refusal'
        || row.origin === 'local_qwen'
        ? row.origin
        : undefined,
    } satisfies Message];
  });
}

export function PublicPlatformAssistant() {
  const [locale, setLocale] = React.useState<Locale>('ru');
  const [open, setOpen] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [copiedId, setCopiedId] = React.useState('');
  const [contextualPrompts, setContextualPrompts] = React.useState<string[]>([]);
  const [contextName, setContextName] = React.useState('platform');
  const panelRef = React.useRef<HTMLElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const messagesRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const sendingRef = React.useRef(false);
  const freshConversationRef = React.useRef(false);
  const stickToBottomRef = React.useRef(true);
  const hydratedStorageRef = React.useRef<Locale | null>(null);
  const skipNextStorageWriteRef = React.useRef(false);
  const ui = COPY[locale];
  const starterPrompts = (contextualPrompts.length ? contextualPrompts : (catalog?.starterPrompts || [])).slice(0, 4);
  const hasConversation = messages.length > 0;
  const hasStreamingMessage = messages.some((message) => message.stream?.status === 'streaming');

  React.useEffect(() => {
    setLocale(resolveLocale());
  }, []);

  React.useEffect(() => {
    if (hydratedStorageRef.current === locale) return;
    hydratedStorageRef.current = locale;
    const primaryKey = sessionKey(locale);
    try {
      const stored = window.sessionStorage.getItem(primaryKey);
      if (stored) {
        skipNextStorageWriteRef.current = true;
        setMessages(safeStoredMessages(JSON.parse(stored)));
        return;
      }

      for (const legacyKey of legacySessionKeys(locale)) {
        const legacyStored = window.sessionStorage.getItem(legacyKey);
        if (!legacyStored) continue;
        const migrated = safeStoredMessages(JSON.parse(legacyStored));
        window.sessionStorage.setItem(primaryKey, JSON.stringify(migrated));
        window.sessionStorage.removeItem(legacyKey);
        skipNextStorageWriteRef.current = true;
        setMessages(migrated);
        break;
      }
    } catch {
      window.sessionStorage.removeItem(primaryKey);
      for (const legacyKey of legacySessionKeys(locale)) window.sessionStorage.removeItem(legacyKey);
    }
  }, [locale]);

  React.useEffect(() => {
    if (hydratedStorageRef.current !== locale) return;
    if (skipNextStorageWriteRef.current) {
      skipNextStorageWriteRef.current = false;
      return;
    }
    try {
      window.sessionStorage.setItem(sessionKey(locale), JSON.stringify(messages.slice(-40)));
    } catch {
      // Session persistence is optional; Gekta remains usable without it.
    }
  }, [locale, messages]);

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
    if (!stickToBottomRef.current) return;
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: sending ? 'auto' : 'smooth' });
  }, [messages, sending]);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(120, Math.max(42, textarea.scrollHeight))}px`;
  }, [input, open, fullscreen]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (fullscreen) setFullscreen(false);
        else setOpen(false);
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
  }, [fullscreen, open]);

  const close = () => {
    setFullscreen(false);
    setOpen(false);
  };

  const reset = () => {
    if (messages.length > 2 && !window.confirm(ui.resetConfirm)) return;
    const controller = abortRef.current;
    abortRef.current = null;
    sendingRef.current = false;
    freshConversationRef.current = true;
    controller?.abort();
    setMessages([]);
    setInput('');
    setError('');
    setSending(false);
    setCopiedId('');
    window.sessionStorage.removeItem(sessionKey(locale));
    for (const legacyKey of legacySessionKeys(locale)) window.sessionStorage.removeItem(legacyKey);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
    trackEvent('public_platform_assistant_reset');
  };

  const stop = () => {
    const controller = abortRef.current;
    abortRef.current = null;
    sendingRef.current = false;
    controller?.abort();
    setSending(false);
  };

  const historyFrom = (items: Message[]): HistoryTurn[] => items
    .filter((message) => message.text.trim().length > 0)
    .slice(-12)
    .map((message) => ({ role: message.role, text: message.text.slice(0, 2_000) }));

  const streamAnswer = async (
    question: string,
    history: HistoryTurn[],
    controller: AbortController,
  ): Promise<'answered' | 'fallback' | 'handled'> => {
    const id = messageId('assistant');
    let opened = false;

    const paint = (snapshot: GatewayStreamSnapshot) => {
      const assessment = parseAssessment(snapshot.assessment);
      const stream: StreamedAnswer = {
        status: snapshot.status,
        refusal: snapshot.refusal,
        citations: snapshot.citations.map((citation) => ({
          sourceId: citation.sourceId,
          title: citation.title,
          uri: citation.uri,
        })),
        modelIdentity: assessment.modelIdentity || snapshot.modelIdentity,
        assessment,
      };
      setMessages((current) => {
        const next = opened ? current.filter((message) => message.id !== id) : current;
        opened = true;
        return [...next, {
          id,
          role: 'assistant',
          text: sanitizeDisplayText(snapshot.text),
          stream,
          origin: assessment.source,
          createdAt: new Date().toISOString(),
        }];
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
        body: JSON.stringify({ message: question, locale, context: contextName, history }),
      });
    } catch {
      return 'fallback';
    }

    const snapshot = await readGatewayStream(response, { mode: 'public', onSnapshot: paint, signal: controller.signal });

    if (snapshot.status === 'answered') {
      trackEvent('public_platform_assistant_stream_answer', {
        locale,
        context: contextName,
        source: parseAssessment(snapshot.assessment).source,
      });
      return 'answered';
    }

    // Stopping keeps what the reader already saw.
    //
    // Cancellation used to be handled like every other non-answer: drop the
    // provisional message and return. But a reader who presses Stop has already
    // read the text on screen, and erasing it makes Stop look like a failure
    // that lost the answer rather than a deliberate halt. Text that arrived is
    // text the model produced; only its continuation was cancelled. It is left
    // in place, marked `refused` so nothing downstream mistakes a halted answer
    // for a complete one, and so the streaming indicator ends.
    if (snapshot.refusal === 'CANCELLED') {
      const partial = sanitizeDisplayText(snapshot.text);
      if (!partial) {
        dropProvisional();
        return 'handled';
      }
      setMessages((current) => {
        const next = opened ? current.filter((message) => message.id !== id) : current;
        opened = true;
        return [...next, {
          id,
          role: 'assistant',
          text: partial,
          origin: parseAssessment(snapshot.assessment).source,
          createdAt: new Date().toISOString(),
          stream: {
            status: 'refused',
            refusal: 'CANCELLED',
            citations: [],
            modelIdentity: null,
            assessment: parseAssessment(snapshot.assessment),
          },
        }];
      });
      return 'handled';
    }

    dropProvisional();
    if (
      snapshot.refusal === 'FEATURE_DISABLED'
      || snapshot.refusal === 'MODEL_NOT_ADMITTED'
      || snapshot.refusal === 'UPSTREAM_ERROR'
      || snapshot.refusal === null
    ) {
      return 'fallback';
    }

    setMessages((current) => [...current, {
      id,
      role: 'assistant',
      text: refusalCopy(locale, snapshot.refusal),
      origin: 'refusal',
      createdAt: new Date().toISOString(),
      stream: {
        status: 'refused',
        refusal: snapshot.refusal,
        citations: [],
        modelIdentity: snapshot.modelIdentity,
        assessment: { ...defaultAssessment(), source: 'refusal' },
      },
    }]);
    trackEvent('public_platform_assistant_stream_refusal', { refusal: snapshot.refusal, locale });
    return 'handled';
  };

  const knowledgeFallback = async (
    question: string,
    history: readonly HistoryTurn[],
    controller: AbortController,
  ): Promise<boolean> => {
    const response = await fetch('/api/public-platform-assistant', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ message: question, locale, context: contextName, history }),
    });
    const payload = await response.json().catch(() => null) as Answer | null;
    if (!response.ok || !payload || payload.dataMode !== 'public_knowledge' || typeof payload.answer !== 'string') {
      return false;
    }
    setMessages((current) => [...current, {
      id: payload.requestId || messageId('assistant'),
      role: 'assistant',
      text: sanitizeDisplayText(payload.answer),
      answer: payload,
      origin: 'knowledge_fallback',
      createdAt: payload.generatedAt || new Date().toISOString(),
    }]);
    trackEvent('public_platform_assistant_fallback_answer', { topic: payload.topic, confidence: payload.confidence });
    return true;
  };

  /**
   * Run one generation for a question that is already on screen.
   *
   * Shared by asking and regenerating so the two cannot drift: the only thing
   * that differs between them is whether a user turn is added first.
   */
  const runGeneration = async (question: string, history: HistoryTurn[]) => {
    setError('');
    sendingRef.current = true;
    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await streamAnswer(question, history, controller);
      if (result === 'answered' || result === 'handled') return;
      if (!await knowledgeFallback(question, history, controller)) throw new Error('knowledge_fallback_failed');
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(ui.error);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        sendingRef.current = false;
        setSending(false);
        window.setTimeout(() => textareaRef.current?.focus(), 0);
      }
    }
  };

  const submit = async (value: string) => {
    const normalized = value.replace(/\s+/gu, ' ').trim().slice(0, 1_200);
    if (!normalized || sendingRef.current) return;
    const history = freshConversationRef.current ? [] : historyFrom(messages);
    freshConversationRef.current = false;
    const userMessage: Message = {
      id: messageId('user'),
      role: 'user',
      text: normalized,
      createdAt: new Date().toISOString(),
    };
    stickToBottomRef.current = true;
    setMessages((current) => [...current, userMessage]);
    setInput('');
    trackEvent('public_platform_assistant_question', { length: normalized.length, locale, context: contextName });
    await runGeneration(normalized, history);
  };

  const copyMessage = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((current) => current === message.id ? '' : current), 1_500);
      trackEvent('public_platform_assistant_answer_copied', { origin: message.origin || 'unknown' });
    } catch {
      setError(ui.error);
    }
  };

  /**
   * Regenerate one assistant answer without re-asking the question.
   *
   * Retry used to call `submit()` with the earlier question's text, and
   * `submit()` always appends a user turn — so every retry added a second copy
   * of a question the reader had asked once. The duplicate was not only visual:
   * `historyFrom` reads the message list, so the next request carried the same
   * user turn twice and the derived conversation state saw the subject restated
   * rather than revisited.
   *
   * So this replaces rather than re-asks. The user turn stays exactly where it
   * was, the answer being retried is dropped, and history is built from the
   * turns *before* the question — the answer under replacement cannot be part
   * of the context used to replace it.
   *
   * Anything after the retried answer is dropped with it. Those turns were
   * responses to an answer that no longer exists, and keeping them would leave
   * a conversation whose visible history never happened in that order. Removing
   * the invalidated branch is the deterministic reading; silently keeping it is
   * not.
   */
  const regenerateAnswer = async (index: number) => {
    if (sendingRef.current) return;

    let userIndex = -1;
    for (let i = Math.min(index, messages.length) - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') { userIndex = i; break; }
    }
    if (userIndex < 0) return;

    const question = messages[userIndex].text;
    if (!question.trim()) return;

    // Only what preceded the question. Not the question itself — it is sent as
    // the current request — and not the answer being replaced.
    const history = historyFrom(messages.slice(0, userIndex));

    stickToBottomRef.current = true;
    setMessages((current) => current.slice(0, index));
    freshConversationRef.current = false;
    trackEvent('public_platform_assistant_retry', { length: question.length, locale, context: contextName });
    await runGeneration(question, history);
  };

  const panelStyle: React.CSSProperties | undefined = fullscreen ? {
    inset: 0,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: '100vw',
    height: '100dvh',
    maxHeight: '100dvh',
    borderRadius: 0,
    borderLeft: 0,
    borderRight: 0,
  } : undefined;

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
          <button className='pc-public-assistant-backdrop' type='button' aria-label={ui.close} onClick={close} />
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
            data-fullscreen={String(fullscreen)}
            style={panelStyle}
          >
            <header className='pc-public-assistant-header'>
              <div className='pc-public-assistant-identity' data-pc-public-assistant-identity='two-lines-only'>
                <span className='pc-public-assistant-mark' aria-hidden='true' data-pc-public-assistant-ai-mark='true'><Sparkles size={20} /></span>
                <div className='pc-public-assistant-identity-copy'><strong id='pc-public-assistant-title'>{ui.title}</strong><span data-pc-public-assistant-subtitle='true'>{ui.subtitle}</span></div>
              </div>
              <button
                type='button'
                className='pc-public-assistant-icon-button'
                onClick={() => setFullscreen((current) => !current)}
                aria-label={fullscreen ? ui.compact : ui.fullscreen}
                title={fullscreen ? ui.compact : ui.fullscreen}
              >
                {fullscreen ? <Minimize2 size={20} aria-hidden='true' /> : <Maximize2 size={20} aria-hidden='true' />}
              </button>
              {hasConversation ? (
                <button type='button' className='pc-public-assistant-header-action' onClick={reset} aria-label={ui.newChat} title={ui.newChat}>
                  <RotateCcw size={18} aria-hidden='true' />
                </button>
              ) : null}
              <button type='button' className='pc-public-assistant-icon-button' onClick={close} aria-label={ui.close}>
                <X size={20} aria-hidden='true' />
              </button>
            </header>

            <div
              ref={messagesRef}
              className='pc-public-assistant-messages'
              aria-busy={sending}
              onScroll={(event) => {
                const node = event.currentTarget;
                stickToBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
              }}
            >
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

              {messages.map((message, index) => {
                const assessment = message.stream?.assessment;
                const origin = message.origin || assessment?.source || (message.answer ? 'knowledge_fallback' : undefined);
                const sources = message.stream?.citations || message.answer?.sources || [];
                return (
                  <article
                    key={message.id}
                    className='pc-public-assistant-message'
                    data-role={message.role}
                    data-stream-status={message.stream?.status}
                  >
                    {message.text || message.answer?.title ? (
                      <div className='pc-public-assistant-bubble'>
                        {message.answer ? <strong className='pc-public-assistant-answer-title'>{message.answer.title}</strong> : null}
                        {message.text ? <p>{message.text}</p> : null}
                      </div>
                    ) : null}

                    {message.stream?.status === 'streaming' ? (
                      <p className='pc-public-assistant-stream-provisional' role='status' aria-live='polite'>
                        <Loader2 size={15} aria-hidden='true' />
                        {ui.processing}
                      </p>
                    ) : null}

                    {message.role === 'assistant' && message.stream?.status !== 'streaming' ? (
                      <div className='pc-public-assistant-answer'>
                        {/* Which internal route produced the answer is not the
                            reader's business; what the answer cannot cover is. */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {assessment?.currentDataRequired ? <span style={badgeStyle}>{ui.currentLimited}</span> : null}
                          {assessment?.truncated ? <span style={badgeStyle}>{ui.truncated}</span> : null}
                        </div>

                        {sources.length ? (
                          <div className='pc-public-assistant-source-list' role='navigation' aria-label={ui.sources}>
                            {sources.map((source) => {
                              const href = 'uri' in source ? source.uri : source.href;
                              const label = 'title' in source ? source.title : source.label;
                              return <a key={`${href}-${label}`} href={href}>{label}</a>;
                            })}
                          </div>
                        ) : null}

                        <details className='pc-public-assistant-details'>
                          <summary>{ui.details}</summary>
                          <div className='pc-public-assistant-details-body'>
                            {message.answer?.facts.length ? (
                              <ul>{message.answer.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
                            ) : null}
                            {message.answer?.maturity ? <p>{message.answer.maturity}</p> : null}
                            {message.answer?.limitations.length ? (
                              <ul>{message.answer.limitations.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
                            ) : null}
                            <div className='pc-public-assistant-answer-meta'>
                              <time dateTime={message.createdAt}>{formatTime(message.createdAt, locale)}</time>
                            </div>
                          </div>
                        </details>

                        {message.answer?.suggestions.length ? (
                          <div className='pc-public-assistant-followups'>
                            {message.answer.suggestions.slice(0, 3).map((suggestion) => (
                              <button key={suggestion} type='button' onClick={() => void submit(suggestion)}>{suggestion}</button>
                            ))}
                          </div>
                        ) : null}

                        <div className='pc-public-assistant-message-actions' style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <button type='button' style={actionStyle} onClick={() => void copyMessage(message)} aria-label={ui.copy} title={ui.copy}>
                            <CopyIcon size={15} aria-hidden='true' />{copiedId === message.id ? ui.copied : ui.copy}
                          </button>
                          <button type='button' style={actionStyle} onClick={() => void regenerateAnswer(index)} aria-label={ui.retry} title={ui.retry}>
                            <RefreshCw size={15} aria-hidden='true' />{ui.retry}
                          </button>
                          <button type='button' style={actionStyle} onClick={() => trackEvent('public_platform_assistant_feedback', { value: 'useful', origin: origin || 'unknown' })} aria-label={ui.useful} title={ui.useful}>
                            <ThumbsUp size={15} aria-hidden='true' />
                          </button>
                          <button type='button' style={actionStyle} onClick={() => trackEvent('public_platform_assistant_feedback', { value: 'inaccurate', origin: origin || 'unknown' })} aria-label={ui.inaccurate} title={ui.inaccurate}>
                            <ThumbsDown size={15} aria-hidden='true' />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}

              {sending && !hasStreamingMessage ? (
                <div className='pc-public-assistant-processing' role='status' aria-live='polite'>
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
