import Link from 'next/link';

const steps = [
  { title: 'Погрузка', value: 'подтверждена', note: 'Фото, весовая точка и контрольный номер сохранены в журнале рейса.', href: '/platform-v7/driver' },
  { title: 'Маршрут', value: '62% пути', note: 'Водитель видит только текущий рейс и ближайшее действие.', href: '/platform-v7/logistics/grain' },
  { title: 'Документы', value: 'ЭТрН ждёт подписи', note: 'Транспортные документы доступны только по своему рейсу.', href: '/platform-v7/deals/DL-9106/transport-documents' },
  { title: 'Прибытие', value: 'элеватор ВРЖ-08', note: 'Прибыть, подтвердить точку и передать документы на приёмку.', href: '/platform-v7/elevator/grain' },
] as const;

const checks = [
  { label: 'Деньги и ставки', value: 'скрыты', tone: 'neutral' },
  { label: 'Погрузка', value: 'закрыта', tone: 'good' },
  { label: 'Связь', value: 'очередь событий', tone: 'warn' },
  { label: 'ETA', value: '14:28', tone: 'good' },
] as const;

export default function DriverGrainPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Полевой рейс зерна</div>
        <h1 style={h1}>Погрузка, маршрут, документы и прибытие</h1>
        <p style={lead}>Водитель видит только свой рейс, маршрут, транспортные документы и ближайшее действие. Цена, ставки, банк, резерв и расчёты сторон не показываются.</p>
        <div style={actions}>
          <Link href='/platform-v7/driver' style={primaryBtn}>Кабинет водителя</Link>
          <Link href='/platform-v7/logistics/grain' style={ghostBtn}>Маршрут</Link>
          <Link href='/platform-v7/elevator/grain' style={ghostBtn}>Приёмка</Link>
        </div>
      </section>

      <section style={grid}>{checks.map((item) => <Metric key={item.label} item={item} />)}</section>

      <section style={card}>
        <div style={micro}>Цепочка рейса</div>
        <div style={stepGrid}>{steps.map((step, index) => <Step key={step.title} step={step} index={index} />)}</div>
      </section>

      <section style={darkCard}>
        <div style={{ ...micro, color: '#A7F3D0' }}>Правило роли</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950 }}>Водитель закрывает физическое событие рейса</h2>
        <p style={{ margin: 0, color: '#D1FAE5', fontSize: 14, lineHeight: 1.55 }}>Если связь пропала, действия сохраняются в очереди и отправляются после восстановления сети. Финансовые действия остаются вне водительского интерфейса.</p>
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

function color(tone: string) { return tone === 'good' ? '#0A7A5F' : tone === 'warn' ? '#B45309' : '#0F1419'; }

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const darkCard = { background: '#064E3B', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const stepGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 } as const;
const metricCard = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16 } as const;
const stepCard = { textDecoration: 'none', minHeight: 178, display: 'grid', gap: 8, padding: 14, borderRadius: 18, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#0F1419' } as const;
const num = { width: 28, height: 28, borderRadius: 999, background: '#0A7A5F', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 12, fontWeight: 900 } as const;
const title = { color: '#0F1419', fontSize: 17, lineHeight: 1.2, fontWeight: 900 } as const;
const value = { color: '#0A7A5F', fontSize: 13, lineHeight: 1.3, fontWeight: 900 } as const;
const note = { color: '#64748B', fontSize: 13, lineHeight: 1.5 } as const;
const cta = { marginTop: 'auto', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
