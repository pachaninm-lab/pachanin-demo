export const ALLOWED_RU_MARKETING_CHANNELS = [
  'TELEGRAM',
  'VK',
  'DZEN',
  'RUTUBE',
  'OK',
] as const;

export type MarketingChannel = (typeof ALLOWED_RU_MARKETING_CHANNELS)[number];

export type MarketingContentClassification =
  | 'INFORMATIONAL'
  | 'ADVERTISING'
  | 'UNCERTAIN';

export type MarketingRiskClass =
  | 'NONE'
  | 'LEGAL_INTERPRETATION'
  | 'POLITICS'
  | 'CRISIS'
  | 'FINANCIAL_PROMISE'
  | 'HEALTH_OR_SAFETY';

export type MarketingDestinationRisk = 'CLEARED' | 'UNKNOWN' | 'RESTRICTED';

export interface AdvertisingMetadata {
  /** ERID/advertising identifier issued through the required advertising-data flow. */
  erid?: string;
  /** Legal advertiser identity shown/linked as required by Russian advertising law. */
  advertiserName?: string;
  /** Russian taxpayer identifier used by the fail-closed legal-admission rule. */
  advertiserInn?: string;
  /** True only when the rendered creative contains the Russian advertising marker. */
  hasAdvertisingLabel?: boolean;
  /** Paid placement is disabled by default and requires a separate budget switch. */
  isPaidPlacement?: boolean;
}

export interface MarketingPolicyInput {
  /** Deliberately string: unknown/new platforms must fail closed instead of type-casting around the allowlist. */
  channel: string;
  classification: MarketingContentClassification;
  text: string;
  requiresEvidence: boolean;
  evidenceIds: readonly string[];
  requiresFreshness?: boolean;
  freshnessCheckedAt?: string;
  maxEvidenceAgeHours?: number;
  riskClass: MarketingRiskClass;
  containsPersonalData: boolean;
  destinationRisk: MarketingDestinationRisk;
  isDirectMessage: boolean;
  recipientInitiated?: boolean;
  marketingConsentId?: string;
  advertising?: AdvertisingMetadata;
}

export type MarketingPolicyCode =
  | 'ALLOW'
  | 'OUTBOUND_DISABLED'
  | 'CHANNEL_NOT_ALLOWLISTED'
  | 'EMPTY_CONTENT'
  | 'UNSOURCED_FACTUAL_CONTENT'
  | 'STALE_OR_UNVERIFIED_EVIDENCE'
  | 'HIGH_RISK_CONTENT'
  | 'PERSONAL_DATA_EXPOSURE'
  | 'DESTINATION_NOT_CLEARED'
  | 'LEGAL_CLASSIFICATION_UNCERTAIN'
  | 'ADVERTISING_MARKER_MISSING'
  | 'ADVERTISER_IDENTITY_MISSING'
  | 'ADVERTISER_INN_INVALID'
  | 'ERID_MISSING'
  | 'PAID_MODE_DISABLED'
  | 'UNSOLICITED_DIRECT_MESSAGE';

export interface MarketingPolicyDecision {
  allowed: boolean;
  code: MarketingPolicyCode;
  reasons: readonly MarketingPolicyCode[];
}

export interface MarketingPublishRequest {
  channel: string;
  text: string;
  /** Stable command identity. Required even before every connector has native deduplication support. */
  idempotencyKey: string;
  policy: Omit<MarketingPolicyInput, 'channel' | 'text'>;
}

export interface MarketingPublishReceipt {
  channel: MarketingChannel;
  externalId: string;
  publishedAt: string;
}
