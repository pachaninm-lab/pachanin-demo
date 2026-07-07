import Link from 'next/link';
import { FGIS_AUCTION_STATE, kgToTons } from '@/lib/platform-v7/fgisAuctionEngine';
import { AUCTION_DEAL_BRIDGE } from '@/lib/platform-v7/auctionDealBridge';

const lot = FGIS_AUCTION_STATE.lot;
const bids = AUCTION_DEAL_BRIDGE.lot.bids;

export default function AuctionBidsPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Окно ставок</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 38px)', color: 'var(--pc-text-primary)', lineHeight: 1.08 }}>Ставки по ФГИС-лоту</h1>
        <p style={{ margin: 0, maxWidth: 780, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>Торги идут по партии {lot.lotNumber}. Объём ставки не может превышать доступную массу {kgToTons(lot.availableWeightKg)} т. Победитель создаёт основание сделки.</p>
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Журнал ставок</h2>
        {bids.map((bid) => (
          <div key={bid.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, border: '1px solid var(--pc-border)', background: bid.isWinner ? 'var(--pc-accent-bg)' : 'var(--pc-shell-surface-soft)' }}>
            <div style={{ display: 'grid', gap: 3 }}>
              <strong style={{ fontSize: 13, color: 'var(--pc-text-primary)' }}>{bid.buyerName}</strong>
              <span style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>{bid.id} · {bid.placedAt} · запись фиксируется журналом</span>
            </div>
            <strong style={{ fontSize: 13, color: 'var(--pc-text-primary)' }}>{new Intl.NumberFormat('ru-RU').format(bid.priceRubPerTon)} ₽/т</strong>
          </div>
        ))}
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Правила</h2>
        {FGIS_AUCTION_STATE.bidRules.map((rule) => (
          <div key={rule.key} style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--pc-text-secondary)', padding: '8px 10px', borderRadius: 12, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)' }}>{rule.label}</div>
        ))}
      </section>

      <Link href='/platform-v7/auction/deal-basis' style={{ textDecoration: 'none', width: 'fit-content', padding: '10px 13px', borderRadius: 13, background: 'var(--pc-accent)', color: '#fff', fontSize: 13, fontWeight: 900 }}>К основанию сделки</Link>
    </main>
  );
}
