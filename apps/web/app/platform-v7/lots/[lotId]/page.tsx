import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LotDetailRuntime } from '@/components/v7r/LotDetailRuntime';

const lot2403Bids = [
  { buyer: 'Покупатель 1', region: 'Воронежская область', rating: '91/100', price: '16 080 ₽/т', volume: '600 т', status: 'победитель' },
  { buyer: 'Покупатель 2', region: 'Краснодарский край', rating: '82/100', price: '15 970 ₽/т', volume: '1 000 т', status: 'активна' },
  { buyer: 'Покупатель 3', region: 'Липецкая область', rating: '96/100', price: '15 850 ₽/т', volume: '500 т', status: 'активна' },
] as const;

export default function Page({ params }: { params: { lotId: string } }) {
  if (params.lotId === 'new' || params.lotId === 'create') {
    redirect('/platform-v7/lots/create');
  }

  if (params.lotId === 'LOT-2403') {
    return (
      <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
        <section style={card}>
          <div style={badge}>Лот · победитель выбран</div>
          <h1 style={h1}>LOT-2403 · Пшеница 4 класса</h1>
          <p style={lead}>Ставка принята. Создана сделка DL-9106, заявка LOG-REQ-2403 передана логистике, рейс TRIP-SIM-001 назначен водителю.</p>
          <div style={actions}>
            <Link href='/platform-v7/deals/DL-9106/clean' style={primaryBtn}>Открыть сделку</Link>
            <Link href='/platform-v7/logistics/inbox' style={ghostBtn}>Заявка в логистике</Link>
            <Link href='/platform-v7/driver' style={ghostBtn}>Рейс водителя</Link>
          </div>
        </section>

        <section style={card}>
          <div style={micro}>Ставки покупателей</div>
          {lot2403Bids.map((bid) => (
            <article key={bid.buyer} style={{ background: bid.status === 'победитель' ? 'rgba(10,122,95,0.06)' : '#F8FAFB', border: `1px solid ${bid.status === 'победитель' ? 'rgba(10,122,95,0.18)' : '#E4E6EA'}`, borderRadius: 18, padding: 14, display: 'grid', gap: 10 }}>
              <div style={rowHead}>
                <div>
                  <h2 style={h2}>{bid.buyer}</h2>
                  <p style={muted}>{bid.region}</p>
                </div>
                <span style={bid.status === 'победитель' ? statusPill : neutralPill}>{bid.status}</span>
              </div>
              <div style={grid2}>
                <Cell label='Рейтинг' value={bid.rating} />
                <Cell label='Цена' value={bid.price} strong={bid.status === 'победитель'} />
                <Cell label='Объём' value={bid.volume} />
                <Cell label='Деньги' value='готов к резерву' />
              </div>
            </article>
          ))}
        </section>
      </main>
    );
  }

  return <LotDetailRuntime id={params.lotId} />;
}

function Cell({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: strong ? '#0A7A5F' : '#0F1419', fontSize: 13, fontWeight: 900 }}>{value}</div></div>;
}

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: 0, color: '#0F1419', fontSize: 20, lineHeight: 1.08, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const muted = { margin: '5px 0 0', color: '#64748B', fontSize: 13 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 8 } as const;
const rowHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10 } as const;
const statusPill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const neutralPill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 900 } as const;
