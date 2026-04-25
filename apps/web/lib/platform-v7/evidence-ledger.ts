export type PlatformV7EvidenceEntityType = 'lot' | 'purchase_request' | 'deal' | 'shipment' | 'quality_test' | 'document' | 'payment' | 'dispute';
export type PlatformV7EvidenceClass = 'photo' | 'weight_ticket' | 'lab_protocol' | 'transport_document' | 'bank_event' | 'contract' | 'operator_note' | 'system_event';
export type PlatformV7EvidenceSource = 'mobile_app' | 'operator_console' | 'bank_webhook' | 'edo' | 'fgis_grain' | 'gps_tracker' | 'lab_system' | 'manual_upload';
export type PlatformV7EvidenceStatus = 'draft' | 'anchored' | 'superseded' | 'rejected';
export type PlatformV7EvidenceLedgerStatus = 'valid' | 'warning' | 'broken';
export type PlatformV7EvidenceLedgerTone = 'success' | 'warning' | 'danger';

export interface PlatformV7EvidenceLedgerEntry {
  id: string;
  entityId: string;
  entityType: PlatformV7EvidenceEntityType;
  evidenceClass: PlatformV7EvidenceClass;
  source: PlatformV7EvidenceSource;
  status: PlatformV7EvidenceStatus;
  hash: string;
  prevHash?: string;
  signedAt: string;
  signedBy: string;
  title: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface PlatformV7EvidenceLedgerSummary {
  total: number;
  anchored: number;
  draft: number;
  superseded: number;
  rejected: number;
  uniqueEntities: number;
  uniqueSources: number;
}

export interface PlatformV7EvidenceLedgerModel {
  status: PlatformV7EvidenceLedgerStatus;
  tone: PlatformV7EvidenceLedgerTone;
  entries: PlatformV7EvidenceLedgerEntry[];
  summary: PlatformV7EvidenceLedgerSummary;
  blockerCount: number;
  blockers: string[];
  nextAction: string;
  canUseForDisputePack: boolean;
}

export function platformV7EvidenceLedgerModel(entries: PlatformV7EvidenceLedgerEntry[]): PlatformV7EvidenceLedgerModel {
  const sorted = platformV7EvidenceLedgerSort(entries);
  const blockers = platformV7EvidenceLedgerBlockers(sorted);
  const summary = platformV7EvidenceLedgerSummary(sorted);
  const status = platformV7EvidenceLedgerStatus(blockers, summary);

  return {
    status,
    tone: platformV7EvidenceLedgerTone(status),
    entries: sorted,
    summary,
    blockerCount: blockers.length,
    blockers,
    nextAction: platformV7EvidenceLedgerNextAction(status, blockers),
    canUseForDisputePack: status === 'valid' && summary.anchored > 0 && summary.rejected === 0,
  };
}

export function platformV7EvidenceLedgerSort(entries: PlatformV7EvidenceLedgerEntry[]): PlatformV7EvidenceLedgerEntry[] {
  return [...entries].sort((a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime() || a.id.localeCompare(b.id));
}

export function platformV7EvidenceLedgerSummary(entries: PlatformV7EvidenceLedgerEntry[]): PlatformV7EvidenceLedgerSummary {
  return {
    total: entries.length,
    anchored: entries.filter((entry) => entry.status === 'anchored').length,
    draft: entries.filter((entry) => entry.status === 'draft').length,
    superseded: entries.filter((entry) => entry.status === 'superseded').length,
    rejected: entries.filter((entry) => entry.status === 'rejected').length,
    uniqueEntities: new Set(entries.map((entry) => `${entry.entityType}:${entry.entityId}`)).size,
    uniqueSources: new Set(entries.map((entry) => entry.source)).size,
  };
}

export function platformV7EvidenceLedgerBlockers(entries: PlatformV7EvidenceLedgerEntry[]): string[] {
  const blockers: string[] = [];
  const seenIds = new Set<string>();

  entries.forEach((entry, index) => {
    if (seenIds.has(entry.id)) blockers.push(`duplicate-id:${entry.id}`);
    seenIds.add(entry.id);

    if (!entry.hash) blockers.push(`missing-hash:${entry.id}`);
    if (!entry.signedBy) blockers.push(`missing-signer:${entry.id}`);
    if (!Number.isFinite(new Date(entry.signedAt).getTime())) blockers.push(`invalid-signed-at:${entry.id}`);
    if (entry.status === 'rejected') blockers.push(`rejected-evidence:${entry.id}`);

    const previous = entries[index - 1];
    if (index === 0 && entry.prevHash) blockers.push(`unexpected-prev-hash:${entry.id}`);
    if (index > 0 && entry.prevHash !== previous.hash) blockers.push(`broken-chain:${entry.id}`);
  });

  return [...new Set(blockers)];
}

export function platformV7EvidenceLedgerStatus(
  blockers: string[],
  summary: PlatformV7EvidenceLedgerSummary,
): PlatformV7EvidenceLedgerStatus {
  if (blockers.some((blocker) => blocker.startsWith('duplicate-id') || blocker.startsWith('missing-hash') || blocker.startsWith('broken-chain') || blocker.startsWith('rejected-evidence'))) return 'broken';
  if (summary.total === 0 || summary.draft > 0 || blockers.length > 0) return 'warning';
  return 'valid';
}

export function platformV7EvidenceLedgerTone(status: PlatformV7EvidenceLedgerStatus): PlatformV7EvidenceLedgerTone {
  if (status === 'valid') return 'success';
  if (status === 'warning') return 'warning';
  return 'danger';
}

export function platformV7EvidenceLedgerNextAction(status: PlatformV7EvidenceLedgerStatus, blockers: string[]): string {
  if (status === 'valid') return 'Evidence ledger готов для dispute pack.';
  if (status === 'broken') return blockers[0] ? `Остановить использование доказательств: ${blockers[0]}.` : 'Остановить использование доказательств до восстановления цепочки.';
  return blockers[0] ? `Дозакрыть evidence ledger: ${blockers[0]}.` : 'Добавить подтверждённые доказательства.';
}

export function platformV7EvidenceLedgerStableKey(entry: PlatformV7EvidenceLedgerEntry): string {
  return `${entry.entityType}:${entry.entityId}:${entry.evidenceClass}:${entry.hash}`;
}
