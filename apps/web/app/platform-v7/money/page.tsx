import Link from 'next/link';

const moneyRows = [
  ['Сумма сделки', '9 648 000 ₽', 'исходная сумма DL-9106'],
  ['Зарезервировано', '9 648 000 ₽', 'ожидается подтверждение банка'],
  ['К выпуску', '0 ₽', 'закрыто до документов и приёмки'],
  ['Удержано', '203 000 ₽', 'спор по весу и качеству'],
  ['Ручная проверка', '50 034 ₽', 'логистическое отклонение'],
  ['Сверка', 'требует проверки', 'нет автоматического платежного обещания'],
];

export default function PlatformV7MoneyPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={hero}>
        <div style={badge}>Деньги</div>
        <h1 style={h1}>MoneyTree сделки</h1>
        <p style={lead}>Денежный экран показывает резерв, удержание, спор, ручную проверку и основание следующего запроса в банк. Платформа не подменяет банк.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/bank' style={primary}>Открыть банк</Link>
          <Link href='/platform-v7/bank/release-safety' style={secondary}>Проверка выплаты</Link>
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
const micro = { color: 'var(--pc-text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const valueStyle = { color: 'var(--pc-text-primary)', fontSize: 24, lineHeight: 1.1, fontWeight: 950 } as const;
const text = { margin: 0, color: 'var(--pc-text-secondary)', fontSize: 13, lineHeight: 1.5 } as const;
const primary = { width: 'fit-content', minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 12, background: 'var(--pc-accent)', color: '#fff', textDecoration: 'none', fontWeight: 900 } as const;
const secondary = { ...primary, background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)' } as const;
