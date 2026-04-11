import Link from 'next/link';

export default function Page(){
  return <div style={{minHeight:'100vh',background:'#f8fafc',padding:24,color:'#0f172a'}}><div style={{maxWidth:720,margin:'0 auto',display:'grid',gap:16}}>
    <Link href='/platform-v4-redesign' style={{fontWeight:700,color:'#2563eb'}}>← Назад к preview</Link>
    <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:24}}>
      <div style={{fontSize:12,fontWeight:800,letterSpacing:'.08em',color:'#15803d'}}>DRIVER MOBILE</div>
      <h1 style={{margin:'10px 0 0',fontSize:'clamp(2rem,4vw,2.5rem)',lineHeight:1.1}}>Один экран — один шаг</h1>
      <p style={{margin:'12px 0 0',color:'#334155',lineHeight:1.6}}>Полевой сценарий упрощён до текущего действия, крупной кнопки, статуса офлайна и аварийного блока.</p>
    </section>
    <article style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:24,display:'grid',gap:16}}>
      <div style={{fontSize:14,color:'#64748b'}}>Следующий шаг</div>
      <div style={{fontSize:28,fontWeight:800}}>Прибытие на площадку</div>
      <button style={{minHeight:56,border:0,borderRadius:12,background:'#2563eb',color:'#fff',fontWeight:800,fontSize:16}}>Подтвердить прибытие</button>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><span style={{padding:'6px 10px',borderRadius:999,background:'rgba(22,163,74,.08)',color:'#16a34a',fontSize:12,fontWeight:700}}>GPS идет</span><span style={{padding:'6px 10px',borderRadius:999,background:'rgba(245,158,11,.08)',color:'#b45309',fontSize:12,fontWeight:700}}>2 события offline</span></div>
      <button style={{minHeight:44,border:'1px solid #fecaca',borderRadius:12,background:'#fff',color:'#dc2626',fontWeight:800,fontSize:14}}>Сообщить о проблеме</button>
    </article>
  </div></div>
}
