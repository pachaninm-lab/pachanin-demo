'use client';

import * as React from 'react';
import { ArrowDown, Menu, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PublicAssistantDocument } from '@/components/platform-v7/PublicAssistantAttachmentPicker';
import { DOCUMENT_CONTEXT_COPY, GektaDocumentRetryCache, readDocumentContext, type GektaDocumentContext } from '@/lib/gekta/document-context';
import {
  PUBLIC_STREAM_TIMEOUT_MS,
  readGatewayStream,
  refusalCopy,
  type GatewayStreamSnapshot,
} from '@/lib/platform-v7/ai-gateway-stream';
import { GEKTA_PATHS, getGektaCopy, type GektaLocale } from '@/lib/gekta/content';
import { GEKTA_INTERRUPTION_COPY, restoreGektaAssistantState } from '@/lib/gekta/message-status';
import {
  GEKTA_PROJECTS_STORAGE,
  GEKTA_PROJECT_LIMITS,
  normaliseProjectDescription,
  normaliseProjectName,
  safeProjects,
  type GektaProject,
} from '@/lib/gekta/projects';
import {
  accountApi,
  chunkImport,
  createWorkspaceId as id,
  importAlreadyDone,
  importablePayload,
  logoutGektaAccount,
  markImportDone,
  toConversation,
  toProject,
  type ServerConversationRow,
  type ServerProjectRow,
  type WorkspaceMode,
} from '@/lib/gekta/server-workspace';
import { GektaComposer } from './GektaComposer';
import { GektaEmptyState } from './GektaEmptyState';
import { GektaMessageList } from './GektaMessageList';
import { GektaMobileDrawer } from './GektaMobileDrawer';
import { GektaSidebar } from './GektaSidebar';
import { GEKTA_ENTER_CHAT_EVENT } from './GektaProductCta';
import { GektaSettingsDialog, type GektaAnswerLocale } from './GektaSettingsDialog';
import { GektaAccessGate, GektaRemainingBadge } from './GektaAccessGate';
import { GektaConsentDialog } from './GektaConsentDialog';
import type { AnonymousConsentPresentation } from '@/lib/gekta/anonymous-consent-evidence';
import type { GektaEntitlementSnapshot } from '@/lib/gekta/entitlement';
import type { GektaConversation, GektaMessage } from './GektaChatTypes';
import { GektaThemeToggle } from './GektaAppearance';
import { GektaBrandMark } from './GektaBrandMark';
import { clearGektaTabDrafts, isNewGektaDraft, useGektaDrafts } from './useGektaDrafts';
import { GektaInstallButton, GektaInstallGuide, useGektaInstall } from './GektaInstallButton';
import styles from './GektaWorkspace.module.css';

const HISTORY_STORAGE = 'gekta-conversations-v2';
const LOCALE_STORAGE = 'gekta-locale-v1';
const ANSWER_LOCALE_STORAGE = 'gekta-answer-locale-v1';
const VOICE_INPUT_STORAGE = 'gekta-voice-input-v1';
const VOICE_OUTPUT_STORAGE = 'gekta-voice-output-v1';
const MAX_CONVERSATIONS = 60;
const MAX_MESSAGES = 80;
/** Заглушка тикета для аккаунта: у него нет квоты анонимного режима. */
const ACCOUNT_TICKET = 'account';
const ACCESS_ERROR: Record<GektaLocale, string> = {
  ru: 'Не удалось проверить доступ к Гекте. Проверь соединение и отправь вопрос ещё раз.',
  en: 'Could not check access to Gekta. Check your connection and send the question again.',
  zh: '无法检查 Gekta 访问权限。请检查网络连接后重新发送问题。',
};
const SCROLL_LABEL: Record<GektaLocale, string> = {
  ru: 'К последнему сообщению',
  en: 'Scroll to bottom',
  zh: '转到最后一条消息',
};
/** Порог, ниже которого поиск не уходит на сервер: один символ найдёт всё. */
const GEKTA_SEARCH_MIN_LENGTH = 2;
const GEKTA_SEARCH_MAX_LENGTH = 120;
const GEKTA_SEARCH_DEBOUNCE_MS = 350;

type ServerSearchState = Readonly<{
  state: 'idle' | 'loading' | 'error';
  query: string;
  /** null — поиска не было, показывается обычная недавняя история. */
  results: readonly GektaConversation[] | null;
}>;

type HistoryTurn = Readonly<{ role: 'user' | 'assistant'; text: string }>;

type SubmittedPrompt = Readonly<{
  kind: 'send';
  locale: GektaLocale;
  draftId: string;
  text: string;
  question: string;
  files: readonly PublicAssistantDocument[];
  context: readonly GektaDocumentContext[];
}>;

const HISTORY_FEEDBACK = {
  ru: { loading: 'Загружаю переписку…', failed: 'Не удалось загрузить переписку.', retry: 'Загрузить снова' },
  en: { loading: 'Loading conversation…', failed: 'Could not load this conversation.', retry: 'Try again' },
  zh: { loading: '正在加载对话…', failed: '未能加载这段对话。', retry: '重新加载' },
} as const;

const CHAT_UI = {
  ru: { assistant: 'Гекта', you: 'Ты', working: 'Гекта анализирует…', ready: 'Ответ Гекты готов.', copy: 'Копировать', copied: 'Скопировано', retry: 'Повторить', sources: 'Источники', send: 'Отправить', stop: 'Остановить', boundary: 'История анонимного режима хранится в этом браузере. Не отправляй пароли, токены, банковские реквизиты и лишние персональные данные.', reconnecting: 'Соединение прервалось до начала ответа. Переподключаюсь…', starters: 'Примеры вопросов', openMenu: 'Открыть историю', closeMenu: 'Закрыть историю', newChat: 'Новый диалог', productHome: 'Гекта — на главную продукта', clearConfirm: 'Удалить всю историю Гекты из этого браузера?', deleteConfirm: 'Удалить этот диалог?', account: 'Аккаунт Гекты', signedIn: 'История и проекты сохраняются в аккаунте.', logout: 'Выйти', loggingOut: 'Выходим…' },
  en: { assistant: 'Gekta', you: 'You', working: 'Gekta is analysing…', ready: 'Gekta’s answer is ready.', copy: 'Copy', copied: 'Copied', retry: 'Retry', sources: 'Sources', send: 'Send', stop: 'Stop', boundary: 'Anonymous history is stored in this browser. Do not send passwords, tokens, banking credentials or unnecessary personal data.', reconnecting: 'The connection dropped before the answer started. Reconnecting…', starters: 'Example questions', openMenu: 'Open history', closeMenu: 'Close history', newChat: 'New chat', productHome: 'Gekta — product home', clearConfirm: 'Delete all Gekta history from this browser?', deleteConfirm: 'Delete this conversation?', account: 'Gekta account', signedIn: 'History and projects are saved to your account.', logout: 'Sign out', loggingOut: 'Signing out…' },
  zh: { assistant: 'Gekta', you: '你', working: 'Gekta 正在分析…', ready: 'Gekta 的回答已就绪。', copy: '复制', copied: '已复制', retry: '重试', sources: '来源', send: '发送', stop: '停止', boundary: '匿名历史记录保存在此浏览器中。请勿发送密码、令牌、银行凭据或不必要的个人信息。', reconnecting: '回答开始前连接中断，正在重新连接…', starters: '示例问题', openMenu: '打开历史记录', closeMenu: '关闭历史记录', newChat: '新对话', productHome: 'Gekta — 产品主页', clearConfirm: '从此浏览器删除全部 Gekta 历史记录？', deleteConfirm: '删除此对话？', account: 'Gekta 账户', signedIn: '历史记录和项目已保存到账户。', logout: '退出登录', loggingOut: '正在退出…' },
} as const;

function cleanText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ').replace(/[ \t]+/gu, ' ').replace(/ *\n */gu, '\n').replace(/\n{3,}/gu, '\n\n').trim();
}

function titleFrom(text: string): string {
  const value = cleanText(text).replace(/\n/gu, ' ');
  return value.length > 62 ? `${value.slice(0, 59).trim()}…` : value;
}

function historyFrom(items: readonly GektaMessage[]): HistoryTurn[] {
  return items.filter((message) => message.text.trim()).filter((message) => message.role === 'user' || message.status === 'answered').slice(-12).map((message) => ({ role: message.role, text: message.text.slice(0, 2_000) }));
}

function safeMessages(value: unknown, locale: GektaLocale): GektaMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_MESSAGES).flatMap((row): GektaMessage[] => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    const role = item.role === 'user' ? 'user' : item.role === 'assistant' ? 'assistant' : null;
    const text = typeof item.text === 'string' ? cleanText(item.text).slice(0, 12_000) : '';
    if (!role || !text) return [];
    const rawCitations = Array.isArray(item.citations) ? item.citations : [];
    const citations = rawCitations.slice(0, 20).flatMap((citation) => {
      if (!citation || typeof citation !== 'object' || Array.isArray(citation)) return [];
      const source = citation as Record<string, unknown>;
      if (typeof source.uri !== 'string' || typeof source.title !== 'string') return [];
      return [{ sourceId: typeof source.sourceId === 'string' ? source.sourceId : id('source'), title: source.title.slice(0, 300), uri: source.uri.slice(0, 2_000) }];
    });
    const rawAttachments = Array.isArray(item.attachments) ? item.attachments : [];
    const attachments = rawAttachments.slice(0, 4).flatMap((attachment) => {
      if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) return [];
      const file = attachment as Record<string, unknown>;
      if (typeof file.name !== 'string' || typeof file.size !== 'number') return [];
      return [{ name: file.name.slice(0, 180), size: Math.max(0, file.size), mediaType: typeof file.mediaType === 'string' ? file.mediaType.slice(0, 100) : 'application/octet-stream' }];
    });
    return [{
      id: typeof item.id === 'string' ? item.id : id(role),
      role,
      text,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      ...(role === 'assistant' ? restoreGektaAssistantState(locale, text, item.status, item.refusal) : {}),
      citations,
      attachments,
    }];
  });
}

function safeConversations(value: unknown): GektaConversation[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_CONVERSATIONS).flatMap((row): GektaConversation[] => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    const locale = item.locale === 'en' || item.locale === 'zh' ? item.locale : item.locale === 'ru' ? 'ru' : null;
    const conversationId = typeof item.id === 'string' ? item.id : '';
    const title = typeof item.title === 'string' ? cleanText(item.title).slice(0, 80) : '';
    if (!locale || !conversationId || !title) return [];
    return [{ id: conversationId, locale, title, projectId: typeof item.projectId === 'string' ? item.projectId : null, createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(), updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(), messages: safeMessages(item.messages, locale) }];
  });
}

function readStoredConversations(): GektaConversation[] {
  try {
    const stored = window.localStorage.getItem(HISTORY_STORAGE);
    return safeConversations(stored ? JSON.parse(stored) : []);
  } catch {
    return [];
  }
}

function finalText(locale: GektaLocale, snapshot: GatewayStreamSnapshot): string {
  if (snapshot.refusal === 'CANCELLED') return snapshot.text || GEKTA_INTERRUPTION_COPY[locale].stopped;
  return snapshot.text || refusalCopy(locale, snapshot.refusal);
}

function track(event: string, locale: GektaLocale, extra?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return;
  const detail = { event, locale, ...(extra || {}) };
  window.dispatchEvent(new CustomEvent('gekta:analytics', { detail }));
  const target = window as Window & { dataLayer?: Array<Record<string, unknown>> };
  if (Array.isArray(target.dataLayer)) target.dataLayer.push(detail);
}

export function GektaChatWorkspace({ locale = 'ru', discoveryHero, discoveryFooter, onEnteredChat }: { locale?: GektaLocale; discoveryHero?: React.ReactNode; discoveryFooter?: React.ReactNode; onEnteredChat?: () => void }) {
  const router = useRouter();
  const { canInstall, guide, requestInstall, dismissGuide } = useGektaInstall();
  React.useEffect(() => {
    // Next client navigation retains the root layout. Only a matching standalone
    // route may update document language; embedded chat keeps its host's locale.
    if (window.location.pathname !== GEKTA_PATHS[locale]) return;
    const root = document.documentElement;
    const language = locale === 'zh' ? 'zh-CN' : locale;
    const previousLanguage = root.getAttribute('lang');
    const contentLanguage = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[http-equiv]'),
    ).find((meta) => meta.httpEquiv.toLowerCase() === 'content-language');
    const previousContentLanguage = contentLanguage?.getAttribute('content') ?? null;
    root.setAttribute('lang', language);
    contentLanguage?.setAttribute('content', language);
    return () => {
      // Restore only attributes that still carry this effect's value.
      if (root.getAttribute('lang') === language) {
        if (previousLanguage === null) root.removeAttribute('lang');
        else root.setAttribute('lang', previousLanguage);
      }
      if (contentLanguage?.getAttribute('content') === language) {
        if (previousContentLanguage === null) contentLanguage.removeAttribute('content');
        else contentLanguage.setAttribute('content', previousContentLanguage);
      }
    };
  }, [locale]);
  const product = getGektaCopy(locale);
  const ui = CHAT_UI[locale];
  const accessError = ACCESS_ERROR[locale];
  const [messages, setMessages] = React.useState<GektaMessage[]>([]);
  const [conversations, setConversations] = React.useState<GektaConversation[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [historyPhase, setHistoryPhase] = React.useState<'ready' | 'loading' | 'failed'>('ready');
  const historyRequest = React.useRef<AbortController | null>(null);
  const [documents, setDocuments] = React.useState<readonly PublicAssistantDocument[]>([]);
  const uploadScope = React.useRef<AbortController | null>(null);
  const getUploadSignal = React.useCallback(() => {
    uploadScope.current ??= new AbortController();
    return uploadScope.current.signal;
  }, []);
  const clearDocuments = React.useCallback(() => {
    uploadScope.current?.abort();
    uploadScope.current = null;
    setDocuments([]);
  }, []);
  React.useEffect(() => () => {
    uploadScope.current?.abort();
    uploadScope.current = null;
  }, [locale]);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const drawerToggle = React.useRef<HTMLButtonElement>(null);
  const settingsOpener = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (!drawerOpen) return;
    const desktop = window.matchMedia?.('(min-width: 1024px)');
    const closeDrawerOnDesktop = () => { if (desktop?.matches) setDrawerOpen(false); };
    desktop?.addEventListener('change', closeDrawerOnDesktop);
    closeDrawerOnDesktop();
    return () => desktop?.removeEventListener('change', closeDrawerOnDesktop);
  }, [drawerOpen]);
  const [search, setSearch] = React.useState('');
  const [copiedId, setCopiedId] = React.useState('');
  const [showScroll, setShowScroll] = React.useState(false);
  const [enteredChat, setEnteredChat] = React.useState(false);
  const [projects, setProjects] = React.useState<GektaProject[]>([]);
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);
  const { book: draftBook, value: input, setText: setInput, replace: replaceInput, canUndo, undo: undoDraft,
    select: selectDraft, remove: removeDraft, clear: clearDrafts, move: moveDraft, reassignProject: reassignDraftProject } = useGektaDrafts(locale, activeId, activeProjectId);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [answerLocale, setAnswerLocale] = React.useState<GektaAnswerLocale>('auto');
  const [entitlement, setEntitlement] = React.useState<GektaEntitlementSnapshot | null>(null);
  const [registrationUrl, setRegistrationUrl] = React.useState<string | null>(null);
  const [billingEnabled, setBillingEnabled] = React.useState(false);
  const [consentRequired, setConsentRequired] = React.useState(false);
  const [legalPresentation, setLegalPresentation] = React.useState<AnonymousConsentPresentation | null>(null);
  const [acceptingConsent, setAcceptingConsent] = React.useState(false);
  const [consentError, setConsentError] = React.useState(false);
  const [consentRequested, setConsentRequested] = React.useState(false);
  const [resumeConsentedPrompt, setResumeConsentedPrompt] = React.useState(false);
  const pendingConsentedPrompt = React.useRef<
    | SubmittedPrompt
    | { kind: 'retry'; messageId: string; locale: GektaLocale }
    | null
  >(null);
  const promptIntentRevision = React.useRef(0);
  const reservationController = React.useRef<AbortController | null>(null);
  const entitlementProbeController = React.useRef<AbortController | null>(null);
  const submittingPrompt = React.useRef<number | null>(null);
  // A probe started before a reserve/consent POST must not roll back its newer result.
  const entitlementRequestRevision = React.useRef(0);
  const [voiceInputEnabled, setVoiceInputEnabled] = React.useState(true);
  const [speechEnabled, setSpeechEnabled] = React.useState(true);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const hydrated = React.useRef(false);
  // Пока сервер не подтвердил аккаунт, авторитет истории — этот браузер.
  const [workspaceMode, setWorkspaceMode] = React.useState<WorkspaceMode>('local');
  const [serverSearch, setServerSearch] = React.useState<ServerSearchState>({ state: 'idle', query: '', results: null });
  const serverConversationIds = React.useRef(new Map<string, string>());
  const projectCreations = React.useRef(new Map<string, Promise<string | null>>());
  const removedProjectIds = React.useRef(new Set<string>());
  const conversationWrites = React.useRef(new Map<string, Promise<void>>());
  const sentMessageIds = React.useRef(new Set<string>());
  const documentRetries = React.useRef(new GektaDocumentRetryCache());
  React.useEffect(() => {
    documentRetries.current.clear();
    return () => documentRetries.current.clear();
  }, [locale, workspaceMode]);
  const abortRef = React.useRef<AbortController | null>(null);
  const liveReplyId = React.useRef<string | null>(null);
  const stopRequested = React.useRef(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const nearBottom = React.useRef(true);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HISTORY_STORAGE);
      const parsed = safeConversations(stored ? JSON.parse(stored) : []);
      setConversations(parsed);
      const storedProjects = window.localStorage.getItem(GEKTA_PROJECTS_STORAGE);
      setProjects(safeProjects(storedProjects ? JSON.parse(storedProjects) : []));
      const storedAnswerLocale = window.localStorage.getItem(ANSWER_LOCALE_STORAGE);
      if (storedAnswerLocale === 'ru' || storedAnswerLocale === 'en' || storedAnswerLocale === 'zh') setAnswerLocale(storedAnswerLocale);
      if (window.localStorage.getItem(VOICE_INPUT_STORAGE) === 'off') setVoiceInputEnabled(false);
      if (window.localStorage.getItem(VOICE_OUTPUT_STORAGE) === 'off') setSpeechEnabled(false);
      window.localStorage.setItem(LOCALE_STORAGE, locale);
      const params = new URLSearchParams(window.location.search);
      const prompt = params.get('prompt');
      if (params.get('chat') === 'new') selectDraft();
      if (prompt) replaceInput(cleanText(prompt).slice(0, 1_200));
      // A topic page or a floating entry can ask for the workspace directly.
      if (prompt || params.get('chat') === 'new') {
        setEnteredChat(true);
        onEnteredChat?.();
        const address = new URL(window.location.href);
        address.searchParams.delete('prompt');
        address.searchParams.delete('chat');
        window.history.replaceState(window.history.state, '', address);
      }
    } catch {
      window.localStorage.removeItem(HISTORY_STORAGE);
    } finally {
      hydrated.current = true;
      track('gekta_page_view', locale);
    }
  }, [locale]);

  /**
   * Переход на серверную историю.
   *
   * Мост отвечает 401, пока пользователь не вошёл, и 503, если API кабинета не
   * настроен. В обоих случаях остаётся локальный режим: показывать пустую
   * историю вместо уже существующей — потеря данных, а не аккуратность.
   */
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const probe = await accountApi<{ entitlement: GektaEntitlementSnapshot }>('entitlement');
      if (cancelled || !probe.ok) return;
      // Значок остатка бесплатных ответов к аккаунту неприменим: там пробный
      // период или подписка, а не счётчик анонимных ответов.
      if (probe.data?.entitlement) setEntitlement({ ...probe.data.entitlement, remaining: null, limit: null });

      // История для переноса читается прямо из хранилища, а не из состояния:
      // так перенос не зависит от того, успел ли отработать эффект гидратации.
      const local = readStoredConversations();
      if (!importAlreadyDone() && local.length > 0) {
        // Части отправляются последовательно, потому что целая история легко
        // перерастает лимит тела запроса. Пока перенесено не всё, локальная
        // копия остаётся авторитетом: иначе непереехавшие диалоги пропали бы.
        let complete = true;
        for (const chunk of chunkImport(importablePayload(local).conversations)) {
          const imported = await accountApi('history/import', { method: 'POST', body: { conversations: chunk } });
          if (cancelled) return;
          if (!imported.ok) {
            complete = false;
            break;
          }
        }
        if (!complete) return;
        markImportDone();
      }

      const [serverConversations, serverProjects] = await Promise.all([
        accountApi<{ conversations: ServerConversationRow[] }>('conversations'),
        accountApi<{ projects: ServerProjectRow[] }>('projects'),
      ]);
      if (cancelled) return;

      const now = new Date().toISOString();
      // Переключение режима привязано к успешной загрузке списка: локальная
      // копия удаляется только тогда, когда серверная история действительно
      // прочитана. Иначе сбой чтения стёр бы историю и с экрана, и из браузера.
      if (!serverConversations.ok) return;
      {
        const loaded = (serverConversations.data?.conversations ?? []).flatMap((row) => toConversation(row, now) ?? []);
        // Загруженный диалог уже живёт на сервере под своим id: без этой
        // отметки продолжение старого диалога создало бы его копию.
        for (const conversation of loaded) {
          serverConversationIds.current.set(conversation.id, conversation.id);
          for (const message of conversation.messages) sentMessageIds.current.add(message.id);
        }
        setConversations(loaded);
      }
      if (serverProjects.ok) {
        setProjects((serverProjects.data?.projects ?? []).flatMap((row) => toProject(row, now) ?? []));
      }
      setWorkspaceMode('server');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!hydrated.current) return;
    // В серверном режиме локальная копия истории удаляется целиком: две копии
    // одной истории неизбежно расходятся, и пользователь видит не то, что есть.
    if (workspaceMode === 'server') {
      try { window.localStorage.removeItem(HISTORY_STORAGE); } catch {}
      return;
    }
    try { window.localStorage.setItem(HISTORY_STORAGE, JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS))); } catch {}
  }, [conversations, workspaceMode]);

  React.useEffect(() => {
    if (!hydrated.current) return;
    if (workspaceMode === 'server') {
      try { window.localStorage.removeItem(GEKTA_PROJECTS_STORAGE); } catch {}
      return;
    }
    try { window.localStorage.setItem(GEKTA_PROJECTS_STORAGE, JSON.stringify(projects.slice(0, GEKTA_PROJECT_LIMITS.maxProjects))); } catch {}
  }, [projects, workspaceMode]);

  React.useEffect(() => {
    if (!nearBottom.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);


  /**
   * Поиск по истории аккаунта.
   *
   * Сервер отдаёт последние диалоги пачкой, поэтому фильтрация только по
   * загруженному списку не находит ничего за её пределами. При запросе от двух
   * символов поиск уходит на сервер: он же остаётся authority владения — ищет
   * строго внутри аккаунта вызывающего. Пустой запрос возвращает обычную
   * недавнюю историю.
   */
  React.useEffect(() => {
    const query = search.trim().slice(0, GEKTA_SEARCH_MAX_LENGTH);
    if (workspaceMode !== 'server' || query.length < GEKTA_SEARCH_MIN_LENGTH) {
      setServerSearch({ state: 'idle', query: '', results: null });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setServerSearch((current) => ({ ...current, state: 'loading' }));
      void (async () => {
        const found = await accountApi<{ conversations: ServerConversationRow[] }>(
          `conversations?search=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (!found.ok) {
          setServerSearch({ state: 'error', query, results: null });
          return;
        }
        const now = new Date().toISOString();
        setServerSearch({
          state: 'idle',
          query,
          results: (found.data?.conversations ?? []).flatMap((row) => toConversation(row, now) ?? []),
        });
      })();
    }, GEKTA_SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [search, workspaceMode]);

  const visibleConversations = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    // Результат сервера уже отобран запросом и может содержать диалоги за
    // пределами загруженной страницы; локальный список остаётся источником,
    // пока серверный ответ не пришёл.
    const source = serverSearch.results ?? conversations;
    return source
      .filter((conversation) => conversation.locale === locale)
      .filter((conversation) => !activeProjectId || conversation.projectId === activeProjectId)
      .filter((conversation) => !needle || serverSearch.results !== null || conversation.title.toLocaleLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [activeProjectId, conversations, locale, search, serverSearch.results]);

  const localeProjects = React.useMemo(() => projects.filter((project) => project.locale === locale).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [projects, locale]);

  const projectCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const conversation of conversations) {
      if (conversation.locale !== locale || !conversation.projectId) continue;
      counts[conversation.projectId] = (counts[conversation.projectId] ?? 0) + 1;
    }
    return counts;
  }, [conversations, locale]);

  /** Searching for a chat should also surface the project that holds it. */
  const searchedProjects = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return localeProjects;
    return localeProjects.filter((project) => {
      const titles = conversations.filter((conversation) => conversation.projectId === project.id).map((conversation) => conversation.title);
      return [project.name, project.description, ...titles].join('\n').toLocaleLowerCase().includes(needle);
    });
  }, [conversations, localeProjects, search]);

  /**
   * Запись диалога в аккаунт.
   *
   * Сервер выдаёт собственные идентификаторы, поэтому клиентский id диалога
   * сопоставляется с серверным один раз и дальше переиспользуется. Отправленные
   * сообщения помечаются, чтобы повторное сохранение того же хода не создавало
   * дублей в истории.
   */
  const persistToServer = React.useCallback(async (
    conversationId: string,
    nextMessages: readonly GektaMessage[],
    title: string,
  ) => {
    let serverId = serverConversationIds.current.get(conversationId);
    if (!serverId) {
      const pendingProject = activeProjectId && projectCreations.current.get(activeProjectId);
      const resolvedProject = pendingProject ? await pendingProject : activeProjectId;
      const projectId = resolvedProject && !removedProjectIds.current.has(resolvedProject) ? resolvedProject : null;
      const created = await accountApi<{ id: string }>('conversations', {
        method: 'POST',
        body: { title, locale, projectId },
      });
      if (!created.ok || typeof created.data?.id !== 'string') return;
      serverId = created.data.id;
      serverConversationIds.current.set(conversationId, serverId);
      if (serverId !== conversationId) moveDraft(conversationId, serverId);
    }
    for (const message of nextMessages) {
      if (sentMessageIds.current.has(message.id)) continue;
      if (!message.text.trim()) continue;
      const stored = await accountApi(`conversations/${encodeURIComponent(serverId)}/messages`, {
        method: 'POST',
        body: { role: message.role, body: message.text, citations: message.citations ?? [], attachments: message.attachments ?? [] },
      });
      if (stored.ok) sentMessageIds.current.add(message.id);
    }
  }, [activeProjectId, locale, moveDraft]);

  const saveConversation = React.useCallback((conversationId: string, nextMessages: readonly GektaMessage[], preferredTitle?: string) => {
    const now = new Date().toISOString();
    let savedTitle = preferredTitle ?? '';
    setConversations((current) => {
      const existing = current.find((conversation) => conversation.id === conversationId);
      const title = preferredTitle || existing?.title || titleFrom(nextMessages.find((message) => message.role === 'user')?.text || ui.newChat);
      savedTitle = title;
      const next: GektaConversation = { id: conversationId, locale, title, projectId: existing?.projectId ?? activeProjectId, createdAt: existing?.createdAt || now, updatedAt: now, messages: nextMessages.slice(-MAX_MESSAGES) };
      return [next, ...current.filter((conversation) => conversation.id !== conversationId)].slice(0, MAX_CONVERSATIONS);
    });
    if (workspaceMode === 'server') {
      const title = savedTitle || titleFrom(nextMessages.find((message) => message.role === 'user')?.text || ui.newChat);
      const previous = conversationWrites.current.get(conversationId) ?? Promise.resolve();
      const write = previous.then(() => persistToServer(conversationId, nextMessages, title));
      conversationWrites.current.set(conversationId, write);
      void write.finally(() => {
        if (conversationWrites.current.get(conversationId) === write) conversationWrites.current.delete(conversationId);
      });
    }
  }, [activeProjectId, locale, persistToServer, ui.newChat, workspaceMode]);

  const stop = React.useCallback(() => {
    if (!abortRef.current) return;
    stopRequested.current = true;
    abortRef.current.abort();
    track('gekta_answer_stopped', locale);
  }, [locale]);

  const focusComposer = React.useCallback(() => {
    window.requestAnimationFrame(() => {
      const composer = document.getElementById('gekta-composer-input');
      if (composer instanceof HTMLTextAreaElement && !composer.closest('[inert]')) {
        composer.focus();
        composer.setSelectionRange(composer.value.length, composer.value.length);
      }
    });
  }, []);

  const enterChat = React.useCallback(() => {
    setEnteredChat(true);
    onEnteredChat?.();
    focusComposer();
  }, [focusComposer, onEnteredChat]);

  /** A starter fills the composer and hands control back: the person edits and sends. */
  const useStarter = React.useCallback((prompt: string) => {
    replaceInput(cleanText(prompt).slice(0, 1_200));
    setError('');
    // Focus the same textarea within the tap so mobile keyboards can open.
    document.getElementById('gekta-composer-input')?.focus();
    track('gekta_starter_used', locale);
  }, [locale, replaceInput]);

  React.useEffect(() => {
    const open = () => {
      enterChat();
      track('gekta_chat_open', locale);
    };
    window.addEventListener(GEKTA_ENTER_CHAT_EVENT, open);
    return () => window.removeEventListener(GEKTA_ENTER_CHAT_EVENT, open);
  }, [enterChat, locale]);

  const cancelPendingPrompt = React.useCallback(() => {
    promptIntentRevision.current += 1;
    historyRequest.current?.abort();
    historyRequest.current = null;
    setHistoryPhase('ready');
    liveReplyId.current = null;
    if (abortRef.current) {
      stop();
      abortRef.current = null;
      setSending(false);
    }
    reservationController.current?.abort();
    reservationController.current = null;
    pendingConsentedPrompt.current = null;
    setResumeConsentedPrompt(false);
    setConsentRequested(false);
    setConsentError(false);
  }, [stop]);

  React.useEffect(() => { cancelPendingPrompt(); }, [cancelPendingPrompt, locale]);
  React.useEffect(() => () => {
    reservationController.current?.abort();
    historyRequest.current?.abort();
  }, []);

  const newChat = React.useCallback(() => {
    cancelPendingPrompt();
    nearBottom.current = true;
    setActiveId(null);
    setMessages([]);
    selectDraft();
    clearDocuments();
    pendingConsentedPrompt.current = null;
    setResumeConsentedPrompt(false);
    setConsentRequested(false);
    setError('');
    setCopiedId('');
    setDrawerOpen(false);
    focusComposer();
    track('gekta_new_chat', locale);
  }, [cancelPendingPrompt, clearDocuments, focusComposer, locale, selectDraft]);

  const logout = React.useCallback(async () => {
    if (loggingOut) return;
    documentRetries.current.clear();
    setLoggingOut(true);
    await logoutGektaAccount();
    clearGektaTabDrafts();
    window.location.assign(GEKTA_PATHS[locale]);
  }, [locale, loggingOut]);

  const applyEntitlement = React.useCallback((payload: unknown) => {
    if (!payload || typeof payload !== 'object') return;
    const body = payload as { entitlement?: GektaEntitlementSnapshot; registrationUrl?: unknown; billingEnabled?: unknown; consentCurrent?: unknown; legalVersion?: unknown; consent?: { surfaceLocale?: unknown } | null; legalPresentation?: AnonymousConsentPresentation };
    if (body.entitlement && typeof body.entitlement === 'object') setEntitlement(body.entitlement);
    setRegistrationUrl(typeof body.registrationUrl === 'string' ? body.registrationUrl : null);
    setBillingEnabled(body.billingEnabled === true);
    if (typeof body.legalVersion === 'string') {
      const notice = body.legalPresentation;
      const proofLocale = notice?.locale ?? body.consent?.surfaceLocale;
      if (proofLocale !== locale) { setConsentRequired(true); return false; }
      setConsentRequired(body.consentCurrent !== true);
      if (notice && typeof notice.snapshot === 'string' && notice.snapshot.length <= 2_048
        && ['ru', 'en', 'zh'].includes(notice.locale) && typeof notice.termsHref === 'string' && typeof notice.privacyHref === 'string'
        && notice.termsHref.startsWith('/legal/') && notice.privacyHref.startsWith('/legal/')) setLegalPresentation(notice);
      return body.consentCurrent === true;
    }
    return false;
  }, [locale]);

  const currentLegalPresentation = legalPresentation?.locale === locale ? legalPresentation : null;

  const consentNotice = consentRequested && consentRequired ? currentLegalPresentation : null;
  const consentOpen = consentNotice !== null;
  const isolateForConsent = React.useCallback((element: HTMLDivElement | null) => {
    element?.toggleAttribute('inert', consentOpen);
  }, [consentOpen]);

  const acceptConsent = React.useCallback(async () => {
    if (acceptingConsent || !legalPresentation || legalPresentation.locale !== locale) return;
    const revision = promptIntentRevision.current;
    entitlementProbeController.current?.abort();
    entitlementProbeController.current = null;
    entitlementRequestRevision.current += 1;
    setAcceptingConsent(true);
    setConsentError(false);
    try {
      const response = await fetch('/api/gekta/entitlement', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'consent', noticeSnapshot: legalPresentation.snapshot, locale: legalPresentation.locale }),
      });
      const payload = await response.json();
      // Returning to the draft cancels sending, even if an earlier acknowledgement arrives later.
      if (revision !== promptIntentRevision.current) return;
      const confirmed = applyEntitlement(payload);
      if (response.ok && confirmed === true) {
        track('gekta_legal_consent_accepted', locale);
        setConsentRequested(false);
        setResumeConsentedPrompt(true);
      }
      else { setConsentRequired(true); setConsentError(true); }
    } catch {
      if (revision !== promptIntentRevision.current) return;
      setConsentRequired(true);
      setConsentError(true);
    } finally {
      setAcceptingConsent(false);
    }
  }, [locale, legalPresentation, acceptingConsent, applyEntitlement]);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    entitlementProbeController.current = controller;
    const revision = entitlementRequestRevision.current;
    void (async () => {
      try {
        const response = await fetch(`/api/gekta/entitlement?lang=${locale}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (!cancelled && revision === entitlementRequestRevision.current) applyEntitlement(payload);
      } catch {
        // Access is decided by the server on every request; a failed probe only
        // means the badge is not shown yet.
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      if (entitlementProbeController.current === controller) entitlementProbeController.current = null;
    };
  }, [applyEntitlement, locale]);

  /** Server decides whether another answer may be generated. */
  const reserveAnswer = React.useCallback(async (onConsentRequired?: () => void, isCurrentIntent: () => boolean = () => true, signal?: AbortSignal): Promise<string | null> => {
    if (!isCurrentIntent() || signal?.aborted) return null;
    entitlementProbeController.current?.abort();
    entitlementProbeController.current = null;
    entitlementRequestRevision.current += 1;
    // У вошедшего пользователя доступ решает аккаунт, а не квота анонимного
    // режима: иначе пробный период упирался бы в десять бесплатных ответов.
    if (workspaceMode === 'server') {
      const decision = await accountApi<{ entitlement: GektaEntitlementSnapshot }>('entitlement');
      if (!isCurrentIntent() || signal?.aborted) return null;
      if (decision.ok && decision.data?.entitlement) {
        const snapshot = { ...decision.data.entitlement, remaining: null, limit: null };
        setEntitlement(snapshot);
        if (!snapshot.canAsk) {
          track('gekta_registration_gate_view', locale);
          return null;
        }
        // Ответ засчитывается на сервере при записи реплики ассистента,
        // поэтому анонимный тикет здесь не нужен.
        return ACCOUNT_TICKET;
      }
    }
    try {
      const response = await fetch('/api/gekta/entitlement', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reserve', locale }),
        signal,
      });
      if (!isCurrentIntent() || signal?.aborted) return null;
      if (!response.ok) { setError(accessError); return null; }
      const payload = await response.json() as { allowed?: boolean; ticket?: string | null; reason?: string };
      if (!isCurrentIntent() || signal?.aborted) return null;
      applyEntitlement(payload);
      if (payload.reason === 'consent_required') {
        setConsentRequired(true);
        onConsentRequired?.();
        if (!('legalPresentation' in payload)) setError(accessError);
        return null;
      }
      if (!payload.allowed) {
        track('gekta_anonymous_limit_reached', locale);
        track('gekta_registration_gate_view', locale);
        return null;
      }
      if (typeof payload.ticket === 'string' && payload.ticket) return payload.ticket;
      setError(accessError);
      return null;
    } catch {
      if (isCurrentIntent() && !signal?.aborted) setError(accessError);
      return null;
    }
  }, [accessError, applyEntitlement, locale, workspaceMode]);

  const settleAnswer = React.useCallback(async (ticket: string) => {
    // Счётчик аккаунта двигает сервер, когда сохраняет ответ ассистента.
    if (ticket === ACCOUNT_TICKET) return;
    try {
      const response = await fetch('/api/gekta/entitlement', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', ticket }),
      });
      if (response.ok) applyEntitlement(await response.json());
    } catch {
      // The reservation is settled server-side on the next request anyway.
    }
  }, [applyEntitlement]);

  const runGeneration = React.useCallback(async ({ question, documents: requestDocuments = [], history, conversationId, baseMessages, ticket }: { question: string; documents?: readonly GektaDocumentContext[]; history: HistoryTurn[]; conversationId: string; baseMessages: readonly GektaMessage[]; ticket: string }) => {
    if (sending) return;
    const revision = promptIntentRevision.current;
    const assistantId = id('assistant');
    liveReplyId.current = assistantId;
    nearBottom.current = true;
    const startedAt = new Date().toISOString();
    const assistantBase: GektaMessage = { id: assistantId, role: 'assistant', text: '', createdAt: startedAt, status: 'streaming', refusal: null, citations: [] };
    setMessages([...baseMessages, assistantBase]);
    setSending(true);
    setError('');
    stopRequested.current = false;
    track('gekta_answer_started', locale);

    let terminal: GatewayStreamSnapshot | null = null;
    const controller = new AbortController();
    abortRef.current = controller;
    let deadlineReached = false;
    const timeout = window.setTimeout(() => {
      deadlineReached = true;
      controller.abort();
    }, PUBLIC_STREAM_TIMEOUT_MS + 5_000);
    try {
      // A lost response does not prove that the one-use ticket is unconsumed.
      // Explicit Retry obtains fresh admission before another generation.
      const response = await fetch('/api/agro-chat?stream=1', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'x-gekta-answer-ticket': ticket,
        },
        signal: controller.signal,
        body: JSON.stringify({ message: question, documents: requestDocuments, locale: answerLocale === 'auto' ? locale : answerLocale, context: 'gekta-standalone', conversationId, history }),
      });
      terminal = await readGatewayStream(response, {
        mode: 'public',
        signal: controller.signal,
        onSnapshot: (snapshot) => {
          if (revision !== promptIntentRevision.current || (deadlineReached && !stopRequested.current)) return;
          const text = snapshot.status === 'refused' ? finalText(locale, snapshot) : snapshot.text;
          setMessages([...baseMessages, { ...assistantBase, text: cleanText(text), status: snapshot.status, refusal: snapshot.refusal, citations: snapshot.citations.map((citation) => ({ sourceId: citation.sourceId, title: citation.title, uri: citation.uri })) }]);
        },
      });
      window.clearTimeout(timeout);
      if (deadlineReached && !stopRequested.current) throw new DOMException('generation-deadline', 'AbortError');
      if (!terminal) throw new Error('stream-ended-without-terminal-snapshot');
      const text = terminal.status === 'refused' ? finalText(locale, terminal) : terminal.text;
      const finalMessage: GektaMessage = { ...assistantBase, text: cleanText(text), status: terminal.status, refusal: terminal.refusal, citations: terminal.citations.map((citation) => ({ sourceId: citation.sourceId, title: citation.title, uri: citation.uri })) };
      const finalMessages = [...baseMessages, finalMessage];
      if (revision === promptIntentRevision.current) {
        setMessages(finalMessages);
        saveConversation(conversationId, finalMessages);
        setError('');
      }
      track('gekta_answer_completed', locale, { sourceCount: finalMessage.citations?.length || 0 });
      if (finalMessage.status === 'answered') await settleAnswer(ticket);
    } catch (reason) {
      if (revision !== promptIntentRevision.current) return;
      const aborted = reason instanceof DOMException && reason.name === 'AbortError';
      const { stopped, timeout: timeoutText, error: errorText } = GEKTA_INTERRUPTION_COPY[locale];
      const text = aborted ? (stopRequested.current ? stopped : timeoutText) : errorText;
      const failed: GektaMessage = { ...assistantBase, text, status: 'refused', refusal: aborted && stopRequested.current ? 'CANCELLED' : 'UPSTREAM_ERROR', citations: [] };
      const finalMessages = [...baseMessages, failed];
      setMessages(finalMessages);
      saveConversation(conversationId, finalMessages);
    } finally {
      window.clearTimeout(timeout);
      if (abortRef.current === controller) {
        abortRef.current = null;
        stopRequested.current = false;
        setSending(false);
      }
    }
  }, [answerLocale, locale, saveConversation, sending, settleAnswer]);

  const submit = React.useCallback(async (resumed?: SubmittedPrompt) => {
    if (historyPhase !== 'ready' || sending || submittingPrompt.current === promptIntentRevision.current) return;
    const question = resumed?.question ?? cleanText(input).slice(0, 1_200);
    if (!question) return;
    // Reserve and consent may finish after the person starts a different draft.
    let submitted: SubmittedPrompt;
    try {
      submitted = resumed ?? { kind: 'send', locale, draftId: draftBook.active, text: input, question,
        files: documents, context: readDocumentContext(documents) };
    }
    catch { setError(DOCUMENT_CONTEXT_COPY[locale].invalid); return; }
    const revision = promptIntentRevision.current;
    submittingPrompt.current = revision;
    const controller = new AbortController();
    reservationController.current = controller;
    setError('');
    try {
      const ticket = await reserveAnswer(() => {
        if (revision !== promptIntentRevision.current) return;
        pendingConsentedPrompt.current = submitted;
        setConsentRequested(true);
      }, () => revision === promptIntentRevision.current, controller.signal);
      if (!ticket || revision !== promptIntentRevision.current) return;
      pendingConsentedPrompt.current = null;
      const conversationId = activeId || id('conversation');
      const history = historyFrom(messages);
      const attached = submitted.files.map(({ name, size, mediaType }) => ({ name, size, mediaType }));
      const userMessage: GektaMessage = { id: id('user'), role: 'user', text: question, createdAt: new Date().toISOString(), attachments: attached };
      documentRetries.current.remember(userMessage.id, submitted.context);
      const baseMessages = [...messages, userMessage];
      setActiveId(conversationId);
      setMessages(baseMessages);
      saveConversation(conversationId, baseMessages, activeId ? undefined : titleFrom(question));
      moveDraft(submitted.draftId, serverConversationIds.current.get(conversationId) ?? conversationId, submitted.text);
      setDocuments(current => current.filter(file => !submitted.files.includes(file)));
      onEnteredChat?.();
      track('gekta_prompt_submitted', locale, { hasAttachments: attached.length > 0 });
      await runGeneration({ question, documents: submitted.context, history, conversationId, baseMessages, ticket });
    } finally {
      if (reservationController.current === controller) reservationController.current = null;
      if (submittingPrompt.current === revision) submittingPrompt.current = null;
    }
  }, [activeId, documents, draftBook.active, historyPhase, input, locale, messages, moveDraft, onEnteredChat, reserveAnswer, runGeneration, saveConversation, sending]);

  const retry = React.useCallback(async (assistantIndex: number) => {
    if (sending || submittingPrompt.current === promptIntentRevision.current) return;
    const assistant = messages[assistantIndex];
    if (assistant?.role !== 'assistant') return;
    let userIndex = -1;
    for (let index = assistantIndex - 1; index >= 0; index -= 1) { if (messages[index]?.role === 'user') { userIndex = index; break; } }
    if (userIndex < 0) return;
    const original = messages[userIndex];
    const requestDocuments = documentRetries.current.read(original.id);
    if (original.attachments?.length && !requestDocuments) {
      setError(DOCUMENT_CONTEXT_COPY[locale].missing);
      replaceInput(original.text);
      focusComposer();
      return;
    }
    const revision = promptIntentRevision.current;
    submittingPrompt.current = revision;
    const controller = new AbortController();
    reservationController.current = controller;
    try {
      const ticket = await reserveAnswer(() => {
        pendingConsentedPrompt.current = { kind: 'retry', messageId: assistant.id, locale };
        setConsentRequested(true);
      }, () => revision === promptIntentRevision.current, controller.signal);
      if (!ticket || revision !== promptIntentRevision.current || controller.signal.aborted) return;
      const conversationId = activeId || id('conversation');
      const question = messages[userIndex].text;
      const baseMessages = messages.slice(0, userIndex + 1);
      setMessages(baseMessages);
      saveConversation(conversationId, baseMessages);
      track('gekta_retry', locale);
      await runGeneration({ question, documents: requestDocuments, history: historyFrom(messages.slice(0, userIndex)), conversationId, baseMessages, ticket });
    } finally {
      if (reservationController.current === controller) reservationController.current = null;
      if (submittingPrompt.current === revision) submittingPrompt.current = null;
    }
  }, [activeId, focusComposer, locale, messages, replaceInput, reserveAnswer, runGeneration, saveConversation, sending]);

  React.useEffect(() => {
    if (!resumeConsentedPrompt || acceptingConsent || consentRequired) return;
    setResumeConsentedPrompt(false);
    const pending = pendingConsentedPrompt.current;
    pendingConsentedPrompt.current = null;
    if (!pending || pending.locale !== locale) return;
    if (pending.kind === 'send') void submit(pending);
    else void retry(messages.findIndex(message => message.id === pending.messageId));
  }, [acceptingConsent, consentRequired, locale, messages, resumeConsentedPrompt, retry, submit]);

  const copyMessage = React.useCallback(async (message: GektaMessage) => {
    try { await navigator.clipboard.writeText(message.text); setCopiedId(message.id); window.setTimeout(() => setCopiedId(''), 1_500); } catch {}
  }, []);

  const loadConversationHistory = React.useCallback(async (conversationId: string, serverId: string) => {
    historyRequest.current?.abort();
    const controller = new AbortController();
    historyRequest.current = controller;
    setHistoryPhase('loading');
    const loaded = await accountApi<ServerConversationRow>(`conversations/${encodeURIComponent(serverId)}`, { signal: controller.signal });
    if (controller.signal.aborted) return;
    historyRequest.current = null;
    const restored = loaded.ok && loaded.data?.id === serverId && Array.isArray(loaded.data.messages)
      ? toConversation(loaded.data, new Date().toISOString()) : null;
    if (!restored) { setHistoryPhase('failed'); return; }
    for (const message of restored.messages) sentMessageIds.current.add(message.id);
    setConversations(current => current.some(item => item.id === conversationId)
      ? current.map(item => item.id === conversationId ? { ...item, messages: restored.messages } : item)
      : [{ ...restored, id: conversationId }, ...current]);
    setMessages([...restored.messages]);
    setHistoryPhase('ready');
  }, []);

  const selectConversation = React.useCallback((conversation: GektaConversation) => {
    cancelPendingPrompt();
    nearBottom.current = true;
    setActiveId(conversation.id);
    setMessages([...conversation.messages]);
    selectDraft(serverConversationIds.current.get(conversation.id) ?? conversation.id);
    clearDocuments();
    setError('');
    setDrawerOpen(false);
    onEnteredChat?.();

    // Список диалогов приходит с сервера без реплик — иначе каждая загрузка
    // истории тянула бы всю переписку целиком. Сами реплики читаются при
    // открытии диалога, иначе восстановленная история открывалась бы пустой.
    if (workspaceMode !== 'server' || conversation.messages.length > 0) return;
    const serverId = serverConversationIds.current.get(conversation.id);
    // Search can return an account conversation outside the first page of the list.
    serverConversationIds.current.set(conversation.id, serverId ?? conversation.id);
    void loadConversationHistory(conversation.id, serverId ?? conversation.id);
  }, [cancelPendingPrompt, clearDocuments, loadConversationHistory, onEnteredChat, selectDraft, workspaceMode]);

  // A follow-up must reopen its own history before it can be sent.
  React.useEffect(() => {
    if (activeId || isNewGektaDraft(draftBook.active) || !draftBook.rows.some((row) => row.id === draftBook.active)) return;
    const saved = conversations.find((row) => row.locale === locale && (row.id === draftBook.active || serverConversationIds.current.get(row.id) === draftBook.active));
    if (saved) selectConversation(saved);
  }, [activeId, conversations, draftBook, locale, selectConversation]);

  const openUnsent = (id: string) => {
    const draft = draftBook.rows.find((row) => row.id === id);
    if (!draft) return;
    cancelPendingPrompt();
    nearBottom.current = true;
    setActiveId(null);
    const projectId = projects.some(project => project.id === draft.projectId) ? draft.projectId : null;
    if (draft.projectId && !projectId) reassignDraftProject(draft.projectId, null);
    setActiveProjectId(projectId);
    selectDraft(id);
    setMessages([]);
    clearDocuments();
    setError('');
    setDrawerOpen(false);
    enterChat();
  };

  /**
   * Серверный адрес диалога. Для загруженной из аккаунта переписки он совпадает
   * с локальным, для только что начатой — появляется после первой записи.
   */
  const serverIdOf = React.useCallback((conversationId: string) => (
    workspaceMode === 'server' ? serverConversationIds.current.get(conversationId) ?? null : null
  ), [workspaceMode]);

  const renameConversation = React.useCallback((conversationId: string, title: string) => {
    const next = title.slice(0, 80);
    setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, title: next, updatedAt: new Date().toISOString() } : conversation));
    const serverId = serverIdOf(conversationId);
    if (serverId) void accountApi(`conversations/${encodeURIComponent(serverId)}`, { method: 'PATCH', body: { title: next } });
  }, [serverIdOf]);

  const deleteConversation = React.useCallback((conversationId: string) => {
    if (!window.confirm(ui.deleteConfirm)) return;
    documentRetries.current.clear();
    setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
    if (activeId === conversationId) { cancelPendingPrompt(); setActiveId(null); setMessages([]); clearDocuments(); }
    const serverId = serverIdOf(conversationId);
    removeDraft(serverId ?? conversationId);
    if (serverId) void accountApi(`conversations/${encodeURIComponent(serverId)}`, { method: 'DELETE' });
  }, [activeId, cancelPendingPrompt, clearDocuments, removeDraft, serverIdOf, ui.deleteConfirm]);

  const clearHistory = React.useCallback(() => {
    if (!window.confirm(ui.clearConfirm)) return;
    clearDrafts();
    documentRetries.current.clear();
    cancelPendingPrompt();
    // Очистка адресована текущему языку, поэтому на сервер уходят ровно те
    // диалоги, которые исчезли с экрана. Общий DELETE стёр бы и остальные
    // языки — пользователь этого не подтверждал.
    const removed = workspaceMode === 'server'
      ? conversations.filter((conversation) => conversation.locale === locale)
      : [];
    setConversations((current) => current.filter((conversation) => conversation.locale !== locale));
    setActiveId(null); setMessages([]); clearDocuments(); setDrawerOpen(false);
    for (const conversation of removed) {
      const serverId = serverConversationIds.current.get(conversation.id);
      if (serverId) void accountApi(`conversations/${encodeURIComponent(serverId)}`, { method: 'DELETE' });
    }
  }, [cancelPendingPrompt, clearDocuments, clearDrafts, conversations, locale, ui.clearConfirm, workspaceMode]);

  const createProject = React.useCallback((name: string, description: string) => {
    const cleanName = normaliseProjectName(name);
    if (!cleanName) return;
    const now = new Date().toISOString();
    const cleanDescription = normaliseProjectDescription(description);
    const project: GektaProject = { id: id('project'), locale, name: cleanName, description: cleanDescription, createdAt: now, updatedAt: now };
    setProjects((current) => [project, ...current].slice(0, GEKTA_PROJECT_LIMITS.maxProjects));
    setActiveProjectId(project.id);
    track('gekta_project_created', locale);
    if (workspaceMode !== 'server') return;
    // Сервер выдаёт собственный id: локальная запись заменяется на серверную,
    // иначе следующая загрузка показала бы два одинаковых проекта.
    const creation = (async () => {
      const created = await accountApi<{ id: string }>('projects', {
        method: 'POST',
        body: { name: cleanName, description: cleanDescription, locale },
      });
      const serverId = created.ok && typeof created.data?.id === 'string' ? created.data.id : null;
      if (removedProjectIds.current.has(project.id)) return serverId;
      setProjects((current) => serverId
        ? current.map((item) => (item.id === project.id ? { ...item, id: serverId } : item))
        : current.filter(item => item.id !== project.id));
      reassignDraftProject(project.id, serverId);
      setActiveProjectId((current) => (current === project.id ? serverId : current));
      // Диалог, начатый до ответа сервера, уже несёт локальный id проекта.
      // Без переадресации он остался бы висеть в несуществующей папке.
      setConversations((current) => current.map((conversation) => (
        conversation.projectId === project.id ? { ...conversation, projectId: serverId } : conversation
      )));
      return serverId;
    })();
    projectCreations.current.set(project.id, creation);
  }, [locale, reassignDraftProject, workspaceMode]);

  const renameProject = React.useCallback((projectId: string, name: string) => {
    const cleanName = normaliseProjectName(name);
    if (!cleanName) return;
    setProjects((current) => current.map((project) => project.id === projectId ? { ...project, name: cleanName, updatedAt: new Date().toISOString() } : project));
    if (workspaceMode === 'server') void accountApi(`projects/${encodeURIComponent(projectId)}`, { method: 'PATCH', body: { name: cleanName } });
  }, [workspaceMode]);

  /** Deleting a project never deletes conversations: they return to the history. */
  const deleteProject = React.useCallback((projectId: string) => {
    removedProjectIds.current.add(projectId);
    reassignDraftProject(projectId, null);
    setProjects((current) => current.filter((project) => project.id !== projectId));
    setConversations((current) => current.map((conversation) => conversation.projectId === projectId ? { ...conversation, projectId: null } : conversation));
    setActiveProjectId((current) => (current === projectId ? null : current));
    if (workspaceMode === 'server') void (async () => {
      const serverId = await (projectCreations.current.get(projectId) ?? projectId);
      if (!serverId) return;
      removedProjectIds.current.add(serverId);
      await accountApi(`projects/${encodeURIComponent(serverId)}`, { method: 'DELETE' });
    })();
  }, [reassignDraftProject, workspaceMode]);

  const assignConversationProject = React.useCallback((conversationId: string, projectId: string | null) => {
    setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, projectId, updatedAt: new Date().toISOString() } : conversation));
    const serverId = serverIdOf(conversationId);
    if (serverId) void accountApi(`conversations/${encodeURIComponent(serverId)}`, { method: 'PATCH', body: { projectId } });
  }, [serverIdOf]);

  const changeVoiceInput = React.useCallback((enabled: boolean) => {
    setVoiceInputEnabled(enabled);
    try { window.localStorage.setItem(VOICE_INPUT_STORAGE, enabled ? 'on' : 'off'); } catch {}
  }, []);

  const changeVoiceOutput = React.useCallback((enabled: boolean) => {
    setSpeechEnabled(enabled);
    try { window.localStorage.setItem(VOICE_OUTPUT_STORAGE, enabled ? 'on' : 'off'); } catch {}
  }, []);

  const changeAnswerLocale = React.useCallback((next: GektaAnswerLocale) => {
    setAnswerLocale(next);
    try {
      if (next === 'auto') window.localStorage.removeItem(ANSWER_LOCALE_STORAGE);
      else window.localStorage.setItem(ANSWER_LOCALE_STORAGE, next);
    } catch {}
  }, []);

  const switchLocale = React.useCallback((next: GektaLocale) => {
    if (next === locale) return;
    try { window.localStorage.setItem(LOCALE_STORAGE, next); } catch {}
    track('gekta_locale_changed', locale);
    router.push(GEKTA_PATHS[next]);
  }, [locale, router]);

  const sidebarProps = {
    locale,
    hasHistory: conversations.some((row) => row.locale === locale) || draftBook.rows.some((row) => isNewGektaDraft(row.id)),
    hasProjects: localeProjects.length > 0,
    drafts: draftBook.rows.filter((row) => isNewGektaDraft(row.id) && (!activeProjectId || row.projectId === activeProjectId) && row.text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
    onDraft: openUnsent,
    onDeleteDraft: removeDraft,
    conversations: visibleConversations,
    projects: searchedProjects,
    activeId,
    activeProjectId,
    search,
    searchState: serverSearch.state,
    projectCounts,
    onSearch: setSearch,
    onNew: newChat,
    onSelect: selectConversation,
    onRename: renameConversation,
    onDelete: deleteConversation,
    onSettings: (opener: HTMLButtonElement) => {
      settingsOpener.current = drawerOpen ? drawerToggle.current : opener;
      setSettingsOpen(true);
      setDrawerOpen(false);
    },
    onProjectCreate: createProject,
    onProjectRename: renameProject,
    onProjectDelete: deleteProject,
    onProjectOpen: setActiveProjectId,
    onConversationProject: assignConversationProject,
  };
  const lastMessage = messages[messages.length - 1];
  const announcedReply = lastMessage?.id === liveReplyId.current ? lastMessage : undefined;
  const answerStatus = announcedReply?.status === 'answered' ? ui.ready : announcedReply?.status === 'streaming' ? ui.working : '';

  const activeChat = !discoveryHero || enteredChat || messages.length > 0 || activeId !== null;
  const accessGate = entitlement && !entitlement.canAsk
    ? <GektaAccessGate locale={locale} registrationUrl={registrationUrl} entitlement={entitlement} primary={!activeChat} billingEnabled={billingEnabled} />
    : null;
  const composer = (
    <GektaComposer
      locale={locale}
      value={input}
      placeholder={product.placeholder}
      sending={sending}
      historyReady={historyPhase === 'ready'}
      stopLabel={ui.stop}
      sendLabel={ui.send}
      boundary={ui.boundary}
      documents={documents}
      getUploadSignal={getUploadSignal}
      voiceEnabled={voiceInputEnabled}
      onDocuments={setDocuments}
      onChange={setInput}
      onUndo={canUndo ? () => { undoDraft(); focusComposer(); } : undefined}
      onSubmit={() => void submit()}
      onStop={stop}
      onError={setError}
    />
  );
  const recentConversation = !activeChat && !input.trim() && documents.length === 0
    ? conversations.reduce<GektaConversation | undefined>((latest, conversation) => {
      if (conversation.locale !== locale) return latest;
      return !latest || conversation.updatedAt.localeCompare(latest.updatedAt) > 0 ? conversation : latest;
    }, undefined)
    : undefined;
  const brand = locale === 'ru' ? 'Гекта' : 'GEKTA';
  const conversationTitle = conversations.find((conversation) => conversation.id === activeId)?.title;

  return (
    <section id='gekta-chat' lang={locale === 'zh' ? 'zh-CN' : locale} className={`${styles.workspace} ${activeChat ? 'h-[100svh] overflow-hidden' : ''}`} data-gekta-chat-workspace='true'>
      <div ref={isolateForConsent} className={`flex w-full ${activeChat ? 'h-full' : ''}`}>
        <aside className={`${styles.rail} hidden shrink-0 border-r border-slate-200 lg:block`}><GektaSidebar {...sidebarProps} /></aside>
        <main className={`relative flex min-w-0 flex-1 flex-col ${activeChat ? 'h-full' : ''}`}>
          <header className={`${styles.topbar} flex shrink-0 items-center gap-1 md:gap-3`}>
            <button ref={drawerToggle} type='button' onClick={() => setDrawerOpen(true)} className={`${styles.iconButton} ${styles.mobileAction}`} aria-label={ui.openMenu}><Menu className='h-5 w-5' aria-hidden='true' /></button>
            <Link href={GEKTA_PATHS[locale]} className='flex min-h-11 min-w-0 items-center rounded-xl px-1.5 lg:hidden' aria-label={ui.productHome} data-gekta-brand-home='true'>
              <span className={styles.brand}><GektaBrandMark />{brand}</span>
            </Link>
            {conversationTitle ? <p className='hidden min-w-0 truncate text-sm font-semibold md:block' title={conversationTitle}>{conversationTitle}</p> : null}
            <div className={styles.topbarActions}>
              <GektaRemainingBadge locale={locale} entitlement={entitlement} />
              <GektaThemeToggle locale={locale} />
              {canInstall ? <GektaInstallButton locale={locale} onInstall={(button) => void requestInstall(button)} /> : null}
              <button type='button' onClick={newChat} className={`${styles.iconButton} ${styles.mobileAction}`} data-gekta-header-new-chat='true' aria-label={ui.newChat} title={ui.newChat}><Plus className='h-5 w-5' aria-hidden='true' /></button>
            </div>
          </header>

          <div ref={scrollRef} onScroll={(event) => { const root = event.currentTarget; const distance = root.scrollHeight - root.scrollTop - root.clientHeight; nearBottom.current = distance < 140; setShowScroll(distance > 260); }} className={`${activeChat ? 'min-h-0 flex-1 overflow-y-auto' : 'flex-1'} overscroll-contain`}>
            {historyPhase !== 'ready' ? (
              <div className='mx-auto w-full max-w-[920px] px-5 py-6 text-[15px] text-slate-700'>
                <p role='status'>{HISTORY_FEEDBACK[locale][historyPhase === 'loading' ? 'loading' : 'failed']}</p>
                {historyPhase === 'failed' && activeId ? (
                  <button type='button' className='mt-2 min-h-11 rounded-lg px-2 font-semibold text-emerald-800'
                    onClick={() => void loadConversationHistory(activeId, serverConversationIds.current.get(activeId) ?? activeId)}>
                    {HISTORY_FEEDBACK[locale].retry}
                  </button>
                ) : null}
              </div>
            ) : messages.length ? <GektaMessageList messages={messages} locale={locale} sending={sending} speechEnabled={speechEnabled} onSpeech={(event) => track(event === 'started' ? 'gekta_tts_started' : 'gekta_tts_stopped', locale)} labels={{ assistant: ui.assistant, you: ui.you, copy: ui.copy, copied: ui.copied, retry: ui.retry, sources: ui.sources, working: ui.working }} copiedId={copiedId} onCopy={(message) => void copyMessage(message)} onRetry={(index) => void retry(index)} onSourceOpen={() => track('gekta_source_opened', locale)} /> : (
              <GektaEmptyState
                locale={locale}
                hero={discoveryHero}
                accessGate={activeChat ? null : accessGate}
                composer={activeChat ? null : composer}
                showStarters={!accessGate}
                starters={product.starters}
                onStarter={useStarter}
                resume={recentConversation ? {
                  title: recentConversation.title,
                  onSelect: () => selectConversation(recentConversation),
                } : undefined}
              />
            )}
            {!activeChat ? discoveryFooter : null}
            {error ? <div className='mx-auto mb-2 w-full max-w-[920px] px-4 sm:px-6'><p className='rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800' role='alert'>{error}</p></div> : null}
          </div>

          {showScroll && activeChat ? <button type='button' onClick={() => { const root = scrollRef.current; if (root) root.scrollTo({ top: root.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }} className='absolute bottom-36 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md lg:left-1/2 lg:right-auto lg:-translate-x-1/2' data-gekta-scroll-to-bottom='true' aria-label={SCROLL_LABEL[locale]}><ArrowDown className='h-4 w-4' aria-hidden='true' /></button> : null}

          <div className={activeChat ? `${styles.composerBar} shrink-0` : ''}>
            {activeChat ? accessGate ?? composer : null}
          </div>
        </main>
      </div>
      <GektaMobileDrawer open={drawerOpen && !consentOpen} closeLabel={ui.closeMenu} onClose={() => setDrawerOpen(false)}>
        <GektaSidebar {...sidebarProps} drawerStatus={<GektaRemainingBadge locale={locale} entitlement={entitlement} compact />} onInstall={canInstall ? () => {
          setDrawerOpen(false);
          void requestInstall(drawerToggle.current);
        } : undefined} />
      </GektaMobileDrawer>
      {guide && !consentOpen ? <GektaInstallGuide locale={locale} guide={guide} onDismiss={dismissGuide} /> : null}
      {/* The server gates every new answer. Existing history stays readable before renewed consent. */}
      {consentNotice ? <GektaConsentDialog locale={locale} onAccept={() => void acceptConsent()} onDismiss={cancelPendingPrompt}
        termsHref={consentNotice.termsHref} privacyHref={consentNotice.privacyHref}
        disabled={acceptingConsent} failed={consentError} /> : null}
      {settingsOpen && !consentOpen ? (
        <GektaSettingsDialog
          locale={locale}
          returnFocus={settingsOpener.current}
          answerLocale={answerLocale}
          hasHistory={conversations.length > 0}
          voiceInputEnabled={voiceInputEnabled}
          voiceOutputEnabled={speechEnabled}
          extraSections={workspaceMode === 'server' ? (
            <section className='mt-6' data-gekta-account-session='true'>
              <h3 className='text-sm font-semibold text-slate-900'>{ui.account}</h3>
              <p className='mt-2 text-xs leading-5 text-slate-500'>{ui.signedIn}</p>
              <button
                type='button'
                onClick={() => void logout()}
                disabled={loggingOut}
                className='mt-3 min-h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60'
              >
                {loggingOut ? ui.loggingOut : ui.logout}
              </button>
            </section>
          ) : undefined}
          onVoiceInput={changeVoiceInput}
          onVoiceOutput={changeVoiceOutput}
          onAnswerLocale={changeAnswerLocale}
          onLocale={switchLocale}
          onClearHistory={() => { clearHistory(); setSettingsOpen(false); }}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      <div className='sr-only' role='status' aria-live='polite' aria-atomic='true' data-gekta-answer-status='true'>{answerStatus}</div>
    </section>
  );
}
