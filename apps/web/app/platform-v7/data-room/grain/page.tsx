import Link from 'next/link';

const records = [
  { title: 'Журнал оснований', value: '234 события', note: 'Каждое действие связано со сделкой, ролью, ответственным и основанием.', href: '/platform-v7/deals/DL-9106/clean', tone: 'good' },
  { title: 'Доказательства', value: '18 файлов', note: 'Фото, документы, акт, протокол и события рейса собраны в один пакет.', href: '/platform-v7/deals/DL-9106/evidence-pack', tone: 'good' },
  { title: 'Экспорт', value: 'только по роли', note: 'Выгрузка доступна только при наличии роли, основания и следа в журнале.', href: '/platform-v7/documents/grain', tone: 'warn' },
  { title: 'Доступ', value: 'ограничен', note: 'Просмотр и передача материалов зависят от роли, сделки и комплаенс-статуса.', href: '/platform-v7/compliance/grain', tone: 'stop' },
] as const;

const metrics = [
  { label: 'Пакет', value: 'DL-9106', tone: 'neutral' },
  { label: 'Файлов', value: '18', tone: 'good' },
  { label: 'Экспортов', value: '3 запроса', tone: 'warn' },
  { label: 'Доступ', value: 'роль + основание', tone: 'good' },
] as const;

export default function GrainDataRoomPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Data-room зерновой сделки</div>
        <h1 style={h1}>Журнал оснований, доказательства, экспорт и контроль доступа</h1>
        <p style={lead}>Data-room работает не как папка файлов, а как доказательный пакет сделки: каждый документ, экспорт, просмотр и доступ связаны с ролью, основанием, ответственным и журналом.</p>
        <div style={actions}>
          <Link href='/platform-v7/data-room' style={primaryBtn}>Data-room</Link>
          <Link href='/platform-v7/deals/DL-9106/evidence-pack' style={ghostBtn}>Доказательства</Link>
          <Link href='/platform-v7/documents/grain' style={ghostBtn}>Документы</Link>
        </div>
      </section>

      <section style={grid}>{metrics.map((item) => <Metric key={item.label} item={item} />)}</section>

      <section style={card}>
        <div style={micro}>Материалы и доступ</div>
        <div style={stepGrid}>{records.map((item, index) => <RecordCard key={item.title} item={item} index={index} />)}</div>
      </section>

      <section style={darkCard}>
        <div style={{ ...micro, color: '#C7D2FE' }}>Правило data-room</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950 }}>Data-room — это журнал оснований, а не папка файлов</h2>
        <p style={{ margin: 0, color: '#E0E7FF', fontSize: 14, lineHeight: 1.55 }}>Экспорт, просмотр и изменение доступа должны иметь роль, основание, ответственного и след в журнале. Без этого действие блокируется.</p>
      </section>
    </main>
  );
}

function RecordCard({ item, index }: { item: typeof records[number]; index: number }) {
  return <Link href={item.href} style={stepCard}><span style={{ ...num, background: color(item.tone) }}>{index + 1}</span><strong style={title}>{item.title}</strong><b style={{ ...value, color: color(item.tone) }}>{item.value}</b><span style={note}>{item.note}</span><span style={{ ...cta, color: color(item.tone) }}>Открыть</span></Link>;
}

function Metric({ item }: { item: typeof metrics[number] }) {
  return <div style={metricCard}><div style={micro}>{item.label}</div><div style={{ marginTop: 8, color: color(item.tone), fontSize: 22, lineHeight: 1.1, fontWeight: 950 }}>{item.value}</div></div>;
}

function color(tone: string) { return tone === 'bad' || tone === 'stop' ? '#B91C1C' : tone === 'warn' ? '#B45309' : tone === 'good' ? '#0A7A5F' : '#0F1419'; }

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const darkCard = { background: '#312E81', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.18)', color: '#4338CA', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#4338CA', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
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
