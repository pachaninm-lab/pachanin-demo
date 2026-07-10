import { randomUUID, createHmac } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { OutboxRepository } from '../../src/common/outbox/outbox.repository';
import { BankReconciliationService } from '../../src/modules/bank-reconciliation/bank-reconciliation.service';
import { BankCallbackKeyService } from '../../src/modules/settlement-engine/bank-callback-key.service';
import { buildBankSignaturePayload } from '../../src/modules/settlement-engine/bank-callback-signature';
import { RequestUser, Role } from '../../src/common/types/request-user';

const ADMIN_URL = String(process.env.ONE_DEAL_ADMIN_URL ?? '');
const APP_URL = String(process.env.DATABASE_URL ?? '');

function prisma(url: string): PrismaService {
  return new PrismaService({ datasources: { db: { url } } });
}

const adminUser: RequestUser = {
  id: 'admin-e2e',
  email: 'admin-e2e@example.test',
  orgId: 'org-admin-e2e',
  tenantId: 'tenant-canonical',
  sessionId: 'session-admin-e2e',
  role: Role.ADMIN,
  mfaVerified: true,
};

describe('durable financial delivery boundary', () => {
  const admin = prisma(ADMIN_URL);
  const adminB = prisma(ADMIN_URL);
  const appA = prisma(APP_URL);
  const appB = prisma(APP_URL);
  const adminOutbox = new OutboxRepository(admin);
  const adminOutboxB = new OutboxRepository(adminB);
  const appOutboxA = new OutboxRepository(appA);
  const appOutboxB = new OutboxRepository(appB);
  const reconciliation = new BankReconciliationService(admin);
  const rls = new RlsTransactionService(appA);
  const callbackKeys = new BankCallbackKeyService(appA, rls);

  beforeAll(async () => {
    if (!ADMIN_URL || !APP_URL) throw new Error('ONE_DEAL_ADMIN_URL and DATABASE_URL are required.');
    await Promise.all([admin.$connect(), adminB.$connect()]);
    await admin.$executeRawUnsafe('GRANT USAGE ON SCHEMA delivery, reconciliation, finance_security TO one_deal_app');
    await admin.$executeRawUnsafe('REVOKE ALL ON ALL TABLES IN SCHEMA delivery FROM one_deal_app');
    await admin.$executeRawUnsafe('REVOKE ALL ON ALL SEQUENCES IN SCHEMA delivery FROM one_deal_app');
    await admin.$executeRawUnsafe('REVOKE ALL ON ALL TABLES IN SCHEMA reconciliation FROM one_deal_app');
    await admin.$executeRawUnsafe('REVOKE ALL ON ALL SEQUENCES IN SCHEMA reconciliation FROM one_deal_app');
    await admin.$executeRawUnsafe('REVOKE ALL ON ALL TABLES IN SCHEMA finance_security FROM one_deal_app');
    await admin.$executeRawUnsafe('REVOKE ALL ON ALL SEQUENCES IN SCHEMA finance_security FROM one_deal_app');
    await admin.$executeRawUnsafe(`
      GRANT EXECUTE ON FUNCTION
        delivery.claim_outbox_batch(TEXT,INTEGER,INTEGER),
        delivery.complete_outbox_claim(TEXT,TEXT),
        delivery.fail_outbox_claim(TEXT,TEXT,TEXT,TEXT),
        delivery.manual_requeue_outbox(TEXT,TEXT,TEXT),
        reconciliation.record_statement_batch(TEXT,TEXT,TEXT,TEXT,JSONB),
        reconciliation.record_manual_match(TEXT,TEXT,TEXT,TEXT),
        reconciliation.list_statement_records(TEXT,TIMESTAMPTZ,TIMESTAMPTZ,BOOLEAN,INTEGER,INTEGER),
        reconciliation.get_reconciliation_checkpoint(TEXT),
        reconciliation.get_reconciliation_report(TEXT,TIMESTAMPTZ,TIMESTAMPTZ),
        finance_security.register_bank_callback_key(TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT),
        finance_security.revoke_bank_callback_key(TEXT,TEXT,TEXT,TEXT),
        finance_security.resolve_bank_callback_key(TEXT,TEXT,TIMESTAMPTZ),
        finance_security.list_bank_callback_keys(TEXT)
      TO one_deal_app
    `);
    await Promise.all([appA.$connect(), appB.$connect()]);
  });

  afterAll(async () => {
    await Promise.allSettled([
      admin.$disconnect(),
      adminB.$disconnect(),
      appA.$disconnect(),
      appB.$disconnect(),
    ]);
  });

  it('deduplicates concurrent enqueue and rejects idempotency payload mismatch', async () => {
    const suffix = randomUUID();
    const input = {
      type: 'BANK_RESERVE_REQUEST',
      dealId: 'DEAL-INDUSTRIAL-001',
      payload: { dealId: 'DEAL-INDUSTRIAL-001', suffix },
      idempotencyKey: `e2e-outbox-duplicate:${suffix}`,
      maxRetries: 3,
    } as const;
    const [first, second] = await Promise.all([
      adminOutbox.enqueue(input),
      adminOutboxB.enqueue(input),
    ]);
    expect(first.id).toBe(second.id);
    const count = await admin.outboxEntry.count({ where: { idempotencyKey: input.idempotencyKey } });
    expect(count).toBe(1);
    await expect(adminOutbox.enqueue({
      ...input,
      payload: { dealId: 'DEAL-INDUSTRIAL-001', suffix, changed: true },
    })).rejects.toThrow('OUTBOX_IDEMPOTENCY_PAYLOAD_MISMATCH');
  });

  it('coordinates two workers with non-overlapping SKIP LOCKED claims', async () => {
    const suffix = randomUUID();
    await Promise.all(Array.from({ length: 20 }, (_, index) => adminOutbox.enqueue({
      type: 'BANK_RESERVE_REQUEST',
      dealId: 'DEAL-INDUSTRIAL-001',
      payload: { dealId: 'DEAL-INDUSTRIAL-001', index, suffix },
      idempotencyKey: `e2e-outbox-workers:${suffix}:${index}`,
      maxRetries: 3,
    })));

    const [left, right] = await Promise.all([
      appOutboxA.claimBatch(`worker-a-${suffix}`, 10, 30),
      appOutboxB.claimBatch(`worker-b-${suffix}`, 10, 30),
    ]);
    const ids = [...left, ...right].map((item) => item.id);
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
    await Promise.all([...left, ...right].map((item) => appOutboxA.completeClaim(item.id, item.claimToken)));
    const sentCount = await admin.outboxEntry.count({
      where: { id: { in: ids }, status: 'SENT' },
    });
    expect(sentCount).toBe(20);
  });

  it('recovers an expired lease and rejects the stale acknowledgement', async () => {
    const suffix = randomUUID();
    const entry = await adminOutbox.enqueue({
      type: 'BANK_RELEASE_REQUEST',
      dealId: 'DEAL-INDUSTRIAL-001',
      payload: { dealId: 'DEAL-INDUSTRIAL-001', suffix },
      idempotencyKey: `e2e-outbox-expired:${suffix}`,
      maxRetries: 3,
    });
    const first = (await appOutboxA.claimBatch(`worker-first-${suffix}`, 1, 30))
      .find((item) => item.id === entry.id);
    expect(first).toBeDefined();
    await admin.$executeRaw(Prisma.sql`
      UPDATE delivery.outbox_claims
      SET claim_expires_at = clock_timestamp() - interval '1 second',
          updated_at = clock_timestamp()
      WHERE outbox_id = ${entry.id}
    `);
    const second = (await appOutboxB.claimBatch(`worker-second-${suffix}`, 10, 30))
      .find((item) => item.id === entry.id);
    expect(second).toBeDefined();
    expect(second!.claimToken).not.toBe(first!.claimToken);
    await expect(appOutboxA.completeClaim(entry.id, first!.claimToken)).resolves.toBe(false);
    await expect(appOutboxB.completeClaim(entry.id, second!.claimToken)).resolves.toBe(true);
  });

  it('persists retry, DEAD and manual requeue without deleting lease evidence', async () => {
    const suffix = randomUUID();
    const entry = await adminOutbox.enqueue({
      type: 'BANK_RELEASE_REQUEST',
      dealId: 'DEAL-INDUSTRIAL-001',
      payload: { dealId: 'DEAL-INDUSTRIAL-001', suffix },
      idempotencyKey: `e2e-outbox-dead:${suffix}`,
      maxRetries: 2,
    });
    const first = (await appOutboxA.claimBatch(`worker-retry-${suffix}`, 50, 30))
      .find((item) => item.id === entry.id)!;
    await expect(appOutboxA.failClaim(entry.id, first.claimToken, 'broker_down', 'first failure'))
      .resolves.toMatchObject({ status: 'RETRY', retryCount: 1 });
    await admin.outboxEntry.update({ where: { id: entry.id }, data: { nextRetryAt: new Date(0) } });
    const second = (await appOutboxB.claimBatch(`worker-dead-${suffix}`, 50, 30))
      .find((item) => item.id === entry.id)!;
    await expect(appOutboxB.failClaim(entry.id, second.claimToken, 'broker_down', 'second failure'))
      .resolves.toMatchObject({ status: 'DEAD', retryCount: 2 });
    await expect(appOutboxA.manualRequeue(entry.id, 'admin-e2e', 'review complete')).resolves.toBe(true);
    const persisted = await admin.outboxEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(persisted.status).toBe('RETRY');
    const attempts = await admin.$queryRaw<Array<{ outcome: string }>>(Prisma.sql`
      SELECT outcome FROM delivery.outbox_attempts WHERE outbox_id = ${entry.id} ORDER BY id
    `);
    expect(attempts.map((item) => item.outcome)).toEqual(['RETRY', 'DEAD', 'MANUAL_REQUEUE']);
    const leaseCount = await admin.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS count FROM delivery.outbox_claims WHERE outbox_id = ${entry.id}
    `);
    expect(leaseCount[0].count).toBe(1n);
  });

  it('imports reconciliation once, preserves cursor evidence and never mutates money on mismatch', async () => {
    const suffix = randomUUID().replace(/-/g, '');
    const partnerId = `safe-deals-${suffix.slice(0, 12)}`;
    const bankRef = `e2e-bank-ref-${suffix}`;
    const payment = await admin.payment.findFirstOrThrow({ where: { dealId: 'DEAL-INDUSTRIAL-001' } });
    await admin.payment.update({
      where: { id: payment.id },
      data: { bankRef, amountRub: 100 },
    });
    const statement = mt940(bankRef, '100,00', suffix);
    const first = await reconciliation.importMT940(statement, adminUser, {
      partnerId,
      cursor: 'cursor-1',
    });
    expect(first).toMatchObject({ duplicate: false, imported: 1, matched: 1, mismatch: 0 });
    const duplicate = await reconciliation.importMT940(statement, adminUser, {
      partnerId,
      cursor: 'cursor-1',
    });
    expect(duplicate.duplicate).toBe(true);

    const mismatched = await reconciliation.importMT940(mt940(bankRef, '90,00', `${suffix}-mismatch`), adminUser, {
      partnerId,
      cursor: 'cursor-2',
    });
    expect(mismatched).toMatchObject({ matched: 0, mismatch: 1 });
    const paymentAfter = await admin.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paymentAfter.amountRub).toBe(100);
    const unmatched = await reconciliation.listUnmatched(adminUser, { partnerId });
    expect(unmatched.some((item) => item.mismatchCode === 'AMOUNT_MISMATCH')).toBe(true);
    const report = await reconciliation.getReport(adminUser, { partnerId });
    expect(report).toMatchObject({ totalImported: 2, totalMatched: 1, totalUnmatched: 1, batchCount: 2 });
  });

  it('blocks cursor collision with different statement evidence', async () => {
    const suffix = randomUUID().replace(/-/g, '');
    const partnerId = `collision-${suffix.slice(0, 12)}`;
    await reconciliation.importMT940(mt940(`unknown-${suffix}`, '10,00', suffix), adminUser, {
      partnerId,
      cursor: 'same-cursor',
    });
    await expect(reconciliation.importMT940(mt940(`unknown-${suffix}`, '11,00', `${suffix}-changed`), adminUser, {
      partnerId,
      cursor: 'same-cursor',
    })).rejects.toThrow();
  });

  it('supports overlapping callback keys and rejects future, expired and revoked keys', async () => {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
    const partnerId = `partner-${suffix}`;
    const now = new Date();
    const secretRefV1 = `BANK_E2E_${suffix.toUpperCase()}_V1`;
    const secretRefV2 = `BANK_E2E_${suffix.toUpperCase()}_V2`;
    const secretV1 = '1'.repeat(64);
    const secretV2 = '2'.repeat(64);
    process.env[secretRefV1] = secretV1;
    process.env[secretRefV2] = secretV2;

    await callbackKeys.registerKey({
      partnerId,
      keyId: 'v1',
      secretRef: secretRefV1,
      validFrom: new Date(now.getTime() - 60_000).toISOString(),
      validUntil: new Date(now.getTime() + 600_000).toISOString(),
    }, adminUser);
    await callbackKeys.registerKey({
      partnerId,
      keyId: 'v2',
      secretRef: secretRefV2,
      validFrom: new Date(now.getTime() - 30_000).toISOString(),
      validUntil: new Date(now.getTime() + 900_000).toISOString(),
    }, adminUser);

    await expect(verify(callbackKeys, partnerId, 'v1', secretV1, now)).resolves.toMatchObject({ keyId: 'v1' });
    await expect(verify(callbackKeys, partnerId, 'v2', secretV2, now)).resolves.toMatchObject({ keyId: 'v2' });

    await callbackKeys.registerKey({
      partnerId,
      keyId: 'future',
      secretRef: secretRefV2,
      validFrom: new Date(now.getTime() + 600_000).toISOString(),
    }, adminUser);
    await expect(verify(callbackKeys, partnerId, 'future', secretV2, now)).rejects.toMatchObject({ status: 401 });

    await callbackKeys.registerKey({
      partnerId,
      keyId: 'expired',
      secretRef: secretRefV2,
      validFrom: new Date(now.getTime() - 600_000).toISOString(),
      validUntil: new Date(now.getTime() - 60_000).toISOString(),
    }, adminUser);
    await expect(verify(callbackKeys, partnerId, 'expired', secretV2, now)).rejects.toMatchObject({ status: 401 });

    await callbackKeys.revokeKey(partnerId, 'v1', 'rotation completed', adminUser);
    await expect(verify(callbackKeys, partnerId, 'v1', secretV1, now)).rejects.toMatchObject({ status: 401 });
  });

  it('keeps delivery, reconciliation and callback-key tables unreadable to the app role', async () => {
    await expect(appA.$queryRaw(Prisma.sql`SELECT count(*) FROM delivery.outbox_attempts`)).rejects.toThrow();
    await expect(appA.$queryRaw(Prisma.sql`SELECT count(*) FROM reconciliation.statement_records`)).rejects.toThrow();
    await expect(appA.$queryRaw(Prisma.sql`SELECT count(*) FROM finance_security.bank_callback_keys`)).rejects.toThrow();

    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(appOutboxA.onModuleInit()).resolves.toBeUndefined();
      await expect(new BankReconciliationService(appA).onModuleInit()).resolves.toBeUndefined();
      await expect(callbackKeys.onModuleInit()).resolves.toBeUndefined();
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });
});

function mt940(reference: string, amount: string, statementId: string): string {
  return [
    `:20:${statementId}`,
    ':60F:C260710RUB0,00',
    `:61:260710C${amount}NTRF${reference}`,
    ':86:INN 1234567890 grain settlement',
    `:62F:C260710RUB${amount}`,
  ].join('\n');
}

async function verify(
  service: BankCallbackKeyService,
  partnerId: string,
  keyId: string,
  secret: string,
  now: Date,
) {
  const timestamp = Math.floor(now.getTime() / 1000);
  const body = {
    dealId: 'DEAL-INDUSTRIAL-001',
    eventId: `event-${keyId}-${timestamp}`,
    operation: 'RESERVE',
    operationId: 'bank-reserve:DEAL-INDUSTRIAL-001',
    status: 'SUCCESS',
  };
  const payload = buildBankSignaturePayload({
    partnerId,
    keyId,
    timestamp,
    eventId: body.eventId,
    body,
  });
  const signature = `hmac-sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  return service.verifyCallback({
    partnerId,
    keyId,
    timestampHeader: String(timestamp),
    eventIdHeader: body.eventId,
    signature,
    body,
    now,
  });
}
