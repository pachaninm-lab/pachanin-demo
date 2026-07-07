import Link from 'next/link';
import { AUCTION_DEAL_BRIDGE, auctionDealAmountRub } from '@/lib/platform-v7/auctionDealBridge';
import { FGIS_AUCTION_STATE } from '@/lib/platform-v7/fgisAuctionEngine';

const lot = FGIS_AUCTION_STATE.lot;
const winner = AUCTION_DEAL_BRIDGE.winnerBid;
const amount = new Intl.NumberFormat('ru-RU').format(auctionDealAmountRub());
const nextActions = [
  { label: 'Сформировать рейс', href: '/platform-v7/deal-logistics', owner: 'Логистика' },
  ...AUCTION_DEAL_BRIDGE.nextActions,
];

export default function AuctionDealBasisPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Победитель → сделка</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 38px)', color: 'var(--pc-text-primary)', lineHeight: 1.08 }}>Основание сделки</h1>
        <p style={{ margin: 0, maxWidth: 780, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>После победившей ставки платформа создаёт основание сделки: партия ФГИС, СДИЗ, покупатель, продавец, цена, объём, базис, документы и следующий банковский шаг. Рейс формируется из этого основания, а не отдельно от сделки.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        {[
          ['Лот ФГИС', lot.lotNumber],
          ['СДИЗ', lot.sdizNumber ?? 'требуется'],
          ['Продавец', lot.ownerName],
          ['Покупатель', winner?.buyerName ?? 'не выбран'],
          ['Цена', winner ? `${new Intl.NumberFormat('ru-RU').format(winner.priceRubPerTon)} ₽/т` : 'нет'],
          ['Сумма', winner ? `${amount} ₽` : 'нет'],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 18, padding: 14, display: 'grid', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <strong style={{ fontSize: 15, color: 'var(--pc-text-primary)' }}>{value}</strong>
          </div>
        ))}
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Что создаётся дальше</h2>
        {nextActions.map((action) => (
          <Link key={action.href} href={action.href} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 13, border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', background: 'var(--pc-shell-surface-soft)' }}>
            <strong style={{ fontSize: 13 }}>{action.label}</strong>
            <span style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>{action.owner}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
