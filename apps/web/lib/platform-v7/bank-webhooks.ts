export type PlatformV7BankWebhookStatus = 'received' | 'validated' | 'applied' | 'rejected' | 'retryable';
export type PlatformV7BankWebhookEventType = 'reserve_confirmed' | 'hold_created' | 'release_confirmed' | 'refund_confirmed' | 'fee_charged';

export interface PlatformV7BankWebhookEvent {
  id: string;
  dealId: string;
  type: PlatformV7BankWebhookEventType;
  status: PlatformV7BankWebhookStatus;
  externalRef: string;
  amount: number;
  receivedAt: string;
  appliedAt?: string;
  retryCount: number;
  error?: string;
}

export interface PlatformV7BankWebhookSummary {
  total: number;
  applied: number;
  retryable: number;
  rejected: number;
  pending: number;
  blocksReconciliation: boolean;
}

export function platformV7BankWebhookSummary(events: PlatformV7BankWebhookEvent[]): PlatformV7BankWebhookSummary {
  const applied = events.filter((event) => event.status === 'applied').length;
  const retryable = events.filter((event) => event.status === 'retryable').length;
  const rejected = events.filter((event) => event.status === 'rejected').length;
  const pending = events.filter((event) => event.status === 'received' || event.status === 'validated').length;

  return {
    total: events.length,
    applied,
    retryable,
    rejected,
    pending,
    blocksReconciliation: retryable > 0 || rejected > 0 || pending > 0,
  };
}

export function platformV7BankWebhookCanRetry(event: PlatformV7BankWebhookEvent): boolean {
  return event.status === 'retryable' && event.retryCount < 3;
}

export function platformV7BankWebhookSort(events: PlatformV7BankWebhookEvent[]): PlatformV7BankWebhookEvent[] {
  return [...events].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export function platformV7BankWebhookEventKey(event: PlatformV7BankWebhookEvent): string {
  return `${event.dealId}:${event.externalRef}:${event.status}`;
}
