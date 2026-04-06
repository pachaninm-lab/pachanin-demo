
import { createHmac, timingSafeEqual } from 'crypto';

export function signIntegrationPayload(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyIntegrationSignature(payload: string, provided: string | undefined | null, secret: string) {
  if (!provided) return false;
  const expected = signIntegrationPayload(payload, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(provided));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
