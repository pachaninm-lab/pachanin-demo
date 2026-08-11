'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Info,
  Loader2,
  Menu,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import {
  readGatewayStream,
  refusalCopy,
  type GatewayStreamSnapshot,
  type GatewayStreamStatus,
} from '@/lib/platform-v7/ai-gateway-stream';
import type { GatewayRefusal } from '@pc/ai-assistant-stream-contract';
import styles from './GektaChatApp.module.css';

type Locale = 'ru' | 'en' | 'zh';
type HistoryTurn = Readonly<{ role: 'user' | 'assistant'; text: string }>;
type Citation = Readonly<{ sourceId: string; title: string; uri: string }>;

type Message = Readonly<{
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  status?: GatewayStreamStatus;
  refusal?: GatewayRefusal | null;
  citations?: readonly Citation[];
}>;

type Starter = Readonly<{ label: string; prompt: string }>;

type UiCopy = Readonly<{
  back: string;
  descriptor: string;
  newChat: string;
  capabilities: string;
  capabilityItems: readonly string[];
  boundaryTitle: string;
  boundaryText: string;
  headerSubtitle: string;
  publicMode: string;
  eyebrow: string;
  heroTitleStart: string;
  heroTitleAccent: string;
  heroBody: string;
  heroPrinciple: string;
  truth: string;
  starters: readonly Starter[];
  assistantName: string;
  you: string;
  working: string;
  copy: string;
  copied: string;
  retry: string;
  sources: string;
  placeholder: string;
  send: string;
  stop: string;
  enterHint: string;
  composerBoundary: string;
  genericError: string;
  cancelled: string;
  closeMenu: string;
  openMenu: string;
}>;

const UI: Record<Locale, UiCopy> = {
  ru: {
    back: 'На основной сайт',
    descriptor: 'Аграрный интеллект',
    newChat: 'Новый диалог',
    capabilities: 'С чем помогает',
    capabilityItems: [
      'Дача, огород и ЛПХ',
      'Растениеводство и агрономия',
      'Животноводство',
      'Сельхозтехника и диагностика',
      'Хранение, логистика и качество',
      'Экономика и агробизнес',
      '1С и государственные системы',
      'Документы и расчёты',
    ],
    boundaryTitle: 'Публичный режим',
    boundaryText: 'Без доступа к личным кабинетам и закрытым данным. Гекта не выполняет действия от имени пользователя и не выдумывает актуальные факты без подтверждённого источника.',
    headerSubtitle: 'Один диалог для задач сельского хозяйства и агробизнеса',
    publicMode: 'Публичный чат',
    eyebrow: 'Российский аграрный интеллект',
    heroTitleStart: 'Спроси ',
    heroTitleAccent: 'Гекту',
    heroBody: 'От огорода и сельской техники до агрономии, экономики хозяйства и бизнес-задач. Опиши задачу обычными словами — без выбора модулей и сложных меню.',
    heroPrinciple: 'Гекта держит контекст диалога, объясняет вывод и отделяет известные факты от предположений.',
    truth: 'Актуальные цены, погода, нормы, субсидии и другие изменяющиеся данные допустимы только при наличии подтверждённого текущего источника. Если основания нет, Гекта должна сказать об этом прямо.',
    starters: [
      { label: 'Растениеводство', prompt: 'Почему может падать урожайность озимой пшеницы и что проверить в первую очередь?' },
      { label: 'Дача и ЛПХ', prompt: 'Почему желтеют огурцы и как по признакам сузить возможные причины?' },
      { label: 'Техника', prompt: 'С чего начать диагностику повышенного расхода топлива у трактора?' },
      { label: 'Животноводство', prompt: 'Как оценить риск теплового стресса у КРС и что проверить в хозяйстве?' },
      { label: 'Экономика', prompt: 'Из каких факторов складывается себестоимость зерна и где чаще всего возникают потери?' },
      { label: 'Хранение', prompt: 'Как организовать хранение картофеля, чтобы снизить потери качества?' },
    ],
    assistantName: 'Гекта',
    you: 'Ты',
    working: 'Гекта анализирует…',
    copy: 'Копировать',
    copied: 'Скопировано',
    retry: 'Повторить',
    sources: 'Источники',
    placeholder: 'Опиши задачу по сельскому хозяйству или агробизнесу',
    send: 'Отправить',
    stop: 'Остановить',
    enterHint: 'Enter — отправить · Shift+Enter — новая строка',
    composerBoundary: 'Не отправляй пароли, токены, банковские реквизиты и персональные данные.',
    genericError: 'Ответ не получен. Проверь соединение и повтори запрос.',
    cancelled: 'Ответ остановлен.',
    closeMenu: 'Закрыть меню',
    openMenu: 'Открыть меню',
  },
  en: {
    back: 'Main website',
    descriptor: 'Agricultural intelligence',
    newChat: 'New chat',
    capabilities: 'What it helps with',
    capabilityItems: [
      'Home growing and smallholdings',
      'Crop production and agronomy',
      'Livestock',
      'Farm machinery and diagnostics',
      'Storage, logistics and quality',
      'Economics and agribusiness',
      '1C and government systems',
      'Documents and calculations',
    ],
    boundaryTitle: 'Public mode',
    boundaryText: 'No access to private workspaces or closed data. Gekta cannot act on the user’s behalf and must not invent current facts without a verified source.',
    headerSubtitle: 'One conversation for agricultural and agribusiness tasks',
    publicMode: 'Public chat',
    eyebrow: 'Russian agricultural intelligence',
    heroTitleStart: 'Ask ',
    heroTitleAccent: 'Gekta',
    heroBody: 'From home growing and machinery to agronomy, farm economics and business tasks. Describe the problem naturally — no modules or complex menus required.',
    heroPrinciple: 'Gekta keeps conversational context, explains its conclusion and separates known facts from assumptions.',
    truth: 'Current prices, weather, regulations, subsidies and other changing facts are allowed only when a verified current source is available. If there is no basis, Gekta should say so explicitly.',
    starters: [
      { label: 'Crop production', prompt: 'Why can winter wheat yield decline, and what should be checked first?' },
      { label: 'Home growing', prompt: 'Why are cucumber leaves turning yellow, and how can the likely causes be narrowed down?' },
      { label: 'Machinery', prompt: 'Where should I start when diagnosing unusually high tractor fuel consumption?' },
      { label: 'Livestock', prompt: 'How can I assess heat-stress risk in cattle and what should I inspect on the farm?' },
      { label: 'Economics', prompt: 'What drives grain production cost, and where do farms most often lose money?' },
      { label: 'Storage', prompt: 'How should potatoes be stored to reduce quality losses?' },
    ],
    assistantName: 'Gekta',
    you: 'You',
    working: 'Gekta is analysing…',
    copy: 'Copy',
    copied: 'Copied',
    retry: 'Retry',
    sources: 'Sources',
    placeholder: 'Describe an agriculture or agribusiness task',
    send: 'Send',
    stop: 'Stop',
    enterHint: 'Enter to send · Shift+Enter for a new line',
    composerBoundary: 'Do not send passwords, tokens, banking credentials or personal data.',
    genericError: 'No answer was received. Check the connection and retry.',
    cancelled: 'Answer stopped.',
    closeMenu: 'Close menu',
    openMenu: 'Open menu',
  },
  zh: {
    back: '返回主站',
    descriptor: '农业智能',
    newChat: '新对话',
    capabilities: '可以协助',
    capabilityItems: [
      '菜园、家庭农场与小农户',
      '种植业与农艺',
      '畜牧业',
      '农业机械与诊断',
      '仓储、物流与质量',
      '经济与农业经营',
      '1C 与政府系统',
      '文档与计算',
    ],
    boundaryTitle: '公共模式',
    boundaryText: '无法访问私人工作区或封闭数据。Gekta 不代表用户执行操作，也不会在没有可靠来源时编造实时事实。',
    headerSubtitle: '用一个对话处理农业与农业经营任务',
    publicMode: '公共聊天',
    eyebrow: '俄罗斯农业智能',
    heroTitleStart: '询问 ',
    heroTitleAccent: 'Gekta',
    heroBody: '从家庭种植和农业机械，到农艺、农场经济与经营任务。直接用自然语言描述问题，无需先选择模块或复杂菜单。',
    heroPrinciple: 'Gekta 会保持对话上下文、解释结论，并区分已知事实与假设。',
    truth: '当前价格、天气、法规、补贴等变化信息，只有在存在经过验证的当前来源时才能使用。如果没有依据，Gekta 应明确说明。',
    starters: [
      { label: '种植业', prompt: '冬小麦产量下降可能有哪些原因，应该先检查什么？' },
      { label: '家庭种植', prompt: '黄瓜叶片发黄可能是什么原因，怎样根据症状缩小范围？' },
      { label: '农业机械', prompt: '拖拉机油耗异常升高时，应从哪些检查开始？' },
      { label: '畜牧业', prompt: '如何评估牛群热应激风险，农场需要检查哪些条件？' },
      { label: '经济', prompt: '粮食生产成本由哪些因素构成，农场通常在哪些环节损失利润？' },
      { label: '仓储', prompt: '怎样储存马铃薯才能减少品质损失？' },
    ],
    assistantName: 'Gekta',
    you: '你',
    working: 'Gekta 正在分析…',
    copy: '复制',
    copied: '已复制',
    retry: '重试',
    sources: '来源',
    placeholder: '描述你的农业或农业经营任务',
    send: '发送',
    stop: '停止',
    enterHint: 'Enter 发送 · Shift+Enter 换行',
    composerBoundary: '请勿发送密码、令牌、银行凭据或个人数据。',
    genericError: '未收到回答。请检查连接后重试。',
    cancelled: '回答已停止。',
    closeMenu: '关闭菜单',
    openMenu: '打开菜单',
  },
};

function detectedLocale(): Locale {
  if (typeof window === 'undefined') return 'ru';
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'en' || query === 'zh') return query;
  const lang = document.documentElement.lang.toLowerCase();
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('zh')) return 'zh';
  return 'ru';
}

function messageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newConversationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return messageId('conversation');
}

function sessionKey(locale: Locale): string {
  return `gekta-standalone-chat-v1:${locale}`;
}

function conversationKey(locale: Locale): string {
  return `gekta-standalone-conversation-v1:${locale}`;
}

function cleanText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
    .replace(/[ \t]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function safeStoredMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-40).flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const role = row.role === 'user' ? 'user' : row.role === 'assistant' ? 'assistant' : null;
    const text = typeof row.text === 'string' ? cleanText(row.text).slice(0, 12_000) : '';
    if (!role || !text) return [];
    const status: GatewayStreamStatus | undefined = row.status === 'answered' || row.status === 'refused'
      ? row.status
      : role === 'assistant' ? 'answered' : undefined;
    return [{
      id: typeof row.id === 'string' ? row.id : messageId(role),
      role,
      text,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
      status,
      refusal: null,
      citations: [],
    } satisfies Message];
  });
}

function historyFrom(items: readonly Message[]): HistoryTurn[] {
  return items
    .filter((message) => message.text.trim().length > 0)
    .filter((message) => message.role === 'user' || message.status === 'answered')
    .slice(-12)
    .map((message) => ({ role: message.role, text: message.text.slice(0, 2_000) }));
}

function formatTime(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function finalRefusalText(locale: Locale, snapshot: GatewayStreamSnapshot, ui: UiCopy): string {
  if (snapshot.refusal === 'CANCELLED') return snapshot.text || ui.cancelled;
  return snapshot.text || refusalCopy(locale, snapshot.refusal);
}

export function GektaChatApp() {
  const [locale, setLocale] = React.useState<Locale>('ru');
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [conversationId, setConversationId] = React.useState(() => newConversationId());
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState('');
  const abortRef = React.useRef<AbortController | null>(null);
  const sendingRef = React.useRef(false);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const hydratedLocaleRef = React.useRef<Locale | null>(null);
  const ui = UI[locale];

  React.useEffect(() => {
    const next = detectedLocale();
    if (next !== locale) setLocale(next);
    // Locale is intentionally resolved once from the public URL / document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    hydratedLocaleRef.current = null;
    try {
      const stored = window.sessionStorage.getItem(sessionKey(locale));
      const parsed = stored ? safeStoredMessages(JSON.parse(stored)) : [];
      const storedConversation = window.sessionStorage.getItem(conversationKey(locale));
      setMessages(parsed);
      setConversationId(storedConversation?.trim() || newConversationId());
    } catch {
      window.sessionStorage.removeItem(sessionKey(locale));
      window.sessionStorage.removeItem(conversationKey(locale));
      setMessages([]);
      setConversationId(newConversationId());
    } finally {
      hydratedLocaleRef.current = locale;
    }
  }, [locale]);

  React.useEffect(() => {
    if (hydratedLocaleRef.current !== locale) return;
    try {
      window.sessionStorage.setItem(sessionKey(locale), JSON.stringify(messages.slice(-40)));
      window.sessionStorage.setItem(conversationKey(locale), conversationId);
    } catch {
      // Session persistence is optional. The chat remains usable without it.
    }
  }, [conversationId, locale, messages]);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(150, Math.max(42, textarea.scrollHeight))}px`;
  }, [input]);

  React.useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    root.scrollTo({ top: root.scrollHeight, behavior: sending ? 'auto' : 'smooth' });
  }, [messages, sending]);

  React.useEffect(() => {
    if (!sidebarOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [sidebarOpen]);

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const newChat = React.useCallback(() => {
    stop();
    setMessages([]);
    setInput('');
    setError('');
    setCopiedId('');
    const id = newConversationId();
    setConversationId(id);
    try {
      window.sessionStorage.removeItem(sessionKey(locale));
      window.sessionStorage.setItem(conversationKey(locale), id);
    } catch {
      // Optional persistence only.
    }
    setSidebarOpen(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, [locale, stop]);

  const runGeneration = React.useCallback(async (question: string, history: HistoryTurn[]) => {
    if (sendingRef.current) return;
    const assistantId = messageId('assistant');
    const startedAt = new Date().toISOString();
    sendingRef.current = true;
    setSending(true);
    setError('');
    setMessages((current) => [...current, {
      id: assistantId,
      role: 'assistant',
      text: '',
      createdAt: startedAt,
      status: 'streaming',
      refusal: null,
      citations: [],
    }]);

    const controller = new AbortController();
    abortRef.current = controller;

    const paint = (snapshot: GatewayStreamSnapshot) => {
      const text = snapshot.status === 'refused' ? finalRefusalText(locale, snapshot, UI[locale]) : snapshot.text;
      setMessages((current) => current.map((message) => message.id === assistantId ? {
        ...message,
        text: cleanText(text),
        status: snapshot.status,
        refusal: snapshot.refusal,
        citations: snapshot.citations.map((citation) => ({
          sourceId: citation.sourceId,
          title: citation.title,
          uri: citation.uri,
        })),
      } : message));
    };

    try {
      const response = await fetch('/api/agro-chat?stream=1', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        signal: controller.signal,
        body: JSON.stringify({
          message: question,
          locale,
          context: 'gekta-standalone',
          conversationId,
          history,
        }),
      });

      const snapshot = await readGatewayStream(response, {
        mode: 'public',
        signal: controller.signal,
        onSnapshot: paint,
      });
      paint(snapshot);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        setMessages((current) => current.map((message) => message.id === assistantId ? {
          ...message,
          text: message.text || UI[locale].cancelled,
          status: 'refused',
          refusal: 'CANCELLED',
        } : message));
      } else {
        setMessages((current) => current.map((message) => message.id === assistantId ? {
          ...message,
          text: UI[locale].genericError,
          status: 'refused',
          refusal: 'UPSTREAM_ERROR',
        } : message));
        setError(UI[locale].genericError);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      sendingRef.current = false;
      setSending(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [conversationId, locale]);

  const submit = React.useCallback(async (value: string) => {
    const normalized = cleanText(value).slice(0, 1_200);
    if (!normalized || sendingRef.current) return;
    const history = historyFrom(messages);
    const userMessage: Message = {
      id: messageId('user'),
      role: 'user',
      text: normalized,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    await runGeneration(normalized, history);
  }, [messages, runGeneration]);

  const retry = React.useCallback(async (assistantIndex: number) => {
    if (sendingRef.current) return;
    let userIndex = -1;
    for (let index = assistantIndex - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === 'user') {
        userIndex = index;
        break;
      }
    }
    if (userIndex < 0) return;
    const question = messages[userIndex].text;
    const history = historyFrom(messages.slice(0, userIndex));
    setMessages((current) => current.slice(0, assistantIndex));
    await runGeneration(question, history);
  }, [messages, runGeneration]);

  const copyMessage = React.useCallback(async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((current) => current === message.id ? '' : current), 1_500);
    } catch {
      setError(UI[locale].genericError);
    }
  }, [locale]);

  const changeLocale = React.useCallback((next: Locale) => {
    if (next === locale) return;
    stop();
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    setLocale(next);
    setSidebarOpen(false);
  }, [locale, stop]);

  return (
    <div className={styles.shell} data-gekta-standalone='true'>
      {sidebarOpen ? (
        <button
          type='button'
          className={styles.sidebarOverlay}
          aria-label={ui.closeMenu}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`} aria-label={ui.capabilities}>
        <Link className={styles.backLink} href='/' onClick={() => setSidebarOpen(false)}>
          <ArrowLeft size={16} aria-hidden='true' />
          <span>{ui.back}</span>
        </Link>

        <div className={styles.brand}>
          <div className={styles.brandMark} aria-hidden='true'>Г</div>
          <div>
            <p className={styles.brandName}>{locale === 'ru' ? 'Гекта' : 'Gekta'}</p>
            <p className={styles.brandDescriptor}>{ui.descriptor}</p>
          </div>
        </div>

        <button type='button' className={styles.newChatButton} onClick={newChat}>
          <Plus size={18} aria-hidden='true' />
          <span>{ui.newChat}</span>
        </button>

        <div className={styles.sidebarSection}>
          <p className={styles.sidebarLabel}>{ui.capabilities}</p>
          <ul className={styles.capabilityList}>
            {ui.capabilityItems.map((item) => (
              <li key={item} className={styles.capabilityItem}>
                <span className={styles.capabilityDot} aria-hidden='true' />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.sidebarBottom}>
          <div className={styles.publicBoundary}>
            <p className={styles.publicBoundaryTitle}>
              <ShieldCheck size={15} aria-hidden='true' />
              {ui.boundaryTitle}
            </p>
            <p className={styles.publicBoundaryText}>{ui.boundaryText}</p>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerIdentity}>
            <button
              type='button'
              className={styles.mobileMenuButton}
              aria-label={sidebarOpen ? ui.closeMenu : ui.openMenu}
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((current) => !current)}
            >
              {sidebarOpen ? <X size={21} aria-hidden='true' /> : <Menu size={21} aria-hidden='true' />}
            </button>
            <div>
              <p className={styles.headerTitle}>{locale === 'ru' ? 'Гекта' : 'Gekta'}</p>
              <p className={styles.headerSubtitle}>{ui.headerSubtitle}</p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <span className={styles.modeBadge}>
              <span className={styles.statusDot} aria-hidden='true' />
              {ui.publicMode}
            </span>
            <div className={styles.localeSwitch} aria-label='Language'>
              {(['ru', 'en', 'zh'] as const).map((item) => (
                <button
                  key={item}
                  type='button'
                  className={`${styles.localeButton} ${locale === item ? styles.localeButtonActive : ''}`}
                  aria-pressed={locale === item}
                  onClick={() => changeLocale(item)}
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div ref={scrollRef} className={styles.scrollArea}>
          <div className={styles.content}>
            {messages.length === 0 ? (
              <section className={styles.emptyState} aria-labelledby='gekta-title'>
                <p className={styles.eyebrow}><Sparkles size={13} aria-hidden='true' /> {ui.eyebrow}</p>
                <h1 id='gekta-title' className={styles.heroTitle}>
                  {ui.heroTitleStart}<span className={styles.heroAccent}>{ui.heroTitleAccent}</span>
                </h1>
                <p className={styles.heroBody}>{ui.heroBody}</p>
                <p className={styles.heroPrinciple}>{ui.heroPrinciple}</p>

                <div className={styles.starters} aria-label={ui.capabilities}>
                  {ui.starters.map((starter) => (
                    <button
                      key={starter.label}
                      type='button'
                      className={styles.starterCard}
                      disabled={sending}
                      onClick={() => void submit(starter.prompt)}
                    >
                      <span className={styles.starterLabel}>{starter.label}</span>
                      <span className={styles.starterPrompt}>
                        <span>{starter.prompt}</span>
                        <ChevronRight size={16} aria-hidden='true' />
                      </span>
                    </button>
                  ))}
                </div>

                <div className={styles.truthStrip}>
                  <Info size={17} aria-hidden='true' />
                  <span>{ui.truth}</span>
                </div>
              </section>
            ) : (
              <section className={styles.messages} aria-live='polite' aria-label='Gekta conversation'>
                {messages.map((message, index) => message.role === 'user' ? (
                  <div key={message.id} className={styles.userRow}>
                    <div className={styles.userBubble}>{message.text}</div>
                  </div>
                ) : (
                  <article key={message.id} className={styles.messageRow}>
                    <div className={styles.assistantAvatar} aria-hidden='true'>Г</div>
                    <div className={styles.messageBody}>
                      <div className={styles.messageMeta}>
                        <span className={styles.messageName}>{ui.assistantName}</span>
                        <span>{formatTime(message.createdAt, locale)}</span>
                      </div>

                      {message.status === 'streaming' && !message.text ? (
                        <div className={styles.thinking}>
                          <Loader2 size={16} aria-hidden='true' className='animate-spin' />
                          <span>{ui.working}</span>
                        </div>
                      ) : (
                        <div className={styles.assistantText}>{message.text}</div>
                      )}

                      {message.citations?.length ? (
                        <details className={styles.citations}>
                          <summary>{ui.sources} · {message.citations.length}</summary>
                          <ul className={styles.citationList}>
                            {message.citations.map((citation) => (
                              <li key={`${message.id}-${citation.sourceId}`}>
                                <a className={styles.citationLink} href={citation.uri} target='_blank' rel='noreferrer'>
                                  {citation.title || citation.uri}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}

                      {message.status !== 'streaming' && message.text ? (
                        <div className={styles.messageActions}>
                          <button type='button' className={styles.messageAction} onClick={() => void copyMessage(message)} aria-label={ui.copy}>
                            {copiedId === message.id ? <Check size={15} aria-hidden='true' /> : <Copy size={15} aria-hidden='true' />}
                            <span>{copiedId === message.id ? ui.copied : ui.copy}</span>
                          </button>
                          <button type='button' className={styles.messageAction} disabled={sending} onClick={() => void retry(index)} aria-label={ui.retry}>
                            <RotateCcw size={15} aria-hidden='true' />
                            <span>{ui.retry}</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </section>
            )}
          </div>
        </div>

        <div className={styles.composerArea}>
          <div className={styles.composerWrap}>
            {error ? <div className={styles.errorBanner} role='alert'>{error}</div> : null}
            <form
              className={styles.composer}
              onSubmit={(event) => {
                event.preventDefault();
                void submit(input);
              }}
            >
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                rows={1}
                value={input}
                maxLength={1_200}
                placeholder={ui.placeholder}
                aria-label={ui.placeholder}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submit(input);
                  }
                }}
              />
              {sending ? (
                <button type='button' className={styles.stopButton} onClick={stop} aria-label={ui.stop} title={ui.stop}>
                  <Square size={17} fill='currentColor' aria-hidden='true' />
                </button>
              ) : (
                <button type='submit' className={styles.sendButton} disabled={!cleanText(input)} aria-label={ui.send} title={ui.send}>
                  <Send size={18} aria-hidden='true' />
                </button>
              )}
            </form>
            <div className={styles.composerMeta}>
              <span>{ui.enterHint}</span>
              <span className={styles.composerBoundary}>{ui.composerBoundary}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
