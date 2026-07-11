import { RequestUser, Role } from '../../src/common/types/request-user';
import { StaffAccessRepository } from '../../src/modules/staff-access/staff-access.repository';
import {
  StaffAccessContext,
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from '../../src/modules/staff-access/staff-access.types';
import { StaffAuditService } from '../../src/modules/staff-access/staff-audit.service';
import { StaffAuditWriterService } from '../../src/modules/staff-access/staff-audit-writer.service';

const actor: RequestUser = {
  id: 'staff-user', email: 'staff@example.test', orgId: 'platform-org', role: Role.ADMIN,
};

const access: StaffAccessContext = {
  accessSessionId: 'session-1', grantId: 'grant-1', actorUserId: actor.id,
  staffRole: StaffRole.OPERATIONS_SUPERVISOR, accessMode: StaffAccessMode.OPERATIONS,
  permissions: [StaffPermission.DEAL_READ], effectiveTenantId: 'tenant-a',
  effectiveOrganizationId: 'org-a', effectiveUserId: null, effectiveRole: null,
  targetDealId: 'deal-1', reason: 'Investigate execution blocker', ticketId: 'OPS-42',
  expiresAt: new Date(Date.now() + 60_000),
};

describe('StaffAuditWriterService', () => {
  it('writes scoped columns without changing the canonical verifier hash payload', async () => {
    const tx = {};
    const repository = {
      transaction: jest.fn(async (work: any) => work(tx)),
      latestEventHash: jest.fn().mockResolvedValue(null),
      insertEvent: jest.fn().mockResolvedValue(undefined),
      prisma: { $queryRaw: jest.fn() },
    } as unknown as StaffAccessRepository;
    const writer = new StaffAuditWriterService(repository);
    await writer.record(actor, access, {
      action: 'staff.workspace.operations.read',
      resourceType: 'deal',
      resourceId: 'deal-1',
    });

    const inserted = (repository.insertEvent as jest.Mock).mock.calls[0][1];
    expect(inserted).toMatchObject({
      effectiveTenantId: 'tenant-a', effectiveOrganizationId: 'org-a',
      accessMode: StaffAccessMode.OPERATIONS,
    });
    (repository.prisma.$queryRaw as jest.Mock).mockResolvedValue([{
      id: inserted.id,
      actor_user_id: inserted.actorUserId,
      staff_role: inserted.staffRole,
      access_session_id: inserted.accessSessionId,
      grant_id: inserted.grantId,
      effective_tenant_id: inserted.effectiveTenantId,
      effective_organization_id: inserted.effectiveOrganizationId,
      effective_user_id: inserted.effectiveUserId,
      effective_role: inserted.effectiveRole,
      access_mode: inserted.accessMode,
      action: inserted.action,
      resource_type: inserted.resourceType,
      resource_id: inserted.resourceId,
      outcome: inserted.outcome,
      reason: inserted.reason,
      ticket_id: inserted.ticketId,
      correlation_id: inserted.correlationId,
      metadata: inserted.metadata,
      prev_hash: inserted.prevHash,
      hash: inserted.hash,
      created_at: new Date(),
    }]);
    const verifier = new StaffAuditService(repository, { requirePermission: jest.fn() } as any);
    await expect(verifier.verifyActorChain(actor, actor.id)).resolves.toMatchObject({ valid: true, checked: 1 });
  });
});
