'use client';

import * as React from 'react';
import { ArrowDown, Menu, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PublicAssistantDocument } from '@/components/platform-v7/PublicAssistantAttachmentPicker';
import {
  readGatewayStream,
  refusalCopy,
  type GatewayStreamSnapshot,
} from '@/lib/platform-v7/ai-gateway-stream';
import { GEKTA_PATHS, getGektaCopy, type GektaLocale } from '@/lib/gekta/content';
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
import type { GektaEntitlementSnapshot } from '@/lib/gekta/entitlement';
import type { GektaConversation, GektaMessage } from './GektaChatTypes';

const HISTORY_STORAGE = 'gekta-conversations-v2';
const LOCALE_STORAGE = 'gekta-locale-v1';
const ANSWER_LOCALE_STORAGE = 'gekta-answer-locale-v1';
const VOICE_INPUT_STORAGE = 'gekta-voice-input-v1';
const VOICE_OUTPUT_STORAGE = 'gekta-voice-output-v1';
const MAX_CONVERSATIONS = 60;
const MAX_MESSAGES = 80;
/** Заглушка тикета для аккаунта: у него нет квоты анонимного режима. */
const ACCOUNT_TICKET = 'account';
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

const CHAT_UI = {
  ru: { assistant: 'Гекта', you: 'Ты', working: 'Гекта анализирует…', copy: 'Копировать', copied: 'Скопировано', retry: 'Повторить', sources: 'Источники', send: 'Отправить', stop: 'Остановить', boundary: 'История анонимного режима хранится в этом браузере. Не отправляй пароли, токены, банковские реквизиты и лишние персональные данные.', error: 'Ответ не получен. Проверь соединение и повтори запрос.', timeout: 'Время ожидания ответа истекло. Повтори запрос.', stopped: 'Ответ остановлен.', reconnecting: 'Соединение прервалось до начала ответа. Переподключаюсь…', starters: 'Примеры вопросов', openMenu: 'Открыть историю', closeMenu: 'Закрыть историю', newChat: 'Новый диалог', productHome: 'Гекта — на главную продукта', clearConfirm: 'Удалить всю историю Гекты из этого браузера?', deleteConfirm: 'Удалить этот диалог?', account: 'Аккаунт Гекты', signedIn: 'История и проекты сохраняются в аккаунте.', logout: 'Выйти', loggingOut: 'Выходим…' },
  en: { assistant: 'Gekta', you: 'You', working: 'Gekta is analysing…', copy: 'Copy', copied: 'Copied', retry: 'Retry', sources: 'Sources', send: 'Send', stop: 'Stop', boundary: 'Anonymous history is stored in this browser. Do not send passwords, tokens, banking credentials or unnecessary personal data.', error: 'No answer was received. Check the connection and retry.', timeout: 'The response timed out. Retry the request.', stopped: 'Answer stopped.', reconnecting: 'The connection dropped before the answer started. Reconnecting…', starters: 'Example questions', openMenu: 'Open history', closeMenu: 'Close history', newChat: 'New chat', productHome: 'Gekta — product home', clearConfirm: 'Delete all Gekta history from this browser?', deleteConfirm: 'Delete this conversation?', account: 'Gekta account', signedIn: 'History and projects are saved to your account.', logout: 'Sign out', loggingOut: 'Signing out…' },
  zh: { assistant: 'Gekta', you: '你', working: 'Gekta 正在分析…', copy: '复制', copied: '已复制', retry: '重试', sources: '来源', send: '发送', stop: '停止', boundary: '匿名历史记录保存在此浏览器中。请勿发送密码、令牌、银行凭据或不必要的个人信息。', error: '未收到回答。请检查连接后重试。', timeout: '等待回答超时，请重试。', stopped: '回答已停止。', reconnecting: '回答开始前连接中断，正在重新连接…', starters: '示例问题', openMenu: '打开历史记录', closeMenu: '关闭历史记录', newChat: '新对话', productHome: 'Gekta — 产品主页', clearConfirm: '从此浏览器删除全部 Gekta 历史记录？', deleteConfirm: '删除此对话？', account: 'Gekta 账户', signedIn: '历史记录和项目已保存到账户。', logout: '退出登录', loggingOut: '正在退出…' },
} as const;

function id(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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

function safeMessages(value: unknown): GektaMessage[] {
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
    return [{ id: typeof item.id === 'string' ? item.id : id(role), role, text, createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(), status: role === 'assistant' ? 'answered' : undefined, refusal: null, citations, attachments }];
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
    return [{ id: conversationId, locale, title, projectId: typeof item.projectId === 'string' ? item.projectId : null, createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(), updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(), messages: safeMessages(item.messages) }];
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
  if (snapshot.refusal === 'CANCELLED') return snapshot.text || CHAT_UI[locale].stopped;
  return snapshot.text || refusalCopy(locale, snapshot.refusal);
}

function requestWithDocuments(question: string, documents: readonly PublicAssistantDocument[]): string {
  if (!documents.length) return question;
  const context = documents.map((document) => `Document: ${document.name}\n${document.text.slice(0, 12_000)}`).join('\n\n').slice(0, 32_000);
  return `${question}\n\n--- ATTACHED DOCUMENTS ---\n${context}`;
}

function track(event: string, locale: GektaLocale, extra?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return;
  const detail = { event, locale, ...(extra || {}) };
  window.dispatchEvent(new CustomEvent('gekta:analytics', { detail }));
  const target = window as Window & { dataLayer?: Array<Record<string, unknown>> };
  if (Array.isArray(target.dataLayer)) target.dataLayer.push(detail);
}

export function GektaChatWorkspace({ locale = 'ru', discoveryHero, onEnteredChat }: { locale?: GektaLocale; discoveryHero?: React.ReactNode; onEnteredChat?: () => void }) {
  const router = useRouter();
  const product = getGektaCopy(locale);
  const ui = CHAT_UI[locale];
  const [messages, setMessages] = React.useState<GektaMessage[]>([]);
  const [conversations, setConversations] = React.useState<GektaConversation[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [input, setInput] = React.useState('');
  const [documents, setDocuments] = React.useState<readonly PublicAssistantDocument[]>([]);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [copiedId, setCopiedId] = React.useState('');
  const [showScroll, setShowScroll] = React.useState(false);
  const [enteredChat, setEnteredChat] = React.useState(false);
  const [projects, setProjects] = React.useState<GektaProject[]>([]);
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [answerLocale, setAnswerLocale] = React.useState<GektaAnswerLocale>('auto');
  const [entitlement, setEntitlement] = React.useState<GektaEntitlementSnapshot | null>(null);
  const [registrationUrl, setRegistrationUrl] = React.useState<string | null>(null);
  const [billingEnabled, setBillingEnabled] = React.useState(false);
  const [consentRequired, setConsentRequired] = React.useState(false);
  const [voiceInputEnabled, setVoiceInputEnabled] = React.useState(true);
  const [speechEnabled, setSpeechEnabled] = React.useState(true);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const hydrated = React.useRef(false);
  // Пока сервер не подтвердил аккаунт, авторитет истории — этот браузер.
  const [workspaceMode, setWorkspaceMode] = React.useState<WorkspaceMode>('local');
  const [serverSearch, setServerSearch] = React.useState<ServerSearchState>({ state: 'idle', query: '', results: null });
  const serverConversationIds = React.useRef(new Map<string, string>());
  const sentMessageIds = React.useRef(new Set<string>());
  /**
   * Открытый диалог, читаемый из асинхронной догрузки реплик. Значение
   * зеркалится эффектом, а не присваивается во время рендера: запись в ref
   * при рендере — побочный эффект, который React вправе выполнить дважды.
   */
  const activeIdRef = React.useRef<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const stopRequested = React.useRef(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const nearBottom = React.useRef(true);

  React.useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

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
      if (prompt) setInput(cleanText(prompt).slice(0, 1_200));
      // A topic page or a floating entry can ask for the workspace directly.
      if (prompt || params.get('chat') === 'new') {
        setEnteredChat(true);
        onEnteredChat?.();
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
    if ((!nearBottom.current && !sending) || !scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: sending ? 'auto' : 'smooth' });
  }, [messages, sending]);


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
      const created = await accountApi<{ id: string }>('conversations', {
        method: 'POST',
        body: { title, locale, projectId: activeProjectId },
      });
      if (!created.ok || typeof created.data?.id !== 'string') return;
      serverId = created.data.id;
      serverConversationIds.current.set(conversationId, serverId);
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
  }, [activeProjectId, locale]);

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
      void persistToServer(conversationId, nextMessages, savedTitle || titleFrom(nextMessages.find((message) => message.role === 'user')?.text || ui.newChat));
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
      if (composer instanceof HTMLTextAreaElement) {
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
    setInput(cleanText(prompt).slice(0, 1_200));
    setError('');
    enterChat();
    track('gekta_starter_used', locale);
  }, [enterChat, locale]);

  React.useEffect(() => {
    const open = () => {
      enterChat();
      track('gekta_chat_open', locale);
    };
    window.addEventListener(GEKTA_ENTER_CHAT_EVENT, open);
    return () => window.removeEventListener(GEKTA_ENTER_CHAT_EVENT, open);
  }, [enterChat, locale]);

  const newChat = React.useCallback(() => {
    stop();
    setActiveId(null);
    setMessages([]);
    setInput('');
    setDocuments([]);
    setError('');
    setCopiedId('');
    setDrawerOpen(false);
    track('gekta_new_chat', locale);
  }, [locale, stop]);

  const logout = React.useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logoutGektaAccount();
    window.location.assign(GEKTA_PATHS[locale]);
  }, [locale, loggingOut]);

  const applyEntitlement = React.useCallback((payload: unknown) => {
    if (!payload || typeof payload !== 'object') return;
    const body = payload as { entitlement?: GektaEntitlementSnapshot; registrationUrl?: unknown; billingEnabled?: unknown; consent?: { version?: unknown } | null; legalVersion?: unknown };
    if (body.entitlement && typeof body.entitlement === 'object') setEntitlement(body.entitlement);
    setRegistrationUrl(typeof body.registrationUrl === 'string' ? body.registrationUrl : null);
    setBillingEnabled(body.billingEnabled === true);
    if (typeof body.legalVersion === 'string') {
      // Re-asked only when the documents themselves change version.
      setConsentRequired(body.consent?.version !== body.legalVersion);
    }
  }, []);

  const acceptConsent = React.useCallback(async () => {
    setConsentRequired(false);
    track('gekta_legal_consent_accepted', locale);
    try {
      const response = await fetch('/api/gekta/entitlement', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'consent' }),
      });
      if (response.ok) applyEntitlement(await response.json());
    } catch {
      // The notice is shown again on the next visit if the record did not land.
    }
  }, [locale]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/gekta/entitlement', { cache: 'no-store' });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (!cancelled) applyEntitlement(payload);
      } catch {
        // Access is decided by the server on every request; a failed probe only
        // means the badge is not shown yet.
      }
    })();
    return () => { cancelled = true; };
  }, [applyEntitlement]);

  /** Server decides whether another answer may be generated. */
  const reserveAnswer = React.useCallback(async (): Promise<string | null> => {
    // У вошедшего пользователя доступ решает аккаунт, а не квота анонимного
    // режима: иначе пробный период упирался бы в десять бесплатных ответов.
    if (workspaceMode === 'server') {
      const decision = await accountApi<{ entitlement: GektaEntitlementSnapshot }>('entitlement');
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
        body: JSON.stringify({ action: 'reserve' }),
      });
      if (!response.ok) return null;
      const payload = await response.json() as { allowed?: boolean; ticket?: string | null };
      applyEntitlement(payload);
      if (!payload.allowed) {
        track('gekta_anonymous_limit_reached', locale);
        track('gekta_registration_gate_view', locale);
        return null;
      }
      return typeof payload.ticket === 'string' ? payload.ticket : null;
    } catch {
      return null;
    }
  }, [applyEntitlement, locale, workspaceMode]);

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

  const runGeneration = React.useCallback(async ({ question, history, conversationId, baseMessages, ticket }: { question: string; history: HistoryTurn[]; conversationId: string; baseMessages: readonly GektaMessage[]; ticket: string }) => {
    if (sending) return;
    const assistantId = id('assistant');
    const startedAt = new Date().toISOString();
    const assistantBase: GektaMessage = { id: assistantId, role: 'assistant', text: '', createdAt: startedAt, status: 'streaming', refusal: null, citations: [] };
    setMessages([...baseMessages, assistantBase]);
    setSending(true);
    setError('');
    stopRequested.current = false;
    track('gekta_answer_started', locale);

    let terminal: GatewayStreamSnapshot | null = null;
    let received = false;
    let attempt = 0;
    try {
      while (attempt < 2) {
        const controller = new AbortController();
        abortRef.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), 90_000);
        try {
          const response = await fetch('/api/agro-chat?stream=1', {
            method: 'POST',
            cache: 'no-store',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
              'x-gekta-answer-ticket': ticket,
            },
            signal: controller.signal,
            body: JSON.stringify({ message: question, locale: answerLocale === 'auto' ? locale : answerLocale, context: 'gekta-standalone', conversationId, history }),
          });
          terminal = await readGatewayStream(response, {
            mode: 'public',
            signal: controller.signal,
            onSnapshot: (snapshot) => {
              if (snapshot.text) received = true;
              const text = snapshot.status === 'refused' ? finalText(locale, snapshot) : snapshot.text;
              setMessages([...baseMessages, { ...assistantBase, text: cleanText(text), status: snapshot.status, refusal: snapshot.refusal, citations: snapshot.citations.map((citation) => ({ sourceId: citation.sourceId, title: citation.title, uri: citation.uri })) }]);
            },
          });
          window.clearTimeout(timeout);
          break;
        } catch (reason) {
          window.clearTimeout(timeout);
          const aborted = reason instanceof DOMException && reason.name === 'AbortError';
          if (aborted || received || attempt > 0) throw reason;
          attempt += 1;
          setError(ui.reconnecting);
          track('gekta_answer_reconnect', locale);
        }
      }
      if (!terminal) throw new Error('stream-ended-without-terminal-snapshot');
      const text = terminal.status === 'refused' ? finalText(locale, terminal) : terminal.text;
      const finalMessage: GektaMessage = { ...assistantBase, text: cleanText(text), status: terminal.status, refusal: terminal.refusal, citations: terminal.citations.map((citation) => ({ sourceId: citation.sourceId, title: citation.title, uri: citation.uri })) };
      const finalMessages = [...baseMessages, finalMessage];
      setMessages(finalMessages);
      saveConversation(conversationId, finalMessages);
      setError('');
      track('gekta_answer_completed', locale, { sourceCount: finalMessage.citations?.length || 0 });
      if (finalMessage.status === 'answered') await settleAnswer(ticket);
    } catch (reason) {
      const aborted = reason instanceof DOMException && reason.name === 'AbortError';
      const text = aborted ? (stopRequested.current ? ui.stopped : ui.timeout) : ui.error;
      const failed: GektaMessage = { ...assistantBase, text, status: 'refused', refusal: aborted && stopRequested.current ? 'CANCELLED' : 'UPSTREAM_ERROR', citations: [] };
      const finalMessages = [...baseMessages, failed];
      setMessages(finalMessages);
      saveConversation(conversationId, finalMessages);
      setError(text);
    } finally {
      abortRef.current = null;
      stopRequested.current = false;
      setSending(false);
    }
  }, [answerLocale, locale, saveConversation, sending, settleAnswer, ui.error, ui.reconnecting, ui.stopped, ui.timeout]);

  const submit = React.useCallback(async (override?: string) => {
    if (sending) return;
    const question = cleanText(override ?? input).slice(0, 1_200);
    if (!question) return;
    const ticket = await reserveAnswer();
    if (!ticket) return;
    const conversationId = activeId || id('conversation');
    const history = historyFrom(messages);
    const attached = documents.map((document) => ({ name: document.name, size: document.size, mediaType: document.mediaType }));
    const userMessage: GektaMessage = { id: id('user'), role: 'user', text: question, createdAt: new Date().toISOString(), attachments: attached };
    const baseMessages = [...messages, userMessage];
    setActiveId(conversationId);
    setMessages(baseMessages);
    saveConversation(conversationId, baseMessages, activeId ? undefined : titleFrom(question));
    setInput('');
    setDocuments([]);
    onEnteredChat?.();
    track(override ? 'gekta_starter_used' : 'gekta_prompt_submitted', locale, { hasAttachments: attached.length > 0 });
    await runGeneration({ question: requestWithDocuments(question, documents), history, conversationId, baseMessages, ticket });
  }, [activeId, documents, input, locale, messages, onEnteredChat, reserveAnswer, runGeneration, saveConversation, sending]);

  const retry = React.useCallback(async (assistantIndex: number) => {
    if (sending) return;
    let userIndex = -1;
    for (let index = assistantIndex - 1; index >= 0; index -= 1) { if (messages[index]?.role === 'user') { userIndex = index; break; } }
    if (userIndex < 0) return;
    const ticket = await reserveAnswer();
    if (!ticket) return;
    const conversationId = activeId || id('conversation');
    const question = messages[userIndex].text;
    const baseMessages = messages.slice(0, userIndex + 1);
    setMessages(baseMessages);
    saveConversation(conversationId, baseMessages);
    track('gekta_retry', locale);
    await runGeneration({ question, history: historyFrom(messages.slice(0, userIndex)), conversationId, baseMessages, ticket });
  }, [activeId, locale, messages, reserveAnswer, runGeneration, saveConversation, sending]);

  const copyMessage = React.useCallback(async (message: GektaMessage) => {
    try { await navigator.clipboard.writeText(message.text); setCopiedId(message.id); window.setTimeout(() => setCopiedId(''), 1_500); } catch {}
  }, []);

  const selectConversation = React.useCallback((conversation: GektaConversation) => {
    stop();
    setActiveId(conversation.id);
    setMessages([...conversation.messages]);
    setInput('');
    setDocuments([]);
    setError('');
    setDrawerOpen(false);
    onEnteredChat?.();

    // Список диалогов приходит с сервера без реплик — иначе каждая загрузка
    // истории тянула бы всю переписку целиком. Сами реплики читаются при
    // открытии диалога, иначе восстановленная история открывалась бы пустой.
    if (workspaceMode !== 'server' || conversation.messages.length > 0) return;
    const serverId = serverConversationIds.current.get(conversation.id);
    if (!serverId) return;
    void (async () => {
      const loaded = await accountApi<ServerConversationRow>(`conversations/${encodeURIComponent(serverId)}`);
      if (!loaded.ok || !loaded.data) return;
      const restored = toConversation(loaded.data, new Date().toISOString());
      if (!restored) return;
      // Прочитанные реплики уже на сервере: без отметки следующая запись
      // отправила бы их повторно.
      for (const message of restored.messages) sentMessageIds.current.add(message.id);
      setConversations((current) => current.map((item) => (
        item.id === conversation.id ? { ...item, messages: restored.messages } : item
      )));
      // Пользователь мог уйти в другой диалог, пока читались реплики. Проверка
      // идёт по ref, а не внутри обновления состояния: обновление обязано быть
      // чистым, иначе StrictMode выполнит побочный эффект дважды.
      if (activeIdRef.current === conversation.id) setMessages([...restored.messages]);
    })();
  }, [onEnteredChat, stop, workspaceMode]);

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
    setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
    if (activeId === conversationId) { setActiveId(null); setMessages([]); setDocuments([]); }
    const serverId = serverIdOf(conversationId);
    if (serverId) void accountApi(`conversations/${encodeURIComponent(serverId)}`, { method: 'DELETE' });
  }, [activeId, serverIdOf, ui.deleteConfirm]);

  const clearHistory = React.useCallback(() => {
    if (!window.confirm(ui.clearConfirm)) return;
    // Очистка адресована текущему языку, поэтому на сервер уходят ровно те
    // диалоги, которые исчезли с экрана. Общий DELETE стёр бы и остальные
    // языки — пользователь этого не подтверждал.
    const removed = workspaceMode === 'server'
      ? conversations.filter((conversation) => conversation.locale === locale)
      : [];
    setConversations((current) => current.filter((conversation) => conversation.locale !== locale));
    setActiveId(null); setMessages([]); setDocuments([]); setDrawerOpen(false);
    for (const conversation of removed) {
      const serverId = serverConversationIds.current.get(conversation.id);
      if (serverId) void accountApi(`conversations/${encodeURIComponent(serverId)}`, { method: 'DELETE' });
    }
  }, [conversations, locale, ui.clearConfirm, workspaceMode]);

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
    void (async () => {
      const created = await accountApi<{ id: string }>('projects', {
        method: 'POST',
        body: { name: cleanName, description: cleanDescription, locale },
      });
      if (!created.ok || typeof created.data?.id !== 'string') return;
      const serverId = created.data.id;
      setProjects((current) => current.map((item) => (item.id === project.id ? { ...item, id: serverId } : item)));
      setActiveProjectId((current) => (current === project.id ? serverId : current));
      // Диалог, начатый до ответа сервера, уже несёт локальный id проекта.
      // Без переадресации он остался бы висеть в несуществующей папке.
      setConversations((current) => current.map((conversation) => (
        conversation.projectId === project.id ? { ...conversation, projectId: serverId } : conversation
      )));
    })();
  }, [locale, workspaceMode]);

  const renameProject = React.useCallback((projectId: string, name: string) => {
    const cleanName = normaliseProjectName(name);
    if (!cleanName) return;
    setProjects((current) => current.map((project) => project.id === projectId ? { ...project, name: cleanName, updatedAt: new Date().toISOString() } : project));
    if (workspaceMode === 'server') void accountApi(`projects/${encodeURIComponent(projectId)}`, { method: 'PATCH', body: { name: cleanName } });
  }, [workspaceMode]);

  /** Deleting a project never deletes conversations: they return to the history. */
  const deleteProject = React.useCallback((projectId: string) => {
    setProjects((current) => current.filter((project) => project.id !== projectId));
    setConversations((current) => current.map((conversation) => conversation.projectId === projectId ? { ...conversation, projectId: null } : conversation));
    setActiveProjectId((current) => (current === projectId ? null : current));
    if (workspaceMode === 'server') void accountApi(`projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
  }, [workspaceMode]);

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
    onClear: clearHistory,
    onSettings: () => { setSettingsOpen(true); setDrawerOpen(false); },
    onProjectCreate: createProject,
    onProjectRename: renameProject,
    onProjectDelete: deleteProject,
    onProjectOpen: setActiveProjectId,
    onConversationProject: assignConversationProject,
  };
  const activeChat = !discoveryHero || enteredChat || messages.length > 0 || activeId !== null;
  const brand = locale === 'ru' ? 'ГЕКТА' : 'GEKTA';

  return (
    <section id='gekta-chat' className={`bg-[#fcfbf7] text-slate-950 ${activeChat ? 'h-[100svh] overflow-hidden' : 'min-h-[760px]'}`} data-gekta-chat-workspace='true'>
      <div className={`mx-auto flex w-full max-w-[1880px] ${activeChat ? 'h-full' : 'min-h-[760px]'}`}>
        <aside className='hidden w-[280px] shrink-0 border-r border-slate-200 md:block'><GektaSidebar {...sidebarProps} /></aside>
        <main className={`relative flex min-w-0 flex-1 flex-col ${activeChat ? 'h-full' : ''}`}>
          <header className='flex min-h-14 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-[#fcfbf7]/95 px-3 backdrop-blur md:px-5'>
            <button type='button' onClick={() => setDrawerOpen(true)} className='flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-100 md:hidden' aria-label={ui.openMenu}><Menu className='h-5 w-5' aria-hidden='true' /></button>
            <Link href={GEKTA_PATHS[locale]} className='flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700' aria-label={ui.productHome} data-gekta-brand-home='true'>
              <span aria-hidden='true' className='grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-800 text-base font-black text-white'>G</span>
              <span className='min-w-0'><span className='block truncate text-sm font-bold tracking-[0.12em]'>{brand}</span><span className='hidden truncate text-xs text-slate-500 sm:block'>{product.maker}</span></span>
            </Link>
            <div className='ml-auto flex items-center gap-2'>
              <GektaRemainingBadge locale={locale} entitlement={entitlement} />
              <button type='button' onClick={newChat} className='flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700' data-gekta-header-new-chat='true'><Plus className='h-4 w-4' aria-hidden='true' /><span className='hidden sm:inline'>{ui.newChat}</span></button>
            </div>
          </header>

          <div ref={scrollRef} onScroll={(event) => { const root = event.currentTarget; const distance = root.scrollHeight - root.scrollTop - root.clientHeight; nearBottom.current = distance < 140; setShowScroll(distance > 260); }} className={`${activeChat ? 'min-h-0 flex-1 overflow-y-auto' : 'flex-1'} overscroll-contain`}>
            {messages.length ? <GektaMessageList messages={messages} locale={locale} sending={sending} speechEnabled={speechEnabled} onSpeech={(event) => track(event === 'started' ? 'gekta_tts_started' : 'gekta_tts_stopped', locale)} labels={{ assistant: ui.assistant, you: ui.you, copy: ui.copy, copied: ui.copied, retry: ui.retry, sources: ui.sources, working: ui.working }} copiedId={copiedId} onCopy={(message) => void copyMessage(message)} onRetry={(index) => void retry(index)} onSourceOpen={() => track('gekta_source_opened', locale)} /> : <GektaEmptyState locale={locale} hero={discoveryHero} starters={product.starters} onStarter={useStarter} />}
            {error ? <div className='mx-auto mb-2 w-full max-w-[920px] px-4 sm:px-6'><p className='rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800' role='alert'>{error}</p></div> : null}
          </div>

          {showScroll && activeChat ? <button type='button' onClick={() => { const root = scrollRef.current; if (root) root.scrollTo({ top: root.scrollHeight, behavior: 'smooth' }); }} className='absolute bottom-36 left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md' aria-label='Scroll to bottom'><ArrowDown className='h-4 w-4' aria-hidden='true' /></button> : null}

          <div className={`${activeChat ? 'shrink-0 border-t border-slate-200/70 bg-[#fcfbf7]/95 backdrop-blur' : 'pb-7'}`}>
            {entitlement && !entitlement.canAsk ? <GektaAccessGate locale={locale} registrationUrl={registrationUrl} entitlement={entitlement} billingEnabled={billingEnabled} /> : <GektaComposer locale={locale} value={input} placeholder={product.placeholder} sending={sending} stopLabel={ui.stop} sendLabel={ui.send} boundary={ui.boundary} documents={documents} onDocuments={setDocuments} onChange={setInput} onSubmit={() => void submit()} onStop={stop} onError={setError} voiceEnabled={voiceInputEnabled} />}
          </div>
        </main>
      </div>
      <GektaMobileDrawer open={drawerOpen} closeLabel={ui.closeMenu} onClose={() => setDrawerOpen(false)}><GektaSidebar {...sidebarProps} /></GektaMobileDrawer>
      {consentRequired && activeChat ? <GektaConsentDialog locale={locale} onAccept={() => void acceptConsent()} /> : null}
      {settingsOpen ? (
        <GektaSettingsDialog
          locale={locale}
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
      <div className='sr-only' aria-live='polite' aria-atomic='true'>{sending ? ui.working : error}</div>
    </section>
  );
}
