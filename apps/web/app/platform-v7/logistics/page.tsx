import Link from 'next/link';
import { getShipments, activeShipmentCount, shipmentsWithBlockers } from '@/lib/logistics-server';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { RoleExecutionCockpitPage } from '@/components/platform-v7/RoleExecutionCockpit';
import { RoleExecutionHandoff, type HandoffItem } from '../../../components/platform-v7/RoleExecutionHandoff';
import { OPERATIONAL_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';
import { formatTons, selectDealLogisticsTripPlan } from '@/lib/platform-v7/deal-execution-source-of-truth';

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

type GateState = 'ok' | 'wait' | 'stop';

interface GateItem {
  readonly title: string;
  readonly value: string;
  readonly state: GateState;
}

export default async function LogisticsPage() {
  const shipments = await getShipments();
  const shipmentCount = activeShipmentCount(shipments);
  const blockedShipments = shipmentsWithBlockers(shipments);
  const apiOnline = shipments.some((s) => !s.id.startsWith('SHIP-00'));

  const liveBlockers = blockedShipments.slice(0, 3).map((s) => ({
    id: s.id,
    label: `Рейс ${s.id}: ${(s.blockers ?? [])[0] ?? 'блокер'}`,
    severity: 'warn' as const,
    responsibleRole: 'LOGISTICIAN',
    nextAction: s.nextAction ?? 'Устранить блокер',
  }));

  const assignedDrivers = orders.filter((order) => order.driver !== 'не назначен');
  const tripPlan = selectDealLogisticsTripPlan('DL-9106');

  return (
    <RoleExecutionCockpitPage cockpit={OPERATIONAL_ROLE_EXECUTION_COCKPITS.logistics}>
      <LiveApiStatusBar
        apiOnline={apiOnline}
        blockers={liveBlockers}
        activeShipments={shipmentCount}
        role="LOGISTICIAN · Логистика"
        summary={
          apiOnline
            ? `${shipmentCount} активных рейсов · ${blockedShipments.length} с блокерами`
            : 'Данные статичные — API недоступен'
        }
      />

      <RoleExecutionHandoff items={logisticsHandoff} title='исполнение: что логистика отправляет и ожидает' />

      <section style={card}>
        <div style={micro}>План перевозки DL-9106</div>
        <div style={gateGrid}>
          <Gate gate={{ title: 'Заявка', value: tripPlan.logisticsOrderId, state: 'wait' }} />
          <Gate gate={{ title: 'Машины', value: `${tripPlan.vehicleCount} машины / ${tripPlan.tripIds.length} рейса`, state: tripPlan.isCompletePlan ? 'ok' : 'stop' }} />
          <Gate gate={{ title: 'Плановый объём', value: `${formatTons(tripPlan.plannedTons)} из ${formatTons(tripPlan.declaredTons)}`, state: tripPlan.isCompletePlan ? 'ok' : 'stop' }} />
          <Gate gate={{ title: 'ГИС ЭПД', value: tripPlan.epdPackage?.gisEpdTransferStatus ?? 'нет статуса', state: 'wait' }} />
        </div>
        <div style={tripGrid}>
          {tripPlan.trips.map((trip) => (
            <article key={trip.tripId} style={tripCard}>
              <div style={idText}>{trip.tripId} · {formatTons(trip.plannedLoadTons ?? 0)}</div>
              <h2 style={h2}>{trip.driverAlias} · {trip.vehicleMasked}</h2>
              <div style={twoColGrid}>
                <Cell label='Статус' value={trip.status ?? trip.currentLeg} strong={trip.tripId === 'TRIP-SIM-001'} />
                <Cell label='Пломба' value={trip.sealStatus ?? 'ожидает'} danger={(trip.sealStatus ?? '').includes('не')} />
                <Cell label='Погрузка' value={trip.pickupPoint} />
                <Cell label='Выгрузка' value={trip.deliveryPoint} />
                <Cell label='ETA' value={trip.eta} />
                <Cell label='ЭТрН титул' value={trip.epdTitleId ?? 'ожидает'} danger />
              </div>
            </article>
          ))}
        </div>
      </section>

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
    </RoleExecutionCockpitPage>
  );
}

function Gate({ gate }: { gate: GateItem }) {
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

const card = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12, boxShadow: '0 14px 34px rgba(15,23,42,0.055)' } as const;
const h2 = { margin: '6px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.025em' } as const;
const gateGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8 } as const;
const tripGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 8 } as const;
const tripCard = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 18, padding: 14, display: 'grid', gap: 10, boxShadow: '0 10px 24px rgba(15,23,42,0.045)' } as const;
const idText = { color: '#0A7A5F', fontSize: 12, fontWeight: 950 } as const;
const twoColGrid = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 14, padding: 10, minWidth: 0, boxShadow: '0 8px 18px rgba(15,23,42,0.035)' } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const status = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const neutralStatus = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 900 } as const;
const dangerStatus = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 12, fontWeight: 900 } as const;
