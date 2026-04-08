import Link from 'next/link';

const rows = [
  ['Влажность, %', '14', '14.2', '+0.2'],
  ['Сорная примесь, %', '1', '1.1', '+0.1'],
  ['Зерновая примесь, %', '1.5', '1.8', '+0.3'],
  ['Битые зёрна, %', '3', '3.5', '+0.5'],
];

export default function Page() {
  return (
    <main style={{ minHeight:'100vh', background:'#060b16', color:'#f8fafc', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', paddingBottom:40 }}>
      <div style={{ padding:'14px 16px', background:'rgba(6,11,22,.96)', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center' }}>
        <div style={{ color:'#22c55e', fontSize:18, fontWeight:800, flex:1 }}>Прозрачная Цена</div>
        <div style={{ padding:'6px 12px', borderRadius:999, border:'1px solid rgba(34,197,94,.35)', color:'#22c55e', fontSize:13, fontWeight:700 }}>Лаборатория</div>
      </div>
      <div style={{ maxWidth:620, margin:'0 auto', padding:'18px 16px 0' }}>
        <section style={{ background:'#0b1220', border:'1px solid rgba(255,255,255,.08)', borderRadius:28, padding:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
            <div>
              <div style={{ fontSize:34, fontWeight:800, lineHeight:1.02 }}>Протокол ПК-2026-0456</div>
              <div style={{ color:'#94a3b8', marginTop:8 }}>Сделка #deal-1 · Кукуруза · Лаборатория</div>
            </div>
            <Link href="/canon/quality/detail" style={{ background:'rgba(251,191,36,.14)', color:'#fbbf24', borderRadius:16, padding:'10px 14px', fontWeight:800, textDecoration:'none' }}>Открыть detail</Link>
          </div>
          <div style={{ display:'grid', gap:10, marginTop:18 }}>
            {rows.map(([name, base, fact, delta]) => (
              <Link key={name} href="/canon/quality/detail" style={{ display:'grid', gridTemplateColumns:'1.5fr .8fr .8fr .8fr', gap:10, padding:'12px 0', borderTop:'1px solid rgba(255,255,255,.05)', textDecoration:'none', color:'inherit' }}>
                <div style={{ fontSize:17, fontWeight:600 }}>{name}</div>
                <div style={{ color:'#94a3b8' }}>{base}</div>
                <div>{fact}</div>
                <div style={{ color:'#fbbf24', fontWeight:700 }}>{delta}</div>
              </Link>
            ))}
          </div>
          <div style={{ marginTop:16, background:'rgba(251,191,36,.08)', border:'1px solid rgba(251,191,36,.22)', borderRadius:20, padding:16 }}>
            <div style={{ fontSize:22, fontWeight:800, marginBottom:8 }}>Влияние на цену</div>
            <div style={{ color:'#cbd5e1', fontSize:17 }}>Рекомендуемая корректировка: -50 ₽/т</div>
          </div>
        </section>
      </div>
      <Link href="/canon" style={{ position:'fixed', right:18, bottom:18, width:66, height:66, borderRadius:33, background:'#22c55e', color:'#04110a', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', fontSize:28, fontWeight:900 }}>✦</Link>
    </main>
  );
}
