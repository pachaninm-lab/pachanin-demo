import Link from 'next/link';

const sections = [
  { title: 'Итоговый статус', value: 'частично закрыта', note: 'Показывает, какие условия сделки закрыты, какие удерживают деньги и где требуется действие.', href: '/platform-v7/settlement/grain', tone: 'warn' },
  { title: 'Доказательства', value: '18 файлов', note: 'Отчёт ссылается на документы, фото, акт, протокол и журнал событий.', href: '/platform-v7/data-room/grain', tone: 'good' },
  { title: 'Доступ', value: 'роль + основание', note: 'Руководитель видит сводку, но не получает лишний доступ к файлам без основания.', href: '/platform-v7/compliance/grain', tone: 'good' },
  { title: 'Выгрузка', value: 'готова к экспорту', note: 'Экспорт включает статус, блокеры, ответственных и ссылки на доказательства.', href: '/platform-v7/documents/grain', tone: 'good' },
] as const;

const metrics = [
  { label: 'Сделка', value: 'DL-9106', tone: 'neutral' },
  { label: 'Статус', value: 'под контролем', tone: 'good' },
  { label: 'Блокеров', value: '4', tone: 'warn' },
  { label: 'К выпуску', value: '0 ₽', tone: 'bad' },
] as const;

export default function GrainReportsPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Отчёт зерновой сделки</div>
        <h1 style={h1}>Итоговый статус, доказательства, доступ, выгрузка и управленческий контроль</h1>
        <p style={lead}>Отчёт показывает сделку как управляемый контур: статус условий, документы, деньги, доказательства, ответственных и следующий шаг. Это не папка файлов и не ручная сводка.</p>
        <div style={actions}>
          <Link href='/platform-v7/reports' style={primaryBtn}>Отчёты</Link>
          <Link href='/platform-v7/data-room/grain' style={ghostBtn}>Data-room</Link>
          <Link href='/platform-v7/operator/grain' style={ghostBtn}>Очередь условий</Link>
        </div>
      </section>

      <section style={grid}>{metrics.map((item) => <Metric key={item.label} item={item} />)}</section>

      <section style={card}>
        <div style={micro}>Состав отчёта</div>
        <div style={stepGrid}>{sections.map((item, index) => <ReportCard key={item.title} item={item} index={index} />)}</div>
      </section>

      <section style={darkCard}>
        <div style={{ ...micro, color: '#CBD5E1' }}>Правило отчёта</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950 }}>Отчёт показывает управление, а не заменяет роли</h2>
        <p style={{ margin: 0, color: '#CBD5E1', fontSize: 14, lineHeight: 1.55 }}>Если в отчёте есть открытый документ, спор, риск или денежный блокер, он должен вести к ответственному экрану и доказательству. Сводка не закрывает условие сама.</p>
      </section>
    </main>
  );
}

function ReportCard({ item, index }: { item: typeof sections[number]; index: number }) {
  return <Link href={item.href} style={stepCard}><span style={{ ...num, background: color(item.tone) }}>{index + 1}</span><strong style={title}>{item.title}</strong><b style={{ ...value, color: color(item.tone) }}>{item.value}</b><span style={note}>{item.note}</span><span style={{ ...cta, color: color(item.tone) }}>Открыть</span></Link>;
}

function Metric({ item }: { item: typeof metrics[number] }) {
  return <div style={metricCard}><div style={micro}>{item.label}</div><div style={{ marginTop: 8, color: color(item.tone), fontSize: 22, lineHeight: 1.1, fontWeight: 950 }}>{item.value}</div></div>;
}

function color(tone: string) { return tone === 'bad' || tone === 'stop' ? '#B91C1C' : tone === 'warn' ? '#B45309' : tone === 'good' ? '#0A7A5F' : '#0F1419'; }

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const darkCard = { background: '#0F172A', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(15,23,42,0.08)', border: '1px solid rgba(15,23,42,0.18)', color: '#0F172A', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
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
