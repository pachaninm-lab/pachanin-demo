import Link from 'next/link';

const queue = [
  ['Подтверждение затягивается', 'SLA 00:14'],
  ['Ретест не закрыт', 'SLA 00:42'],
  ['Окно приёмки под риском', 'SLA 00:26'],
  ['Финальный акт не загружен', 'SLA 01:10'],
] as const;

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#060b16', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', paddingBottom: 40 }}>
      <div style={{ padding: '14px 16px', background: 'rgba(6,11,22,.96)', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center' }}>
        <div style={{ color: '#22c55e', fontSize: 18, fontWeight: 800, flex: 1 }}>Прозрачная Цена</div>
        <div style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(34,197,94,.35)', color: '#22c55e', fontSize: 13, fontWeight: 700 }}>Investor Risk</div>
      </div>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '18px 16px 32px' }}>
        <div style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 30, padding: 20 }}>
          <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>Контроль и эскалации</div>
          <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.04, marginTop: 8 }}>Очередь рисков и следующий управленческий шаг</div>
          <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 15 }}>Экран показывает инвестору: проблема не теряется, у неё есть время, приоритет и владелец решения.</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {queue.map(([name, sla]) => (
              <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '12px 14px', borderRadius: 18, border: '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ fontWeight: 700 }}>{name}</div>
                <div style={{ color: '#fbbf24', fontSize: 13, fontWeight: 800 }}>{sla}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <Link href="/canon/control" style={{ textDecoration: 'none', background: 'rgba(255,255,255,.02)', color: '#f8fafc', borderRadius: 18, padding: '13px 14px', border: '1px solid rgba(255,255,255,.08)', fontWeight: 800 }}>Открыть контроль</Link>
            <Link href="/canon/investor-suite" style={{ textDecoration: 'none', background: '#22c55e', color: '#04110a', borderRadius: 18, padding: '13px 14px', fontWeight: 800 }}>Открыть investor suite</Link>
          </div>
        </div>
      </div>
      <Link href="/canon/investor-suite" style={{ position: 'fixed', right: 18, bottom: 18, width: 66, height: 66, borderRadius: 33, background: '#22c55e', color: '#04110a', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 28, fontWeight: 900 }}>←</Link>
    </main>
  );
}
