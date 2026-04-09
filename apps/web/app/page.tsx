const roles = [
  ['Фермер / Продавец', 'farmer@demo.ru', 'Продажа зерна, рынок, buyer offers', '/canon/market'],
  ['Покупатель', 'buyer@demo.ru', 'Сделки, исполнение, приёмка', '/canon/deals'],
  ['Бухгалтерия', 'accounting@demo.ru', 'Платежи, hold/release, ЭДО', '/canon/finance'],
  ['Логистика / Операции', 'logistic@demo.ru', 'Рейсы, слоты, handoff', '/canon/operations'],
  ['Лаборатория', 'lab@demo.ru', 'Качество, протоколы, price impact', '/canon/quality'],
  ['Оператор / Контроль', 'operator@demo.ru', 'Риски, споры, блокеры, эскалации', '/canon/control'],
  ['Руководитель', 'executive@demo.ru', 'KPI, тренды, деньги, узкие места', '/canon/analytics2'],
  ['Элеватор / Приёмка', 'elevator@demo.ru', 'Очередь, весовая, выгрузка', '/canon/receiving2'],
  ['Водитель / Mobile', 'driver@demo.ru', 'Маршрут, ETA, чекпоинты', '/canon/mobile2'],
  ['Администратор', 'admin@demo.ru', 'Роли, компании, доступы, аудит', '/canon/admin'],
] as const;

export default function Page() {
  return (
    <main style={{ minHeight:'100vh', background:'#050914', color:'#f8fafc', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding:'24px 16px 48px' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div style={{ color:'#22c55e', fontWeight:800, fontSize:15, marginBottom:16 }}>Прозрачная Цена</div>
        <h1 style={{ margin:0, fontSize:44, lineHeight:1.05, fontWeight:800 }}>Выберите роль</h1>
        <p style={{ margin:'14px 0 24px', color:'#94a3b8', fontSize:16, lineHeight:1.5 }}>Один вход. Один канон. Каждая роль попадает сразу в свой рабочий кабинет.</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))', gap:14 }}>
          {roles.map(([title, email, text, href]) => (
            <a key={title} href={`/api/auth/demo?email=${encodeURIComponent(email)}&to=${encodeURIComponent(href)}`} style={{ textDecoration:'none', color:'inherit', background:'#0b1220', border:'1px solid rgba(255,255,255,.08)', borderRadius:24, padding:18, minHeight:156, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div style={{ width:56, height:56, borderRadius:18, background:'rgba(34,197,94,.14)' }} />
              <div>
                <div style={{ fontSize:22, fontWeight:700, lineHeight:1.1 }}>{title}</div>
                <div style={{ color:'#8aa0b8', fontSize:15, lineHeight:1.35, marginTop:10 }}>{text}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
