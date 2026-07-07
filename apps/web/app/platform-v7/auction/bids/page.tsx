import Link from 'next/link';
import { BadgeCheck, Clock3, Gavel, ListChecks, Trophy } from 'lucide-react';
import { FGIS_AUCTION_STATE, kgToTons } from '@/lib/platform-v7/fgisAuctionEngine';
import { AUCTION_DEAL_BRIDGE } from '@/lib/platform-v7/auctionDealBridge';
import { platformV7RouteIcon } from '@/lib/platform-v7/platformV7RouteIcons';

const lot = FGIS_AUCTION_STATE.lot;
const bids = AUCTION_DEAL_BRIDGE.lot.bids;
const winner = bids.find((bid) => bid.isWinner) ?? bids[0];
const AuctionIcon = platformV7RouteIcon('auction');
const DealIcon = platformV7RouteIcon('deal');
const ComplianceIcon = platformV7RouteIcon('compliance');

export default function AuctionBidsPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 7 }}><AuctionIcon size={16} />Допуск → ставки</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 38px)', color: 'var(--pc-text-primary)', lineHeight: 1.08 }}>Ставки по ФГИС-лоту</h1>
        <p style={{ margin: 0, maxWidth: 780, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>Торги идут по партии {lot.lotNumber}. Объём ставки не может превышать доступную массу {kgToTons(lot.availableWeightKg)} т. Победитель создаёт основание сделки.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/auction/admission' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content', padding: '10px 12px', borderRadius: 14, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 900 }}><ComplianceIcon size={16} />Допуск</Link>
          <Link href='/platform-v7/auction/deal-basis' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content', padding: '10px 12px', borderRadius: 14, background: 'var(--pc-accent)', color: '#fff', fontSize: 13, fontWeight: 900 }}><DealIcon size={16} />К основанию сделки</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        {[
          ['Лидер', winner.buyerName],
          ['Ставка', `${new Intl.NumberFormat('ru-RU').format(winner.priceRubPerTon)} ₽/т`],
          ['Лот', lot.lotNumber],
          ['Доступно', `${kgToTons(lot.availableWeightKg)} т`],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 18, padding: 14, display: 'grid', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Trophy size={14} />{label}</span>
            <strong style={{ fontSize: 15, color: 'var(--pc-text-primary)' }}>{value}</strong>
          </div>
        ))}
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Gavel size={18} />Журнал ставок</h2>
        {bids.map((bid) => (
          <div key={bid.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, border: '1px solid var(--pc-border)', background: bid.isWinner ? 'var(--pc-accent-bg)' : 'var(--pc-shell-surface-soft)' }}>
            <div style={{ display: 'grid', gap: 3 }}>
              <strong style={{ fontSize: 13, color: 'var(--pc-text-primary)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>{bid.isWinner ? <BadgeCheck size={15} /> : <Clock3 size={15} />}{bid.buyerName}</strong>
              <span style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>{bid.id} · {bid.placedAt} · запись фиксируется журналом</span>
            </div>
            <strong style={{ fontSize: 13, color: 'var(--pc-text-primary)' }}>{new Intl.NumberFormat('ru-RU').format(bid.priceRubPerTon)} ₽/т</strong>
          </div>
        ))}
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }}><ListChecks size={18} />Правила</h2>
        {FGIS_AUCTION_STATE.bidRules.map((rule) => (
          <div key={rule.key} style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--pc-text-secondary)', padding: '8px 10px', borderRadius: 12, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)' }}>{rule.label}</div>
        ))}
      </section>
    </main>
  );
}
