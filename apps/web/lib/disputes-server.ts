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

const STATIC_FALLBACK: DisputeServerItem[] = [
  {
    id: 'DISPUTE-001',
    dealId: 'DEAL-001',
    status: 'UNDER_REVIEW',
    type: 'quality',
    claimAmountRub: 127500,
    description: 'Влажность зерна 15.2% вместо заявленных 13%',
    initiatorOrgId: 'org-buyer-1',
    severity: 'MEDIUM',
    createdAt: '2026-04-01T14:00:00Z',
    owner: 'operator@demo.ru',
    slaMinutes: 180,
    moneyHold: { amountRub: 127500, reason: 'Удержание по спору качества', heldAt: '2026-04-01T14:05:00Z' },
  },
  {
    id: 'DISPUTE-002',
    dealId: 'DEAL-002',
    status: 'OPEN',
    type: 'weight',
    claimAmountRub: 86250,
    description: 'Расхождение веса на 7.5 тонн по весовой квитанции',
    initiatorOrgId: 'org-buyer-2',
    severity: 'HIGH',
    createdAt: '2026-04-03T09:00:00Z',
    slaMinutes: 30,
    moneyHold: { amountRub: 86250, reason: 'Удержание по спору веса', heldAt: '2026-04-03T09:05:00Z' },
  },
];

export async function getDisputes(): Promise<DisputeServerItem[]> {
  try {
    const res = await fetch(serverApiUrl('/disputes'), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!res.ok) throw new Error(`disputes ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : STATIC_FALLBACK;
  } catch {
    return STATIC_FALLBACK;
  }
}

export async function getDispute(id: string): Promise<DisputeServerItem | null> {
  try {
    const res = await fetch(serverApiUrl(`/disputes/${id}`), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!res.ok) throw new Error(`dispute ${id} ${res.status}`);
    return res.json();
  } catch {
    return STATIC_FALLBACK.find((d) => d.id === id) ?? null;
  }
}

export function disputeTotalHeldRub(disputes: DisputeServerItem[]): number {
  return disputes.reduce((sum, d) => sum + (d.moneyHold?.amountRub ?? 0), 0);
}

export function openDisputeCount(disputes: DisputeServerItem[]): number {
  return disputes.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length;
}
