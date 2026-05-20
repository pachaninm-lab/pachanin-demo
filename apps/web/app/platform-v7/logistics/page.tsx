import Link from 'next/link';
import { RoleExecutionHandoff, type HandoffItem } from '../../../components/platform-v7/RoleExecutionHandoff';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';

const logisticsHandoff: HandoffItem[] = [
  {
    direction: 'sends',
    role: 'логистика → элеватор',
    requirement: 'передаёт данные о рейсе и водителе — ожидает подтверждения приёмки от элеватора',
    entity: 'LOG-REQ-2403',
    documentImpact: true,
  },
  {
    direction: 'awaits',
    role: 'от элеватора',
    requirement: 'ЭТрН ожидает подписи грузополучателя',
    documentImpact: true,
    moneyImpact: true,
  },
  {
    direction: 'blockedBy',
    requirement: 'СДИЗ ожидает закрытия — денежная проверка не продолжается без документа',
    documentImpact: true,
    moneyImpact: true,
  },
  {
    direction: 'next',
    requirement: 'ожидать закрытия ЭТрН подписью грузополучателя — пакет передаётся в контур документов после подтверждения',
    documentImpact: true,
  },
];

const orders = [
  {
    id: 'LOG-REQ-2403',
    dealId: 'DL-9106',
    lotId: 'LOT-2403',
    crop: 'Пшеница 4 класса',
    volume: '600 т',
    route: 'Тамбовская область → Элеватор ВРЖ-08',
    status: 'Водитель назначен',
    driver: 'Водитель А',
    driverStatus: 'в пути',
    driverLocation: '52.6671, 41.4479 · 62% маршрута',
    driverUpdated: '14:28',
    vehicle: 'Р***ТУ',
    arrivalTime: '14:28',
    progress: '62%',
    incidents: 'нет',
    etrn: 'ЭТрН · ждёт подписи грузополучателя',
    gisEpd: 'ГИС ЭПД · ожидает передачи после подписи',
    fgis: 'ФГИС «Зерно» · СДИЗ ожидает подтверждения',
    docs: 'транспортный пакет на проверке',
    next: 'контроль прибытия и подписи ЭТрН',
    href: '/platform-v7/driver/field',
  },
  {
    id: 'LOG-9102',
    dealId: 'DL-9102',
    lotId: 'LOT-2402',
    crop: 'Ячмень 2 класса',
    volume: '180 т',
    route: 'Воронежская область → Курская область',
    status: 'Прибыл',
    driver: 'Водитель Б',
    driverStatus: 'на приёмке',
    driverLocation: 'Элеватор назначения · прибыл',
    driverUpdated: '14:28',
    vehicle: 'С***АА',
    arrivalTime: 'прибыл 14:28',
    progress: '100%',
    incidents: 'есть отклонение веса',
    etrn: 'ЭТрН · подписана перевозчиком',
    gisEpd: 'ГИС ЭПД · принята в пилотном контуре',
    fgis: 'ФГИС «Зерно» · СДИЗ отмечен в пилотном контуре',
    docs: 'акт расхождения не подписан',
    next: 'закрыть инцидент и акт удержания',
    href: '/platform-v7/driver/field',
  },
  {
    id: 'LOG-9103',
    dealId: 'DL-9103',
    lotId: 'LOT-2407',
    crop: 'Кукуруза 1 класса',
    volume: '360 т',
    route: 'Курская область → Белгородская область',
    status: 'Ожидает погрузки',
    driver: 'не назначен',
    driverStatus: 'нет водителя',
    driverLocation: '—',
    driverUpdated: '—',
    vehicle: '—',
    arrivalTime: '7–14 дней',
    progress: '0%',
    incidents: 'нет',
    etrn: 'ЭТрН · не создана',
    gisEpd: 'ГИС ЭПД · не отправлено',
    fgis: 'ФГИС «Зерно» · партия ожидает сверки',
    docs: 'не создан рейс',
    next: 'назначить водителя и создать ЭТрН',
    href: '/platform-v7/logistics/inbox',
  },
] as const;

const gates = [
  { title: 'ЭТрН', value: '1 ждёт подписи · 1 подписана · 1 не создана', state: 'stop' },
  { title: 'ГИС ЭПД', value: 'передача после подписания ЭТрН', state: 'wait' },
  { title: 'ФГИС «Зерно»', value: 'СДИЗ влияет на проверку выплаты', state: 'stop' },
  { title: 'GPS-контур', value: '2 водителя в тестовом сценарии', state: 'ok' },
] as const;

export default function LogisticsPage() {
  const inTransit = orders.filter((order) => order.status === 'Водитель назначен').length;
  const arrived = orders.filter((order) => order.status === 'Прибыл').length;
  const incidents = orders.filter((order) => order.incidents !== 'нет').length;
  const assignedDrivers = orders.filter((order) => order.driver !== 'не назначен');

  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <QuietIntelligenceHint
        problem='ЭТрН по LOG-REQ-2403 ожидает подписи грузополучателя — пакет не передаётся в ГИС ЭПД.'
        action='Проконтролировать прибытие и инициировать подпись ЭТрН на элеваторе.'
        outcome='После подписи ЭТрН пакет уйдёт в ГИС ЭПД и деньги продолжат движение.'
      />
      <section style={hero}>
        <div style={badge}>Кабинет логистики</div>
        <h1 style={h1}>Заявки, водители, ЭТрН и маршрут</h1>
        <p style={lead}>Логистика видит исполнение перевозки: заявку, сделку, водителя, машину, маршрут, срок прибытия, ЭТрН, ГИС ЭПД, СДИЗ и инциденты. Деньги и предложения не раскрываются.</p>
        <div style={actions}>
          <Link href='/platform-v7/logistics/inbox' style={primaryBtn}>Входящие заявки</Link>
          <Link href='/platform-v7/driver/field' style={ghostBtn}>Открыть рейс водителя</Link>
        </div>
        <TrustDot state='test' size='sm' label='Тестовый контур · ЭТрН и ГИС ЭПД требуют договоров' />
      </section>

      <section style={metricsGrid}>
        <Metric label='В пути' value={String(inTransit)} />
        <Metric label='Прибыли' value={String(arrived)} good />
        <Metric label='Инцидентов' value={String(incidents)} danger={incidents > 0} />
        <Metric label='Заказов' value={String(orders.length)} />
      </section>

      <CauseLine
        cause={{ text: 'ЭТрН не подписан грузополучателем', tone: 'blocked' }}
        relation='blocks'
        effect={{ text: 'Пакет не уходит в ГИС ЭПД', tone: 'blocked' }}
        moneyAmount='9,65 млн ₽'
        moneyTone='hold'
      />
      <CauseLine
        cause={{ text: 'СДИЗ ожидает подтверждения ФГИС «Зерно»', tone: 'warning' }}
        relation='blocks'
        effect={{ text: 'Денежная проверка приостановлена', tone: 'warning' }}
        moneyAmount='9,65 млн ₽'
        moneyTone='hold'
      />

      <SmartSectionSummary
        label='Статус рейсов'
        items={[
          { text: 'LOG-REQ-2403 · Водитель в пути (62%) · ЭТрН ждёт подписи', tone: 'warn' },
          { text: 'LOG-9102 · Прибыл · Акт расхождения не подписан', tone: 'warn' },
        ]}
      />

      <RoleExecutionHandoff items={logisticsHandoff} title='исполнение: что логистика отправляет и ожидает' />

      <section style={card}>
        <div style={micro}>Документные условия перевозки</div>
        <div style={gateGrid}>
          {gates.map((gate) => <Gate key={gate.title} gate={gate} />)}
        </div>
      </section>

      <section style={card}>
        <div style={micro}>Водители на линии</div>
        {assignedDrivers.map((order) => <DriverCard key={`driver-${order.id}`} order={order} />)}
      </section>

      <section style={card}>
        <div style={micro}>Текущая очередь заказов</div>
        {orders.map((order) => <OrderCard key={order.id} order={order} />)}
      </section>
    </main>
  );
}

function Gate({ gate }: { gate: typeof gates[number] }) {
  return (
    <div style={{ background: stateBg(gate.state), border: `1px solid ${stateBorder(gate.state)}`, borderRadius: 18, padding: 14, boxShadow: '0 10px 24px rgba(15,23,42,0.045)' }}>
      <div style={{ ...micro, color: stateText(gate.state) }}>{gate.title}</div>
      <div style={{ marginTop: 6, color: '#0F1419', fontSize: 13, lineHeight: 1.4, fontWeight: 900 }}>{gate.value}</div>
    </div>
  );
}

function DriverCard({ order }: { order: typeof orders[number] }) {
  const hasIncident = order.incidents !== 'нет';
  return (
    <Link href='/platform-v7/driver/field' style={{ textDecoration: 'none', color: 'inherit', background: order.status === 'Водитель назначен' ? 'linear-gradient(180deg,#FFFFFF 0%,#F0FDF4 100%)' : 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: `1px solid ${hasIncident ? 'rgba(220,38,38,0.18)' : 'rgba(10,122,95,0.18)'}`, borderRadius: 22, padding: 16, display: 'grid', gap: 12, boxShadow: '0 12px 30px rgba(15,23,42,0.055)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#0A7A5F', fontSize: 13, fontWeight: 950 }}>{order.driver} · {order.vehicle}</div>
          <h2 style={h2}>{order.driverStatus}</h2>
          <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 13 }}>Заказ {order.id} · сделка {order.dealId}</p>
        </div>
        <span style={hasIncident ? dangerStatus : status}>{hasIncident ? 'инцидент' : order.status}</span>
      </div>
      <div style={twoColGrid}>
        <Cell label='Где водитель' value={order.driverLocation} strong={!hasIncident} />
        <Cell label='На каком заказе' value={`${order.id} · ${order.crop}`} />
        <Cell label='Последнее событие' value={order.driverUpdated} />
        <Cell label='ЭТрН' value={order.etrn} danger={order.etrn.includes('ждёт') || order.etrn.includes('не создана')} />
        <Cell label='ГИС ЭПД' value={order.gisEpd} danger={order.gisEpd.includes('ожидает') || order.gisEpd.includes('не отправлено')} />
      </div>
      <div style={{ background: hasIncident ? 'rgba(220,38,38,0.08)' : 'rgba(10,122,95,0.06)', border: `1px solid ${hasIncident ? 'rgba(220,38,38,0.18)' : 'rgba(10,122,95,0.18)'}`, borderRadius: 15, padding: 12, color: hasIncident ? '#B91C1C' : '#0A7A5F', fontSize: 13, fontWeight: 900 }}>
        Следующее действие логиста: {order.next}
      </div>
    </Link>
  );
}

function OrderCard({ order }: { order: typeof orders[number] }) {
  const hasIncident = order.incidents !== 'нет';
  const isActive = order.status === 'Водитель назначен';
  return (
    <Link href={order.href} style={{ textDecoration: 'none', color: 'inherit', background: isActive ? 'linear-gradient(180deg,#FFFFFF 0%,#F0FDF4 100%)' : 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: `1px solid ${isActive ? 'rgba(10,122,95,0.2)' : '#E4E6EA'}`, borderRadius: 22, padding: 16, display: 'grid', gap: 12, boxShadow: '0 12px 30px rgba(15,23,42,0.055)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#0A7A5F', fontSize: 13, fontWeight: 950 }}>{order.id} → {order.dealId}</div>
          <h2 style={h2}>{order.crop} · {order.volume}</h2>
          <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 13 }}>{order.route}</p>
        </div>
        <span style={isActive ? status : neutralStatus}>{order.status}</span>
      </div>

      <div style={twoColGrid}>
        <Cell label='Водитель' value={order.driver} />
        <Cell label='Где водитель' value={order.driverLocation} strong={isActive} />
        <Cell label='Заказ' value={order.id} />
        <Cell label='Машина' value={order.vehicle} />
        <Cell label='Срок прибытия' value={order.arrivalTime} strong={isActive} />
        <Cell label='Прогресс' value={order.progress} strong={isActive} />
        <Cell label='ЭТрН' value={order.etrn} danger={order.etrn.includes('ждёт') || order.etrn.includes('не создана')} />
        <Cell label='СДИЗ' value={order.fgis} danger={order.fgis.includes('ожидает')} />
        <Cell label='Документы' value={order.docs} danger={order.docs.includes('не')} />
        <Cell label='Инциденты' value={order.incidents} danger={hasIncident} />
      </div>

      <div style={{ background: hasIncident ? 'rgba(220,38,38,0.08)' : 'rgba(10,122,95,0.06)', border: `1px solid ${hasIncident ? 'rgba(220,38,38,0.18)' : 'rgba(10,122,95,0.18)'}`, borderRadius: 15, padding: 12, color: hasIncident ? '#B91C1C' : '#0A7A5F', fontSize: 13, fontWeight: 900 }}>
        Следующее действие: {order.next}
      </div>
    </Link>
  );
}

function Metric({ label, value, good = false, danger = false }: { label: string; value: string; good?: boolean; danger?: boolean }) {
  return (
    <div style={metricCard}>
      <div style={micro}>{label}</div>
      <div style={{ marginTop: 8, color: danger ? '#B91C1C' : good ? '#0A7A5F' : '#0F1419', fontSize: 29, lineHeight: 1, fontWeight: 950, letterSpacing: '-0.035em' }}>{value}</div>
    </div>
  );
}

function Cell({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div style={cell}>
      <div style={micro}>{label}</div>
      <div style={{ marginTop: 4, color: danger ? '#B91C1C' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.3, fontWeight: 900, overflowWrap: 'break-word' }}>{value}</div>
    </div>
  );
}

function stateBg(state: string) {
  if (state === 'ok') return 'linear-gradient(180deg,#FFFFFF 0%,#F0FDF4 100%)';
  if (state === 'stop') return 'linear-gradient(180deg,#FFFFFF 0%,#FEF2F2 100%)';
  return 'linear-gradient(180deg,#FFFFFF 0%,#FFFBEB 100%)';
}
function stateBorder(state: string) {
  if (state === 'ok') return 'rgba(10,122,95,0.18)';
  if (state === 'stop') return 'rgba(220,38,38,0.18)';
  return 'rgba(217,119,6,0.18)';
}
function stateText(state: string) {
  if (state === 'ok') return '#0A7A5F';
  if (state === 'stop') return '#B91C1C';
  return '#B45309';
}

const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 58%,#EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 28, padding: 24, display: 'grid', gap: 12, boxShadow: '0 18px 44px rgba(15,23,42,0.08)' } as const;
const card = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12, boxShadow: '0 14px 34px rgba(15,23,42,0.055)' } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '6px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.025em' } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.6 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const metricCard = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 20, padding: 16, boxShadow: '0 12px 28px rgba(15,23,42,0.055)' } as const;
const gateGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8 } as const;
const twoColGrid = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 14, padding: 10, minWidth: 0, boxShadow: '0 8px 18px rgba(15,23,42,0.035)' } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 900, boxShadow: '0 14px 30px rgba(10,122,95,0.18)' } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850, boxShadow: '0 10px 24px rgba(15,23,42,0.06)' } as const;
const status = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const neutralStatus = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 900 } as const;
const dangerStatus = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 12, fontWeight: 900 } as const;
