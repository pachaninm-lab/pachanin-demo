import Link from 'next/link';

const cards = [
  { href: '/canon/roles', title: 'Роли', text: 'Единый role-first вход' },
  { href: '/canon/market', title: 'Продавец', text: 'Рынок, офферы и переход в сделку' },
  { href: '/canon/deals', title: 'Сделки', text: 'Execution rail и статусы' },
  { href: '/canon/documents', title: 'Документы', text: 'Пакеты и блокеры money-ready' },
  { href: '/canon/finance', title: 'Финансы', text: 'Hold, release, callback, mismatch' },
  { href: '/canon/operations', title: 'Операции', text: 'Рейсы, handoff, ETA и слоты' },
  { href: '/canon/quality', title: 'Качество', text: 'Лаборатория и price impact' },
  { href: '/canon/control', title: 'Контроль', text: 'Риск, спор, эскалации и блокеры' },
  { href: '/canon/admin', title: 'Администратор', text: 'Роли, компании, доступы, аудит' },
  { href: '/canon/integrations', title: 'Интеграции', text: 'Bank / FGIS / EDO / GPS / 1C readiness' },
] as const;

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#050914', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Прозрачная Цена</div>
        <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05, fontWeight: 800 }}>Control Center</h1>
        <p style={{ margin: '14px 0 24px', color: '#94a3b8', fontSize: 16, lineHeight: 1.5 }}>Единый контур исполнения сделки: цена и допуск → сделка → логистика → приёмка → документы → деньги → спор → доказательства.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
          {cards.map((card) => (
            <Link key={card.href} href={card.href} style={{ textDecoration: 'none', color: 'inherit', background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: 18, display: 'block', minHeight: 150 }}>
              <div style={{ width: 50, height: 50, borderRadius: 16, background: 'rgba(34,197,94,.14)', marginBottom: 12 }} />
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>{card.title}</div>
              <div style={{ color: '#8aa0b8', fontSize: 15, lineHeight: 1.4, marginTop: 8 }}>{card.text}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
