import Link from 'next/link';
import {
  calculateDealAmountRub,
  createExecutionSimulationState,
  type Deal,
  type Dispute,
  type DomainExecutionState,
} from '../../../../packages/domain-core/src/execution-simulation';

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
const DANGER = '#B91C1C';
const DANGER_BG = 'rgba(220,38,38,0.08)';
const DANGER_BORDER = 'rgba(220,38,38,0.18)';

type DecisionFilter = 'all' | 'Hold' | 'Review' | 'Can release';
type MissingHint = 'evidence' | 'audit' | 'timeline' | 'documents' | 'none';

type QueueRow = {
  deal: Deal;
  dispute?: Dispute;
  evidenceCount: number;
  auditCount: number;
  timelineCount: number;
  score: number;
  decision: 'Hold' | 'Review' | 'Can release';
  blocker: string;
  missingHints: MissingHint[];
};

export function EvidencePackOperationsQueue({ decision = 'all' }: { decision?: DecisionFilter }) {
  const state = createExecutionSimulationState();
  const rows = buildRows(state);
  const visibleRows = decision === 'all' ? rows : rows.filter((row) => row.decision === decision);
  const holdCount = rows.filter((row) => row.decision === 'Hold').length;
  const reviewCount = rows.filter((row) => row.decision === 'Review').length;
  const readyCount = rows.filter((row) => row.decision === 'Can release').length;
  const avgScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0;

  return (
    <section data-testid='evidence-pack-operations-queue' style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Evidence queue · row missing hints · sandbox
        </div>
        <div style={{ marginTop: 6, fontSize: 22, lineHeight: 1.15, fontWeight: 900, color: T }}>
          Очередь доказательных пакетов
        </div>
        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: M, maxWidth: 880 }}>
          Операционная очередь показывает, какие сделки готовы к sandbox-preview, какие требуют review, а какие удерживают деньги из-за спора. Это не live PDF/ЭДО/КЭП export и не банковская интеграция.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <Metric label='Средняя готовность' value={`${avgScore}%`} tone={avgScore >= 80 ? 'accent' : 'default'} />
        <Metric label='Hold' value={String(holdCount)} tone={holdCount > 0 ? 'danger' : 'accent'} />
        <Metric label='Review' value={String(reviewCount)} tone={reviewCount > 0 ? 'default' : 'accent'} />
        <Metric label='Can release' value={String(readyCount)} tone='accent' />
      </div>

      <DecisionControls active={decision} />

      <div data-testid='evidence-queue-visible-count' style={{ fontSize: 12, color: M, fontWeight: 800 }}>
        Показано: {visibleRows.length} из {rows.length}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {visibleRows.map((row) => (
          <QueueCard key={row.deal.id} row={row} />
        ))}
        {!visibleRows.length ? <div style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 14, fontSize: 13, color: M }}>Нет сделок под выбранный фильтр.</div> : null}
      </div>
    </section>
  );
}

function DecisionControls({ active }: { active: DecisionFilter }) {
  const items: Array<{ label: string; value: DecisionFilter; href: string }> = [
    { label: 'Все', value: 'all', href: '/platform-v7/evidence-pack' },
    { label: 'Hold', value: 'Hold', href: '/platform-v7/evidence-pack?decision=Hold' },
    { label: 'Review', value: 'Review', href: '/platform-v7/evidence-pack?decision=Review' },
    { label: 'Can release', value: 'Can release', href: '/platform-v7/evidence-pack?decision=Can%20release' },
  ];

  return (
    <div data-testid='evidence-queue-controls' style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map((item) => {
        const selected = item.value === active;
        return (
          <Link key={item.value} href={item.href} style={{ textDecoration: 'none', borderRadius: 999, padding: '8px 12px', background: selected ? BRAND_BG : SS, border: `1px solid ${selected ? BRAND_BORDER : B}`, color: selected ? BRAND : T, fontSize: 12, fontWeight: 900 }}>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function QueueCard({ row }: { row: QueueRow }) {
  const decisionTone = row.decision === 'Hold' ? 'danger' : row.decision === 'Can release' ? 'accent' : 'default';
  const bg = row.decision === 'Hold' ? DANGER_BG : row.decision === 'Can release' ? BRAND_BG : WARN_BG;
  const border = row.decision === 'Hold' ? DANGER_BORDER : row.decision === 'Can release' ? BRAND_BORDER : WARN_BORDER;

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', color: BRAND, fontWeight: 900, fontSize: 13 }}>{row.deal.id}</div>
          <div style={{ color: T, fontWeight: 900, fontSize: 15 }}>{human(row.deal.status)} · {compactRub(calculateDealAmountRub(row.deal))}</div>
          <div style={{ color: M, fontSize: 12, lineHeight: 1.5 }}>{row.blocker}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/platform-v7/deals/${row.deal.id}/evidence-pack`} style={btn('primary')}>Preview</Link>
          <Link href={`/platform-v7/deals/${row.deal.id}`} style={btn()}>Сделка</Link>
        </div>
      </div>

      <MissingHints row={row} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
        <Metric label='Readiness' value={`${row.score}%`} tone={row.score >= 80 ? 'accent' : 'default'} compact />
        <Metric label='Decision' value={row.decision} tone={decisionTone} compact />
        <Metric label='Evidence' value={String(row.evidenceCount)} compact />
        <Metric label='Audit' value={String(row.auditCount)} compact />
        <Metric label='Timeline' value={String(row.timelineCount)} compact />
      </div>
    </div>
  );
}

function MissingHints({ row }: { row: QueueRow }) {
  const hints = row.missingHints.length ? row.missingHints : ['none' as const];
  return (
    <div data-testid={`missing-hints-${row.deal.id}`} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {hints.map((hint) => {
        const ok = hint === 'none';
        return (
          <Link key={hint} href={ok ? `/platform-v7/deals/${row.deal.id}/evidence-pack` : `/platform-v7/evidence-pack?decision=Review`} style={{ textDecoration: 'none', borderRadius: 999, padding: '6px 9px', background: ok ? BRAND_BG : WARN_BG, border: `1px solid ${ok ? BRAND_BORDER : WARN_BORDER}`, color: ok ? BRAND : WARN, fontSize: 11, fontWeight: 900 }}>
            {ok ? 'No missing data' : `Needs ${hint}`}
          </Link>
        );
      })}
    </div>
  );
}

function buildRows(state: DomainExecutionState): QueueRow[] {
  return state.deals.slice(0, 8).map((deal) => {
    const dispute = state.disputes.find((item) => item.dealId === deal.id);
    const evidenceCount = state.evidence.filter((item) => item.dealId === deal.id).length;
    const auditCount = state.auditEvents.filter((item) => item.entityId === deal.id || item.entityId === dispute?.id).length;
    const timelineCount = state.dealTimeline.filter((item) => item.dealId === deal.id).length;
    const hasDispute = Boolean(dispute && !['resolved', 'closed'].includes(dispute.status)) || deal.status === 'DISPUTE_OPEN' || Boolean(deal.openDisputeId);
    const missingHints: MissingHint[] = [
      evidenceCount > 0 ? null : 'evidence',
      auditCount > 0 ? null : 'audit',
      timelineCount > 0 ? null : 'timeline',
      deal.requiredDocumentsReady ? null : 'documents',
    ].filter(Boolean) as MissingHint[];
    const checks = [evidenceCount > 0, Boolean(dispute) || Boolean(deal.openDisputeId) || deal.status === 'DISPUTE_OPEN', auditCount > 0, timelineCount > 0, Boolean(deal.requiredDocumentsReady)];
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    const decision: QueueRow['decision'] = hasDispute ? 'Hold' : score >= 80 ? 'Can release' : 'Review';
    const blocker = hasDispute
      ? 'Активный спор или dispute marker: выпуск денег требует review/арбитражного маршрута.'
      : score >= 80
        ? 'Пакет готов к sandbox-preview: evidence, audit, timeline и документы связаны.'
        : 'Пакет требует данных: не хватает evidence, audit, timeline или документной готовности.';

    return { deal, dispute, evidenceCount, auditCount, timelineCount, score, decision, blocker, missingHints };
  });
}

function Metric({ label, value, tone = 'default', compact = false }: { label: string; value: string; tone?: 'default' | 'accent' | 'danger'; compact?: boolean }) {
  const color = tone === 'accent' ? BRAND : tone === 'danger' ? DANGER : T;
  return (
    <div style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: compact ? 10 : 12 }}>
      <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 5, fontSize: compact ? 13 : 16, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

function compactRub(value: number) {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)} млн ₽`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} тыс. ₽`;
  return `${value} ₽`;
}

function human(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

function btn(kind: 'default' | 'primary' = 'default') {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '9px 12px', background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, color: BRAND, fontSize: 12, fontWeight: 900 };
  return { textDecoration: 'none', borderRadius: 12, padding: '9px 12px', background: SS, border: `1px solid ${B}`, color: T, fontSize: 12, fontWeight: 900 };
}
