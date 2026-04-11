import Link from 'next/link';

export default function Page(){
  const offers=[['Пшеница','15 200 ₽/т · CPT Тамбов'],['Кукуруза','13 100 ₽/т · EXW элеватор'],['Соя','36 200 ₽/т · FOB склад']];
  const compare=[['Landed price','15 900 ₽/т'],['Качество','в базисе'],['Оплата','ждёт банк']];
  return <div style={{minHeight:'100vh',background:'#f8fafc',padding:24,color:'#0f172a'}}><div style={{maxWidth:1200,margin:'0 auto',display:'grid',gap:16}}>
    <Link href='/platform-v4-redesign' style={{fontWeight:700,color:'#2563eb'}}>← Назад к preview</Link>
    <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:24}}><div style={{fontSize:12,fontWeight:800,letterSpacing:'.08em',color:'#2563eb'}}>BUYER</div><h1 style={{margin:'10px 0 0',fontSize:'clamp(2rem,4vw,2.75rem)',lineHeight:1.1}}>Покупатель видит shortlist, а не бесконечную витрину</h1><p style={{margin:'12px 0 0',maxWidth:760,color:'#334155',lineHeight:1.6}}>Экран переведён в режим выбора: цена, качество, статус оплаты и понятный shortlist.</p></section>
    <section style={{display:'grid',gridTemplateColumns:'1.2fr .8fr',gap:16}}>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:24}}><h2 style={{margin:0,fontSize:22}}>Shortlist</h2><div style={{display:'grid',gap:12,marginTop:16}}>{offers.map(([a,b])=><article key={a} style={{padding:16,border:'1px solid #e2e8f0',borderRadius:12}}><div style={{fontWeight:800}}>{a}</div><div style={{marginTop:8,color:'#334155'}}>{b}</div></article>)}</div></div>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:24}}><h2 style={{margin:0,fontSize:22}}>Сравнение</h2><div style={{display:'grid',gap:12,marginTop:16}}>{compare.map(([a,b])=><article key={a} style={{padding:16,border:'1px solid #e2e8f0',borderRadius:12}}><div style={{fontSize:14,color:'#64748b'}}>{a}</div><div style={{marginTop:8,fontWeight:800}}>{b}</div></article>)}</div></div>
    </section>
  </div></div>
}
