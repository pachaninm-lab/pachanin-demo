/**
 * Provider-neutral commercial-rule vocabulary and deterministic evaluator.
 *
 * Monetary values cross this boundary as decimal bigint strings. Quantities
 * use explicit integer sub-units, so evaluation never relies on floating-point
 * arithmetic and produces the same result on every runtime.
 */

export const COMMERCIAL_PRICING_MODELS = [
  'FREE',
  'SUBSCRIPTION',
  'ACCESS_FEE',
  'FIXED',
  'PER_TON',
  'PER_KM',
  'PER_TRIP',
  'PER_HOUR',
  'PERCENT',
  'SUCCESS_FEE',
  'CAPPED_PERCENT',
  'HYBRID',
  'MANUAL_QUOTE',
] as const;

export type CommercialPricingModel = (typeof COMMERCIAL_PRICING_MODELS)[number];

export const COMMERCIAL_PAYER_MODES = [
  'SELLER',
  'BUYER',
  'INITIATOR',
  'DELIVERY_RESPONSIBLE',
  'SPLIT',
  'CONTRACT_RULE',
  'REQUIRES_CONFIRMATION',
] as const;

export type CommercialPayerMode = (typeof COMMERCIAL_PAYER_MODES)[number];
export type CommercialPayer = Exclude<CommercialPayerMode, 'SPLIT' | 'CONTRACT_RULE' | 'REQUIRES_CONFIRMATION'>;

const DIRECT_COMMERCIAL_PAYERS: readonly CommercialPayer[] = [
  'SELLER',
  'BUYER',
  'INITIATOR',
  'DELIVERY_RESPONSIBLE',
];

export const COMMERCIAL_POLICY_KINDS = [
  'PRICING',
  'PAYER',
  'TRUST',
  'AVAILABILITY',
  'ELIGIBILITY',
] as const;

export type CommercialPolicyKind = (typeof COMMERCIAL_POLICY_KINDS)[number];
export type CommercialDecisionStatus =
  | 'CALCULATED'
  | 'MANUAL_QUOTE_REQUIRED'
  | 'PAYER_CONFIRMATION_REQUIRED'
  | 'MISSING_FACTS';

export type CommercialPricingConfiguration = Readonly<{
  amountKopecks?: string;
  rateKopecks?: string;
  basisPoints?: number;
  capKopecks?: string;
  fixedKopecks?: string;
}>;

export type CommercialPayerShare = Readonly<{
  payer: CommercialPayer;
  basisPoints: number;
}>;

export type CommercialRuleDefinition = Readonly<{
  pricingModel: CommercialPricingModel;
  pricing: CommercialPricingConfiguration;
  payerMode: CommercialPayerMode;
  payerShares?: readonly CommercialPayerShare[];
}>;

export type CommercialEvaluationFacts = Readonly<{
  baseAmountKopecks?: string;
  quantityMilliTons?: string;
  distanceMeters?: string;
  tripCount?: string;
  durationMinutes?: string;
  subscriptionPeriods?: string;
  accessUnits?: string;
  success?: boolean;
  contractPayer?: CommercialPayer;
}>;

export type CommercialPayerAllocation = Readonly<{
  payer: CommercialPayer;
  amountKopecks: string;
}>;

export type CommercialEvaluation = Readonly<{
  status: CommercialDecisionStatus;
  amountKopecks: string | null;
  payerAllocations: readonly CommercialPayerAllocation[];
  missingFacts: readonly string[];
}>;

const MAX_SIGNED_BIGINT = 9_223_372_036_854_775_807n;
const INTEGER = /^(0|[1-9]\d*)$/u;

export class CommercialRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommercialRuleError';
  }
}

function integer(value: unknown, field: string, missing: string[]): bigint | null {
  if (value === undefined) {
    missing.push(field);
    return null;
  }
  if (typeof value !== 'string') throw new CommercialRuleError(`${field} must be a non-negative integer string`);
  const normalized = value.trim();
  if (normalized.length > 19 || !INTEGER.test(normalized)) {
    throw new CommercialRuleError(`${field} must be a non-negative integer string`);
  }
  const parsed = BigInt(normalized);
  if (parsed > MAX_SIGNED_BIGINT) throw new CommercialRuleError(`${field} exceeds BIGINT authority`);
  return parsed;
}

function requiredBasisPoints(value: number | undefined, field = 'basisPoints'): bigint {
  if (!Number.isSafeInteger(value) || value === undefined || value < 0 || value > 10_000) {
    throw new CommercialRuleError(`${field} must be an integer from 0 to 10000`);
  }
  return BigInt(value);
}

function checked(value: bigint, field = 'calculated amount'): bigint {
  if (value < 0n || value > MAX_SIGNED_BIGINT) {
    throw new CommercialRuleError(`${field} exceeds non-negative BIGINT authority`);
  }
  return value;
}

/** Deterministic half-away-from-zero division for non-negative commercial values. */
function roundedRatio(value: bigint, multiplier: bigint, denominator: bigint): bigint {
  const product = value * multiplier;
  const quotient = product / denominator;
  const remainder = product % denominator;
  return checked(quotient + (remainder * 2n >= denominator ? 1n : 0n));
}

function evaluateAmount(
  definition: CommercialRuleDefinition,
  facts: CommercialEvaluationFacts,
  missing: string[],
): bigint | null {
  const config = definition.pricing;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new CommercialRuleError('pricing must be an object');
  }
  switch (definition.pricingModel) {
    case 'FREE':
      return 0n;
    case 'SUBSCRIPTION': {
      const amount = integer(config.amountKopecks, 'pricing.amountKopecks', missing);
      const periods = integer(facts.subscriptionPeriods, 'subscriptionPeriods', missing);
      return amount === null || periods === null ? null : checked(amount * periods);
    }
    case 'ACCESS_FEE': {
      const amount = integer(config.amountKopecks, 'pricing.amountKopecks', missing);
      const units = integer(facts.accessUnits, 'accessUnits', missing);
      return amount === null || units === null ? null : checked(amount * units);
    }
    case 'FIXED':
      return integer(config.amountKopecks, 'pricing.amountKopecks', missing);
    case 'PER_TON': {
      const rate = integer(config.rateKopecks, 'pricing.rateKopecks', missing);
      const quantity = integer(facts.quantityMilliTons, 'quantityMilliTons', missing);
      return rate === null || quantity === null ? null : roundedRatio(rate, quantity, 1_000n);
    }
    case 'PER_KM': {
      const rate = integer(config.rateKopecks, 'pricing.rateKopecks', missing);
      const distance = integer(facts.distanceMeters, 'distanceMeters', missing);
      return rate === null || distance === null ? null : roundedRatio(rate, distance, 1_000n);
    }
    case 'PER_TRIP': {
      const rate = integer(config.rateKopecks, 'pricing.rateKopecks', missing);
      const trips = integer(facts.tripCount, 'tripCount', missing);
      return rate === null || trips === null ? null : checked(rate * trips);
    }
    case 'PER_HOUR': {
      const rate = integer(config.rateKopecks, 'pricing.rateKopecks', missing);
      const minutes = integer(facts.durationMinutes, 'durationMinutes', missing);
      return rate === null || minutes === null ? null : roundedRatio(rate, minutes, 60n);
    }
    case 'PERCENT': {
      const base = integer(facts.baseAmountKopecks, 'baseAmountKopecks', missing);
      return base === null ? null : roundedRatio(base, requiredBasisPoints(config.basisPoints), 10_000n);
    }
    case 'SUCCESS_FEE': {
      if (facts.success === undefined) {
        missing.push('success');
        return null;
      }
      const amount = integer(config.amountKopecks, 'pricing.amountKopecks', missing);
      return amount === null ? null : facts.success ? amount : 0n;
    }
    case 'CAPPED_PERCENT': {
      const base = integer(facts.baseAmountKopecks, 'baseAmountKopecks', missing);
      const cap = integer(config.capKopecks, 'pricing.capKopecks', missing);
      if (base === null || cap === null) return null;
      const percentage = roundedRatio(base, requiredBasisPoints(config.basisPoints), 10_000n);
      return percentage < cap ? percentage : cap;
    }
    case 'HYBRID': {
      const base = integer(facts.baseAmountKopecks, 'baseAmountKopecks', missing);
      const fixed = integer(config.fixedKopecks, 'pricing.fixedKopecks', missing);
      if (base === null || fixed === null) return null;
      const variable = roundedRatio(base, requiredBasisPoints(config.basisPoints), 10_000n);
      const cap = config.capKopecks === undefined ? null : integer(config.capKopecks, 'pricing.capKopecks', missing);
      if (config.capKopecks !== undefined && cap === null) return null;
      return checked(fixed + (cap !== null && variable > cap ? cap : variable));
    }
    case 'MANUAL_QUOTE':
      return null;
    default:
      throw new CommercialRuleError('pricingModel is invalid');
  }
}

function allocations(
  amount: bigint,
  definition: CommercialRuleDefinition,
  facts: CommercialEvaluationFacts,
  missing: string[],
): readonly CommercialPayerAllocation[] | null {
  if (definition.payerMode === 'REQUIRES_CONFIRMATION') return null;
  if (definition.payerMode === 'CONTRACT_RULE') {
    if (facts.contractPayer === undefined) {
      missing.push('contractPayer');
      return null;
    }
    if (!DIRECT_COMMERCIAL_PAYERS.includes(facts.contractPayer)) {
      throw new CommercialRuleError('contractPayer is invalid');
    }
    return [{ payer: facts.contractPayer, amountKopecks: amount.toString() }];
  }
  if (definition.payerMode !== 'SPLIT') {
    if (!DIRECT_COMMERCIAL_PAYERS.includes(definition.payerMode)) {
      throw new CommercialRuleError('payerMode is invalid');
    }
    return [{ payer: definition.payerMode, amountKopecks: amount.toString() }];
  }

  if (!Array.isArray(definition.payerShares)) {
    throw new CommercialRuleError('SPLIT requires payerShares');
  }
  const shares = definition.payerShares;
  if (shares.length < 2) throw new CommercialRuleError('SPLIT requires at least two payerShares');
  const payers = new Set<CommercialPayer>();
  for (const [index, share] of shares.entries()) {
    if (!DIRECT_COMMERCIAL_PAYERS.includes(share.payer)) {
      throw new CommercialRuleError(`payerShares[${index}].payer is invalid`);
    }
    if (payers.has(share.payer)) {
      throw new CommercialRuleError(`payerShares[${index}].payer is duplicated`);
    }
    payers.add(share.payer);
  }
  const total = shares.reduce((sum, share, index) => sum + requiredBasisPoints(share.basisPoints, `payerShares[${index}].basisPoints`), 0n);
  if (total !== 10_000n) throw new CommercialRuleError('payerShares basisPoints must total 10000');

  let allocated = 0n;
  return shares.map((share, index) => {
    const value = index === shares.length - 1
      ? amount - allocated
      : (amount * BigInt(share.basisPoints)) / 10_000n;
    allocated += value;
    return { payer: share.payer, amountKopecks: value.toString() };
  });
}

export function evaluateCommercialRule(
  definition: CommercialRuleDefinition,
  facts: CommercialEvaluationFacts,
): CommercialEvaluation {
  if (definition.pricingModel === 'MANUAL_QUOTE') {
    return { status: 'MANUAL_QUOTE_REQUIRED', amountKopecks: null, payerAllocations: [], missingFacts: [] };
  }
  if (definition.payerMode === 'REQUIRES_CONFIRMATION') {
    return { status: 'PAYER_CONFIRMATION_REQUIRED', amountKopecks: null, payerAllocations: [], missingFacts: [] };
  }

  const missing: string[] = [];
  const amount = evaluateAmount(definition, facts, missing);
  if (amount === null || missing.length > 0) {
    return { status: 'MISSING_FACTS', amountKopecks: null, payerAllocations: [], missingFacts: [...new Set(missing)].sort() };
  }
  const payerAllocations = allocations(amount, definition, facts, missing);
  if (payerAllocations === null || missing.length > 0) {
    return { status: 'MISSING_FACTS', amountKopecks: null, payerAllocations: [], missingFacts: [...new Set(missing)].sort() };
  }
  return { status: 'CALCULATED', amountKopecks: amount.toString(), payerAllocations, missingFacts: [] };
}

export function isCommercialPricingModel(value: string): value is CommercialPricingModel {
  return (COMMERCIAL_PRICING_MODELS as readonly string[]).includes(value);
}

export function isCommercialPayerMode(value: string): value is CommercialPayerMode {
  return (COMMERCIAL_PAYER_MODES as readonly string[]).includes(value);
}
