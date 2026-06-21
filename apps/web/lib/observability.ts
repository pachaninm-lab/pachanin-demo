/**
 * Lightweight client/audit/ops logging shim.
 *
 * Logging is gated so it never spams a production browser console: events are
 * emitted only in development, during tests, or when explicitly enabled via
 * NEXT_PUBLIC_PC_DEBUG=1. This is a controlled-pilot logging shim, not a
 * structured logging system (see docs/platform-v7/audit/SR3_OBSERVABILITY_BASELINE.md).
 */

function debugLoggingEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_PC_DEBUG === '1') return true;
  return process.env.NODE_ENV !== 'production';
}

export function logClientEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  if (!debugLoggingEnabled()) return;
  console.log('[pc:web]', event, data || {});
}

export function getCorrelationId(_request?: unknown): string {
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function logAuditEvent(eventOrData: string | Record<string, unknown>, data?: Record<string, unknown>) {
  if (!debugLoggingEnabled()) return;
  if (typeof eventOrData === 'string') {
    console.log('[pc:audit]', eventOrData, data || {});
  } else {
    console.log('[pc:audit]', eventOrData);
  }
}

export function logOpsEvent(eventOrData: string | Record<string, unknown>, data?: Record<string, unknown>) {
  if (!debugLoggingEnabled()) return;
  if (typeof eventOrData === 'string') {
    console.log('[pc:ops]', eventOrData, data || {});
  } else {
    console.log('[pc:ops]', eventOrData);
  }
}
