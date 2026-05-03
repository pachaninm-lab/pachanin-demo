const steps = ['LOT-2403', 'ставка', 'победитель', 'DL-9106', 'LOG-REQ-2403', 'водитель', 'TRIP-SIM-001', 'маршрут', 'приёмка', 'деньги'] as const;

const links = [
  { title: 'Лот', href: '/platform-v7/lots/LOT-2403' },
  { title: 'Логистика', href: '/platform-v7/logistics/inbox' },
  { title: 'Водитель', href: '/platform-v7/driver' },
] as const;

export default function DemoRunPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#0F1419', color: '#fff', borderRadius: 24, padding: 22, display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, color: '#9FE3CC', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Пилотный сценарий</p>
        <h1 style={{ margin: 0, fontSize: 'clamp(30px,7.5vw,52px)', lineHeight: 1.04, letterSpacing: '-0.045em' }}>Цикл: торги → логистика → рейс → контроль</h1>
        <p style={{ margin: 0, color: '#CBD5E1', fontSize: 15, lineHeight: 1.55 }}>Показан один связанный сценарий без заявления боевых внешних подключений.</p>
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        {steps.map((step, index) => (
          <article key={step} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 15, display: 'grid', gap: 8 }}>
            <span style={{ color: '#64748B', fontSize: 11, fontWeight: 900 }}>{String(index + 1).padStart(2, '0')}</span>
            <b style={{ color: '#0F1419', fontSize: 16 }}>{step}</b>
          </article>
        ))}
      </section>
      <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {links.map((link) => (
          <a key={link.href} href={link.href} style={{ textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 }}>
            {link.title}
          </a>
        ))}
      </section>
    </main>
  );
}
