import Link from 'next/link';
import { AUCTION_DEAL_BRIDGE, auctionDealAmountRub, auctionStageLabel } from '@/lib/platform-v7/auctionDealBridge';
import { FGIS_AUCTION_STATE, admissionLabel, importStatusLabel, kgToTons } from '@/lib/platform-v7/fgisAuctionEngine';

const amount = new Intl.NumberFormat('ru-RU').format(auctionDealAmountRub());
const auctionLot = AUCTION_DEAL_BRIDGE.lot;
const fgisLot = FGIS_AUCTION_STATE.lot;
const winner = AUCTION_DEAL_BRIDGE.winnerBid;

const steps = [
  { href: '/platform-v7/auction/import', title: 'Импорт ФГИС', text: 'Партия, СДИЗ, владелец, масса, качество и документы.' },
  { href: '/platform-v7/auction/admission', title: 'Допуск', text: 'Проверка партии, покупателей и готовности к торгам.' },
  { href: '/platform-v7/auction/bids', title: 'Ставки', text: 'Журнал ставок по допущенному ФГИС-лоту.' },
  { href: '/platform-v7/auction/deal-basis', title: 'Основание сделки', text: 'Победитель, цена, объём, документы и банковский шаг.' },
];

export default function PlatformV7AuctionPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>ФГИС-аукцион → сделка</span>
            <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 40px)', lineHeight: 1.05, color: 'var(--pc-text-primary)' }}>Лот проходит допуск до цены</h1>
            <p style={{ margin: 0, maxWidth: 820, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>Аукцион встроен в исполнение сделки. Лот приходит из ФГИС/СДИЗ, сверяется по владельцу, массе, качеству и документам, затем открываются ставки. Победитель создаёт основание сделки, а не прямой контакт и не платёж.</p>
          </div>
          <span style={{ padding: '8px 11px', borderRadius: 999, background: 'var(--pc-accent-bg)', color: 'var(--pc-accent-strong)', border: '1px solid var(--pc-accent-border)', fontSize: 12, fontWeight: 900 }}>{auctionStageLabel(auctionLot.stage)}</span>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        {[
          ['ФГИС-лот', fgisLot.lotNumber],
          ['СДИЗ', fgisLot.sdizNumber ?? 'требуется'],
          ['Импорт', importStatusLabel(fgisLot.importStatus)],
          ['Допуск', admissionLabel(FGIS_AUCTION_STATE.admission)],
          ['Доступно', `${kgToTons(fgisLot.availableWeightKg)} т`],
          ['Основание', winner ? `${amount} ₽` : 'нет победителя'],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 18, padding: 14, display: 'grid', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <strong style={{ fontSize: 15, color: 'var(--pc-text-primary)' }}>{value}</strong>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
        {steps.map((step, index) => (
          <Link key={step.href} href={step.href} style={{ textDecoration: 'none', border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 8, color: 'var(--pc-text-primary)' }}>
            <span style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--pc-accent-bg)', color: 'var(--pc-accent-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 950 }}>{index + 1}</span>
            <strong style={{ fontSize: 16 }}>{step.title}</strong>
            <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--pc-text-secondary)' }}>{step.text}</span>
          </Link>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Правила</h2>
          {FGIS_AUCTION_STATE.bidRules.map((rule) => (
            <div key={rule.key} style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--pc-text-secondary)', padding: '8px 10px', borderRadius: 12, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)' }}>{rule.label}</div>
          ))}
        </div>

        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Контроль риска</h2>
          {[...AUCTION_DEAL_BRIDGE.controls, ...AUCTION_DEAL_BRIDGE.risks].map((item) => (
            <div key={item} style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--pc-text-secondary)', padding: '8px 10px', borderRadius: 12, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)' }}>{item}</div>
          ))}
        </div>
      </section>
    </main>
  );
}
