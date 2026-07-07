import Link from 'next/link';
import { BadgeCheck, CircleAlert, ClipboardCheck, UserCheck } from 'lucide-react';
import { FGIS_AUCTION_STATE, admissionLabel, canOpenAuction } from '@/lib/platform-v7/fgisAuctionEngine';
import { platformV7RouteIcon } from '@/lib/platform-v7/platformV7RouteIcons';

const state = FGIS_AUCTION_STATE;
const ready = canOpenAuction(state);
const ComplianceIcon = platformV7RouteIcon('compliance');
const FgisIcon = platformV7RouteIcon('fgis');
const AuctionIcon = platformV7RouteIcon('auction');
const DocumentsIcon = platformV7RouteIcon('documents');

function text(value: string) {
  if (value === 'ok') return 'готово';
  if (value === 'review') return 'проверка';
  return 'закрыто до решения';
}

function statusIcon(value: string) {
  if (value === 'ok') return BadgeCheck;
  if (value === 'review') return CircleAlert;
  return ClipboardCheck;
}

export default function AuctionAdmissionPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 7 }}><ComplianceIcon size={16} />Импорт → допуск</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 38px)', color: 'var(--pc-text-primary)', lineHeight: 1.08 }}>{admissionLabel(state.admission)}</h1>
        <p style={{ margin: 0, maxWidth: 780, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>Торги открываются только после проверки партии, владельца, массы, СДИЗ, качества, документов и покупателей. Цена не должна появляться раньше допуска.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/auction/import' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 14, border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', background: 'var(--pc-shell-surface-soft)', fontSize: 13, fontWeight: 900 }}><FgisIcon size={16} />Импорт ФГИС</Link>
          <Link href={ready ? '/platform-v7/auction/bids' : '/platform-v7/auction'} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 14, background: ready ? 'var(--pc-accent)' : 'var(--pc-shell-surface-soft)', color: ready ? '#fff' : 'var(--pc-text-muted)', border: '1px solid var(--pc-border)', fontSize: 13, fontWeight: 900 }}><AuctionIcon size={16} />{ready ? 'Открыть ставки' : 'Закрыть проверки'}</Link>
        </div>
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }}><DocumentsIcon size={18} />Партия и документы</h2>
        {state.checks.map((item) => {
          const Icon = statusIcon(item.status);
          return (
            <div key={item.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)' }}>
              <div style={{ display: 'grid', gap: 3 }}>
                <strong style={{ fontSize: 13, color: 'var(--pc-text-primary)', display: 'inline-flex', alignItems: 'center', gap: 7 }}><Icon size={15} />{item.label}</strong>
                <span style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>{item.owner}</span>
              </div>
              <strong style={{ fontSize: 12, color: item.status === 'ok' ? 'var(--pc-accent-strong)' : 'var(--pc-text-primary)' }}>{text(item.status)}</strong>
            </div>
          );
        })}
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }}><UserCheck size={18} />Покупатели</h2>
        {state.buyers.map((buyer) => {
          const Icon = statusIcon(buyer.admission);
          return (
            <div key={buyer.buyerId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)' }}>
              <div style={{ display: 'grid', gap: 3 }}>
                <strong style={{ fontSize: 13, color: 'var(--pc-text-primary)', display: 'inline-flex', alignItems: 'center', gap: 7 }}><Icon size={15} />{buyer.buyerName}</strong>
                <span style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>{buyer.reason ?? 'проверка пройдена'}</span>
              </div>
              <strong style={{ fontSize: 12, color: buyer.admission === 'ok' ? 'var(--pc-accent-strong)' : 'var(--pc-text-primary)' }}>{text(buyer.admission)}</strong>
            </div>
          );
        })}
      </section>
    </main>
  );
}
