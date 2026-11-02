import { RequestFounderRoleModeDto, RequestStaffAccessDto } from '../../src/modules/staff-access/staff-access.dto';
import { BadRequestException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import {
  FOUNDER_ROLE_MODE_CABINETS,
  FOUNDER_ROLE_MODE_RESTRICTIONS,
  StaffAccessService,
} from '../../src/modules/staff-access/staff-access.service';
import {
  StaffAccessMode,
  StaffPermission,
  StaffRole,
  type StaffAccessContext,
} from '../../src/modules/staff-access/staff-access.types';

const owner: RequestUser = {
  id: 'founder-user',
  email: 'founder@example.test',
  fullName: 'Founder User',
  orgId: 'platform-org',
  tenantId: 'platform-tenant',
  membershipId: 'founder-membership',
  role: Role.ADMIN,
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

function fixture(scope: { tenant_id: string | null; organization_id: string | null; user_id: string | null } | null = {
  tenant_id: 'tenant-real',
  organization_id: 'org-real',
  user_id: null,
}) {
  const repository: any = {
    prisma: {},
    listActiveAssignments: jest.fn().mockResolvedValue([{
      id: 'assignment-owner',
      user_id: owner.id,
      role: StaffRole.PLATFORM_OWNER,
      status: 'ACTIVE',
      valid_from: new Date(0),
      valid_until: null,
    }]),
    resolveTargetScope: jest.fn().mockResolvedValue(scope),
  };
  const service = new StaffAccessService(repository);
  const requestAccess = jest.spyOn(service, 'requestAccess').mockResolvedValue({
    requestId: 'sar-role-mode',
    status: 'GRANTED',
    grantId: 'sag-role-mode',
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
  });
  return { service, repository, requestAccess };
}

describe('StaffAccessService founder role mode', () => {
  it('exposes one server-owned exact 13-cabinet registry', async () => {
    const { service } = fixture();
    const result = await service.founderRoleModeRegistry(owner);

    expect(result.cabinets).toHaveLength(13);
    expect(new Set(result.cabinets.map((item) => item.key)).size).toBe(13);
    expect(result.cabinets).toEqual(FOUNDER_ROLE_MODE_CABINETS.map((item) => ({ ...item })));
    expect(result.cabinets.find((item) => item.key === 'organization')).toEqual(expect.objectContaining({
      canonicalPath: '/platform-v7/profile',
      effectiveRole: Role.GUEST,
    }));
    expect(result.cabinets.map((item) => String(item.effectiveRole))).not.toContain(Role.BANK_CALLBACK);
    expect(result.mode).toBe(StaffAccessMode.VIEW_AS);
    expect(result.readOnly).toBe(true);
  });

  it('derives tenant and effective role server-side and reuses the durable VIEW_AS flow', async () => {
    const { service, requestAccess, repository } = fixture();

    const result = await service.requestFounderRoleMode(owner, {
      cabinetKey: 'buyer',
      organizationId: 'org-real',
      reason: 'Founder inspecting the real buyer cabinet',
      ticketId: 'R1-ROLE-001',
      durationSeconds: 600,
      targetTenantId: 'tenant-forged',
      targetRole: Role.ADMIN,
    } as any, 'corr-r1');

    expect(repository.resolveTargetScope).toHaveBeenCalledWith(repository.prisma, {
      actorUserId: owner.id,
      assignmentId: 'assignment-owner',
      targetOrganizationId: 'org-real',
    });
    expect(requestAccess).toHaveBeenCalledWith(owner, {
      assignmentId: 'assignment-owner',
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [
        StaffPermission.CABINET_VIEW_AS,
        StaffPermission.DEAL_READ,
        StaffPermission.DOCUMENT_METADATA_READ,
      ],
      targetTenantId: 'tenant-real',
      targetOrganizationId: 'org-real',
      targetRole: Role.BUYER,
      reason: 'Founder inspecting the real buyer cabinet',
      ticketId: 'R1-ROLE-001',
      durationSeconds: 600,
    }, 'corr-r1');
    expect(result.roleMode).toEqual(expect.objectContaining({
      cabinetKey: 'buyer',
      effectiveRole: Role.BUYER,
      effectiveTenantId: 'tenant-real',
      effectiveOrganizationId: 'org-real',
      readOnly: true,
    }));
  });

  it('rejects a cabinet key outside the server registry before creating authority', async () => {
    const { service, requestAccess, repository } = fixture();

    await expect(service.requestFounderRoleMode(owner, {
      cabinetKey: 'invented-admin-role',
      organizationId: 'org-real',
      reason: 'Attempt to forge a cabinet role safely',
      ticketId: 'R1-NEG-001',
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.resolveTargetScope).not.toHaveBeenCalled();
    expect(requestAccess).not.toHaveBeenCalled();
  });

  it('fails closed when the organization scope cannot be resolved', async () => {
    const { service, requestAccess } = fixture(null);

    await expect(service.requestFounderRoleMode(owner, {
      cabinetKey: 'seller',
      organizationId: 'org-unknown',
      reason: 'Founder inspecting a real seller cabinet',
      ticketId: 'R1-NEG-002',
    })).rejects.toBeInstanceOf(ForbiddenException);

    expect(requestAccess).not.toHaveBeenCalled();
  });

  it.each([
    { tenant_id: 'tenant-canonical-test', organization_id: 'org-real', user_id: null },
    { tenant_id: 'tenant-real', organization_id: 'org-canonical-buyer', user_id: null },
  ])('never counts controlled test targets as R1 production role-mode authority', async (scope) => {
    const { service, requestAccess } = fixture(scope);

    await expect(service.requestFounderRoleMode(owner, {
      cabinetKey: 'buyer',
      organizationId: scope.organization_id!,
      reason: 'Founder role mode must use real production organization data',
      ticketId: 'R1-NEG-003',
    })).rejects.toBeInstanceOf(ForbiddenException);

    expect(requestAccess).not.toHaveBeenCalled();
  });

  it('returns a versioned read-only consumer session contract from durable VIEW_AS context', async () => {
    const { service } = fixture();
    const context: StaffAccessContext = {
      accessSessionId: 'sas-role-mode',
      grantId: 'sag-role-mode',
      actorUserId: owner.id,
      staffRole: StaffRole.PLATFORM_OWNER,
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [
        StaffPermission.CABINET_VIEW_AS,
        StaffPermission.DEAL_READ,
        StaffPermission.DOCUMENT_METADATA_READ,
      ],
      effectiveTenantId: 'tenant-real',
      effectiveOrganizationId: 'org-real',
      effectiveUserId: null,
      effectiveRole: Role.EXECUTIVE,
      targetDealId: null,
      reason: 'Founder inspecting executive cabinet state',
      ticketId: 'R1-ROLE-002',
      expiresAt: new Date('2026-09-21T00:00:00.000Z'),
    };

    const result = await service.founderRoleModeSession(owner, context);

    expect(result).toEqual(expect.objectContaining({
      active: true,
      accessSessionId: 'sas-role-mode',
      cabinetKey: 'executive',
      canonicalPath: '/platform-v7/executive',
      effectiveRole: Role.EXECUTIVE,
      effectiveOrganizationId: 'org-real',
      effectiveTenantId: 'tenant-real',
      mode: StaffAccessMode.VIEW_AS,
      readOnly: true,
      restrictions: [...FOUNDER_ROLE_MODE_RESTRICTIONS],
      returnPath: '/platform-v7/staff',
      mfaRequired: true,
    }));
    expect(result.actor).toEqual({ displayName: 'Founder User' });
  });

  it.each([
    { actorUserId: 'different-actor', staffRole: StaffRole.PLATFORM_OWNER },
    { actorUserId: owner.id, staffRole: StaffRole.PLATFORM_ADMIN },
  ])('rejects a VIEW_AS session that is not the founder owner session', async ({ actorUserId, staffRole }) => {
    const { service } = fixture();
    const context = {
      accessSessionId: 'sas-wrong-owner',
      grantId: 'sag-wrong-owner',
      actorUserId,
      staffRole,
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [
        StaffPermission.CABINET_VIEW_AS,
        StaffPermission.DEAL_READ,
        StaffPermission.DOCUMENT_METADATA_READ,
      ],
      effectiveTenantId: 'tenant-real',
      effectiveOrganizationId: 'org-real',
      effectiveUserId: null,
      effectiveRole: Role.BUYER,
      reason: 'Wrong delegated owner context',
      ticketId: 'R1-NEG-OWNER',
      expiresAt: new Date(Date.now() + 60_000),
    } as StaffAccessContext;

    await expect(service.founderRoleModeSession(owner, context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a role-mode session carrying non-canonical or write-capable permissions', async () => {
    const { service } = fixture();
    const context = {
      accessSessionId: 'sas-bad',
      grantId: 'sag-bad',
      actorUserId: owner.id,
      staffRole: StaffRole.PLATFORM_OWNER,
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [StaffPermission.CABINET_VIEW_AS, StaffPermission.USER_SESSION_REVOKE],
      effectiveTenantId: 'tenant-real',
      effectiveOrganizationId: 'org-real',
      effectiveUserId: null,
      effectiveRole: Role.BUYER,
      reason: 'Malformed delegated session',
      ticketId: 'R1-NEG-004',
      expiresAt: new Date(Date.now() + 60_000),
    } as StaffAccessContext;

    await expect(service.founderRoleModeSession(owner, context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// Transactional repository model: verifies producer boundaries, not PostgreSQL
// isolation, runtime-role privileges or native concurrent commit behavior.
function createIntentFixture(staffRole: StaffRole = StaffRole.PLATFORM_OWNER) {
  const requests = new Map<string, any>();
  const grants = new Map<string, any>();
  const events = new Map<string, any>();
  const assignment = { id: 'assignment-owner', user_id: owner.id, role: staffRole, status: 'ACTIVE', valid_from: new Date(0), valid_until: null };
  const repository: any = {
    prisma: {},
    listActiveAssignments: jest.fn(async () => [{ ...assignment }]),
    getAssignment: jest.fn(async () => ({ ...assignment })),
    resolveTargetScope: jest.fn().mockResolvedValue({ tenant_id: 'tenant-real', organization_id: 'org-real', user_id: null }),
    transaction: jest.fn(async (work: any) => {
      const before = structuredClone({ requests, grants, events });
      try { return await work({}); } catch (error) {
        for (const [target, saved] of [[requests, before.requests], [grants, before.grants], [events, before.events]] as const) {
          target.clear(); for (const [key, value] of saved) target.set(key, value);
        }
        throw error;
      }
    }),
    createAccessRequest: jest.fn(async (_: any, input: any) => {
      if (requests.has(input.id)) return false;
      requests.set(input.id, { id: input.id, requester_user_id: input.requesterUserId, assignment_id: input.assignmentId,
        access_mode: input.accessMode, target_tenant_id: input.targetTenantId ?? null, target_organization_id: input.targetOrganizationId ?? null,
        target_user_id: input.targetUserId ?? null, target_role: input.targetRole ?? null, target_deal_id: input.targetDealId ?? null,
        requested_permissions: input.permissions, reason: input.reason, ticket_id: input.ticketId, status: 'PENDING',
        max_duration_seconds: input.maxDurationSeconds, requested_at: new Date(), expires_at: input.expiresAt, version: 1 });
      return true;
    }),
    getAccessRequest: jest.fn(async (_: any, id: string) => requests.has(id) ? structuredClone(requests.get(id)) : null),
    markRequest: jest.fn(async (_: any, input: any) => {
      const row = requests.get(input.id); if (!row || row.version !== input.expectedVersion) return false;
      row.status = input.status; row.version += 1; return true;
    }),
    createGrant: jest.fn(async (_: any, input: any) => {
      const r = input.request;
      grants.set(input.id, { id: input.id, request_id: r.id, grantee_user_id: r.requester_user_id, assignment_id: r.assignment_id,
        staff_role: staffRole, access_mode: r.access_mode, target_tenant_id: r.target_tenant_id, target_organization_id: r.target_organization_id,
        target_user_id: r.target_user_id, target_role: r.target_role, target_deal_id: r.target_deal_id,
        permissions: r.requested_permissions, status: 'ACTIVE', starts_at: input.startsAt, expires_at: input.expiresAt,
        reason: r.reason, ticket_id: r.ticket_id, revoked_at: null });
    }),
    getGrantForRequest: jest.fn(async (_: any, id: string) => structuredClone([...grants.values()].find(g => g.request_id === id) ?? null)),
    getCreateEvent: jest.fn(async (_: any, id: string) => structuredClone(events.get(id) ?? null)),
    latestEventHash: jest.fn(async () => [...events.values()].at(-1)?.hash ?? null),
    insertEvent: jest.fn(async (_: any, input: any) => events.set(input.id, {
      id: input.id, actor_user_id: input.actorUserId, staff_role: input.staffRole,
      access_session_id: input.accessSessionId, grant_id: input.grantId,
      effective_tenant_id: input.effectiveTenantId ?? null, effective_organization_id: input.effectiveOrganizationId ?? null,
      effective_user_id: input.effectiveUserId ?? null, effective_role: input.effectiveRole ?? null,
      access_mode: input.accessMode ?? null, action: input.action, resource_type: input.resourceType, resource_id: input.resourceId,
      outcome: input.outcome, reason: input.reason, ticket_id: input.ticketId, correlation_id: input.correlationId,
      metadata: structuredClone(input.metadata), prev_hash: input.prevHash, hash: input.hash,
    })),
  };
  repository.createIntentTransaction = async (work: any) => repository.transaction(work);
  return { repository, assignment, requests, grants, events, service: new StaffAccessService(repository),
    counts: () => [requests.size, grants.size, events.size] };
}
const intentInput = { createIntentId: '56b09719-0090-47d9-8fb6-34d3f504c98b', cabinetKey: 'buyer', organizationId: 'org-real',
  reason: 'Inspect original durable buyer receipt', ticketId: 'R1-INTENT-1', durationSeconds: 600 };
const genericIntentInput = { createIntentId: intentInput.createIntentId, assignmentId: 'assignment-owner', accessMode: StaffAccessMode.VIEW_AS,
  permissions: [StaffPermission.CABINET_VIEW_AS, StaffPermission.DEAL_READ], targetOrganizationId: 'org-real', targetRole: Role.BUYER,
  reason: intentInput.reason, ticketId: intentInput.ticketId, durationSeconds: 600 };

describe('Staff Access actor-bound immutable create intent', () => {
  it('replays the exact first Founder receipt after lost response and service restart without extra writes', async () => {
    const f = createIntentFixture();
    const first = await f.service.requestFounderRoleMode(owner, intentInput, 'original-correlation');
    const restarted = new StaffAccessService(f.repository);
    const again = await restarted.requestFounderRoleMode({ ...owner, sessionId: 'renewed-session' }, intentInput, 'new-correlation');
    expect(again).toEqual(first); expect(f.counts()).toEqual([1, 1, 1]);
    expect([...f.events.values()][0].correlation_id).toBe('original-correlation');
    expect(first.roleMode).toEqual(expect.objectContaining({ effectiveTenantId: 'tenant-real', effectiveRole: Role.BUYER }));
    const recovered = await restarted.recoverCreateIntent(owner, intentInput.createIntentId);
    expect(recovered.originalReceipt).toEqual(first);
    expect(JSON.stringify(recovered)).not.toMatch(/accessToken|token_hash|rawToken/);
  });

  it('replays before revoked assignment and missing current target without extending the original grant', async () => {
    const f = createIntentFixture(); const first = await f.service.requestFounderRoleMode(owner, intentInput);
    f.assignment.status = 'REVOKED'; f.repository.listActiveAssignments.mockResolvedValue([]);
    f.repository.resolveTargetScope.mockResolvedValue(null);
    const calls = f.repository.resolveTargetScope.mock.calls.length;
    expect(await f.service.requestFounderRoleMode(owner, intentInput)).toEqual(first);
    expect(f.repository.resolveTargetScope).toHaveBeenCalledTimes(calls);
    const recovered = await f.service.recoverCreateIntent(owner, intentInput.createIntentId);
    expect(recovered.originalReceipt).toEqual(first); expect(recovered.currentProjection.activationEligible).toBe(false);
    expect(f.counts()).toEqual([1, 1, 1]);
  });

  it.each(['reason', 'ticketId', 'durationSeconds', 'organizationId', 'cabinetKey'] as const)('rejects same-intent changed Founder %s with no writes', async field => {
    const f = createIntentFixture(); await f.service.requestFounderRoleMode(owner, intentInput);
    const changed = { ...intentInput, [field]: field === 'durationSeconds' ? 900 : field === 'cabinetKey' ? 'seller' : `${intentInput[field]}-different` };
    await expect(f.service.requestFounderRoleMode(owner, changed)).rejects.toMatchObject({ response: { code: 'STAFF_CREATE_INTENT_PAYLOAD_CONFLICT' } });
    expect(f.counts()).toEqual([1, 1, 1]);
  });

  it('shares actor+intent namespace across route kinds and rejects switching to generic', async () => {
    const f = createIntentFixture(); await f.service.requestFounderRoleMode(owner, intentInput);
    await expect(f.service.requestAccess(owner, genericIntentInput)).rejects.toMatchObject({ response: { code: 'STAFF_CREATE_INTENT_PAYLOAD_CONFLICT' } });
    expect(f.counts()).toEqual([1, 1, 1]);
  });

  it('normalizes a valid permission set order while rejecting duplicate and unknown permissions', async () => {
    const f = createIntentFixture(); const first = await f.service.requestAccess(owner, genericIntentInput);
    expect(await f.service.requestAccess(owner, { ...genericIntentInput, permissions: [...genericIntentInput.permissions].reverse() })).toEqual(first);
    await expect(f.service.requestAccess(owner, { ...genericIntentInput, permissions: [StaffPermission.CABINET_VIEW_AS, StaffPermission.CABINET_VIEW_AS] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(f.service.requestAccess(owner, { ...genericIntentInput, permissions: ['unknown'] as any })).rejects.toBeInstanceOf(BadRequestException);
    expect(f.counts()).toEqual([1, 1, 1]);
  });

  it.each(['tenantId', 'orgId', 'membershipId', 'id'] as const)('does not disclose a receipt to different authenticated %s', async field => {
    const f = createIntentFixture(); await f.service.requestFounderRoleMode(owner, intentInput);
    await expect(f.service.recoverCreateIntent({ ...owner, [field]: `${owner[field]}-foreign` }, intentInput.createIntentId)).rejects.toMatchObject({ status: 404 });
    expect(f.counts()).toEqual([1, 1, 1]);
  });

  it('rejects stale MFA, missing trusted context and invalid intent before any writes', async () => {
    const f = createIntentFixture();
    await expect(f.service.requestFounderRoleMode({ ...owner, mfaVerifiedAt: new Date(Date.now() - 901_000).toISOString() }, intentInput)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(f.service.requestFounderRoleMode({ ...owner, membershipId: undefined }, intentInput)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(f.service.requestFounderRoleMode(owner, { ...intentInput, createIntentId: 'not-an-intent' })).rejects.toBeInstanceOf(BadRequestException);
    expect(f.counts()).toEqual([0, 0, 0]);
  });

  it.each(['REVOKED', 'CONSUMED', 'EXPIRED'])('keeps original receipt unchanged when current grant is %s', async status => {
    const f = createIntentFixture(); const first = await f.service.requestFounderRoleMode(owner, intentInput);
    [...f.grants.values()][0].status = status;
    const recovered = await f.service.recoverCreateIntent(owner, intentInput.createIntentId);
    expect(recovered.originalReceipt).toEqual(first); expect(recovered.currentProjection.grantStatus).toBe(status);
    expect(recovered.currentProjection.activationEligible).toBe(false); expect(f.counts()).toEqual([1, 1, 1]);
  });

  it('keeps original PENDING receipt after independent approval creates a current grant', async () => {
    const f = createIntentFixture(StaffRole.SUPPORT_L2);
    const first = await f.service.requestAccess(owner, genericIntentInput);
    const request = [...f.requests.values()][0]; request.status = 'GRANTED'; request.version += 2;
    await f.repository.createGrant({}, { id: 'sag-approved-later', request, startsAt: new Date(), expiresAt: new Date(Date.now() + 600_000) });
    const recovered = await f.service.recoverCreateIntent(owner, intentInput.createIntentId);
    expect(first.status).toBe('PENDING'); expect(first.grantId).toBeNull(); expect(recovered.originalReceipt).toEqual(first);
    expect(recovered.currentProjection.grantId).toBe('sag-approved-later'); expect(f.counts()).toEqual([1, 1, 1]);
  });

  it.each(['missing-event', 'missing-request', 'wrong-hash', 'wrong-resource', 'wrong-grant', 'wrong-receipt', 'wrong-permissions'])(
    'fails closed for %s evidence and creates no replacement', async corruption => {
      const f = createIntentFixture(); await f.service.requestFounderRoleMode(owner, intentInput);
      const event = [...f.events.values()][0]; const request = [...f.requests.values()][0];
      if (corruption === 'missing-event') f.events.clear();
      if (corruption === 'missing-request') f.requests.clear();
      if (corruption === 'wrong-hash') event.hash = '0'.repeat(64);
      if (corruption === 'wrong-resource') event.resource_id = 'foreign-request';
      if (corruption === 'wrong-grant') event.grant_id = 'foreign-grant';
      if (corruption === 'wrong-receipt') event.metadata.createIntent.originalReceipt.expiresAt = new Date(0).toISOString();
      if (corruption === 'wrong-permissions') request.requested_permissions = ['invented'];
      const counts = f.counts();
      await expect(f.service.requestFounderRoleMode(owner, intentInput)).rejects.toMatchObject({ response: { code: 'STAFF_CREATE_RECEIPT_INVALID' } });
      expect(f.counts()).toEqual(counts);
    });

  it('rolls back request and grant when audit insert fails, preserving the original error', async () => {
    const f = createIntentFixture(); const failure = new Error('audit write failed');
    f.repository.insertEvent.mockRejectedValueOnce(failure);
    await expect(f.service.requestFounderRoleMode(owner, intentInput)).rejects.toMatchObject({ cause: failure, response: { code: 'STAFF_CREATE_OUTCOME_UNKNOWN', createIntentId: intentInput.createIntentId, recoveryRequired: true } });
    expect(f.counts()).toEqual([0, 0, 0]);
    await f.service.requestFounderRoleMode(owner, intentInput); expect(f.counts()).toEqual([1, 1, 1]);
  });
});


describe('Create-intent additive DTO rollout', () => {
  it.each([[RequestFounderRoleModeDto, intentInput], [RequestStaffAccessDto, genericIntentInput]] as const)(
    'preserves a valid client intent while legacy callers remain accepted', async (metatype, body) => {
      const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
      expect(await pipe.transform(body, { type: 'body', metatype })).toHaveProperty('createIntentId', body.createIntentId);
      const { createIntentId: _removed, ...legacy } = body;
      expect((await pipe.transform(legacy, { type: 'body', metatype })).createIntentId).toBeUndefined();
      await expect(pipe.transform({ ...body, createIntentId: 'invalid-key' }, { type: 'body', metatype })).rejects.toBeInstanceOf(BadRequestException);
    });
});


describe('Opt-in create receipt canonical target values', () => {
  it.each(['targetRole', 'targetDealId'] as const)(
    'preserves replay and exact recovery for a DTO-valid padded %s', async field => {
      const f = createIntentFixture();
      const canonical = { ...genericIntentInput, targetDealId: 'deal-real' };
      const padded = { ...canonical, [field]: ` ${canonical[field]} ` };
      const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
      const body = await pipe.transform(padded, { type: 'body', metatype: RequestStaffAccessDto });
      expect(body[field]).toBe(padded[field]);
      const first = await f.service.requestAccess(owner, body);
      expect(first.status).toBe('GRANTED');
      expect(await f.service.requestAccess(owner, body)).toEqual(first);
      expect(await f.service.requestAccess(owner, canonical)).toEqual(first);
      expect((await new StaffAccessService(f.repository).recoverCreateIntent(owner, body.createIntentId)).originalReceipt).toEqual(first);
      expect([...f.requests.values()][0].target_role).toBe(canonical.targetRole);
      expect([...f.requests.values()][0].target_deal_id).toBe(canonical.targetDealId);
      expect(f.counts()).toEqual([1, 1, 1]);
    },
  );
});

describe('Legacy create keeps its original target representation', () => {
  it('does not silently grant legacy requests the opt-in canonical receipt contract', async () => {
    const f = createIntentFixture();
    const { createIntentId: _unused, ...legacy } = genericIntentInput;
    const input = { ...legacy, targetRole: ` ${legacy.targetRole} `, targetDealId: ' deal-real ' };
    const first = await f.service.requestAccess(owner, input);
    expect(first.createIntentId).toBeUndefined();
    expect([...f.requests.values()][0].target_role).toBe(input.targetRole);
    expect([...f.requests.values()][0].target_deal_id).toBe(input.targetDealId);
    expect([...f.events.values()][0].metadata.createIntent).toBeUndefined();
    expect(f.counts()).toEqual([1, 1, 1]);
  });
});

describe('Exact intent receipt failure and lifetime boundaries', () => {
  it('recovers a committed create after the transaction response is lost without retrying a write', async () => {
    const f = createIntentFixture(); const transport = new Error('Commit response lost');
    let committed: unknown;
    f.repository.createIntentTransaction = async (work: any) => { committed = await f.repository.transaction(work); throw transport; };
    await expect(f.service.requestFounderRoleMode(owner, intentInput)).rejects.toMatchObject({ cause: transport, response: { code: 'STAFF_CREATE_OUTCOME_UNKNOWN', recoveryRequired: true } });
    expect(f.counts()).toEqual([1, 1, 1]);
    expect(await new StaffAccessService(f.repository).requestFounderRoleMode(owner, intentInput)).toEqual(committed);
    expect(f.counts()).toEqual([1, 1, 1]);
  });
  it('preserves expiry after time passes and requires current live activation checks', async () => {
    const f = createIntentFixture(); const first = await f.service.requestFounderRoleMode(owner, intentInput);
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date(Date.parse(first.expiresAt) + 1000));
      const renewed = { ...owner, mfaVerifiedAt: new Date().toISOString(), sessionId: 'renewed' };
      const recovered = await f.service.recoverCreateIntent(renewed, intentInput.createIntentId);
      expect(recovered.originalReceipt).toEqual(first); expect(recovered.currentProjection.activationEligible).toBe(false);
      expect(await f.service.requestFounderRoleMode(renewed, intentInput)).toEqual(first); expect(f.counts()).toEqual([1, 1, 1]);
    } finally { jest.useRealTimers(); }
  });
  it('uses exact keys when more than 200 newer display requests exist', async () => {
    const f = createIntentFixture(); const first = await f.service.requestFounderRoleMode(owner, intentInput);
    for (let i = 0; i < 201; i++) f.requests.set(`unrelated-${i}`, { id: `unrelated-${i}` });
    const recovered = await f.service.recoverCreateIntent(owner, intentInput.createIntentId);
    expect(recovered.originalReceipt).toEqual(first);
    expect(f.repository.getAccessRequest.mock.calls.at(-1)[1]).toBe(first.requestId);
    expect(f.counts()).toEqual([202, 1, 1]);
  });
  it('treats distinct intentional keys as separate operations even with equal bodies', async () => {
    const f = createIntentFixture(); const first = await f.service.requestFounderRoleMode(owner, intentInput);
    const second = await f.service.requestFounderRoleMode(owner, { ...intentInput, createIntentId: 'e8b52b38-99c2-4aa5-897d-74a0cb9c4f87' });
    expect(second.requestId).not.toBe(first.requestId); expect(f.counts()).toEqual([2, 2, 2]);
  });
});
