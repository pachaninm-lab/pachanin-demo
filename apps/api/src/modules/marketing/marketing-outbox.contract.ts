import type {
  AdvertisingMetadata,
  MarketingContentClassification,
  MarketingDestinationRisk,
  MarketingPolicyInput,
  MarketingPublishRequest,
  MarketingRiskClass,
} from './marketing.types';

export const MARKETING_SOCIAL_PUBLISH_EVENT_TYPE = 'MARKETING_SOCIAL_PUBLISH_V1';

export interface MarketingSocialPublishPayload {
  schemaVersion: 'marketing.social-publish.v1';
  channel: string;
  text: string;
  policy: Omit<MarketingPolicyInput, 'channel' | 'text'>;
}

const CLASSIFICATIONS = new Set<MarketingContentClassification>([
  'INFORMATIONAL',
  'ADVERTISING',
  'UNCERTAIN',
]);
const RISK_CLASSES = new Set<MarketingRiskClass>([
  'NONE',
  'LEGAL_INTERPRETATION',
  'POLITICS',
  'CRISIS',
  'FINANCIAL_PROMISE',
  'HEALTH_OR_SAFETY',
]);
const DESTINATION_RISKS = new Set<MarketingDestinationRisk>([
  'CLEARED',
  'UNKNOWN',
  'RESTRICTED',
]);

function row(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function advertising(value: unknown): AdvertisingMetadata | undefined {
  if (value === undefined) return undefined;
  const object = row(value);
  if (!object) throw new Error('Marketing publish payload advertising metadata is invalid');
  return {
    erid: optionalString(object.erid),
    advertiserName: optionalString(object.advertiserName),
    hasAdvertisingLabel: optionalBoolean(object.hasAdvertisingLabel),
    isPaidPlacement: optionalBoolean(object.isPaidPlacement),
  };
}

/**
 * Revalidates durable JSON when it leaves PostgreSQL. Do not trust a TypeScript
 * type across an outbox serialization boundary.
 */
export function assertMarketingSocialPublishPayload(
  value: unknown,
  idempotencyKey: string | null,
): MarketingPublishRequest {
  const object = row(value);
  const policy = row(object?.policy);
  if (!object || object.schemaVersion !== 'marketing.social-publish.v1' || !policy) {
    throw new Error('Marketing publish payload schema is invalid');
  }

  const channel = optionalString(object.channel)?.trim() ?? '';
  const text = optionalString(object.text)?.trim() ?? '';
  const classification = policy.classification as MarketingContentClassification;
  const riskClass = policy.riskClass as MarketingRiskClass;
  const destinationRisk = policy.destinationRisk as MarketingDestinationRisk;
  const evidenceIds = Array.isArray(policy.evidenceIds)
    ? policy.evidenceIds.filter((item): item is string => typeof item === 'string')
    : null;

  if (
    !channel
    || !text
    || !idempotencyKey?.trim()
    || !CLASSIFICATIONS.has(classification)
    || !RISK_CLASSES.has(riskClass)
    || !DESTINATION_RISKS.has(destinationRisk)
    || typeof policy.requiresEvidence !== 'boolean'
    || evidenceIds === null
    || evidenceIds.length !== (policy.evidenceIds as unknown[]).length
    || typeof policy.containsPersonalData !== 'boolean'
    || typeof policy.isDirectMessage !== 'boolean'
  ) {
    throw new Error('Marketing publish payload fields are invalid');
  }

  const maxEvidenceAgeHours = policy.maxEvidenceAgeHours;
  if (
    maxEvidenceAgeHours !== undefined
    && (typeof maxEvidenceAgeHours !== 'number' || !Number.isFinite(maxEvidenceAgeHours))
  ) {
    throw new Error('Marketing publish payload evidence age is invalid');
  }

  return {
    channel,
    text,
    idempotencyKey: idempotencyKey.trim(),
    policy: {
      classification,
      requiresEvidence: policy.requiresEvidence,
      evidenceIds,
      requiresFreshness: optionalBoolean(policy.requiresFreshness),
      freshnessCheckedAt: optionalString(policy.freshnessCheckedAt),
      maxEvidenceAgeHours: maxEvidenceAgeHours as number | undefined,
      riskClass,
      containsPersonalData: policy.containsPersonalData,
      destinationRisk,
      isDirectMessage: policy.isDirectMessage,
      recipientInitiated: optionalBoolean(policy.recipientInitiated),
      marketingConsentId: optionalString(policy.marketingConsentId),
      advertising: advertising(policy.advertising),
    },
  };
}
