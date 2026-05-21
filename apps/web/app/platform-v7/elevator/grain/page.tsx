import Link from 'next/link';

const steps = [
  { title: 'Прибытие', value: 'TRIP-SIM-001', note: 'Машина прибыла на элеватор, фиксируется время и номер рейса.', href: '/platform-v7/elevator/terminal' },
  { title: 'Вес', value: '600 т → 598,8 т', note: 'Брутто, тара, нетто и отклонение становятся основанием для акта.', href: '/platform-v7/deals/grain-weight' },
  { title: 'Проба', value: 'отобрана', note: 'Фиксируются место, время, пломба и передача в лабораторию.', href: '/platform-v7/lab' },
  { title: 'Качество', value: 'есть отклонение', note: 'Протокол качества влияет на удержание и возможный спор.', href: '/platform-v7/deals/grain-quality' },
] as const;

const checks = [
  { label: 'Коммерческие ставки', value: 'скрыты', tone: 'neutral' },
  { label: 'Банк и резерв', value: 'скрыты', tone: 'neutral' },
  { label: 'Вес', value: 'отклонение -1,2 т', tone: 'bad' },
  { label: 'Протокол', value: 'ожидается', tone: 'warn' },
] as const;

export default function ElevatorGrainPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Зерновая приёмка</div>
        <h1 style={h1}>Машина, вес, проба, лаборатория и акт</h1>
        <p style={lead}>Элеватор видит только физическое исполнение приёмки: рейс, машину, водителя, очередь, вес, пробу, лабораторию, СДИЗ и акт расхождения. Цена сделки, ставки, маржа и банковские детали не показываются.</p>
        <div style={actions}>
          <Link href='/platform-v7/elevator' style={primaryBtn}>Кабинет приёмки</Link>
          <Link href='/platform-v7/elevator/terminal' style={ghostBtn}>Терминал</Link>
          <Link href='/platform-v7/lab' style={ghostBtn}>Лаборатория</Link>
          <Link href='/platform-v7/deals/grain-weight' style={ghostBtn}>Вес</Link>
        </div>
      </section>

      <section style={grid}>{checks.map((item) => <Metric key={item.label} item={item} />)}</section>

      <section style={card}>
        <div style={micro}>Цепочка приёмки</div>
        <div style={stepGrid}>{steps.map((step, index) => <Step key={step.title} step={step} index={index} />)}</div>
      </section>

      <section style={darkCard}>
        <div style={{ ...micro, color: '#FED7AA' }}>Правило допуска выплаты</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950 }}>Приёмка создаёт основание, а не платёж</h2>
        <p style={{ margin: 0, color: '#FFEDD5', fontSize: 14, lineHeight: 1.55 }}>Если вес или качество не совпали, платформа должна создать акт расхождения, удержание спорной части и задачу оператору. Выпуск денег остаётся в банковом контуре и не доступен элеватору.</p>
      </section>
    </main>
  );
}

function Step({ step, index }: { step: typeof steps[number]; index: number }) {
  return <Link href={step.href} style={stepCard}><span style={num}>{index + 1}</span><strong style={title}>{step.title}</strong><b style={value}>{step.value}</b><span style={note}>{step.note}</span><span style={cta}>Открыть</span></Link>;
}

function Metric({ item }: { item: typeof checks[number] }) {
  return <div style={metricCard}><div style={micro}>{item.label}</div><div style={{ marginTop: 8, color: color(item.tone), fontSize: 22, lineHeight: 1.1, fontWeight: 950 }}>{item.value}</div></div>;
}

function color(tone: string) { return tone === 'bad' ? '#B91C1C' : tone === 'warn' ? '#B45309' : '#0F1419'; }

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const darkCard = { background: '#7C2D12', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(180,83,9,0.08)', border: '1px solid rgba(180,83,9,0.18)', color: '#B45309', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#B45309', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const stepGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 } as const;
const metricCard = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16 } as const;
const stepCard = { textDecoration: 'none', minHeight: 178, display: 'grid', gap: 8, padding: 14, borderRadius: 18, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#0F1419' } as const;
const num = { width: 28, height: 28, borderRadius: 999, background: '#B45309', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 12, fontWeight: 900 } as const;
const title = { color: '#0F1419', fontSize: 17, lineHeight: 1.2, fontWeight: 900 } as const;
const value = { color: '#B45309', fontSize: 13, lineHeight: 1.3, fontWeight: 900 } as const;
const note = { color: '#64748B', fontSize: 13, lineHeight: 1.5 } as const;
const cta = { marginTop: 'auto', color: '#B45309', fontSize: 12, fontWeight: 900 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
