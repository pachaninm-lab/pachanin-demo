import Link from 'next/link';

const sections = [
  { title: 'Решение', value: 'держать выпуск закрытым', note: 'Открытые документы, риск и спор не дают основания для выплаты.', href: '/platform-v7/settlement/grain', tone: 'stop' },
  { title: 'Риск', value: '78/100', note: 'Аномалии доступа, обход и отклонение маршрута требуют контроля.', href: '/platform-v7/security/grain', tone: 'warn' },
  { title: 'Доказательства', value: 'пакет собран', note: 'Data-room содержит документы, фото, акт, протокол и журнал оснований.', href: '/platform-v7/data-room/grain', tone: 'good' },
  { title: 'Следующий шаг', value: 'закрыть СДИЗ', note: 'Ответственный экран — оператор сделки; действие ведёт к документному блоку.', href: '/platform-v7/operator/grain', tone: 'good' },
] as const;

const metrics = [
  { label: 'Сделка', value: 'DL-9106', tone: 'neutral' },
  { label: 'Деньги', value: '0 ₽ к выпуску', tone: 'bad' },
  { label: 'Риск', value: 'высокий', tone: 'warn' },
  { label: 'Контроль', value: 'назначен', tone: 'good' },
] as const;

export default function GrainExecutivePage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Executive summary зерновой сделки</div>
        <h1 style={h1}>Решение, риск, деньги, документы и следующий управленческий шаг</h1>
        <p style={lead}>Управленческий экран показывает сделку через контрольные рычаги: что блокирует деньги, где риск, какие доказательства собраны, кто ответственный и какое действие должно быть следующим.</p>
        <div style={actions}>
          <Link href='/platform-v7/executive' style={primaryBtn}>Executive</Link>
          <Link href='/platform-v7/reports/grain' style={ghostBtn}>Отчёт</Link>
          <Link href='/platform-v7/settlement/grain' style={ghostBtn}>Расчёт</Link>
        </div>
      </section>

      <section style={grid}>{metrics.map((item) => <Metric key={item.label} item={item} />)}</section>

      <section style={card}>
        <div style={micro}>Рычаги решения</div>
        <div style={stepGrid}>{sections.map((item, index) => <SectionCard key={item.title} item={item} index={index} />)}</div>
      </section>

      <section style={darkCard}>
        <div style={{ ...micro, color: '#CBD5E1' }}>Правило executive-view</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950 }}>Руководитель принимает решение по рычагам, а не вручную</h2>
        <p style={{ margin: 0, color: '#CBD5E1', fontSize: 14, lineHeight: 1.55 }}>Если деньги, риск или документы не закрыты, executive-view должен вести к ответственному экрану и основанию. Сводка не подменяет банк, оператора, комплаенс или арбитраж.</p>
      </section>
    </main>
  );
}

function SectionCard({ item, index }: { item: typeof sections[number]; index: number }) {
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
