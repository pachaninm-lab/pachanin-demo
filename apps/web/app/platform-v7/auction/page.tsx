import Link from 'next/link';
import { AUCTION_DEAL_BRIDGE, auctionDealAmountRub, auctionStageLabel } from '@/lib/platform-v7/auctionDealBridge';

const money = new Intl.NumberFormat('ru-RU').format(auctionDealAmountRub());
const lot = AUCTION_DEAL_BRIDGE.lot;
const winner = AUCTION_DEAL_BRIDGE.winnerBid;

export default function PlatformV7AuctionPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Аукцион → сделка</span>
            <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 40px)', lineHeight: 1.05, color: 'var(--pc-text-primary)' }}>Лот становится основанием сделки</h1>
            <p style={{ margin: 0, maxWidth: 760, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>Аукцион не живёт отдельно от исполнения. После фиксации победителя платформа переводит лот в контур: допуск, сделка, рейсы, приёмка, документы, банковский шаг и спор.</p>
          </div>
          <span style={{ padding: '8px 11px', borderRadius: 999, background: 'var(--pc-accent-bg)', color: 'var(--pc-accent-strong)', border: '1px solid var(--pc-accent-border)', fontSize: 12, fontWeight: 900 }}>{auctionStageLabel(lot.stage)}</span>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        {[
          ['Лот', lot.id],
          ['Культура', `${lot.culture} · ${lot.className}`],
          ['Объём', `${lot.volumeTons} т`],
          ['Базис', `${lot.region} · ${lot.basis}`],
          ['Старт', `${new Intl.NumberFormat('ru-RU').format(lot.startPriceRubPerTon)} ₽/т`],
          ['Основание', winner ? `${money} ₽` : 'нет победителя'],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 18, padding: 14, display: 'grid', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <strong style={{ fontSize: 17, color: 'var(--pc-text-primary)' }}>{value}</strong>
          </div>
        ))}
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Ставки</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {lot.bids.map((bid) => (
            <div key={bid.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, border: `1px solid ${bid.isWinner ? 'var(--pc-accent-border)' : 'var(--pc-border)'}`, background: bid.isWinner ? 'var(--pc-accent-bg)' : 'var(--pc-shell-surface-soft)' }}>
              <div style={{ display: 'grid', gap: 3 }}>
                <strong style={{ fontSize: 13, color: 'var(--pc-text-primary)' }}>{bid.buyerName}</strong>
                <span style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>{bid.id} · {bid.placedAt} · ставка фиксируется журналом</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: 14, color: 'var(--pc-text-primary)' }}>{new Intl.NumberFormat('ru-RU').format(bid.priceRubPerTon)} ₽/т</strong>
                {bid.isWinner ? <div style={{ fontSize: 10, color: 'var(--pc-accent-strong)', fontWeight: 900 }}>победитель</div> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Следующие действия</h2>
          {AUCTION_DEAL_BRIDGE.nextActions.map((action) => (
            <Link key={action.href} href={action.href} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 13, border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', background: 'var(--pc-shell-surface-soft)' }}>
              <strong style={{ fontSize: 13 }}>{action.label}</strong>
              <span style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>{action.owner}</span>
            </Link>
          ))}
        </div>

        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Контроль и риски</h2>
          {[...AUCTION_DEAL_BRIDGE.controls, ...AUCTION_DEAL_BRIDGE.risks].map((item) => (
            <div key={item} style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--pc-text-secondary)', padding: '8px 10px', borderRadius: 12, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)' }}>{item}</div>
          ))}
        </div>
      </section>
    </main>
  );
}
