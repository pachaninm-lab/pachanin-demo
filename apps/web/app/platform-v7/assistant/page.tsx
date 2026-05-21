'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Banknote, FileCheck2, Gavel, LayoutDashboard, Truck, User, Wheat, type LucideIcon } from 'lucide-react';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

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

type Config = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  questions: string[];
  actions: Array<{ label: string; href: string; note: string }>;
};

const CONFIG: Record<PlatformRole, Config> = {
  operator: {
    title: 'Помощник оператора сделки',
    subtitle: 'Блокеры, документы, деньги под риском и следующий ответственный шаг.',
    icon: LayoutDashboard,
    questions: ['Почему выпуск денег остановлен?', 'Кто отвечает за следующий шаг?', 'Каких документов не хватает?', 'Куда перейти дальше?'],
    actions: [
      { label: 'Центр управления', href: '/platform-v7/control-tower', note: 'Очередь блокеров и следующий ответственный' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Реестр сделок и статусы исполнения' },
      { label: 'Споры', href: '/platform-v7/disputes', note: 'Удержания и доказательства' },
    ],
  },
  buyer: {
    title: 'Помощник покупателя',
    subtitle: 'Качество, приёмка, резерв денег и путь до расчёта.',
    icon: Banknote,
    questions: ['Почему деньги стоят?', 'Что с качеством партии?', 'Каких документов не хватает?', 'Что делать дальше?'],
    actions: [
      { label: 'Кабинет покупателя', href: '/platform-v7/buyer', note: 'Заявки, сделки и документы покупателя' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Исполнение и состояние документов' },
      { label: 'Банк', href: '/platform-v7/bank', note: 'Резерв, удержание и основания выпуска денег' },
    ],
  },
  seller: {
    title: 'Помощник продавца',
    subtitle: 'Документы продавца, удержания и путь к выплате.',
    icon: Wheat,
    questions: ['Почему лот на проверке?', 'Каких документов не хватает?', 'Что нужно для выпуска денег?', 'Куда перейти дальше?'],
    actions: [
      { label: 'Кабинет продавца', href: '/platform-v7/seller', note: 'Партии, лоты и выплаты' },
      { label: 'Лоты и запросы', href: '/platform-v7/lots', note: 'Предсделочный контур' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Исполнение, документы и деньги' },
    ],
  },
  logistics: {
    title: 'Помощник логистики',
    subtitle: 'Рейс, окно приёмки, отклонения маршрута и транспортные документы.',
    icon: Truck,
    questions: ['Где главный риск рейса?', 'Что по окну приёмки?', 'Какие транспортные документы нужны?', 'Куда перейти дальше?'],
    actions: [
      { label: 'Логистика', href: '/platform-v7/logistics', note: 'Рейсы, заявки и отклонения' },
      { label: 'Водитель', href: '/platform-v7/driver', note: 'Маршрут и события рейса' },
      { label: 'Приёмка', href: '/platform-v7/elevator', note: 'Вес, окно разгрузки и акты' },
    ],
  },
  driver: {
    title: 'Помощник водителя',
    subtitle: 'Маршрут, прибытие, фотофиксация и следующий шаг рейса.',
    icon: User,
    questions: ['Что делать после прибытия?', 'Какие события надо зафиксировать?', 'Что мешает закрыть рейс?', 'Куда перейти дальше?'],
    actions: [
      { label: 'Маршрут', href: '/platform-v7/driver', note: 'Текущий рейс и события' },
      { label: 'Логистика', href: '/platform-v7/logistics', note: 'Связь с диспетчером' },
      { label: 'Приёмка', href: '/platform-v7/elevator', note: 'Разгрузка и фиксация веса' },
    ],
  },
  surveyor: {
    title: 'Помощник сюрвейера',
    subtitle: 'Осмотр, доказательства и связь со спором.',
    icon: FileCheck2,
    questions: ['Какой пакет доказательств нужен?', 'Что приложить к спору?', 'Кто отвечает сейчас?', 'Куда перейти дальше?'],
    actions: [
      { label: 'Назначения', href: '/platform-v7/surveyor', note: 'Текущие осмотры' },
      { label: 'Споры', href: '/platform-v7/disputes', note: 'Пакет доказательств и решение' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Связанные сделки' },
    ],
  },
  elevator: {
    title: 'Помощник приёмки',
    subtitle: 'Очередь, вес, акт приёмки и переход к лаборатории.',
    icon: FileCheck2,
    questions: ['Что подтвердить на приёмке?', 'Какие акты нужны?', 'Что по очереди?', 'Куда перейти дальше?'],
    actions: [
      { label: 'Приёмка', href: '/platform-v7/elevator', note: 'Вес, допуск и акты' },
      { label: 'Лаборатория', href: '/platform-v7/lab', note: 'Проба и качество' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Связанные поставки' },
    ],
  },
  lab: {
    title: 'Помощник лаборатории',
    subtitle: 'Проба, протокол, повторный анализ и влияние на расчёт.',
    icon: FileCheck2,
    questions: ['Что с качеством?', 'Нужен ли повторный анализ?', 'Что передать в спор?', 'Куда перейти дальше?'],
    actions: [
      { label: 'Лаборатория', href: '/platform-v7/lab', note: 'Пробы и протоколы' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Связь качества со сделкой' },
      { label: 'Споры', href: '/platform-v7/disputes', note: 'Доказательства и удержания' },
    ],
  },
  bank: {
    title: 'Помощник банка',
    subtitle: 'Резерв, удержание, ответы банка и основания выпуска денег.',
    icon: Banknote,
    questions: ['Почему удержание не снято?', 'Что нужно для выпуска денег?', 'Есть ли конфликт статусов?', 'Куда перейти дальше?'],
    actions: [
      { label: 'Банковый контур', href: '/platform-v7/bank', note: 'Резерв, удержание и выпуск денег' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Сделки, влияющие на деньги' },
      { label: 'Споры', href: '/platform-v7/disputes', note: 'Спорные удержания' },
    ],
  },
  arbitrator: {
    title: 'Помощник арбитра',
    subtitle: 'Основание спора, пакет доказательств, сумма влияния и решение.',
    icon: Gavel,
    questions: ['Что входит в пакет доказательств?', 'Каких доказательств не хватает?', 'Кто отвечает за спор?', 'Что нужно для закрытия спора?'],
    actions: [
      { label: 'Арбитр', href: '/platform-v7/arbitrator', note: 'Разбор спора' },
      { label: 'Споры', href: '/platform-v7/disputes', note: 'Реестр споров' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Связанные сделки' },
    ],
  },
  compliance: {
    title: 'Помощник комплаенса',
    subtitle: 'Допуск, полномочия, стоп-флаги и обязательный пакет.',
    icon: FileCheck2,
    questions: ['Что мешает допуску?', 'Каких полномочий не хватает?', 'Где стоп-флаг?', 'Куда перейти дальше?'],
    actions: [
      { label: 'Комплаенс', href: '/platform-v7/compliance', note: 'Допуск и стоп-флаги' },
      { label: 'Подключения', href: '/platform-v7/connectors', note: 'Внешние системы' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Проверка рисков' },
    ],
  },
  executive: {
    title: 'Помощник руководителя',
    subtitle: 'Деньги под риском, основные блокеры и прогресс контура.',
    icon: LayoutDashboard,
    questions: ['Где главный риск пилота?', 'Какие деньги под риском?', 'Что мешает следующему шагу?', 'Куда перейти дальше?'],
    actions: [
      { label: 'Сводка', href: '/platform-v7/executive', note: 'Управленческая картина' },
      { label: 'Центр управления', href: '/platform-v7/control-tower', note: 'Операционные блокеры' },
      { label: 'Банк', href: '/platform-v7/bank', note: 'Деньги и удержания' },
    ],
  },
};

function screenLabel(from: string) {
  if (!from) return 'Текущий экран';
  if (from.includes('/control-tower')) return 'Центр управления';
  if (from.includes('/deals/')) return 'Карточка сделки';
  if (from.includes('/deals')) return 'Реестр сделок';
  if (from.includes('/lots')) return 'Лоты и запросы';
  if (from.includes('/bank')) return 'Банковый контур';
  if (from.includes('/disputes')) return 'Контур спора';
  if (from.includes('/driver')) return 'Маршрут водителя';
  if (from.includes('/logistics')) return 'Логистика';
  if (from.includes('/seller')) return 'Кабинет продавца';
  if (from.includes('/buyer')) return 'Кабинет покупателя';
  if (from.includes('/elevator')) return 'Приёмка';
  if (from.includes('/lab')) return 'Лаборатория';
  if (from.includes('/compliance')) return 'Комплаенс';
  if (from.includes('/executive')) return 'Сводка руководителя';
  return from.replace('/platform-v7/', '').replaceAll('/', ' → ');
}

function inferRole(raw: string | null, fallback: PlatformRole): PlatformRole {
  return raw && raw in CONFIG ? (raw as PlatformRole) : fallback;
}

function inferQuestion(question: string | null, role: PlatformRole) {
  return question?.trim() || CONFIG[role].questions[0];
}

function buildAnswer(role: PlatformRole, question: string, from: string) {
  const lower = question.toLowerCase();
  const roleLabel = ROLE_LABELS[role];
  const screen = screenLabel(from);

  if (lower.includes('документ') || lower.includes('пакет')) {
    return {
      headline: 'Фокус на документах',
      summary: `Для роли «${roleLabel}» на экране «${screen}» сначала проверяется обязательный пакет, затем ответственный и влияние на выпуск денег или спор.`,
      steps: ['Открыть пакет документов.', 'Найти отсутствующий документ и ответственного.', 'Проверить, снимает ли это удержание денег или только переводит статус на проверку.'],
    };
  }

  if (lower.includes('деньг') || lower.includes('выпуск') || lower.includes('удерж')) {
    return {
      headline: 'Фокус на деньгах',
      summary: `Для роли «${roleLabel}» на экране «${screen}» проверяется резерв, удержание, документы, качество и спор. Выпуск денег нельзя показывать как завершённый без подтверждённых оснований.`,
      steps: ['Проверить удержание и причину остановки.', 'Сверить документы, качество и спор.', 'Перейти в банковый контур или карточку сделки для действия.'],
    };
  }

  if (lower.includes('кто') || lower.includes('отвеч')) {
    return {
      headline: 'Фокус на ответственном',
      summary: `Для роли «${roleLabel}» на экране «${screen}» главное — кто держит следующий переход, почему он отвечает и какой факт должен подтвердить.`,
      steps: ['Открыть текущего ответственного.', 'Проверить причину остановки.', 'После подтверждения перейти к деньгам, документам или спору.'],
    };
  }

  return {
    headline: 'Фокус на следующем шаге',
    summary: `Для роли «${roleLabel}» на экране «${screen}» помощник показывает ближайший рабочий переход: деньги, документы, груз, приёмка или спор.`,
    steps: ['Найти главный блокер.', 'Открыть экран, где статус реально меняется.', 'Проверить, появился ли новый ответственный шаг.'],
  };
}

export default function PlatformV7AssistantPage() {
  const searchParams = useSearchParams();
  const storeRole = usePlatformV7RStore((state) => state.role);
  const role = inferRole(searchParams.get('role'), storeRole || 'operator');
  const from = searchParams.get('from') || '/platform-v7/control-tower';
  const question = inferQuestion(searchParams.get('q'), role);
  const config = CONFIG[role];
  const Icon = config.icon;
  const answer = buildAnswer(role, question, from);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={heroCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={iconBox}><Icon size={20} /></div>
            <div>
              <div style={eyebrow}>Помощник сделки</div>
              <h1 style={h1}>{config.title}</h1>
              <p style={lead}>{config.subtitle}</p>
            </div>
          </div>
          <div style={rolePill}>Роль: {ROLE_LABELS[role]}</div>
        </div>

        <div style={questionBox}>
          <strong style={{ color: 'var(--pc-text-primary)' }}>Текущий вопрос</strong>
          <span style={{ color: 'var(--pc-text-secondary)' }}>{question}</span>
        </div>
      </section>

      <section style={gridTwoCols}>
        <article style={card}>
          <div>
            <div style={eyebrow}>Ответ</div>
            <h2 style={h2}>{answer.headline}</h2>
          </div>
          <p style={lead}>{answer.summary}</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {answer.steps.map((step, index) => (
              <div key={step} style={stepRow}>
                <span style={stepNum}>{index + 1}</span>
                <span style={{ color: 'var(--pc-text-primary)', fontSize: 14 }}>{step}</span>
              </div>
            ))}
          </div>
        </article>

        <aside style={card}>
          <div>
            <div style={eyebrow}>Куда перейти</div>
            <h2 style={h2}>Рабочие действия</h2>
          </div>
          {config.actions.map((action) => (
            <Link key={action.href + action.label} href={action.href} style={actionLink}>
              <span style={actionTitle}>{action.label}<ArrowRight size={16} /></span>
              <span style={actionNote}>{action.note}</span>
            </Link>
          ))}
        </aside>
      </section>
    </div>
  );
}

const heroCard = { background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 14 } as const;
const card = { background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 20, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 14, alignSelf: 'start' } as const;
const iconBox = { width: 42, height: 42, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent)' } as const;
const eyebrow = { fontSize: 12, color: 'var(--pc-text-muted)', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em' } as const;
const h1 = { margin: '4px 0', color: 'var(--pc-text-primary)', fontSize: 28, letterSpacing: '-0.03em' } as const;
const h2 = { margin: '5px 0 0', color: 'var(--pc-text-primary)', fontSize: 22 } as const;
const lead = { margin: 0, color: 'var(--pc-text-secondary)', maxWidth: 760, lineHeight: 1.6 } as const;
const rolePill = { border: '1px solid var(--pc-border)', borderRadius: 999, padding: '8px 11px', color: 'var(--pc-text-secondary)', fontSize: 12, fontWeight: 850 } as const;
const questionBox = { display: 'grid', gap: 8, padding: 14, borderRadius: 16, background: 'var(--pc-bg-elevated)', border: '1px solid var(--pc-border)' } as const;
const gridTwoCols = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 } as const;
const stepRow = { display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: 10, alignItems: 'center' } as const;
const stepNum = { width: 28, height: 28, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--pc-accent-bg)', color: 'var(--pc-accent)', fontSize: 12, fontWeight: 900 } as const;
const actionLink = { display: 'grid', gap: 4, border: '1px solid var(--pc-border)', borderRadius: 14, padding: 12, textDecoration: 'none', background: 'var(--pc-bg-elevated)' } as const;
const actionTitle = { display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 900 } as const;
const actionNote = { color: 'var(--pc-text-muted)', fontSize: 12, lineHeight: 1.45 } as const;
