'use client';

import Link from 'next/link';
import { P7Badge } from '@/components/platform-v7/P7Badge';
import { PLATFORM_V7_TOKENS, getPlatformV7ToneTokens, type PlatformV7Tone } from '@/lib/platform-v7/design/tokens';

type SystemSurface =
  | 'operator'
  | 'operatorQueues'
  | 'controlTower'
  | 'lab'
  | 'compliance'
  | 'demo'
  | 'notifications'
  | 'profile'
  | 'auth'
  | 'register'
  | 'deployCheck';

type SystemRouteConfig = {
  title: string;
  tone: PlatformV7Tone;
  status: string;
  purpose: string;
  visible: string;
  boundary: string;
  next: string;
  cta: string;
  href: string;
};

export const PLATFORM_V7_SYSTEM_SURFACES: Record<SystemSurface, SystemRouteConfig> = {
  operator: {
    title: 'Операторский контур',
    tone: 'dispute',
    status: 'очередь действий без ручного обхода',
    purpose: 'показывает причину остановки, сумму влияния, срок реакции, ответственного и следующий подтверждаемый шаг',
    visible: 'оператор видит деньги, документы, рейс, спор и журнал, но каждое действие должно оставлять след',
    boundary: 'экран не должен выглядеть как техническая панель или место тихого ручного исправления данных',
    next: 'открыть очередь действий и закрыть первый блокер через основание',
    cta: 'Открыть центр управления',
    href: '/platform-v7/control-tower',
  },
  operatorQueues: {
    title: 'Очереди оператора',
    tone: 'warning',
    status: 'срок реакции и ответственный выше списка',
    purpose: 'сортирует задачи по срочности, сумме влияния и ответственному, а не по внутренней технической очереди',
    visible: 'оператор видит только то, что требует действия, эскалации или записи в журнал',
    boundary: 'никаких технических меток, внутренних id без смысла и кнопок без изменения состояния',
    next: 'перейти в строку очереди, где есть сумма влияния и следующий ответственный',
    cta: 'Открыть очередь',
    href: '/platform-v7/operator-cockpit/queues',
  },
  controlTower: {
    title: 'Центр управления',
    tone: 'dispute',
    status: 'единый операционный экран',
    purpose: 'сводит деньги, документы, груз, спор, блокер и следующий шаг в одну картину сделки',
    visible: 'оператор видит полную цепочку исполнения, но не должен иметь тихий обход без журнала',
    boundary: 'экран должен быть операционной системой, а не набором графиков и карточек',
    next: 'открыть наиболее дорогой блокер по сумме влияния',
    cta: 'Открыть центр управления',
    href: '/platform-v7/control-tower',
  },
  lab: {
    title: 'Лабораторный контур',
    tone: 'document',
    status: 'качество влияет на приёмку, спор и деньги',
    purpose: 'показывает пробу, показатели, протокол, источник, ответственного и влияние на выплату',
    visible: 'лаборатория видит качество и протокол, но не видит цену, кредит, банк и чужие ставки',
    boundary: 'помощник по сделке не заменяет протокол и независимое подтверждение качества',
    next: 'закрыть протокол или передать отклонение в спор',
    cta: 'Открыть лабораторию',
    href: '/platform-v7/lab',
  },
  compliance: {
    title: 'Комплаенс-контур',
    tone: 'document',
    status: 'допуск, полномочия и основания риска',
    purpose: 'показывает юридический риск, документ, основание, статус, действие и след в журнале',
    visible: 'комплаенс видит допуск, полномочия и причины остановки, которые могут блокировать деньги',
    boundary: 'готовность к подключению не является подтверждённым боевым допуском',
    next: 'запросить недостающий документ или зафиксировать причину остановки',
    cta: 'Открыть комплаенс',
    href: '/platform-v7/compliance',
  },
  demo: {
    title: 'Маршрут сделки',
    tone: 'info',
    status: '3 минуты по цепочке исполнения',
    purpose: 'ведёт по маршруту: лот → ставка → сделка → резерв → рейс → приёмка → документы → деньги → спор',
    visible: 'маршрут показывает контур исполнения, а не набор ссылок или декоративную презентацию',
    boundary: 'данные сценария не являются подтверждением внешних подключений или банковских событий',
    next: 'начать с карточки сделки и пройти ключевые блокеры',
    cta: 'Начать маршрут',
    href: '/platform-v7/demo',
  },
  notifications: {
    title: 'События и уведомления',
    tone: 'info',
    status: 'только события с влиянием на сделку',
    purpose: 'показывает события, связанные с деньгами, грузом, документами, спором или следующим действием',
    visible: 'пользователь не должен получать шум, который не помогает закрыть сделку',
    boundary: 'уведомления не должны имитировать боевые интеграции или банковские события без подтверждения',
    next: 'открыть событие, которое меняет статус или ответственного',
    cta: 'Открыть уведомления',
    href: '/platform-v7/notifications',
  },
  profile: {
    title: 'Профиль и доступ',
    tone: 'neutral',
    status: 'роль, организация, доступы и безопасность',
    purpose: 'объясняет, кто пользователь, от какой организации действует и какие контуры ему разрешены',
    visible: 'профиль должен быть частью банковски аккуратной системы доступа, а не технической формой',
    boundary: 'никаких лишних технических меток и неподтверждённых прав',
    next: 'проверить роль, организацию и разрешённые рабочие экраны',
    cta: 'Открыть профиль',
    href: '/platform-v7/profile',
  },
  auth: {
    title: 'Доступ в платформу',
    tone: 'bank',
    status: 'вход без технического вида',
    purpose: 'выглядит как контролируемый доступ в банковски надёжный контур исполнения сделки',
    visible: 'пользователь должен понимать, что доступ связан с ролью, организацией и рабочим допуском',
    boundary: 'не показывать служебный язык во внешнем контуре',
    next: 'пройти вход или регистрацию через доступ по заявке',
    cta: 'Открыть вход',
    href: '/platform-v7/auth',
  },
  register: {
    title: 'Заявка на доступ',
    tone: 'bank',
    status: 'заявка на доступ',
    purpose: 'собирает роль, организацию и основание доступа без обещания боевого подключения',
    visible: 'новый участник должен видеть, что это заявка на доступ, а не мгновенный запуск',
    boundary: 'не обещать боевые выплаты, активные интеграции и автоматический допуск',
    next: 'оставить заявку и пройти проверку роли/организации',
    cta: 'Открыть регистрацию',
    href: '/platform-v7/register',
  },
  deployCheck: {
    title: 'Служебная проверка',
    tone: 'warning',
    status: 'не пользовательский экран',
    purpose: 'служит только для внутренней проверки деплоя и не должен участвовать во внешней демонстрации',
    visible: 'внешний пользователь не должен воспринимать проверку деплоя как часть продукта',
    boundary: 'экран должен быть визуально и навигационно отделён как служебный',
    next: 'использовать только для внутренней проверки сборки',
    cta: 'Вернуться в платформу',
    href: '/platform-v7',
  },
};

export function SystemRouteSummary({ surface }: { surface: SystemSurface }) {
  const config = PLATFORM_V7_SYSTEM_SURFACES[surface];
  const tone = getPlatformV7ToneTokens(config.tone);
  const rows = [
    ['Назначение', config.purpose],
    ['Что видно', config.visible],
    ['Граница обещания', config.boundary],
    ['Следующий шаг', config.next],
  ] as const;

  return (
    <section
      data-testid={`platform-v7-system-surface-${surface}`}
      style={{
        display: 'grid',
        gap: PLATFORM_V7_TOKENS.spacing.md,
        border: `1px solid ${tone.border}`,
        borderRadius: PLATFORM_V7_TOKENS.radius.xl,
        background: PLATFORM_V7_TOKENS.color.surface,
        padding: PLATFORM_V7_TOKENS.spacing.lg,
        boxShadow: PLATFORM_V7_TOKENS.shadow.soft,
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: PLATFORM_V7_TOKENS.spacing.md, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs, maxWidth: 860 }}>
          <div style={{ display: 'flex', gap: PLATFORM_V7_TOKENS.spacing.xs, flexWrap: 'wrap' }}>
            <P7Badge tone={config.tone}>{config.title}</P7Badge>
            <P7Badge tone='neutral'>Контур исполнения</P7Badge>
            <P7Badge tone='neutral'>{config.status}</P7Badge>
          </div>
          <h1
            style={{
              margin: 0,
              color: PLATFORM_V7_TOKENS.color.textPrimary,
              fontSize: `clamp(22px, 5vw, ${PLATFORM_V7_TOKENS.typography.h1.size}px)`,
              lineHeight: PLATFORM_V7_TOKENS.typography.h1.lineHeight,
              fontWeight: PLATFORM_V7_TOKENS.typography.h1.weight,
              letterSpacing: PLATFORM_V7_TOKENS.typography.h1.letterSpacing,
            }}
          >
            {config.title}: рабочий контур исполнения
          </h1>
        </div>
        <Link href={config.href} style={{ ...primaryActionStyle, background: tone.fg }}>
          {config.cta}
        </Link>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
        {rows.map(([label, value]) => (
          <article key={label} style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.md, background: tone.bg, padding: PLATFORM_V7_TOKENS.spacing.sm }}>
            <div style={{ color: tone.fg, fontSize: PLATFORM_V7_TOKENS.typography.micro.size, lineHeight: PLATFORM_V7_TOKENS.typography.micro.lineHeight, fontWeight: PLATFORM_V7_TOKENS.typography.micro.weight, letterSpacing: PLATFORM_V7_TOKENS.typography.micro.letterSpacing, textTransform: 'uppercase' }}>
              {label}
            </div>
            <p style={{ margin: `${PLATFORM_V7_TOKENS.spacing.xs}px 0 0`, color: PLATFORM_V7_TOKENS.color.textPrimary, fontSize: 13, lineHeight: 1.45, fontWeight: 760 }}>
              {value}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

const primaryActionStyle = {
  textDecoration: 'none',
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '11px 14px',
  borderRadius: PLATFORM_V7_TOKENS.radius.md,
  color: PLATFORM_V7_TOKENS.color.surface,
  fontSize: 14,
  fontWeight: 850,
} as const;
