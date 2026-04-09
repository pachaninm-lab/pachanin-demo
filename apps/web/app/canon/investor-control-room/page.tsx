import Link from 'next/link';

const rooms = [
  ['Deal Mission Control', '/canon/deal-mission-control', 'Главный экран одной сделки: execution rail, владелец шага, блокеры, деньги, next action'],
  ['Money Command Center', '/canon/money-command-center', 'Hold, release, callback, money-ready и прямое влияние документов на выпуск денег'],
  ['Risk & Dispute Cockpit', '/canon/risk-dispute-cockpit', 'Очередь риска, деньги под риском, эскалации и operator ownership'],
  ['Operations Live Rail', '/canon/operations-live-rail', 'Рейс, ETA, чекпоинты, handoff, slot discipline и доказуемая логистика'],
  ['Investor Walkthrough', '/canon/investor-walkthrough', 'Готовый маршрут показа инвестору без лишних слов'],
] as const;

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, rgba(30,64,175,.18) 0%, rgba(5,9,20,1) 28%, rgba(4,7,15,1) 100%)', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '24px 16px 56px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Прозрачная Цена · Investor Control Room</div>
        <h1 style={{ margin: 0, fontSize: 54, lineHeight: 1.02, fontWeight: 900, letterSpacing: '-0.03em' }}>Investor control room</h1>
        <p style={{ margin: '16px 0 24px', color: '#94a3b8', fontSize: 18, lineHeight: 1.6, maxWidth: 920 }}>Отдельный контур для показа инвестору: не просто список экранов, а набор сильных кабинетов, которые демонстрируют деньги, исполнение, риск и контроль сделки.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          {rooms.map(([title, href, text]) => (
            <Link key={href} href={href} style={{ textDecoration: 'none', color: 'inherit', background: 'linear-gradient(180deg, rgba(11,18,32,.98) 0%, rgba(9,14,27,.98) 100%)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 28, padding: 20, display: 'block', boxShadow: '0 16px 60px rgba(0,0,0,.28)' }}>
              <div style={{ width: 54, height: 54, borderRadius: 18, background: 'rgba(34,197,94,.14)' }} />
              <div style={{ marginTop: 18, fontSize: 24, fontWeight: 800, lineHeight: 1.08 }}>{title}</div>
              <div style={{ marginTop: 8, color: '#8ea0b7', fontSize: 14, lineHeight: 1.55 }}>{text}</div>
              <div style={{ marginTop: 16, color: '#22c55e', fontSize: 13, fontWeight: 800 }}>Открыть →</div>
            </Link>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
          <Link href="/demo" style={{ textDecoration: 'none', background: '#22c55e', color: '#04110a', borderRadius: 18, padding: '14px 18px', fontWeight: 800 }}>Открыть demo</Link>
          <Link href="/canon/roles" style={{ textDecoration: 'none', background: 'rgba(255,255,255,.04)', color: '#f8fafc', borderRadius: 18, padding: '14px 18px', border: '1px solid rgba(255,255,255,.12)', fontWeight: 800 }}>Открыть роли</Link>
        </div>
      </div>
    </main>
  );
}
