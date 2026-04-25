import {
  platformV7AuditTrailModel,
  platformV7AuditTrailStableKey,
  type PlatformV7AuditTrailEvent,
  type PlatformV7AuditTrailModel,
  type PlatformV7AuditTrailTone,
} from './audit-trail';
import {
  platformV7EvidenceLedgerModel,
  platformV7EvidenceLedgerStableKey,
  type PlatformV7EvidenceLedgerEntry,
  type PlatformV7EvidenceLedgerModel,
} from './evidence-ledger';

export type PlatformV7AuditEvidenceExportPurpose = 'bank_review' | 'dispute' | 'due_diligence' | 'operator_archive';
export type PlatformV7AuditEvidenceExportStatus = 'ready' | 'incomplete' | 'blocked';
export type PlatformV7AuditEvidenceExportTone = PlatformV7AuditTrailTone;

export interface PlatformV7AuditEvidenceExportInput {
  exportId: string;
  dealId: string;
  purpose: PlatformV7AuditEvidenceExportPurpose;
  evidenceEntries: PlatformV7EvidenceLedgerEntry[];
  auditEvents: PlatformV7AuditTrailEvent[];
  createdAt: string;
  createdBy: string;
}

export interface PlatformV7AuditEvidenceExportModel {
  exportId: string;
  dealId: string;
  purpose: PlatformV7AuditEvidenceExportPurpose;
  status: PlatformV7AuditEvidenceExportStatus;
  tone: PlatformV7AuditEvidenceExportTone;
  canExport: boolean;
  blockerCount: number;
  blockers: string[];
  nextAction: string;
  evidenceCount: number;
  auditEventCount: number;
  evidenceKeys: string[];
  auditKeys: string[];
  ledger: PlatformV7EvidenceLedgerModel;
  auditTrail: PlatformV7AuditTrailModel;
  createdAt: string;
  createdBy: string;
}

export function platformV7AuditEvidenceExportModel(
  input: PlatformV7AuditEvidenceExportInput,
): PlatformV7AuditEvidenceExportModel {
  const dealEvidence = input.evidenceEntries.filter((entry) => entry.entityId === input.dealId || entry.entityType === 'dispute');
  const dealAudit = input.auditEvents.filter((event) => event.entityId === input.dealId || event.entityType === 'dispute');
  const ledger = platformV7EvidenceLedgerModel(dealEvidence);
  const auditTrail = platformV7AuditTrailModel(dealAudit);
  const blockers = platformV7AuditEvidenceExportBlockers(input, ledger, auditTrail);
  const status = platformV7AuditEvidenceExportStatus(blockers, ledger, auditTrail);

  return {
    exportId: input.exportId,
    dealId: input.dealId,
    purpose: input.purpose,
    status,
    tone: platformV7AuditEvidenceExportTone(status),
    canExport: status === 'ready',
    blockerCount: blockers.length,
    blockers,
    nextAction: platformV7AuditEvidenceExportNextAction(status, blockers),
    evidenceCount: ledger.entries.length,
    auditEventCount: auditTrail.events.length,
    evidenceKeys: ledger.entries.map(platformV7EvidenceLedgerStableKey),
    auditKeys: auditTrail.events.map(platformV7AuditTrailStableKey),
    ledger,
    auditTrail,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
  };
}

export function platformV7AuditEvidenceExportBlockers(
  input: Pick<PlatformV7AuditEvidenceExportInput, 'createdAt' | 'createdBy' | 'purpose'>,
  ledger: PlatformV7EvidenceLedgerModel,
  auditTrail: PlatformV7AuditTrailModel,
): string[] {
  const blockers = [
    ...ledger.blockers.map((blocker) => `ledger:${blocker}`),
    ...auditTrail.blockers.map((blocker) => `audit:${blocker}`),
  ];

  if (!ledger.canUseForDisputePack) blockers.push('ledger-not-ready');
  if (!auditTrail.canExportAuditPack) blockers.push('audit-not-ready');
  if (!Number.isFinite(new Date(input.createdAt).getTime())) blockers.push('invalid-created-at');
  if (!input.createdBy) blockers.push('missing-created-by');
  if (input.purpose === 'bank_review' && ledger.summary.anchored === 0) blockers.push('bank-review-missing-evidence');
  if (input.purpose === 'due_diligence' && auditTrail.summary.uniqueCorrelations === 0) blockers.push('due-diligence-missing-correlations');

  return [...new Set(blockers)];
}

export function platformV7AuditEvidenceExportStatus(
  blockers: string[],
  ledger: PlatformV7EvidenceLedgerModel,
  auditTrail: PlatformV7AuditTrailModel,
): PlatformV7AuditEvidenceExportStatus {
  if (ledger.status === 'broken' || auditTrail.status === 'broken') return 'blocked';
  if (blockers.length > 0 || ledger.status !== 'valid' || auditTrail.status !== 'valid') return 'incomplete';
  return 'ready';
}

export function platformV7AuditEvidenceExportTone(status: PlatformV7AuditEvidenceExportStatus): PlatformV7AuditEvidenceExportTone {
  if (status === 'ready') return 'success';
  if (status === 'incomplete') return 'warning';
  return 'danger';
}

export function platformV7AuditEvidenceExportNextAction(
  status: PlatformV7AuditEvidenceExportStatus,
  blockers: string[],
): string {
  if (status === 'ready') return 'Audit + evidence export готов.';
  if (status === 'blocked') return blockers[0] ? `Остановить export: ${blockers[0]}.` : 'Остановить export до восстановления доказательств и аудита.';
  return blockers[0] ? `Дособрать export: ${blockers[0]}.` : 'Дособрать audit + evidence export.';
}
