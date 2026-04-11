import Link from 'next/link';

const roles=['seller','buyer','deal','driver','receiving','bank','documents','control'];
export default function Page(){
  return <div style={{minHeight:'100vh',background:'#f8fafc',padding:24,color:'#0f172a'}}><div style={{maxWidth:1200,margin:'0 auto',display:'grid',gap:16}}>
    <Link href='/platform-v4-redesign' style={{fontWeight:700,color:'#2563eb'}}>← Назад к preview</Link>
    <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:24}}><div style={{fontSize:12,fontWeight:800,letterSpacing:'.08em',color:'#2563eb'}}>ROLES</div><h1 style={{margin:'10px 0 0',fontSize:'clamp(2rem,4vw,2.75rem)',lineHeight:1.1}}>Вход в рабочее место, а не в персонажа</h1><p style={{margin:'12px 0 0',maxWidth:760,color:'#334155',lineHeight:1.6}}>Роли ведут в конкретные redesign-сценарии: seller, buyer, deal, driver, receiving, bank, documents и control.</p></section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:12}}>{roles.map((x)=><Link key={x} href={`/platform-v4/redesign/${x}`} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:18,fontWeight:800,textTransform:'capitalize'}}>{x}</Link>)}</section>
  </div></div>
}
