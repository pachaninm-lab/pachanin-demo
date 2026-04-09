import Link from 'next/link';

const steps = [
  ['1', 'Открыть роли', '/canon/roles', 'Role-first вход и быстрый доступ к кабинетам'],
  ['2', 'Открыть Control Center', '/canon', 'Единая карта контура исполнения сделки'],
  ['3', 'Открыть сделки', '/canon/deals', 'Статусы, execution rail, переход к деньгам'],
  ['4', 'Открыть финансы', '/canon/finance', 'Hold, release, callback, money-ready'],
  ['5', 'Открыть контроль', '/canon/control', 'Risk queue, блокеры, эскалации'],
  ['6', 'Открыть симуляции', '/canon/simulator', 'Критичные сценарии до live-интеграций'],
  ['7', 'Открыть интеграции', '/canon/integrations', 'Честная readiness-матрица'],
] as const;

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#050914', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Прозрачная Цена · Investor Walkthrough</div>
        <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.04, fontWeight: 900 }}>Маршрут показа инвестору</h1>
        <p style={{ margin: '14px 0 24px', color: '#94a3b8', fontSize: 17, lineHeight: 1.6 }}>Готовый порядок показа без воды: сначала вход и карта контура, затем сделка, деньги, контроль, симуляции и интеграции.</p>
        <div style={{ display: 'grid', gap: 12 }}>
          {steps.map(([num, title, href, text]) => (
            <Link key={num} href={href} style={{ textDecoration: 'none', color: 'inherit', background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: 18, display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(34,197,94,.14)', color: '#22c55e', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{num}</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{title}</div>
                <div style={{ marginTop: 6, color: '#8ea0b7', fontSize: 14, lineHeight: 1.5 }}>{text}</div>
              </div>
              <div style={{ color: '#22c55e', fontWeight: 800 }}>Открыть →</div>
            </Link>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
          <Link href="/demo" style={{ textDecoration: 'none', background: '#22c55e', color: '#04110a', borderRadius: 18, padding: '14px 18px', fontWeight: 800 }}>Вернуться в demo</Link>
          <Link href="/canon/roles" style={{ textDecoration: 'none', background: 'rgba(255,255,255,.04)', color: '#f8fafc', borderRadius: 18, padding: '14px 18px', border: '1px solid rgba(255,255,255,.12)', fontWeight: 800 }}>Открыть роли</Link>
        </div>
      </div>
    </main>
  );
}
