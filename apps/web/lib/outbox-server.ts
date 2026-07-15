import { serverApiUrl, serverAuthHeaders } from './server-api';

export type OutboxServerEntry = {
  id: string;
  type: string;
  dealId?: string;
  status: 'PENDING' | 'SENT' | 'CONFIRMED' | 'FAILED' | 'MANUAL_REVIEW';
  createdAt: string;
  sentAt?: string;
  confirmedAt?: string;
  retryCount: number;
  lastError?: string;
};

export type OutboxStatusSummary = {
  pending: OutboxServerEntry[];
  manualReview: OutboxServerEntry[];
  totalPending: number;
  hasManualReview: boolean;
  isApiAvailable: boolean;
};

const STATIC_FALLBACK: OutboxStatusSummary = {
  pending: [],
  manualReview: [],
  totalPending: 0,
  hasManualReview: false,
  isApiAvailable: false,
};

export async function getOutboxStatus(dealId?: string): Promise<OutboxStatusSummary> {
  try {
    const qs = dealId ? `?dealId=${encodeURIComponent(dealId)}` : '';
    const res = await fetch(serverApiUrl(`/settlement-engine/outbox${qs}`), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!res.ok) throw new Error(`outbox ${res.status}`);
    const data = await res.json();
    return {
      pending: Array.isArray(data.pending) ? data.pending : [],
      manualReview: Array.isArray(data.manualReview) ? data.manualReview : [],
      totalPending: Array.isArray(data.pending) ? data.pending.length : 0,
      hasManualReview: Array.isArray(data.manualReview) && data.manualReview.length > 0,
      isApiAvailable: true,
    };
  } catch {
    return STATIC_FALLBACK;
  }
}

export async function getPayments(): Promise<any[]> {
  try {
    const res = await fetch(serverApiUrl('/settlement-engine/payments'), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!res.ok) throw new Error(`payments ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getDealBankWorkspace(dealId: string): Promise<any | null> {
  try {
    const res = await fetch(serverApiUrl(`/settlement-engine/deal/${dealId}/bank-workspace`), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!res.ok) throw new Error(`bank-workspace ${dealId} ${res.status}`);
    return res.json();
  } catch {
    return null;
  }
}
