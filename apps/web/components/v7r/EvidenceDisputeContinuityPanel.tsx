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
            P0-05 · доказательства → спор → деньги · тестовый режим
          </div>
          <div style={{ marginTop: 6, fontSize: 22, lineHeight: 1.15, fontWeight: 900, color: T }}>
            Доказательный пакет сделки {deal.id}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: M, maxWidth: 880 }}>
            Контур связывает доказательства, спор, банковское удержание и ленту сделки. Это тестовый слой: он объясняет логику удержания и проверки выплаты, но не вызывает боевые банковские, ФГИС или ЭДО-подключения.
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
        <Cell label='Спор' value={dispute ? humanDisputeStatus(dispute.status) : 'Нет'} tone={isOpen ? 'danger' : 'accent'} />
        <Cell label='Доказательства' value={String(evidence.length)} />
        <Cell label='Решение банка' value={bankDecision.label} tone={bankDecision.tone} />
        <Cell label='Готовность пакета' value={`${readiness.score}%`} tone={readiness.tone} />
      </div>

      <div style={{ background: isOpen ? DANGER_BG : WARN_BG, border: `1px solid ${isOpen ? DANGER_BORDER : WARN_BORDER}`, borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: isOpen ? DANGER : WARN, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Почему деньги удержаны или требуют проверки</div>
        <div style={{ fontSize: 14, color: T, fontWeight: 900, lineHeight: 1.5 }}>{moneyHoldReason.title}</div>
        <div style={{ fontSize: 12, color: M, lineHeight: 1.6 }}>{moneyHoldReason.detail}</div>
      </div>

      <div data-testid='dispute-pack-readiness' style={{ background: readiness.score >= 80 ? BRAND_BG : WARN_BG, border: `1px solid ${readiness.score >= 80 ? BRAND_BORDER : WARN_BORDER}`, borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: readiness.score >= 80 ? BRAND : WARN, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Готовность спорного пакета</div>
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
        <div style={{ fontSize: 12, color: M, lineHeight: 1.6 }}>Сводка готова только для тестового просмотра. PDF/ЭДО/КЭП экспорт не заявлен как боевой.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
        <ListBlock title='Доказательства' empty='Нет доказательств по выбранной сделке.' rows={evidence.slice(0, 5).map((item) => ({ id: item.id, kicker: humanEvidenceType(item.type), text: `${item.title} · хеш ${item.hash.slice(0, 18)}…` }))} />
        <ListBlock title='Спорный контекст' empty='Нет активного спора по выбранной сделке.' rows={dispute ? [{ id: dispute.id, kicker: humanDisputeReason(dispute.reason), text: `${humanDisputeStatus(dispute.status)} · влияние ${compactRub(dispute.amountImpactRub)}` }] : []} />
        <ListBlock title='Журнал действий' empty='Нет событий по выбранной сделке или спору.' rows={audit.map((item) => ({ id: item.id, kicker: humanRole(item.actorRole), text: `${humanAction(item.actionType)} · объект ${item.entityId}` }))} />
        <ListBlock title='Лента сделки' empty='Нет событий ленты по выбранной сделке.' rows={timeline.map((item) => ({ id: item.id, kicker: humanRole(item.actorRole), text: item.title }))} />
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
      detail: `Причина: ${dispute.reason}. Количество доказательств: ${evidenceCount}. Финальная выплата запрещена до закрытия спора и проверки документов.`,
    };
  }
  if (deal.openDisputeId || deal.status === 'DISPUTE_OPEN') {
    return {
      title: 'Есть спорный след, выплата требует проверки',
      detail: 'Сделка содержит отметку о споре. Банк должен видеть основание удержания и связь с доказательным пакетом.',
    };
  }
  if (!deal.requiredDocumentsReady) {
    return {
      title: 'Выплата ограничена готовностью документов',
      detail: 'Даже без активного спора деньги не должны выпускаться без полного документного пакета.',
    };
  }
  return {
    title: 'Спор не блокирует выплату',
    detail: 'Доказательный пакет остаётся в сделке как архив, но текущий спорный контур не удерживает деньги.',
  };
}

function resolveBankDecision(deal: Deal, dispute: Dispute | undefined, evidenceCount: number): { label: string; tone: 'default' | 'accent' | 'danger' } {
  if (dispute && !['resolved', 'closed'].includes(dispute.status)) return { label: 'Удержание', tone: 'danger' };
  if (deal.status === 'DISPUTE_OPEN' || deal.openDisputeId) return { label: 'Проверка', tone: 'danger' };
  if (!deal.requiredDocumentsReady || evidenceCount === 0) return { label: 'Проверка', tone: 'default' };
  return { label: 'Можно выпускать', tone: 'accent' };
}

function resolveDisputePackReadiness(deal: Deal, dispute: Dispute | undefined, evidenceCount: number, auditCount: number, timelineCount: number) {
  const checks = [
    { label: 'Доказательства прикреплены', ok: evidenceCount > 0 },
    { label: 'Контекст спора', ok: Boolean(dispute) || Boolean(deal.openDisputeId) || deal.status === 'DISPUTE_OPEN' },
    { label: 'Журнал действий', ok: auditCount > 0 },
    { label: 'Лента сделки связана', ok: timelineCount > 0 },
    { label: 'Решение по деньгам объяснено', ok: true },
  ];
  const score = Math.round((checks.filter((check) => check.ok).length / checks.length) * 100);
  return {
    score,
    checks,
    label: score >= 80 ? 'готов к тестовому просмотру' : 'требует данных',
    tone: score >= 80 ? 'accent' as const : 'default' as const,
    detail: score >= 80
      ? 'Пакет можно показывать банку и арбитру как тестовую сводку: есть доказательства, спорный контекст, журнал, лента и объяснение денежного решения.'
      : 'Пакет нельзя подавать как полный: не хватает доказательств, спорного контекста, журнала или ленты сделки.',
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

function humanEvidenceType(value: string) {
  const labels: Record<string, string> = {
    lab_protocol: 'Лабораторный протокол',
    photo: 'Фотофиксация',
    transport_document: 'Транспортный документ',
    weighing: 'Взвешивание',
    acceptance: 'Приёмка',
  };
  return labels[value] || human(value);
}

function humanDisputeStatus(value: string) {
  const labels: Record<string, string> = {
    open: 'Открыт',
    under_review: 'На проверке',
    resolved: 'Решён',
    closed: 'Закрыт',
  };
  return labels[value] || human(value);
}

function humanDisputeReason(value: string) {
  const labels: Record<string, string> = {
    quality_mismatch: 'Расхождение качества',
    weight_mismatch: 'Расхождение веса',
    document_mismatch: 'Расхождение документов',
    late_delivery: 'Срыв срока доставки',
  };
  return labels[value] || human(value);
}

function humanRole(value: string) {
  const labels: Record<string, string> = {
    seller: 'Продавец',
    buyer: 'Покупатель',
    bank: 'Банк',
    arbitrator: 'Арбитр',
    logistics: 'Логистика',
    driver: 'Водитель',
    elevator: 'Элеватор',
    lab: 'Лаборатория',
    surveyor: 'Сюрвейер',
    compliance: 'Комплаенс',
    operator: 'Оператор',
    system: 'Система',
  };
  return labels[value] || human(value);
}

function humanAction(value: string) {
  const labels: Record<string, string> = {
    dispute_opened: 'Спор открыт',
    evidence_uploaded: 'Доказательство загружено',
    money_hold_requested: 'Запрошено удержание денег',
    bank_review_requested: 'Запрошена банковская проверка',
    decision_recorded: 'Решение зафиксировано',
    document_checked: 'Документ проверен',
    timeline_event_added: 'Событие добавлено в ленту',
  };
  return labels[value] || human(value);
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
