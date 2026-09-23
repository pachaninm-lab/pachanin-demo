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
import { bindPublicGektaOwner, type PublicGektaOpenIntent } from '@/lib/platform-v7/public-gekta-open';
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
  /** Set when the stream stopped before a valid completion; text is partial. */
  interrupted?: boolean;
  /** The partial answer ended because the reader (or the page) stopped it. */
  stopped?: boolean;
};
type Failure = 'offline' | 'rate_limited' | 'server_error' | 'rejected' | 'unknown';
type Announcement = '' | 'sending' | 'complete' | 'refused' | 'interrupted';
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
  copyFailed: string;
  retry: string;
  useful: string;
  inaccurate: string;
  truncated: string;
  currentLimited: string;
  interrupted: string;
  stopped: string;
  failures: Record<Failure, string>;
  announce: Record<Exclude<Announcement, ''>, string>;
  jumpToLatest: string;
  draftKept: string;
  draftReplace: string;
  draftKeep: string;
  newChatDraftConfirm: string;
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
    copyFailed: 'Не удалось скопировать ответ. Выделите текст и скопируйте вручную.',
    retry: 'Повторить запрос',
    useful: 'Ответ полезен',
    inaccurate: 'Сообщить об ошибке',
    truncated: 'Ответ ограничен по длине',
    currentLimited: 'Нет подтверждённых актуальных данных',
    interrupted: 'Ответ прерван и не завершён',
    stopped: 'Ответ остановлен и не завершён',
    failures: {
      offline: 'Нет соединения с сетью. Запрос не выполнен — проверьте подключение и повторите.',
      rate_limited: 'Слишком много запросов. Подождите немного и повторите.',
      server_error: 'Сервис временно не ответил. Повторите запрос позже.',
      rejected: 'Запрос не принят: он слишком большой или некорректный. Сократите вопрос или уберите вложение.',
      unknown: 'Ответ не получен. Проверь соединение и повтори запрос.',
    },
    announce: {
      sending: 'Запрос отправлен. Гекта отвечает.',
      complete: 'Ответ Гекты получен.',
      refused: 'Гекта не дала ответа на этот вопрос.',
      interrupted: 'Ответ прерван.',
    },
    jumpToLatest: 'К новым сообщениям',
    draftKept: 'Ваш черновик сохранён. Заменить его вопросом:',
    draftReplace: 'Заменить',
    draftKeep: 'Оставить черновик',
    newChatDraftConfirm: 'Начать новый диалог? Текущий диалог и неотправленный текст будут удалены.',
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
    copyFailed: 'The answer could not be copied. Select the text and copy it manually.',
    retry: 'Retry request',
    useful: 'Useful answer',
    inaccurate: 'Report an error',
    truncated: 'Length-limited response',
    currentLimited: 'No verified current data',
    interrupted: 'The answer was interrupted and is incomplete',
    stopped: 'The answer was stopped and is incomplete',
    failures: {
      offline: 'You are offline. The request was not sent — check the connection and retry.',
      rate_limited: 'Too many requests. Wait a moment and retry.',
      server_error: 'The service did not respond. Retry later.',
      rejected: 'The request was not accepted: it is too large or malformed. Shorten the question or remove the attachment.',
      unknown: 'No answer was received. Check the connection and try again.',
    },
    announce: {
      sending: 'Request sent. Gekta is answering.',
      complete: 'Gekta answered.',
      refused: 'Gekta did not answer this question.',
      interrupted: 'The answer was interrupted.',
    },
    jumpToLatest: 'Jump to new messages',
    draftKept: 'Your draft is kept. Replace it with:',
    draftReplace: 'Replace',
    draftKeep: 'Keep draft',
    newChatDraftConfirm: 'Start a new chat? The current conversation and unsent text will be removed.',
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
    copyFailed: '无法复制回答。请选中文字手动复制。',
    retry: '重试问题',
    useful: '回答有用',
    inaccurate: '报告错误',
    truncated: '回答受长度限制',
    currentLimited: '没有经过验证的当前数据',
    interrupted: '回答被中断，内容不完整',
    stopped: '回答已停止，内容不完整',
    failures: {
      offline: '网络未连接。请求未完成，请检查连接后重试。',
      rate_limited: '请求过多。请稍后重试。',
      server_error: '服务暂时没有响应。请稍后重试。',
      rejected: '请求未被接受：内容过大或格式不正确。请缩短问题或移除附件。',
      unknown: '未收到回答。请检查连接后重试。',
    },
    announce: {
      sending: '已发送。Gekta 正在回答。',
      complete: 'Gekta 已回答。',
      refused: 'Gekta 未回答这个问题。',
      interrupted: '回答已中断。',
    },
    jumpToLatest: '查看新消息',
    draftKept: '您的草稿已保留。是否替换为：',
    draftReplace: '替换',
    draftKeep: '保留草稿',
    newChatDraftConfirm: '开始新对话？当前对话和未发送的文字将被删除。',
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

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/** Only same-site paths and http(s) links are rendered as active links. */
function safeHref(value: string): string | null {
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function isVisible(node: HTMLElement | null): node is HTMLElement {
  return Boolean(node && node.isConnected && node.getClientRects().length > 0);
}

/**
 * Make everything outside the dialog inert while the modal panel is open, and
 * return a function that restores exactly what was changed.
 */
function inertOutside(host: HTMLElement): () => void {
  const changed: HTMLElement[] = [];
  let node: HTMLElement | null = host;
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue;
      if (sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE' || sibling.inert) continue;
      sibling.inert = true;
      changed.push(sibling);
    }
    node = parent;
  }
  return () => {
    for (const item of changed) item.inert = false;
  };
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
      // A partial answer stays marked as partial after a reload.
      // A row saved while it was still streaming is a partial answer.
      interrupted: row.interrupted === true || (row.stream as { status?: unknown } | undefined)?.status === 'streaming' ? true : undefined,
      stopped: row.stopped === true ? true : undefined,
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
  const [failure, setFailure] = React.useState<Failure | null>(null);
  const [announcement, setAnnouncement] = React.useState<Announcement>('');
  const [showJump, setShowJump] = React.useState(false);
  /** Whether the reader is at the end of the history (auto-follow allowed). */
  const [following, setFollowing] = React.useState(true);
  const [offeredDraft, setOfferedDraft] = React.useState<string | null>(null);
  const panelRef = React.useRef<HTMLElement>(null);
  const hostRef = React.useRef<HTMLDivElement>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const inputRef = React.useRef('');
  /** Identity of the current conversation + request; late results of older ones are dropped. */
  const generationRef = React.useRef(0);
  const composingRef = React.useRef(false);
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

  inputRef.current = input;

  /**
   * The single open operation. Every entry point ends here, directly or via the
   * open mailbox; nothing is ever submitted on open.
   */
  const openWith = React.useCallback((intent: PublicGektaOpenIntent) => {
    if (typeof intent.context === 'string') setContextName(intent.context.slice(0, 80));
    if (Array.isArray(intent.prompts)) {
      setContextualPrompts(intent.prompts.filter((prompt) => typeof prompt === 'string').slice(0, 3));
    }
    const draft = typeof intent.draft === 'string' ? intent.draft.trim().slice(0, 1_200) : '';
    if (draft) {
      const current = inputRef.current.trim();
      if (!current || current === draft) {
        setInput(draft);
        setOfferedDraft(null);
      } else {
        // An unsent draft is never replaced silently.
        setOfferedDraft(draft);
      }
    }
    const active = typeof document === 'undefined' ? null : document.activeElement;
    openerRef.current = intent.opener ?? (active instanceof HTMLElement && active !== document.body ? active : null);
    setOpen(true);
    trackEvent('public_platform_assistant_opened', { source: intent.source, context: intent.context || 'platform' });
  }, []);

  React.useEffect(() => bindPublicGektaOwner(openWith), [openWith]);

  // Compatibility adapter for the existing window event; it only forwards to
  // the same open operation and holds no state of its own.
  React.useEffect(() => {
    const handleContext = (event: Event) => {
      const detail = (event as CustomEvent<ContextPayload>).detail;
      if (!detail || !Array.isArray(detail.prompts)) return;
      openWith({ source: 'public_context_event', context: typeof detail.context === 'string' ? detail.context : 'platform', prompts: detail.prompts });
    };
    window.addEventListener('pc:public-assistant-context', handleContext);
    return () => window.removeEventListener('pc:public-assistant-context', handleContext);
  }, [openWith]);

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
    if (!stickToBottomRef.current) {
      // The reader is reading earlier messages: do not take the position away.
      if (messages.length) setShowJump(true);
      return;
    }
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: sending ? 'auto' : 'smooth' });
  }, [messages, sending]);

  const jumpToLatest = () => {
    stickToBottomRef.current = true;
    setFollowing(true);
    setShowJump(false);
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  };

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
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fullscreen, open]);

  // Focus on open, modal background, and focus return on close. Runs per open,
  // not per fullscreen toggle.
  React.useEffect(() => {
    if (!open) return;
    const restoreInert = hostRef.current ? inertOutside(hostRef.current) : () => undefined;
    // On a narrow/touch screen focusing the textarea would raise the keyboard
    // over the history; the dialog itself receives focus there instead.
    const touchFirst = window.matchMedia?.('(max-width: 720px), (pointer: coarse)').matches === true;
    const timer = window.setTimeout(() => {
      if (touchFirst) panelRef.current?.focus({ preventScroll: true });
      else textareaRef.current?.focus();
    }, 60);
    return () => {
      window.clearTimeout(timer);
      restoreInert();
      const opener = openerRef.current;
      window.setTimeout(() => {
        // An opener inside a collapsed menu returns focus to that menu.
        const summary = opener?.closest('details')?.querySelector<HTMLElement>(':scope > summary') ?? null;
        const target = isVisible(opener) ? opener : summary;
        if (isVisible(target)) target.focus({ preventScroll: true });
      }, 0);
    };
  }, [open]);

  const close = () => {
    setFullscreen(false);
    setOpen(false);
  };

  const reset = () => {
    // A new conversation is explicit. An unsent draft or a real conversation is
    // never discarded without confirmation; Cancel leaves both untouched.
    if (input.trim() && !window.confirm(ui.newChatDraftConfirm)) return;
    if (!input.trim() && messages.length > 0 && !window.confirm(ui.resetConfirm)) return;
    generationRef.current += 1;
    const controller = abortRef.current;
    abortRef.current = null;
    sendingRef.current = false;
    freshConversationRef.current = true;
    controller?.abort();
    setMessages([]);
    setInput('');
    setError('');
    setFailure(null);
    setOfferedDraft(null);
    setShowJump(false);
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

  // A partial (interrupted or stopped) answer is never sent back to the model
  // as if it were a complete assistant turn, and neither is the question it
  // failed to answer: the model would otherwise see two questions in a row.
  const historyFrom = (items: Message[]): HistoryTurn[] => items
    .filter((message, index) => message.text.trim().length > 0
      && !message.interrupted
      && !(message.role === 'user' && items[index + 1]?.interrupted))
    .slice(-12)
    .map((message) => ({ role: message.role, text: message.text.slice(0, 2_000) }));

  type StreamResult = 'answered' | 'fallback' | 'handled' | 'interrupted' | { failure: Failure };

  const streamAnswer = async (
    question: string,
    history: HistoryTurn[],
    controller: AbortController,
    generation: number,
  ): Promise<StreamResult> => {
    const id = messageId('assistant');
    // Last text the reader actually saw. The parser blanks text when it seals
    // an unfinished stream; the component keeps it, marked as interrupted.
    let lastVisibleText = '';
    const current = () => generationRef.current === generation;

    const paint = (snapshot: GatewayStreamSnapshot) => {
      if (!current()) return;
      const assessment = parseAssessment(snapshot.assessment);
      const text = sanitizeDisplayText(snapshot.text);
      if (snapshot.status === 'streaming') lastVisibleText = text;
      else if (!text) return;
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
      // Always replace by id: the updater runs later than this callback, so a
      // flag set inside it cannot tell the next step whether a row exists.
      setMessages((items) => [...items.filter((message) => message.id !== id), {
        id,
        role: 'assistant',
        text,
        stream,
        origin: assessment.source,
        createdAt: new Date().toISOString(),
      }]);
    };

    const dropProvisional = () => {
      if (current()) setMessages((items) => items.filter((message) => message.id !== id));
    };

    const keepPartial = (refusal: GatewayRefusal, partial: string, assessment: StreamAssessment) => {
      setMessages((items) => [...items.filter((message) => message.id !== id), {
        id,
        role: 'assistant',
        text: partial,
        origin: assessment.source,
        createdAt: new Date().toISOString(),
        interrupted: true,
        stopped: refusal === 'CANCELLED' ? true : undefined,
        stream: {
          status: 'refused',
          refusal,
          citations: [],
          modelIdentity: null,
          assessment,
        },
      }]);
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
    } catch (reason) {
      if (controller.signal.aborted) return 'handled';
      if (reason instanceof DOMException && reason.name === 'AbortError') return 'handled';
      return { failure: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unknown' };
    }

    // Transport status is reported as what it is. None of these is retried
    // automatically; the reader decides.
    if (!response.ok) {
      if (response.status === 429) return { failure: 'rate_limited' };
      if (response.status >= 500) return { failure: 'server_error' };
      // 4xx: repeating the same request would fail the same way.
      if (response.status >= 400) return { failure: 'rejected' };
      return { failure: 'unknown' };
    }

    const snapshot = await readGatewayStream(response, { mode: 'public', onSnapshot: paint, signal: controller.signal });
    if (!current()) return 'handled';

    if (snapshot.status === 'answered') {
      trackEvent('public_platform_assistant_stream_answer', {
        locale,
        context: contextName,
        source: parseAssessment(snapshot.assessment).source,
      });
      return 'answered';
    }

    // Stopping keeps what the reader already saw, marked as not complete.
    if (snapshot.refusal === 'CANCELLED') {
      const partial = sanitizeDisplayText(snapshot.text) || lastVisibleText;
      if (!partial) {
        dropProvisional();
        return 'handled';
      }
      keepPartial('CANCELLED', partial, parseAssessment(snapshot.assessment));
      return 'handled';
    }

    // The gateway is switched off or has no admitted model: the stream carried
    // no generation at all, and the public knowledge answer is the designed path.
    if (snapshot.refusal === 'FEATURE_DISABLED' || snapshot.refusal === 'MODEL_NOT_ADMITTED') {
      dropProvisional();
      return 'fallback';
    }

    // EOF without `done`, a network break, a timeout or a malformed frame: this
    // is an interruption, never a success, and it is not silently re-requested.
    if (snapshot.refusal === 'UPSTREAM_ERROR' || snapshot.refusal === null) {
      if (lastVisibleText) {
        keepPartial('UPSTREAM_ERROR', lastVisibleText, parseAssessment(snapshot.assessment));
        return 'interrupted';
      }
      dropProvisional();
    } else {
      dropProvisional();
    }

    setMessages((items) => [...items, {
      id,
      role: 'assistant',
      text: refusalCopy(locale, snapshot.refusal ?? 'UPSTREAM_ERROR'),
      origin: 'refusal',
      createdAt: new Date().toISOString(),
      interrupted: snapshot.refusal === 'UPSTREAM_ERROR' || snapshot.refusal === null,
      stream: {
        status: 'refused',
        refusal: snapshot.refusal ?? 'UPSTREAM_ERROR',
        citations: [],
        modelIdentity: snapshot.modelIdentity,
        assessment: { ...defaultAssessment(), source: 'refusal' },
      },
    }]);
    trackEvent('public_platform_assistant_stream_refusal', { refusal: snapshot.refusal ?? 'UPSTREAM_ERROR', locale });
    return snapshot.refusal === 'UPSTREAM_ERROR' || snapshot.refusal === null ? 'interrupted' : 'handled';
  };

  const knowledgeFallback = async (
    question: string,
    history: readonly HistoryTurn[],
    controller: AbortController,
    generation: number,
  ): Promise<boolean> => {
    const response = await fetch('/api/public-platform-assistant', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ message: question, locale, context: contextName, history }),
    });
    const payload = await response.json().catch(() => null) as Answer | null;
    if (generationRef.current !== generation) return true;
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
   * that differs between them is whether a user turn is added first. The caller
   * has already taken the synchronous submit lock.
   */
  const runGeneration = async (question: string, history: HistoryTurn[]) => {
    generationRef.current += 1;
    const generation = generationRef.current;
    setError('');
    setFailure(null);
    setAnnouncement('sending');
    sendingRef.current = true;
    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await streamAnswer(question, history, controller, generation);
      if (generationRef.current !== generation) return;
      if (result === 'answered') { setAnnouncement('complete'); return; }
      if (result === 'interrupted') { setAnnouncement('interrupted'); return; }
      if (result === 'handled') { setAnnouncement(controller.signal.aborted ? 'interrupted' : 'refused'); return; }
      if (typeof result === 'object') {
        setFailure(result.failure);
        setError(ui.failures[result.failure]);
        // The role=alert banner announces the error; the status region is cleared
        // so it is not spoken twice.
        setAnnouncement('');
        return;
      }
      if (!await knowledgeFallback(question, history, controller, generation)) throw new Error('knowledge_fallback_failed');
      if (generationRef.current === generation) setAnnouncement('complete');
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        if (generationRef.current === generation) setAnnouncement('interrupted');
        return;
      }
      if (generationRef.current !== generation) return;
      setFailure('unknown');
      setError(ui.error);
      setAnnouncement('');
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        sendingRef.current = false;
        setSending(false);
        window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
      }
    }
  };

  const submit = async (value: string) => {
    const normalized = value.replace(/\s+/gu, ' ').trim().slice(0, 1_200);
    if (!normalized || sendingRef.current) return;
    // Synchronous lock before the first await: a second Enter or click in the
    // same tick sees it and sends nothing.
    sendingRef.current = true;
    const history = freshConversationRef.current ? [] : historyFrom(messages);
    freshConversationRef.current = false;
    const userMessage: Message = {
      id: messageId('user'),
      role: 'user',
      text: normalized,
      createdAt: new Date().toISOString(),
    };
    stickToBottomRef.current = true;
    setFollowing(true);
    setShowJump(false);
    setOfferedDraft(null);
    setMessages((current) => [...current, userMessage]);
    setInput('');
    inputRef.current = '';
    trackEvent('public_platform_assistant_question', { length: normalized.length, locale, context: contextName });
    await runGeneration(normalized, history);
  };

  /** A prompt card fills the editable composer. It is never sent by itself. */
  const draftSuggestion = (text: string) => {
    const draft = text.trim().slice(0, 1_200);
    if (!draft) return;
    const current = inputRef.current.trim();
    if (current && current !== draft) setOfferedDraft(draft);
    else setInput(draft);
    trackEvent('contextual_ai_prompt_opened', { context: contextName, action: 'drafted' });
    window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
  };

  const copyMessage = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((current) => current === message.id ? '' : current), 1_500);
      trackEvent('public_platform_assistant_answer_copied', { origin: message.origin || 'unknown' });
    } catch {
      // A clipboard problem is not a connection problem and has nothing to retry.
      setFailure(null);
      setError(ui.copyFailed);
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
    setFollowing(true);
    setShowJump(false);
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
    <div ref={hostRef} className='pc-public-assistant' data-public-platform-assistant='true'>
      <button
        ref={triggerRef}
        type='button'
        className='pc-public-assistant-shortcut'
        aria-haspopup='dialog'
        aria-expanded={open}
        aria-controls='pc-public-assistant-panel'
        onClick={() => openWith({ source: 'home_shortcut', opener: triggerRef.current })}
      >
        <span className='pc-public-assistant-shortcut-icon' aria-hidden='true'><Sparkles size={20} /></span>
        <span className='pc-public-assistant-shortcut-copy'><strong>{ui.open}</strong><small>{ui.shortcutHint}</small></span>
      </button>

      {open ? (
        <>
          <button className='pc-public-assistant-backdrop' type='button' tabIndex={-1} aria-label={ui.close} onClick={close} />
          <section
            ref={panelRef}
            id='pc-public-assistant-panel'
            role='dialog'
            aria-modal='true'
            aria-labelledby='pc-public-assistant-title'
            tabIndex={-1}
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
              data-follow={following ? 'true' : 'false'}
              onScroll={(event) => {
                const node = event.currentTarget;
                const nearEnd = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
                stickToBottomRef.current = nearEnd;
                setFollowing(nearEnd);
                if (nearEnd) setShowJump(false);
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
                          data-gekta-prompt-card='draft'
                          onClick={() => draftSuggestion(prompt)}
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
                    data-interrupted={message.interrupted ? 'true' : undefined}
                  >
                    {message.text || message.answer?.title ? (
                      <div className='pc-public-assistant-bubble'>
                        {message.answer ? <strong className='pc-public-assistant-answer-title'>{message.answer.title}</strong> : null}
                        {message.text ? <p>{message.text}</p> : null}
                      </div>
                    ) : null}

                    {message.stream?.status === 'streaming' ? (
                      <p className='pc-public-assistant-stream-provisional'>
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
                          {message.interrupted ? <span style={badgeStyle} data-gekta-interrupted='true'>{message.stopped ? ui.stopped : ui.interrupted}</span> : null}
                        </div>

                        {sources.length ? (
                          <div className='pc-public-assistant-source-list' role='navigation' aria-label={ui.sources}>
                            {sources.map((source) => {
                              const raw = 'uri' in source ? source.uri : source.href;
                              const label = 'title' in source ? source.title : source.label;
                              const href = safeHref(raw);
                              return href
                                ? <a key={`${raw}-${label}`} href={href} rel='noopener noreferrer'>{label}</a>
                                : <span key={`${raw}-${label}`}>{label}</span>;
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
                              <button key={suggestion} type='button' data-gekta-prompt-card='draft' onClick={() => draftSuggestion(suggestion)}>{suggestion}</button>
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
                <div className='pc-public-assistant-processing'>
                  <Loader2 size={17} aria-hidden='true' /><span>{ui.processing}</span>
                </div>
              ) : null}
            </div>

            {showJump ? (
              <button type='button' className='pc-public-assistant-jump' data-gekta-jump-latest='true' onClick={jumpToLatest}>
                {ui.jumpToLatest}
              </button>
            ) : null}

            {error ? (
              <div className='pc-public-assistant-error' role='alert' data-gekta-failure={failure ?? undefined}>
                <span>{error}</span>
                {!sending && failure && failure !== 'rejected' && messages.some((message) => message.role === 'user') ? (
                  <button
                    type='button'
                    className='pc-public-assistant-error-retry'
                    onClick={() => void regenerateAnswer(messages[messages.length - 1]?.role === 'assistant' ? messages.length - 1 : messages.length)}
                  >
                    {ui.retry}
                  </button>
                ) : null}
              </div>
            ) : null}

            {offeredDraft ? (
              <div className='pc-public-assistant-draft-offer' data-gekta-draft-offer='true'>
                <p>{ui.draftKept} <q>{offeredDraft}</q></p>
                <div>
                  <button type='button' onClick={() => { setInput(offeredDraft); setOfferedDraft(null); textareaRef.current?.focus({ preventScroll: true }); }}>{ui.draftReplace}</button>
                  <button type='button' onClick={() => { setOfferedDraft(null); textareaRef.current?.focus({ preventScroll: true }); }}>{ui.draftKeep}</button>
                </div>
              </div>
            ) : null}

            <p style={SR_ONLY} role='status' aria-live='polite' aria-atomic='true' data-gekta-announcer='true'>
              {announcement ? ui.announce[announcement] : ''}
            </p>

            <form className='pc-public-assistant-composer' onSubmit={(event) => { event.preventDefault(); void submit(input); }}>
              <div className='pc-public-assistant-composer-shell'>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value.slice(0, 1_200))}
                  onCompositionStart={() => { composingRef.current = true; }}
                  onCompositionEnd={() => { composingRef.current = false; }}
                  onKeyDown={(event) => {
                    // Enter that commits an IME composition (Chinese, Japanese,
                    // Korean input) is not a send. Safari reports it as keyCode 229.
                    if (event.nativeEvent.isComposing || composingRef.current || event.keyCode === 229) return;
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
