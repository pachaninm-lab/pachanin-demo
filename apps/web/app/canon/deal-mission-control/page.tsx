import Link from 'next/link';

const rail = [
  ['Цена и допуск', 'Завершено', '#22c55e'],
  ['Контрактование', 'Завершено', '#22c55e'],
  ['Логистика', 'В пути', '#60a5fa'],
  ['Приёмка', 'Ожидает слот', '#fbbf24'],
  ['Качество', 'Лаборатория после выгрузки', '#fbbf24'],
  ['Документы', 'Пакет собран на 92%', '#60a5fa'],
  ['Деньги', 'Hold до подтверждения', '#fb7185'],
  ['Спор / доказательства', 'Не открыт', '#94a3b8'],
] as const;

const kpis = [
  ['7 100 000 ₽', 'Сумма сделки'],
  ['420 т', 'Объём'],
  ['19:00', 'ETA по рейсу'],
  ['92%', 'Document completeness'],
] as const;

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#060b16', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', paddingBottom: 40 }}>
      <div style={{ padding: '14px 16px', background: 'rgba(6,11,22,.96)', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center' }}>
        <div style={{ color: '#22c55e', fontSize: 18, fontWeight: 800, flex: 1 }}>Прозрачная Цена</div>
        <div style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(34,197,94,.35)', color: '#22c55e', fontSize: 13, fontWeight: 700 }}>Deal Mission Control</div>
      </div>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '18px 16px 32px' }}>
        <div style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 30, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>DEAL-001</div>
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.04, marginTop: 8 }}>Кукуруза · АО Покупатель → КФХ Поставщик</div>
              <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 15 }}>Главный экран одной сделки: статус, деньги, блокеры и следующий переход по execution rail.</div>
            </div>
            <div style={{ padding: '9px 12px', borderRadius: 999, background: 'rgba(96,165,250,.08)', border: '1px solid rgba(96,165,250,.2)', color: '#60a5fa', fontSize: 13, fontWeight: 800 }}>Статус: logistics / pre-receiving</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginTop: 18 }}>
            {kpis.map(([v, l]) => (
              <div key={l} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 22, padding: 16, minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(34,197,94,.12)' }} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 900 }}>{v}</div>
                  <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 14 }}>{l}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14, marginTop: 14 }}>
            <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 24, padding: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Execution rail</div>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {rail.map(([title, status, tone]) => (
                  <div key={title} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '12px 14px', borderRadius: 18, border: '1px solid rgba(255,255,255,.05)' }}>
                    <div style={{ fontWeight: 700 }}>{title}</div>
                    <div style={{ color: tone, fontSize: 13, fontWeight: 800 }}>{status}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 24, padding: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Текущий владелец шага</div>
                <div style={{ marginTop: 8, color: '#dbe6f3', lineHeight: 1.55 }}>Логистика ведёт рейс до handoff в приёмку. После выгрузки ownership перейдёт к элеватору и лаборатории.</div>
              </div>
              <div style={{ background: 'rgba(251,113,133,.06)', border: '1px solid rgba(251,113,133,.16)', borderRadius: 24, padding: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Главные блокеры</div>
                <div style={{ marginTop: 8, color: '#fda4af', lineHeight: 1.55 }}>Без подтверждения качества, акта приёмки и банкового подтверждения платёж не должен перейти в release.</div>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                <Link href="/canon/money-command-center" style={{ textDecoration: 'none', background: '#22c55e', color: '#04110a', borderRadius: 18, padding: '13px 14px', fontWeight: 800 }}>Открыть деньги</Link>
                <Link href="/canon/operations-live-rail" style={{ textDecoration: 'none', background: 'rgba(255,255,255,.02)', color: '#f8fafc', borderRadius: 18, padding: '13px 14px', border: '1px solid rgba(255,255,255,.08)', fontWeight: 800 }}>Открыть логистику</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Link href="/canon/investor-control-room" style={{ position: 'fixed', right: 18, bottom: 18, width: 66, height: 66, borderRadius: 33, background: '#22c55e', color: '#04110a', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 28, fontWeight: 900 }}>←</Link>
    </main>
  );
}
