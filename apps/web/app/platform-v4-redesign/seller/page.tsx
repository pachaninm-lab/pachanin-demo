import Link from 'next/link';

const money=[['Ожидаемые деньги','18,4 млн ₽'],['Зависло из-за документов','3 пакета'],['Следующее действие','Подписать акт приемки']];
const lots=[['LOT-001','Кукуруза · 420 т · офферы открыты'],['LOT-002','Пшеница · 260 т · нужен shortlist'],['LOT-003','Подсолнечник · 180 т · ручная проверка']];

export default function Page(){
  return <div style={{minHeight:'100vh',background:'#f8fafc',padding:24,color:'#0f172a'}}>
    <div style={{maxWidth:1200,margin:'0 auto',display:'grid',gap:16}}>
      <Link href='/platform-v4-redesign' style={{fontWeight:700,color:'#2563eb'}}>← Назад к preview</Link>
      <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:24}}>
        <div style={{fontSize:12,fontWeight:800,letterSpacing:'.08em',color:'#15803d'}}>SELLER</div>
        <h1 style={{margin:'10px 0 0',fontSize:'clamp(2rem,4vw,2.75rem)',lineHeight:1.1}}>Кабинет продавца начинается с денег, а не с KPI</h1>
        <p style={{margin:'12px 0 0',maxWidth:760,color:'#334155',lineHeight:1.6}}>Первый экран продавца показывает ожидаемые деньги, то что зависло, и ближайшее действие. Коммерция уходит ниже, управление деньгами — выше.</p>
      </section>
      <section style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:12}}>{money.map(([a,b])=><article key={a} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:18}}><div style={{fontSize:14,color:'#64748b'}}>{a}</div><div style={{marginTop:8,fontSize:28,fontWeight:800,fontVariantNumeric:'tabular-nums'}}>{b}</div></article>)}</section>
      <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:24}}>
        <h2 style={{margin:0,fontSize:22}}>Заявки на продажу</h2>
        <div style={{display:'grid',gap:12,marginTop:16}}>{lots.map(([a,b])=><article key={a} style={{padding:16,border:'1px solid #e2e8f0',borderRadius:12}}><div style={{fontWeight:800}}>{a}</div><div style={{marginTop:8,color:'#334155'}}>{b}</div></article>)}</div>
      </section>
    </div>
  </div>
}
