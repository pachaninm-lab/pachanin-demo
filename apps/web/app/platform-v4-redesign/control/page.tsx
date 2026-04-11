import Link from 'next/link';

export default function Page(){
  const rows=['1 открытый кейс','250 000 ₽ под hold','Evidence pack собран','Owner и срок видны'];
  return <div style={{minHeight:'100vh',background:'#f8fafc',padding:24,color:'#0f172a'}}><div style={{maxWidth:1200,margin:'0 auto',display:'grid',gap:16}}>
    <Link href='/platform-v4-redesign' style={{fontWeight:700,color:'#2563eb'}}>← Назад к preview</Link>
    <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:24}}><div style={{fontSize:12,fontWeight:800,letterSpacing:'.08em',color:'#dc2626'}}>CONTROL / DISPUTE</div><h1 style={{margin:'10px 0 0',fontSize:'clamp(2rem,4vw,2.75rem)',lineHeight:1.1}}>Контроль показывает деньги, SLA и доказательства</h1><p style={{margin:'12px 0 0',maxWidth:760,color:'#334155',lineHeight:1.6}}>Экран контроля убран из режима «ещё одна вкладка» и превращён в war-room: кейс, сумма под удержанием, доказательства и ответственный.</p></section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:12}}>{rows.map((x)=><article key={x} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:18,fontWeight:800}}>{x}</article>)}</section>
  </div></div>
}
