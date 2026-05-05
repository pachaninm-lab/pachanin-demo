import type { RoleExecutionSummary, UserRole } from '../types';

export type VisibilityArea =
  | 'batches'
  | 'lots'
  | 'rfq'
  | 'offers'
  | 'deals'
  | 'money'
  | 'documents'
  | 'quality'
  | 'weight'
  | 'logistics'
  | 'driver_field'
  | 'elevator_terminal'
  | 'lab_protocols'
  | 'bank_release'
  | 'support'
  | 'disputes'
  | 'investor'
  | 'internal_notes'
  | 'closed_bids'
  | 'commercial_margin'
  | 'role_switcher';

const allowedAreas: Record<UserRole, readonly VisibilityArea[]> = {
  seller: ['batches', 'lots', 'offers', 'deals', 'money', 'documents', 'quality', 'weight', 'logistics', 'support', 'disputes'],
  buyer: ['rfq', 'lots', 'offers', 'deals', 'money', 'documents', 'quality', 'weight', 'logistics', 'support', 'disputes'],
  logistics: ['logistics', 'driver_field', 'documents', 'support'],
  driver: ['driver_field'],
  elevator: ['elevator_terminal', 'weight', 'quality', 'documents', 'support'],
  lab: ['lab_protocols', 'quality', 'support'],
  bank: ['deals', 'money', 'documents', 'quality', 'weight', 'bank_release', 'disputes'],
  operator: ['batches', 'lots', 'rfq', 'offers', 'deals', 'money', 'documents', 'quality', 'weight', 'logistics', 'driver_field', 'elevator_terminal', 'lab_protocols', 'bank_release', 'support', 'disputes', 'internal_notes', 'closed_bids', 'commercial_margin', 'role_switcher'],
  investor: ['investor'],
  admin: ['batches', 'lots', 'rfq', 'offers', 'deals', 'money', 'documents', 'quality', 'weight', 'logistics', 'driver_field', 'elevator_terminal', 'lab_protocols', 'bank_release', 'support', 'disputes', 'internal_notes', 'closed_bids', 'commercial_margin', 'role_switcher'],
};

export function canSee(role: UserRole, area: VisibilityArea): boolean {
  return allowedAreas[role].includes(area);
}

export function assertRoleVisibility(summary: RoleExecutionSummary): string[] {
  const leaks: string[] = [];
  if (summary.role === 'driver') {
    if (summary.moneySummary) leaks.push('Водитель не должен видеть деньги.');
    if (summary.documentSummary) leaks.push('Водитель видит только полевой документ, не общий документный контур.');
  }
  if (summary.role === 'logistics' && summary.moneySummary) leaks.push('Логист не должен видеть банковский резерв.');
  if (summary.role === 'elevator' && summary.moneySummary) leaks.push('Элеватор не должен видеть коммерческие суммы.');
  if (summary.role === 'lab' && summary.moneySummary) leaks.push('Лаборатория не должна видеть полную коммерческую сумму.');
  if (summary.role === 'investor' && summary.supportSummary) leaks.push('Инвестор не должен видеть операционные обращения.');
  return leaks;
}

export function projectSummaryForRole(summary: RoleExecutionSummary, role: UserRole): RoleExecutionSummary {
  return {
    ...summary,
    role,
    moneySummary: canSee(role, 'money') || canSee(role, 'bank_release') ? summary.moneySummary : undefined,
    documentSummary: canSee(role, 'documents') ? summary.documentSummary : undefined,
    logisticsSummary: canSee(role, 'logistics') || canSee(role, 'driver_field') ? summary.logisticsSummary : undefined,
    qualitySummary: canSee(role, 'quality') || canSee(role, 'lab_protocols') ? summary.qualitySummary : undefined,
    sdizSummary: canSee(role, 'documents') || canSee(role, 'bank_release') ? summary.sdizSummary : undefined,
    supportSummary: canSee(role, 'support') ? summary.supportSummary : undefined,
  };
}
