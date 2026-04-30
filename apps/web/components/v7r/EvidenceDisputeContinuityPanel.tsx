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

export function EvidenceDisputeContinuityPanel({ dealId }: { dealId?: string }) {
  const state = createExecutionSimulationState();
  const { deal, dispute } = selectDisputeDeal(state, dealId);
  const evidence = state.evidence.filter((item) => item.dealId === deal.id);
  const audit = state.auditEvents.filter((item) => item.entityId === deal.id || item.entityId === dispute?.id).slice(-4).reverse();
  const timeline = state.dealTimeline.filter((item) => item.dealId === deal.id).slice(-4).reverse();
  const amount = calculateDealAmountRub(deal);
  const isOpen = Boolean(dispute && !['resolved', 'closed'].includes(dispute.status));
  const moneyHoldReason = resolveMoneyHoldReason(deal, dispute, evidence.length);
  const bankDecision = resolveBankDecision(deal, dispute, evidence.length);
  const readiness = resolveDisputePackReadiness(deal, dispute, evidence.length, audit.length, timeline.length);

  return (
    <section data-testid='evidence-dispute-continuity-panel' style={{ background: S, border: `1px solid ${isOpen ? DANGER_BORDER : BRAND_BORDER}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: isOpen ? DANGER : BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            P0-05 · evidence → dispute → money · sandbox
          </div>
          <div style={{ marginTop: 6, fontSize: 22, lineHeight: 1.15, fontWeight: 900, color: T }}>
            Доказательный пакет сделки {deal.id}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: M, maxWidth: 880 }}>
            Контур связывает доказательства, спор, банковое удержание и timeline сделки. Это simulation-only слой: он объясняет логику удержания/выпуска, но не вызывает боевые банковские, ФГИС или ЭДО-интеграции.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/platform-v7/deals/${deal.id}`} style={btn('primary')}>Открыть сделку</Link>
          <Link href='/platform-v7/disputes' style={btn()}>Открыть споры</Link>
          <Link href='/platform-v7/bank' style={btn()}>Открыть банк</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
        <Cell label='Сумма сделки' value={compactRub(amount)} />
        <Cell label='Статус сделки' value={human(deal.status)} tone={deal.status === 'DISPUTE_OPEN' ? 'danger' : 'default'} />
        <Cell label='Спор' value={dispute ? human(dispute.status) : 'Нет'} tone={isOpen ? 'danger' : 'accent'} />
        <Cell label='Evidence' value={String(evidence.length)} />
        <Cell label='Bank decision' value={bankDecision.label} tone={bankDecision.tone} />
        <Cell label='Pack readiness' value={`${readiness.score}%`} tone={readiness.tone} />
      </div>

      <div style={{ background: isOpen ? DANGER_BG : WARN_BG, border: `1px solid ${isOpen ? DANGER_BORDER : WARN_BORDER}`, borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: isOpen ? DANGER : WARN, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Money hold / release explanation</div>
        <div style={{ fontSize: 14, color: T, fontWeight: 900, lineHeight: 1.5 }}>{moneyHoldReason.title}</div>
        <div style={{ fontSize: 12, color: M, lineHeight: 1.6 }}>{moneyHoldReason.detail}</div>
      </div>

      <div data-testid='dispute-pack-readiness' style={{ background: readiness.score >= 80 ? BRAND_BG : WARN_BG, border: `1px solid ${readiness.score >= 80 ? BRAND_BORDER : WARN_BORDER}`, borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: readiness.score >= 80 ? BRAND : WARN, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dispute pack readiness</div>
        <div style={{ fontSize: 18, color: T, fontWeight: 900 }}>{readiness.score}% · {readiness.label}</div>
        <div style={{ fontSize: 12, color: M, lineHeight: 1.6 }}>{readiness.detail}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
          {readiness.checks.map((check) => (
            <div key={check.label} style={{ background: SS, border: `1px solid ${check.ok ? BRAND_BORDER : WARN_BORDER}`, borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 11, color: check.ok ? BRAND : WARN, fontWeight: 900 }}>{check.ok ? 'OK' : 'Нужно'}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: T, fontWeight: 800 }}>{check.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: M, lineHeight: 1.6 }}>Export-ready summary: sandbox preview only. PDF/ЭДО/КЭП экспорт не заявлен как live.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
        <ListBlock title='Evidence pack' empty='Нет evidence по выбранной сделке.' rows={evidence.slice(0, 5).map((item) => ({ id: item.id, kicker: item.type, text: `${item.title} · ${item.hash.slice(0, 18)}…` }))} />
        <ListBlock title='Dispute context' empty='Нет активного спора по выбранной сделке.' rows={dispute ? [{ id: dispute.id, kicker: dispute.reason, text: `${dispute.status} · влияние ${compactRub(dispute.amountImpactRub)}` }] : []} />
        <ListBlock title='Audit trail' empty='Нет audit events по выбранной сделке/спору.' rows={audit.map((item) => ({ id: item.id, kicker: item.actorRole, text: `${item.actionType} · ${item.entityId}` }))} />
        <ListBlock title='Deal timeline' empty='Нет timeline events по выбранной сделке.' rows={timeline.map((item) => ({ id: item.id, kicker: item.actorRole, text: item.title }))} />
      </div>
    </section>
  );
}

function selectDisputeDeal(state: DomainExecutionState, preferredDealId?: string): { deal: Deal; dispute?: Dispute } {
  const directDeal = preferredDealId ? state.deals.find((item) => item.id === preferredDealId) : undefined;
  const directDispute = directDeal ? state.disputes.find((item) => item.dealId === directDeal.id) : undefined;
  if (directDeal) return { deal: directDeal, dispute: directDispute };

  const dispute = state.disputes.find((item) => !['resolved', 'closed'].includes(item.status)) || state.disputes[0];
  const deal = state.deals.find((item) => item.id === dispute?.dealId) || state.deals.find((item) => item.status === 'DISPUTE_OPEN') || state.deals[0];
  return { deal, dispute };
}

function resolveMoneyHoldReason(deal: Deal, dispute: Dispute | undefined, evidenceCount: number) {
  if (dispute && !['resolved', 'closed'].includes(dispute.status)) {
    return {
      title: 'Деньги удерживаются до решения спора',
      detail: `Причина: ${dispute.reason}. Evidence count: ${evidenceCount}. Финальный выпуск запрещён до закрытия спора и проверки документов.`,
    };
  }
  if (deal.openDisputeId || deal.status === 'DISPUTE_OPEN') {
    return {
      title: 'Есть спорный след, выпуск требует проверки',
      detail: 'Сделка содержит dispute marker. Банк должен видеть основание удержания и связь с evidence pack.',
    };
  }
  if (!deal.requiredDocumentsReady) {
    return {
      title: 'Выпуск ограничен документной готовностью',
      detail: 'Даже без активного спора деньги не должны выпускаться без полного документного пакета.',
    };
  }
  return {
    title: 'Спор не блокирует выпуск',
    detail: 'Evidence pack остаётся в сделке как доказательный архив, но текущий dispute gate не удерживает деньги.',
  };
}

function resolveBankDecision(deal: Deal, dispute: Dispute | undefined, evidenceCount: number): { label: string; tone: 'default' | 'accent' | 'danger' } {
  if (dispute && !['resolved', 'closed'].includes(dispute.status)) return { label: 'Hold', tone: 'danger' };
  if (deal.status === 'DISPUTE_OPEN' || deal.openDisputeId) return { label: 'Review', tone: 'danger' };
  if (!deal.requiredDocumentsReady || evidenceCount === 0) return { label: 'Review', tone: 'default' };
  return { label: 'Can release', tone: 'accent' };
}

function resolveDisputePackReadiness(deal: Deal, dispute: Dispute | undefined, evidenceCount: number, auditCount: number, timelineCount: number) {
  const checks = [
    { label: 'Evidence attached', ok: evidenceCount > 0 },
    { label: 'Dispute context', ok: Boolean(dispute) || Boolean(deal.openDisputeId) || deal.status === 'DISPUTE_OPEN' },
    { label: 'Audit trail', ok: auditCount > 0 },
    { label: 'Timeline linked', ok: timelineCount > 0 },
    { label: 'Money decision explained', ok: true },
  ];
  const score = Math.round((checks.filter((check) => check.ok).length / checks.length) * 100);
  return {
    score,
    checks,
    label: score >= 80 ? 'готов к sandbox-preview' : 'требует данных',
    tone: score >= 80 ? 'accent' as const : 'default' as const,
    detail: score >= 80
      ? 'Пакет можно показывать банку/арбитру как sandbox-preview: есть evidence, спорный контекст, audit/timeline и объяснение денежного решения.'
      : 'Пакет нельзя подавать как полный: не хватает evidence, dispute context, audit или timeline связки.',
  };
}

function ListBlock({ title, empty, rows }: { title: string; empty: string; rows: Array<{ id: string; kicker: string; text: string }> }) {
  return (
    <div style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: T }}>{title}</div>
      {rows.length ? rows.map((row) => (
        <div key={row.id} style={{ borderTop: `1px solid ${B}`, paddingTop: 8, display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 10, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{row.kicker}</span>
          <span style={{ fontSize: 12, color: M, lineHeight: 1.5 }}>{row.text}</span>
        </div>
      )) : <div style={{ fontSize: 12, color: M }}>{empty}</div>}
    </div>
  );
}

function Cell({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'accent' | 'danger' }) {
  const color = tone === 'accent' ? BRAND : tone === 'danger' ? DANGER : T;
  return (
    <div style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 5, fontSize: 13, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

function human(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

function compactRub(value: number) {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)} млн ₽`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} тыс. ₽`;
  return `${value} ₽`;
}

function btn(kind: 'default' | 'primary' = 'default') {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, color: BRAND, fontSize: 13, fontWeight: 800 };
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: SS, border: `1px solid ${B}`, color: T, fontSize: 13, fontWeight: 800 };
}
