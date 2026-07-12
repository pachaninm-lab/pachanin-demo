import Link from 'next/link';

const drivers = [
  {
    id: 'DRV-TEST-001',
    name: 'Водитель А',
    vehicle: 'Р***ТУ',
    shipment: 'SHIP-001',
    deal: 'DL-9106',
    status: 'В пути',
    location: '62% маршрута',
    nextAction: 'Контролировать прибытие и подпись ЭТрН',
    tone: 'ok',
  },
  {
    id: 'DRV-TEST-002',
    name: 'Водитель Б',
    vehicle: 'С***АА',
    shipment: 'SHIP-002',
    deal: 'DL-9102',
    status: 'На приёмке',
    location: 'Элеватор назначения',
    nextAction: 'Закрыть расхождение веса и акт удержания',
    tone: 'warn',
  },
] as const;

export default function LogisticsDriversPage() {
  return (
    <main style={page}>
      <header style={hero}>
        <div>
          <p style={eyebrow}>ЛОГИСТИКА · ДИСПЕТЧЕРСКИЙ КОНТУР</p>
          <h1 style={title}>Водители и машины</h1>
          <p style={lead}>Контроль назначений, местоположения, рейсов и следующих действий. Это экран логиста, а не личный кабинет водителя.</p>
        </div>
        <span style={testBadge}>TEST</span>
      </header>

      <section style={summaryGrid} aria-label='Сводка по водителям'>
        <Metric label='На линии' value='2' />
        <Metric label='С отклонением' value='1' warning />
        <Metric label='Без назначения' value='1' />
      </section>

      <section style={list} aria-label='Назначенные водители'>
        {drivers.map((driver) => (
          <article key={driver.id} style={driver.tone === 'warn' ? warningCard : card}>
            <div style={cardHeader}>
              <div>
                <p style={eyebrow}>{driver.id} · {driver.vehicle}</p>
                <h2 style={cardTitle}>{driver.name}</h2>
              </div>
              <span style={driver.tone === 'warn' ? warningStatus : okStatus}>{driver.status}</span>
            </div>
            <div style={details}>
              <Detail label='Рейс' value={driver.shipment} />
              <Detail label='Сделка' value={driver.deal} />
              <Detail label='Местоположение' value={driver.location} />
              <Detail label='Следующее действие логиста' value={driver.nextAction} wide />
            </div>
          </article>
        ))}
      </section>

      <nav style={actions} aria-label='Действия логиста'>
        <Link href='/platform-v7/logistics' style={secondaryAction}>Вернуться в диспетчерскую</Link>
        <Link href='/platform-v7/deal-logistics' style={primaryAction}>Открыть рейсы сделки</Link>
      </nav>
    </main>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div style={metric}>
      <span style={metricLabel}>{label}</span>
      <strong style={{ ...metricValue, color: warning ? '#B45309' : '#0A7A5F' }}>{value}</strong>
    </div>
  );
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={{ ...detail, gridColumn: wide ? '1 / -1' : undefined }}>
      <span style={metricLabel}>{label}</span>
      <strong style={detailValue}>{value}</strong>
    </div>
  );
}

const page = { display: 'grid', gap: 16, width: '100%', maxWidth: 960, margin: '0 auto' } as const;
const hero = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: 18, borderRadius: 24, border: '1px solid var(--pc-accent-border)', background: 'var(--pc-bg-card)', boxShadow: 'var(--pc-shadow-sm)' } as const;
const eyebrow = { margin: 0, color: 'var(--pc-text-muted)', fontSize: 11, lineHeight: 1.4, fontWeight: 900, letterSpacing: '0.07em' } as const;
const title = { margin: '7px 0 0', color: 'var(--pc-text-primary)', fontSize: 'clamp(26px, 6vw, 42px)', lineHeight: 1.02, fontWeight: 950, letterSpacing: '-0.035em' } as const;
const lead = { margin: '10px 0 0', maxWidth: 680, color: 'var(--pc-text-secondary)', fontSize: 15, lineHeight: 1.55, fontWeight: 650 } as const;
const testBadge = { flex: '0 0 auto', padding: '7px 11px', borderRadius: 999, background: '#DDF4EA', color: '#116149', fontSize: 12, fontWeight: 950, letterSpacing: '0.08em' } as const;
const summaryGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 } as const;
const metric = { minWidth: 0, padding: 14, borderRadius: 18, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', display: 'grid', gap: 6 } as const;
const metricLabel = { color: 'var(--pc-text-muted)', fontSize: 11, lineHeight: 1.35, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.05em' } as const;
const metricValue = { fontSize: 24, lineHeight: 1, fontWeight: 950 } as const;
const list = { display: 'grid', gap: 10 } as const;
const card = { padding: 16, borderRadius: 22, border: '1px solid rgba(10,122,95,0.2)', background: 'var(--pc-bg-card)', display: 'grid', gap: 12, boxShadow: 'var(--pc-shadow-sm)' } as const;
const warningCard = { ...card, border: '1px solid rgba(217,119,6,0.28)' } as const;
const cardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 } as const;
const cardTitle = { margin: '5px 0 0', color: 'var(--pc-text-primary)', fontSize: 21, lineHeight: 1.1, fontWeight: 950 } as const;
const okStatus = { padding: '7px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const warningStatus = { ...okStatus, background: 'rgba(217,119,6,0.09)', color: '#B45309' } as const;
const details = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 } as const;
const detail = { minWidth: 0, padding: 11, borderRadius: 15, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-elevated)', display: 'grid', gap: 5 } as const;
const detailValue = { color: 'var(--pc-text-primary)', fontSize: 13, lineHeight: 1.4, fontWeight: 900, overflowWrap: 'anywhere' } as const;
const actions = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 } as const;
const actionBase = { minHeight: 52, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', textDecoration: 'none', fontSize: 14, fontWeight: 950, textAlign: 'center' } as const;
const primaryAction = { ...actionBase, background: 'var(--pc-accent)', color: '#fff', border: '1px solid var(--pc-accent)' } as const;
const secondaryAction = { ...actionBase, background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', border: '1px solid var(--pc-border)' } as const;
