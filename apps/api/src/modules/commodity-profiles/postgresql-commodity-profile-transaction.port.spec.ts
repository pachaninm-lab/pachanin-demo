import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/types/request-user';
import {
  commodityProfileCommandFingerprint,
  type CommodityProfileCommand,
  type CommodityProfileCommandReceipt,
} from './commodity-profile-command.contract';
import { PostgresqlCommodityProfileTransactionPort } from './postgresql-commodity-profile-transaction.port';
import type { CommodityProfileAtomicWrite } from './commodity-profile-transaction-command.service';

const actor = {
  id: 'user-admin-001',
  orgId: 'org-platform-001',
  tenantId: 'tenant-platform-001',
  role: 'ADMIN',
  email: 'admin@example.test',
  sessionId: 'session-admin-001',
  membershipId: 'membership-admin-001',
  mfaVerified: true,
  staffRoles: ['PLATFORM_ADMIN', 'COMPLIANCE_CONTROL'],
} as RequestUser;

const command: CommodityProfileCommand = {
  commandId: 'cmd-profile-approve-001',
  idempotencyKey: 'idem-profile-approve-001',
  correlationId: 'corr-profile-approve-001',
  profileId: 'profile-wheat-001',
  profileVersionId: 'profile-version-wheat-003',
  action: 'APPROVE',
  expectedVersion: '7',
  reason: 'Профиль проверен комплаенсом и готов к утверждению.',
  payload: { sourceStatus: 'VERIFIED' },
};

const now = new Date('2026-07-21T01:00:00.000Z');
const profile = {
  id: command.profileId,
  classification: 'INTERNAL',
  version: 7n,
  canonicalCode: 'WHEAT.FOOD',
  archetype: 'DRY_BULK',
  authoritativeNameRu: 'Пшеница продовольственная',
  displayNameEn: 'Food wheat',
  displayNameZh: null,
  updatedAt: new Date('2026-07-20T00:00:00.000Z'),
};
const version = {
  id: command.profileVersionId!,
  profileId: command.profileId,
  sequence: 3,
  status: 'REVIEW',
  content: { quality: [] },
  contentHash: 'a'.repeat(64),
  sourceStatus: 'VERIFIED',
  effectiveFrom: null,
  effectiveTo: null,
  approvalReason: null,
  approvedByUserId: null,
  approvedAt: null,
  version: 2n,
  updatedAt: new Date('2026-07-20T00:00:00.000Z'),
};
const approvedVersion = {
  ...version,
  status: 'APPROVED',
  approvalReason: command.reason,
  approvedByUserId: actor.id,
  approvedAt: now,
  version: 3n,
  updatedAt: now,
};

function atomicWrite(): CommodityProfileAtomicWrite {
  return {
    command,
    actor,
    requestFingerprint: commodityProfileCommandFingerprint(command),
    fromLifecycle: 'REVIEW',
    toLifecycle: 'APPROVED',
  };
}

function receipt(): CommodityProfileCommandReceipt {
  return {
    commandId: command.commandId,
    idempotencyKey: command.idempotencyKey,
    correlationId: command.correlationId,
    profileId: command.profileId,
    profileVersionId: command.profileVersionId,
    action: command.action,
    lifecycle: 'APPROVED',
    version: '8',
    replayed: false,
    requestFingerprint: commodityProfileCommandFingerprint(command),
    committedAt: now.toISOString(),
  };
}

function makeHarness(options: {
  profileVersion?: bigint;
  replay?: CommodityProfileCommandReceipt | null;
  failAudit?: boolean;
} = {}) {
  const queryResponses: unknown[][] = [
    [],
    [],
    [{ now }],
    [{ ...profile, version: options.profileVersion ?? profile.version }],
    [version],
    [{ version: 8n }],
  ];
  const outboxEntry = {
    findUnique: jest.fn(async () => options.replay
      ? {
          payload: {
            schema: 'commodity-profile.command.v1',
            requestFingerprint: options.replay.requestFingerprint,
            receipt: options.replay,
            event: {},
          },
        }
      : null),
    create: jest.fn(async () => ({ id: 'outbox-1' })),
  };
  const commodityProfileVersion = {
    update: jest.fn(async () => approvedVersion),
  };
  const commodityProfileTransition = {
    findFirst: jest.fn(async () => ({ toStatus: 'REVIEW', hash: 'b'.repeat(64) })),
    create: jest.fn(async () => ({ id: 'transition-1' })),
  };
  const auditEvent = {
    findFirst: jest.fn(async () => ({ hash: 'c'.repeat(64) })),
    create: jest.fn(async () => {
      if (options.failAudit) throw new Error('forced audit collision');
      return { id: 'audit-1' };
    }),
  };
  const tx = {
    $queryRaw: jest.fn(async () => queryResponses.shift() ?? []),
    outboxEntry,
    commodityProfile: {
      findUnique: jest.fn(async () => ({ version: options.profileVersion ?? profile.version })),
      create: jest.fn(),
    },
    commodityProfileVersion,
    commodityProfileTransition,
    auditEvent,
  };
  const context = {
    userId: actor.id,
    orgId: actor.orgId,
    tenantId: actor.tenantId!,
    role: actor.role,
    sessionId: actor.sessionId!,
  };
  const rls = {
    withTrustedContext: jest.fn(async (
      _user: RequestUser,
      work: (client: typeof tx, trusted: typeof context) => Promise<unknown>,
      _options?: unknown,
    ) => work(tx, context)),
  };
  return {
    port: new PostgresqlCommodityProfileTransactionPort(rls as never),
    rls,
    tx,
    outboxEntry,
    commodityProfileVersion,
    commodityProfileTransition,
    auditEvent,
  };
}

describe('PostgresqlCommodityProfileTransactionPort', () => {
  it('commits lifecycle transition, immutable audit and durable outbox in one serializable callback', async () => {
    const harness = makeHarness();

    const result = await harness.port.commitAtomic(atomicWrite());

    expect(result).toMatchObject({ lifecycle: 'APPROVED', version: '8', replayed: false });
    expect(harness.rls.withTrustedContext).toHaveBeenCalledWith(
      actor,
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      }),
    );
    expect(harness.commodityProfileVersion.update).toHaveBeenCalledTimes(1);
    expect(harness.commodityProfileTransition.create).toHaveBeenCalledTimes(1);
    expect(harness.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(harness.outboxEntry.create).toHaveBeenCalledTimes(1);
    expect(harness.commodityProfileTransition.create.mock.invocationCallOrder[0])
      .toBeLessThan(harness.auditEvent.create.mock.invocationCallOrder[0]!);
    expect(harness.auditEvent.create.mock.invocationCallOrder[0])
      .toBeLessThan(harness.outboxEntry.create.mock.invocationCallOrder[0]!);
  });

  it('rechecks idempotency after acquiring the transaction lock and performs no second write', async () => {
    const stored = receipt();
    const harness = makeHarness({ replay: stored });

    const result = await harness.port.commitAtomic(atomicWrite());

    expect(result).toEqual({ ...stored, replayed: true });
    expect(harness.tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(harness.commodityProfileVersion.update).not.toHaveBeenCalled();
    expect(harness.commodityProfileTransition.create).not.toHaveBeenCalled();
    expect(harness.auditEvent.create).not.toHaveBeenCalled();
    expect(harness.outboxEntry.create).not.toHaveBeenCalled();
  });

  it('rejects a stale aggregate version before transition, audit or outbox effects', async () => {
    const harness = makeHarness({ profileVersion: 8n });

    await expect(harness.port.commitAtomic(atomicWrite()))
      .rejects.toBeInstanceOf(ConflictException);

    expect(harness.commodityProfileVersion.update).not.toHaveBeenCalled();
    expect(harness.commodityProfileTransition.create).not.toHaveBeenCalled();
    expect(harness.auditEvent.create).not.toHaveBeenCalled();
    expect(harness.outboxEntry.create).not.toHaveBeenCalled();
  });

  it('does not enqueue outbox when audit persistence fails, leaving rollback to the transaction authority', async () => {
    const harness = makeHarness({ failAudit: true });

    await expect(harness.port.commitAtomic(atomicWrite()))
      .rejects.toThrow('forced audit collision');

    expect(harness.commodityProfileTransition.create).toHaveBeenCalledTimes(1);
    expect(harness.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(harness.outboxEntry.create).not.toHaveBeenCalled();
  });
});
