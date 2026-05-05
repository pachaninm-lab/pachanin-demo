import Link from 'next/link';

const docs = [
  { title: 'СДИЗ', value: 'не закрыт', note: 'ФГИС «Зерно» подтверждает происхождение, движение партии и связь с лотом.', href: '/platform-v7/deals/grain-sdiz', tone: 'stop' },
  { title: 'ЭТрН', value: 'ждёт подписи', note: 'Транспортный документ закрывает рейс, доставку и основание приёмки.', href: '/platform-v7/deals/DL-9106/transport-documents', tone: 'warn' },
  { title: 'УПД', value: 'не запущен', note: 'Расчётный документ формируется после закрытия факта, веса и качества.', href: '/platform-v7/documents', tone: 'stop' },
  { title: 'Акт и протокол', value: 'ожидаются', note: 'Акт приёмки, акт расхождения и протокол качества влияют на удержание.', href: '/platform-v7/deals/grain-quality', tone: 'warn' },
] as const;

const metrics = [
  { label: 'Пакет', value: 'DL-9106', tone: 'neutral' },
  { label: 'Готово', value: '2 из 8', tone: 'warn' },
  { label: 'Блокирует выпуск', value: 'да', tone: 'bad' },
  { label: 'Следующий шаг', value: 'закрыть СДИЗ', tone: 'good' },
] as const;

export default function GrainDocumentsPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Документы зерновой сделки</div>
        <h1 style={h1}>СДИЗ, ЭТрН, УПД, акт, протокол и журнал оснований</h1>
        <p style={lead}>Документы показаны как условия сделки: источник, ответственный, статус, основание и влияние на выплату. Файл без статуса и ответственного не закрывает сделку.</p>
        <div style={actions}>
          <Link href='/platform-v7/documents' style={primaryBtn}>Матрица документов</Link>
          <Link href='/platform-v7/operator/grain' style={ghostBtn}>Очередь условий</Link>
          <Link href='/platform-v7/settlement/grain' style={ghostBtn}>Расчёт</Link>
        </div>
      </section>

      <section style={grid}>{metrics.map((item) => <Metric key={item.label} item={item} />)}</section>

      <section style={card}>
        <div style={micro}>Документный пакет</div>
        <div style={stepGrid}>{docs.map((doc, index) => <DocCard key={doc.title} doc={doc} index={index} />)}</div>
      </section>

      <section style={darkCard}>
        <div style={{ ...micro, color: '#A7F3D0' }}>Правило документов</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950 }}>Документ — не файл, а основание действия</h2>
        <p style={{ margin: 0, color: '#D1FAE5', fontSize: 14, lineHeight: 1.55 }}>Каждый документ должен иметь источник, ответственного, статус, связь со сделкой и влияние на деньги. Без этого выпуск, удержание или закрытие спора не выполняются.</p>
      </section>
    </main>
  );
}

function DocCard({ doc, index }: { doc: typeof docs[number]; index: number }) {
  return <Link href={doc.href} style={stepCard}><span style={{ ...num, background: color(doc.tone) }}>{index + 1}</span><strong style={title}>{doc.title}</strong><b style={{ ...value, color: color(doc.tone) }}>{doc.value}</b><span style={note}>{doc.note}</span><span style={{ ...cta, color: color(doc.tone) }}>Открыть</span></Link>;
}

function Metric({ item }: { item: typeof metrics[number] }) {
  return <div style={metricCard}><div style={micro}>{item.label}</div><div style={{ marginTop: 8, color: color(item.tone), fontSize: 22, lineHeight: 1.1, fontWeight: 950 }}>{item.value}</div></div>;
}

function color(tone: string) { return tone === 'bad' || tone === 'stop' ? '#B91C1C' : tone === 'warn' ? '#B45309' : tone === 'good' ? '#0A7A5F' : '#0F1419'; }

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
const num = { width: 28, height: 28, borderRadius: 999, color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 12, fontWeight: 900 } as const;
const title = { color: '#0F1419', fontSize: 17, lineHeight: 1.2, fontWeight: 900 } as const;
const value = { fontSize: 13, lineHeight: 1.3, fontWeight: 900 } as const;
const note = { color: '#64748B', fontSize: 13, lineHeight: 1.5 } as const;
const cta = { marginTop: 'auto', fontSize: 12, fontWeight: 900 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
