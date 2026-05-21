import Link from 'next/link';
import { EvidenceDisputeContinuityPanel } from '@/components/v7r/EvidenceDisputeContinuityPanel';

const S = 'var(--pc-bg-card)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = 'var(--pc-accent-strong)';
const BRAND_BG = 'var(--pc-accent-bg)';
const BRAND_BORDER = 'var(--pc-accent-border)';

export function DealEvidencePackPreview({ dealId }: { dealId: string }) {
  return (
    <section data-testid='deal-evidence-pack-preview' style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            P0-06 · deal-level evidence pack · sandbox
          </div>
          <div style={{ marginTop: 6, fontSize: 22, lineHeight: 1.15, fontWeight: 900, color: T }}>
            Evidence pack preview по сделке {dealId}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: M, maxWidth: 860 }}>
            Один и тот же доказательный контур должен читаться из сделки, спора и банка. Этот блок показывает preview-ready связку сделки с evidence/dispute/money контуром без live PDF, ЭДО или КЭП-экспорта.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/platform-v7/deals/${dealId}`} style={btn('primary')}>Сделка</Link>
          <Link href='/platform-v7/disputes' style={btn()}>Споры</Link>
          <Link href='/platform-v7/bank' style={btn()}>Банк</Link>
        </div>
      </div>

      <EvidenceDisputeContinuityPanel dealId={dealId} />
    </section>
  );
}

function btn(kind: 'default' | 'primary' = 'default') {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, color: BRAND, fontSize: 13, fontWeight: 800 };
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: 'var(--pc-bg-elevated)', border: `1px solid ${B}`, color: T, fontSize: 13, fontWeight: 800 };
}
