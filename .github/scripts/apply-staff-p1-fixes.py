from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'missing expected block in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


# Pass the verified staff session scope into all customer-data workspace reads.
controller = 'apps/api/src/modules/staff-access/staff-workspace.controller.ts'
replace(controller,
"""  operations(@Req() request: StaffRequest) {
    return this.workspaces.operationsQueue(request.user);
  }
""",
"""  operations(@Req() request: StaffRequest) {
    return this.workspaces.operationsQueue(request.user, this.requireAccessContext(request));
  }
""")
replace(controller,
"""  finance(@Req() request: StaffRequest) {
    return this.workspaces.financeQueue(request.user);
  }
""",
"""  finance(@Req() request: StaffRequest) {
    return this.workspaces.financeQueue(request.user, this.requireAccessContext(request));
  }
""")
replace(controller,
"""  diagnostics(@Req() request: StaffRequest) {
    return this.workspaces.diagnostics(request.user);
  }
""",
"""  diagnostics(@Req() request: StaffRequest) {
    return this.workspaces.diagnostics(request.user, this.requireAccessContext(request));
  }
""")

service = 'apps/api/src/modules/staff-access/staff-workspace.service.ts'
replace(service,
"import { StaffPermission } from './staff-access.types';",
"import { StaffAccessContext, StaffPermission } from './staff-access.types';")
replace(service,
"""  async operationsQueue(user: RequestUser) {
    await this.access.requirePermission(user, StaffPermission.DEAL_LIST);
    const now = new Date();
    const deals = await this.repository.prisma.deal.findMany({
      where: { status: { notIn: ['CLOSED', 'CANCELLED'] } },
""",
"""  async operationsQueue(user: RequestUser, staffAccess: StaffAccessContext) {
    await this.access.requirePermission(user, StaffPermission.DEAL_LIST);
    const now = new Date();
    const dealScope = this.dealScope(staffAccess);
    const deals = await this.repository.prisma.deal.findMany({
      where: { AND: [dealScope, { status: { notIn: ['CLOSED', 'CANCELLED'] } }] },
""")
replace(service,
"""  async financeQueue(user: RequestUser) {
    await this.access.requirePermission(user, StaffPermission.PAYMENT_METADATA_READ);
    const [payments, operations] = await Promise.all([
      this.repository.prisma.payment.findMany({
        select: {
""",
"""  async financeQueue(user: RequestUser, staffAccess: StaffAccessContext) {
    await this.access.requirePermission(user, StaffPermission.PAYMENT_METADATA_READ);
    const dealScope = this.dealScope(staffAccess);
    const [payments, operations] = await Promise.all([
      this.repository.prisma.payment.findMany({
        where: { deal: { is: dealScope } },
        select: {
""")
replace(service,
"""      this.repository.prisma.bankOperation.findMany({
        select: {
""",
"""      this.repository.prisma.bankOperation.findMany({
        where: { deal: { is: dealScope } },
        select: {
""")
replace(service,
"""  async diagnostics(user: RequestUser) {
    await this.access.requirePermission(user, StaffPermission.DIAGNOSTIC_READ);
    const [integrations, outbox, attempts] = await Promise.all([
      this.repository.prisma.integrationEvent.findMany({
        select: { id: true, adapterName: true, direction: true, eventType: true, dealId: true, status: true, errorMessage: true, httpStatus: true, durationMs: true, createdAt: true },
""",
"""  async diagnostics(user: RequestUser, staffAccess: StaffAccessContext) {
    await this.access.requirePermission(user, StaffPermission.DIAGNOSTIC_READ);
    const dealScope = this.dealScope(staffAccess);
    const scopedDealIds = await this.scopedDealIds(staffAccess, dealScope);
    const dealIdWhere = scopedDealIds === null ? undefined : { dealId: { in: scopedDealIds } };
    const attemptWhere = scopedDealIds === null
      ? undefined
      : { snapshot: { is: { deal: { is: dealScope } } } };
    const [integrations, outbox, attempts] = await Promise.all([
      this.repository.prisma.integrationEvent.findMany({
        where: dealIdWhere,
        select: { id: true, adapterName: true, direction: true, eventType: true, dealId: true, status: true, errorMessage: true, httpStatus: true, durationMs: true, createdAt: true },
""")
replace(service,
"""      this.repository.prisma.outboxEntry.findMany({
        select: { id: true, type: true, dealId: true, status: true, retryCount: true, maxRetries: true, nextRetryAt: true, lastError: true, correlationId: true, createdAt: true, sentAt: true, confirmedAt: true, failedAt: true },
""",
"""      this.repository.prisma.outboxEntry.findMany({
        where: dealIdWhere,
        select: { id: true, type: true, dealId: true, status: true, retryCount: true, maxRetries: true, nextRetryAt: true, lastError: true, correlationId: true, createdAt: true, sentAt: true, confirmedAt: true, failedAt: true },
""")
replace(service,
"""      this.repository.prisma.dealWorkspaceRuntimeTransactionAttempt.findMany({
        select: { id: true, transactionId: true, correlationId: true, stage: true, outcome: true, failureCode: true, failureReason: true, isReplay: true, startedAt: true, completedAt: true },
""",
"""      this.repository.prisma.dealWorkspaceRuntimeTransactionAttempt.findMany({
        where: attemptWhere,
        select: { id: true, transactionId: true, correlationId: true, stage: true, outcome: true, failureCode: true, failureReason: true, isReplay: true, startedAt: true, completedAt: true },
""")
replace(service,
"""  }


  async ownCriticalActions(user: RequestUser) {
""",
"""  }

  private dealScope(staffAccess: StaffAccessContext): Prisma.DealWhereInput {
    const filters: Prisma.DealWhereInput[] = [];
    if (staffAccess.targetDealId) filters.push({ id: staffAccess.targetDealId });
    if (staffAccess.effectiveTenantId) filters.push({ tenantId: staffAccess.effectiveTenantId });
    if (staffAccess.effectiveOrganizationId) {
      filters.push({
        OR: [
          { sellerOrgId: staffAccess.effectiveOrganizationId },
          { buyerOrgId: staffAccess.effectiveOrganizationId },
        ],
      });
    }
    return filters.length === 0 ? {} : { AND: filters };
  }

  private async scopedDealIds(
    staffAccess: StaffAccessContext,
    dealScope: Prisma.DealWhereInput,
  ): Promise<string[] | null> {
    const scoped = Boolean(
      staffAccess.targetDealId
      || staffAccess.effectiveTenantId
      || staffAccess.effectiveOrganizationId,
    );
    if (!scoped) return null;
    if (staffAccess.targetDealId) return [staffAccess.targetDealId];
    const deals = await this.repository.prisma.deal.findMany({
      where: dealScope,
      select: { id: true },
    });
    return deals.map((deal) => deal.id);
  }

  async ownCriticalActions(user: RequestUser) {
""")

# Keep new workspace audit events compatible with the established chain verifier.
audit_writer = 'apps/api/src/modules/staff-access/staff-audit-writer.service.ts'
replace(audit_writer,
"""    const payload = {
      id,
      actorUserId: actor.id,
      staffRole: access.staffRole as StaffRole,
      accessSessionId: access.accessSessionId,
      grantId: access.grantId,
      effectiveTenantId: access.effectiveTenantId,
      effectiveOrganizationId: access.effectiveOrganizationId,
      effectiveUserId: access.effectiveUserId,
      effectiveRole: access.effectiveRole,
      accessMode: access.accessMode,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      outcome: input.outcome ?? 'SUCCESS',
      reason: input.reason ?? access.reason,
      ticketId: access.ticketId,
      correlationId,
      metadata: {
        targetDealId: access.targetDealId ?? null,
        ...(input.metadata || {}),
      },
      prevHash,
    };
    await this.repository.insertEvent(client, {
      ...payload,
      hash: sha256(stableJson(payload)),
    });
""",
"""    const payload = {
      id,
      actorUserId: actor.id,
      staffRole: access.staffRole as StaffRole,
      accessSessionId: access.accessSessionId,
      grantId: access.grantId,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      outcome: input.outcome ?? 'SUCCESS',
      reason: input.reason ?? access.reason,
      ticketId: access.ticketId,
      correlationId,
      metadata: {
        targetDealId: access.targetDealId ?? null,
        ...(input.metadata || {}),
      },
      prevHash,
    };
    await this.repository.insertEvent(client, {
      ...payload,
      effectiveTenantId: access.effectiveTenantId,
      effectiveOrganizationId: access.effectiveOrganizationId,
      effectiveUserId: access.effectiveUserId,
      effectiveRole: access.effectiveRole,
      accessMode: access.accessMode,
      hash: sha256(stableJson(payload)),
    });
""")

# Fail closed before any bearer or privileged staff token can be proxied over HTTP.
proxy = 'apps/web/app/api/staff/[...path]/route.ts'
replace(proxy,
"const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\\/$/, '');",
"const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\\/$/, '');")
replace(proxy,
"""  if (!API_URL) {
    return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', message: 'Контур управления временно недоступен.', correlationId }, 503);
  }

  if (method === 'GET' && path === 'session-context') {
""",
"""  if (!API_URL) {
    return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', message: 'Контур управления временно недоступен.', correlationId }, 503);
  }

  let apiOrigin: string;
  try {
    const url = new URL(API_URL);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', message: 'Контур управления временно недоступен.', correlationId }, 503);
    }
    apiOrigin = url.toString().replace(/\\/$/, '');
  } catch {
    return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', message: 'Контур управления временно недоступен.', correlationId }, 503);
  }

  if (method === 'GET' && path === 'session-context') {
""")
replace(proxy,
"const targetUrl = `${API_URL}/staff/${path}${query ? `?${query}` : ''}`;",
"const targetUrl = `${apiOrigin}/staff/${path}${query ? `?${query}` : ''}`;")

# Update service tests and add explicit cross-tenant regression coverage.
test = 'apps/api/test/staff-access/staff-workspace.service.spec.ts'
replace(test,
"""  StaffPermission,
} from '../../src/modules/staff-access/staff-access.types';
""",
"""  StaffAccessContext,
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from '../../src/modules/staff-access/staff-access.types';
""")
replace(test,
"""const actor: RequestUser = {
""",
"""const globalAccess: StaffAccessContext = {
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
""")
replace(test, 'await service.operationsQueue(actor);', 'await service.operationsQueue(actor, globalAccess);')
replace(test, 'const result = await service.operationsQueue(actor);', 'const result = await service.operationsQueue(actor, globalAccess);')
replace(test, 'const result = await service.financeQueue(actor);', 'const result = await service.financeQueue(actor, globalAccess);')
replace(test, 'await service.diagnostics(actor);', 'await service.diagnostics(actor, globalAccess);')
replace(test,
"""  it('requires independent critical-action approval authority', async () => {
""",
"""  it('applies tenant, organization and deal scope to operations, finance and diagnostics', async () => {
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
""")

# Static web boundary assertion for the main staff BFF.
web_test = 'apps/web/tests/unit/platformV7StaffControlCenter.test.ts'
replace(web_test,
"""    expect(proxy).toContain("code: 'CSRF_REJECTED'");
    expect(proxy).toContain('delete safePayload.accessToken');
""",
"""    expect(proxy).toContain("code: 'CSRF_REJECTED'");
    expect(proxy).toContain("process.env.NODE_ENV === 'production' && url.protocol !== 'https:'");
    expect(proxy).toContain('const targetUrl = `${apiOrigin}/staff/${path}');
    expect(proxy).toContain('delete safePayload.accessToken');
""")

# End-to-end unit proof that scoped audit rows remain verifiable.
Path('apps/api/test/staff-access/staff-audit-writer.service.spec.ts').write_text("""import { RequestUser, Role } from '../../src/common/types/request-user';
import { StaffAccessRepository } from '../../src/modules/staff-access/staff-access.repository';
import { StaffAccessMode, StaffPermission, StaffRole } from '../../src/modules/staff-access/staff-access.types';
import { StaffAuditService } from '../../src/modules/staff-access/staff-audit.service';
import { StaffAuditWriterService } from '../../src/modules/staff-access/staff-audit-writer.service';

const actor: RequestUser = {
  id: 'staff-user', email: 'staff@example.test', orgId: 'platform-org', role: Role.ADMIN,
};

const access = {
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
    await writer.record(actor, access, { action: 'staff.workspace.operations.read', resourceType: 'deal', resourceId: 'deal-1' });

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
""", encoding='utf-8')

# Remove the temporary automation from the resulting source commit.
Path('.github/workflows/staff-p1-security-fix.yml').unlink(missing_ok=True)
Path('.github/scripts/apply-staff-p1-fixes.py').unlink(missing_ok=True)
