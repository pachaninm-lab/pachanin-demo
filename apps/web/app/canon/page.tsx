import Link from 'next/link';

const cards = [
  { href: '/canon/roles', title: 'Роли', text: 'Канонический role selector' },
  { href: '/canon/market', title: 'Рынок', text: 'Фермер / продавец' },
  { href: '/canon/deals', title: 'Сделки', text: 'Execution-first dashboard' },
  { href: '/canon/documents', title: 'Документы', text: 'Пакеты, статус, handoff' },
  { href: '/canon/finance', title: 'Финансы', text: 'Платежи, hold, release' },
  { href: '/canon/operations', title: 'Операции', text: 'Логистика, приёмка, контроль' },
  { href: '/canon/quality', title: 'Качество', text: 'Лаборатория и price impact' },
  { href: '/canon/control', title: 'Контроль', text: 'Очереди риска и operator center' },
];

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#050914', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Прозрачная Цена</div>
        <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05, fontWeight: 800 }}>UI Canon</h1>
        <p style={{ margin: '14px 0 24px', color: '#94a3b8', fontSize: 16, lineHeight: 1.5 }}>Новый единый контур: тёмный фон, зелёный бренд-акцент, плотные кликабельные карточки, крупные KPI и понятный следующий шаг.</p>
        <div style={{ display: 'grid', gap: 12 }}>
          {cards.map((card) => (
            <Link key={card.href} href={card.href} style={{ textDecoration: 'none', color: 'inherit', background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: 18, display: 'block' }}>
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>{card.title}</div>
              <div style={{ color: '#8aa0b8', fontSize: 15, lineHeight: 1.4, marginTop: 8 }}>{card.text}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
