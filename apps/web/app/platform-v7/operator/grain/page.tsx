import Link from 'next/link';

const items = [
  { title: 'СДИЗ', value: 'ждёт подтверждения', note: 'Ответственный — продавец. Без подтверждения выпуск денег закрыт.', href: '/platform-v7/deals/grain-sdiz', tone: 'stop' },
  { title: 'ЭТрН', value: 'ждёт подписи', note: 'Ответственный — грузополучатель. Закрывает транспортное условие.', href: '/platform-v7/deals/DL-9106/transport-documents', tone: 'stop' },
  { title: 'Вес', value: 'есть отклонение', note: 'Ответственный — приёмка. Нужен акт расхождения.', href: '/platform-v7/deals/grain-weight', tone: 'warn' },
  { title: 'Качество', value: 'протокол ожидается', note: 'Ответственный — лаборатория. Влияет на удержание и спор.', href: '/platform-v7/deals/grain-quality', tone: 'warn' },
] as const;

const metrics = [
  { label: 'Сделка', value: 'DL-9106', tone: 'neutral' },
  { label: 'К выпуску', value: '0 ₽', tone: 'bad' },
  { label: 'Под влиянием', value: '9,65 млн ₽', tone: 'bad' },
  { label: 'Следующий шаг', value: 'закрыть СДИЗ', tone: 'good' },
] as const;

export default function OperatorGrainPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Оператор сделки</div>
        <h1 style={h1}>Очередь условий по зерновой сделке</h1>
        <p style={lead}>Оператор видит, что именно удерживает сделку: документ, акт, протокол, ответственный и следующее действие. Ручное решение по деньгам не доступно без закрытия условий.</p>
        <div style={actions}>
          <Link href='/platform-v7/operator' style={primaryBtn}>Центр оператора</Link>
          <Link href='/platform-v7/deals/DL-9106/clean' style={ghostBtn}>Deal 360</Link>
          <Link href='/platform-v7/deals/grain-release' style={ghostBtn}>Выпуск денег</Link>
        </div>
      </section>

      <section style={grid}>{metrics.map((item) => <Metric key={item.label} item={item} />)}</section>

      <section style={card}>
        <div style={micro}>Очередь условий</div>
        <div style={stepGrid}>{items.map((item, index) => <Item key={item.title} item={item} index={index} />)}</div>
      </section>

      <section style={darkCard}>
        <div style={{ ...micro, color: '#FDE68A' }}>Правило выпуска</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950 }}>Нельзя выпускать деньги, пока условия не закрыты</h2>
        <p style={{ margin: 0, color: '#FEF3C7', fontSize: 14, lineHeight: 1.55 }}>Каждое действие должно иметь ответственного, документальное основание и след в журнале. Оператор видит очередь и контроль, но не подменяет банк, лабораторию, элеватор или стороны сделки.</p>
      </section>
    </main>
  );
}

function Item({ item, index }: { item: typeof items[number]; index: number }) {
  return <Link href={item.href} style={stepCard}><span style={{ ...num, background: color(item.tone) }}>{index + 1}</span><strong style={title}>{item.title}</strong><b style={{ ...value, color: color(item.tone) }}>{item.value}</b><span style={note}>{item.note}</span><span style={{ ...cta, color: color(item.tone) }}>Открыть</span></Link>;
}

function Metric({ item }: { item: typeof metrics[number] }) {
  return <div style={metricCard}><div style={micro}>{item.label}</div><div style={{ marginTop: 8, color: color(item.tone), fontSize: 22, lineHeight: 1.1, fontWeight: 950 }}>{item.value}</div></div>;
}

function color(tone: string) { return tone === 'bad' || tone === 'stop' ? '#B91C1C' : tone === 'warn' ? '#B45309' : tone === 'good' ? '#0A7A5F' : '#0F1419'; }

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const darkCard = { background: '#78350F', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', color: '#B45309', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#B45309', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
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
