const steps = ['LOT-2403', 'ставка', 'победитель', 'DL-9106', 'LOG-REQ-2403', 'водитель', 'TRIP-SIM-001', 'маршрут', 'приёмка', 'деньги'] as const;

const links = [
  { title: 'Лот', href: '/platform-v7/lots/LOT-2403' },
  { title: 'Логистика', href: '/platform-v7/logistics/inbox' },
  { title: 'Водитель', href: '/platform-v7/driver' },
] as const;

export default function DemoRunPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', color: '#0F1419', border: '1px solid #E4E6EA', borderRadius: 20, padding: 22, display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, color: '#0A7A5F', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Маршрут исполнения</p>
        <h1 style={{ margin: 0, fontSize: 'clamp(28px,7vw,44px)', lineHeight: 1.08 }}>Цикл: торги → логистика → рейс → контроль</h1>
        <p style={{ margin: 0, color: '#5B6576', fontSize: 15, lineHeight: 1.55 }}>Показан один связанный маршрут сделки без заявления внешних подключений.</p>
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
