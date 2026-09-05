import { createHash } from 'node:crypto';
import {
  COMMERCIAL_POLICY_KINDS,
  CommercialRuleError,
  evaluateCommercialRule,
  isCommercialPayerMode,
  isCommercialPricingModel,
  type CommercialEvaluationFacts,
  type CommercialPolicyKind,
  type CommercialRuleDefinition,
} from '../../../../../packages/domain-core/src';

export type CommercialRulePolicy = Readonly<{
  ruleKey: string;
  kind: CommercialPolicyKind;
  priority: number;
  when: Readonly<Record<string, unknown>>;
  commercial?: CommercialRuleDefinition;
  outcome?: unknown;
}>;

export type CommercialRulePackEntry = Readonly<{
  ruleSetId: string;
  ruleSetKey: string;
  ruleSetVersion: string;
  ruleSetContentHash: string;
}>;

type CommandBase = Readonly<{
  aggregateType: 'RULE_SET' | 'RULE_PACK';
  aggregateKey: string;
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  expectedStateVersion: string;
  reason: string;
}>;

export type CommercialRuleCommand = CommandBase & (
  | Readonly<{
      action: 'CREATE_VERSION';
      aggregateId?: never;
      name: string;
      effectiveFrom: string | null;
      effectiveTo: string | null;
      currency?: string;
      rules?: readonly CommercialRulePolicy[];
      entries?: readonly CommercialRulePackEntry[];
    }>
  | Readonly<{
      action: 'PUBLISH' | 'RETIRE';
      aggregateId: string;
      name?: never;
      effectiveFrom?: never;
      effectiveTo?: never;
      currency?: never;
      rules?: never;
      entries?: never;
    }>
);

export type CommercialRuleCommandReceipt = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  aggregateType: 'RULE_SET' | 'RULE_PACK';
  aggregateId: string;
  aggregateKey: string;
  action: 'CREATE_VERSION' | 'PUBLISH' | 'RETIRE';
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  version: string;
  stateVersion: string;
  contentHash: string;
  replayed: boolean;
  committedAt: string;
}>;

export type CommercialDecisionRequest = Readonly<{
  decisionKey: string;
  correlationId: string;
  ruleSetId: string;
  ruleKey: string;
  rulePackId?: string | null;
  context: Readonly<Record<string, string | boolean>>;
  facts: CommercialEvaluationFacts;
}>;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/u;
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-](\d{2}):(\d{2}))$/u;
const CURRENCIES = new Set(['RUB', 'USD', 'EUR', 'CNY']);
const MAX_SIGNED_BIGINT = 9_223_372_036_854_775_807n;
const DIRECT_PAYERS = new Set(['SELLER', 'BUYER', 'INITIATOR', 'DELIVERY_RESPONSIBLE']);
const PRICING_CONFIGURATION: Record<string, Readonly<{ required: readonly string[]; allowed: readonly string[] }>> = {
  FREE: { required: [], allowed: [] },
  SUBSCRIPTION: { required: ['amountKopecks'], allowed: ['amountKopecks'] },
  ACCESS_FEE: { required: ['amountKopecks'], allowed: ['amountKopecks'] },
  FIXED: { required: ['amountKopecks'], allowed: ['amountKopecks'] },
  PER_TON: { required: ['rateKopecks'], allowed: ['rateKopecks'] },
  PER_KM: { required: ['rateKopecks'], allowed: ['rateKopecks'] },
  PER_TRIP: { required: ['rateKopecks'], allowed: ['rateKopecks'] },
  PER_HOUR: { required: ['rateKopecks'], allowed: ['rateKopecks'] },
  PERCENT: { required: ['basisPoints'], allowed: ['basisPoints'] },
  SUCCESS_FEE: { required: ['amountKopecks'], allowed: ['amountKopecks'] },
  CAPPED_PERCENT: { required: ['basisPoints', 'capKopecks'], allowed: ['basisPoints', 'capKopecks'] },
  HYBRID: { required: ['fixedKopecks', 'basisPoints'], allowed: ['fixedKopecks', 'basisPoints', 'capKopecks'] },
  MANUAL_QUOTE: { required: [], allowed: [] },
};

export class CommercialRulesValidationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'CommercialRulesValidationError';
  }
}

export function stableCommercialJson(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(stableCommercialJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => [key, stableCommercialJson(item)]));
  }
  return value;
}

export function commercialDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableCommercialJson(value))).digest('hex');
}

function requiredSafe(value: unknown, pattern: RegExp, code: string): asserts value is string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new CommercialRulesValidationError(code, `${code}: unsafe identifier`);
  }
}

function record(value: unknown, code: string, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CommercialRulesValidationError(code, message);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], code: string, label: string): void {
  const allow = new Set(allowed);
  if (Object.keys(value).some((key) => !allow.has(key))) {
    throw new CommercialRulesValidationError(code, `${label} contains an unknown field`);
  }
}

function timestamp(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new CommercialRulesValidationError('EFFECTIVE_PERIOD_INVALID', `${field} must be ISO-8601 with timezone`);
  }
  const match = ISO_TIMESTAMP.exec(value);
  if (!match) {
    throw new CommercialRulesValidationError('EFFECTIVE_PERIOD_INVALID', `${field} must be ISO-8601 with timezone`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const timezoneHour = match[8] === undefined ? 0 : Number(match[8]);
  const timezoneMinute = match[9] === undefined ? 0 : Number(match[9]);
  const daysInMonth = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;
  if (day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59
    || timezoneHour > 23 || timezoneMinute > 59) {
    throw new CommercialRulesValidationError('EFFECTIVE_PERIOD_INVALID', `${field} is not a real timestamp`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new CommercialRulesValidationError('EFFECTIVE_PERIOD_INVALID', `${field} must be ISO-8601`);
  return parsed;
}

function validateRule(value: unknown, index: number): asserts value is CommercialRulePolicy {
  const rule = record(value, 'COMMERCIAL_RULE_INVALID', `rules[${index}] must be an object`);
  exactKeys(rule, ['ruleKey', 'kind', 'priority', 'when', 'commercial', 'outcome'], 'COMMERCIAL_RULE_INVALID', `rules[${index}]`);
  requiredSafe(rule.ruleKey, SAFE_KEY, 'RULE_KEY_INVALID');
  if (typeof rule.kind !== 'string' || !(COMMERCIAL_POLICY_KINDS as readonly string[]).includes(rule.kind)) {
    throw new CommercialRulesValidationError('POLICY_KIND_INVALID', `rules[${index}].kind is invalid`);
  }
  if (typeof rule.priority !== 'number' || !Number.isSafeInteger(rule.priority) || rule.priority < 0 || rule.priority > 1_000_000) {
    throw new CommercialRulesValidationError('RULE_PRIORITY_INVALID', `rules[${index}].priority is invalid`);
  }
  const when = record(rule.when, 'RULE_CONDITION_INVALID', `rules[${index}].when must be an object`);
  const conditions = Object.entries(when);
  if (conditions.length > 20 || conditions.some(([key, value]) =>
    !SAFE_KEY.test(key) || (typeof value !== 'string' && typeof value !== 'boolean')
    || (typeof value === 'string' && value.length > 240))) {
    throw new CommercialRulesValidationError(
      'RULE_CONDITION_INVALID',
      `rules[${index}].when accepts at most 20 safe string or boolean facts`,
    );
  }
  if (rule.kind === 'PRICING' || rule.kind === 'PAYER') {
    if (rule.outcome !== undefined) {
      throw new CommercialRulesValidationError('COMMERCIAL_DEFINITION_INVALID', `rules[${index}].outcome is not allowed`);
    }
    const commercial = record(
      rule.commercial,
      'COMMERCIAL_DEFINITION_INVALID',
      `rules[${index}].commercial must be an object`,
    );
    exactKeys(
      commercial,
      ['pricingModel', 'pricing', 'payerMode', 'payerShares'],
      'COMMERCIAL_DEFINITION_INVALID',
      `rules[${index}].commercial`,
    );
    if (typeof commercial.pricingModel !== 'string' || !isCommercialPricingModel(commercial.pricingModel)
      || typeof commercial.payerMode !== 'string' || !isCommercialPayerMode(commercial.payerMode)) {
      throw new CommercialRulesValidationError('COMMERCIAL_DEFINITION_INVALID', `rules[${index}].commercial is invalid`);
    }
    const pricing = record(
      commercial.pricing,
      'COMMERCIAL_DEFINITION_INVALID',
      `rules[${index}].pricing must be an object`,
    );
    const shape = PRICING_CONFIGURATION[commercial.pricingModel]!;
    exactKeys(pricing, shape.allowed, 'COMMERCIAL_DEFINITION_INVALID', `rules[${index}].pricing`);
    if (shape.required.some((key) => !(key in pricing))) {
      throw new CommercialRulesValidationError('COMMERCIAL_DEFINITION_INVALID', `rules[${index}].pricing is incomplete`);
    }
    if (commercial.payerMode === 'SPLIT') {
      if (!Array.isArray(commercial.payerShares) || commercial.payerShares.length < 2) {
        throw new CommercialRulesValidationError('COMMERCIAL_DEFINITION_INVALID', `rules[${index}].payerShares is invalid`);
      }
      const payers = new Set<string>();
      for (const [shareIndex, candidate] of commercial.payerShares.entries()) {
        const share = record(candidate, 'COMMERCIAL_DEFINITION_INVALID', `rules[${index}].payerShares[${shareIndex}] must be an object`);
        exactKeys(share, ['payer', 'basisPoints'], 'COMMERCIAL_DEFINITION_INVALID', `rules[${index}].payerShares[${shareIndex}]`);
        if (typeof share.payer !== 'string' || !DIRECT_PAYERS.has(share.payer) || payers.has(share.payer)) {
          throw new CommercialRulesValidationError('COMMERCIAL_DEFINITION_INVALID', `rules[${index}].payerShares[${shareIndex}].payer is invalid`);
        }
        payers.add(share.payer);
      }
    } else if (commercial.payerShares !== undefined) {
      throw new CommercialRulesValidationError('COMMERCIAL_DEFINITION_INVALID', `rules[${index}].payerShares requires SPLIT`);
    }
    // Exercise configuration, split and overflow guards with a complete set
    // of neutral facts. Missing runtime facts are valid; missing rule config is not.
    let probe: ReturnType<typeof evaluateCommercialRule>;
    try {
      probe = evaluateCommercialRule(commercial as CommercialRuleDefinition, {
        baseAmountKopecks: '1', quantityMilliTons: '1', distanceMeters: '1',
        tripCount: '1', durationMinutes: '1', subscriptionPeriods: '1',
        accessUnits: '1', success: true, contractPayer: 'BUYER',
      });
    } catch (error) {
      if (error instanceof CommercialRuleError) {
        throw new CommercialRulesValidationError('COMMERCIAL_DEFINITION_INVALID', error.message);
      }
      throw error;
    }
    if (probe.status === 'MISSING_FACTS') {
      throw new CommercialRulesValidationError(
        'COMMERCIAL_DEFINITION_INVALID',
        `rules[${index}].commercial is missing ${probe.missingFacts.join(', ')}`,
      );
    }
  } else {
    if (rule.commercial !== undefined) {
      throw new CommercialRulesValidationError('POLICY_OUTCOME_INVALID', `rules[${index}].commercial is not allowed`);
    }
    if (rule.outcome === undefined) {
      throw new CommercialRulesValidationError('POLICY_OUTCOME_REQUIRED', `rules[${index}].outcome is required`);
    }
  }
}

export function validateCommercialRuleCommand(command: CommercialRuleCommand): void {
  if (!['RULE_SET', 'RULE_PACK'].includes(command.aggregateType)) {
    throw new CommercialRulesValidationError('AGGREGATE_TYPE_INVALID', 'aggregateType is invalid');
  }
  if (!['CREATE_VERSION', 'PUBLISH', 'RETIRE'].includes(command.action)) {
    throw new CommercialRulesValidationError('COMMERCIAL_RULE_ACTION_INVALID', 'action is invalid');
  }
  requiredSafe(command.aggregateKey, SAFE_KEY, 'AGGREGATE_KEY_INVALID');
  requiredSafe(command.commandId, SAFE_ID, 'COMMAND_ID_INVALID');
  requiredSafe(command.idempotencyKey, SAFE_ID, 'IDEMPOTENCY_KEY_INVALID');
  requiredSafe(command.correlationId, SAFE_ID, 'CORRELATION_ID_INVALID');
  if (typeof command.expectedStateVersion !== 'string'
    || !/^(0|[1-9][0-9]{0,18})$/u.test(command.expectedStateVersion)
    || BigInt(command.expectedStateVersion) > MAX_SIGNED_BIGINT) {
    throw new CommercialRulesValidationError('EXPECTED_VERSION_INVALID', 'expectedStateVersion must be an integer string');
  }
  if (typeof command.reason !== 'string'
    || command.reason.trim().length < 10 || command.reason.trim().length > 2_000) {
    throw new CommercialRulesValidationError('HUMAN_REASON_INVALID', 'reason must contain 10..2000 characters');
  }
  if (command.action !== 'CREATE_VERSION') {
    requiredSafe(command.aggregateId, SAFE_ID, 'AGGREGATE_ID_INVALID');
    if (command.expectedStateVersion === '0') {
      throw new CommercialRulesValidationError('EXPECTED_VERSION_INVALID', 'lifecycle command requires a positive state version');
    }
    return;
  }
  if (command.expectedStateVersion !== '0') {
    throw new CommercialRulesValidationError('EXPECTED_VERSION_INVALID', 'new version requires expectedStateVersion 0');
  }
  if (typeof command.name !== 'string'
    || command.name.trim().length < 3 || command.name.trim().length > 160) {
    throw new CommercialRulesValidationError('NAME_INVALID', 'name must contain 3..160 characters');
  }
  const start = timestamp(command.effectiveFrom, 'effectiveFrom');
  const end = timestamp(command.effectiveTo, 'effectiveTo');
  if (start !== null && end !== null && end <= start) {
    throw new CommercialRulesValidationError('EFFECTIVE_PERIOD_INVALID', 'effectiveTo must be after effectiveFrom');
  }
  if (command.aggregateType === 'RULE_SET') {
    if (command.entries !== undefined) {
      throw new CommercialRulesValidationError('RULES_INVALID', 'rule set does not accept pack entries');
    }
    if (!command.currency || !CURRENCIES.has(command.currency)) {
      throw new CommercialRulesValidationError('CURRENCY_INVALID', 'rule set currency is invalid');
    }
    if (!Array.isArray(command.rules) || command.rules.length < 1 || command.rules.length > 100) {
      throw new CommercialRulesValidationError('RULES_INVALID', 'rule set requires 1..100 rules');
    }
    const keys = new Set<string>();
    command.rules.forEach((rule, index) => {
      validateRule(rule, index);
      if (keys.has(rule.ruleKey)) throw new CommercialRulesValidationError('RULE_KEY_DUPLICATE', rule.ruleKey);
      keys.add(rule.ruleKey);
    });
  } else {
    if (command.rules !== undefined || command.currency !== undefined) {
      throw new CommercialRulesValidationError('RULE_PACK_ENTRIES_INVALID', 'rule pack does not accept rules or currency');
    }
    if (!Array.isArray(command.entries) || command.entries.length < 1 || command.entries.length > 100) {
      throw new CommercialRulesValidationError('RULE_PACK_ENTRIES_INVALID', 'rule pack requires 1..100 entries');
    }
    const ids = new Set<string>();
    command.entries.forEach((value, index) => {
      const entry = record(value, 'RULE_SET_REFERENCE_INVALID', `entries[${index}] must be an object`);
      exactKeys(entry, ['ruleSetId', 'ruleSetKey', 'ruleSetVersion', 'ruleSetContentHash'], 'RULE_SET_REFERENCE_INVALID', `entries[${index}]`);
      requiredSafe(entry.ruleSetId, SAFE_ID, 'RULE_SET_ID_INVALID');
      requiredSafe(entry.ruleSetKey, SAFE_KEY, 'RULE_SET_KEY_INVALID');
      if (typeof entry.ruleSetVersion !== 'string' || !/^[1-9][0-9]{0,18}$/u.test(entry.ruleSetVersion)
        || (typeof entry.ruleSetVersion === 'string' && /^\d+$/u.test(entry.ruleSetVersion)
          && BigInt(entry.ruleSetVersion) > MAX_SIGNED_BIGINT)
        || typeof entry.ruleSetContentHash !== 'string' || !HASH.test(entry.ruleSetContentHash)) {
        throw new CommercialRulesValidationError('RULE_SET_REFERENCE_INVALID', 'rule pack entry must pin version and content hash');
      }
      if (ids.has(entry.ruleSetId)) throw new CommercialRulesValidationError('RULE_SET_REFERENCE_DUPLICATE', entry.ruleSetId);
      ids.add(entry.ruleSetId);
    });
  }
  if (Buffer.byteLength(JSON.stringify(stableCommercialJson(commercialVersionContent(command))), 'utf8') > 262_144) {
    throw new CommercialRulesValidationError('COMMERCIAL_VERSION_TOO_LARGE', 'commercial version exceeds 256 KiB');
  }
}

export function commercialRuleCommandFingerprint(command: CommercialRuleCommand): string {
  validateCommercialRuleCommand(command);
  return commercialDigest({ ...command, reason: command.reason.trim() });
}

export function commercialVersionContent(command: Extract<CommercialRuleCommand, { action: 'CREATE_VERSION' }>): unknown {
  return command.aggregateType === 'RULE_SET'
    ? { aggregateType: command.aggregateType, aggregateKey: command.aggregateKey, name: command.name.trim(), currency: command.currency, rules: command.rules, effectiveFrom: command.effectiveFrom, effectiveTo: command.effectiveTo }
    : { aggregateType: command.aggregateType, aggregateKey: command.aggregateKey, name: command.name.trim(), entries: command.entries, effectiveFrom: command.effectiveFrom, effectiveTo: command.effectiveTo };
}

export function validateCommercialDecisionRequest(request: CommercialDecisionRequest): void {
  requiredSafe(request.decisionKey, SAFE_ID, 'DECISION_KEY_INVALID');
  requiredSafe(request.correlationId, SAFE_ID, 'CORRELATION_ID_INVALID');
  requiredSafe(request.ruleSetId, SAFE_ID, 'RULE_SET_ID_INVALID');
  requiredSafe(request.ruleKey, SAFE_KEY, 'RULE_KEY_INVALID');
  if (request.rulePackId !== undefined && request.rulePackId !== null) requiredSafe(request.rulePackId, SAFE_ID, 'RULE_PACK_ID_INVALID');
  if (!request.context || typeof request.context !== 'object' || Array.isArray(request.context)) {
    throw new CommercialRulesValidationError('EVALUATION_CONTEXT_INVALID', 'context must be an object');
  }
  for (const [key, value] of Object.entries(request.context)) {
    if (!SAFE_KEY.test(key) || (typeof value !== 'string' && typeof value !== 'boolean')) {
      throw new CommercialRulesValidationError('EVALUATION_CONTEXT_INVALID', 'context accepts safe string or boolean facts only');
    }
  }
  if (!request.facts || typeof request.facts !== 'object' || Array.isArray(request.facts)) {
    throw new CommercialRulesValidationError('EVALUATION_FACTS_INVALID', 'facts must be an object');
  }
  const stringFacts = new Set([
    'baseAmountKopecks', 'quantityMilliTons', 'distanceMeters', 'tripCount',
    'durationMinutes', 'subscriptionPeriods', 'accessUnits',
  ]);
  for (const [key, value] of Object.entries(request.facts)) {
    if (stringFacts.has(key)) {
      if (typeof value !== 'string' || value.length > 19 || !/^(0|[1-9]\d*)$/u.test(value)) {
        throw new CommercialRulesValidationError('EVALUATION_FACTS_INVALID', `${key} must be an integer string`);
      }
      if (BigInt(value) > MAX_SIGNED_BIGINT) {
        throw new CommercialRulesValidationError('EVALUATION_FACTS_INVALID', `${key} exceeds BIGINT authority`);
      }
      continue;
    }
    if (key === 'success' && typeof value === 'boolean') continue;
    if (key === 'contractPayer' && typeof value === 'string'
      && ['SELLER', 'BUYER', 'INITIATOR', 'DELIVERY_RESPONSIBLE'].includes(value)) continue;
    throw new CommercialRulesValidationError('EVALUATION_FACTS_INVALID', `unknown or invalid fact: ${key}`);
  }
}
