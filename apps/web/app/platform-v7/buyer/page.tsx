import Link from 'next/link';

const lots = [
  {
    id: 'LOT-2405',
    crop: 'Пшеница 4 класса',
    volume: '240 т',
    region: 'Тамбовская область',
    price: '16 120 ₽/т',
    sellerScore: '92/100',
    docs: 'ФГИС подтверждён · документы на проверке',
    action: 'Повысить ставку или ждать окончания',
    status: 'Лучшая ставка перебивает рынок',
    href: '/platform-v7/lots/LOT-2405',
  },
  {
    id: 'LOT-2403',
    crop: 'Пшеница 4 класса',
    volume: '600 т',
    region: 'Тамбовская область',
    price: '16 080 ₽/т',
    sellerScore: '89/100',
    docs: 'партия подтверждена · СДИЗ не оформлен',
    action: 'Подтвердить резерв денег',
    status: 'Ставка принята',
    href: '/platform-v7/lots/LOT-2403',
  },
] as const;

const deals = [
  { id: 'DL-9106', lot: 'LOT-2403', status: 'ожидает резерв', reserve: '9,65 млн ₽', hold: '0 ₽', next: 'подтвердить резерв денег', href: '/platform-v7/deals/DL-9106/clean' },
  { id: 'DL-9102', lot: 'LOT-2402', status: 'спор по весу', reserve: '6,24 млн ₽', hold: '624 тыс. ₽', next: 'закрыть отклонение веса', href: '/platform-v7/deals/DL-9102' },
] as const;

export default function PlatformV7BuyerPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Кабинет покупателя</div>
        <h1 style={h1}>Лоты, ставки и резерв денег</h1>
        <p style={lead}>Покупатель видит доступные лоты, свою ставку, готовность документов, сумму резерва и следующий шаг по сделке. Чужие ставки раскрываются только в допустимом обезличенном виде.</p>
        <div style={actions}>
          <Link href='/platform-v7/lots' style={primaryBtn}>Открыть лоты</Link>
          <Link href='/platform-v7/bank' style={ghostBtn}>Резерв денег</Link>
        </div>
      </section>

      <section style={metricsGrid}>
        <Metric label='В резерве' value='15,89 млн ₽' />
        <Metric label='К подтверждению' value='9,65 млн ₽' good />
        <Metric label='Под удержанием' value='624 тыс. ₽' danger />
        <Metric label='Активных ставок' value='2' />
      </section>

      <section style={card}>
        <div style={micro}>Лоты для покупки</div>
        {lots.map((lot) => (
          <Link key={lot.id} href={lot.href} style={rowLink}>
            <div style={rowHead}>
              <div>
                <div style={idText}>{lot.id}</div>
                <h2 style={h2}>{lot.crop} · {lot.volume}</h2>
                <p style={muted}>{lot.region} · {lot.docs}</p>
              </div>
              <span style={statusPill}>{lot.status}</span>
            </div>
            <div style={grid2}>
              <Cell label='Цена' value={lot.price} strong />
              <Cell label='Рейтинг продавца' value={lot.sellerScore} />
              <Cell label='Следующее действие' value={lot.action} />
              <Cell label='Доступ' value='кликнуть и открыть лот' />
            </div>
          </Link>
        ))}
      </section>

      <section style={card}>
        <div style={micro}>Мои сделки</div>
        {deals.map((deal) => (
          <Link key={deal.id} href={deal.href} style={rowLink}>
            <div style={rowHead}>
              <div>
                <div style={idText}>{deal.id} · {deal.lot}</div>
                <h2 style={h2}>{deal.status}</h2>
              </div>
              <span style={deal.hold !== '0 ₽' ? dangerPill : statusPill}>{deal.hold !== '0 ₽' ? 'есть удержание' : 'без удержания'}</span>
            </div>
            <div style={grid2}>
              <Cell label='Резерв' value={deal.reserve} strong />
              <Cell label='Удержано' value={deal.hold} danger={deal.hold !== '0 ₽'} />
              <Cell label='Следующее действие' value={deal.next} />
              <Cell label='Открыть' value='карточка сделки' />
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}

function Metric({ label, value, good = false, danger = false }: { label: string; value: string; good?: boolean; danger?: boolean }) {
  return <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16 }}><div style={micro}>{label}</div><div style={{ marginTop: 8, color: danger ? '#B91C1C' : good ? '#0A7A5F' : '#0F1419', fontSize: 28, lineHeight: 1, fontWeight: 950 }}>{value}</div></div>;
}

function Cell({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: danger ? '#B91C1C' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.25, fontWeight: 900 }}>{value}</div></div>;
}

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#2563EB', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '6px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const muted = { margin: '6px 0 0', color: '#64748B', fontSize: 13 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const rowLink = { textDecoration: 'none', color: 'inherit', background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 20, padding: 15, display: 'grid', gap: 12 } as const;
const rowHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
const idText = { color: '#2563EB', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10, minWidth: 0 } as const;
const statusPill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const dangerPill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 12, fontWeight: 900 } as const;
