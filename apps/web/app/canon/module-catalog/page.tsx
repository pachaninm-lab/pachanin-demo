import Link from 'next/link';

const modules = [
  ['Рынок и лоты', '/canon/market', 'Цены, офферы, лоты, переход в сделку'],
  ['Сделки', '/canon/deals', 'Карточка сделки, rail, next action, blockers'],
  ['Операции', '/canon/operations', 'Рейсы, ETA, handoff, слоты'],
  ['Приёмка', '/canon/receiving2', 'Окна приёмки, весовая, выгрузка'],
  ['Качество', '/canon/quality', 'Протоколы, отклонения, retest'],
  ['Документы', '/canon/documents', 'Completeness, пакет сделки, блокеры'],
  ['Финансы', '/canon/finance', 'Hold, release, callback, статус денег'],
  ['Контроль', '/canon/control', 'Очередь риска, dispute, SLA'],
  ['Интеграции', '/canon/integrations', 'Банк, ФГИС, ЭДО, GPS, 1С'],
  ['Симуляции', '/canon/simulator', 'Late callback, missing docs, route deviation'],
  ['Investor suite', '/canon/investor-suite', 'Сильные экраны для показа'],
  ['Workspace', '/canon/workspace', 'Единый рабочий хаб модулей'],
] as const;

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#050914', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Прозрачная Цена · Module Catalog</div>
        <h1 style={{ margin: 0, fontSize: 46, lineHeight: 1.04, fontWeight: 900 }}>Каталог модулей платформы</h1>
        <p style={{ margin: '14px 0 22px', color: '#94a3b8', fontSize: 17, lineHeight: 1.6 }}>Все ключевые рабочие поверхности в одном списке, чтобы платформа ощущалась как полнофункциональная система, а не как ограниченный сценарий показа.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 12 }}>
          {modules.map(([title, href, text]) => (
            <Link key={href} href={href} style={{ textDecoration: 'none', color: 'inherit', background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 26, padding: 18, display: 'block' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(34,197,94,.14)' }} />
              <div style={{ marginTop: 16, fontSize: 22, fontWeight: 800 }}>{title}</div>
              <div style={{ marginTop: 8, color: '#8ea0b7', fontSize: 14, lineHeight: 1.55 }}>{text}</div>
              <div style={{ marginTop: 14, color: '#22c55e', fontWeight: 800 }}>Открыть →</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
