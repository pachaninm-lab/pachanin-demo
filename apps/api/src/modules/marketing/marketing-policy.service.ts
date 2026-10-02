import { Injectable } from '@nestjs/common';
import {
  ALLOWED_RU_MARKETING_CHANNELS,
  type MarketingPolicyCode,
  type MarketingPolicyDecision,
  type MarketingPolicyInput,
} from './marketing.types';

const ALLOWED_CHANNEL_SET = new Set<string>(ALLOWED_RU_MARKETING_CHANNELS);
const DEFAULT_MAX_EVIDENCE_AGE_HOURS = 72;

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function hasValidErid(value: string | undefined): boolean {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/u.test(value.trim());
}

function hasValidInn(value: string | undefined): boolean {
  if (!value || !/^\d{10}(?:\d{2})?$/u.test(value)) return false;
  const digits = [...value].map(Number);
  const checksum = (weights: readonly number[]) => (
    weights.reduce((sum, weight, index) => sum + weight * digits[index], 0) % 11
  ) % 10;
  if (digits.length === 10) {
    return checksum([2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[9];
  }
  return checksum([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[10]
    && checksum([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[11];
}

function evidenceIsFresh(input: MarketingPolicyInput, nowMs: number): boolean {
  if (!input.requiresFreshness) return true;
  if (!input.freshnessCheckedAt) return false;

  const checkedAtMs = Date.parse(input.freshnessCheckedAt);
  if (!Number.isFinite(checkedAtMs) || checkedAtMs > nowMs) return false;

  const maxAgeHours = input.maxEvidenceAgeHours ?? DEFAULT_MAX_EVIDENCE_AGE_HOURS;
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) return false;

  return nowMs - checkedAtMs <= maxAgeHours * 60 * 60 * 1_000;
}

/**
 * Deterministic, fail-closed outbound gate for the autonomous marketing contour.
 *
 * It intentionally does not try to interpret Russian law with an LLM at
 * publish time. Upstream classifies the material; uncertainty is quarantined.
 * Only the fixed allowlist can ever pass this gate. An environment variable
 * cannot expand it to a new platform.
 */
export function evaluateMarketingPolicy(
  input: MarketingPolicyInput,
  environment: NodeJS.ProcessEnv = process.env,
  nowMs: number = Date.now(),
): MarketingPolicyDecision {
  const reasons: MarketingPolicyCode[] = [];

  if (!enabled(environment.MARKETING_OUTBOUND_ENABLED)) {
    reasons.push('OUTBOUND_DISABLED');
  }

  if (!ALLOWED_CHANNEL_SET.has(input.channel)) {
    reasons.push('CHANNEL_NOT_ALLOWLISTED');
  }

  if (!hasText(input.text)) {
    reasons.push('EMPTY_CONTENT');
  }

  if (input.requiresEvidence && input.evidenceIds.filter(hasText).length === 0) {
    reasons.push('UNSOURCED_FACTUAL_CONTENT');
  }

  if (!evidenceIsFresh(input, nowMs)) {
    reasons.push('STALE_OR_UNVERIFIED_EVIDENCE');
  }

  if (input.riskClass !== 'NONE') {
    reasons.push('HIGH_RISK_CONTENT');
  }

  if (input.containsPersonalData) {
    reasons.push('PERSONAL_DATA_EXPOSURE');
  }

  if (input.destinationRisk !== 'CLEARED') {
    reasons.push('DESTINATION_NOT_CLEARED');
  }

  if (input.classification === 'UNCERTAIN') {
    reasons.push('LEGAL_CLASSIFICATION_UNCERTAIN');
  }

  if (input.classification === 'ADVERTISING') {
    if (!input.advertising?.hasAdvertisingLabel) {
      reasons.push('ADVERTISING_MARKER_MISSING');
    }
    if (!hasText(input.advertising?.advertiserName)) {
      reasons.push('ADVERTISER_IDENTITY_MISSING');
    }
    if (!hasValidInn(input.advertising?.advertiserInn)) {
      reasons.push('ADVERTISER_INN_INVALID');
    }
    if (!hasValidErid(input.advertising?.erid)) {
      reasons.push('ERID_MISSING');
    }
    if (input.advertising?.isPaidPlacement && !enabled(environment.MARKETING_PAID_MODE_ENABLED)) {
      reasons.push('PAID_MODE_DISABLED');
    }
  }

  if (
    input.isDirectMessage
    && !input.recipientInitiated
    && !hasText(input.marketingConsentId)
  ) {
    reasons.push('UNSOLICITED_DIRECT_MESSAGE');
  }

  if (reasons.length === 0) {
    return Object.freeze({ allowed: true, code: 'ALLOW', reasons: Object.freeze([]) });
  }

  return Object.freeze({
    allowed: false,
    code: reasons[0],
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

export class MarketingPolicyViolation extends Error {
  constructor(readonly decision: MarketingPolicyDecision) {
    super(`Marketing outbound denied: ${decision.reasons.join(', ')}`);
    this.name = 'MarketingPolicyViolation';
  }
}

@Injectable()
export class MarketingPolicyService {
  evaluate(input: MarketingPolicyInput): MarketingPolicyDecision {
    return evaluateMarketingPolicy(input);
  }

  assertAllowed(input: MarketingPolicyInput): MarketingPolicyDecision {
    const decision = this.evaluate(input);
    if (!decision.allowed) throw new MarketingPolicyViolation(decision);
    return decision;
  }
}
