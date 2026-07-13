import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { BankKeyRegistryService, BankKeyError } from '../../src/modules/settlement-engine/bank-key-registry.service';
import { BankReconciliationService } from '../../src/modules/bank-reconciliation/bank-reconciliation.service';
import { LedgerV2Service } from '../../src/modules/ledger/ledger-v2.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import {
  cleanTenant,
  createRememberedInstance as createInstance,
  destroyInstance,
  provisionDeal,
  type ServiceInstance,
} from './harness';

/**
 * Block 2 — Money & Ledger on real PostgreSQL.
 *
 * Proves:
 *  - bank signing keys rotate with overlapping windows; unknown, expired,
 *    not-yet-valid and revoked keys fail closed; revocation applies instantly
 *    across independent instances and cannot be undone;
 *  - statement import is idempotent (contentHash) and honest (no demo rows);
 *  - a reconciliation MISMATCH marks rows for manual review and moves no money;
 *  - statement evidence is immutable at the database level;
 *  - the deal escrow invariant holds through reserve/release and detects a
 *    forged release attempt.
 */

jest.setTimeout(120_000);

const ACCOUNTANT: RequestUser = {
  id: 'user-recon-accounting',
  email: 'recon-accounting@industrial-e2e.invalid',
  fullName: 'E2E Accounting',
  role: Role.ACCOUNTING,
  orgId: 'org-recon-e2e',
  tenantId: 'tenant-industrial-e2e',
  sessionId: 'session-recon-accounting',
  mfaVerified: true,
};

let alpha: ServiceInstance;
let registryA: BankKeyRegistryService;
let registryB: BankKeyRegistryService;
let prismaB: PrismaService;
let reconciliation: BankReconciliationService;
let ledger: LedgerV2Service;

async function purge(): Promise<void> {
  await alpha.prisma.$executeRawUnsafe(`SET session_replication_role = replica`);
  try {
    await alpha.prisma.$executeRawUnsafe(`DELETE FROM "bank_statement_entries"`);
    await alpha.prisma.$executeRawUnsafe(`DELETE FROM "reconciliation_runs"`);
    await alpha.prisma.$executeRawUnsafe(`DELETE FROM "reconciliation_cursors"`);
    await alpha.prisma.$executeRawUnsafe(`DELETE FROM "bank_key_revocations"`);
  } finally {
    await alpha.prisma.$executeRawUnsafe(`SET session_replication_role = DEFAULT`);
  }
}

// Synthetic low-entropy test material — real key delivery is env/secret-manager only.
const testSecret = (tag: string) => `${tag}-`.padEnd(40, 'x');

beforeAll(async () => {
  process.env.BANK_HMAC_KEYS = JSON.stringify([
    { keyId: 'rotation-old', secret: testSecret('old'), notAfter: '2099-01-01T00:00:00Z' },
    { keyId: 'rotation-new', secret: testSecret('new'), notBefore: '2020-01-01T00:00:00Z' },
    { keyId: 'rotation-future', secret: testSecret('future'), notBefore: '2099-01-01T00:00:00Z' },
    { keyId: 'rotation-expired', secret: testSecret('expired'), notAfter: '2020-01-01T00:00:00Z' },
    { keyId: 'rotation-compromised', secret: testSecret('compromised') },
  ]);
  process.env.BANK_HMAC_SECRET = testSecret('legacy-static');

  alpha = await createInstance();
  prismaB = new PrismaService();
  await prismaB.$connect();
  registryA = new BankKeyRegistryService(alpha.prisma);
  registryB = new BankKeyRegistryService(prismaB);
  reconciliation = new BankReconciliationService(alpha.prisma);
  ledger = new LedgerV2Service(alpha.prisma);
  await cleanTenant(alpha.prisma);
  await purge();
});

afterAll(async () => {
  await purge();
  await cleanTenant(alpha.prisma);
  await prismaB.$disconnect();
  await destroyInstance(alpha);
});

describe('Bank signing-key rotation and revocation', () => {
  it('accepts overlapping valid keys and the legacy key simultaneously', async () => {
    await expect(registryA.resolveActiveKey('safe-deals', 'rotation-old')).resolves.toMatchObject({ keyId: 'rotation-old' });
    await expect(registryA.resolveActiveKey('safe-deals', 'rotation-new')).resolves.toMatchObject({ keyId: 'rotation-new' });
    await expect(registryA.resolveActiveKey('safe-deals', 'primary')).resolves.toMatchObject({ keyId: 'primary' });
  });

  it('fails closed for unknown, not-yet-valid, expired and wrong-partner keys', async () => {
    await expect(registryA.resolveActiveKey('safe-deals', 'no-such-key')).rejects.toMatchObject({ rejection: 'UNKNOWN_KEY' });
    await expect(registryA.resolveActiveKey('safe-deals', 'rotation-future')).rejects.toMatchObject({ rejection: 'KEY_NOT_YET_VALID' });
    await expect(registryA.resolveActiveKey('safe-deals', 'rotation-expired')).rejects.toMatchObject({ rejection: 'KEY_EXPIRED' });
    await expect(registryA.resolveActiveKey('another-partner', 'rotation-new')).rejects.toMatchObject({ rejection: 'PARTNER_MISMATCH' });
    await expect(registryA.resolveActiveKey('safe-deals', 'no-such-key')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('applies revocation instantly on every instance and keeps it permanent', async () => {
    await expect(registryB.resolveActiveKey('safe-deals', 'rotation-compromised')).resolves.toBeDefined();

    await registryA.revoke('rotation-compromised', 'security-officer-1', 'key leak suspected');
    await expect(registryB.resolveActiveKey('safe-deals', 'rotation-compromised')).rejects.toMatchObject({ rejection: 'KEY_REVOKED' });

    await expect(
      alpha.prisma.$executeRawUnsafe(`DELETE FROM "bank_key_revocations" WHERE "keyId" = 'rotation-compromised'`),
    ).rejects.toThrow(/append-only/);
    await expect(
      alpha.prisma.$executeRawUnsafe(`UPDATE "bank_key_revocations" SET "reason" = 'undo' WHERE "keyId" = 'rotation-compromised'`),
    ).rejects.toThrow(/append-only/);

    const again = await registryA.revoke('rotation-compromised', 'security-officer-2', 'duplicate call');
    expect(again.keyId).toBe('rotation-compromised');
    expect(await registryB.resolveActiveKey('safe-deals', 'rotation-compromised').catch((e: BankKeyError) => e.rejection)).toBe('KEY_REVOKED');
  });
});

describe('Bank reconciliation with persisted cursor', () => {
  function statement(reference: string, amount: string, day = '260710'): string {
    return [
      ':60F:C260710RUB1000000,00',
      `:61:${day}${day.slice(2)}CRD${amount}NTRF${reference}`,
      ':86:Оплата по сделке | Плательщик: Тестовый покупатель | ИНН: 7700000001 | р/с: 40702810100000000001',
    ].join('\n');
  }

  it('imports honestly, deduplicates by content hash and persists the cursor', async () => {
    await purge();

    await expect(reconciliation.importMT940('это не выписка', ACCOUNTANT)).resolves.toMatchObject({ imported: 0 });

    const first = await reconciliation.importMT940(statement('REF-CURSOR-1', '1500,50'), ACCOUNTANT);
    expect(first).toMatchObject({ imported: 1, duplicates: 0, unmatched: 1 });

    const second = await reconciliation.importMT940(statement('REF-CURSOR-1', '1500,50'), ACCOUNTANT);
    expect(second).toMatchObject({ imported: 0, duplicates: 1 });

    const cursor = await alpha.prisma.reconciliationCursor.findUnique({ where: { source: 'MT940' } });
    expect(cursor?.lastRunId).toBe(second.runId);
    expect(cursor?.lastValueDate?.toISOString().slice(0, 10)).toBe('2026-07-10');

    const entries = await alpha.prisma.bankStatementEntry.findMany({ where: { reference: 'REF-CURSOR-1' } });
    expect(entries).toHaveLength(1);
    expect(BigInt(entries[0].amountKopecks)).toBe(150_050n);
  });

  it('matches platform-issued bank operations exactly and records mismatches without touching money', async () => {
    await purge();
    const fixture = await provisionDeal(alpha.prisma, 'recon1', 240_000_000n);

    await alpha.prisma.bankOperation.create({
      data: {
        id: `bank-reserve:${fixture.dealId}`,
        dealId: fixture.dealId,
        type: 'RESERVE',
        status: 'DONE',
        amountKopecks: 240_000_000n,
        debitAccount: `buyer:${fixture.buyerOrgId}`,
        creditAccount: `escrow:${fixture.dealId}`,
        bankRef: 'REF-RECON-EXACT',
        idempotencyKey: `bank-reserve:${fixture.dealId}`,
      },
    });
    const paymentBefore = await alpha.prisma.payment.findMany({ where: { dealId: fixture.dealId } });
    const dealBefore = await alpha.prisma.deal.findUniqueOrThrow({ where: { id: fixture.dealId } });

    const matchedRun = await reconciliation.importMT940(statement('REF-RECON-EXACT', '2400000,00'), ACCOUNTANT);
    expect(matchedRun).toMatchObject({ imported: 1, matched: 1, mismatched: 0 });

    const mismatchRun = await reconciliation.importMT940(
      statement('REF-RECON-EXACT', '2399999,99', '260711'),
      ACCOUNTANT,
    );
    expect(mismatchRun).toMatchObject({ imported: 1, mismatched: 1 });
    const run = await alpha.prisma.reconciliationRun.findUniqueOrThrow({ where: { id: mismatchRun.runId } });
    expect(run.status).toBe('MANUAL_REVIEW_REQUIRED');

    const mismatchEntry = await alpha.prisma.bankStatementEntry.findFirstOrThrow({ where: { matchStatus: 'MISMATCH' } });
    expect(mismatchEntry.matchedDealId).toBe(fixture.dealId);
    expect(mismatchEntry.mismatchReason).toContain('не совпадает');

    const paymentAfter = await alpha.prisma.payment.findMany({ where: { dealId: fixture.dealId } });
    const dealAfter = await alpha.prisma.deal.findUniqueOrThrow({ where: { id: fixture.dealId } });
    const ledgerEntries = await alpha.prisma.ledgerEntry.count({ where: { dealId: fixture.dealId } });
    expect(paymentAfter).toEqual(paymentBefore);
    expect(dealAfter.status).toBe(dealBefore.status);
    expect(dealAfter.version).toBe(dealBefore.version);
    expect(ledgerEntries).toBe(0);
  });

  it('keeps imported statement rows immutable at the database level', async () => {
    const entry = await alpha.prisma.bankStatementEntry.findFirstOrThrow();
    await expect(
      alpha.prisma.$executeRawUnsafe(
        `UPDATE "bank_statement_entries" SET "amountKopecks" = 1 WHERE "id" = '${entry.id}'`,
      ),
    ).rejects.toThrow(/immutable/);
    await expect(
      alpha.prisma.$executeRawUnsafe(`DELETE FROM "bank_statement_entries" WHERE "id" = '${entry.id}'`),
    ).rejects.toThrow(/append-only/);
    await expect(
      alpha.prisma.bankStatementEntry.update({
        where: { id: entry.id },
        data: { matchStatus: 'MANUAL', matchedByUserId: 'operator-1', matchedAt: new Date() },
      }),
    ).resolves.toMatchObject({ matchStatus: 'MANUAL' });
  });

  it('denies mutation to read-only and unrelated roles', async () => {
    const executive = { ...ACCOUNTANT, role: Role.EXECUTIVE };
    const farmer = { ...ACCOUNTANT, role: Role.FARMER };
    await expect(reconciliation.importMT940(statement('REF-DENY', '1,00'), executive)).rejects.toMatchObject({ status: 403 });
    await expect(reconciliation.importMT940(statement('REF-DENY', '1,00'), farmer)).rejects.toMatchObject({ status: 403 });
    await expect(reconciliation.getReport(executive)).resolves.toBeDefined();
  });
});

describe('Deal escrow invariant from the append-only ledger', () => {
  it('holds through reserve/release and exposes a forged over-release', async () => {
    const dealId = `DEAL-E2E-escrow-${Date.now()}`;

    await alpha.prisma.ledgerEntry.create({
      data: {
        dealId,
        entryType: 'RESERVE',
        debitAccount: 'buyer:org-x',
        creditAccount: `escrow:${dealId}`,
        amountKopecks: 1_000_000n,
        idempotencyKey: `inv-reserve:${dealId}`,
      },
    });
    await alpha.prisma.ledgerEntry.create({
      data: {
        dealId,
        entryType: 'RELEASE',
        debitAccount: `escrow:${dealId}`,
        creditAccount: 'seller:org-y',
        amountKopecks: 990_000n,
        idempotencyKey: `inv-release:${dealId}`,
      },
    });
    await alpha.prisma.ledgerEntry.create({
      data: {
        dealId,
        entryType: 'COMMISSION',
        debitAccount: `escrow:${dealId}`,
        creditAccount: 'sys:platform',
        amountKopecks: 10_000n,
        idempotencyKey: `inv-commission:${dealId}`,
      },
    });

    const healthy = await ledger.verifyDealEscrowInvariant(dealId);
    expect(healthy).toMatchObject({ ok: true, escrowBalanceKopecks: 0n });

    await alpha.prisma.ledgerEntry.create({
      data: {
        dealId,
        entryType: 'RELEASE',
        debitAccount: `escrow:${dealId}`,
        creditAccount: 'seller:org-y',
        amountKopecks: 1n,
        idempotencyKey: `inv-forged:${dealId}`,
      },
    });
    const violated = await ledger.verifyDealEscrowInvariant(dealId);
    expect(violated.ok).toBe(false);
    expect(violated.escrowBalanceKopecks).toBe(-1n);
  });
});
