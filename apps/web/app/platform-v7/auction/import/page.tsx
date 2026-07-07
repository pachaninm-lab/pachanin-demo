import Link from 'next/link';
import { FGIS_AUCTION_STATE, importStatusLabel, kgToTons } from '@/lib/platform-v7/fgisAuctionEngine';

const lot = FGIS_AUCTION_STATE.lot;

export default function AuctionImportPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>ФГИС → лот</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 38px)', color: 'var(--pc-text-primary)', lineHeight: 1.08 }}>Импорт партии в аукцион</h1>
        <p style={{ margin: 0, maxWidth: 780, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>Лот открывается для торгов только после сверки источника, владельца, доступной массы, СДИЗ, качества и документов. Без этого аукцион не создаёт цену и не запускает сделку.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        {[
          ['Статус', importStatusLabel(lot.importStatus)],
          ['Лот ФГИС', lot.lotNumber],
          ['СДИЗ', lot.sdizNumber ?? 'требуется'],
          ['Владелец', `${lot.ownerName} · ИНН ${lot.ownerInn}`],
          ['Партия', `${lot.culture} · ${lot.className}`],
          ['Доступно', `${kgToTons(lot.availableWeightKg)} т`],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 18, padding: 14, display: 'grid', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <strong style={{ fontSize: 15, color: 'var(--pc-text-primary)' }}>{value}</strong>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Качество</h2>
          {lot.quality.map((item) => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 10px', borderRadius: 12, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)' }}>
              <span style={{ fontSize: 12, color: 'var(--pc-text-secondary)' }}>{item.label}</span>
              <strong style={{ fontSize: 12, color: 'var(--pc-text-primary)' }}>{item.value}</strong>
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Документы</h2>
          {lot.documents.map((item) => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 10px', borderRadius: 12, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)' }}>
              <span style={{ fontSize: 12, color: 'var(--pc-text-secondary)' }}>{item.label}</span>
              <strong style={{ fontSize: 12, color: item.status === 'ok' ? 'var(--pc-accent-strong)' : 'var(--pc-text-primary)' }}>{item.status === 'ok' ? 'есть' : item.status === 'review' ? 'проверка' : 'требуется'}</strong>
            </div>
          ))}
        </div>
      </section>

      <Link href='/platform-v7/auction/admission' style={{ textDecoration: 'none', display: 'inline-flex', width: 'fit-content', padding: '11px 14px', borderRadius: 14, background: 'var(--pc-accent)', color: '#fff', fontSize: 13, fontWeight: 900 }}>Перейти к допуску</Link>
    </main>
  );
}
