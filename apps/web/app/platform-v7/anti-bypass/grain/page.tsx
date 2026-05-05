import Link from 'next/link';

const risks = [
  { title: 'Контакт вне сделки', value: 'риск высокий', note: 'Попытка перенести договорённость в мессенджер или звонок должна фиксироваться как событие риска.', href: '/platform-v7/support', tone: 'stop' },
  { title: 'Смена реквизитов', value: 'требует проверки', note: 'Новые реквизиты не принимаются без повторной проверки контрагента и полномочий.', href: '/platform-v7/compliance/grain', tone: 'warn' },
  { title: 'Ручной выпуск', value: 'закрыт', note: 'Выпуск денег невозможен без документов, приёмки, качества и банковского основания.', href: '/platform-v7/settlement/grain', tone: 'stop' },
  { title: 'Обход логистики', value: 'остановка сделки', note: 'Рейс без заявки, водителя, контрольного номера и документов не закрывает исполнение.', href: '/platform-v7/logistics/grain', tone: 'stop' },
] as const;

const metrics = [
  { label: 'Сделка', value: 'DL-9106', tone: 'neutral' },
  { label: 'Риск обхода', value: 'высокий', tone: 'bad' },
  { label: 'Деньги', value: 'выпуск закрыт', tone: 'bad' },
  { label: 'Следующий шаг', value: 'комплаенс', tone: 'good' },
] as const;

export default function GrainAntiBypassPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Антиобход зерновой сделки</div>
        <h1 style={h1}>Контакт вне сделки, реквизиты, ручной выпуск и обход логистики</h1>
        <p style={lead}>Контур антиобхода показывает действия, которые могут вывести сделку из платформы: прямой контакт, смена реквизитов, ручная выплата, рейс без основания или документ вне сделки.</p>
        <div style={actions}>
          <Link href='/platform-v7/anti-bypass' style={primaryBtn}>Антиобход</Link>
          <Link href='/platform-v7/compliance/grain' style={ghostBtn}>Комплаенс</Link>
          <Link href='/platform-v7/settlement/grain' style={ghostBtn}>Расчёт</Link>
        </div>
      </section>

      <section style={grid}>{metrics.map((item) => <Metric key={item.label} item={item} />)}</section>

      <section style={card}>
        <div style={micro}>Сигналы риска</div>
        <div style={stepGrid}>{risks.map((risk, index) => <RiskCard key={risk.title} risk={risk} index={index} />)}</div>
      </section>

      <section style={darkCard}>
        <div style={{ ...micro, color: '#FECACA' }}>Правило антиобхода</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950 }}>Сделка закрывается только внутри доказательного контура</h2>
        <p style={{ margin: 0, color: '#FEE2E2', fontSize: 14, lineHeight: 1.55 }}>Если участник пытается вывести оплату, документы, логистику или спор за пределы платформы, выпуск денег остаётся закрытым, а событие уходит в журнал риска.</p>
      </section>
    </main>
  );
}

function RiskCard({ risk, index }: { risk: typeof risks[number]; index: number }) {
  return <Link href={risk.href} style={stepCard}><span style={{ ...num, background: color(risk.tone) }}>{index + 1}</span><strong style={title}>{risk.title}</strong><b style={{ ...value, color: color(risk.tone) }}>{risk.value}</b><span style={note}>{risk.note}</span><span style={{ ...cta, color: color(risk.tone) }}>Открыть</span></Link>;
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
