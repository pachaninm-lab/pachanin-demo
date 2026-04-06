export function logClientEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  console.log('[pc:web]', event, data || {});
}

export function getCorrelationId(_request?: unknown): string {
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function logAuditEvent(eventOrData: string | Record<string, unknown>, data?: Record<string, unknown>) {
  if (typeof eventOrData === 'string') {
    console.log('[pc:audit]', eventOrData, data || {});
  } else {
    console.log('[pc:audit]', eventOrData);
  }
}

export function logOpsEvent(eventOrData: string | Record<string, unknown>, data?: Record<string, unknown>) {
  if (typeof eventOrData === 'string') {
    console.log('[pc:ops]', eventOrData, data || {});
  } else {
    console.log('[pc:ops]', eventOrData);
  }
}
