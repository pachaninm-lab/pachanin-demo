import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { BankReconciliationService } from './bank-reconciliation.service';

const admin: RequestUser = {
  id: 'admin-1',
  email: 'admin@example.test',
  orgId: 'org-admin',
  tenantId: 'tenant-admin',
  sessionId: 'session-admin',
  role: Role.ADMIN,
  mfaVerified: true,
};

const executive: RequestUser = { ...admin, id: 'executive-1', role: Role.EXECUTIVE };

const validStatement = [
  ':20:STATEMENT-001',
  ':60F:C260710RUB0,00',
  ':61:260710C100,00NTRFbank-reserve:DEAL-001',
  ':86:INN 1234567890 payment for grain',
  ':62F:C260710RUB100,00',
].join('\n');

function setup(input?: { amountRub?: number; paymentCount?: number }) {
  const paymentCount = input?.paymentCount ?? 1;
  const paymentRows = Array.from({ length: paymentCount }, (_, index) => ({
    id: `payment-${index + 1}`,
    dealId: `DEAL-${index + 1}`,
    amountRub: input?.amountRub ?? 100,
  }));
  const prisma = {
    payment: {
      findMany: jest.fn().mockResolvedValue(paymentRows),
    },
    $queryRaw: jest.fn().mockResolvedValue([{
      batch_id: 'batch-1',
      duplicate: false,
      imported_count: 1,
      matched_count: input?.amountRub === 90 ? 0 : 1,
      mismatch_count: input?.amountRub === 90 ? 1 : 0,
      checkpoint_version: 1n,
    }]),
  } as unknown as jest.Mocked<PrismaService>;
  return { prisma, service: new BankReconciliationService(prisma) };
}

function queryValues(mock: jest.Mock): unknown[] {
  const sql = mock.mock.calls.at(-1)?.[0] as { values?: unknown[] } | undefined;
  return sql?.values ?? [];
}

describe('BankReconciliationService', () => {
  it('rejects invalid input instead of manufacturing a mock payment', async () => {
    const { service, prisma } = setup();
    await expect(service.importMT940('not a statement', admin, {
      partnerId: 'safe-deals',
      cursor: 'cursor-1',
    })).rejects.toThrow(/MT940_REQUIRED_TAGS_MISSING/);
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('imports strict MT940 with exact reference and amount matching', async () => {
    const { service, prisma } = setup();
    await expect(service.importMT940(validStatement, admin, {
      partnerId: 'safe-deals',
      cursor: 'cursor-1',
    })).resolves.toMatchObject({
      batchId: 'batch-1',
      duplicate: false,
      imported: 1,
      matched: 1,
      mismatch: 0,
      checkpointVersion: 1,
      statementHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { bankRef: 'bank-reserve:DEAL-001' },
      take: 2,
    }));
    const serializedRecords = queryValues(prisma.$queryRaw as unknown as jest.Mock)
      .find((value) => typeof value === 'string' && value.startsWith('[{')) as string;
    expect(JSON.parse(serializedRecords)[0]).toMatchObject({
      matchStatus: 'MATCHED',
      paymentId: 'payment-1',
      dealId: 'DEAL-1',
      mismatchCode: '',
    });
    expect(serializedRecords).not.toContain('payment for grain');
    expect(serializedRecords).not.toContain('1234567890');
  });

  it('records amount mismatch evidence without mutating the payment', async () => {
    const { service, prisma } = setup({ amountRub: 90 });
    await expect(service.importMT940(validStatement, admin, {
      partnerId: 'safe-deals',
      cursor: 'cursor-2',
    })).resolves.toMatchObject({ matched: 0, mismatch: 1 });
    const serializedRecords = queryValues(prisma.$queryRaw as unknown as jest.Mock)
      .find((value) => typeof value === 'string' && value.startsWith('[{')) as string;
    expect(JSON.parse(serializedRecords)[0]).toMatchObject({
      matchStatus: 'MISMATCH',
      mismatchCode: 'AMOUNT_MISMATCH',
      paymentId: 'payment-1',
    });
    expect(Object.keys(prisma.payment)).toEqual(['findMany']);
  });

  it('does not auto-match an ambiguous bank reference', async () => {
    const { service, prisma } = setup({ paymentCount: 2 });
    await service.importMT940(validStatement, admin, {
      partnerId: 'safe-deals',
      cursor: 'cursor-3',
    });
    const serializedRecords = queryValues(prisma.$queryRaw as unknown as jest.Mock)
      .find((value) => typeof value === 'string' && value.startsWith('[{')) as string;
    expect(JSON.parse(serializedRecords)[0]).toMatchObject({
      matchStatus: 'MISMATCH',
      mismatchCode: 'AMBIGUOUS_REFERENCE',
    });
  });

  it('keeps EXECUTIVE read-only and restricts imports/manual decisions', async () => {
    const { service } = setup();
    await expect(service.importMT940(validStatement, executive, {
      partnerId: 'safe-deals',
      cursor: 'cursor-4',
    })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.manualMatch('recon_1', 'DEAL-1', 'reviewed evidence', executive))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('records a manual decision but explicitly does not mutate money', async () => {
    const { service, prisma } = setup();
    (prisma.$queryRaw as unknown as jest.Mock).mockResolvedValueOnce([{ decision_id: 11n }]);
    await expect(service.manualMatch(
      `recon_${'a'.repeat(64)}`,
      'DEAL-1',
      'Accountant reviewed bank evidence',
      admin,
    )).resolves.toEqual({
      recordId: `recon_${'a'.repeat(64)}`,
      dealId: 'DEAL-1',
      decisionId: 11,
      moneyMutated: false,
    });
  });
});
