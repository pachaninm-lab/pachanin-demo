import Link from 'next/link';

export default function Page(){
  return <div style={{minHeight:'100vh',background:'#f8fafc',padding:24,color:'#0f172a'}}><div style={{maxWidth:1200,margin:'0 auto',display:'grid',gap:16}}>
    <Link href='/platform-v4-redesign' style={{fontWeight:700,color:'#2563eb'}}>← Назад к preview</Link>
    <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:24}}>
      <div style={{fontSize:12,fontWeight:800,letterSpacing:'.08em',color:'#2563eb'}}>DEAL</div>
      <h1 style={{margin:'10px 0 0',fontSize:'clamp(2rem,4vw,2.75rem)',lineHeight:1.1}}>Сделка начинается с cockpit</h1>
      <p style={{margin:'12px 0 0',maxWidth:760,color:'#334155',lineHeight:1.6}}>Верх экрана собирает статус, причину задержки, следующий шаг и сумму под удержанием. Ниже — отдельные зоны: исполнение, документы, банк, контроль.</p>
    </section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:12}}>
      {['В пути','Нет акта приемки','Gate-in и handoff','250 000 ₽ hold'].map((x)=><article key={x} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:18,fontWeight:800}}>{x}</article>)}
    </section>
  </div></div>
}
