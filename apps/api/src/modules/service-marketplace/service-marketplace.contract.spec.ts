import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Role } from '../../common/types/request-user';
import { ServiceMarketplaceController } from './service-marketplace.controller';
import { ServiceMarketplaceRepository } from './service-marketplace.repository';
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

describe('service marketplace HTTP command boundary', () => {
  let app: INestApplication;
  const user = { id: 'actor-one', email: 'actor@example.invalid', role: Role.ADMIN, orgId: 'org-one', tenantId: 'tenant-one', sessionId: 'session-one' };
  const execute = jest.fn(async (_user, command) => {
    // Exercise the same normalization used at repository admission.
    normalizeServiceMarketplaceCommand(command);
    return { stateVersion: '1', createsFinancialObligation: false };
  });
  const body = {
    commandId: base.commandId, idempotencyKey: base.idempotencyKey, correlationId: base.correlationId, reason: base.reason,
    category: 'LOGISTICS', serviceStage: 'DELIVERY', subjectType: 'DEAL', subjectId: 'deal-001',
    description: 'Move the selected grain lot to the buyer.', targetRegion: 'Moscow',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ServiceMarketplaceController],
      providers: [{ provide: ServiceMarketplaceRepository, useValue: { execute } }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: { user?: typeof user }, _res: unknown, next: () => void) => { req.user = user; next(); });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });
  beforeEach(() => execute.mockClear());
  afterAll(async () => { await app?.close(); });

  it.each(['hiddenFee', 'verified', 'providerId', 'tenantId', 'organizationId', 'status', 'createsFinancialObligation', 'requestId', 'action', 'expectedStateVersion'])('rejects supplied %s before execution', async (field) => {
    const rejectedByDto = !['hiddenFee', 'verified', 'providerId'].includes(field);
    const response = await request(app.getHttpServer()).post('/api/service-marketplace/request-001/create-request')
      .set('If-Match', '"0"').send({ ...body, [field]: 'forged' }).expect(rejectedByDto ? 400 : 422);
    if (rejectedByDto) expect(response.body.message).toEqual(expect.arrayContaining([expect.any(String)]));
    else expect(response.body.code).toBe('SERVICE_COMMAND_UNKNOWN_FIELD');
    expect(execute).not.toHaveBeenCalled();
  });

  it('accepts a valid HTTP command with path identity and If-Match authority', async () => {
    const response = await request(app.getHttpServer()).post('/api/service-marketplace/request-001/create-request')
      .set('If-Match', '"0"').send(body).expect(201);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(user, { ...body, requestId: 'request-001', action: 'CREATE_REQUEST', expectedStateVersion: '0' });
    expect(response.headers.etag).toBe('"1"');
    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  it('retains global DTO validation before command admission', async () => {
    await request(app.getHttpServer()).post('/api/service-marketplace/request-001/create-request')
      .set('If-Match', '"0"').send({ ...body, commandId: '!' }).expect(400);
    expect(execute).not.toHaveBeenCalled();
  });
});
