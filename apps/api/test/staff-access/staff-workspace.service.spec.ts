import { RequestUser, Role } from '../../src/common/types/request-user';
import {
  ALLOWED_STAFF_CRITICAL_ACTIONS,
  FORBIDDEN_STAFF_ACTIONS,
  StaffAccessContext,
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from '../../src/modules/staff-access/staff-access.types';
import { StaffWorkspaceService } from '../../src/modules/staff-access/staff-workspace.service';

const globalAccess: StaffAccessContext = {
  accessSessionId: 'staff-session',
  grantId: 'staff-grant',
  actorUserId: 'staff-user',
  staffRole: StaffRole.PLATFORM_OWNER,
  accessMode: StaffAccessMode.CONTROL_PLANE,
  permissions: Object.values(StaffPermission),
  effectiveTenantId: null,
  effectiveOrganizationId: null,
  effectiveUserId: null,
  effectiveRole: null,
  targetDealId: null,
  reason: 'Operations control',
  ticketId: 'OPS-1',
  expiresAt: new Date(Date.now() + 60_000),
};

const scopedAccess: StaffAccessContext = {
  ...globalAccess,
  accessMode: StaffAccessMode.OPERATIONS,
  effectiveTenantId: 'tenant-a',
  effectiveOrganizationId: 'buyer',
  targetDealId: 'deal-1',
};

const actor: RequestUser = {
  id: 'staff-user',
  email: 'staff@example.test',
  fullName: 'Staff User',
  orgId: 'platform-org',
  tenantId: 'platform-tenant',
  membershipId: 'platform-membership',
  role: Role.ADMIN,
  sessionId: 'auth-session',
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

function setup() {
  const prisma = {
    deal: { findMany: jest.fn().mockResolvedValue([]) },
    kycTask: { findMany: jest.fn().mockResolvedValue([]) },
    organization: { findMany: jest.fn().mockResolvedValue([]) },
    dispute: { groupBy: jest.fn().mockResolvedValue([]) },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
    bankOperation: { findMany: jest.fn().mockResolvedValue([]) },
    integrationEvent: { findMany: jest.fn().mockResolvedValue([]) },
    outboxEntry: { findMany: jest.fn().mockResolvedValue([]) },
    dealWorkspaceRuntimeTransactionAttempt: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const repository = { prisma } as any;
  const access = { requirePermission: jest.fn().mockResolvedValue('PLATFORM_OWNER') } as any;
  return { prisma, access, service: new StaffWorkspaceService(repository, access) };
}

describe('StaffWorkspaceService', () => {
  it('requires the support permission before loading the support queue', async () => {
    const { service, access, prisma } = setup();
    await service.supportQueue(actor);
    expect(access.requirePermission).toHaveBeenCalledWith(actor, StaffPermission.SUPPORT_CASE_READ);
    expect(prisma.deal.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.kycTask.findMany).toHaveBeenCalledTimes(1);
  });

  it('requires deal:list and derives the operations queue from canonical deal state', async () => {
    const { service, access, prisma } = setup();
    prisma.deal.findMany.mockResolvedValue([{
      id: 'deal-1', dealNumber: 'TP-1', status: 'IN_EXECUTION', tenantId: 'tenant-a',
      sellerOrgId: 'seller', buyerOrgId: 'buyer', nextAction: 'CHECK_DOCS', slaAt: new Date(Date.now() - 1_000), updatedAt: new Date(),
      shipments: [{ id: 'shipment-1', status: 'IN_TRANSIT', blockers: 'NO_EPD', nextAction: 'UPLOAD_EPD', updatedAt: new Date() }],
      documents: [{ status: 'PENDING', bankRequired: true, releaseRequired: true }],
      payments: [{ status: 'RESERVED', callbackState: 'CONFIRMED', updatedAt: new Date() }],
      bankOperations: [], acceptanceRecords: [],
    }]);
    prisma.organization.findMany.mockResolvedValue([{ id: 'seller', name: 'Seller', inn: '1' }, { id: 'buyer', name: 'Buyer', inn: '2' }]);
    const result = await service.operationsQueue(actor, globalAccess);
    expect(access.requirePermission).toHaveBeenCalledWith(actor, StaffPermission.DEAL_LIST);
    expect(result.items[0]).toMatchObject({ id: 'deal-1', overdue: true, openDisputes: 0 });
    expect(result.items[0].shipmentSummary).toMatchObject({ total: 1, blocked: 1, active: 1 });
    expect(result.items[0].documentSummary).toMatchObject({ total: 1, pending: 1, releaseBlocking: 1 });
  });

  it('requires payment metadata and serializes BigInt bank amounts', async () => {
    const { service, access, prisma } = setup();
    prisma.bankOperation.findMany.mockResolvedValue([{
      id: 'op-1', dealId: 'deal-1', type: 'RESERVE', status: 'PENDING', amountKopecks: 123n,
      currency: 'RUB', bankRef: null, bankName: null, failureReason: null, confirmedAt: null,
      createdAt: new Date(), updatedAt: new Date(), deal: { dealNumber: 'TP-1', status: 'IN_EXECUTION' },
    }]);
    const result = await service.financeQueue(actor, globalAccess);
    expect(access.requirePermission).toHaveBeenCalledWith(actor, StaffPermission.PAYMENT_METADATA_READ);
    expect(result.bankOperations[0].amountKopecks).toBe('123');
  });

  it('requires diagnostics and deliberately excludes integration payloads', async () => {
    const { service, access, prisma } = setup();
    await service.diagnostics(actor, globalAccess);
    expect(access.requirePermission).toHaveBeenCalledWith(actor, StaffPermission.DIAGNOSTIC_READ);
    const select = prisma.integrationEvent.findMany.mock.calls[0][0].select;
    expect(select.requestPayload).toBeUndefined();
    expect(select.responsePayload).toBeUndefined();
    expect(select.errorMessage).toBe(true);
    expect(prisma.outboxEntry.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.dealWorkspaceRuntimeTransactionAttempt.findMany).toHaveBeenCalledTimes(1);
  });

  it('applies tenant, organization and deal scope to operations, finance and diagnostics', async () => {
    const { service, prisma } = setup();
    await service.operationsQueue(actor, scopedAccess);
    await service.financeQueue(actor, scopedAccess);
    await service.diagnostics(actor, scopedAccess);

    const operationsWhere = prisma.deal.findMany.mock.calls[0][0].where;
    expect(operationsWhere).toEqual({
      AND: [
        {
          AND: [
            { id: 'deal-1' },
            { tenantId: 'tenant-a' },
            { OR: [{ sellerOrgId: 'buyer' }, { buyerOrgId: 'buyer' }] },
          ],
        },
        { status: { notIn: ['CLOSED', 'CANCELLED'] } },
      ],
    });
    expect(prisma.payment.findMany.mock.calls[0][0].where).toEqual({ deal: { is: operationsWhere.AND[0] } });
    expect(prisma.bankOperation.findMany.mock.calls[0][0].where).toEqual({ deal: { is: operationsWhere.AND[0] } });
    expect(prisma.integrationEvent.findMany.mock.calls[0][0].where).toEqual({ dealId: { in: ['deal-1'] } });
    expect(prisma.outboxEntry.findMany.mock.calls[0][0].where).toEqual({ dealId: { in: ['deal-1'] } });
    expect(prisma.dealWorkspaceRuntimeTransactionAttempt.findMany.mock.calls[0][0].where).toEqual({
      snapshot: { is: { deal: { is: operationsWhere.AND[0] } } },
    });
  });

  it('requires independent critical-action approval authority', async () => {
    const { service, access, prisma } = setup();
    await service.criticalActions(actor);
    expect(access.requirePermission).toHaveBeenCalledWith(actor, StaffPermission.CRITICAL_ACTION_APPROVE);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('lets a requester read only their own time-bound critical requests', async () => {
    const { service, access, prisma } = setup();
    await service.ownCriticalActions(actor);
    expect(access.requirePermission).toHaveBeenCalledWith(actor, StaffPermission.CRITICAL_ACTION_REQUEST);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('registers only non-authoritative staff critical actions', () => {
    expect(ALLOWED_STAFF_CRITICAL_ACTIONS).toEqual(new Set([
      'deal:operation:retry',
      'user:session:revoke',
      'user:mfa:reset',
      'user:access-recovery:initiate',
      'payment:manual-review',
      'feature-flag:write',
    ]));
    for (const forbidden of FORBIDDEN_STAFF_ACTIONS) {
      expect(ALLOWED_STAFF_CRITICAL_ACTIONS.has(forbidden)).toBe(false);
    }
  });
});
