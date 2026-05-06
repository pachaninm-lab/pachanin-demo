import Link from 'next/link';

export default function BuyerNewRfqPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ color: '#2563EB', fontSize: 12, fontWeight: 900 }}>Покупатель</div>
        <h1 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 }}>Новый запрос</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 }}>Краткая форма потребности и переход к подбору вариантов.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/buyer/rfq/create' style={btn}>Создать</Link>
          <Link href='/platform-v7/buyer/matches' style={ghost}>Подбор</Link>
          <Link href='/platform-v7/buyer/offers' style={ghost}>Предложения</Link>
        </div>
      </section>
    </main>
  );
}

const btn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghost = { ...btn, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419' } as const;
