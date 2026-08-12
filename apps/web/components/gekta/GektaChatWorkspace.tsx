'use client';

import * as React from 'react';
import { ArrowDown, Menu, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { PublicAssistantDocument } from '@/components/platform-v7/PublicAssistantAttachmentPicker';
import {
  readGatewayStream,
  refusalCopy,
  type GatewayStreamSnapshot,
} from '@/lib/platform-v7/ai-gateway-stream';
import { GEKTA_PATHS, getGektaCopy, type GektaLocale } from '@/lib/gekta/content';
import { GektaComposer } from './GektaComposer';
import { GektaEmptyState } from './GektaEmptyState';
import { GektaMessageList } from './GektaMessageList';
import { GektaMobileDrawer } from './GektaMobileDrawer';
import { GektaSidebar } from './GektaSidebar';
import type { GektaConversation, GektaMessage } from './GektaChatTypes';

const HISTORY_STORAGE = 'gekta-conversations-v2';
const LOCALE_STORAGE = 'gekta-locale-v1';
const MAX_CONVERSATIONS = 60;
const MAX_MESSAGES = 80;

type HistoryTurn = Readonly<{ role: 'user' | 'assistant'; text: string }>;

const CHAT_UI = {
  ru: { assistant: 'Гекта', you: 'Ты', working: 'Гекта анализирует…', copy: 'Копировать', copied: 'Скопировано', retry: 'Повторить', sources: 'Источники', send: 'Отправить', stop: 'Остановить', boundary: 'История анонимного режима хранится в этом браузере. Не отправляй пароли, токены, банковские реквизиты и лишние персональные данные.', error: 'Ответ не получен. Проверь соединение и повтори запрос.', timeout: 'Время ожидания ответа истекло. Повтори запрос.', stopped: 'Ответ остановлен.', reconnecting: 'Соединение прервалось до начала ответа. Переподключаюсь…', starters: 'Примеры вопросов', openMenu: 'Открыть историю', closeMenu: 'Закрыть историю', newChat: 'Новый диалог', clearConfirm: 'Удалить всю историю Гекты из этого браузера?', deleteConfirm: 'Удалить этот диалог?' },
  en: { assistant: 'Gekta', you: 'You', working: 'Gekta is analysing…', copy: 'Copy', copied: 'Copied', retry: 'Retry', sources: 'Sources', send: 'Send', stop: 'Stop', boundary: 'Anonymous history is stored in this browser. Do not send passwords, tokens, banking credentials or unnecessary personal data.', error: 'No answer was received. Check the connection and retry.', timeout: 'The response timed out. Retry the request.', stopped: 'Answer stopped.', reconnecting: 'The connection dropped before the answer started. Reconnecting…', starters: 'Example questions', openMenu: 'Open history', closeMenu: 'Close history', newChat: 'New chat', clearConfirm: 'Delete all Gekta history from this browser?', deleteConfirm: 'Delete this conversation?' },
  zh: { assistant: 'Gekta', you: '你', working: 'Gekta 正在分析…', copy: '复制', copied: '已复制', retry: '重试', sources: '来源', send: '发送', stop: '停止', boundary: '匿名历史记录保存在此浏览器中。请勿发送密码、令牌、银行凭据或不必要的个人信息。', error: '未收到回答。请检查连接后重试。', timeout: '等待回答超时，请重试。', stopped: '回答已停止。', reconnecting: '回答开始前连接中断，正在重新连接…', starters: '示例问题', openMenu: '打开历史记录', closeMenu: '关闭历史记录', newChat: '新对话', clearConfirm: '从此浏览器删除全部 Gekta 历史记录？', deleteConfirm: '删除此对话？' },
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
    return [{ id: conversationId, locale, title, createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(), updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(), messages: safeMessages(item.messages) }];
  });
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
  const hydrated = React.useRef(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const stopRequested = React.useRef(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const nearBottom = React.useRef(true);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HISTORY_STORAGE);
      const parsed = safeConversations(stored ? JSON.parse(stored) : []);
      setConversations(parsed);
      window.localStorage.setItem(LOCALE_STORAGE, locale);
      const params = new URLSearchParams(window.location.search);
      const prompt = params.get('prompt');
      if (prompt) setInput(cleanText(prompt).slice(0, 1_200));
    } catch {
      window.localStorage.removeItem(HISTORY_STORAGE);
    } finally {
      hydrated.current = true;
      track('gekta_page_view', locale);
    }
  }, [locale]);

  React.useEffect(() => {
    if (!hydrated.current) return;
    try { window.localStorage.setItem(HISTORY_STORAGE, JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS))); } catch {}
  }, [conversations]);

  React.useEffect(() => {
    if ((!nearBottom.current && !sending) || !scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: sending ? 'auto' : 'smooth' });
  }, [messages, sending]);

  const visibleConversations = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return conversations.filter((conversation) => conversation.locale === locale).filter((conversation) => !needle || conversation.title.toLocaleLowerCase().includes(needle)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [conversations, locale, search]);

  const saveConversation = React.useCallback((conversationId: string, nextMessages: readonly GektaMessage[], preferredTitle?: string) => {
    const now = new Date().toISOString();
    setConversations((current) => {
      const existing = current.find((conversation) => conversation.id === conversationId);
      const title = preferredTitle || existing?.title || titleFrom(nextMessages.find((message) => message.role === 'user')?.text || ui.newChat);
      const next: GektaConversation = { id: conversationId, locale, title, createdAt: existing?.createdAt || now, updatedAt: now, messages: nextMessages.slice(-MAX_MESSAGES) };
      return [next, ...current.filter((conversation) => conversation.id !== conversationId)].slice(0, MAX_CONVERSATIONS);
    });
  }, [locale, ui.newChat]);

  const stop = React.useCallback(() => {
    if (!abortRef.current) return;
    stopRequested.current = true;
    abortRef.current.abort();
    track('gekta_answer_stopped', locale);
  }, [locale]);

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

  const runGeneration = React.useCallback(async ({ question, history, conversationId, baseMessages }: { question: string; history: HistoryTurn[]; conversationId: string; baseMessages: readonly GektaMessage[] }) => {
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
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            signal: controller.signal,
            body: JSON.stringify({ message: question, locale, context: 'gekta-standalone', conversationId, history }),
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
  }, [locale, saveConversation, sending, ui.error, ui.reconnecting, ui.stopped, ui.timeout]);

  const submit = React.useCallback(async (override?: string) => {
    if (sending) return;
    const question = cleanText(override ?? input).slice(0, 1_200);
    if (!question) return;
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
    await runGeneration({ question: requestWithDocuments(question, documents), history, conversationId, baseMessages });
  }, [activeId, documents, input, locale, messages, onEnteredChat, runGeneration, saveConversation, sending]);

  const retry = React.useCallback(async (assistantIndex: number) => {
    if (sending) return;
    let userIndex = -1;
    for (let index = assistantIndex - 1; index >= 0; index -= 1) { if (messages[index]?.role === 'user') { userIndex = index; break; } }
    if (userIndex < 0) return;
    const conversationId = activeId || id('conversation');
    const question = messages[userIndex].text;
    const baseMessages = messages.slice(0, userIndex + 1);
    setMessages(baseMessages);
    saveConversation(conversationId, baseMessages);
    track('gekta_retry', locale);
    await runGeneration({ question, history: historyFrom(messages.slice(0, userIndex)), conversationId, baseMessages });
  }, [activeId, locale, messages, runGeneration, saveConversation, sending]);

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
  }, [onEnteredChat, stop]);

  const renameConversation = React.useCallback((conversationId: string, title: string) => setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, title: title.slice(0, 80), updatedAt: new Date().toISOString() } : conversation)), []);
  const deleteConversation = React.useCallback((conversationId: string) => {
    if (!window.confirm(ui.deleteConfirm)) return;
    setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
    if (activeId === conversationId) { setActiveId(null); setMessages([]); setDocuments([]); }
  }, [activeId, ui.deleteConfirm]);
  const clearHistory = React.useCallback(() => {
    if (!window.confirm(ui.clearConfirm)) return;
    setConversations((current) => current.filter((conversation) => conversation.locale !== locale));
    setActiveId(null); setMessages([]); setDocuments([]); setDrawerOpen(false);
  }, [locale, ui.clearConfirm]);
  const switchLocale = React.useCallback((next: GektaLocale) => {
    if (next === locale) return;
    try { window.localStorage.setItem(LOCALE_STORAGE, next); } catch {}
    track('gekta_locale_changed', locale);
    router.push(GEKTA_PATHS[next]);
  }, [locale, router]);

  const sidebarProps = { locale, conversations: visibleConversations, activeId, search, onSearch: setSearch, onNew: newChat, onSelect: selectConversation, onRename: renameConversation, onDelete: deleteConversation, onClear: clearHistory, onLocale: switchLocale };
  const activeChat = !discoveryHero || messages.length > 0 || activeId !== null;
  const brand = locale === 'ru' ? 'ГЕКТА' : 'GEKTA';

  return (
    <section id='gekta-chat' className={`bg-[#fcfbf7] text-slate-950 ${activeChat ? 'h-[100svh] overflow-hidden' : 'min-h-[760px]'}`} data-gekta-chat-workspace='true'>
      <div className={`mx-auto flex w-full max-w-[1880px] ${activeChat ? 'h-full' : 'min-h-[760px]'}`}>
        <aside className='hidden w-[280px] shrink-0 border-r border-slate-200 md:block'><GektaSidebar {...sidebarProps} /></aside>
        <main className={`relative flex min-w-0 flex-1 flex-col ${activeChat ? 'h-full' : ''}`}>
          <header className='flex min-h-14 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-[#fcfbf7]/95 px-3 backdrop-blur md:px-5'>
            <button type='button' onClick={() => setDrawerOpen(true)} className='flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 md:hidden' aria-label={ui.openMenu}><Menu className='h-5 w-5' aria-hidden='true' /></button>
            <div className='min-w-0'><div className='truncate text-sm font-bold tracking-[0.12em]'>{brand}</div><div className='hidden truncate text-xs text-slate-500 sm:block'>{product.maker}</div></div>
            <button type='button' onClick={newChat} className='ml-auto flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:hidden'><Plus className='h-4 w-4' aria-hidden='true' />{ui.newChat}</button>
          </header>

          <div ref={scrollRef} onScroll={(event) => { const root = event.currentTarget; const distance = root.scrollHeight - root.scrollTop - root.clientHeight; nearBottom.current = distance < 140; setShowScroll(distance > 260); }} className={`${activeChat ? 'min-h-0 flex-1 overflow-y-auto' : 'flex-1'} overscroll-contain`}>
            {messages.length ? <GektaMessageList messages={messages} sending={sending} labels={{ assistant: ui.assistant, you: ui.you, copy: ui.copy, copied: ui.copied, retry: ui.retry, sources: ui.sources, working: ui.working }} copiedId={copiedId} onCopy={(message) => void copyMessage(message)} onRetry={(index) => void retry(index)} onSourceOpen={() => track('gekta_source_opened', locale)} /> : <GektaEmptyState hero={discoveryHero} starters={product.starters} starterLabel={ui.starters} onStarter={(prompt) => void submit(prompt)} />}
            {error ? <div className='mx-auto mb-2 w-full max-w-[920px] px-4 sm:px-6'><p className='rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800' role='alert'>{error}</p></div> : null}
          </div>

          {showScroll && activeChat ? <button type='button' onClick={() => { const root = scrollRef.current; if (root) root.scrollTo({ top: root.scrollHeight, behavior: 'smooth' }); }} className='absolute bottom-36 left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md' aria-label='Scroll to bottom'><ArrowDown className='h-4 w-4' aria-hidden='true' /></button> : null}

          <div className={`${activeChat ? 'shrink-0 border-t border-slate-200/70 bg-[#fcfbf7]/95 backdrop-blur' : 'pb-7'}`}>
            <GektaComposer locale={locale} value={input} placeholder={product.placeholder} sending={sending} stopLabel={ui.stop} sendLabel={ui.send} boundary={ui.boundary} documents={documents} onDocuments={setDocuments} onChange={setInput} onSubmit={() => void submit()} onStop={stop} onError={setError} />
          </div>
        </main>
      </div>
      <GektaMobileDrawer open={drawerOpen} closeLabel={ui.closeMenu} onClose={() => setDrawerOpen(false)}><GektaSidebar {...sidebarProps} /></GektaMobileDrawer>
      <div className='sr-only' aria-live='polite' aria-atomic='true'>{sending ? ui.working : error}</div>
    </section>
  );
}
