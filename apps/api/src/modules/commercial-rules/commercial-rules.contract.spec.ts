import {
  commercialDigest,
  commercialRuleCommandFingerprint,
  CommercialRulesValidationError,
  validateCommercialDecisionRequest,
  validateCommercialRuleCommand,
  type CommercialRuleCommand,
} from './commercial-rules.contract';

const createRuleSet: CommercialRuleCommand = {
  aggregateType: 'RULE_SET',
  aggregateKey: 'platform-fee',
  action: 'CREATE_VERSION',
  commandId: 'command:commercial:001',
  idempotencyKey: 'idempotency:commercial:001',
  correlationId: 'correlation:commercial:001',
  expectedStateVersion: '0',
  reason: 'Create the first controlled commercial rule version.',
  name: 'Platform fee',
  currency: 'RUB',
  effectiveFrom: '2026-09-05T00:00:00.000Z',
  effectiveTo: null,
  rules: [{
    ruleKey: 'standard-percent',
    kind: 'PRICING',
    priority: 10,
    when: { serviceCategory: 'LOGISTICS' },
    commercial: { pricingModel: 'PERCENT', pricing: { basisPoints: 125 }, payerMode: 'BUYER' },
  }],
};

describe('commercial rules contract', () => {
  it('accepts a pinned, integer-safe rule version', () => {
    expect(() => validateCommercialRuleCommand(createRuleSet)).not.toThrow();
    expect(commercialRuleCommandFingerprint(createRuleSet)).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each(['-1', '1.5', '9223372036854775808', '01'])('rejects confirmation pricing %s before publishing', (amountKopecks) => {
    expect(() => validateCommercialRuleCommand({ ...createRuleSet, rules: [{
      ruleKey: 'confirmation-fee', kind: 'PRICING', priority: 1, when: {},
      commercial: { pricingModel: 'FIXED', pricing: { amountKopecks }, payerMode: 'REQUIRES_CONFIRMATION' },
    }] })).toThrow(CommercialRulesValidationError);
  });

  it('rejects a contractual payer supplied by the caller', () => {
    expect(() => validateCommercialDecisionRequest({
      decisionKey: 'decision:contract-payer', correlationId: 'correlation:contract-payer',
      ruleSetId: 'rule-set:001', ruleKey: 'standard-percent', context: {}, facts: { contractPayer: 'SELLER' },
    })).toThrow('contractPayer must come from contract authority');
  });

  it('canonicalizes object key order', () => {
    expect(commercialDigest({ b: 2, a: 1 })).toBe(commercialDigest({ a: 1, b: 2 }));
    expect(commercialDigest({ 'я': 1, z: 2, A: 3 })).toBe(commercialDigest({ A: 3, z: 2, 'я': 1 }));
  });

  it('requires timezone-qualified effective timestamps', () => {
    expect(() => validateCommercialRuleCommand({
      ...createRuleSet,
      effectiveFrom: '2026-09-05',
    })).toThrow('timezone');
    expect(() => validateCommercialRuleCommand({
      ...createRuleSet,
      effectiveFrom: '2026-02-30T00:00:00Z',
    })).toThrow('real timestamp');
  });

  it('rejects duplicate rule keys and moving pack references', () => {
    expect(() => validateCommercialRuleCommand({
      ...createRuleSet,
      entries: [{ ruleSetId: 'rule-set:001' }],
    } as never)).toThrow('does not accept pack entries');
    expect(() => validateCommercialRuleCommand({
      ...createRuleSet,
      rules: [...(createRuleSet.action === 'CREATE_VERSION' ? createRuleSet.rules ?? [] : []), ...(createRuleSet.action === 'CREATE_VERSION' ? createRuleSet.rules ?? [] : [])],
    })).toThrow('standard-percent');
    expect(() => validateCommercialRuleCommand({
      ...createRuleSet,
      aggregateType: 'RULE_PACK',
      aggregateKey: 'default-pack',
      entries: [{ ruleSetId: 'rule-set:001', ruleSetKey: 'platform-fee', ruleSetVersion: '1', ruleSetContentHash: 'moving' }],
      rules: undefined,
      currency: undefined,
    })).toThrow(CommercialRulesValidationError);
    expect(() => validateCommercialRuleCommand({
      ...createRuleSet,
      aggregateType: 'RULE_PACK',
      aggregateKey: 'default-pack',
      entries: [{ ruleSetId: 'rule-set:001', ruleSetKey: 'platform-fee', ruleSetVersion: '9999999999999999999', ruleSetContentHash: 'a'.repeat(64) }],
      rules: undefined,
      currency: undefined,
    })).toThrow('pin version');
  });

  it('requires positive lifecycle CAS and valid evaluation identifiers', () => {
    expect(() => validateCommercialRuleCommand({
      ...createRuleSet,
      aggregateType: 'OTHER',
    } as never)).toThrow('aggregateType is invalid');
    expect(() => validateCommercialRuleCommand({
      ...createRuleSet,
      reason: 42,
    } as never)).toThrow('reason must contain');
    expect(() => validateCommercialRuleCommand({
      aggregateType: 'RULE_SET', aggregateKey: 'platform-fee', aggregateId: 'rule-set:001', action: 'PUBLISH',
      commandId: 'command:commercial:002', idempotencyKey: 'idempotency:commercial:002', correlationId: 'correlation:commercial:002',
      expectedStateVersion: '0', reason: 'Publish controlled commercial version.',
    })).toThrow('positive state version');
    expect(() => validateCommercialDecisionRequest({ decisionKey: 'bad key', correlationId: 'correlation:commercial:003', ruleSetId: 'rule-set:001', ruleKey: 'standard-percent', context: {}, facts: {} })).toThrow('DECISION_KEY_INVALID');
    expect(() => validateCommercialDecisionRequest({
      decisionKey: 'decision:commercial:003', correlationId: 'correlation:commercial:003',
      ruleSetId: 'rule-set:001', ruleKey: 'standard-percent', context: {},
      facts: { baseAmountKopecks: 10 } as never,
    })).toThrow('integer string');
  });

  it('fails closed on malformed nested rules and payer definitions', () => {
    expect(() => validateCommercialRuleCommand({
      ...createRuleSet,
      rules: [null] as never,
    })).toThrow(CommercialRulesValidationError);
    expect(() => validateCommercialRuleCommand({
      ...createRuleSet,
      rules: [{
        ruleKey: 'invalid-pricing', kind: 'PRICING', priority: 1, when: {},
        commercial: { pricingModel: 'FIXED', payerMode: 'BUYER' },
      }] as never,
    })).toThrow('pricing must be an object');
    expect(() => validateCommercialRuleCommand({
      ...createRuleSet,
      rules: [{
        ruleKey: 'invalid-split', kind: 'PAYER', priority: 1, when: {},
        commercial: {
          pricingModel: 'FREE', pricing: {}, payerMode: 'SPLIT',
          payerShares: [{ payer: 'BANK', basisPoints: 5000 }, { payer: 'BUYER', basisPoints: 5000 }],
        },
      }] as never,
    })).toThrow('payer is invalid');
    expect(() => validateCommercialRuleCommand({
      ...createRuleSet,
      rules: [{
        ruleKey: 'negative-fixed', kind: 'PRICING', priority: 1, when: {},
        commercial: { pricingModel: 'FIXED', pricing: { amountKopecks: '-1' }, payerMode: 'BUYER' },
      }],
    })).toThrow(CommercialRulesValidationError);
    expect(() => validateCommercialDecisionRequest({
      decisionKey: 'decision:commercial:overflow', correlationId: 'correlation:commercial:overflow',
      ruleSetId: 'rule-set:001', ruleKey: 'standard-percent', context: {},
      facts: { baseAmountKopecks: '9223372036854775808' },
    })).toThrow('BIGINT authority');
    expect(() => validateCommercialDecisionRequest({
      decisionKey: 'decision:commercial:leading-zero', correlationId: 'correlation:commercial:leading-zero',
      ruleSetId: 'rule-set:001', ruleKey: 'standard-percent', context: {},
      facts: { baseAmountKopecks: '01' },
    })).toThrow('integer string');
  });
});
