import {
  ServiceMarketplaceValidationError,
  normalizeServiceMarketplaceCommand,
  serviceMarketplaceDigest,
} from './service-marketplace.contract';

const base = {
  requestId: 'request-001',
  action: 'CREATE_REQUEST',
  commandId: 'command-001',
  idempotencyKey: 'idempotency-001',
  correlationId: 'correlation-001',
  expectedStateVersion: '0',
  reason: 'Create an explicit logistics service request.',
} as const;

describe('service marketplace contract', () => {
  it('accepts a strict request command', () => {
    expect(normalizeServiceMarketplaceCommand({
      ...base,
      category: 'LOGISTICS',
      serviceStage: 'DELIVERY',
      subjectType: 'DEAL',
      subjectId: 'deal-001',
      description: 'Move the selected grain lot to the buyer.',
      targetRegion: 'Moscow',
    })).toMatchObject({ action: 'CREATE_REQUEST', expectedStateVersion: '0' });
  });

  it('rejects unknown fields', () => {
    expect(() => normalizeServiceMarketplaceCommand({ ...base, hiddenFee: '100' }))
      .toThrowError(ServiceMarketplaceValidationError);
  });

  it('accepts an exact rule-priced quote', () => {
    expect(normalizeServiceMarketplaceCommand({
      ...base,
      action: 'SUBMIT_QUOTE',
      expectedStateVersion: '1',
      quoteId: 'quote-001',
      serviceOfferingId: 'offering-001',
      serviceOfferingVersion: '2',
      quoteType: 'RULE_DECISION',
      commercialDecisionId: 'decision-001',
      amountKopecks: '125000',
      currency: 'RUB',
      payerMode: 'BUYER',
      termsHash: 'a'.repeat(64),
      expiresAt: '2026-09-06T10:00:00Z',
    })).toMatchObject({ quoteType: 'RULE_DECISION', amountKopecks: '125000' });
  });

  it.each(['-1', '1.5', '01', '9223372036854775808'])(
    'rejects non-canonical quote amount %s',
    (amountKopecks) => {
      expect(() => normalizeServiceMarketplaceCommand({
        ...base,
        action: 'SUBMIT_QUOTE',
        expectedStateVersion: '1',
        quoteId: 'quote-001',
        serviceOfferingId: 'offering-001',
        serviceOfferingVersion: '1',
        quoteType: 'MANUAL_QUOTE',
        commercialDecisionId: null,
        amountKopecks,
        currency: 'RUB',
        payerMode: 'REQUIRES_CONFIRMATION',
        termsHash: 'a'.repeat(64),
        expiresAt: '2026-09-06T10:00:00Z',
      })).toThrowError(/canonical PostgreSQL bigint/u);
    },
  );

  it('rejects a missing rule decision pin', () => {
    expect(() => normalizeServiceMarketplaceCommand({
      ...base,
      action: 'SUBMIT_QUOTE', expectedStateVersion: '1', quoteId: 'quote-001',
      serviceOfferingId: 'offering-001', serviceOfferingVersion: '1', quoteType: 'RULE_DECISION',
      commercialDecisionId: null, amountKopecks: '1', currency: 'RUB', payerMode: 'BUYER',
      termsHash: 'a'.repeat(64), expiresAt: '2026-09-06T10:00:00Z',
    })).toThrowError(/decision reference is incomplete/u);
  });

  it('rejects an impossible expiry date', () => {
    expect(() => normalizeServiceMarketplaceCommand({
      ...base,
      action: 'SUBMIT_QUOTE', expectedStateVersion: '1', quoteId: 'quote-001',
      serviceOfferingId: 'offering-001', serviceOfferingVersion: '1', quoteType: 'MANUAL_QUOTE',
      commercialDecisionId: null, amountKopecks: '1', currency: 'RUB', payerMode: 'BUYER',
      termsHash: 'a'.repeat(64), expiresAt: '2026-02-30T10:00:00Z',
    })).toThrowError(/real timestamp/u);
  });

  it('requires positive versions after request creation', () => {
    expect(() => normalizeServiceMarketplaceCommand({
      ...base,
      action: 'SELECT_PROVIDER',
      quoteId: 'quote-001',
    })).toThrowError(/positive version/u);
  });

  it('normalizes a distinct payer confirmation command', () => {
    expect(normalizeServiceMarketplaceCommand({
      ...base,
      action: 'CONFIRM_PAYER',
      expectedStateVersion: '4',
      payerAssignmentId: 'assignment-001',
    })).toMatchObject({ action: 'CONFIRM_PAYER', payerAssignmentId: 'assignment-001' });
  });

  it('normalizes a non-financial settlement reference command', () => {
    expect(normalizeServiceMarketplaceCommand({
      ...base,
      action: 'RECORD_SETTLEMENT',
      expectedStateVersion: '8',
      settlementReferenceType: 'SETTLEMENT_PLAN_PENDING',
      settlementReference: 'service:request-001',
    })).toMatchObject({ action: 'RECORD_SETTLEMENT' });
  });

  it('hashes object keys independently of insertion order', () => {
    expect(serviceMarketplaceDigest({ a: 1, b: 2 })).toBe(serviceMarketplaceDigest({ b: 2, a: 1 }));
  });
});
