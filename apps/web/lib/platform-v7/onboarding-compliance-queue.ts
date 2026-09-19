import type { PlatformV7OnboardingAccessGateModel } from './onboarding-access-gate';
import type { PlatformV7OnboardingDocumentsModel } from './onboarding-documents';
import type { PlatformV7OnboardingKycModel, PlatformV7OnboardingRole } from './onboarding-kyc';

export type PlatformV7ComplianceQueueStatus = 'clear' | 'review' | 'blocked' | 'restricted';
export type PlatformV7ComplianceQueuePriority = 'low' | 'medium' | 'high' | 'critical';
export type PlatformV7ComplianceQueueTone = 'success' | 'warning' | 'danger';

export interface PlatformV7ComplianceQueueCompanyInput {
  companyId: string;
  title: string;
  role: PlatformV7OnboardingRole;
  kyc: PlatformV7OnboardingKycModel;
  documents: PlatformV7OnboardingDocumentsModel;
  access: PlatformV7OnboardingAccessGateModel;
  submittedAt: string;
}

export interface PlatformV7ComplianceQueueRow {
  companyId: string;
  title: string;
  role: PlatformV7OnboardingRole;
  status: PlatformV7ComplianceQueueStatus;
  priority: PlatformV7ComplianceQueuePriority;
  blockerCount: number;
  readinessPercent: number;
  nextAction: string;
  submittedAt: string;
  tone: PlatformV7ComplianceQueueTone;
}

export interface PlatformV7ComplianceQueueSummary {
  total: number;
  clear: number;
  review: number;
  blocked: number;
  restricted: number;
  critical: number;
  averageReadinessPercent: number;
}

export interface PlatformV7ComplianceQueueModel {
  summary: PlatformV7ComplianceQueueSummary;
  rows: PlatformV7ComplianceQueueRow[];
  nextAction: string;
  isClean: boolean;
}

export function platformV7ComplianceQueueModel(
  companies: PlatformV7ComplianceQueueCompanyInput[],
): PlatformV7ComplianceQueueModel {
  const rows = companies.map(platformV7ComplianceQueueRow).sort(platformV7ComplianceQueueSort);
  const summary = platformV7ComplianceQueueSummary(rows);

  return {
    summary,
    rows,
    nextAction: platformV7ComplianceQueueNextAction(summary, rows),
    isClean: summary.total > 0 && summary.review === 0 && summary.blocked === 0 && summary.restricted === 0,
  };
}

export function platformV7ComplianceQueueRow(
  input: PlatformV7ComplianceQueueCompanyInput,
): PlatformV7ComplianceQueueRow {
  const blockerCount = input.kyc.blockerCount + input.documents.blockerCount + input.access.blockerCount;
  const status = platformV7ComplianceQueueStatus(input);
  const priority = platformV7ComplianceQueuePriority(status, blockerCount, input.kyc.readinessPercent, input.documents.readinessPercent);

  return {
    companyId: input.companyId,
    title: input.title,
    role: input.role,
    status,
    priority,
    blockerCount,
    readinessPercent: Math.round((input.kyc.readinessPercent + input.documents.readinessPercent) / 2),
    nextAction: platformV7ComplianceQueueRowNextAction(input, status),
    submittedAt: input.submittedAt,
    tone: platformV7ComplianceQueueTone(status),
  };
}

export function platformV7ComplianceQueueStatus(
  input: Pick<PlatformV7ComplianceQueueCompanyInput, 'kyc' | 'documents' | 'access'>,
): PlatformV7ComplianceQueueStatus {
  if (input.kyc.status === 'rejected' || input.kyc.status === 'restricted' || input.access.status === 'restricted') return 'restricted';
  if (input.kyc.status === 'manual_review' || input.access.status === 'manual_review') return 'review';
  if (!input.documents.canSubmitKyc || input.access.status === 'blocked' || input.kyc.status === 'incomplete' || input.kyc.status === 'not_started') return 'blocked';
  return 'clear';
}

export function platformV7ComplianceQueuePriority(
  status: PlatformV7ComplianceQueueStatus,
  blockerCount: number,
  kycReadinessPercent: number,
  documentReadinessPercent: number,
): PlatformV7ComplianceQueuePriority {
  if (status === 'restricted') return 'critical';
  if (blockerCount >= 5) return 'high';
  if (status === 'review') return 'high';
  if (status === 'blocked' && (kycReadinessPercent < 50 || documentReadinessPercent < 50)) return 'medium';
  if (status === 'blocked') return 'medium';
  return 'low';
}

export function platformV7ComplianceQueueSummary(rows: PlatformV7ComplianceQueueRow[]): PlatformV7ComplianceQueueSummary {
  const total = rows.length;
  const readinessSum = rows.reduce((sum, row) => sum + row.readinessPercent, 0);

  return {
    total,
    clear: rows.filter((row) => row.status === 'clear').length,
    review: rows.filter((row) => row.status === 'review').length,
    blocked: rows.filter((row) => row.status === 'blocked').length,
    restricted: rows.filter((row) => row.status === 'restricted').length,
    critical: rows.filter((row) => row.priority === 'critical').length,
    averageReadinessPercent: total === 0 ? 0 : Math.round(readinessSum / total),
  };
}

export function platformV7ComplianceQueueNextAction(
  summary: PlatformV7ComplianceQueueSummary,
  rows: PlatformV7ComplianceQueueRow[],
): string {
  if (summary.total === 0) return 'Нет компаний в очереди комплаенса.';
  if (summary.restricted > 0) return rows.find((row) => row.status === 'restricted')?.nextAction ?? 'Разобрать ограниченные компании.';
  if (summary.review > 0) return rows.find((row) => row.status === 'review')?.nextAction ?? 'Разобрать ручные проверки.';
  if (summary.blocked > 0) return rows.find((row) => row.status === 'blocked')?.nextAction ?? 'Закрыть блокеры онбординга.';
  return 'Очередь комплаенса чистая.';
}

export function platformV7ComplianceQueueTone(status: PlatformV7ComplianceQueueStatus): PlatformV7ComplianceQueueTone {
  if (status === 'clear') return 'success';
  if (status === 'review' || status === 'blocked') return 'warning';
  return 'danger';
}

export function platformV7ComplianceQueueSort(a: PlatformV7ComplianceQueueRow, b: PlatformV7ComplianceQueueRow): number {
  const priorityRank = (priority: PlatformV7ComplianceQueuePriority): number => {
    if (priority === 'critical') return 0;
    if (priority === 'high') return 1;
    if (priority === 'medium') return 2;
    return 3;
  };

  return priorityRank(a.priority) - priorityRank(b.priority)
    || b.blockerCount - a.blockerCount
    || new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    || a.companyId.localeCompare(b.companyId);
}

function platformV7ComplianceQueueRowNextAction(
  input: PlatformV7ComplianceQueueCompanyInput,
  status: PlatformV7ComplianceQueueStatus,
): string {
  if (status === 'clear') return 'Допуск компании подтверждён.';
  if (status === 'restricted') return input.kyc.nextAction;
  if (status === 'review') return input.kyc.nextAction;
  if (input.documents.blockerCount > 0) return input.documents.nextAction;
  return input.access.nextAction;
}
