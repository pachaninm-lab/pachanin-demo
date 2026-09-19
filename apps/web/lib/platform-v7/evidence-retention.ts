import type { PlatformV7AuditTrailEvent } from './audit-trail';
import type { PlatformV7EvidenceLedgerEntry } from './evidence-ledger';

export type PlatformV7EvidenceRetentionPurpose = 'standard_archive' | 'bank_review' | 'dispute_hold' | 'due_diligence';
export type PlatformV7EvidenceRetentionStatus = 'active' | 'expiring' | 'expired' | 'legal_hold';
export type PlatformV7EvidenceRetentionTone = 'success' | 'warning' | 'danger';

export interface PlatformV7EvidenceRetentionInput {
  entityId: string;
  purpose: PlatformV7EvidenceRetentionPurpose;
  evidenceEntries: PlatformV7EvidenceLedgerEntry[];
  auditEvents: PlatformV7AuditTrailEvent[];
  retainedUntil: string;
  checkedAt: string;
  legalHold: boolean;
  disputeOpen: boolean;
}

export interface PlatformV7EvidenceRetentionModel {
  entityId: string;
  purpose: PlatformV7EvidenceRetentionPurpose;
  status: PlatformV7EvidenceRetentionStatus;
  tone: PlatformV7EvidenceRetentionTone;
  canPurge: boolean;
  retainedUntil: string;
  daysUntilExpiry: number;
  evidenceCount: number;
  auditEventCount: number;
  blockerCount: number;
  blockers: string[];
  nextAction: string;
}

export function platformV7EvidenceRetentionModel(
  input: PlatformV7EvidenceRetentionInput,
): PlatformV7EvidenceRetentionModel {
  const blockers = platformV7EvidenceRetentionBlockers(input);
  const daysUntilExpiry = platformV7EvidenceRetentionDaysUntilExpiry(input.retainedUntil, input.checkedAt);
  const status = platformV7EvidenceRetentionStatus(input, daysUntilExpiry, blockers);

  return {
    entityId: input.entityId,
    purpose: input.purpose,
    status,
    tone: platformV7EvidenceRetentionTone(status),
    canPurge: platformV7EvidenceRetentionCanPurge(status, input, blockers),
    retainedUntil: input.retainedUntil,
    daysUntilExpiry,
    evidenceCount: input.evidenceEntries.length,
    auditEventCount: input.auditEvents.length,
    blockerCount: blockers.length,
    blockers,
    nextAction: platformV7EvidenceRetentionNextAction(status, blockers),
  };
}

export function platformV7EvidenceRetentionBlockers(input: PlatformV7EvidenceRetentionInput): string[] {
  const blockers: string[] = [];

  if (!Number.isFinite(new Date(input.retainedUntil).getTime())) blockers.push('invalid-retained-until');
  if (!Number.isFinite(new Date(input.checkedAt).getTime())) blockers.push('invalid-checked-at');
  if (input.evidenceEntries.length === 0) blockers.push('missing-evidence');
  if (input.auditEvents.length === 0) blockers.push('missing-audit');
  if (input.disputeOpen && input.purpose !== 'dispute_hold') blockers.push('open-dispute-requires-hold');
  if (input.legalHold && input.purpose !== 'dispute_hold') blockers.push('legal-hold-purpose-mismatch');

  return [...new Set(blockers)];
}

export function platformV7EvidenceRetentionDaysUntilExpiry(retainedUntil: string, checkedAt: string): number {
  const retainedMs = new Date(retainedUntil).getTime();
  const checkedMs = new Date(checkedAt).getTime();

  if (!Number.isFinite(retainedMs) || !Number.isFinite(checkedMs)) return Number.NaN;
  return Math.ceil((retainedMs - checkedMs) / 86_400_000);
}

export function platformV7EvidenceRetentionStatus(
  input: Pick<PlatformV7EvidenceRetentionInput, 'legalHold'>,
  daysUntilExpiry: number,
  blockers: string[],
): PlatformV7EvidenceRetentionStatus {
  if (input.legalHold) return 'legal_hold';
  if (blockers.some((blocker) => blocker.startsWith('invalid-'))) return 'expired';
  if (!Number.isFinite(daysUntilExpiry) || daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 30) return 'expiring';
  return 'active';
}

export function platformV7EvidenceRetentionCanPurge(
  status: PlatformV7EvidenceRetentionStatus,
  input: Pick<PlatformV7EvidenceRetentionInput, 'legalHold' | 'disputeOpen'>,
  blockers: string[],
): boolean {
  return status === 'expired'
    && !input.legalHold
    && !input.disputeOpen
    && blockers.every((blocker) => blocker !== 'missing-evidence' && blocker !== 'missing-audit');
}

export function platformV7EvidenceRetentionTone(status: PlatformV7EvidenceRetentionStatus): PlatformV7EvidenceRetentionTone {
  if (status === 'active') return 'success';
  if (status === 'expiring' || status === 'legal_hold') return 'warning';
  return 'danger';
}

export function platformV7EvidenceRetentionNextAction(
  status: PlatformV7EvidenceRetentionStatus,
  blockers: string[],
): string {
  if (status === 'active') return 'Evidence retention активен.';
  if (status === 'legal_hold') return 'Сохранить доказательства до снятия legal hold.';
  if (status === 'expiring') return 'Продлить retention или подтвердить архивирование.';
  return blockers[0] ? `Проверить retention: ${blockers[0]}.` : 'Подтвердить безопасное удаление или продление retention.';
}
