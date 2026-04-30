import Link from 'next/link';
import {
  calculateDealAmountRub,
  createExecutionSimulationState,
  type Deal,
  type DomainExecutionState,
  type PlatformRole,
} from '../../../../packages/domain-core/src/execution-simulation';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = 'var(--pc-accent-strong)';
const BRAND_BG = 'var(--pc-accent-bg)';
const BRAND_BORDER = 'var(--pc-accent-border)';
const WARN_BG = 'rgba(217,119,6,0.08)';
const WARN_BORDER = 'rgba(217,119,6,0.18)';
const WARN = '#B45309';
const DANGER_BG = 'rgba(220,38,38,0.08)';
const DANGER_BORDER = 'rgba(220,38,38,0.18)';
const DANGER = '#B91C1C';

const ROLE_COPY: Partial<Record<PlatformRole, { label: string; headline: string; nextAction: string; evidenceFocus: string }>> = {
  buyer: {
    label: 'Покупатель',
    headline: 'Связка закупки: сделка → приёмка → документы → деньги',
    nextAction: 'Проверить, что держит выпуск денег: документы, приёмка, качество или спор.',
    evidenceFocus: 'Качество, вес, лаборатория, документы покупателя, банковый статус.',
  },
  seller: {
    label: 'Продавец',
    headline: 'Связка выплаты: лот → сделка → документы → снятие удержания',
    nextAction: 'Закрыть документный или спорный blocker, который мешает выплате.',
    evidenceFocus: 'ФГИС/партия, документы продавца, акт, удержание, причина REVIEW.',
  },
  bank: {
    label: 'Банк',
    headline: 'Связка денег: reserve → hold → release → audit',
    nextAction: 'Проверить допустимость следующего банкового события и idempotency-контроль.',
    evidenceFocus: 'Документы, dispute status, callback, reserve/hold/release, audit event.',
  },
  logistics: {
    label: 'Логистика',
    headline: 'Связка рейса: назначение → погрузка → прибытие → транспортный gate',
    nextAction: 'Закрыть событие рейса, которое держит приёмку или банковый выпуск.',
    evidenceFocus: 'Маршрут, водитель, прибытие, GPS/photo evidence, транспортные документы.',
  },
  driver: {
    label: 'Водитель',
    headline: 'Связка поля: рейс → фото/гео → прибытие → вес',
    nextAction: 'Зафиксировать следующее полевое событие без перегруза интерфейса.',
    evidenceFocus: 'Фото, GPS, прибытие, пломба, вес, офлайн-событие.',
  },
  lab: {
    label: 'Лаборатория',
    headline: 'Связка качества: проба → протокол → приёмка → спор/выпуск',
    nextAction: 'Довести лабораторный результат до статуса, который открывает приёмку или спор.',
    evidenceFocus: 'Протокол, влажность, клейковина, белок, версия анализа, спорность.',
  },
};

const ROLE_PRIORITY: Partial<Record<PlatformRole, Deal['status'][]>> = {
  buyer: ['DOCUMENTS_READY', 'ACCEPTED', 'DISPUTE_OPEN', 'RESERVE_CONFIRMED'],
  seller: ['DISPUTE_OPEN', 'DOCUMENTS_READY', 'ACCEPTED', 'RESERVE_CONFIRMED'],
  bank: ['DOCUMENTS_READY', 'PAYMENT_RELEASE_REQUESTED', 'RESERVE_REQUESTED', 'DISPUTE_OPEN'],
  logistics: ['DRIVER_ASSIGNED', 'LOADING_CONFIRMED', 'LOADED', 'IN_TRANSIT', 'ARRIVED'],
  driver: ['DRIVER_ASSIGNED', 'LOADING_CONFIRMED', 'LOADED', 'IN_TRANSIT', 'ARRIVED'],
  lab: ['WEIGHING_CONFIRMED', 'LAB_SAMPLING', 'LAB_PROTOCOL_CREATED', 'DISPUTE_OPEN'],
};

export function RoleContinuityPanel({ role, compact = false }: { role: PlatformRole; compact?: boolean }) {
  const state = createExecutionSimulationState();
  const copy = ROLE_COPY[role] || {
    label: role,
    headline: 'Связка роли с контуром исполнения сделки',
    nextAction: 'Проверить следующий owner, blocker и допустимое действие.',
    evidenceFocus: 'Сделка, доказательства, audit, timeline.',
  };
  const deal = selectRoleDeal(state, role);
  const evidence = state.evidence.filter((item) => item.dealId === deal.id).slice(0, 3);
  const audit = state.auditEvents.filter((item) => item.entityId === deal.id).slice(-3).reverse();
  const timeline = state.dealTimeline.filter((item) => item.dealId === deal.id).slice(-3).reverse();
  const openDispute = state.disputes.find((item) => item.dealId === deal.id && !['resolved', 'closed'].includes(item.status));
  const amount = calculateDealAmountRub(deal);
  const moneyBlocked = openDispute || deal.openDisputeId || deal.holdAmount || deal.blocker;

  return (
    <section data-testid={`role-continuity-${role}`} style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: compact ? 14 : 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            P0-04 · continuity · {copy.label}
          </div>
          <div style={{ marginTop: 6, fontSize: compact ? 18 : 22, lineHeight: 1.15, fontWeight: 900, color: T }}>{copy.headline}</div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: M, maxWidth: 860 }}>
            Единый контур роли показывает не отдельный кабинет, а связку: текущая сделка, допустимое действие, доказательства, audit и timeline. Это simulation-only слой, без заявления боевых интеграций.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/platform-v7/deals/${deal.id}`} style={btn('primary')}>Открыть сделку</Link>
          <Link href={role === 'bank' ? '/platform-v7/bank' : role === 'logistics' || role === 'driver' ? '/platform-v7/logistics' : role === 'lab' ? '/platform-v7/lab' : '/platform-v7/control-tower'} style={btn()}>Открыть контур</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <Cell label='Сделка' value={deal.id} mono />
        <Cell label='Статус' value={humanStatus(deal.status)} tone={deal.status === 'DISPUTE_OPEN' ? 'danger' : 'default'} />
        <Cell label='Сумма сделки' value={compactRub(amount)} />
        <Cell label='Owner' value={roleLabel(deal.ownerRole)} tone={deal.ownerRole === role ? 'accent' : 'default'} />
        <Cell label='Деньги' value={moneyBlocked ? 'Есть blocker' : 'Без blocker'} tone={moneyBlocked ? 'danger' : 'accent'} />
      </div>

      <div style={{ background: moneyBlocked ? DANGER_BG : BRAND_BG, border: `1px solid ${moneyBlocked ? DANGER_BORDER : BRAND_BORDER}`, borderRadius: 14, padding: 14, display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: moneyBlocked ? DANGER : BRAND, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Следующее действие</div>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: T, fontWeight: 800 }}>{copy.nextAction}</div>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: M }}>Доказательный фокус: {copy.evidenceFocus}</div>
        {deal.blocker ? <div style={{ fontSize: 12, color: DANGER, fontWeight: 800 }}>Blocker: {deal.blocker}</div> : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
        <ListBlock title='Evidence' empty='Нет evidence по выбранной сделке.' rows={evidence.map((item) => ({ id: item.id, kicker: item.type, text: item.title }))} />
        <ListBlock title='Audit' empty='Нет audit events по выбранной сделке.' rows={audit.map((item) => ({ id: item.id, kicker: item.actorRole, text: `${item.actionType} · ${item.entityId}` }))} />
        <ListBlock title='Timeline' empty='Нет timeline events по выбранной сделке.' rows={timeline.map((item) => ({ id: item.id, kicker: item.actorRole, text: item.title }))} />
      </div>
    </section>
  );
}

function selectRoleDeal(state: DomainExecutionState, role: PlatformRole) {
  const priorities = ROLE_PRIORITY[role] || [];
  const byOwner = state.deals.find((deal) => deal.ownerRole === role);
  if (byOwner) return byOwner;
  const byStatus = priorities.map((status) => state.deals.find((deal) => deal.status === status)).find(Boolean);
  if (byStatus) return byStatus;
  return state.deals[0];
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

function Cell({ label, value, tone = 'default', mono = false }: { label: string; value: string; tone?: 'default' | 'accent' | 'danger'; mono?: boolean }) {
  const color = tone === 'accent' ? BRAND : tone === 'danger' ? DANGER : T;
  return (
    <div style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 5, fontSize: 13, fontWeight: 900, color, fontFamily: mono ? 'JetBrains Mono, monospace' : undefined }}>{value}</div>
    </div>
  );
}

function humanStatus(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

function roleLabel(role: PlatformRole) {
  const labels: Partial<Record<PlatformRole, string>> = {
    seller: 'Продавец', buyer: 'Покупатель', operator: 'Оператор', bank: 'Банк', logistics: 'Логистика', driver: 'Водитель', elevator: 'Элеватор', lab: 'Лаборатория', surveyor: 'Сюрвейер', arbitrator: 'Арбитр', compliance: 'Комплаенс', admin: 'Админ',
  };
  return labels[role] || role;
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
