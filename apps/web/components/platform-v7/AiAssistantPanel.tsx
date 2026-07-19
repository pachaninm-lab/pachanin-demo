'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  CalendarClock,
  CircleDollarSign,
  ExternalLink,
  FileCheck2,
  Loader2,
  Maximize2,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';

type Locale = 'ru' | 'en' | 'zh';
type ChatRole = 'user' | 'assistant';
type Variant = 'floating' | 'workspace';
type Confidence = 'high' | 'medium' | 'low';
type DataMode = 'authoritative' | 'synthetic_demo';

type Citation = {
  source: 'platform' | 'deal_registry' | 'deal_workspace';
  label: string;
  href: string | null;
  asOf: string;
};

type Evidence = {
  kind: 'status' | 'next_action' | 'deadline' | 'money' | 'workspace_fact';
  label: string;
  value: string;
  source: Citation['source'];
};

type Decision = {
  summary: string;
  reason: string | null;
  nextAction: string | null;
  ownerRole: string | null;
  deadlineAt: string | null;
  moneyAtRiskKopecks: string | null;
  confidence: Confidence;
  actionAllowed: false;
  actionKind: 'NONE';
  intent: string;
  evidence: Evidence[];
  followUps: string[];
  dataFreshnessAt: string;
};

type ServerAnswer = {
  requestId: string;
  answer: string;
  provider: 'local-deterministic' | 'openai-compatible';
  mode: 'read_only';
  dataMode?: DataMode;
  role: string;
  dealId: string | null;
  generatedAt: string;
  citations: Citation[];
  limitations: string[];
  decision?: Decision;
};

type Catalog = {
  provider?: ServerAnswer['provider'];
  dataMode?: DataMode;
  presence?: string;
  starterPrompts?: string[];
};

type Message = {
  id: string;
  role: ChatRole;
  content: string;
  citations?: Citation[];
  provider?: ServerAnswer['provider'];
  generatedAt?: string;
  dataMode?: DataMode;
  decision?: Decision;
};

type Copy = {
  open: string;
  close: string;
  title: string;
  subtitle: string;
  readOnly: string;
  online: string;
  synthetic: string;
  authoritative: string;
  placeholder: string;
  send: string;
  stop: string;
  newChat: string;
  fullPage: string;
  error: string;
  retry: string;
  sources: string;
  localProvider: string;
  externalProvider: string;
  greetingMorning: string;
  greetingDay: string;
  greetingEvening: string;
  greetingBody: string;
  dealContext: string;
  roleBoundary: string;
  summary: string;
  reason: string;
  nextAction: string;
  owner: string;
  deadline: string;
  money: string;
  confidence: string;
  confidenceHigh: string;
  confidenceMedium: string;
  confidenceLow: string;
  evidence: string;
  stages: string[];
  starterPrompts: string[];
};

const COPY: Record<Locale, Copy> = {
  ru: {
    open: 'Открыть ИИ-помощника',
    close: 'Закрыть ИИ-помощника',
    title: 'Помощник сделки',
    subtitle: 'На связи внутри твоего ролевого контура',
    readOnly: 'Только чтение',
    online: 'На связи',
    synthetic: 'Синтетические данные',
    authoritative: 'Подтверждённые данные',
    placeholder: 'Напиши как человеку: что происходит, что делать и где риск…',
    send: 'Отправить',
    stop: 'Остановить',
    newChat: 'Новый диалог',
    fullPage: 'Открыть на весь экран',
    error: 'Не удалось получить подтверждённый ответ. Данные не были заменены догадками.',
    retry: 'Повторить',
    sources: 'Основания ответа',
    localProvider: 'Локальный защищённый режим',
    externalProvider: 'Подключённая корпоративная модель',
    greetingMorning: 'Доброе утро.',
    greetingDay: 'Добрый день.',
    greetingEvening: 'Добрый вечер.',
    greetingBody: 'Я рядом в твоём личном кабинете. Могу разобрать доступную сделку, объяснить блокер, следующий шаг, документы, логистику, деньги или спор. Чужие кабинеты мне недоступны.',
    dealContext: 'Текущая сделка определяется сервером после проверки доступа.',
    roleBoundary: 'Права и факты проверяются сервером при каждом вопросе.',
    summary: 'Суть',
    reason: 'Причина',
    nextAction: 'Следующий шаг',
    owner: 'Ответственный контур',
    deadline: 'Срок',
    money: 'Деньги под контролем',
    confidence: 'Уверенность',
    confidenceHigh: 'Высокая',
    confidenceMedium: 'Средняя',
    confidenceLow: 'Низкая',
    evidence: 'Подтверждённые факты',
    stages: ['Проверяю доступ…', 'Собираю факты сделки…', 'Сверяю риски и следующий шаг…', 'Формирую ответ…'],
    starterPrompts: [
      'Что требует моего внимания прямо сейчас?',
      'Объясни текущую сделку простыми словами',
      'Почему сделка может остановиться?',
      'Есть ли деньги под риском?',
    ],
  },
  en: {
    open: 'Open AI assistant',
    close: 'Close AI assistant',
    title: 'Deal assistant',
    subtitle: 'Online inside your authorized role scope',
    readOnly: 'Read-only',
    online: 'Online',
    synthetic: 'Synthetic data',
    authoritative: 'Server-confirmed data',
    placeholder: 'Write naturally: what is happening, what to do, and where the risk is…',
    send: 'Send',
    stop: 'Stop',
    newChat: 'New chat',
    fullPage: 'Open full screen',
    error: 'A server-confirmed answer was not available. No guesswork was substituted.',
    retry: 'Retry',
    sources: 'Answer sources',
    localProvider: 'Protected local mode',
    externalProvider: 'Connected corporate model',
    greetingMorning: 'Good morning.',
    greetingDay: 'Good afternoon.',
    greetingEvening: 'Good evening.',
    greetingBody: 'I am available inside your workspace. I can explain an accessible deal, blockers, next action, documents, logistics, money or a dispute. Other workspaces are unavailable.',
    dealContext: 'The current deal is resolved by the server after access verification.',
    roleBoundary: 'Permissions and facts are checked by the server for every question.',
    summary: 'Summary',
    reason: 'Reason',
    nextAction: 'Next action',
    owner: 'Responsible scope',
    deadline: 'Deadline',
    money: 'Money under control',
    confidence: 'Confidence',
    confidenceHigh: 'High',
    confidenceMedium: 'Medium',
    confidenceLow: 'Low',
    evidence: 'Confirmed facts',
    stages: ['Checking access…', 'Collecting deal facts…', 'Reviewing risks and next action…', 'Preparing the answer…'],
    starterPrompts: [
      'What needs my attention right now?',
      'Explain the current deal in plain language',
      'Why may the deal stop?',
      'Is any money at risk?',
    ],
  },
  zh: {
    open: '打开 AI 助手',
    close: '关闭 AI 助手',
    title: '交易助手',
    subtitle: '在你的授权角色范围内在线',
    readOnly: '只读',
    online: '在线',
    synthetic: '合成数据',
    authoritative: '服务器确认数据',
    placeholder: '像和人交流一样输入：发生了什么、该做什么、风险在哪里…',
    send: '发送',
    stop: '停止',
    newChat: '新对话',
    fullPage: '全屏打开',
    error: '未能获得服务器确认的回答，也没有用猜测替代。',
    retry: '重试',
    sources: '回答依据',
    localProvider: '受保护的本地模式',
    externalProvider: '已连接企业模型',
    greetingMorning: '早上好。',
    greetingDay: '下午好。',
    greetingEvening: '晚上好。',
    greetingBody: '我在你的工作区内，可以解释可访问交易、阻塞、下一步、文件、物流、资金或争议。其他工作区不可访问。',
    dealContext: '服务器验证访问权限后确定当前交易。',
    roleBoundary: '每个问题都会在服务器端检查权限和事实。',
    summary: '摘要',
    reason: '原因',
    nextAction: '下一步',
    owner: '责任范围',
    deadline: '期限',
    money: '受控资金',
    confidence: '置信度',
    confidenceHigh: '高',
    confidenceMedium: '中',
    confidenceLow: '低',
    evidence: '已确认事实',
    stages: ['正在检查访问权限…', '正在收集交易事实…', '正在核对风险和下一步…', '正在生成回答…'],
    starterPrompts: [
      '现在什么需要我关注？',
      '用简单语言解释当前交易',
      '交易为什么可能停止？',
      '是否有资金风险？',
    ],
  },
};

function resolveLocale(): Locale {
  if (typeof document === 'undefined') return 'ru';
  const html = document.documentElement.lang.toLowerCase();
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'zh' || html.startsWith('zh')) return 'zh';
  if (query === 'en' || html.startsWith('en')) return 'en';
  return 'ru';
}

function dealIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/platform-v7\/deals\/([^/]+)/u);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function focusableElements(root: HTMLElement) {
  const selector = 'a[href],button:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (node) => !node.hasAttribute('hidden') && node.getAttribute('aria-hidden') !== 'true',
  );
}

function formatTime(value: string | undefined, locale: Locale) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDateTime(value: string | null | undefined, locale: Locale) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatMoneyKopecks(value: string | null | undefined, locale: Locale) {
  if (!value || !/^-?\d+$/u.test(value)) return '';
  const number = Number(BigInt(value)) / 100;
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(number);
}

function timeGreeting(locale: Locale): string {
  const hour = new Date().getHours();
  const copy = COPY[locale];
  if (hour < 12) return copy.greetingMorning;
  if (hour < 18) return copy.greetingDay;
  return copy.greetingEvening;
}

function confidenceLabel(value: Confidence, ui: Copy) {
  if (value === 'high') return ui.confidenceHigh;
  if (value === 'medium') return ui.confidenceMedium;
  return ui.confidenceLow;
}

function fallbackDecision(answer: ServerAnswer): Decision {
  return {
    summary: answer.answer.split(/[.!?\n]/u)[0]?.trim() || answer.answer,
    reason: null,
    nextAction: null,
    ownerRole: answer.role || null,
    deadlineAt: null,
    moneyAtRiskKopecks: null,
    confidence: answer.dealId ? 'medium' : 'low',
    actionAllowed: false,
    actionKind: 'NONE',
    intent: 'unknown',
    evidence: [],
    followUps: [],
    dataFreshnessAt: answer.generatedAt,
  };
}

function DecisionCard({ decision, locale }: { decision: Decision; locale: Locale }) {
  const ui = COPY[locale];
  const money = formatMoneyKopecks(decision.moneyAtRiskKopecks, locale);
  const deadline = formatDateTime(decision.deadlineAt, locale);
  const items = [
    decision.reason ? { icon: <FileCheck2 size={15} />, label: ui.reason, value: decision.reason } : null,
    decision.nextAction ? { icon: <Sparkles size={15} />, label: ui.nextAction, value: decision.nextAction } : null,
    decision.ownerRole ? { icon: <UserRoundCheck size={15} />, label: ui.owner, value: decision.ownerRole } : null,
    deadline ? { icon: <CalendarClock size={15} />, label: ui.deadline, value: deadline } : null,
    money ? { icon: <CircleDollarSign size={15} />, label: ui.money, value: money } : null,
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; value: string }>;

  return (
    <section className='p7-ai-decision' aria-label={ui.summary}>
      <div className='p7-ai-decision-head'>
        <span>{ui.summary}</span>
        <strong>{decision.summary}</strong>
      </div>
      {items.length ? (
        <div className='p7-ai-decision-grid'>
          {items.map((item) => (
            <div key={`${item.label}-${item.value}`}>
              <span>{item.icon}{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      <div className='p7-ai-confidence'>
        <span>{ui.confidence}</span>
        <strong data-confidence={decision.confidence}>{confidenceLabel(decision.confidence, ui)}</strong>
        <small>{formatDateTime(decision.dataFreshnessAt, locale)}</small>
      </div>
      {decision.evidence.length ? (
        <details className='p7-ai-evidence'>
          <summary>{ui.evidence} · {decision.evidence.length}</summary>
          <div>
            {decision.evidence.slice(0, 6).map((item, index) => (
              <p key={`${item.kind}-${index}`}><strong>{item.label}</strong><span>{item.value}</span></p>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

export function AiAssistantPanel({ variant = 'floating' }: { variant?: Variant }) {
  const pathname = usePathname() || '/platform-v7';
  const [locale, setLocale] = React.useState<Locale>('ru');
  const [open, setOpen] = React.useState(variant === 'workspace');
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [stageIndex, setStageIndex] = React.useState(0);
  const [error, setError] = React.useState('');
  const [lastQuestion, setLastQuestion] = React.useState('');
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [dataMode, setDataMode] = React.useState<DataMode>('authoritative');
  const panelRef = React.useRef<HTMLElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const messagesRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const ui = COPY[locale];
  const dealId = dealIdFromPath(pathname);

  React.useEffect(() => {
    const next = resolveLocale();
    setLocale(next);
    setMessages((current) => current.length ? current : [{
      id: randomId('assistant'),
      role: 'assistant',
      content: `${timeGreeting(next)} ${COPY[next].greetingBody}`,
      dataMode: 'authoritative',
    }]);

    const controller = new AbortController();
    void fetch('/api/proxy/ai-assistant/catalog', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as Catalog;
      setCatalog(payload);
      if (payload.dataMode === 'synthetic_demo') setDataMode('synthetic_demo');
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, stageIndex]);

  React.useEffect(() => {
    if (!sending) {
      setStageIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setStageIndex((current) => Math.min(current + 1, ui.stages.length - 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, [sending, ui.stages.length]);

  React.useEffect(() => {
    if (variant !== 'floating' || !open) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = focusableElements(panelRef.current);
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
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    };
  }, [open, variant]);

  const reset = () => {
    abortRef.current?.abort();
    setMessages([{
      id: randomId('assistant'),
      role: 'assistant',
      content: `${timeGreeting(locale)} ${ui.greetingBody}`,
      dataMode,
    }]);
    setInput('');
    setSending(false);
    setError('');
    setLastQuestion('');
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
  };

  const submit = async (question: string) => {
    const normalized = question.trim().slice(0, 4_000);
    if (!normalized || sending) return;
    const userMessage: Message = { id: randomId('user'), role: 'user', content: normalized };
    const previous = messages;
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setSending(true);
    setStageIndex(0);
    setError('');
    setLastQuestion(normalized);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/proxy/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({
          message: normalized,
          locale,
          dealId,
          pagePath: pathname,
          history: previous.slice(-10).map((item) => ({ role: item.role, content: item.content.slice(0, 1_200) })),
        }),
      });
      const payload = await response.json().catch(() => null) as ServerAnswer | { message?: string } | null;
      if (!response.ok || !payload || !('answer' in payload) || typeof payload.answer !== 'string') {
        throw new Error(payload && 'message' in payload && typeof payload.message === 'string' ? payload.message : `http_${response.status}`);
      }
      const nextMode = payload.dataMode === 'synthetic_demo' ? 'synthetic_demo' : 'authoritative';
      setDataMode(nextMode);
      setMessages((current) => [...current, {
        id: payload.requestId || randomId('assistant'),
        role: 'assistant',
        content: payload.answer,
        citations: Array.isArray(payload.citations) ? payload.citations : [],
        provider: payload.provider,
        generatedAt: payload.generatedAt,
        dataMode: nextMode,
        decision: payload.decision || fallbackDecision(payload),
      }]);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(ui.error);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(input);
  };

  const onTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit(input);
    }
  };

  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant' && message.decision);

  const panel = (
    <section
      ref={panelRef}
      id={variant === 'floating' ? 'p7-private-ai-assistant-panel' : 'p7-private-ai-assistant-workspace'}
      tabIndex={variant === 'workspace' ? -1 : undefined}
      className={`p7-ai-panel ${variant === 'workspace' ? 'p7-ai-panel-workspace' : ''}`}
      role={variant === 'floating' ? 'dialog' : 'region'}
      aria-modal={variant === 'floating' ? 'true' : undefined}
      aria-label={ui.title}
      data-testid='role-scoped-ai-assistant'
      data-ai-mode='read-only'
      data-ai-data-mode={dataMode}
    >
      <header className='p7-ai-head'>
        <span className='p7-ai-brand' aria-hidden='true'><BrandMark size='100%' shadow={false} /></span>
        <div className='p7-ai-heading'>
          <div className='p7-ai-title-row'>
            <strong>{ui.title}</strong>
            <span className='p7-ai-presence'><i /> {ui.online}</span>
            <span className='p7-ai-readonly'><ShieldCheck size={13} aria-hidden='true' /> {ui.readOnly}</span>
          </div>
          <p>{ui.subtitle}</p>
        </div>
        <div className='p7-ai-head-actions'>
          <button type='button' onClick={reset} aria-label={ui.newChat} title={ui.newChat}><Sparkles size={18} /></button>
          {variant === 'floating' ? <Link href='/platform-v7/assistant' aria-label={ui.fullPage} title={ui.fullPage}><Maximize2 size={18} /></Link> : null}
          {variant === 'floating' ? <button type='button' onClick={() => setOpen(false)} aria-label={ui.close}><X size={20} /></button> : null}
        </div>
      </header>

      <div className={`p7-ai-mode-strip ${dataMode === 'synthetic_demo' ? 'is-synthetic' : ''}`}>
        <strong>{dataMode === 'synthetic_demo' ? ui.synthetic : ui.authoritative}</strong>
        <span>{ui.roleBoundary}</span>
        {dealId ? <small>{ui.dealContext}</small> : null}
      </div>

      <div ref={messagesRef} className='p7-ai-messages' aria-live='polite'>
        {messages.map((message) => (
          <article key={message.id} className={`p7-ai-message p7-ai-message-${message.role}`}>
            <span className='p7-ai-avatar' aria-hidden='true'>
              {message.role === 'assistant' ? <><Bot size={17} /><i /></> : <span>Я</span>}
            </span>
            <div className='p7-ai-bubble'>
              <div className='p7-ai-content'>{message.content}</div>
              {message.role === 'assistant' && message.decision ? <DecisionCard decision={message.decision} locale={locale} /> : null}
              {message.role === 'assistant' && message.provider ? (
                <small className='p7-ai-provider'>
                  {message.provider === 'local-deterministic' ? ui.localProvider : ui.externalProvider}
                  {message.generatedAt ? ` · ${formatTime(message.generatedAt, locale)}` : ''}
                </small>
              ) : null}
              {message.citations?.length ? (
                <details className='p7-ai-citations'>
                  <summary>{ui.sources}</summary>
                  <div>
                    {message.citations.map((citation, index) => citation.href ? (
                      <Link key={`${citation.source}-${index}`} href={citation.href}>
                        {citation.label}<ExternalLink size={13} aria-hidden='true' />
                      </Link>
                    ) : <span key={`${citation.source}-${index}`}>{citation.label}</span>)}
                  </div>
                </details>
              ) : null}
            </div>
          </article>
        ))}
        {sending ? (
          <article className='p7-ai-message p7-ai-message-assistant' aria-label={ui.stages[stageIndex]}>
            <span className='p7-ai-avatar' aria-hidden='true'><Bot size={17} /><i /></span>
            <div className='p7-ai-bubble p7-ai-thinking'>
              <span className='p7-ai-typing' aria-hidden='true'><i /><i /><i /></span>
              <strong>{ui.stages[stageIndex]}</strong>
              <button type='button' onClick={stop}>{ui.stop}</button>
            </div>
          </article>
        ) : null}
      </div>

      {!sending && latestAssistant?.decision?.followUps?.length ? (
        <div className='p7-ai-followups' aria-label='Follow-up questions'>
          {latestAssistant.decision.followUps.slice(0, 3).map((prompt) => (
            <button key={prompt} type='button' onClick={() => void submit(prompt)}>{prompt}</button>
          ))}
        </div>
      ) : messages.length <= 1 ? (
        <div className='p7-ai-starters'>
          {(catalog?.starterPrompts?.length ? catalog.starterPrompts : ui.starterPrompts).slice(0, 5).map((prompt) => (
            <button key={prompt} type='button' onClick={() => void submit(prompt)}>{prompt}</button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className='p7-ai-error' role='alert'>
          <span>{error}</span>
          <button type='button' disabled={!lastQuestion || sending} onClick={() => void submit(lastQuestion)}>{ui.retry}</button>
        </div>
      ) : null}

      <form className='p7-ai-composer' onSubmit={onSubmit}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onTextareaKeyDown}
          rows={2}
          maxLength={4_000}
          placeholder={ui.placeholder}
          aria-label={ui.placeholder}
        />
        <button type='submit' disabled={!input.trim() || sending} aria-label={ui.send} title={ui.send}>
          {sending ? <Loader2 className='p7-ai-spin' size={20} /> : <Send size={20} />}
        </button>
      </form>
    </section>
  );

  if (variant === 'workspace') return <><div className='p7-ai-workspace-wrap'>{panel}</div><style>{css}</style></>;

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        className='p7-ai-trigger'
        onClick={() => setOpen(true)}
        aria-label={ui.open}
        aria-haspopup='dialog'
        aria-expanded={open}
      >
        <MessageCircle size={23} strokeWidth={2.2} />
        <span>AI</span>
        <i aria-hidden='true' />
      </button>
      {open ? <div className='p7-ai-backdrop' onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>{panel}</div> : null}
      <style>{css}</style>
    </>
  );
}

const css = `
.p7-ai-trigger{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));z-index:3500;width:62px;height:54px;border:1px solid rgba(255,255,255,.55);border-radius:18px;background:#087a3b;color:#fff;box-shadow:0 14px 34px rgba(7,54,33,.28);display:inline-flex;align-items:center;justify-content:center;gap:5px;cursor:pointer;touch-action:manipulation;font:800 11px/1 system-ui}.p7-ai-trigger>i{position:absolute;right:7px;top:7px;width:9px;height:9px;border:2px solid #087a3b;border-radius:50%;background:#6ee7a8;box-shadow:0 0 0 3px #fff}.p7-ai-trigger:hover{background:#066b34;transform:translateY(-1px)}.p7-ai-backdrop{position:fixed;inset:0;z-index:4000;display:flex;align-items:flex-end;justify-content:flex-end;padding:24px;background:rgba(4,18,12,.52);backdrop-filter:blur(4px)}
.p7-ai-panel{box-sizing:border-box;width:min(560px,100%);height:min(850px,calc(100dvh - 48px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(7,22,17,.16);border-radius:22px;background:#fff;box-shadow:0 28px 100px rgba(7,22,17,.36);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.p7-ai-panel,.p7-ai-panel *{box-sizing:border-box;min-width:0}.p7-ai-panel-workspace{width:100%;height:min(850px,calc(100dvh - 210px));min-height:640px;box-shadow:0 18px 60px rgba(7,22,17,.12)}.p7-ai-workspace-wrap{width:100%;padding:0}
.p7-ai-head{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:15px;border-bottom:1px solid #dfe8e2;background:linear-gradient(135deg,#f7faf8,#eef8f2)}.p7-ai-brand{display:inline-flex;width:44px;height:44px}.p7-ai-heading strong{font-size:17px;line-height:1.2;font-weight:850;letter-spacing:-.02em}.p7-ai-heading p{margin:4px 0 0;color:#52615b;font-size:12px;line-height:1.35;font-weight:600}.p7-ai-title-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.p7-ai-title-row>span{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:999px;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.03em}.p7-ai-presence{border:1px solid #b9d7c4;background:#edf8f1;color:#075b31}.p7-ai-presence>i{width:7px;height:7px;border-radius:50%;background:#19a35b;box-shadow:0 0 0 3px rgba(25,163,91,.12);animation:p7-ai-pulse 2s ease-in-out infinite}.p7-ai-readonly{border:1px solid #d4dfd8;background:#fff;color:#405249}.p7-ai-head-actions{display:flex;gap:5px}.p7-ai-head-actions button,.p7-ai-head-actions a{width:40px;height:40px;border:1px solid #cfdcd4;border-radius:12px;background:#fff;color:#071611;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none}
.p7-ai-mode-strip{display:grid;gap:3px;padding:9px 15px;border-bottom:1px solid #e4ece7;background:#fbfdfb;color:#405249;font-size:11px;line-height:1.35}.p7-ai-mode-strip strong{color:#087a3b;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.p7-ai-mode-strip span{font-weight:700}.p7-ai-mode-strip small{color:#69766f}.p7-ai-mode-strip.is-synthetic{border-color:#f1cf9f;background:#fff8eb}.p7-ai-mode-strip.is-synthetic strong{color:#9a4d00}
.p7-ai-messages{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:16px;display:flex;flex-direction:column;gap:15px;background:linear-gradient(#fff,#fbfdfb)}.p7-ai-message{display:grid;grid-template-columns:32px minmax(0,1fr);gap:9px;align-items:start;max-width:96%}.p7-ai-message-user{align-self:flex-end;grid-template-columns:minmax(0,1fr) 32px}.p7-ai-message-user .p7-ai-avatar{grid-column:2}.p7-ai-message-user .p7-ai-bubble{grid-column:1;grid-row:1;background:#087a3b;color:#fff;border-color:#087a3b}.p7-ai-avatar{position:relative;width:32px;height:32px;border-radius:11px;background:#edf8f1;color:#087a3b;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:850}.p7-ai-avatar>i{position:absolute;right:-1px;bottom:-1px;width:8px;height:8px;border:2px solid #fff;border-radius:50%;background:#19a35b}.p7-ai-message-user .p7-ai-avatar{background:#e9eef7;color:#344b70}.p7-ai-bubble{padding:12px 14px;border:1px solid #dbe6df;border-radius:5px 16px 16px 16px;background:#f7faf8}.p7-ai-message-user .p7-ai-bubble{border-radius:16px 5px 16px 16px}.p7-ai-content{white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.58;font-weight:570}.p7-ai-provider{display:block;margin-top:9px;color:#6a776f;font-size:10px;font-weight:700}.p7-ai-message-user .p7-ai-provider{color:rgba(255,255,255,.75)}
.p7-ai-decision{display:grid;gap:10px;margin-top:12px;padding:12px;border:1px solid #cfe0d5;border-radius:13px;background:#fff;color:#071611}.p7-ai-decision-head{display:grid;gap:3px}.p7-ai-decision-head>span{color:#087a3b;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.05em}.p7-ai-decision-head>strong{font-size:14px;line-height:1.4}.p7-ai-decision-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.p7-ai-decision-grid>div{display:grid;gap:4px;padding:9px;border:1px solid #e1e9e4;border-radius:10px;background:#fbfdfb}.p7-ai-decision-grid span{display:flex;align-items:center;gap:5px;color:#607068;font-size:10px;font-weight:800}.p7-ai-decision-grid svg{color:#087a3b}.p7-ai-decision-grid strong{font-size:12px;line-height:1.38}.p7-ai-confidence{display:flex;align-items:center;gap:7px;color:#66736c;font-size:10px;font-weight:750}.p7-ai-confidence strong{padding:3px 6px;border-radius:999px;background:#edf8f1;color:#075b31}.p7-ai-confidence strong[data-confidence='low']{background:#fff3e7;color:#8c4200}.p7-ai-confidence small{margin-left:auto}.p7-ai-evidence{border-top:1px solid #e2ebe5;padding-top:8px}.p7-ai-evidence summary{cursor:pointer;color:#087a3b;font-size:11px;font-weight:800}.p7-ai-evidence>div{display:grid;gap:7px;margin-top:8px}.p7-ai-evidence p{display:grid;gap:2px;margin:0;font-size:11px;line-height:1.35}.p7-ai-evidence p strong{color:#405249}.p7-ai-evidence p span{color:#68766f}
.p7-ai-thinking{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px;color:#52615b}.p7-ai-thinking strong{font-size:12px}.p7-ai-thinking button{border:0;background:transparent;color:#8a3b14;font-size:10px;font-weight:800;cursor:pointer}.p7-ai-typing{display:flex;gap:3px}.p7-ai-typing i{width:5px;height:5px;border-radius:50%;background:#087a3b;animation:p7-ai-bounce 1s infinite ease-in-out}.p7-ai-typing i:nth-child(2){animation-delay:.15s}.p7-ai-typing i:nth-child(3){animation-delay:.3s}.p7-ai-spin{animation:p7-ai-spin 1s linear infinite}@keyframes p7-ai-spin{to{transform:rotate(360deg)}}@keyframes p7-ai-bounce{0%,80%,100%{transform:translateY(0);opacity:.45}40%{transform:translateY(-4px);opacity:1}}@keyframes p7-ai-pulse{0%,100%{box-shadow:0 0 0 3px rgba(25,163,91,.12)}50%{box-shadow:0 0 0 6px rgba(25,163,91,.04)}}
.p7-ai-citations{margin-top:9px;padding-top:8px;border-top:1px solid #dbe6df}.p7-ai-citations summary{cursor:pointer;color:#087a3b;font-size:11px;font-weight:800}.p7-ai-citations>div{display:grid;gap:6px;margin-top:7px}.p7-ai-citations a,.p7-ai-citations span{display:flex;align-items:center;gap:5px;color:#405249;font-size:11px;line-height:1.35;font-weight:680;text-decoration:none}.p7-ai-citations a:hover{text-decoration:underline}
.p7-ai-starters,.p7-ai-followups{display:flex;gap:7px;overflow-x:auto;padding:0 16px 12px;background:#fff}.p7-ai-starters button,.p7-ai-followups button{flex:0 0 auto;max-width:280px;min-height:40px;padding:9px 12px;border:1px solid #cfe0d5;border-radius:11px;background:#f7faf8;color:#075b31;font-size:12px;line-height:1.25;font-weight:760;cursor:pointer;text-align:left}.p7-ai-followups{padding-top:10px;border-top:1px solid #edf2ee}.p7-ai-followups button{background:#fff}
.p7-ai-error{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 16px 10px;padding:10px 12px;border-left:4px solid #b54708;border-radius:8px;background:#fff5eb;color:#7a2e0e;font-size:12px;line-height:1.4;font-weight:700}.p7-ai-error button{min-height:36px;padding:0 11px;border:1px solid #e2b795;border-radius:8px;background:#fff;color:#7a2e0e;font-weight:800;cursor:pointer}.p7-ai-composer{display:grid;grid-template-columns:minmax(0,1fr) 48px;gap:9px;align-items:end;padding:12px 15px max(12px,env(safe-area-inset-bottom,0px));border-top:1px solid #dfe8e2;background:#f7faf8}.p7-ai-composer textarea{width:100%;min-height:54px;max-height:170px;padding:13px;border:1px solid #cbd8d0;border-radius:13px;background:#fff;color:#071611;font:600 16px/1.4 inherit;resize:none;outline:none}.p7-ai-composer textarea:focus{border-color:#087a3b;box-shadow:0 0 0 3px rgba(8,122,59,.1)}.p7-ai-composer>button{width:48px;height:48px;border:0;border-radius:13px;background:#087a3b;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.p7-ai-composer>button:disabled{opacity:.45;cursor:not-allowed}.p7-ai-trigger:focus-visible,.p7-ai-panel button:focus-visible,.p7-ai-panel a:focus-visible,.p7-ai-panel textarea:focus-visible{outline:3px solid #17649b;outline-offset:3px}
@media(max-width:720px){.p7-ai-trigger{right:max(12px,env(safe-area-inset-right,0px));bottom:max(12px,env(safe-area-inset-bottom,0px))}.p7-ai-backdrop{padding:0;align-items:flex-end}.p7-ai-panel{width:100%;height:calc(100dvh - max(10px,env(safe-area-inset-top,0px)));border-radius:20px 20px 0 0;border-bottom:0}.p7-ai-panel-workspace{height:calc(100dvh - 150px);min-height:580px;border-radius:15px}.p7-ai-head{grid-template-columns:40px minmax(0,1fr) auto;padding:12px;gap:9px}.p7-ai-brand{width:40px;height:40px}.p7-ai-head-actions button,.p7-ai-head-actions a{width:38px;height:38px}.p7-ai-head-actions a{display:none}.p7-ai-messages{padding:13px}.p7-ai-message{max-width:99%}.p7-ai-content{font-size:14px}.p7-ai-decision-grid{grid-template-columns:1fr}.p7-ai-starters,.p7-ai-followups{padding-left:13px;padding-right:13px}.p7-ai-composer{padding-left:12px;padding-right:12px}}
@media(prefers-reduced-motion:reduce){.p7-ai-trigger,.p7-ai-presence>i,.p7-ai-typing i,.p7-ai-spin{animation:none!important;transition:none!important}.p7-ai-trigger:hover{transform:none}}
`;
