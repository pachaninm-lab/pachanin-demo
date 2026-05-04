import Link from 'next/link';

const disputes = [
  {
    id: 'DSP-9102-WEIGHT',
    deal: 'DL-9102',
    lot: 'LOT-2402',
    reason: 'Отклонение веса',
    amount: '624 тыс. ₽',
    status: 'удержание активно',
    responsible: 'оператор',
    next: 'закрыть акт расхождения и решение по удержанию',
    href: '/platform-v7/deals/DL-9102/clean',
    evidence: ['весовая ведомость', 'акт расхождения', 'фото приёмки', 'журнал рейса'],
  },
  {
    id: 'DSP-9106-QUALITY',
    deal: 'DL-9106',
    lot: 'LOT-2403',
    reason: 'Протокол качества ожидается',
    amount: '9,65 млн ₽',
    status: 'выплата остановлена',
    responsible: 'лаборатория',
    next: 'получить протокол ФГБУ ЦОК АПК и закрыть акт приёмки',
    href: '/platform-v7/elevator',
    evidence: ['проба', 'показатели качества', 'акт приёмки', 'журнал элеватора'],
  },
] as const;

export default function PlatformV7DisputesPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={hero}>
        <div style={badge}>Споры и удержания</div>
        <h1 style={h1}>Спор объясняет, почему деньги не выпущены</h1>
        <p style={lead}>Здесь собраны причина удержания, сумма влияния, ответственный и доказательства. Спор не закрывается без решения, суммы и основания.</p>
        <div style={actions}>
          <Link href='/platform-v7/operator' style={primaryBtn}>Центр управления</Link>
          <Link href='/platform-v7/documents' style={ghostBtn}>Документы</Link>
        </div>
      </section>

      <section style={metricsGrid}>
        <Metric label='Открытых споров' value='2' danger />
        <Metric label='Под удержанием' value='624 тыс. ₽' danger />
        <Metric label='Деньги под влиянием' value='15,89 млн ₽' danger />
        <Metric label='Готово к закрытию' value='0' />
      </section>

      <section style={card}>
        <div style={micro}>Очередь споров</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {disputes.map((item) => <DisputeCard key={item.id} item={item} />)}
        </div>
      </section>

      <section style={card}>
        <div style={micro}>Правила закрытия</div>
        <div style={grid2}>
          <Rule title='Решение' text='нужно указать: удержать, выплатить, пересчитать или вернуть' />
          <Rule title='Сумма' text='спорная часть должна быть выражена в рублях' />
          <Rule title='Основание' text='акт, протокол, весовая ведомость или документ ЭДО' />
          <Rule title='Журнал' text='закрытие спора записывается в журнал сделки' />
        </div>
      </section>
    </main>
  );
}

function DisputeCard({ item }: { item: typeof disputes[number] }) {
  return (
    <Link href={item.href} style={disputeCard}>
      <div style={rowHead}>
        <div>
          <div style={idText}>{item.id} · {item.deal} · {item.lot}</div>
          <h2 style={h2}>{item.reason}</h2>
          <p style={muted}>{item.status}</p>
        </div>
        <span style={dangerPill}>останавливает деньги</span>
      </div>
      <div style={grid2}>
        <Cell label='Сумма влияния' value={item.amount} danger />
        <Cell label='Ответственный' value={item.responsible} />
        <Cell label='Следующее действие' value={item.next} strong />
        <Cell label='Открыть' value='сделка / приёмка' />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {item.evidence.map((evidence) => <span key={evidence} style={evidencePill}>{evidence}</span>)}
      </div>
    </Link>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={metric}><div style={micro}>{label}</div><div style={{ marginTop: 8, color: danger ? '#B91C1C' : '#0F1419', fontSize: 28, lineHeight: 1, fontWeight: 950 }}>{value}</div></div>;
}

function Cell({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: danger ? '#B91C1C' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.25, fontWeight: 900 }}>{value}</div></div>;
}

function Rule({ title, text }: { title: string; text: string }) {
  return <div style={cell}><strong style={{ color: '#0F1419', fontSize: 14 }}>{title}</strong><p style={{ margin: '5px 0 0', color: '#64748B', fontSize: 12, lineHeight: 1.4 }}>{text}</p></div>;
}

const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 62%,#FFF7ED 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 12 } as const;
const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const metric = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '6px 0 0', color: '#0F1419', fontSize: 20, lineHeight: 1.08, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const muted = { margin: '6px 0 0', color: '#64748B', fontSize: 13 } as const;
const rowHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
const idText = { color: '#B91C1C', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10, minWidth: 0 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#B91C1C', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const disputeCard = { textDecoration: 'none', color: 'inherit', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.16)', borderRadius: 18, padding: 14, display: 'grid', gap: 10 } as const;
const dangerPill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: '#fff', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 12, fontWeight: 900 } as const;
const evidencePill = { display: 'inline-flex', width: 'fit-content', padding: '6px 9px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 850 } as const;
