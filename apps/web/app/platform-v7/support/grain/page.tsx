import Link from 'next/link';

const cases = [
  { title: 'Обращение', value: 'SUP-9106', note: 'Покупатель сообщил расхождение по партии. Обращение связано со сделкой, рейсом и документами.', href: '/platform-v7/support', tone: 'warn' },
  { title: 'SLA', value: '2ч 15м осталось', note: 'Срок реакции привязан к деньгам, спору и блокирующим документам.', href: '/platform-v7/operator/grain', tone: 'warn' },
  { title: 'Ответственный', value: 'оператор сделки', note: 'Ответственный собирает акт, протокол, фото и комментарии сторон.', href: '/platform-v7/operator/grain', tone: 'good' },
  { title: 'Доказательства', value: '18 файлов', note: 'Файлы прикреплены к сделке и доступны в доказательном пакете.', href: '/platform-v7/deals/DL-9106/evidence-pack', tone: 'good' },
] as const;

const metrics = [
  { label: 'Статус', value: 'в работе', tone: 'warn' },
  { label: 'SLA', value: '2ч 15м', tone: 'warn' },
  { label: 'Деньги', value: 'выпуск закрыт', tone: 'bad' },
  { label: 'Следующий шаг', value: 'собрать акт', tone: 'good' },
] as const;

export default function GrainSupportPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Поддержка зерновой сделки</div>
        <h1 style={h1}>Обращение, SLA, ответственный, доказательства и блокировка денег</h1>
        <p style={lead}>Поддержка работает не как общий чат, а как контур исполнения: обращение связано со сделкой, рейсом, документами, доказательствами, деньгами и ответственным действием.</p>
        <div style={actions}>
          <Link href='/platform-v7/support' style={primaryBtn}>Центр поддержки</Link>
          <Link href='/platform-v7/settlement/grain' style={ghostBtn}>Расчёт</Link>
          <Link href='/platform-v7/security/grain' style={ghostBtn}>Риск-контроль</Link>
        </div>
      </section>

      <section style={grid}>{metrics.map((item) => <Metric key={item.label} item={item} />)}</section>

      <section style={card}>
        <div style={micro}>Карточка обращения</div>
        <div style={stepGrid}>{cases.map((item, index) => <CaseCard key={item.title} item={item} index={index} />)}</div>
      </section>

      <section style={darkCard}>
        <div style={{ ...micro, color: '#BFDBFE' }}>Правило поддержки</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950 }}>Поддержка не выпускает деньги вручную</h2>
        <p style={{ margin: 0, color: '#DBEAFE', fontSize: 14, lineHeight: 1.55 }}>Если обращение связано с деньгами, документами, приёмкой или спором, поддержка собирает основание и передаёт его оператору. Выпуск остаётся закрытым до выполнения условий сделки.</p>
      </section>
    </main>
  );
}

function CaseCard({ item, index }: { item: typeof cases[number]; index: number }) {
  return <Link href={item.href} style={stepCard}><span style={{ ...num, background: color(item.tone) }}>{index + 1}</span><strong style={title}>{item.title}</strong><b style={{ ...value, color: color(item.tone) }}>{item.value}</b><span style={note}>{item.note}</span><span style={{ ...cta, color: color(item.tone) }}>Открыть</span></Link>;
}

function Metric({ item }: { item: typeof metrics[number] }) {
  return <div style={metricCard}><div style={micro}>{item.label}</div><div style={{ marginTop: 8, color: color(item.tone), fontSize: 22, lineHeight: 1.1, fontWeight: 950 }}>{item.value}</div></div>;
}

function color(tone: string) { return tone === 'bad' || tone === 'stop' ? '#B91C1C' : tone === 'warn' ? '#B45309' : tone === 'good' ? '#0A7A5F' : '#0F1419'; }

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const darkCard = { background: '#1E3A8A', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#1D4ED8', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#1D4ED8', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
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
