import type { MarketingPublicationAdmission } from './marketing-publication-admission';

export const MARKETING_SOCIAL_PUBLISH_EVENT_TYPE = 'MARKETING_SOCIAL_PUBLISH_V2';

export interface MarketingSocialPublishPayload {
  schemaVersion: 'marketing.social-publish.v2';
  admission: MarketingPublicationAdmission;
}

function row(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * Validates only the durable envelope. The nested admission remains untrusted
 * until MarketingPublicationAdmissionService verifies its HMAC, expiry,
 * content/command/authority digests and exact outbox idempotency binding.
 */
export function assertMarketingSocialPublishPayload(
  value: unknown,
): MarketingPublicationAdmission {
  const object = row(value);
  const admission = row(object?.admission);
  if (
    !object
    || object.schemaVersion !== 'marketing.social-publish.v2'
    || !admission
  ) {
    throw new Error('Marketing publish payload schema is invalid');
  }
  return admission as unknown as MarketingPublicationAdmission;
}
