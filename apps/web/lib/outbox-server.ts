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
  failed: OutboxServerEntry[];
  totalPending: number;
  totalFailed: number;
  hasManualReview: boolean;
  hasFailures: boolean;
  isApiAvailable: boolean;
};

export type SettlementPaymentSummary = Readonly<Record<string, unknown> & {
  status: string;
  reconciliationStatus: string;
}>;

export type SettlementPaymentsSnapshot = Readonly<{
  payments: SettlementPaymentSummary[];
  totalManualReview: number;
  isApiAvailable: boolean;
}>;

const STATIC_FALLBACK: OutboxStatusSummary = {
  pending: [],
  manualReview: [],
  failed: [],
  totalPending: 0,
  totalFailed: 0,
  hasManualReview: false,
  hasFailures: false,
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
    const raw: unknown = await res.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('outbox schema');
    const data = raw as Record<string, unknown>;
    if (!Array.isArray(data.pending) || !Array.isArray(data.failed) || !Array.isArray(data.confirmed)) {
      throw new Error('outbox schema');
    }
    const manualReview = data.manualReview === undefined
      ? []
      : Array.isArray(data.manualReview)
        ? data.manualReview
        : null;
    if (manualReview === null) throw new Error('outbox schema');
    return {
      pending: data.pending as OutboxServerEntry[],
      manualReview: manualReview as OutboxServerEntry[],
      failed: data.failed as OutboxServerEntry[],
      totalPending: data.pending.length,
      totalFailed: data.failed.length,
      hasManualReview: manualReview.length > 0,
      hasFailures: data.failed.length > 0,
      isApiAvailable: true,
    };
  } catch {
    return STATIC_FALLBACK;
  }
}

export async function getPaymentsSnapshot(): Promise<SettlementPaymentsSnapshot> {
  try {
    const res = await fetch(serverApiUrl('/settlement-engine/payments'), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!res.ok) throw new Error(`payments ${res.status}`);
    const raw: unknown = await res.json();
    if (!Array.isArray(raw)) throw new Error('payments schema');
    const payments = raw.map((value): SettlementPaymentSummary => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('payments schema');
      const item = value as Record<string, unknown>;
      if (typeof item.status !== 'string' || typeof item.reconciliationStatus !== 'string') {
        throw new Error('payments schema');
      }
      return Object.freeze({ ...item, status: item.status, reconciliationStatus: item.reconciliationStatus });
    });
    const totalManualReview = payments.filter((payment) =>
      payment.status === 'MANUAL_REVIEW' || payment.reconciliationStatus === 'MANUAL_REVIEW').length;
    return { payments, totalManualReview, isApiAvailable: true };
  } catch {
    return { payments: [], totalManualReview: 0, isApiAvailable: false };
  }
}

export async function getPayments(): Promise<any[]> {
  return (await getPaymentsSnapshot()).payments;
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
