import Link from 'next/link';
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

type ReadinessState = {
  label: string;
  value: string;
  ok: boolean;
  href: string;
  action: string;
};

export function EvidenceExportReadinessSummary() {
  const state = createExecutionSimulationState();
  const totalDeals = state.deals.length;
  const dealsWithEvidence = state.deals.filter((deal) => state.evidence.some((item) => item.dealId === deal.id)).length;
  const dealsWithTimeline = state.deals.filter((deal) => state.dealTimeline.some((item) => item.dealId === deal.id)).length;
  const dealsWithAudit = state.deals.filter((deal) => state.auditEvents.some((item) => item.entityId === deal.id)).length;
  const disputedDeals = state.deals.filter((deal) => deal.status === 'DISPUTE_OPEN' || Boolean(deal.openDisputeId)).length;
  const missingEvidence = Math.max(totalDeals - dealsWithEvidence, 0);
  const missingAudit = Math.max(totalDeals - dealsWithAudit, 0);
  const missingTimeline = Math.max(totalDeals - dealsWithTimeline, 0);
  const readiness = totalDeals
    ? Math.round(((dealsWithEvidence + dealsWithTimeline + dealsWithAudit) / (totalDeals * 3)) * 100)
    : 0;
  const isReady = readiness >= 80;
  const states: ReadinessState[] = [
    { label: 'Готовы к просмотру', value: String(Math.min(dealsWithEvidence, dealsWithAudit, dealsWithTimeline)), ok: isReady, href: '/platform-v7/evidence-pack?decision=Can%20release', action: 'Открыть готовые' },
    { label: 'Нужны доказательства', value: String(missingEvidence), ok: missingEvidence === 0, href: '/platform-v7/evidence-pack?decision=Review', action: 'Открыть проверку' },
    { label: 'Нужны записи журнала', value: String(missingAudit), ok: missingAudit === 0, href: '/platform-v7/evidence-pack?decision=Review', action: 'Открыть проверку' },
    { label: 'Нужна линия событий', value: String(missingTimeline), ok: missingTimeline === 0, href: '/platform-v7/evidence-pack?decision=Review', action: 'Открыть проверку' },
  ];

  return (
    <section data-testid='evidence-export-readiness-summary' style={{ background: S, border: `1px solid ${isReady ? BRAND_BORDER : WARN_BORDER}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, color: isReady ? BRAND : WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Готовность доказательств · проверочный контур
        </div>
        <div style={{ marginTop: 6, fontSize: 22, lineHeight: 1.15, fontWeight: 900, color: T }}>
          Готовность доказательных пакетов к просмотру
        </div>
        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: M, maxWidth: 880 }}>
          Блок показывает операционную готовность пакета к проверке. Это не внешний PDF, не ЭДО, не КЭП, не банковская и не ФГИС-интеграция.
        </div>
      </div>

      <div style={{ background: isReady ? BRAND_BG : WARN_BG, border: `1px solid ${isReady ? BRAND_BORDER : WARN_BORDER}`, borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Готовность</div>
        <div style={{ marginTop: 4, fontSize: 28, fontWeight: 900, color: isReady ? BRAND : WARN }}>{readiness}%</div>
        <div style={{ marginTop: 4, fontSize: 12, color: M, lineHeight: 1.5 }}>
          {isReady ? 'Пакеты можно показывать в проверочном контуре.' : 'Пакеты требуют усиления доказательств, журнала или линии событий.'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <Metric label='Сделок' value={String(totalDeals)} />
        <Metric label='Доказательства' value={String(dealsWithEvidence)} />
        <Metric label='Журнал' value={String(dealsWithAudit)} />
        <Metric label='Линия событий' value={String(dealsWithTimeline)} />
        <Metric label='Споры' value={String(disputedDeals)} />
      </div>

      <div data-testid='export-readiness-states' style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
        {states.map((item) => (
          <div key={item.label} style={{ background: item.ok ? BRAND_BG : WARN_BG, border: `1px solid ${item.ok ? BRAND_BORDER : WARN_BORDER}`, borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 10, color: item.ok ? BRAND : WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.ok ? 'готово' : 'нужно'}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: T }}>{item.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: item.ok ? BRAND : WARN }}>{item.value}</div>
            <Link href={item.href} style={{ textDecoration: 'none', color: item.ok ? BRAND : WARN, fontSize: 12, fontWeight: 900 }}>{item.action} →</Link>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: M, lineHeight: 1.6 }}>
        Граница просмотра: проверочный контур. Реальный PDF/ЭДО/КЭП экспорт требует отдельной реализации, подписей, прав доступа и интеграционных договоров.
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
