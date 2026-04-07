import Link from 'next/link';

const items = [
  { href: '/preview-ui/roles/farmer', title: 'Фермер / Продавец', detail: 'Рыночный экран с НТБ-мостом и новостями.' },
  { href: '/preview-ui/finance-screen', title: 'Финансы', detail: 'Кабинет платежей, блокировок и документов.' },
  { href: '/preview-ui/ops1', title: 'Операции', detail: 'Рейсы, очередь и рабочая линия исполнения.' },
];

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#060b16', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '24px 16px 40px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Прозрачная Цена</div>
        <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.05, fontWeight: 800 }}>UI Showcase</h1>
        <p style={{ margin: '14px 0 24px', color: '#94a3b8', fontSize: 16, lineHeight: 1.5 }}>Три эталонных мобильных экрана под целевой визуальный канон: тёмный фон, зелёный акцент, плотные карточки, крупные KPI и полностью кликабельные блоки.</p>
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', color: 'inherit', background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: 18, display: 'block' }}>
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>{item.title}</div>
              <div style={{ color: '#8aa0b8', fontSize: 15, lineHeight: 1.4, marginTop: 8 }}>{item.detail}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
