import {
  platformV7EvidenceLedgerModel,
  platformV7EvidenceLedgerStableKey,
  type PlatformV7EvidenceClass,
  type PlatformV7EvidenceLedgerEntry,
  type PlatformV7EvidenceLedgerModel,
  type PlatformV7EvidenceLedgerTone,
} from './evidence-ledger';

export type PlatformV7DisputeEvidencePackStatus = 'complete' | 'incomplete' | 'broken';
export type PlatformV7DisputeEvidencePackTone = PlatformV7EvidenceLedgerTone;

export interface PlatformV7DisputeEvidencePackInput {
  disputeId: string;
  dealId: string;
  entries: PlatformV7EvidenceLedgerEntry[];
  requiredClasses: PlatformV7EvidenceClass[];
  createdAt: string;
  createdBy: string;
}

export interface PlatformV7DisputeEvidencePackModel {
  disputeId: string;
  dealId: string;
  status: PlatformV7DisputeEvidencePackStatus;
  tone: PlatformV7DisputeEvidencePackTone;
  canSubmit: boolean;
  requiredClasses: PlatformV7EvidenceClass[];
  presentClasses: PlatformV7EvidenceClass[];
  missingClasses: PlatformV7EvidenceClass[];
  evidenceCount: number;
  blockerCount: number;
  blockers: string[];
  nextAction: string;
  entries: PlatformV7EvidenceLedgerEntry[];
  ledger: PlatformV7EvidenceLedgerModel;
  stableKeys: string[];
  createdAt: string;
  createdBy: string;
}

export function platformV7DisputeEvidencePackModel(
  input: PlatformV7DisputeEvidencePackInput,
): PlatformV7DisputeEvidencePackModel {
  const dealEntries = input.entries.filter((entry) => entry.entityId === input.dealId || entry.entityType === 'dispute');
  const ledger = platformV7EvidenceLedgerModel(dealEntries);
  const presentClasses = platformV7DisputeEvidencePresentClasses(ledger.entries);
  const missingClasses = platformV7DisputeEvidenceMissingClasses(input.requiredClasses, presentClasses);
  const blockers = platformV7DisputeEvidencePackBlockers(ledger, missingClasses, input);
  const status = platformV7DisputeEvidencePackStatus(ledger, missingClasses, blockers);

  return {
    disputeId: input.disputeId,
    dealId: input.dealId,
    status,
    tone: platformV7DisputeEvidencePackTone(status),
    canSubmit: status === 'complete',
    requiredClasses: [...new Set(input.requiredClasses)],
    presentClasses,
    missingClasses,
    evidenceCount: ledger.entries.length,
    blockerCount: blockers.length,
    blockers,
    nextAction: platformV7DisputeEvidencePackNextAction(status, blockers),
    entries: platformV7DisputeEvidencePackSort(ledger.entries),
    ledger,
    stableKeys: ledger.entries.map(platformV7EvidenceLedgerStableKey),
    createdAt: input.createdAt,
    createdBy: input.createdBy,
  };
}

export function platformV7DisputeEvidencePresentClasses(
  entries: PlatformV7EvidenceLedgerEntry[],
): PlatformV7EvidenceClass[] {
  return [...new Set(entries.filter((entry) => entry.status === 'anchored').map((entry) => entry.evidenceClass))].sort();
}

export function platformV7DisputeEvidenceMissingClasses(
  requiredClasses: PlatformV7EvidenceClass[],
  presentClasses: PlatformV7EvidenceClass[],
): PlatformV7EvidenceClass[] {
  const present = new Set(presentClasses);
  return [...new Set(requiredClasses)].filter((evidenceClass) => !present.has(evidenceClass)).sort();
}

export function platformV7DisputeEvidencePackBlockers(
  ledger: PlatformV7EvidenceLedgerModel,
  missingClasses: PlatformV7EvidenceClass[],
  input: Pick<PlatformV7DisputeEvidencePackInput, 'createdAt' | 'createdBy'>,
): string[] {
  const blockers = [
    ...ledger.blockers.map((blocker) => `ledger:${blocker}`),
    ...missingClasses.map((evidenceClass) => `missing-class:${evidenceClass}`),
  ];

  if (!Number.isFinite(new Date(input.createdAt).getTime())) blockers.push('invalid-created-at');
  if (!input.createdBy) blockers.push('missing-created-by');
  if (!ledger.canUseForDisputePack) blockers.push('ledger-not-dispute-ready');

  return [...new Set(blockers)];
}

export function platformV7DisputeEvidencePackStatus(
  ledger: PlatformV7EvidenceLedgerModel,
  missingClasses: PlatformV7EvidenceClass[],
  blockers: string[],
): PlatformV7DisputeEvidencePackStatus {
  if (ledger.status === 'broken' || blockers.some((blocker) => blocker.startsWith('ledger:broken-chain') || blocker.startsWith('ledger:rejected-evidence'))) return 'broken';
  if (missingClasses.length > 0 || blockers.length > 0 || ledger.status !== 'valid') return 'incomplete';
  return 'complete';
}

export function platformV7DisputeEvidencePackTone(
  status: PlatformV7DisputeEvidencePackStatus,
): PlatformV7DisputeEvidencePackTone {
  if (status === 'complete') return 'success';
  if (status === 'incomplete') return 'warning';
  return 'danger';
}

export function platformV7DisputeEvidencePackNextAction(
  status: PlatformV7DisputeEvidencePackStatus,
  blockers: string[],
): string {
  if (status === 'complete') return 'Dispute pack готов к передаче.';
  if (status === 'broken') return blockers[0] ? `Остановить dispute pack: ${blockers[0]}.` : 'Остановить dispute pack до восстановления доказательств.';
  return blockers[0] ? `Дособрать dispute pack: ${blockers[0]}.` : 'Дособрать доказательства по спору.';
}

export function platformV7DisputeEvidencePackSort(
  entries: PlatformV7EvidenceLedgerEntry[],
): PlatformV7EvidenceLedgerEntry[] {
  const rank = (evidenceClass: PlatformV7EvidenceClass): number => {
    if (evidenceClass === 'contract') return 0;
    if (evidenceClass === 'bank_event') return 1;
    if (evidenceClass === 'weight_ticket') return 2;
    if (evidenceClass === 'lab_protocol') return 3;
    if (evidenceClass === 'transport_document') return 4;
    if (evidenceClass === 'photo') return 5;
    return 6;
  };

  return [...entries].sort((a, b) => rank(a.evidenceClass) - rank(b.evidenceClass)
    || new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime()
    || a.id.localeCompare(b.id));
}
