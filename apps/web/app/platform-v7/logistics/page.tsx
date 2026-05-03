import Link from 'next/link';

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
    vehicle: 'Р***ТУ',
    eta: '14:28',
    progress: '62%',
    incidents: 'нет',
    docs: 'транспортный пакет на проверке',
    next: 'контроль прибытия',
    href: '/platform-v7/driver',
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
    vehicle: 'С***АА',
    eta: 'прибыл 14:28',
    progress: '100%',
    incidents: 'есть отклонение веса',
    docs: 'не подписаны',
    next: 'закрыть инцидент',
    href: '/platform-v7/driver',
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
    vehicle: '—',
    eta: '7–14 дней',
    progress: '0%',
    incidents: 'нет',
    docs: 'не создан рейс',
    next: 'назначить водителя',
    href: '/platform-v7/logistics/inbox',
  },
] as const;

export default function LogisticsPage() {
  const inTransit = orders.filter((order) => order.status === 'Водитель назначен').length;
  const arrived = orders.filter((order) => order.status === 'Прибыл').length;
  const incidents = orders.filter((order) => order.incidents !== 'нет').length;

  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 }}>
        <div style={badge}>Кабинет логистики</div>
        <h1 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 }}>Заявки, водители и рейсы</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 }}>Логистика видит только исполнение перевозки: заявку, сделку, маршрут, водителя, машину, ETA, документы и инциденты. Деньги и ставки не раскрываются.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/logistics/inbox' style={primaryBtn}>Входящие заявки</Link>
          <Link href='/platform-v7/driver' style={ghostBtn}>Открыть рейс водителя</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <Metric label='В пути' value={String(inTransit)} />
        <Metric label='Прибыли' value={String(arrived)} good />
        <Metric label='Инцидентов' value={String(incidents)} danger={incidents > 0} />
        <Metric label='Заказов' value={String(orders.length)} />
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 }}>
        <div style={micro}>Текущая очередь</div>
        {orders.map((order) => <OrderCard key={order.id} order={order} />)}
      </section>
    </main>
  );
}

function OrderCard({ order }: { order: typeof orders[number] }) {
  const hasIncident = order.incidents !== 'нет';
  const isActive = order.status === 'Водитель назначен';
  return (
    <Link href={order.href} style={{ textDecoration: 'none', color: 'inherit', background: isActive ? 'rgba(10,122,95,0.06)' : '#F8FAFB', border: `1px solid ${isActive ? 'rgba(10,122,95,0.2)' : '#E4E6EA'}`, borderRadius: 20, padding: 15, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#0A7A5F', fontSize: 13, fontWeight: 950 }}>{order.id} → {order.dealId}</div>
          <h2 style={{ margin: '6px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950 }}>{order.crop} · {order.volume}</h2>
          <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 13 }}>{order.route}</p>
        </div>
        <span style={isActive ? status : neutralStatus}>{order.status}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 8 }}>
        <Cell label='Водитель' value={order.driver} />
        <Cell label='Машина' value={order.vehicle} />
        <Cell label='ETA' value={order.eta} strong={isActive} />
        <Cell label='Прогресс' value={order.progress} strong={isActive} />
        <Cell label='Документы' value={order.docs} danger={order.docs.includes('не')} />
        <Cell label='Инциденты' value={order.incidents} danger={hasIncident} />
      </div>

      <div style={{ background: hasIncident ? 'rgba(220,38,38,0.08)' : 'rgba(10,122,95,0.06)', border: `1px solid ${hasIncident ? 'rgba(220,38,38,0.18)' : 'rgba(10,122,95,0.18)'}`, borderRadius: 14, padding: 11, color: hasIncident ? '#B91C1C' : '#0A7A5F', fontSize: 13, fontWeight: 900 }}>
        Следующее действие: {order.next}
      </div>
    </Link>
  );
}

function Metric({ label, value, good = false, danger = false }: { label: string; value: string; good?: boolean; danger?: boolean }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16 }}>
      <div style={micro}>{label}</div>
      <div style={{ marginTop: 8, color: danger ? '#B91C1C' : good ? '#0A7A5F' : '#0F1419', fontSize: 28, lineHeight: 1, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

function Cell({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10, minWidth: 0 }}>
      <div style={micro}>{label}</div>
      <div style={{ marginTop: 4, color: danger ? '#B91C1C' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.25, fontWeight: 900, overflowWrap: 'break-word' }}>{value}</div>
    </div>
  );
}

const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const status = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const neutralStatus = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 900 } as const;
