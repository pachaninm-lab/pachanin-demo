import Link from 'next/link';

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#060b16', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', paddingBottom: 40 }}>
      <div style={{ padding: '14px 16px', background: 'rgba(6,11,22,.96)', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center' }}>
        <div style={{ color: '#22c55e', fontSize: 18, fontWeight: 800, flex: 1 }}>Прозрачная Цена</div>
        <div style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(34,197,94,.35)', color: '#22c55e', fontSize: 13, fontWeight: 700 }}>Операции</div>
      </div>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '18px 16px 0' }}>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
          {[
            ['3', 'Активные рейсы'],
            ['7', 'На линии'],
            ['42', 'Завершено за месяц'],
            ['1', 'Инцидентов'],
          ].map(([value, label]) => (
            <a key={label} href="#" style={{ textDecoration: 'none', color: 'inherit', background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: 18, minHeight: 124, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ width: 46, height: 46, borderRadius: 16, background: 'rgba(34,197,94,.14)' }} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
                <div style={{ color: '#94a3b8', marginTop: 6 }}>{label}</div>
              </div>
            </a>
          ))}
        </section>
        <section style={{ marginTop: 20, background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 28, padding: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Рабочая очередь</div>
          {[
            ['Рейс #A-123', 'Маршрут подтверждён · прибытие 19:00', 'Доставка'],
            ['Партия #PK-456', 'Проверка качества · отклонения незначительные', 'Протокол'],
            ['Очередь приёмки', 'Пять машин в слоте · окно 10:30–12:00', 'Слот'],
          ].map(([title, meta, status]) => (
            <a key={title} href="#" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 0', borderTop: '1px solid rgba(255,255,255,.05)', textDecoration: 'none', color: 'inherit' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
                <div style={{ color: '#7c8da3', fontSize: 14, marginTop: 4 }}>{meta}</div>
              </div>
              <div style={{ color: status === 'Протокол' ? '#fbbf24' : '#60a5fa', fontSize: 13, fontWeight: 700 }}>{status}</div>
            </a>
          ))}
        </section>
      </div>
      <Link href="/canon" style={{ position: 'fixed', right: 18, bottom: 18, width: 66, height: 66, borderRadius: 33, background: '#22c55e', color: '#04110a', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 28, fontWeight: 900 }}>✦</Link>
    </main>
  );
}
