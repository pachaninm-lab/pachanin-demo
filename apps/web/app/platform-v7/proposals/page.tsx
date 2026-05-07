import Link from 'next/link';

const proposals = [
  ['OFFER-2403-1', 'Покупатель А · 600 т', 'лидирует', 'Проверить резерв и документы', '/platform-v7/deals/grain-release'],
  ['OFFER-2403-2', 'Покупатель Б · 600 т', 'перебито', 'Улучшить цену или условия оплаты', '/platform-v7/buyer'],
  ['OFFER-2403-3', 'Встречное предложение', 'на рассмотрении', 'Ответственный: продавец', '/platform-v7/seller'],
];

export default function PlatformV7ProposalsPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={hero}>
        <div style={badge}>Предложения и ставки</div>
        <h1 style={h1}>Предсделочный контур</h1>
        <p style={lead}>Предложения связаны с лотом или закупочным запросом. На экране видно: кто предложил цену, какой статус, что блокирует сделку и какой следующий шаг.</p>
      </section>

      <section style={grid}>
        {proposals.map(([id, title, status, next, href]) => (
          <article key={id} style={card}>
            <span style={micro}>{id}</span>
            <strong style={titleStyle}>{title}</strong>
            <span style={statusPill}>{status}</span>
            <p style={text}>{next}</p>
            <Link href={href} style={link}>Открыть действие</Link>
          </article>
        ))}
      </section>
    </main>
  );
}

const hero = { background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 24, padding: 20, display: 'grid', gap: 10 } as const;
const badge = { width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent-strong)', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: 'var(--pc-text-primary)', fontSize: 'clamp(28px,7vw,46px)', lineHeight: 1.04, fontWeight: 950 } as const;
const lead = { margin: 0, color: 'var(--pc-text-secondary)', fontSize: 14, lineHeight: 1.55 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 } as const;
const card = { background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 16, display: 'grid', gap: 9 } as const;
const micro = { color: 'var(--pc-text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const titleStyle = { color: 'var(--pc-text-primary)', fontSize: 16, lineHeight: 1.25 } as const;
const text = { margin: 0, color: 'var(--pc-text-secondary)', fontSize: 13, lineHeight: 1.5 } as const;
const statusPill = { width: 'fit-content', padding: '5px 9px', borderRadius: 999, background: 'var(--pc-bg-elevated)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 11, fontWeight: 900 } as const;
const link = { color: 'var(--pc-accent-strong)', textDecoration: 'none', fontWeight: 900 } as const;
