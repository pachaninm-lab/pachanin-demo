import Link from 'next/link';

const gates = [
  { title: 'Контрагент', value: 'ИНН / ОГРН / санкции', note: 'Проверка контрагента должна закрыть базовый допуск до сделки.', href: '/platform-v7/companies', tone: 'warn' },
  { title: 'Полномочия', value: 'КЭП + МЧД', note: 'Подписант должен иметь подтверждённые полномочия на сделку и документы.', href: '/platform-v7/documents/grain', tone: 'stop' },
  { title: 'Документы', value: 'СДИЗ / ЭТрН / УПД', note: 'Неполный документный пакет не создаёт основание для выпуска денег.', href: '/platform-v7/documents/grain', tone: 'stop' },
  { title: 'Обход', value: 'ручной выпуск закрыт', note: 'Действия без основания фиксируются как риск и не проходят в расчёт.', href: '/platform-v7/anti-bypass', tone: 'stop' },
] as const;

const metrics = [
  { label: 'Контрагент', value: 'проверяется', tone: 'warn' },
  { label: 'Полномочия', value: 'МЧД нужна', tone: 'bad' },
  { label: 'Документы', value: 'неполный пакет', tone: 'bad' },
  { label: 'Риск обхода', value: 'заблокирован', tone: 'good' },
] as const;

export default function ComplianceGrainPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Комплаенс зерновой сделки</div>
        <h1 style={h1}>Контрагент, полномочия, документы, риск обхода и основание допуска</h1>
        <p style={lead}>Комплаенс показывает, почему сделка может быть допущена или остановлена: кто подписывает, какие документы закрыты, есть ли риск обхода и есть ли основание для движения денег.</p>
        <div style={actions}>
          <Link href='/platform-v7/compliance' style={primaryBtn}>Комплаенс</Link>
          <Link href='/platform-v7/documents/grain' style={ghostBtn}>Документы</Link>
          <Link href='/platform-v7/bank/grain' style={ghostBtn}>Банк</Link>
        </div>
      </section>

      <section style={grid}>{metrics.map((item) => <Metric key={item.label} item={item} />)}</section>

      <section style={card}>
        <div style={micro}>Основания допуска</div>
        <div style={stepGrid}>{gates.map((gate, index) => <Gate key={gate.title} gate={gate} index={index} />)}</div>
      </section>

      <section style={darkCard}>
        <div style={{ ...micro, color: '#FDE68A' }}>Правило допуска</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950 }}>Допуск создаётся только по основанию</h2>
        <p style={{ margin: 0, color: '#FEF3C7', fontSize: 14, lineHeight: 1.55 }}>Если нет подтверждённого контрагента, полномочий, документов или журнала основания, сделка не проходит в выпуск денег. Ручной обход должен оставаться закрытым.</p>
      </section>
    </main>
  );
}

function Gate({ gate, index }: { gate: typeof gates[number]; index: number }) {
  return <Link href={gate.href} style={stepCard}><span style={{ ...num, background: color(gate.tone) }}>{index + 1}</span><strong style={title}>{gate.title}</strong><b style={{ ...value, color: color(gate.tone) }}>{gate.value}</b><span style={note}>{gate.note}</span><span style={{ ...cta, color: color(gate.tone) }}>Открыть</span></Link>;
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
