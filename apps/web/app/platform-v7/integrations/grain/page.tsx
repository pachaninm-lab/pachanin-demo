import Link from 'next/link';

const items = [
  ['Канал партии', 'на проверке', '/platform-v7/deals/grain-sdiz'],
  ['Канал перевозки', 'ждёт подписи', '/platform-v7/deals/DL-9106/transport-documents'],
  ['Канал расчёта', 'в норме', '/platform-v7/settlement/grain'],
  ['Канал качества', 'ответ ожидается', '/platform-v7/lab/grain'],
] as const;

export default function GrainIntegrationsPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ color: '#1D4ED8', fontSize: 12, fontWeight: 900 }}>Состояние каналов сделки</div>
        <h1 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 }}>Каналы партии, перевозки, расчёта, качества и логистики</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 }}>Экран показывает статус внешних каналов, ответственного и следующий шаг по сделке.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/integrations' style={btn}>Интеграции</Link>
          <Link href='/platform-v7/documents/grain' style={ghost}>Документы</Link>
          <Link href='/platform-v7/data-room/grain' style={ghost}>Data-room</Link>
        </div>
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
        {items.map(([title, value, href], index) => <Link key={title} href={href} style={card}><b>{index + 1}. {title}</b><span style={{ color: '#B45309', fontWeight: 900 }}>{value}</span><span style={{ color: '#64748B' }}>Открыть</span></Link>)}
      </section>
    </main>
  );
}

const btn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#1D4ED8', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghost = { ...btn, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419' } as const;
const card = { textDecoration: 'none', minHeight: 150, display: 'grid', gap: 8, padding: 14, borderRadius: 18, background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419' } as const;
