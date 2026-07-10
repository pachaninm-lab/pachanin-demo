import { ConflictException } from '@nestjs/common';
import { DealCommandService } from './deal-command.service';
import type { RequestUser } from '../../common/types/request-user';

const USER: RequestUser = {
  id: 'compliance-user-1',
  email: 'compliance@test.local',
  role: 'COMPLIANCE_OFFICER' as any,
  orgId: 'org-canonical-platform',
  fullName: 'Compliance User',
  tenantId: 'tenant-canonical-test',
};

const UPDATED_AT = new Date('2026-07-10T09:00:00.000Z');
const NEXT_UPDATED_AT = new Date('2026-07-10T09:00:01.000Z');

function deal(status = 'DRAFT') {
  return {
    id: 'DEAL-INDUSTRIAL-001',
    status,
    updatedAt: UPDATED_AT,
    tenantId: 'tenant-canonical-test',
    sellerOrgId: 'org-canonical-seller',
    buyerOrgId: 'org-canonical-buyer',
    totalKopecks: 240_000_000,
  };
}

function command(overrides: Record<string, unknown> = {}) {
  return {
    commandId: 'command-0001',
    idempotencyKey: 'idempotency-0001',
    expectedUpdatedAt: UPDATED_AT.toISOString(),
    payload: {},
    ...overrides,
  } as any;
}

describe('DealCommandService atomic canonical command path', () => {
  it('commits deal state, event, audit and receipt through one transaction callback', async () => {
    const tx = {
      outboxEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
        upsert: jest.fn(),
      },
      deal: {
        findUnique: jest.fn().mockResolvedValue(deal()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...deal('ADMISSION_APPROVED'), updatedAt: NEXT_UPDATED_AT }),
      },
      dealEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'event-1', hash: 'event-hash-1' }),
      },
      auditEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'audit-1', hash: 'audit-hash-1' }),
      },
    };

    const prisma = {
      outboxEntry: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (work: (client: typeof tx) => unknown) => work(tx)),
    };
    const service = new DealCommandService(prisma as any);

    const result = await service.execute(
      'DEAL-INDUSTRIAL-001',
      'approve_admission',
      command(),
      USER,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.deal.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'DEAL-INDUSTRIAL-001', status: 'DRAFT', updatedAt: UPDATED_AT }),
      data: expect.objectContaining({ status: 'ADMISSION_APPROVED' }),
    }));
    expect(tx.dealEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'deal.command.receipt',
        status: 'CONFIRMED',
        idempotencyKey: 'deal-command:DEAL-INDUSTRIAL-001:idempotency-0001',
      }),
    }));
    expect(result).toMatchObject({
      ok: true,
      duplicate: false,
      previousStatus: 'DRAFT',
      status: 'ADMISSION_APPROVED',
      eventId: 'event-1',
      auditId: 'audit-1',
    });
  });

  it('returns the stored command receipt without starting another transaction', async () => {
    const storedResult = {
      ok: true,
      duplicate: false,
      commandId: 'command-0001',
      idempotencyKey: 'idempotency-0001',
      dealId: 'DEAL-INDUSTRIAL-001',
      actionId: 'approve_admission',
      previousStatus: 'DRAFT',
      status: 'ADMISSION_APPROVED',
      updatedAt: NEXT_UPDATED_AT.toISOString(),
      eventId: 'event-1',
      auditId: 'audit-1',
      externalOutboxId: null,
    };
    const prisma = {
      outboxEntry: {
        findUnique: jest.fn().mockResolvedValue({ payload: { result: storedResult } }),
      },
      $transaction: jest.fn(),
    };
    const service = new DealCommandService(prisma as any);

    await expect(service.execute(
      'DEAL-INDUSTRIAL-001',
      'approve_admission',
      command(),
      USER,
    )).resolves.toMatchObject({ ...storedResult, duplicate: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a stale version before any mutation is attempted', async () => {
    const tx = {
      outboxEntry: { findUnique: jest.fn().mockResolvedValue(null) },
      deal: {
        findUnique: jest.fn().mockResolvedValue(deal()),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      outboxEntry: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (work: (client: typeof tx) => unknown) => work(tx)),
    };
    const service = new DealCommandService(prisma as any);

    await expect(service.execute(
      'DEAL-INDUSTRIAL-001',
      'approve_admission',
      command({ expectedUpdatedAt: '2026-07-10T08:59:59.000Z' }),
      USER,
    )).rejects.toBeInstanceOf(ConflictException);
    expect(tx.deal.updateMany).not.toHaveBeenCalled();
  });
});
