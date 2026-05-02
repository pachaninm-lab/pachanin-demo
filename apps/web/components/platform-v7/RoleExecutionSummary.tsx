'use client';

import Link from 'next/link';
import { MoneyTreeStrip } from '@/components/platform-v7/MoneyTreeStrip';

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
  now: string;
  blocked: string;
  money: string;
  documents: string;
  execution: string;
  next: string;
  cta: string;
  href: string;
};

const MONEY_TREE_ROLES: ReadonlySet<PlatformV7ExecutionRole> = new Set(['seller', 'buyer', 'bank', 'operator']);

export const PLATFORM_V7_ROLE_EXECUTION_SUMMARIES: Record<PlatformV7ExecutionRole, RoleExecutionSummaryConfig> = {
  seller: {
    title: 'Продавец',
    now: 'по лотам есть предложения и сделки в исполнении',
    blocked: 'часть денег зависит от документов, спора или приёмки',
    money: 'резерв и удержание видны по связанным сделкам',
    documents: 'партии ФГИС, паспорт и пакет сделки требуют сверки',
    execution: 'отгрузка и приёмка показываются через сделки',
    next: 'продавец или оператор',
    cta: 'Открыть предложения',
    href: '/platform-v7/seller/offers',
  },
  buyer: {
    title: 'Покупатель',
    now: 'доступны лоты, ставки и принятые предложения',
    blocked: 'резерв, приёмка или документы могут остановить выпуск',
    money: 'резерв виден только по вашим сделкам',
    documents: 'пакет сделки и приёмки показывает, что ещё нужно закрыть',
    execution: 'логистика и приёмка идут после принятого предложения',
    next: 'покупатель, оператор или получатель груза',
    cta: 'Сделать ставку',
    href: '/platform-v7/buyer',
  },
  logistics: {
    title: 'Логистика',
    now: 'заявки, машины, водители и рейсы собраны в рабочую очередь',
    blocked: 'отклонения ETA, GPS, пломбы или веса требуют реакции',
    money: 'цена зерна и банковский резерв не раскрываются',
    documents: 'видны только транспортные документы по рейсу',
    execution: 'маршрут, машина, водитель и статус рейса на первом экране',
    next: 'диспетчер или водитель',
    cta: 'Открыть рейс',
    href: '/platform-v7/logistics',
  },
  driver: {
    title: 'Водитель',
    now: 'один активный рейс и одно следующее действие',
    blocked: 'нет связи или не отправлены фото, пломба, вес или прибытие',
    money: 'денежные данные скрыты от водителя',
    documents: 'видны только документы рейса',
    execution: 'маршрут, GPS, фото, пломба и вес связаны с рейсом',
    next: 'водитель',
    cta: 'Открыть рейс водителя',
    href: '/platform-v7/driver/field',
  },
  elevator: {
    title: 'Элеватор',
    now: 'машины проходят очередь, погрузку, вес и пломбу',
    blocked: 'расхождение веса, пломбы или документов создаёт остановку',
    money: 'деньги не управляются на экране элеватора',
    documents: 'видны документы отгрузки и приёмки',
    execution: 'машина, водитель, партия и фактический вес на первом экране',
    next: 'элеватор или оператор',
    cta: 'Зафиксировать вес',
    href: '/platform-v7/elevator',
  },
  lab: {
    title: 'Лаборатория',
    now: 'пробы ждут результата, протокола или повторной проверки',
    blocked: 'отклонение качества может остановить документы и деньги',
    money: 'лаборатория не выпускает и не удерживает деньги',
    documents: 'протокол качества привязан к сделке и спору',
    execution: 'качество влияет на приёмку и основание для решения',
    next: 'лаборатория, арбитр или оператор',
    cta: 'Загрузить протокол',
    href: '/platform-v7/lab',
  },
  surveyor: {
    title: 'Сюрвейер',
    now: 'назначены проверки, фото и акт осмотра',
    blocked: 'неполный акт или фото не дают закрыть доказательства',
    money: 'денежные действия скрыты от сюрвейера',
    documents: 'акт, фото и подписи входят в доказательный пакет',
    execution: 'осмотр связан с рейсом, партией и спором',
    next: 'сюрвейер или оператор',
    cta: 'Открыть назначение',
    href: '/platform-v7/surveyor',
  },
  bank: {
    title: 'Банк',
    now: 'сделки ждут резерв, удержание, проверку или подтверждение выпуска',
    blocked: 'выпуск денег останавливают документы, спор или ручная проверка',
    money: 'резерв, к выпуску и удержание показаны как части одного контура',
    documents: 'основания выпуска видны через пакет сделки',
    execution: 'рейс и приёмка учитываются только как основание',
    next: 'банк или оператор',
    cta: 'Открыть проверку выпуска',
    href: '/platform-v7/bank',
  },
  arbitrator: {
    title: 'Арбитр',
    now: 'открытые споры ждут доказательства или решение',
    blocked: 'спор нельзя закрыть без основания и журнала действий',
    money: 'сумма под риском связана с удержанием',
    documents: 'фото, GPS, вес, пломба, лаборатория и документы собраны в пакет',
    execution: 'решение влияет на удержание или выпуск денег',
    next: 'арбитр или сторона сделки',
    cta: 'Запросить доказательство',
    href: '/platform-v7/arbitrator',
  },
  compliance: {
    title: 'Комплаенс',
    now: 'стороны проходят допуск, полномочия и документную проверку',
    blocked: 'стоп-фактор без причины нельзя закрыть вручную',
    money: 'комплаенс-стоп может блокировать выпуск денег',
    documents: 'учредительные документы, полномочия и реквизиты проверяются отдельно',
    execution: 'допуск связан с конкретными сделками',
    next: 'комплаенс или оператор',
    cta: 'Запросить документы',
    href: '/platform-v7/compliance',
  },
  operator: {
    title: 'Оператор',
    now: 'очередь показывает сделки, которые требуют действия сейчас',
    blocked: 'причина остановки, деньги, документы и SLA вынесены наверх',
    money: 'к выпуску, под удержанием и под риском сверяются по сделкам',
    documents: 'видно, кто должен загрузить или подписать пакет',
    execution: 'транспорт, приёмка, спор и банк собраны в один контур',
    next: 'ответственная роль по каждой строке очереди',
    cta: 'Открыть очередь действий',
    href: '/platform-v7/control-tower',
  },
  executive: {
    title: 'Руководитель',
    now: 'видна сводка по обороту, рискам, SLA и зрелости контура',
    blocked: 'ручные действия и внешние подключения не скрываются',
    money: 'экономика и деньги под риском показаны отдельно',
    documents: 'документные стопы входят в общий риск',
    execution: 'операционная зрелость читается по всей цепочке сделки',
    next: 'оператор или владелец контура',
    cta: 'Открыть сводку',
    href: '/platform-v7/executive',
  },
  investor: {
    title: 'Инвестор',
    now: 'показаны зрелость, traction, риски и экономика пилотного контура',
    blocked: 'боевые подключения и ручные действия показаны честно',
    money: 'GMV, unit economics и спорные суммы отделены от обещаний',
    documents: 'готовность документов влияет на зрелость исполнения',
    execution: 'демо, пилот и внешние подключения не смешиваются',
    next: 'команда продукта',
    cta: 'Открыть инвесторский режим',
    href: '/platform-v7/investor',
  },
};

export function RoleExecutionSummary({ role }: { role: PlatformV7ExecutionRole }) {
  const summary = PLATFORM_V7_ROLE_EXECUTION_SUMMARIES[role];
  const rows = [
    ['Что происходит сейчас', summary.now],
    ['Что заблокировано', summary.blocked],
    ['Где деньги', summary.money],
    ['Где документы', summary.documents],
    ['Где груз / исполнение', summary.execution],
    ['Кто следующий', summary.next],
  ];

  return (
    <section data-testid={`role-execution-summary-${role}`} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ролевой контур исполнения</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 24, lineHeight: 1.12, fontWeight: 950, color: '#0F1419' }}>{summary.title}</h1>
        </div>
        <Link href={summary.href} style={{ textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 850 }}>
          {summary.cta}
        </Link>
      </div>

      <div data-testid="platform-v7-role-workspace-hint" style={{ border: '1px solid #DDE7F0', background: '#F8FBFF', borderRadius: 12, padding: 10, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, lineHeight: 1.45, color: '#334155', fontWeight: 750 }}>
          Рабочий экран роли: {summary.title}. Основное действие — {summary.cta.toLowerCase()}.
        </div>
        <Link href={summary.href} style={{ textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderRadius: 10, background: '#fff', color: '#0F1419', border: '1px solid #CBD5E1', fontSize: 12, fontWeight: 850 }}>
          Открыть экран
        </Link>
      </div>

      {MONEY_TREE_ROLES.has(role) ? <MoneyTreeStrip /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ border: '1px solid #EEF1F4', borderRadius: 12, background: '#F8FAFB', padding: 10, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.055em', fontWeight: 900 }}>{label}</div>
            <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: '#0F1419', fontWeight: 750 }}>{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
