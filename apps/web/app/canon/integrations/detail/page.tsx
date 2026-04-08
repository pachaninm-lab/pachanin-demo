import Link from 'next/link';

const rows = [
  ['Сбер / nominal account', 'Требуется live договор, продовые ключи и verified callbacks'],
  ['ФГИС «Зерно»', 'Нужен боевой маршрут по СДИЗ и отдельная маркировка sandbox/manual/live'],
  ['ЭДО / КЭП / МЧД', 'Нужны живые провайдеры, подписи и матрица document completeness'],
  ['GPS / телематика', 'Нужен live ETA, geofence и журнал route deviation'],
  ['1С / бухгалтерия', 'Нужна стабильная выгрузка сделок, актов, оплат и сверок'],
  ['ГИС ЭПД', 'Нужен отдельный обязательный транспортный контур'],
] as const;

export default function Page() {
  return (
    <main style={{ minHeight:'100vh', background:'#060b16', color:'#f8fafc', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', paddingBottom:40 }}>
      <div style={{ padding:'14px 16px', background:'rgba(6,11,22,.96)', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center' }}>
        <div style={{ color:'#22c55e', fontSize:18, fontWeight:800, flex:1 }}>Прозрачная Цена</div>
        <div style={{ padding:'6px 12px', borderRadius:999, border:'1px solid rgba(34,197,94,.35)', color:'#22c55e', fontSize:13, fontWeight:700 }}>Интеграции · DETAIL</div>
      </div>
      <div style={{ maxWidth:760, margin:'0 auto', padding:'18px 16px 32px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1.2fr .8fr', gap:14 }}>
          <section style={{ background:'#0b1220', border:'1px solid rgba(255,255,255,.08)', borderRadius:28, padding:18 }}>
            <div style={{ fontSize:30, fontWeight:800 }}>Матрица readiness</div>
            <div style={{ color:'#94a3b8', marginTop:6 }}>Что уже собрано в продукте и что ещё требует live-подключения.</div>
            <div style={{ marginTop:16, display:'grid', gap:10 }}>
              {rows.map(([name,text]) => (
                <div key={name} style={{ padding:'12px 14px', border:'1px solid rgba(255,255,255,.06)', borderRadius:18 }}>
                  <div style={{ fontWeight:700 }}>{name}</div>
                  <div style={{ color:'#94a3b8', marginTop:4, fontSize:14 }}>{text}</div>
                </div>
              ))}
            </div>
          </section>
          <section style={{ background:'#0b1220', border:'1px solid rgba(255,255,255,.08)', borderRadius:28, padding:18 }}>
            <div style={{ fontSize:22, fontWeight:800 }}>Следующий шаг</div>
            <div style={{ marginTop:10, color:'#cbd5e1' }}>Приоритет: Сбер → ЭДО/КЭП → ФГИС → GPS → 1С.</div>
            <Link href="/canon/finance/detail" style={{ display:'inline-flex', marginTop:14, padding:'10px 14px', borderRadius:999, textDecoration:'none', background:'#22c55e', color:'#04110a', fontWeight:800 }}>Открыть деньги</Link>
          </section>
        </div>
      </div>
      <Link href="/canon/integrations" style={{ position:'fixed', right:18, bottom:18, width:66, height:66, borderRadius:33, background:'#22c55e', color:'#04110a', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', fontSize:28, fontWeight:900 }}>←</Link>
    </main>
  );
}
