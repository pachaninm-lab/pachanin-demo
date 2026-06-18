import {
  ExecutionCanvas,
  ExecutionCardGrid,
  ExecutionKpiCard,
  ExecutionOperationalCard,
  ExecutionStatusBadge,
} from '@/components/platform-v7/ExecutionDesignSystem';
import type { RoleExecutionCockpitModel } from '@/lib/platform-v7/role-execution-cockpit';
import type { CSSProperties, ReactNode } from 'react';

const contractGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 8,
  margin: '0 0 12px',
} satisfies CSSProperties;

const contractCardStyle = {
  display: 'grid',
  gap: 4,
  padding: '10px 12px',
  borderRadius: 16,
  border: '1px solid var(--pc-border)',
  background: 'var(--pc-bg-card)',
  boxShadow: 'var(--pc-shadow-sm)',
} satisfies CSSProperties;

const contractLabelStyle = {
  fontSize: 10,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--pc-text-muted)',
} satisfies CSSProperties;

const contractValueStyle = {
  fontSize: 12,
  fontWeight: 900,
  lineHeight: 1.35,
  color: 'var(--pc-text-primary)',
} satisfies CSSProperties;

function firstMoneyKpi(cockpit: RoleExecutionCockpitModel) {
  return cockpit.kpis.find((kpi) => kpi.tone === 'money' || /деньг|резерв|удерж|банк|₽/i.test(`${kpi.label} ${kpi.value} ${kpi.note}`));
}

function firstDocumentKpi(cockpit: RoleExecutionCockpitModel) {
  return cockpit.kpis.find((kpi) => /документ|сдиз|этрн|эпд|акт|протокол/i.test(`${kpi.label} ${kpi.value} ${kpi.note}`));
}

function contractItems(cockpit: RoleExecutionCockpitModel) {
  const primaryOperation = cockpit.operations[0];
  const money = firstMoneyKpi(cockpit);
  const documents = firstDocumentKpi(cockpit);

  return [
    { label: 'Статус', value: primaryOperation?.status || cockpit.statuses[0]?.label || 'роль активна' },
    { label: 'Блокер', value: primaryOperation?.blocker || 'активный стоп не указан' },
    { label: 'Главное действие', value: primaryOperation?.action.label || primaryOperation?.nextStep || 'открыть следующий шаг' },
    { label: 'Деньги', value: money ? `${money.value} · ${money.note}` : 'денежный эффект не указан' },
    { label: 'Документы / evidence', value: documents ? `${documents.value} · ${documents.note}` : primaryOperation?.cause || 'доказательный пакет не указан' },
  ];
}

export function RoleExecutionScreenContract({ cockpit }: { readonly cockpit: RoleExecutionCockpitModel }) {
  return (
    <section data-testid={`platform-v7-${cockpit.role}-screen-contract`} aria-label='Контракт экрана роли' style={contractGridStyle}>
      {contractItems(cockpit).map((item) => (
        <article key={item.label} style={contractCardStyle}>
          <span style={contractLabelStyle}>{item.label}</span>
          <strong style={contractValueStyle}>{item.value}</strong>
        </article>
      ))}
    </section>
  );
}

export function RoleExecutionCockpitContent({ cockpit }: { readonly cockpit: RoleExecutionCockpitModel }) {
  return (
    <>
      <RoleExecutionScreenContract cockpit={cockpit} />
      <ExecutionCardGrid min={180} testId={`platform-v7-${cockpit.role}-kpis`}>
        {cockpit.kpis.map((kpi) => (
          <ExecutionKpiCard key={kpi.label} label={kpi.label} value={kpi.value} note={kpi.note} tone={kpi.tone} />
        ))}
      </ExecutionCardGrid>
      <ExecutionCardGrid min={280} testId={`platform-v7-${cockpit.role}-operations`}>
        {cockpit.operations.map((operation) => (
          <ExecutionOperationalCard
            key={operation.title}
            title={operation.title}
            status={operation.status}
            statusTone={operation.statusTone}
            shortFact={operation.shortFact}
            blocker={operation.blocker}
            blockerTone={operation.blockerTone}
            cause={operation.cause}
            nextStep={operation.nextStep}
            action={operation.action}
          />
        ))}
      </ExecutionCardGrid>
    </>
  );
}

export function RoleExecutionCockpitPage({
  cockpit,
  children,
}: {
  readonly cockpit: RoleExecutionCockpitModel;
  readonly children?: ReactNode;
}) {
  return (
    <ExecutionCanvas
      title={cockpit.title}
      eyebrow={cockpit.eyebrow}
      subtitle={cockpit.subtitle}
      role={cockpit.role}
      meta={cockpit.statuses.map((status) => (
        <ExecutionStatusBadge key={status.label} tone={status.tone}>{status.label}</ExecutionStatusBadge>
      ))}
      testId={`platform-v7-${cockpit.role}-execution-cockpit`}
    >
      <RoleExecutionCockpitContent cockpit={cockpit} />
      {children}
    </ExecutionCanvas>
  );
}
