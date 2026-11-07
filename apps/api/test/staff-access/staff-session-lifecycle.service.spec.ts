import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser, Role } from '../../src/common/types/request-user';
import { StaffAccessRepository, StaffSessionRow } from '../../src/modules/staff-access/staff-access.repository';
import { StaffAccessService } from '../../src/modules/staff-access/staff-access.service';
import { StaffAccessMode, StaffRole } from '../../src/modules/staff-access/staff-access.types';

const actor: RequestUser = {
  id: 'staff-lifecycle-unit-actor', email: 'staff-lifecycle@example.test',
  orgId: 'staff-unit-org', tenantId: 'staff-unit-tenant', membershipId: 'staff-unit-membership', role: Role.ADMIN,
};
type AuditRow = { actorUserId: string; action: string; accessSessionId: string; outcome: string; metadata: unknown };
type State = { status: string; events: AuditRow[] };

// Repository transaction/fault boundary only. Native PostgreSQL rollback cases
// exercise this same production service in postgresql-staff-access.e2e-spec.ts.
function fixture(options: { role?: StaffRole | null; targetActor?: string; status?: string; expired?: boolean; omittedFromList?: boolean } = {}) {
  const target: StaffSessionRow = {
    id: 'staff-session-lifecycle-unit', grant_id: 'grant-lifecycle-unit', actor_user_id: options.targetActor ?? actor.id,
    staff_role: StaffRole.SUPPORT_L1, token_hash: 'isolated-unit-session-digest', status: options.status ?? 'ACTIVE',
    effective_tenant_id: 'target-unit-tenant', effective_organization_id: 'target-unit-org',
    effective_user_id: null, effective_role: Role.BUYER, target_deal_id: null,
    access_mode: StaffAccessMode.VIEW_AS, permissions: [], reason: 'Isolated lifecycle regression', ticket_id: 'LIFECYCLE-UNIT',
    mfa_level: 'TOTP', expires_at: new Date(Date.now() + (options.expired ? -60_000 : 300_000)), ended_at: null,
  };
  let committed: State = { status: target.status, events: [] };
  const prisma = {} as Prisma.TransactionClient;
  let tx: Prisma.TransactionClient;
  let pending: State;
  let commitFailure: Error | null = null;
  const role = options.role === undefined ? StaffRole.PLATFORM_OWNER : options.role;
  const stateFor = (client: Prisma.TransactionClient) => client === prisma ? committed : pending;
  const repository = {
    prisma,
    listActiveAssignments: jest.fn(async () => role ? [{ role }] : []),
    transaction: jest.fn(async (work: (client: Prisma.TransactionClient) => Promise<unknown>) => {
      tx = {} as Prisma.TransactionClient;
      pending = { status: committed.status, events: [...committed.events] };
      const result = await work(tx);
      if (commitFailure) throw commitFailure;
      committed = pending;
      return result;
    }),
    getActiveAccessSession: jest.fn(async (client: Prisma.TransactionClient, id: string, userId?: string) => {
      expect(client).toBe(tx);
      return id === target.id && (userId === undefined || target.actor_user_id === userId)
        && pending.status === 'ACTIVE' && target.expires_at > new Date() ? { ...target } : null;
    }),
    listActiveSessions: jest.fn(async (_client: Prisma.TransactionClient, userId?: string) =>
      !options.omittedFromList && committed.status === 'ACTIVE' && target.expires_at > new Date()
        && (userId === undefined || userId === target.actor_user_id) ? [target] : []),
    endAccessSession: jest.fn(async (client: Prisma.TransactionClient, id: string, userId: string, _reason: string) => {
      if (id !== target.id || userId !== target.actor_user_id || stateFor(client).status !== 'ACTIVE') return false;
      stateFor(client).status = 'ENDED'; return true;
    }),
    latestEventHash: jest.fn(async (_client: Prisma.TransactionClient, _actorId: string): Promise<string | null> => null),
    insertEvent: jest.fn(async (client: Prisma.TransactionClient, event: AuditRow) => {
      expect(client).toBe(tx);
      pending.events.push(event);
    }),
  };
  return {
    service: new StaffAccessService(repository as unknown as StaffAccessRepository), repository, target,
    state: () => committed, transactionClient: () => tx, failCommit: (error: Error) => { commitFailure = error; },
  };
}

describe('StaffAccessService atomic session lifecycle', () => {
  for (const method of ['endSession', 'revokeSession'] as const) {
    const action = method === 'endSession' ? 'staff.session.end' : 'staff.session.revoke';

    it(`${method} commits the state and one matching audit on the same transaction client`, async () => {
      const f = fixture();
      await expect(f.service[method](actor, f.target.id, 'Lifecycle reason', 'corr-lifecycle-unit'))
        .resolves.toEqual({ success: true, sessionId: f.target.id });
      expect(f.state().status).toBe('ENDED');
      expect(f.state().events).toHaveLength(1);
      expect(f.repository.endAccessSession).toHaveBeenCalledWith(f.transactionClient(), f.target.id, f.target.actor_user_id, 'Lifecycle reason');
      expect(f.repository.latestEventHash).toHaveBeenCalledWith(f.transactionClient(), actor.id);
      expect(f.repository.insertEvent.mock.calls[0][1]).toMatchObject({
        actorUserId: actor.id, staffRole: StaffRole.PLATFORM_OWNER, action, outcome: 'SUCCESS',
        accessSessionId: f.target.id, grantId: f.target.grant_id, ticketId: f.target.ticket_id,
        correlationId: 'corr-lifecycle-unit', reason: 'Lifecycle reason',
      });
      expect(f.repository.listActiveSessions).not.toHaveBeenCalled();
    });

    it(`${method} rolls back the status when audit insertion fails and permits a later audited retry`, async () => {
      const f = fixture(); const fault = new Error('Isolated audit insertion fault');
      f.repository.insertEvent.mockRejectedValueOnce(fault);
      await expect(f.service[method](actor, f.target.id, 'Lifecycle reason')).rejects.toBe(fault);
      expect(f.state()).toEqual({ status: 'ACTIVE', events: [] });
      await f.service[method](actor, f.target.id, 'Lifecycle retry');
      expect(f.state().status).toBe('ENDED'); expect(f.state().events).toHaveLength(1);
    });

    it(`${method} rolls back the status when the hash-chain read fails`, async () => {
      const f = fixture(); const fault = new Error('Isolated hash-chain fault');
      f.repository.latestEventHash.mockRejectedValueOnce(fault);
      await expect(f.service[method](actor, f.target.id)).rejects.toBe(fault);
      expect(f.state()).toEqual({ status: 'ACTIVE', events: [] });
      expect(f.repository.insertEvent).not.toHaveBeenCalled();
    });

    it(`${method} returns no success or committed audit when transaction commit fails`, async () => {
      const f = fixture(); const fault = new Error('Isolated aborted commit'); f.failCommit(fault);
      await expect(f.service[method](actor, f.target.id)).rejects.toBe(fault);
      expect(f.state()).toEqual({ status: 'ACTIVE', events: [] });
    });

    it.each([
      { code: 'P2034' }, { code: 'P2010', meta: { code: '40001' } }, { code: 'P2010', meta: { code: '40P01' } },
    ])(`${method} maps a known aborted concurrency conflict to a typed refresh-first 409 without automatic retries`, async (fields) => {
      const f = fixture(); f.failCommit(Object.assign(new Error('Isolated concurrency abort'), fields));
      await expect(f.service[method](actor, f.target.id)).rejects.toMatchObject({
        status: 409, response: { code: 'STAFF_SESSION_LIFECYCLE_CONFLICT', retryable: true },
      });
      expect(f.state()).toEqual({ status: 'ACTIVE', events: [] }); expect(f.repository.transaction).toHaveBeenCalledTimes(1);
    });

    it(`${method} does not reinterpret or retry a database permission denial`, async () => {
      const f = fixture(); const fault = Object.assign(new Error('Isolated permission denial'), { code: 'P2010', meta: { code: '42501' } });
      f.failCommit(fault);
      await expect(f.service[method](actor, f.target.id)).rejects.toBe(fault);
      expect(f.state()).toEqual({ status: 'ACTIVE', events: [] }); expect(f.repository.transaction).toHaveBeenCalledTimes(1);
    });

    it(`${method} reaches an exact active ID omitted from the display window`, async () => {
      const f = fixture({ omittedFromList: true });
      await f.service[method](actor, f.target.id);
      expect(f.state().status).toBe('ENDED'); expect(f.state().events).toHaveLength(1);
      expect(f.repository.listActiveSessions).not.toHaveBeenCalled();
    });

    it(`${method} does not append success when a conditional update loses its target`, async () => {
      const f = fixture(); f.repository.endAccessSession.mockResolvedValueOnce(false);
      await expect(f.service[method](actor, f.target.id)).rejects.toBeInstanceOf(ConflictException);
      expect(f.state()).toEqual({ status: 'ACTIVE', events: [] });
      expect(f.repository.insertEvent).not.toHaveBeenCalled();
    });

    it.each([{ status: 'ENDED' }, { expired: true }])(`${method} denies an inactive or expired target without a state write`, async (options) => {
      const f = fixture(options);
      await expect(f.service[method](actor, f.target.id)).rejects.toBeInstanceOf(NotFoundException);
      expect(f.repository.endAccessSession).not.toHaveBeenCalled(); expect(f.repository.insertEvent).not.toHaveBeenCalled();
    });

    it(`${method} rejects a nonexistent ID without a state write`, async () => {
      const f = fixture();
      await expect(f.service[method](actor, 'not-the-target')).rejects.toBeInstanceOf(NotFoundException);
      expect(f.state()).toEqual({ status: 'ACTIVE', events: [] });
      expect(f.repository.endAccessSession).not.toHaveBeenCalled();
    });

    it(`${method} denies an actor with no active staff assignment before a lifecycle transaction`, async () => {
      const f = fixture({ role: null });
      await expect(f.service[method](actor, f.target.id)).rejects.toBeInstanceOf(ForbiddenException);
      expect(f.repository.transaction).not.toHaveBeenCalled(); expect(f.repository.endAccessSession).not.toHaveBeenCalled();
    });

    it(`${method} does not create a second success audit on repeated completion`, async () => {
      const f = fixture(); await f.service[method](actor, f.target.id);
      await expect(f.service[method](actor, f.target.id)).rejects.toBeInstanceOf(NotFoundException);
      expect(f.state().events).toHaveLength(1);
    });
  }

  it('own-session ending binds the exact actor and denies another actor session', async () => {
    const f = fixture({ targetActor: 'another-staff-actor' });
    await expect(f.service.endSession(actor, f.target.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(f.repository.getActiveAccessSession).toHaveBeenCalledWith(f.transactionClient(), f.target.id, actor.id);
    expect(f.state()).toEqual({ status: 'ACTIVE', events: [] });
  });

  it('revocation keeps the operator permission check before an unscoped target lookup', async () => {
    const f = fixture({ role: StaffRole.SUPPORT_L1, targetActor: 'another-staff-actor' });
    await expect(f.service.revokeSession(actor, f.target.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.repository.transaction).not.toHaveBeenCalled(); expect(f.repository.getActiveAccessSession).not.toHaveBeenCalled();
  });

  it('an authorized operator revokes another actor and audits the correct target actor and grant', async () => {
    const f = fixture({ role: StaffRole.PLATFORM_ADMIN, targetActor: 'another-staff-actor' });
    await f.service.revokeSession(actor, f.target.id, 'Operator revocation');
    expect(f.repository.getActiveAccessSession).toHaveBeenCalledWith(f.transactionClient(), f.target.id);
    expect(f.repository.insertEvent.mock.calls[0][1]).toMatchObject({
      actorUserId: actor.id, staffRole: StaffRole.PLATFORM_ADMIN, grantId: f.target.grant_id,
      metadata: { targetActorUserId: 'another-staff-actor' },
    });
    expect(f.state().status).toBe('ENDED');
  });
});
