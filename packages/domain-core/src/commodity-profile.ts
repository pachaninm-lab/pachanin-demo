import { createHash } from 'node:crypto';

export const COMMODITY_ARCHETYPES = [
  'DRY_BULK',
  'SEED_PLANTING',
  'ROOT_INDUSTRIAL',
  'FRESH_PACKED',
  'GREENHOUSE_RECURRING',
  'ORGANIC_EXPORT_QUARANTINE',
] as const;

export type CommodityArchetype = (typeof COMMODITY_ARCHETYPES)[number];

export const COMMODITY_PROFILE_STATES = [
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'EFFECTIVE',
  'DEPRECATED',
  'REVOKED',
] as const;

export type CommodityProfileState = (typeof COMMODITY_PROFILE_STATES)[number];

export type CommodityDataClassification =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'PERSONAL'
  | 'COMMERCIAL_SECRET';

export type CommodityUnitDimension =
  | 'MASS'
  | 'VOLUME'
  | 'COUNT'
  | 'TEMPERATURE'
  | 'HUMIDITY'
  | 'LENGTH'
  | 'AREA'
  | 'PERCENT'
  | 'CONCENTRATION'
  | 'OTHER';

export type MissingValueRule = 'BLOCK' | 'ALLOW_WITH_REASON' | 'NOT_APPLICABLE';
export type RequirementSeverity = 'INFO' | 'WARNING' | 'BLOCKING';

export type LocalizedDisplay = {
  ru: string;
  en?: string;
  zh?: string;
};

export type CommodityProductCode = {
  system: 'OKPD2' | 'TN_VED_EAEU' | 'INTERNAL' | 'OTHER';
  code: string;
  purpose?: string;
  sourceRef: string;
};

export type CommodityUnitRule = {
  code: string;
  dimension: CommodityUnitDimension;
  symbol: string;
  isBase: boolean;
  precision: number;
  /** Exact decimal string. JavaScript numbers are never authority. */
  numeratorToBase: string;
  /** Exact decimal string. JavaScript numbers are never authority. */
  denominatorToBase: string;
  sourceRef: string;
};

export type CommodityQualityIndicator = {
  code: string;
  display: LocalizedDisplay;
  unitCode: string;
  precision: number;
  required: boolean;
  methodIds: string[];
  missingValueRule: MissingValueRule;
  lowerBound?: string;
  upperBound?: string;
  qualifierAllowed?: boolean;
  sourceRef: string;
};

export type CommoditySamplingRule = {
  code: string;
  sampleKind: 'PRIMARY' | 'CONTROL' | 'ARBITRATION';
  required: boolean;
  retentionDays?: number;
  sealRequired: boolean;
  custodyRequired: boolean;
  sourceRef: string;
};

export type CommodityDocumentRequirement = {
  code: string;
  display: LocalizedDisplay;
  severity: RequirementSeverity;
  registry?: string;
  signatureKind?: 'NONE' | 'SIMPLE' | 'ENHANCED' | 'QUALIFIED';
  validForDays?: number;
  releaseBlocking: boolean;
  sourceRef: string;
};

export type CommodityStorageRule = {
  temperatureMin?: string;
  temperatureMax?: string;
  humidityMin?: string;
  humidityMax?: string;
  shelfLifeHours?: number;
  packagingKinds: string[];
  palletRequired: boolean;
  blendingMode: 'ALLOWED' | 'PROHIBITED' | 'CONTROLLED';
  sourceRef: string;
};

export type CommodityAcceptanceRule = {
  partialAcceptanceAllowed: boolean;
  rapidDisputeHours?: number;
  priceDeltaPolicyRef?: string;
  releaseBlockers: string[];
  sourceRef: string;
};

export type CommodityProfileContent = {
  canonicalCode: string;
  display: LocalizedDisplay;
  archetype: CommodityArchetype;
  purpose: string;
  classification: CommodityDataClassification;
  productCodes: CommodityProductCode[];
  units: CommodityUnitRule[];
  qualityIndicators: CommodityQualityIndicator[];
  samplingRules: CommoditySamplingRule[];
  documentRequirements: CommodityDocumentRequirement[];
  storage: CommodityStorageRule;
  acceptance: CommodityAcceptanceRule;
  sourceRefs: string[];
  legalRuleIds: string[];
};

export type CommodityProfileVersion = {
  profileId: string;
  versionId: string;
  sequence: number;
  state: CommodityProfileState;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedBy?: string;
  contentHash: string;
  content: CommodityProfileContent;
};

export type CommodityProfileIdentity = {
  id: string;
  canonicalCode: string;
  archetype: CommodityArchetype;
  display: LocalizedDisplay;
  createdAt: string;
  createdBy: string;
};

export class CommodityProfileError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly path?: string,
  ) {
    super(message);
    this.name = 'CommodityProfileError';
  }
}

const EXACT_DECIMAL = /^-?(0|[1-9]\d*)(\.\d{1,6})?$/;
const CANONICAL_CODE = /^[A-Z0-9][A-Z0-9._-]{2,63}$/;
const RULE_CODE = /^[A-Z0-9][A-Z0-9._:-]{1,95}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const MICRO = 1_000_000n;

const ALLOWED_TRANSITIONS: Readonly<Record<CommodityProfileState, readonly CommodityProfileState[]>> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['DRAFT', 'APPROVED'],
  APPROVED: ['EFFECTIVE', 'REVOKED'],
  EFFECTIVE: ['DEPRECATED', 'REVOKED'],
  DEPRECATED: ['REVOKED'],
  REVOKED: [],
};

function requireText(value: string, path: string): void {
  if (!value || value.trim() !== value || value.length > 500) {
    throw new CommodityProfileError('PC_PROFILE_TEXT_INVALID', `${path} must be trimmed and non-empty`, path);
  }
}

function requireCode(value: string, path: string, canonical = false): void {
  const pattern = canonical ? CANONICAL_CODE : RULE_CODE;
  if (!pattern.test(value)) {
    throw new CommodityProfileError('PC_PROFILE_CODE_INVALID', `${path} has an invalid code`, path);
  }
}

function requireDecimal(value: string | undefined, path: string): void {
  if (value === undefined) return;
  if (!EXACT_DECIMAL.test(value)) {
    throw new CommodityProfileError(
      'PC_PROFILE_DECIMAL_INVALID',
      `${path} must be an exact decimal string with at most six fractional digits`,
      path,
    );
  }
}

function decimalToMicro(value: string, path: string): bigint {
  requireDecimal(value, path);
  const negative = value.startsWith('-');
  const normalized = negative ? value.slice(1) : value;
  const [whole, fraction = ''] = normalized.split('.');
  const result = BigInt(whole) * MICRO + BigInt(fraction.padEnd(6, '0'));
  return negative ? -result : result;
}

function requirePositiveDecimal(value: string, path: string): void {
  if (decimalToMicro(value, path) <= 0n) {
    throw new CommodityProfileError('PC_PROFILE_DECIMAL_NON_POSITIVE', `${path} must be greater than zero`, path);
  }
}

function requireOrderedRange(
  minimum: string | undefined,
  maximum: string | undefined,
  path: string,
): void {
  requireDecimal(minimum, `${path}Min`);
  requireDecimal(maximum, `${path}Max`);
  if (minimum !== undefined && maximum !== undefined && decimalToMicro(minimum, `${path}Min`) > decimalToMicro(maximum, `${path}Max`)) {
    throw new CommodityProfileError(
      'PC_PROFILE_RANGE_INVALID',
      `${path} minimum must not exceed maximum`,
      `${path}Min`,
    );
  }
}

function requireUnique(values: readonly string[], path: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new CommodityProfileError('PC_PROFILE_DUPLICATE', `${path} contains duplicate ${value}`, path);
    }
    seen.add(value);
  }
}

function requireLocalizedDisplay(display: LocalizedDisplay, path: string): void {
  requireText(display.ru, `${path}.ru`);
  if (display.en !== undefined) requireText(display.en, `${path}.en`);
  if (display.zh !== undefined) requireText(display.zh, `${path}.zh`);
}

function sortBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  return [...values].sort((left, right) => key(left).localeCompare(key(right)));
}

function normalizedContent(content: CommodityProfileContent): CommodityProfileContent {
  const copy = structuredClone(content);
  copy.productCodes = sortBy(copy.productCodes, (item) => `${item.system}:${item.code}`);
  copy.units = sortBy(copy.units, (item) => `${item.dimension}:${item.code}`);
  copy.qualityIndicators = sortBy(copy.qualityIndicators, (item) => item.code).map((item) => ({
    ...item,
    methodIds: [...item.methodIds].sort(),
  }));
  copy.samplingRules = sortBy(copy.samplingRules, (item) => item.code);
  copy.documentRequirements = sortBy(copy.documentRequirements, (item) => item.code);
  copy.storage.packagingKinds = [...copy.storage.packagingKinds].sort();
  copy.acceptance.releaseBlockers = [...copy.acceptance.releaseBlockers].sort();
  copy.sourceRefs = [...copy.sourceRefs].sort();
  copy.legalRuleIds = [...copy.legalRuleIds].sort();
  return copy;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

export function canonicalCommodityProfileJson(content: CommodityProfileContent): string {
  return JSON.stringify(canonicalize(normalizedContent(content)));
}

export function hashCommodityProfileContent(content: CommodityProfileContent): string {
  return createHash('sha256').update(canonicalCommodityProfileJson(content)).digest('hex');
}

export function validateCommodityProfileContent(content: CommodityProfileContent): void {
  requireCode(content.canonicalCode, 'canonicalCode', true);
  requireLocalizedDisplay(content.display, 'display');
  requireText(content.purpose, 'purpose');

  if (!COMMODITY_ARCHETYPES.includes(content.archetype)) {
    throw new CommodityProfileError('PC_PROFILE_ARCHETYPE_INVALID', `Unsupported archetype ${content.archetype}`, 'archetype');
  }

  if (content.productCodes.length === 0) {
    throw new CommodityProfileError('PC_PROFILE_PRODUCT_CODE_REQUIRED', 'At least one product code is required', 'productCodes');
  }
  requireUnique(content.productCodes.map((item) => `${item.system}:${item.code}`), 'productCodes');
  content.productCodes.forEach((item, index) => {
    requireText(item.code, `productCodes.${index}.code`);
    requireText(item.sourceRef, `productCodes.${index}.sourceRef`);
  });

  if (content.units.length === 0) {
    throw new CommodityProfileError('PC_PROFILE_UNIT_REQUIRED', 'At least one unit is required', 'units');
  }
  requireUnique(content.units.map((item) => item.code), 'units');
  const dimensions = new Set<CommodityUnitDimension>();
  const baseByDimension = new Map<CommodityUnitDimension, number>();
  for (const [index, unit] of content.units.entries()) {
    requireCode(unit.code, `units.${index}.code`);
    requireText(unit.symbol, `units.${index}.symbol`);
    requirePositiveDecimal(unit.numeratorToBase, `units.${index}.numeratorToBase`);
    requirePositiveDecimal(unit.denominatorToBase, `units.${index}.denominatorToBase`);
    requireText(unit.sourceRef, `units.${index}.sourceRef`);
    if (!Number.isInteger(unit.precision) || unit.precision < 0 || unit.precision > 6) {
      throw new CommodityProfileError(
        'PC_PROFILE_PRECISION_INVALID',
        `units.${index}.precision must be an integer from 0 to 6`,
        `units.${index}.precision`,
      );
    }
    dimensions.add(unit.dimension);
    if (unit.isBase) baseByDimension.set(unit.dimension, (baseByDimension.get(unit.dimension) ?? 0) + 1);
  }
  for (const dimension of dimensions) {
    if ((baseByDimension.get(dimension) ?? 0) !== 1) {
      throw new CommodityProfileError(
        'PC_PROFILE_BASE_UNIT_INVALID',
        `Dimension ${dimension} must have exactly one base unit`,
        'units',
      );
    }
  }

  const unitCodes = new Set(content.units.map((item) => item.code));
  requireUnique(content.qualityIndicators.map((item) => item.code), 'qualityIndicators');
  for (const [index, indicator] of content.qualityIndicators.entries()) {
    requireCode(indicator.code, `qualityIndicators.${index}.code`);
    requireLocalizedDisplay(indicator.display, `qualityIndicators.${index}.display`);
    if (!unitCodes.has(indicator.unitCode)) {
      throw new CommodityProfileError(
        'PC_PROFILE_UNIT_UNKNOWN',
        `Unknown unit ${indicator.unitCode}`,
        `qualityIndicators.${index}.unitCode`,
      );
    }
    if (!Number.isInteger(indicator.precision) || indicator.precision < 0 || indicator.precision > 6) {
      throw new CommodityProfileError(
        'PC_PROFILE_PRECISION_INVALID',
        `qualityIndicators.${index}.precision must be an integer from 0 to 6`,
        `qualityIndicators.${index}.precision`,
      );
    }
    if (indicator.methodIds.length === 0) {
      throw new CommodityProfileError(
        'PC_PROFILE_METHOD_REQUIRED',
        `qualityIndicators.${index} requires at least one method`,
        `qualityIndicators.${index}.methodIds`,
      );
    }
    requireUnique(indicator.methodIds, `qualityIndicators.${index}.methodIds`);
    indicator.methodIds.forEach((method, methodIndex) =>
      requireCode(method, `qualityIndicators.${index}.methodIds.${methodIndex}`),
    );
    requireOrderedRange(indicator.lowerBound, indicator.upperBound, `qualityIndicators.${index}.bound`);
    requireText(indicator.sourceRef, `qualityIndicators.${index}.sourceRef`);
  }

  requireUnique(content.samplingRules.map((item) => item.code), 'samplingRules');
  for (const [index, rule] of content.samplingRules.entries()) {
    requireCode(rule.code, `samplingRules.${index}.code`);
    if (rule.retentionDays !== undefined && (!Number.isSafeInteger(rule.retentionDays) || rule.retentionDays <= 0)) {
      throw new CommodityProfileError(
        'PC_PROFILE_RETENTION_INVALID',
        `samplingRules.${index}.retentionDays must be a positive integer`,
        `samplingRules.${index}.retentionDays`,
      );
    }
    requireText(rule.sourceRef, `samplingRules.${index}.sourceRef`);
  }

  requireUnique(content.documentRequirements.map((item) => item.code), 'documentRequirements');
  const documentCodes = new Set<string>();
  for (const [index, requirement] of content.documentRequirements.entries()) {
    requireCode(requirement.code, `documentRequirements.${index}.code`);
    requireLocalizedDisplay(requirement.display, `documentRequirements.${index}.display`);
    if (requirement.validForDays !== undefined && (!Number.isSafeInteger(requirement.validForDays) || requirement.validForDays <= 0)) {
      throw new CommodityProfileError(
        'PC_PROFILE_VALIDITY_INVALID',
        `documentRequirements.${index}.validForDays must be a positive integer`,
        `documentRequirements.${index}.validForDays`,
      );
    }
    if (requirement.releaseBlocking && requirement.severity !== 'BLOCKING') {
      throw new CommodityProfileError(
        'PC_PROFILE_RELEASE_BLOCKER_INVALID',
        `Release-blocking document ${requirement.code} must have BLOCKING severity`,
        `documentRequirements.${index}.severity`,
      );
    }
    requireText(requirement.sourceRef, `documentRequirements.${index}.sourceRef`);
    documentCodes.add(requirement.code);
  }

  requireOrderedRange(content.storage.temperatureMin, content.storage.temperatureMax, 'storage.temperature');
  requireOrderedRange(content.storage.humidityMin, content.storage.humidityMax, 'storage.humidity');
  requireUnique(content.storage.packagingKinds, 'storage.packagingKinds');
  content.storage.packagingKinds.forEach((kind, index) => requireCode(kind, `storage.packagingKinds.${index}`));
  if (content.storage.shelfLifeHours !== undefined && (!Number.isSafeInteger(content.storage.shelfLifeHours) || content.storage.shelfLifeHours <= 0)) {
    throw new CommodityProfileError(
      'PC_PROFILE_SHELF_LIFE_INVALID',
      'storage.shelfLifeHours must be a positive integer',
      'storage.shelfLifeHours',
    );
  }
  requireText(content.storage.sourceRef, 'storage.sourceRef');

  requireUnique(content.acceptance.releaseBlockers, 'acceptance.releaseBlockers');
  content.acceptance.releaseBlockers.forEach((blocker, index) => {
    requireCode(blocker, `acceptance.releaseBlockers.${index}`);
    if (!documentCodes.has(blocker)) {
      throw new CommodityProfileError(
        'PC_PROFILE_BLOCKER_REFERENCE_UNKNOWN',
        `Release blocker ${blocker} does not reference a document requirement`,
        `acceptance.releaseBlockers.${index}`,
      );
    }
  });
  if (content.acceptance.priceDeltaPolicyRef !== undefined) {
    requireCode(content.acceptance.priceDeltaPolicyRef, 'acceptance.priceDeltaPolicyRef');
  }
  if (content.acceptance.rapidDisputeHours !== undefined && (!Number.isSafeInteger(content.acceptance.rapidDisputeHours) || content.acceptance.rapidDisputeHours <= 0)) {
    throw new CommodityProfileError(
      'PC_PROFILE_DISPUTE_WINDOW_INVALID',
      'acceptance.rapidDisputeHours must be a positive integer',
      'acceptance.rapidDisputeHours',
    );
  }
  requireText(content.acceptance.sourceRef, 'acceptance.sourceRef');

  if (content.sourceRefs.length === 0) {
    throw new CommodityProfileError('PC_PROFILE_SOURCE_REQUIRED', 'At least one source reference is required', 'sourceRefs');
  }
  requireUnique(content.sourceRefs, 'sourceRefs');
  content.sourceRefs.forEach((source, index) => requireText(source, `sourceRefs.${index}`));
  requireUnique(content.legalRuleIds, 'legalRuleIds');
  content.legalRuleIds.forEach((rule, index) => requireCode(rule, `legalRuleIds.${index}`));
}

export function assertCommodityProfileTransition(from: CommodityProfileState, to: CommodityProfileState): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new CommodityProfileError(
      'PC_PROFILE_TRANSITION_DENIED',
      `Commodity profile transition ${from} -> ${to} is not allowed`,
      'state',
    );
  }
}

export function assertCommodityProfileContentMutable(state: CommodityProfileState): void {
  if (state !== 'DRAFT') {
    throw new CommodityProfileError(
      'PC_PROFILE_VERSION_IMMUTABLE',
      `Commodity profile content is immutable in ${state} state; create a new version`,
      'state',
    );
  }
}

export function buildCommodityProfileVersion(
  input: Omit<CommodityProfileVersion, 'contentHash'>,
): CommodityProfileVersion {
  validateCommodityProfileContent(input.content);
  if (!Number.isSafeInteger(input.sequence) || input.sequence <= 0) {
    throw new CommodityProfileError('PC_PROFILE_SEQUENCE_INVALID', 'sequence must be a positive safe integer', 'sequence');
  }
  requireText(input.profileId, 'profileId');
  requireText(input.versionId, 'versionId');
  requireText(input.createdBy, 'createdBy');
  if (!ISO_INSTANT.test(input.createdAt)) {
    throw new CommodityProfileError('PC_PROFILE_TIME_INVALID', 'createdAt must be an ISO UTC instant', 'createdAt');
  }
  if (input.effectiveFrom !== undefined && !ISO_INSTANT.test(input.effectiveFrom)) {
    throw new CommodityProfileError('PC_PROFILE_TIME_INVALID', 'effectiveFrom must be an ISO UTC instant', 'effectiveFrom');
  }
  if (input.effectiveTo !== undefined && !ISO_INSTANT.test(input.effectiveTo)) {
    throw new CommodityProfileError('PC_PROFILE_TIME_INVALID', 'effectiveTo must be an ISO UTC instant', 'effectiveTo');
  }
  if (input.effectiveFrom && input.effectiveTo && input.effectiveFrom >= input.effectiveTo) {
    throw new CommodityProfileError(
      'PC_PROFILE_EFFECTIVE_RANGE_INVALID',
      'effectiveFrom must be before effectiveTo',
      'effectiveFrom',
    );
  }
  if (input.state === 'EFFECTIVE' && !input.effectiveFrom) {
    throw new CommodityProfileError(
      'PC_PROFILE_EFFECTIVE_FROM_REQUIRED',
      'An EFFECTIVE version requires effectiveFrom',
      'effectiveFrom',
    );
  }
  if (['APPROVED', 'EFFECTIVE', 'DEPRECATED', 'REVOKED'].includes(input.state)) {
    if (!input.approvedAt || !input.approvedBy || !ISO_INSTANT.test(input.approvedAt)) {
      throw new CommodityProfileError(
        'PC_PROFILE_APPROVAL_EVIDENCE_REQUIRED',
        `${input.state} requires approvedAt and approvedBy`,
        'approvedAt',
      );
    }
  }

  const immutableContent = deepFreeze(structuredClone(input.content));
  return deepFreeze({
    ...input,
    contentHash: hashCommodityProfileContent(immutableContent),
    content: immutableContent,
  });
}

export function assertNoCommodityProfileEffectiveOverlap(
  candidate: Pick<CommodityProfileVersion, 'versionId' | 'effectiveFrom' | 'effectiveTo'>,
  existing: readonly Pick<CommodityProfileVersion, 'versionId' | 'state' | 'effectiveFrom' | 'effectiveTo'>[],
): void {
  if (!candidate.effectiveFrom) return;
  const candidateEnd = candidate.effectiveTo ?? '9999-12-31T23:59:59Z';
  for (const version of existing) {
    if (
      version.versionId === candidate.versionId ||
      !['APPROVED', 'EFFECTIVE'].includes(version.state) ||
      !version.effectiveFrom
    ) {
      continue;
    }
    const existingEnd = version.effectiveTo ?? '9999-12-31T23:59:59Z';
    if (candidate.effectiveFrom < existingEnd && version.effectiveFrom < candidateEnd) {
      throw new CommodityProfileError(
        'PC_PROFILE_EFFECTIVE_OVERLAP',
        `Effective range overlaps version ${version.versionId}`,
        'effectiveFrom',
      );
    }
  }
}
