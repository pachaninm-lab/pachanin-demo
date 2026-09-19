import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookSecurityConfig {
  secret: string;
  timestampToleranceSec: number; // default 300 (5 min)
  headerSignature: string;       // default 'x-signature'
  headerTimestamp: string;       // default 'x-timestamp'
  headerEventId: string;         // default 'x-event-id'
}

export interface WebhookVerificationResult {
  verified: boolean;
  alreadyProcessed?: boolean;
  error?: string;
}

export const DEFAULT_WEBHOOK_CONFIG: Omit<WebhookSecurityConfig, 'secret'> = {
  timestampToleranceSec: 300,
  headerSignature: 'x-signature',
  headerTimestamp: 'x-timestamp',
  headerEventId: 'x-event-id',
};

export function computeWebhookSignature(secret: string, timestamp: string, payload: string | Buffer): string {
  const body = typeof payload === 'string' ? payload : payload.toString('utf8');
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function verifyWebhookSignature(
  payload: Buffer,
  headers: Record<string, string | string[] | undefined>,
  config: WebhookSecurityConfig,
): WebhookVerificationResult {
  const signature = String(headers[config.headerSignature] ?? '');
  const timestamp = String(headers[config.headerTimestamp] ?? '');

  if (!signature || !timestamp) {
    return { verified: false, error: 'Missing signature or timestamp header' };
  }

  const timestampSec = Number(timestamp);
  if (isNaN(timestampSec)) {
    return { verified: false, error: 'Invalid timestamp format' };
  }

  const ageSec = Math.abs(Date.now() / 1000 - timestampSec);
  if (ageSec > config.timestampToleranceSec) {
    return { verified: false, error: `Timestamp too old: ${ageSec}s (max ${config.timestampToleranceSec}s)` };
  }

  const expected = computeWebhookSignature(config.secret, timestamp, payload);

  try {
    const match = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!match) return { verified: false, error: 'Signature mismatch' };
  } catch {
    return { verified: false, error: 'Signature comparison failed (length mismatch)' };
  }

  return { verified: true };
}

// In-memory idempotency store (replace with Redis in production)
const processedIds = new Map<string, number>(); // eventId → expiresAt (ms)
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export function checkWebhookIdempotency(
  headers: Record<string, string | string[] | undefined>,
  config: WebhookSecurityConfig,
): { alreadyProcessed: boolean; eventId?: string } {
  const eventId = String(headers[config.headerEventId] ?? '');
  if (!eventId) return { alreadyProcessed: false };

  const now = Date.now();
  // Clean expired
  for (const [id, exp] of processedIds) {
    if (exp < now) processedIds.delete(id);
  }

  if (processedIds.has(eventId)) return { alreadyProcessed: true, eventId };

  processedIds.set(eventId, now + IDEMPOTENCY_TTL_MS);
  return { alreadyProcessed: false, eventId };
}

export function verifyWebhook(
  payload: Buffer,
  headers: Record<string, string | string[] | undefined>,
  config: WebhookSecurityConfig,
): WebhookVerificationResult {
  const sigResult = verifyWebhookSignature(payload, headers, config);
  if (!sigResult.verified) return sigResult;

  const idempotency = checkWebhookIdempotency(headers, config);
  if (idempotency.alreadyProcessed) return { verified: true, alreadyProcessed: true };

  return { verified: true };
}
