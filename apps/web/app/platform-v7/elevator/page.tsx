import Link from 'next/link';
import { FieldElevatorRuntime } from '@/components/v7r/FieldElevatorRuntime';

const receiving = {
  tripId: 'TRIP-SIM-001',
  dealId: 'DL-9106',
  lotId: 'LOT-2403',
  crop: 'Пшеница 4 класса',
  declaredWeight: '600 т',
  arrivedWeight: '598,8 т',
  deviation: '-1,2 т',
  lab: 'проба отобрана',
  docs: 'акт приёмки готовится',
  next: 'зафиксировать вес и качество',
};

export default function Page() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Кабинет приёмки</div>
        <h1 style={h1}>Вес, качество и основание выплаты</h1>
        <p style={lead}>Приёмка видит только груз, рейс, вес, лабораторию, документы и отклонения. Деньги и ставки не раскрываются.</p>
      </section>

      <section style={card}>
        <div style={micro}>Активная приёмка</div>
        <div style={rowHead}>
          <div>
            <div style={idText}>{receiving.tripId} · {receiving.dealId}</div>
            <h2 style={h2}>{receiving.crop} · {receiving.declaredWeight}</h2>
            <p style={muted}>{receiving.lotId} · прибыл на элеватор ВРЖ-08</p>
          </div>
          <span style={statusPill}>в работе</span>
        </div>
        <div style={grid2}>
          <Cell label='Заявлено' value={receiving.declaredWeight} />
          <Cell label='На приёмке' value={receiving.arrivedWeight} strong />
          <Cell label='Отклонение' value={receiving.deviation} danger />
          <Cell label='Лаборатория' value={receiving.lab} />
          <Cell label='Документы' value={receiving.docs} />
          <Cell label='Следующее действие' value={receiving.next} strong />
        </div>
        <div style={actions}>
          <Link href={`/platform-v7/deals/${receiving.dealId}`} style={primaryBtn}>Открыть сделку</Link>
          <Link href='/platform-v7/lab' style={ghostBtn}>Лаборатория</Link>
        </div>
      </section>

      <FieldElevatorRuntime />
    </main>
  );
}

function Cell({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: danger ? '#B91C1C' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.25, fontWeight: 900 }}>{value}</div></div>;
}

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(180,83,9,0.08)', border: '1px solid rgba(180,83,9,0.18)', color: '#B45309', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '6px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const muted = { margin: '6px 0 0', color: '#64748B', fontSize: 13 } as const;
const rowHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
const idText = { color: '#B45309', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10, minWidth: 0 } as const;
const statusPill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#B45309', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
