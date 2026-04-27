import Link from 'next/link';

export function P7MarketRfqEntry() {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: '#B45309', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Market / RFQ · sandbox</div>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900, color: '#0F1419' }}>Лоты, заявки и оферты</div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>Быстрый вход в предсделочный раздел платформы.</div>
        </div>
        <Link href='/platform-v7/market-rfq' style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 13, fontWeight: 800 }}>
          Открыть →
        </Link>
      </div>
    </section>
  );
}
