import Link from 'next/link';

const prices = [
  ['Пшеница 3 кл.', '16 450 ₽/т', '+2.4%'],
  ['Ячмень', '12 900 ₽/т', '+1.1%'],
  ['Кукуруза', '13 200 ₽/т', '+0.8%'],
  ['Подсолнечник', '31 800 ₽/т', '+3.7%'],
] as const;

const roles = [
  ['Фермер', 'farmer@demo.ru', '/canon/market'],
  ['Покупатель', 'buyer@demo.ru', '/canon/deals'],
  ['Бухгалтерия', 'accounting@demo.ru', '/canon/finance'],
  ['Оператор', 'operator@demo.ru', '/canon/control'],
  ['Водитель', 'driver@demo.ru', '/canon/mobile2'],
  ['Руководитель', 'executive@demo.ru', '/canon/analytics2'],
] as const;

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, rgba(30,64,175,.18) 0%, rgba(5,9,20,1) 28%, rgba(4,7,15,1) 100%)', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '24px 16px 56px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Прозрачная Цена · Showroom</div>
        <h1 style={{ margin: 0, fontSize: 54, lineHeight: 1.02, fontWeight: 900, letterSpacing: '-0.03em', maxWidth: 980 }}>Живой вход в платформу, а не поэтапное demo</h1>
        <p style={{ margin: '16px 0 22px', color: '#94a3b8', fontSize: 18, lineHeight: 1.6, maxWidth: 980 }}>Рыночный экран, роли, рабочие очереди и переходы в модули сделки в одном пространстве.</p>

        <section style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 14 }}>
          <div style={{ background: 'linear-gradient(180deg, rgba(11,18,32,.98) 0%, rgba(9,14,27,.98) 100%)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 28, padding: 18 }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>Рыночный экран</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginTop: 14 }}>
              {prices.map(([title, price, delta]) => (
                <a key={title} href="/api/auth/demo?email=farmer@demo.ru&to=/canon/market" style={{ textDecoration: 'none', color: 'inherit', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 22, padding: 16, minHeight: 138, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(34,197,94,.12)' }} />
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.12 }}>{title}</div>
                    <div style={{ marginTop: 10, fontSize: 24, fontWeight: 900 }}>{price}</div>
                    <div style={{ marginTop: 6, color: '#22c55e', fontSize: 13, fontWeight: 800 }}>{delta}</div>
                  </div>
                </a>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              <Link href="/canon/workspace" style={{ textDecoration: 'none', background: '#22c55e', color: '#04110a', borderRadius: 18, padding: '13px 16px', fontWeight: 800 }}>Открыть workspace</Link>
              <Link href="/canon/investor-suite" style={{ textDecoration: 'none', background: 'rgba(255,255,255,.04)', color: '#f8fafc', borderRadius: 18, padding: '13px 16px', border: '1px solid rgba(255,255,255,.12)', fontWeight: 800 }}>Investor suite</Link>
            </div>
          </div>

          <div style={{ background: 'linear-gradient(180deg, rgba(11,18,32,.98) 0%, rgba(9,14,27,.98) 100%)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 28, padding: 18 }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>Вход в роли</div>
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {roles.map(([label, email, to]) => (
                <a key={label} href={`/api/auth/demo?email=${encodeURIComponent(email)}&to=${encodeURIComponent(to)}`} style={{ textDecoration: 'none', color: 'inherit', padding: '13px 14px', borderRadius: 18, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)', fontWeight: 700 }}>
                  {label}
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
