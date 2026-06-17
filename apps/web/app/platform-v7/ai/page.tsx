'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Banknote,
  Bot,
  Camera,
  ClipboardList,
  FileCheck2,
  FlaskConical,
  Gavel,
  Landmark,
  LayoutDashboard,
  Route,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  User,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { trackGigaChatAsked } from '@/lib/analytics/track';

const ACTIVE_ROLE_KEY = 'pc-v7-active-role';

const ROLE_HOME: Record<PlatformRole, string> = {
  operator: '/platform-v7/control-tower',
  buyer: '/platform-v7/buyer',
  seller: '/platform-v7/seller',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7/driver',
  surveyor: '/platform-v7/surveyor',
  elevator: '/platform-v7/elevator',
  lab: '/platform-v7/lab',
  bank: '/platform-v7/bank',
  arbitrator: '/platform-v7/arbitrator',
  compliance: '/platform-v7/compliance',
  executive: '/platform-v7/executive',
};

const ROLE_LABELS: Record<PlatformRole, string> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логистика',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  bank: 'Банк',
  arbitrator: 'Арбитр',
  compliance: 'Комплаенс',
  executive: 'Руководитель',
};

type SuggestedAction = { label: string; href: string; note: string };
type RoleAiConfig = {
  title: string;
  subtitle: string;
  promise: string;
  icon: LucideIcon;
  questions: string[];
  actions: SuggestedAction[];
  scopes: string[];
  limits: string[];
};

type ResponseModel = {
  headline: string;
  summary: string;
  sources: string[];
  steps: string[];
  actions: SuggestedAction[];
};

const ALLOWED_PREFIXES: Record<PlatformRole, string[]> = {
  operator: ['/platform-v7/control-tower', '/platform-v7/deals', '/platform-v7/lots', '/platform-v7/procurement', '/platform-v7/logistics', '/platform-v7/bank', '/platform-v7/disputes', '/platform-v7/compliance', '/platform-v7/executive', '/platform-v7/ai'],
  buyer: ['/platform-v7/buyer', '/platform-v7/procurement', '/platform-v7/ai'],
  seller: ['/platform-v7/seller', '/platform-v7/ai'],
  logistics: ['/platform-v7/logistics', '/platform-v7/ai'],
  driver: ['/platform-v7/driver', '/platform-v7/ai'],
  surveyor: ['/platform-v7/surveyor', '/platform-v7/ai'],
  elevator: ['/platform-v7/elevator', '/platform-v7/ai'],
  lab: ['/platform-v7/lab', '/platform-v7/ai'],
  bank: ['/platform-v7/bank', '/platform-v7/ai'],
  arbitrator: ['/platform-v7/arbitrator', '/platform-v7/ai'],
  compliance: ['/platform-v7/compliance', '/platform-v7/ai'],
  executive: ['/platform-v7/executive', '/platform-v7/control-tower', '/platform-v7/deals', '/platform-v7/bank', '/platform-v7/disputes', '/platform-v7/ai'],
};

const ROLE_AI: Record<PlatformRole, RoleAiConfig> = {
  operator: {
    title: 'Помощник оператора исполнения',
    subtitle: 'Блокеры, владелец шага, документы, деньги под риском и эскалации.',
    promise: 'Берёт на себя только операторский контур: найти блокер, владельца шага и следующий допустимый экран.',
    icon: LayoutDashboard,
    questions: ['Кто держит следующий шаг?', 'Каких документов не хватает?', 'Где главный блокер?', 'Куда идти дальше?'],
    actions: [
      { label: 'Центр управления', href: '/platform-v7/control-tower', note: 'Открыть очередь блокеров' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Открыть реестр исполнения' },
      { label: 'Споры', href: '/platform-v7/disputes', note: 'Открыть спорный контур' },
    ],
    scopes: ['операторский обзор', 'блокер и ответственный', 'следующий шаг по сделке'],
    limits: ['не действует от имени банка', 'не действует от имени водителя', 'не подтверждает внешние интеграции'],
  },
  buyer: {
    title: 'Помощник покупателя',
    subtitle: 'Закупки, качество, приёмка и документы со стороны покупателя.',
    promise: 'Берёт на себя только контур покупателя: найти закупку, риск поставки и следующий шаг покупателя.',
    icon: Banknote,
    questions: ['Что мешает закупке?', 'Что по качеству?', 'Каких документов не хватает?', 'Куда идти дальше?'],
    actions: [
      { label: 'Кабинет покупателя', href: '/platform-v7/buyer', note: 'Открыть рабочий экран покупателя' },
      { label: 'Мои закупки', href: '/platform-v7/procurement', note: 'Открыть потребности и предложения' },
    ],
    scopes: ['заявки покупателя', 'качество и приёмка', 'документы покупателя'],
    limits: ['не открывает банк за покупателя', 'не действует за продавца', 'не идёт в чужие кабинеты'],
  },
  seller: {
    title: 'Помощник продавца',
    subtitle: 'Партии, офферы, документы продавца и следующий шаг по поставке.',
    promise: 'Берёт на себя только контур продавца: партия, документы и что мешает движению сделки.',
    icon: Wheat,
    questions: ['Что мешает партии?', 'Какие документы нужны?', 'Какой следующий шаг продавца?', 'Куда идти дальше?'],
    actions: [
      { label: 'Кабинет продавца', href: '/platform-v7/seller', note: 'Открыть партии и документы продавца' },
    ],
    scopes: ['партии продавца', 'документы продавца', 'следующий шаг продавца'],
    limits: ['не действует за покупателя', 'не открывает банк', 'не меняет лабораторный результат'],
  },
  logistics: {
    title: 'Помощник логистики',
    subtitle: 'Рейсы, перевозчики, маршрут, транспортные документы и отклонения.',
    promise: 'Берёт на себя только логистический контур: рейс, маршрут, ЭПД и отклонения.',
    icon: Truck,
    questions: ['Где рейс?', 'Что по маршруту?', 'Какие транспортные документы нужны?', 'Куда идти дальше?'],
    actions: [
      { label: 'Диспетчерская', href: '/platform-v7/logistics', note: 'Открыть рейсы и отклонения' },
    ],
    scopes: ['рейс', 'маршрут', 'транспортные документы'],
    limits: ['не действует за водителя', 'не действует за элеватор', 'не открывает банк'],
  },
  driver: {
    title: 'Помощник водителя',
    subtitle: 'Маршрут, прибытие, фотофиксация и полевые события.',
    promise: 'Берёт на себя только контур водителя: один понятный следующий шаг по рейсу.',
    icon: User,
    questions: ['Что делать после прибытия?', 'Какие события зафиксировать?', 'Что нажать дальше?', 'Куда идти дальше?'],
    actions: [
      { label: 'Мой маршрут', href: '/platform-v7/driver', note: 'Вернуться к маршруту водителя' },
    ],
    scopes: ['маршрут', 'прибытие', 'фото и события'],
    limits: ['не открывает логистику', 'не открывает элеватор', 'не открывает сделку или банк'],
  },
  surveyor: {
    title: 'Помощник сюрвейера',
    subtitle: 'Осмотр, факты, фото, акт и доказательный пакет.',
    promise: 'Берёт на себя только контур сюрвейера: какие факты и доказательства собрать.',
    icon: Search,
    questions: ['Какие факты собрать?', 'Что приложить к акту?', 'Чего не хватает?', 'Куда идти дальше?'],
    actions: [
      { label: 'Мои назначения', href: '/platform-v7/surveyor', note: 'Открыть осмотр и фиксацию фактов' },
    ],
    scopes: ['осмотр', 'фото', 'акт'],
    limits: ['не решает спор за арбитра', 'не меняет цену', 'не действует за лабораторию'],
  },
  elevator: {
    title: 'Помощник приёмки',
    subtitle: 'Очередь, вес, выгрузка, акты и факт приёмки.',
    promise: 'Берёт на себя только контур элеватора: какой факт приёмки зафиксировать сейчас.',
    icon: Scale,
    questions: ['Что подтвердить на приёмке?', 'Что по весу?', 'Какой акт нужен?', 'Куда идти дальше?'],
    actions: [
      { label: 'Приёмка', href: '/platform-v7/elevator', note: 'Открыть вес, очередь и акты' },
    ],
    scopes: ['очередь', 'вес', 'акт приёмки'],
    limits: ['не открывает лабораторию', 'не открывает сделки', 'не действует за банк'],
  },
  lab: {
    title: 'Помощник лаборатории',
    subtitle: 'Проба, качество, протокол, повторный анализ и дельта.',
    promise: 'Берёт на себя только лабораторный контур: проба, протокол и влияние качества.',
    icon: FlaskConical,
    questions: ['Что по качеству?', 'Нужен ли повторный анализ?', 'Что указать в протоколе?', 'Куда идти дальше?'],
    actions: [
      { label: 'Пробы и протоколы', href: '/platform-v7/lab', note: 'Открыть лабораторный контур' },
    ],
    scopes: ['проба', 'качество', 'протокол'],
    limits: ['не открывает споры', 'не открывает сделки', 'не действует за элеватор'],
  },
  bank: {
    title: 'Помощник банка',
    subtitle: 'Банковское основание, факторинг, эскроу, удержания и события.',
    promise: 'Берёт на себя только банковский контур: проверить основание, статус и допустимый следующий банковский шаг.',
    icon: Landmark,
    questions: ['Что мешает основанию?', 'Что по факторингу?', 'Что по эскроу?', 'Куда идти дальше?'],
    actions: [
      { label: 'Банковское основание', href: '/platform-v7/bank', note: 'Открыть банковский экран' },
      { label: 'Факторинг', href: '/platform-v7/bank/factoring', note: 'Открыть факторинг' },
      { label: 'Эскроу', href: '/platform-v7/bank/escrow', note: 'Открыть эскроу' },
    ],
    scopes: ['основание', 'факторинг', 'эскроу'],
    limits: ['не действует за оператора', 'не открывает сделки вне банковского контура', 'не обещает проведение платежа'],
  },
  arbitrator: {
    title: 'Помощник арбитра',
    subtitle: 'Комната разбора, доказательства, позиция сторон и решение по регламенту.',
    promise: 'Берёт на себя только контур арбитра: собрать доказательства и следующий шаг разбора.',
    icon: Gavel,
    questions: ['Какие доказательства нужны?', 'Что мешает решению?', 'Кто должен ответить?', 'Куда идти дальше?'],
    actions: [
      { label: 'Комнаты разбора', href: '/platform-v7/arbitrator', note: 'Открыть арбитражный контур' },
    ],
    scopes: ['разбор', 'доказательства', 'решение по регламенту'],
    limits: ['не меняет документы задним числом', 'не действует за банк', 'не закрывает спор без регламента'],
  },
  compliance: {
    title: 'Помощник комплаенса',
    subtitle: 'Допуск, полномочия, стоп-факторы, документы и риск.',
    promise: 'Берёт на себя только комплаенс-контур: допуск, риск и стоп-факторы.',
    icon: ShieldCheck,
    questions: ['Что мешает допуску?', 'Каких полномочий не хватает?', 'Где стоп-фактор?', 'Куда идти дальше?'],
    actions: [
      { label: 'Комплаенс', href: '/platform-v7/compliance', note: 'Открыть допуск и риски' },
    ],
    scopes: ['допуск', 'полномочия', 'стоп-факторы'],
    limits: ['не действует за банк', 'не открывает сделки', 'не закрывает AML/KYC за внешнюю сторону'],
  },
  executive: {
    title: 'Помощник руководителя',
    subtitle: 'Сводка, деньги под риском, топ-блокеры и здоровье пилота.',
    promise: 'Берёт на себя только управленческий контур: сводка, риски и следующий критический шаг.',
    icon: Sparkles,
    questions: ['Где главный риск?', 'Какие деньги под риском?', 'Что мешает следующему шагу?', 'Куда идти дальше?'],
    actions: [
      { label: 'Сводка', href: '/platform-v7/executive', note: 'Открыть управленческий экран' },
      { label: 'Центр управления', href: '/platform-v7/control-tower', note: 'Открыть операционную картину' },
      { label: 'Банковское основание', href: '/platform-v7/bank', note: 'Открыть денежный контур' },
    ],
    scopes: ['управленческая сводка', 'деньги под риском', 'топ-блокеры'],
    limits: ['не действует за участника сделки', 'не скрывает блокеры', 'не завышает зрелость'],
  },
};

function readActiveRole(fallback: PlatformRole): PlatformRole {
  if (typeof window === 'undefined') return fallback;
  const stored = window.sessionStorage.getItem(ACTIVE_ROLE_KEY) as PlatformRole | null;
  return stored && ROLE_HOME[stored] ? stored : fallback;
}

function allowedForRole(role: PlatformRole, href: string) {
  const path = href.split('?')[0].replace(/\/$/, '');
  return (ALLOWED_PREFIXES[role] ?? []).some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function filterActions(role: PlatformRole, actions: SuggestedAction[]) {
  return actions.filter((action) => allowedForRole(role, action.href));
}

function screenLabel(from: string) {
  if (!from) return 'Текущий экран';
  if (from.includes('/control-tower')) return 'Control Tower';
  if (from.includes('/bank')) return 'Банковский контур';
  if (from.includes('/driver')) return 'Маршрут водителя';
  if (from.includes('/logistics')) return 'Логистика';
  if (from.includes('/seller')) return 'Кабинет продавца';
  if (from.includes('/buyer')) return 'Кабинет покупателя';
  if (from.includes('/elevator')) return 'Приёмка';
  if (from.includes('/lab')) return 'Лаборатория';
  if (from.includes('/surveyor')) return 'Сюрвейер';
  if (from.includes('/arbitrator')) return 'Арбитр';
  if (from.includes('/compliance')) return 'Комплаенс';
  if (from.includes('/executive')) return 'Сводка руководителя';
  return from.replace('/platform-v7/', '').replaceAll('/', ' → ');
}

function safeFrom(role: PlatformRole, from: string) {
  return allowedForRole(role, from) ? from : ROLE_HOME[role];
}

function inferQuery(question: string | null, role: PlatformRole, from: string) {
  return question?.trim() || ROLE_AI[role].questions[0] || `Что делать дальше на экране ${screenLabel(from)}?`;
}

function buildSuggestedActions(role: PlatformRole): SuggestedAction[] {
  const config = ROLE_AI[role] || ROLE_AI.operator;
  return filterActions(role, config.actions);
}

function buildResponse(role: PlatformRole, question: string, from: string): ResponseModel {
  const lower = question.toLowerCase();
  const roleLabel = ROLE_LABELS[role];
  const screen = screenLabel(from);
  const actions = buildSuggestedActions(role);
  const roleBoundary = `Помощник работает только в роли «${roleLabel}». Он не открывает чужие кабинеты и не выполняет действия другой стороны сделки.`;

  if (lower.includes('документ') || lower.includes('пакет') || lower.includes('акт')) {
    return {
      headline: 'Фокус на пакете своей роли',
      summary: `${roleBoundary} На экране «${screen}» он проверяет только документы и факты, доступные этой роли.`,
      sources: ['role scope', 'document readiness', 'next allowed action'],
      steps: ['Открой рабочий экран своей роли.', 'Проверь обязательный факт или документ.', 'Вернись в ИИ, если нужен следующий разрешённый шаг.'],
      actions,
    };
  }

  if (lower.includes('деньг') || lower.includes('удерж') || lower.includes('основан') || lower.includes('банк')) {
    return {
      headline: 'Фокус на доступной роли части денежного контура',
      summary: `${roleBoundary} Если текущая роль не банковская и не управленческая, помощник объясняет влияние на сделку, но не ведёт в банковский кабинет.`,
      sources: ['role scope', 'allowed route by role', 'money impact without role leakage'],
      steps: ['Проверь свой экран роли.', 'Зафиксируй доступный факт.', 'Не переходи в чужой денежный контур без соответствующей роли.'],
      actions,
    };
  }

  if (lower.includes('куда') || lower.includes('дальше') || lower.includes('что делать') || lower.includes('следующ')) {
    return {
      headline: 'Фокус на следующем разрешённом ходе',
      summary: `${roleBoundary} Следующий ход строится только из разрешённых экранов роли и её нижней панели.`,
      sources: ['active role', 'role home', 'allowed action set'],
      steps: ['Нажми главное действие своей роли.', 'Закрой ближайший доступный блокер.', 'Используй меню роли, если нужно больше функций.'],
      actions,
    };
  }

  return {
    headline: 'Фокус на текущей роли',
    summary: `${roleBoundary} На экране «${screen}» он подсказывает только то, что может выполнить текущий ЛК.`,
    sources: ['active role lock', 'role-specific assistant config', 'safe action filter'],
    steps: ['Оставайся в своём кабинете.', 'Используй ИИ для следующего шага именно этой роли.', 'Все остальные функции открывай через безопасное меню роли.'],
    actions,
  };
}

export default function PlatformV7AiPage() {
  const searchParams = useSearchParams();
  const storeRole = usePlatformV7RStore((state) => state.role);
  const [activeRole, setActiveRole] = React.useState<PlatformRole>(storeRole || 'operator');

  React.useEffect(() => {
    setActiveRole(readActiveRole(storeRole || 'operator'));
  }, [storeRole]);

  const unsafeFrom = searchParams.get('from') || ROLE_HOME[activeRole];
  const from = safeFrom(activeRole, unsafeFrom);
  const question = inferQuery(searchParams.get('q'), activeRole, from);
  const config = ROLE_AI[activeRole] || ROLE_AI.operator;
  const Icon = config.icon;
  const response = buildResponse(activeRole, question, from);

  React.useEffect(() => {
    trackGigaChatAsked(`${activeRole}:${from}:${question}`);
  }, [activeRole, from, question]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent)' }}>
              <Icon size={20} strokeWidth={2.1} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-secondary)', fontSize: 11, fontWeight: 800, width: 'fit-content' }}>
                <Bot size={14} strokeWidth={2.1} /> ИИ-помощник роли
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{config.title}</div>
              <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)', lineHeight: 1.6, maxWidth: 920 }}>{config.subtitle}</div>
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent-strong)', fontSize: 12, fontWeight: 800 }}>
            {ROLE_LABELS[activeRole]} · {screenLabel(from)}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <InfoCard title="Граница роли" value={config.promise} />
          <InfoCard title="Что можно" value={config.scopes.join(' · ')} />
          <InfoCard title="Что нельзя" value={config.limits.join(' · ')} />
        </div>
      </section>

      <section style={{ background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{response.headline}</div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--pc-text-secondary)' }}>{response.summary}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <ListCard title="Опора ответа" items={response.sources} />
          <ListCard title="Что сделать" items={response.steps} />
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Разрешённые действия</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {response.actions.map((action) => (
              <Link key={action.href} href={action.href} style={{ display: 'grid', gap: 4, minWidth: 180, textDecoration: 'none', padding: '12px 14px', borderRadius: 16, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)', color: 'var(--pc-text-primary)' }}>
                <strong style={{ fontSize: 13 }}>{action.label}</strong>
                <span style={{ fontSize: 11, color: 'var(--pc-text-muted)', lineHeight: 1.35 }}>{action.note}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Быстрые вопросы своей роли</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {config.questions.map((item) => {
            const params = new URLSearchParams();
            params.set('from', from);
            params.set('q', item);
            return <Link key={item} href={`/platform-v7/ai?${params.toString()}`} style={{ textDecoration: 'none', padding: '8px 10px', borderRadius: 999, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)', color: 'var(--pc-text-secondary)', fontSize: 12, fontWeight: 800 }}>{item}</Link>;
          })}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return <div style={{ background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 16, display: 'grid', gap: 8 }}>
    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
    <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)', lineHeight: 1.55 }}>{value}</div>
  </div>;
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return <div style={{ background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 16, display: 'grid', gap: 8 }}>
    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
    <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--pc-text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  </div>;
}
