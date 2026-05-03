import Link from 'next/link';

const deals = [
  { id: 'DL-9106', lot: 'LOT-2403', buyer: 'Покупатель 1', amount: '9,65 млн ₽', reserve: 'ожидает подтверждения', docs: 'СДИЗ не оформлен', logistics: 'рейс создан', decision: 'не выпускать', next: 'подтвердить резерв после документов', danger: true },
  { id: 'DL-9102', lot: 'LOT-2402', buyer: 'Покупатель 2', amount: '6,24 млн ₽', reserve: 'подтверждён', docs: 'есть спор по весу', logistics: 'прибыл', decision: 'удержание 624 тыс. ₽', next: 'ждать закрытия спора', danger: true },
  { id: 'DL-9105', lot: 'LOT-2408', buyer: 'Покупатель 4', amount: '4,3 млн ₽', reserve: 'подтверждён', docs: 'пакет готов', logistics: 'погрузка', decision: 'проверить', next: 'дождаться приёмки', danger: false },
] as const;

export default function PlatformV7BankPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Кабинет банка</div>
        <h1 style={h1}>Резерв, удержание и выпуск денег</h1>
        <p style={lead}>Банк видит только денежный контур сделки: резерв, документы, транспортный статус, спор, решение и причину остановки. Выпуск не показывается как доступный, пока условия не закрыты.</p>
        <div style={actions}>
          <Link href='/platform-v7/release-safety' style={primaryBtn}>Проверка выпуска</Link>
          <Link href='/platform-v7/deals' style={ghostBtn}>Все сделки</Link>
        </div>
      </section>

      <section style={metricsGrid}>
        <Metric label='В резерве' value='20,19 млн ₽' />
        <Metric label='К проверке' value='13,95 млн ₽' />
        <Metric label='Под удержанием' value='624 тыс. ₽' danger />
        <Metric label='Готово к выпуску' value='0 ₽' />
      </section>

      <section style={card}>
        <div style={micro}>Денежная очередь</div>
        {deals.map((deal) => (
          <Link key={deal.id} href={`/platform-v7/deals/${deal.id}`} style={rowLink}>
            <div style={rowHead}>
              <div>
                <div style={idText}>{deal.id} · {deal.lot}</div>
                <h2 style={h2}>{deal.amount}</h2>
                <p style={muted}>{deal.buyer}</p>
              </div>
              <span style={deal.danger ? dangerPill : statusPill}>{deal.decision}</span>
            </div>
            <div style={grid2}>
              <Cell label='Резерв' value={deal.reserve} strong={!deal.danger} />
              <Cell label='Документы' value={deal.docs} danger={deal.docs.includes('не') || deal.docs.includes('спор')} />
              <Cell label='Логистика' value={deal.logistics} />
              <Cell label='Следующее действие' value={deal.next} strong />
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16 }}><div style={micro}>{label}</div><div style={{ marginTop: 8, color: danger ? '#B91C1C' : '#0F1419', fontSize: 28, lineHeight: 1, fontWeight: 950 }}>{value}</div></div>;
}

function Cell({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: danger ? '#B91C1C' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.25, fontWeight: 900 }}>{value}</div></div>;
}

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(15,23,42,0.08)', border: '1px solid rgba(15,23,42,0.18)', color: '#0F172A', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '6px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const muted = { margin: '6px 0 0', color: '#64748B', fontSize: 13 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const rowLink = { textDecoration: 'none', color: 'inherit', background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 20, padding: 15, display: 'grid', gap: 12 } as const;
const rowHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
const idText = { color: '#0F172A', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10, minWidth: 0 } as const;
const statusPill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const dangerPill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 12, fontWeight: 900 } as const;
