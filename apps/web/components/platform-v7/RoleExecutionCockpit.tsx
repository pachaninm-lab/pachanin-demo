import {
  ExecutionCanvas,
  ExecutionCardGrid,
  ExecutionKpiCard,
  ExecutionOperationalCard,
  ExecutionStatusBadge,
} from '@/components/platform-v7/ExecutionDesignSystem';
import type { RoleExecutionCockpitModel } from '@/lib/platform-v7/role-execution-cockpit';
import type { ReactNode } from 'react';

export function RoleExecutionCockpitContent({ cockpit }: { readonly cockpit: RoleExecutionCockpitModel }) {
  return (
    <>
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
