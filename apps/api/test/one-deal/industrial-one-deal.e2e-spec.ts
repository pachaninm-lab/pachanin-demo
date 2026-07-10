import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import request from 'supertest';

type Workspace = {
  deal: { id: string; status: string; updatedAt: string };
};

const DEAL_ID = 'DEAL-INDUSTRIAL-001';
const TEST_PASSWORD = 'demo1234';
const BANK_SECRET = 'one-deal-e2e-bank-secret';
const BANK_PARTNER_ID = 'safe-deals';
const BANK_KEY_ID = 'primary';

const roleEmails = {
  compliance: 'compliance@demo.ru',
  seller: 'farmer@demo.ru',
  buyer: 'buyer@demo.ru',
  accounting: 'accounting@demo.ru',
  logistics: 'logistician@demo.ru',
  driver: 'driver@demo.ru',
  elevator: 'elevator@demo.ru',
  surveyor: 'surveyor@demo.ru',
  lab: 'lab@demo.ru',
  operator: 'operator@demo.ru',
  arbitrator: 'arbitrator@demo.ru',
  executive: 'executive@demo.ru',
} as const;

const steps = [
  ['approve_admission', 'compliance'],
  ['publish_auction', 'seller'],
  ['place_winning_bid', 'buyer'],
  ['seller_sign_contract', 'seller'],
  ['buyer_sign_contract', 'buyer'],
  ['request_reserve', 'accounting'],
  ['confirm_reserve', 'BANK_CALLBACK'],
  ['assign_logistics', 'logistics'],
  ['confirm_loading', 'driver'],
  ['start_transit', 'driver'],
  ['confirm_arrival', 'driver'],
  ['confirm_weight', 'elevator'],
  ['confirm_inspection', 'surveyor'],
  ['finalize_lab', 'lab'],
  ['accept_delivery', 'buyer'],
  ['complete_documents', 'seller'],
  ['request_release', 'accounting'],
  ['confirm_release', 'BANK_CALLBACK'],
  ['close_deal', 'operator'],
] as const;

function payload(actionId: string): Record<string, unknown> {
  if (actionId === 'assign_logistics') {
    return {
      carrierOrgId: 'org-canonical-logistics',
      driverUserId: 'user-driver-001',
      driverName: 'Тестовый водитель',
      vehicleNumber: 'А001АА77',
      routeFrom: 'Склад продавца',
      routeTo: 'Элеватор покупателя',
    };
  }
  if (actionId === 'confirm_loading') return { loadedTons: 150 };
  if (actionId === 'confirm_arrival') return { lat: 52.7212, lng: 41.4523 };
  if (actionId === 'confirm_weight') return { weightActualTons: 149.6 };
  if (actionId === 'finalize_lab') return { moisture: 12.4, protein: 13.2, gost: 'ГОСТ 9353-2016' };
  return {};
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function signBankCallback(body: Record<string, unknown>, timestamp: number, eventId: string): string {
  const bodyHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(body)))
    .digest('hex');
  const signedPayload = [
    'POST',
    '/api/settlement-engine/bank-callback',
    BANK_PARTNER_ID,
    BANK_KEY_ID,
    String(timestamp),
    eventId,
    bodyHash,
  ].join('\n');
  return `hmac-sha256=${crypto.createHmac('sha256', BANK_SECRET).update(signedPayload).digest('hex')}`;
}

describe('Industrial one-deal PostgreSQL E2E', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const tokens = new Map<string, string>();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'one-deal-e2e-jwt-secret-at-least-32-characters';
    process.env.BANK_HMAC_SECRET = BANK_SECRET;
    process.env.BANK_PARTNER_ID = BANK_PARTNER_ID;
    process.env.BANK_HMAC_KEY_ID = BANK_KEY_ID;
    process.env.SEED_DEMO_USERS = 'true';
    process.env.SEED_CANONICAL_TEST_DEAL = 'true';
    process.env.ENABLE_PUBLIC_RUNTIME_READS = 'false';
    process.env.ENABLE_PUBLIC_RUNTIME_MUTATIONS = 'false';

    const { AppModule } = require('../../src/app.module') as typeof import('../../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = new PrismaClient();
    await prisma.$connect();

    for (const [role, email] of Object.entries(roleEmails)) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: TEST_PASSWORD })
        .expect(201);
      expect(response.body.accessToken).toEqual(expect.any(String));
      tokens.set(role, response.body.accessToken);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function workspace(role: keyof typeof roleEmails): Promise<Workspace> {
    const response = await request(app.getHttpServer())
      .get(`/api/deals/${DEAL_ID}/execution-workspace`)
      .set('Authorization', `Bearer ${tokens.get(role)}`)
      .expect(200);
    return response.body as Workspace;
  }

  async function executeUser(actionId: string, role: keyof typeof roleEmails): Promise<void> {
    const before = await workspace(role);
    const commandId = crypto.randomUUID();
    const response = await request(app.getHttpServer())
      .post(`/api/deals/${DEAL_ID}/commands/${actionId}`)
      .set('Authorization', `Bearer ${tokens.get(role)}`)
      .send({
        commandId,
        idempotencyKey: `${DEAL_ID}:${actionId}:${commandId}`,
        expectedUpdatedAt: before.deal.updatedAt,
        payload: payload(actionId),
      })
      .expect(201);
    expect(response.body.ok).toBe(true);
  }

  async function executeBank(operation: 'RESERVE' | 'RELEASE'): Promise<void> {
    const eventId = `bank-${operation.toLowerCase()}-${crypto.randomUUID()}`;
    const operationId = operation === 'RESERVE'
      ? `bank-reserve:${DEAL_ID}`
      : `bank-release:${DEAL_ID}`;
    const body = {
      dealId: DEAL_ID,
      eventId,
      operation,
      operationId,
      status: 'CONFIRMED',
      bankRef: `e2e-${operation.toLowerCase()}-${crypto.randomUUID()}`,
    };
    const timestamp = Math.floor(Date.now() / 1000);
    await request(app.getHttpServer())
      .post('/api/settlement-engine/bank-callback')
      .set('X-Bank-Partner-Id', BANK_PARTNER_ID)
      .set('X-Bank-Key-Id', BANK_KEY_ID)
      .set('X-Bank-Event-Id', eventId)
      .set('X-Bank-Timestamp', String(timestamp))
      .set('X-Bank-Signature', signBankCallback(body, timestamp, eventId))
      .send(body)
      .expect(200);
  }

  it('exposes one factual DRAFT deal to all 12 human roles', async () => {
    const snapshots = await Promise.all(
      (Object.keys(roleEmails) as Array<keyof typeof roleEmails>).map((role) => workspace(role)),
    );
    expect(new Set(snapshots.map((item) => item.deal.id))).toEqual(new Set([DEAL_ID]));
    expect(new Set(snapshots.map((item) => item.deal.status))).toEqual(new Set(['DRAFT']));
  });

  it('executes all 19 commands and closes the same deal', async () => {
    for (const [actionId, actor] of steps) {
      if (actor === 'BANK_CALLBACK') {
        await executeBank(actionId === 'confirm_reserve' ? 'RESERVE' : 'RELEASE');
      } else {
        await executeUser(actionId, actor);
      }
    }

    const finalSnapshots = await Promise.all(
      (Object.keys(roleEmails) as Array<keyof typeof roleEmails>).map((role) => workspace(role)),
    );
    expect(new Set(finalSnapshots.map((item) => item.deal.status))).toEqual(new Set(['CLOSED']));

    const deal = await prisma.deal.findUnique({ where: { id: DEAL_ID } });
    const payment = await prisma.payment.findUnique({ where: { id: `payment:${DEAL_ID}` } });
    const events = await prisma.dealEvent.count({ where: { dealId: DEAL_ID } });
    const bankOperations = await prisma.bankOperation.count({ where: { dealId: DEAL_ID } });
    const documents = await prisma.dealDocument.count({ where: { dealId: DEAL_ID } });
    const shipments = await prisma.shipment.count({ where: { dealId: DEAL_ID } });
    const acceptance = await prisma.acceptanceRecord.count({ where: { dealId: DEAL_ID } });
    const labSamples = await prisma.labSample.count({ where: { dealId: DEAL_ID } });

    expect(deal?.status).toBe('CLOSED');
    expect(payment?.status).toBe('RELEASED');
    expect(events).toBeGreaterThanOrEqual(19);
    expect(bankOperations).toBeGreaterThanOrEqual(2);
    expect(documents).toBeGreaterThan(0);
    expect(shipments).toBeGreaterThan(0);
    expect(acceptance).toBeGreaterThan(0);
    expect(labSamples).toBeGreaterThan(0);
  });

  it('rejects arbitrary status mutation for the canonical deal', async () => {
    await request(app.getHttpServer())
      .patch(`/api/deals/${DEAL_ID}/status`)
      .set('Authorization', `Bearer ${tokens.get('operator')}`)
      .send({ status: 'DRAFT' })
      .expect(400);
  });
});
