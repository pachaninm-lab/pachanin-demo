import { serverApiUrl, serverAuthHeaders } from './server-api';

export type DisputeServerItem = {
  id: string;
  dealId: string;
  shipmentId?: string;
  status: string;
  type: string;
  claimAmountRub?: number;
  description: string;
  initiatorOrgId: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  resolvedAt?: string;
  owner?: string;
  slaMinutes?: number;
  slaDeadline?: string;
  moneyHold?: { amountRub: number; reason: string; heldAt: string };
  bankBasisDocumentId?: string;
  outcome?: string;
  evidenceCount?: number;
};

/**
 * Fail-closed dispute reader.
 *
 * The active UI must never replace an unavailable participant-scoped dispute
 * registry with local cases. Empty data means either no accessible disputes or
 * an unavailable source; owning workspaces use their independent availability
 * signals before presenting an all-clear state.
 */
export async function getDisputes(): Promise<DisputeServerItem[]> {
  try {
    const res = await fetch(serverApiUrl('/disputes'), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? data.map(parseDispute) : [];
  } catch {
    return [];
  }
}

export async function getDispute(id: string): Promise<DisputeServerItem | null> {
  const normalizedId = id.trim();
  if (!normalizedId) return null;
  try {
    const res = await fetch(serverApiUrl(`/disputes/${encodeURIComponent(normalizedId)}`), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!res.ok) return null;
    const dispute = parseDispute(await res.json());
    return dispute.id === normalizedId ? dispute : null;
  } catch {
    return null;
  }
}

export function disputeTotalHeldRub(disputes: DisputeServerItem[]): number {
  return disputes.reduce((sum, dispute) => sum + (dispute.moneyHold?.amountRub ?? 0), 0);
}

export function openDisputeCount(disputes: DisputeServerItem[]): number {
  return disputes.filter((dispute) => dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW').length;
}

function parseDispute(value: unknown): DisputeServerItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('dispute must be an object');
  const item = value as Record<string, unknown>;
  const dispute: DisputeServerItem = {
    id: requiredText(item.id, 'dispute.id'),
    dealId: requiredText(item.dealId, 'dispute.dealId'),
    status: requiredText(item.status, 'dispute.status'),
    type: requiredText(item.type, 'dispute.type'),
    description: requiredText(item.description, 'dispute.description'),
    initiatorOrgId: requiredText(item.initiatorOrgId, 'dispute.initiatorOrgId'),
    createdAt: requiredDate(item.createdAt, 'dispute.createdAt'),
  };

  assignOptionalText(dispute, 'shipmentId', item.shipmentId);
  assignOptionalText(dispute, 'resolvedAt', item.resolvedAt, requiredDate);
  assignOptionalText(dispute, 'owner', item.owner);
  assignOptionalText(dispute, 'slaDeadline', item.slaDeadline, requiredDate);
  assignOptionalText(dispute, 'bankBasisDocumentId', item.bankBasisDocumentId);
  assignOptionalText(dispute, 'outcome', item.outcome);
  assignOptionalNumber(dispute, 'claimAmountRub', item.claimAmountRub);
  assignOptionalNumber(dispute, 'slaMinutes', item.slaMinutes);
  assignOptionalNumber(dispute, 'evidenceCount', item.evidenceCount);

  if (item.severity !== null && item.severity !== undefined && item.severity !== '') {
    const severity = requiredText(item.severity, 'dispute.severity');
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity)) throw new Error('dispute.severity is invalid');
    dispute.severity = severity as DisputeServerItem['severity'];
  }

  if (item.moneyHold !== null && item.moneyHold !== undefined) {
    if (!item.moneyHold || typeof item.moneyHold !== 'object' || Array.isArray(item.moneyHold)) {
      throw new Error('dispute.moneyHold must be an object');
    }
    const hold = item.moneyHold as Record<string, unknown>;
    dispute.moneyHold = {
      amountRub: requiredFiniteNumber(hold.amountRub, 'dispute.moneyHold.amountRub'),
      reason: requiredText(hold.reason, 'dispute.moneyHold.reason'),
      heldAt: requiredDate(hold.heldAt, 'dispute.moneyHold.heldAt'),
    };
  }

  return Object.freeze(dispute);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new Error(`${field} is invalid`);
  }
  const normalized = String(value).trim();
  if (!normalized) throw new Error(`${field} is empty`);
  return normalized;
}

function requiredDate(value: unknown, field: string): string {
  const normalized = requiredText(value, field);
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${field} is invalid`);
  return normalized;
}

function requiredFiniteNumber(value: unknown, field: string): number {
  const number = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(number)) throw new Error(`${field} is invalid`);
  return number;
}

function assignOptionalText<K extends keyof DisputeServerItem>(
  target: DisputeServerItem,
  key: K,
  value: unknown,
  parser: (value: unknown, field: string) => string = requiredText,
): void {
  if (value === null || value === undefined || value === '') return;
  (target as Record<string, unknown>)[key] = parser(value, `dispute.${String(key)}`);
}

function assignOptionalNumber<K extends keyof DisputeServerItem>(
  target: DisputeServerItem,
  key: K,
  value: unknown,
): void {
  if (value === null || value === undefined || value === '') return;
  (target as Record<string, unknown>)[key] = requiredFiniteNumber(value, `dispute.${String(key)}`);
}
