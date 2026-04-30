import { createExecutionSimulationState } from '../../../../packages/domain-core/src/execution-simulation';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = 'var(--pc-accent-strong)';
const BRAND_BG = 'var(--pc-accent-bg)';
const BRAND_BORDER = 'var(--pc-accent-border)';
const WARN = '#B45309';
const WARN_BG = 'rgba(217,119,6,0.08)';
const WARN_BORDER = 'rgba(217,119,6,0.18)';

export function EvidenceExportReadinessSummary() {
  const state = createExecutionSimulationState();
  const totalDeals = state.deals.length;
  const dealsWithEvidence = state.deals.filter((deal) => state.evidence.some((item) => item.dealId === deal.id)).length;
  const dealsWithTimeline = state.deals.filter((deal) => state.dealTimeline.some((item) => item.dealId === deal.id)).length;
  const dealsWithAudit = state.deals.filter((deal) => state.auditEvents.some((item) => item.entityId === deal.id)).length;
  const disputedDeals = state.deals.filter((deal) => deal.status === 'DISPUTE_OPEN' || Boolean(deal.openDisputeId)).length;
  const readiness = totalDeals
    ? Math.round(((dealsWithEvidence + dealsWithTimeline + dealsWithAudit) / (totalDeals * 3)) * 100)
    : 0;
  const isReady = readiness >= 80;

  return (
    <section data-testid='evidence-export-readiness-summary' style={{ background: S, border: `1px solid ${isReady ? BRAND_BORDER : WARN_BORDER}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, color: isReady ? BRAND : WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Evidence export readiness · sandbox preview
        </div>
        <div style={{ marginTop: 6, fontSize: 22, lineHeight: 1.15, fontWeight: 900, color: T }}>
          Готовность доказательных пакетов к preview-export
        </div>
        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: M, maxWidth: 880 }}>
          Блок показывает операционную готовность к sandbox-preview. Это не live PDF, не ЭДО, не КЭП, не банковская и не ФГИС-интеграция.
        </div>
      </div>

      <div style={{ background: isReady ? BRAND_BG : WARN_BG, border: `1px solid ${isReady ? BRAND_BORDER : WARN_BORDER}`, borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Readiness score</div>
        <div style={{ marginTop: 4, fontSize: 28, fontWeight: 900, color: isReady ? BRAND : WARN }}>{readiness}%</div>
        <div style={{ marginTop: 4, fontSize: 12, color: M, lineHeight: 1.5 }}>
          {isReady ? 'Пакеты можно показывать как sandbox-preview.' : 'Пакеты требуют усиления evidence, audit или timeline связки.'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <Metric label='Сделок' value={String(totalDeals)} />
        <Metric label='Evidence linked' value={String(dealsWithEvidence)} />
        <Metric label='Audit linked' value={String(dealsWithAudit)} />
        <Metric label='Timeline linked' value={String(dealsWithTimeline)} />
        <Metric label='Dispute markers' value={String(disputedDeals)} />
      </div>

      <div style={{ fontSize: 12, color: M, lineHeight: 1.6 }}>
        Export boundary: sandbox preview only. Реальный PDF/ЭДО/КЭП экспорт требует отдельной реализации, подписей, прав доступа и интеграционных договоров.
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 5, fontSize: 16, fontWeight: 900, color: T }}>{value}</div>
    </div>
  );
}
