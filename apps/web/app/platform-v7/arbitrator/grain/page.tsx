import Link from 'next/link';

const steps = [
  { title: 'Доказательства', value: 'пакет собран', note: 'Фото, документы, акт, протокол и журнал событий связаны со сделкой.', href: '/platform-v7/deals/DL-9106/evidence-pack', tone: 'good' },
  { title: 'Акт', value: 'есть замечание', note: 'Акт осмотра описывает факт, время, место и ответственного.', href: '/platform-v7/surveyor/grain', tone: 'warn' },
  { title: 'Протокол', value: 'ожидает сверки', note: 'Показатели качества сравниваются с условиями партии.', href: '/platform-v7/deals/grain-quality', tone: 'warn' },
  { title: 'Решение', value: 'в подготовке', note: 'Результат передаётся оператору и в контур удержания.', href: '/platform-v7/disputes', tone: 'stop' },
] as const;

const metrics = [
  { label: 'Спор', value: 'DL-9106', tone: 'neutral' },
  { label: 'Удержано', value: '624 тыс. ₽', tone: 'bad' },
  { label: 'Доказательств', value: '18', tone: 'good' },
  { label: 'Решение', value: 'ожидается', tone: 'warn' },
] as const;

export default function ArbitratorGrainPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Арбитраж зернового спора</div>
        <h1 style={h1}>Доказательства, акт, протокол, удержание и решение</h1>
        <p style={lead}>Арбитр видит только доказательный пакет: акт осмотра, протокол качества, вес, документы, комментарии сторон и рекомендуемое решение. Ручной выпуск денег недоступен.</p>
        <div style={actions}>
          <Link href='/platform-v7/arbitrator' style={primaryBtn}>Кабинет арбитра</Link>
          <Link href='/platform-v7/deals/DL-9106/evidence-pack' style={ghostBtn}>Доказательства</Link>
          <Link href='/platform-v7/deals/grain-release' style={ghostBtn}>Условия выплаты</Link>
        </div>
      </section>

      <section style={grid}>{metrics.map((item) => <Metric key={item.label} item={item} />)}</section>

      <section style={card}>
        <div style={micro}>Логика решения</div>
        <div style={stepGrid}>{steps.map((step, index) => <Step key={step.title} step={step} index={index} />)}</div>
      </section>

      <section style={darkCard}>
        <div style={{ ...micro, color: '#FECACA' }}>Правило арбитража</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950 }}>Решение опирается только на доказательства</h2>
        <p style={{ margin: 0, color: '#FEE2E2', fontSize: 14, lineHeight: 1.55 }}>Арбитр не подменяет банк, оператора, лабораторию или стороны сделки. Его задача — подтвердить основание: принять, удержать, отправить на повторную проверку или передать спор дальше.</p>
      </section>
    </main>
  );
}

function Step({ step, index }: { step: typeof steps[number]; index: number }) {
  return <Link href={step.href} style={stepCard}><span style={{ ...num, background: color(step.tone) }}>{index + 1}</span><strong style={title}>{step.title}</strong><b style={{ ...value, color: color(step.tone) }}>{step.value}</b><span style={note}>{step.note}</span><span style={{ ...cta, color: color(step.tone) }}>Открыть</span></Link>;
}

function Metric({ item }: { item: typeof metrics[number] }) {
  return <div style={metricCard}><div style={micro}>{item.label}</div><div style={{ marginTop: 8, color: color(item.tone), fontSize: 22, lineHeight: 1.1, fontWeight: 950 }}>{item.value}</div></div>;
}

function color(tone: string) { return tone === 'bad' || tone === 'stop' ? '#B91C1C' : tone === 'warn' ? '#B45309' : tone === 'good' ? '#0A7A5F' : '#0F1419'; }

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const darkCard = { background: '#7F1D1D', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.18)', color: '#B91C1C', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#B91C1C', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const stepGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 } as const;
const metricCard = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16 } as const;
const stepCard = { textDecoration: 'none', minHeight: 178, display: 'grid', gap: 8, padding: 14, borderRadius: 18, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#0F1419' } as const;
const num = { width: 28, height: 28, borderRadius: 999, color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 12, fontWeight: 900 } as const;
const title = { color: '#0F1419', fontSize: 17, lineHeight: 1.2, fontWeight: 900 } as const;
const value = { fontSize: 13, lineHeight: 1.3, fontWeight: 900 } as const;
const note = { color: '#64748B', fontSize: 13, lineHeight: 1.5 } as const;
const cta = { marginTop: 'auto', fontSize: 12, fontWeight: 900 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
