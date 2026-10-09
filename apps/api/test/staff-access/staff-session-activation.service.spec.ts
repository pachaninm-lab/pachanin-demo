import { Prisma } from '@prisma/client';
import { RequestUser, Role } from '../../src/common/types/request-user';
import {
  StaffAccessRepository,
  StaffGrantRow,
  StaffSessionRow,
  StaffSessionActivationRetryExhaustedError,
} from '../../src/modules/staff-access/staff-access.repository';
import { StaffAccessService } from '../../src/modules/staff-access/staff-access.service';
import { StaffAccessMode, StaffPermission, StaffRole } from '../../src/modules/staff-access/staff-access.types';

const actor: RequestUser = {
  id: 'staff-activation-unit-actor', email: 'staff-activation@example.test',
  orgId: 'staff-unit-org', tenantId: 'staff-unit-tenant', membershipId: 'staff-unit-membership',
  role: Role.ADMIN, mfaVerified: true, mfaVerifiedAt: new Date().toISOString(),
};

function grant(id: string, mode: StaffAccessMode): StaffGrantRow {
  return {
    id, request_id: 'request-'+id, grantee_user_id: actor.id, assignment_id: 'assignment-unit',
    staff_role: StaffRole.PLATFORM_OWNER, access_mode: mode, status: 'ACTIVE',
    target_tenant_id: actor.tenantId!, target_organization_id: actor.orgId!,
    target_user_id: null, target_role: Role.BUYER, target_deal_id: null,
    permissions: [StaffPermission.CABINET_VIEW_AS, StaffPermission.DEAL_READ],
    starts_at: new Date(Date.now()-1_000), expires_at: new Date(Date.now()+300_000),
    reason: 'Isolated actor activation regression', ticket_id: 'STAFF-UNIT-ACTIVATE',
  };
}

function fixture(grants: StaffGrantRow[]) {
  const tx = {} as Prisma.TransactionClient;
  const sessions: Array<{ id: string; grantId: string }> = [];
  const repository = {
    activateSessionTransaction: jest.fn((work: (client: Prisma.TransactionClient) => Promise<unknown>) => work(tx)),
    getGrant: jest.fn(async (_client: Prisma.TransactionClient, id: string) => grants.find(g=>g.id===id) ?? null),
    hasActiveSession: jest.fn(async () => sessions.length > 0),
    createAccessSession: jest.fn(async (_client: Prisma.TransactionClient, input: { id: string; grant: StaffGrantRow }) => {
      sessions.push({ id: input.id, grantId: input.grant.id });
    }),
    latestEventHash: jest.fn().mockResolvedValue(null),
    insertEvent: jest.fn().mockResolvedValue(undefined),
    listActiveSessions: jest.fn(() => { throw new Error('Capped display list must not authorize activation'); }),
  };
  return { service: new StaffAccessService(repository as unknown as StaffAccessRepository), repository, sessions, tx };
}

describe('StaffAccessService actor-wide session activation', () => {
  it('creates exactly one audited session for an actor with no active session', async () => {
    const f=fixture([grant('grant-a', StaffAccessMode.VIEW_AS)]);
    const result=await f.service.activateGrant(actor, 'grant-a', undefined, undefined, 'corr-staff-unit');
    expect(f.sessions).toEqual([{ id: result.accessSessionId, grantId: 'grant-a' }]);
    expect(f.repository.hasActiveSession).toHaveBeenCalledWith(f.tx, actor.id);
    expect(f.repository.createAccessSession).toHaveBeenCalledTimes(1);
    expect(f.repository.insertEvent).toHaveBeenCalledTimes(1);
    expect(f.repository.insertEvent.mock.calls[0][1]).toMatchObject({
      actorUserId: actor.id, accessSessionId: result.accessSessionId,
      action: 'staff.session.activate', outcome: 'SUCCESS', correlationId: 'corr-staff-unit',
    });
    expect(f.repository.listActiveSessions).not.toHaveBeenCalled();
  });

  it('rejects the same grant with a stable typed 409 and no second success audit', async () => {
    const f=fixture([grant('grant-a', StaffAccessMode.VIEW_AS)]);
    await f.service.activateGrant(actor, 'grant-a');
    await expect(f.service.activateGrant(actor, 'grant-a')).rejects.toMatchObject({
      status: 409, response: { code: 'STAFF_ACTIVE_SESSION_CONFLICT' },
    });
    expect(f.sessions).toHaveLength(1);
    expect(f.repository.createAccessSession).toHaveBeenCalledTimes(1);
    expect(f.repository.insertEvent).toHaveBeenCalledTimes(1);
  });

  it.each([
    [StaffAccessMode.VIEW_AS, StaffAccessMode.VIEW_AS],
    [StaffAccessMode.VIEW_AS, StaffAccessMode.ASSISTED],
    [StaffAccessMode.ASSISTED, StaffAccessMode.VIEW_AS],
    [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS],
  ])('excludes a cookie-less different-grant %s → %s activation without evicting the current session', async (first, second) => {
    const f=fixture([grant('grant-a', first), grant('grant-b', second)]);
    const current=await f.service.activateGrant(actor, 'grant-a');
    await expect(f.service.activateGrant(actor, 'grant-b')).rejects.toMatchObject({
      status: 409, response: { code: 'STAFF_ACTIVE_SESSION_CONFLICT' },
    });
    expect(f.sessions).toEqual([{ id: current.accessSessionId, grantId: 'grant-a' }]);
    expect(f.repository.createAccessSession).toHaveBeenCalledTimes(1);
    expect(f.repository.insertEvent).toHaveBeenCalledTimes(1);
  });

  it('rejects absent MFA before entering any activation transaction', async () => {
    const f=fixture([grant('grant-a', StaffAccessMode.VIEW_AS)]);
    await expect(f.service.activateGrant({ ...actor, mfaVerified: false }, 'grant-a')).rejects.toMatchObject({ status: 403 });
    expect(f.repository.activateSessionTransaction).not.toHaveBeenCalled();
    expect(f.repository.createAccessSession).not.toHaveBeenCalled();
    expect(f.repository.insertEvent).not.toHaveBeenCalled();
  });

  it('rejects an expired grant before reading or creating an actor session', async () => {
    const expired=grant('grant-a', StaffAccessMode.VIEW_AS); expired.expires_at=new Date(Date.now()-1_000);
    const f=fixture([expired]);
    await expect(f.service.activateGrant(actor, 'grant-a')).rejects.toMatchObject({ status: 409 });
    expect(f.repository.hasActiveSession).not.toHaveBeenCalled();
    expect(f.repository.createAccessSession).not.toHaveBeenCalled();
    expect(f.repository.insertEvent).not.toHaveBeenCalled();
  });

  it('reports bounded serialization exhaustion as a distinct retryable conflict', async () => {
    const f=fixture([grant('grant-a', StaffAccessMode.VIEW_AS)]);
    f.repository.activateSessionTransaction.mockRejectedValueOnce(new StaffSessionActivationRetryExhaustedError());
    await expect(f.service.activateGrant(actor, 'grant-a')).rejects.toMatchObject({
      status: 409, response: { code: 'STAFF_SESSION_ACTIVATION_CONFLICT', retryable: true },
    });
    expect(f.repository.createAccessSession).not.toHaveBeenCalled();
    expect(f.repository.insertEvent).not.toHaveBeenCalled();
  });
});

describe('StaffAccessService exact resolved assignment ceiling', () => {
  function session(overrides: Partial<StaffSessionRow> = {}): StaffSessionRow {
    return {
      id: 'session-resolution-unit', grant_id: 'grant-resolution-unit', actor_user_id: actor.id,
      staff_role: StaffRole.PLATFORM_ADMIN, token_hash: 'resolution-unit-hash', status: 'ACTIVE',
      effective_tenant_id: actor.tenantId!, effective_organization_id: actor.orgId!,
      effective_user_id: null, effective_role: null, target_deal_id: null,
      access_mode: StaffAccessMode.JIT_PRIVILEGED, permissions: [StaffPermission.CRITICAL_ACTION_REQUEST],
      reason: 'Isolated exact linked resolution test', ticket_id: 'STAFF-UNIT-RESOLVE', mfa_level: 'TOTP',
      expires_at: new Date(Date.now() + 60_000), ended_at: null, ...overrides,
    };
  }

  function resolutionFixture(value: StaffSessionRow | null) {
    const repository = {
      prisma: {}, getAccessSessionByHash: jest.fn().mockResolvedValue(value),
      touchAccessSession: jest.fn().mockResolvedValue(undefined),
    };
    return { repository, service: new StaffAccessService(repository as unknown as StaffAccessRepository) };
  }

  it('returns valid exact-session authority and retains its bounded expiry', async () => {
    const value = session(); const f = resolutionFixture(value);
    const context = await f.service.resolveAccessSession({ ...actor, staffRoles: [StaffRole.PLATFORM_OWNER] }, 'isolated-unit-token');
    expect(context).toMatchObject({ actorUserId: actor.id, staffRole: StaffRole.PLATFORM_ADMIN, grantId: value.grant_id, expiresAt: value.expires_at });
    expect(f.repository.touchAccessSession).toHaveBeenCalledWith(f.repository.prisma, value.id);
  });

  it.each([
    { staff_role: StaffRole.SUPPORT_L1 },
    { staff_role: StaffRole.SUPPORT_L2, access_mode: StaffAccessMode.CONTROL_PLANE },
    { staff_role: StaffRole.PLATFORM_OWNER, access_mode: StaffAccessMode.VIEW_AS, permissions: [StaffPermission.CABINET_VIEW_AS, StaffPermission.CRITICAL_ACTION_REQUEST] },
    { staff_role: StaffRole.PLATFORM_OWNER, access_mode: StaffAccessMode.BREAK_GLASS, permissions: [StaffPermission.PAYMENT_MANUAL_REVIEW] },
    { permissions: [StaffPermission.CRITICAL_ACTION_REQUEST, 'unknown:permission'] },
    { permissions: [StaffPermission.CRITICAL_ACTION_REQUEST, StaffPermission.CRITICAL_ACTION_REQUEST] },
    { permissions: [] }, { permissions: null }, { expires_at: new Date('invalid') },
    { expires_at: new Date(Date.now() - 1_000) }, { actor_user_id: 'another-actor' },
  ])('denies invalid exact-session authority despite another qualifying actor assignment', async (patch) => {
    const f = resolutionFixture(session(patch));
    await expect(f.service.resolveAccessSession({ ...actor, staffRoles: [StaffRole.PLATFORM_OWNER] }, 'isolated-unit-token')).rejects.toMatchObject({ status: 401 });
    expect(f.repository.touchAccessSession).not.toHaveBeenCalled();
  });

  it('does not recover authority when the exact linked repository read denies it', async () => {
    const f = resolutionFixture(null);
    await expect(f.service.resolveAccessSession({ ...actor, staffRoles: [StaffRole.PLATFORM_OWNER] }, 'isolated-unit-token')).rejects.toMatchObject({ status: 401 });
    expect(f.repository.touchAccessSession).not.toHaveBeenCalled();
  });
});
