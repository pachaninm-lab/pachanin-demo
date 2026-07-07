import Link from 'next/link';
import { FGIS_AUCTION_STATE, admissionLabel, canOpenAuction } from '@/lib/platform-v7/fgisAuctionEngine';

const state = FGIS_AUCTION_STATE;
const ready = canOpenAuction(state);

function text(value: string) {
  if (value === 'ok') return 'готово';
  if (value === 'review') return 'проверка';
  return 'закрыто до решения';
}

export default function AuctionAdmissionPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Допуск</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 38px)', color: 'var(--pc-text-primary)', lineHeight: 1.08 }}>{admissionLabel(state.admission)}</h1>
        <p style={{ margin: 0, maxWidth: 780, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>Торги открываются только после проверки партии, владельца, массы, СДИЗ, качества, документов и покупателей. Цена не должна появляться раньше допуска.</p>
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Партия и документы</h2>
        {state.checks.map((item) => (
          <div key={item.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)' }}>
            <div style={{ display: 'grid', gap: 3 }}>
              <strong style={{ fontSize: 13, color: 'var(--pc-text-primary)' }}>{item.label}</strong>
              <span style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>{item.owner}</span>
            </div>
            <strong style={{ fontSize: 12, color: 'var(--pc-text-primary)' }}>{text(item.status)}</strong>
          </div>
        ))}
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Покупатели</h2>
        {state.buyers.map((buyer) => (
          <div key={buyer.buyerId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)' }}>
            <div style={{ display: 'grid', gap: 3 }}>
              <strong style={{ fontSize: 13, color: 'var(--pc-text-primary)' }}>{buyer.buyerName}</strong>
              <span style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>{buyer.reason ?? 'проверка пройдена'}</span>
            </div>
            <strong style={{ fontSize: 12, color: 'var(--pc-text-primary)' }}>{text(buyer.admission)}</strong>
          </div>
        ))}
      </section>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/auction/import' style={{ textDecoration: 'none', padding: '10px 13px', borderRadius: 13, border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 900 }}>Импорт</Link>
        <Link href={ready ? '/platform-v7/auction/bids' : '/platform-v7/auction'} style={{ textDecoration: 'none', padding: '10px 13px', borderRadius: 13, background: ready ? 'var(--pc-accent)' : 'var(--pc-shell-surface-soft)', color: ready ? '#fff' : 'var(--pc-text-muted)', border: '1px solid var(--pc-border)', fontSize: 13, fontWeight: 900 }}>{ready ? 'Открыть ставки' : 'Закрыть проверки'}</Link>
      </div>
    </main>
  );
}
