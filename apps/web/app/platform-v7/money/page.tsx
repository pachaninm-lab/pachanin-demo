import Link from 'next/link';
import { DEALS, DISPUTES } from '@/lib/v7r/data';

// S-2: compute from canonical DEALS — single source of truth
const activeDeals = DEALS.filter(d => d.status !== 'closed');
const totalReserved = activeDeals.reduce((s, d) => s + (d.reservedAmount ?? 0), 0);
const totalHeld = activeDeals.reduce((s, d) => s + (d.holdAmount ?? 0), 0);
const totalDisputed = DISPUTES.filter(d => d.status === 'open').reduce((s, d) => s + (d.holdAmount ?? 0), 0);

// Featured deal DL-9106 — Пшеница 3 кл., 500 т
const deal9106 = DEALS.find(d => d.id === 'DL-9106');

function rub(amount: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount);
}

const moneyRows = [
  ['Портфель · резерв', rub(totalReserved), `${activeDeals.length} активных сделок`],
  ['Удержано по спорам', rub(totalHeld), `${DISPUTES.filter(d => d.status === 'open').length} открытых спора`],
  ['Под арбитражем', rub(totalDisputed), 'сумма по открытым спорам'],
  ['DL-9106 · зарезервировано', rub(deal9106?.reservedAmount ?? 0), `${deal9106?.grain ?? ''}, ${deal9106?.quantity ?? ''} ${deal9106?.unit ?? ''}`],
  ['Ручная проверка', rub(50034), 'логистическое отклонение'],
  ['Сверка', 'требует проверки', 'нет автоматического платёжного обещания'],
];

export default function PlatformV7MoneyPage() {
  return (
    <main data-testid="platform-v7-money-page" style={{ display: 'grid', gap: 16 }}>
      <style>{`
        @media(max-width:767px){
          [data-testid='platform-v7-money-page']{gap:10px!important}
          [data-testid='platform-v7-money-page'] > section:nth-of-type(1){padding:16px!important;border-radius:24px!important;gap:8px!important}
          [data-testid='platform-v7-money-page'] > section:nth-of-type(1) p{display:none!important}
          [data-testid='platform-v7-money-page'] > section:nth-of-type(1) a{width:100%!important;min-height:54px!important;justify-content:center!important;border-radius:16px!important}
          [data-testid='platform-v7-money-page'] > section:nth-of-type(1) a:nth-of-type(2){display:none!important}
          [data-testid='platform-v7-money-page'] > section:nth-of-type(2){grid-template-columns:1fr 1fr!important;gap:8px!important}
          [data-testid='platform-v7-money-page'] > section:nth-of-type(2) article{padding:12px!important;border-radius:16px!important;min-width:0!important}
          [data-testid='platform-v7-money-page'] > section:nth-of-type(2) article:nth-of-type(n+5){display:none!important}
          [data-testid='platform-v7-money-page'] > section:nth-of-type(2) article strong{font-size:clamp(17px,5vw,21px)!important;line-height:1.05!important;overflow-wrap:anywhere!important}
          [data-testid='platform-v7-money-page'] > section:nth-of-type(2) article p{font-size:12px!important;line-height:1.35!important}
        }
      `}</style>
      <section style={hero}>
        <div style={badge}>Деньги</div>
        <h1 style={h1}>Денежный контур сделки</h1>
        <p style={lead}>Денежный экран показывает резерв, удержание, спор, ручную проверку и основание следующего запроса в банк. Платформа не подменяет банк.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/bank' style={primary}>Открыть банк</Link>
          <Link href='/platform-v7/bank/release-safety' style={secondary}>Проверка основания банком</Link>
        </div>
      </section>

      <section style={grid}>
        {moneyRows.map(([label, value, note]) => (
          <article key={label} style={card}>
            <span style={micro}>{label}</span>
            <strong style={valueStyle}>{value}</strong>
            <p style={text}>{note}</p>
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
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 } as const;
const card = { background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 16, display: 'grid', gap: 8 } as const;
const micro = { color: 'var(--pc-text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.07em' } as const;
const valueStyle = { color: 'var(--pc-text-primary)', fontSize: 24, lineHeight: 1.1, fontWeight: 950 } as const;
const text = { margin: 0, color: 'var(--pc-text-secondary)', fontSize: 13, lineHeight: 1.5 } as const;
const primary = { width: 'fit-content', minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 12, background: 'var(--pc-accent)', color: '#fff', textDecoration: 'none', fontWeight: 900 } as const;
const secondary = { ...primary, background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)' } as const;
