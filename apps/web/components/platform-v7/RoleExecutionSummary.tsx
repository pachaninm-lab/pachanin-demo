'use client';

import Link from 'next/link';
import { MoneyTreeStrip } from '@/components/platform-v7/MoneyTreeStrip';
import { P7Badge } from '@/components/platform-v7/P7Badge';
import { PLATFORM_V7_TOKENS, getPlatformV7ToneTokens, type PlatformV7Tone } from '@/lib/platform-v7/design/tokens';

export type PlatformV7ExecutionRole =
  | 'seller'
  | 'buyer'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'surveyor'
  | 'bank'
  | 'arbitrator'
  | 'compliance'
  | 'operator'
  | 'executive'
  | 'investor';

type RoleExecutionSummaryConfig = {
  title: string;
  tone: PlatformV7Tone;
  mode: 'commercial' | 'field' | 'audit' | 'money' | 'operations' | 'partner';
  now: string;
  blocked: string;
  money: string;
  documents: string;
  execution: string;
  next: string;
  cta: string;
  href: string;
  hidden: string;
};

const MONEY_TREE_ROLES: ReadonlySet<PlatformV7ExecutionRole> = new Set(['seller', 'buyer', 'bank', 'operator']);

export const PLATFORM_V7_ROLE_EXECUTION_SUMMARIES: Record<PlatformV7ExecutionRole, RoleExecutionSummaryConfig> = {
  seller: {
    title: 'Продавец',
    tone: 'success',
    mode: 'commercial',
    now: 'LOT-2403: победитель выбран, сделка DL-9106 создана, выпуск денег ещё закрыт',
    blocked: 'выплату останавливают СДИЗ, транспортный пакет, приёмка, качество и спор',
    money: 'продавец видит резерв и к выплате, но не видит кредитную линию покупателя',
    documents: 'СДИЗ, ЭТрН, УПД, акт, КЭП и качество показываются как условия выплаты',
    execution: 'лот → ставка → сделка → логистика → рейс → приёмка → документы → деньги',
    next: 'продавец закрывает документы, оператор ведёт блокер, логистика ведёт рейс',
    cta: 'Открыть предложения',
    href: '/platform-v7/seller/offers',
    hidden: 'скрыто: кредит покупателя, чужие закрытые ставки, банковая внутренняя логика',
  },
  buyer: {
    title: 'Покупатель',
    tone: 'money',
    mode: 'commercial',
    now: 'LOT-2403: собственная ставка принята, DL-9106 ждёт подтверждения резерва',
    blocked: 'резерв, СДИЗ, ЭТрН, приёмка и качество могут остановить выплату продавцу',
    money: 'покупатель видит свой резерв и кредитный сценарий, продавец видит только готовность денег',
    documents: 'видны документы сделки, влияющие на приёмку и закрытие расчёта',
    execution: 'ставка → резерв → логистика → приёмка → выпуск / удержание',
    next: 'покупатель подтверждает резерв или закрывает условие банка',
    cta: 'Открыть покупку',
    href: '/platform-v7/buyer',
    hidden: 'скрыто: чужие закрытые ставки и лишние данные продавца вне допуска',
  },
  logistics: {
    title: 'Логистика',
    tone: 'logistics',
    mode: 'field',
    now: 'после выбора победителя заявка LOG-REQ-2403 пришла в диспетчерскую',
    blocked: 'ETA, водитель, пломба, ЭТрН, ГИС ЭПД или инцидент рейса требуют реакции',
    money: 'цена зерна, ставки, резерв, банк и кредит не раскрываются логистике',
    documents: 'видны только документы рейса: ЭТрН, транспортный пакет, статус ГИС ЭПД',
    execution: 'заявка → машина → водитель → маршрут → прибытие → приёмка',
    next: 'логист контролирует прибытие, подписи и инциденты рейса',
    cta: 'Открыть рейс',
    href: '/platform-v7/logistics',
    hidden: 'скрыто: цена зерна, банковский резерв, кредит и закрытые ставки',
  },
  driver: {
    title: 'Водитель',
    tone: 'logistics',
    mode: 'field',
    now: 'TRIP-SIM-001: один активный рейс, маршрут и одно следующее действие',
    blocked: 'нет связи, не отправлены фото, пломба, прибытие, вес или проблема',
    money: 'деньги, ставки, банк, покупатель и кредит скрыты от водителя',
    documents: 'видны только документы своего рейса и транспортные подтверждения',
    execution: 'маршрут, GPS, фото, пломба, проблема и офлайн-очередь связаны с рейсом',
    next: 'водитель подтверждает ближайшее полевое действие',
    cta: 'Открыть рейс водителя',
    href: '/platform-v7/driver/field',
    hidden: 'скрыто: деньги, ставки, банк, покупатель, кредит, чужие рейсы',
  },
  elevator: {
    title: 'Элеватор',
    tone: 'warning',
    mode: 'field',
    now: 'TRIP-SIM-001 прибыл: фиксируются вес, качество, акт и отклонения',
    blocked: 'расхождение веса, качества, пломбы или акта создаёт удержание и спор',
    money: 'деньги, ставки, банк, резерв и кредит не управляются на экране приёмки',
    documents: 'акт приёмки, акт расхождения и протокол качества влияют на выплату',
    execution: 'рейс → вес → качество → акт → документы → основание для выплаты / удержания',
    next: 'элеватор фиксирует факт, лаборатория закрывает качество, оператор ведёт блокер',
    cta: 'Зафиксировать вес',
    href: '/platform-v7/elevator',
    hidden: 'скрыто: ставки, цена, банк, резерв, кредит, чужая коммерческая аналитика',
  },
  lab: {
    title: 'Лаборатория',
    tone: 'document',
    mode: 'audit',
    now: 'пробы ждут результата, протокола или повторной проверки',
    blocked: 'отклонение качества может остановить документы и деньги',
    money: 'лаборатория не выпускает и не удерживает деньги',
    documents: 'протокол качества привязан к сделке и спору',
    execution: 'качество влияет на приёмку и основание для решения',
    next: 'лаборатория, арбитр или оператор',
    cta: 'Загрузить протокол',
    href: '/platform-v7/lab',
    hidden: 'скрыто: коммерческие ставки, кредит и банковские действия',
  },
  surveyor: {
    title: 'Сюрвейер',
    tone: 'evidence',
    mode: 'field',
    now: 'назначены проверки, фото и акт осмотра',
    blocked: 'неполный акт или фото не дают закрыть доказательства',
    money: 'денежные действия скрыты от сюрвейера',
    documents: 'акт, фото и подписи входят в доказательный пакет',
    execution: 'осмотр связан с рейсом, партией и спором',
    next: 'сюрвейер или оператор',
    cta: 'Открыть назначение',
    href: '/platform-v7/surveyor',
    hidden: 'скрыто: банковские действия и коммерческие ставки',
  },
  bank: {
    title: 'Банк',
    tone: 'bank',
    mode: 'money',
    now: 'сделки ждут резерв, удержание, проверку или подтверждение выпуска',
    blocked: 'выпуск денег останавливают документы, спор или ручная проверка',
    money: 'резерв, к выпуску и удержание показаны как части одного контура',
    documents: 'основания выпуска видны через пакет сделки',
    execution: 'рейс и приёмка учитываются только как основание',
    next: 'банк или оператор',
    cta: 'Открыть проверку выпуска',
    href: '/platform-v7/bank',
    hidden: 'скрыто: фальшивая выплата без закрытых условий',
  },
  arbitrator: {
    title: 'Арбитр',
    tone: 'dispute',
    mode: 'audit',
    now: 'открытые споры ждут доказательства или решение',
    blocked: 'спор нельзя закрыть без основания и журнала действий',
    money: 'сумма под риском связана с удержанием',
    documents: 'фото, GPS, вес, пломба, лаборатория и документы собраны в пакет',
    execution: 'решение влияет на удержание или выпуск денег',
    next: 'арбитр или сторона сделки',
    cta: 'Запросить доказательство',
    href: '/platform-v7/arbitrator',
    hidden: 'скрыто: устное решение без evidence pack и журнала',
  },
  compliance: {
    title: 'Комплаенс',
    tone: 'document',
    mode: 'audit',
    now: 'стороны проходят допуск, полномочия и документную проверку',
    blocked: 'стоп-фактор без причины нельзя закрыть вручную',
    money: 'комплаенс-стоп может блокировать выпуск денег',
    documents: 'учредительные документы, полномочия и реквизиты проверяются отдельно',
    execution: 'допуск связан с конкретными сделками',
    next: 'комплаенс или оператор',
    cta: 'Запросить документы',
    href: '/platform-v7/compliance',
    hidden: 'скрыто: ручной обход допуска без основания',
  },
  operator: {
    title: 'Оператор',
    tone: 'dispute',
    mode: 'operations',
    now: 'очередь показывает сделки, которые требуют действия сейчас',
    blocked: 'причина остановки, деньги, документы и SLA вынесены наверх',
    money: 'к выпуску, под удержанием и под риском сверяются по сделкам',
    documents: 'видно, кто должен загрузить или подписать пакет',
    execution: 'транспорт, приёмка, спор и банк собраны в один контур',
    next: 'ответственная роль по каждой строке очереди',
    cta: 'Открыть очередь действий',
    href: '/platform-v7/control-tower',
    hidden: 'скрыто: тихое ручное редактирование без следа',
  },
  executive: {
    title: 'Руководитель',
    tone: 'info',
    mode: 'partner',
    now: 'видна сводка по обороту, рискам, SLA и зрелости контура',
    blocked: 'ручные действия и внешние подключения не скрываются',
    money: 'экономика и деньги под риском показаны отдельно',
    documents: 'документные стопы входят в общий риск',
    execution: 'операционная зрелость читается по всей цепочке сделки',
    next: 'оператор или владелец контура',
    cta: 'Открыть сводку',
    href: '/platform-v7/executive',
    hidden: 'скрыто: неподтверждённые claims зрелости',
  },
  investor: {
    title: 'Инвестор',
    tone: 'info',
    mode: 'partner',
    now: 'показаны зрелость, traction, риски и экономика пилотного контура',
    blocked: 'боевые подключения и ручные действия показаны честно',
    money: 'GMV, unit economics и спорные суммы отделены от обещаний',
    documents: 'готовность документов влияет на зрелость исполнения',
    execution: 'демо, пилот и внешние подключения не смешиваются',
    next: 'команда продукта',
    cta: 'Открыть инвесторский режим',
    href: '/platform-v7/investor',
    hidden: 'скрыто: production-ready и live-integrated claims без подтверждения',
  },
};

export function RoleExecutionSummary({ role }: { role: PlatformV7ExecutionRole }) {
  const summary = PLATFORM_V7_ROLE_EXECUTION_SUMMARIES[role];
  const tone = getPlatformV7ToneTokens(summary.tone);
  const rows = [
    ['Что происходит сейчас', summary.now],
    ['Что заблокировано', summary.blocked],
    ['Где деньги', summary.money],
    ['Где документы', summary.documents],
    ['Где груз / исполнение', summary.execution],
    ['Кто следующий', summary.next],
  ];

  return (
    <section
      data-testid={`role-execution-summary-${role}`}
      style={{
        background: PLATFORM_V7_TOKENS.color.surface,
        border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
        borderRadius: PLATFORM_V7_TOKENS.radius.xl,
        padding: PLATFORM_V7_TOKENS.spacing.lg,
        display: 'grid',
        gap: PLATFORM_V7_TOKENS.spacing.md,
        boxShadow: PLATFORM_V7_TOKENS.shadow.soft,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: PLATFORM_V7_TOKENS.spacing.md, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs, maxWidth: 820 }}>
          <div style={{ display: 'flex', gap: PLATFORM_V7_TOKENS.spacing.xs, flexWrap: 'wrap', alignItems: 'center' }}>
            <P7Badge tone={summary.tone}>{summary.title}</P7Badge>
            <P7Badge tone='neutral'>{modeLabel(summary.mode)}</P7Badge>
            <P7Badge tone='warning'>controlled-pilot</P7Badge>
          </div>
          <h1
            style={{
              margin: 0,
              color: PLATFORM_V7_TOKENS.color.textPrimary,
              fontSize: `clamp(24px, 5vw, ${PLATFORM_V7_TOKENS.typography.h1.size}px)`,
              lineHeight: PLATFORM_V7_TOKENS.typography.h1.lineHeight,
              fontWeight: PLATFORM_V7_TOKENS.typography.h1.weight,
              letterSpacing: PLATFORM_V7_TOKENS.typography.h1.letterSpacing,
            }}
          >
            {summary.title}: деньги, документы, груз, блокер и следующий шаг
          </h1>
          <div style={{ color: PLATFORM_V7_TOKENS.color.textSecondary, fontSize: PLATFORM_V7_TOKENS.typography.body.size, lineHeight: PLATFORM_V7_TOKENS.typography.body.lineHeight, maxWidth: 760 }}>
            {summary.hidden}
          </div>
        </div>
        <Link href={summary.href} style={{ ...primaryActionStyle, background: tone.fg }}>
          {summary.cta}
        </Link>
      </div>

      <div data-testid="platform-v7-role-workspace-hint" style={{ border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: PLATFORM_V7_TOKENS.radius.lg, padding: PLATFORM_V7_TOKENS.spacing.sm, display: 'flex', gap: PLATFORM_V7_TOKENS.spacing.sm, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, lineHeight: 1.45, color: PLATFORM_V7_TOKENS.color.textPrimary, fontWeight: 760 }}>
          Рабочий экран роли: {summary.title}. Основное действие — {summary.cta.toLowerCase()}. Никаких лишних данных за пределами роли.
        </div>
        <Link href={summary.href} style={secondaryActionStyle}>
          Открыть экран
        </Link>
      </div>

      {MONEY_TREE_ROLES.has(role) ? <MoneyTreeStrip /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.md, background: PLATFORM_V7_TOKENS.color.surfaceMuted, padding: PLATFORM_V7_TOKENS.spacing.sm, minWidth: 0 }}>
            <div style={{ fontSize: PLATFORM_V7_TOKENS.typography.micro.size, color: PLATFORM_V7_TOKENS.color.textMuted, textTransform: 'uppercase', letterSpacing: PLATFORM_V7_TOKENS.typography.micro.letterSpacing, fontWeight: PLATFORM_V7_TOKENS.typography.micro.weight }}>{label}</div>
            <div style={{ marginTop: PLATFORM_V7_TOKENS.spacing.xxs, fontSize: 13, lineHeight: 1.45, color: PLATFORM_V7_TOKENS.color.textPrimary, fontWeight: 760 }}>{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function modeLabel(mode: RoleExecutionSummaryConfig['mode']): string {
  switch (mode) {
    case 'commercial':
      return 'коммерческий контур';
    case 'field':
      return 'полевой контур';
    case 'audit':
      return 'доказательный контур';
    case 'money':
      return 'денежный контур';
    case 'operations':
      return 'операционный контур';
    case 'partner':
    default:
      return 'партнёрский контур';
  }
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

const secondaryActionStyle = {
  textDecoration: 'none',
  minHeight: 40,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 12px',
  borderRadius: PLATFORM_V7_TOKENS.radius.sm,
  background: PLATFORM_V7_TOKENS.color.surface,
  color: PLATFORM_V7_TOKENS.color.textPrimary,
  border: `1px solid ${PLATFORM_V7_TOKENS.color.borderStrong}`,
  fontSize: 12,
  fontWeight: 850,
} as const;
