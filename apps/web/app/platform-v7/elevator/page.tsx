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

const quality = [
  { label: 'Влажность', value: '13,1%', limit: 'допуск до 14%', state: 'ok' },
  { label: 'Клейковина', value: '23%', limit: 'минимум 21%', state: 'ok' },
  { label: 'Сорная примесь', value: '2,4%', limit: 'допуск до 2%', state: 'stop' },
  { label: 'Протокол', value: 'ожидается', limit: 'ФГБУ ЦОК АПК', state: 'wait' },
] as const;

const gates = [
  { title: 'Вес', value: 'отклонение -1,2 т', impact: 'создаёт удержание до акта расхождения', state: 'stop' },
  { title: 'Качество', value: 'есть превышение по примеси', impact: 'требует протокол качества', state: 'stop' },
  { title: 'Акт приёмки', value: 'готовится', impact: 'без акта выплата невозможна', state: 'wait' },
  { title: 'ФГБУ ЦОК АПК', value: 'протокол ожидается', impact: 'качество влияет на цену и спор', state: 'wait' },
] as const;

export default function Page() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Кабинет приёмки</div>
        <h1 style={h1}>Вес, качество и основание выплаты</h1>
        <p style={lead}>Приёмка видит только груз, рейс, вес, лабораторию, документы и отклонения. Деньги, ставки и покупательская аналитика не раскрываются.</p>
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
          <Link href={`/platform-v7/deals/${receiving.dealId}/clean`} style={primaryBtn}>Открыть Deal 360</Link>
          <Link href='/platform-v7/lab' style={ghostBtn}>Лаборатория</Link>
        </div>
      </section>

      <section style={card}>
        <div style={micro}>Условия приёмки, влияющие на выплату</div>
        <div style={grid2}>
          {gates.map((gate) => <Gate key={gate.title} gate={gate} />)}
        </div>
      </section>

      <section style={card}>
        <div style={micro}>Качество партии · симуляция протокола</div>
        <div style={grid2}>
          {quality.map((item) => <QualityCell key={item.label} item={item} />)}
        </div>
        <div style={notice}>При отклонении веса или качества платформа должна создать акт расхождения, удержание и задачу оператору. Финальная выплата продавцу не разрешается до закрытия акта и протокола.</div>
      </section>

      <FieldElevatorRuntime />
    </main>
  );
}

function Gate({ gate }: { gate: typeof gates[number] }) {
  return <div style={{ background: stateBg(gate.state), border: `1px solid ${stateBorder(gate.state)}`, borderRadius: 14, padding: 12 }}><div style={{ ...micro, color: stateText(gate.state) }}>{gate.title}</div><div style={{ marginTop: 5, color: '#0F1419', fontSize: 14, fontWeight: 900 }}>{gate.value}</div><div style={{ marginTop: 4, color: '#64748B', fontSize: 12, lineHeight: 1.35 }}>{gate.impact}</div></div>;
}

function QualityCell({ item }: { item: typeof quality[number] }) {
  const bad = item.state === 'stop';
  const wait = item.state === 'wait';
  return <div style={{ background: stateBg(item.state), border: `1px solid ${stateBorder(item.state)}`, borderRadius: 14, padding: 12 }}><div style={{ ...micro, color: stateText(item.state) }}>{item.label}</div><div style={{ marginTop: 5, color: bad ? '#B91C1C' : '#0F1419', fontSize: 16, fontWeight: 950 }}>{item.value}</div><div style={{ marginTop: 4, color: wait ? '#B45309' : '#64748B', fontSize: 12 }}>{item.limit}</div></div>;
}

function Cell({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: danger ? '#B91C1C' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.25, fontWeight: 900 }}>{value}</div></div>;
}

function stateBg(state: string) {
  if (state === 'ok') return 'rgba(10,122,95,0.06)';
  if (state === 'stop') return 'rgba(220,38,38,0.06)';
  return 'rgba(217,119,6,0.06)';
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
const notice = { background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', borderRadius: 14, padding: 12, fontSize: 13, fontWeight: 900, lineHeight: 1.45 } as const;
