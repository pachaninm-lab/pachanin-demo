import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';
import type {
  CommodityProfileCommand,
  CommodityProfileCommandReceipt,
} from './commodity-profile-command.contract';
import {
  CommodityProfileTransactionCommandService,
  type CommodityProfileAtomicWrite,
  type CommodityProfileCommandSnapshot,
  type CommodityProfileTransactionPort,
} from './commodity-profile-transaction-command.service';

const user = {
  id: 'user-admin-001',
  orgId: 'org-platform-001',
  tenantId: 'tenant-platform-001',
  role: 'ADMIN',
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

function receipt(overrides: Partial<CommodityProfileCommandReceipt> = {}): CommodityProfileCommandReceipt {
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
    requestFingerprint: 'stored-fingerprint',
    committedAt: '2026-07-21T00:00:00.000Z',
    ...overrides,
  };
}

class FakePort implements CommodityProfileTransactionPort {
  replay: CommodityProfileCommandReceipt | null = null;
  snapshot: CommodityProfileCommandSnapshot = {
    profileId: command.profileId,
    profileVersionId: command.profileVersionId,
    lifecycle: 'REVIEW',
    classification: 'INTERNAL',
    version: '7',
  };
  committed: CommodityProfileAtomicWrite[] = [];
  replayCalls: Array<{ actor: RequestUser; command: CommodityProfileCommand }> = [];
  snapshotCalls: Array<{ actor: RequestUser; command: CommodityProfileCommand }> = [];

  async findReplay(
    actor: RequestUser,
    candidate: CommodityProfileCommand,
  ): Promise<CommodityProfileCommandReceipt | null> {
    this.replayCalls.push({ actor, command: candidate });
    return this.replay;
  }

  async loadSnapshot(
    actor: RequestUser,
    candidate: CommodityProfileCommand,
  ): Promise<CommodityProfileCommandSnapshot> {
    this.snapshotCalls.push({ actor, command: candidate });
    return this.snapshot;
  }

  async commitAtomic(write: CommodityProfileAtomicWrite): Promise<CommodityProfileCommandReceipt> {
    this.committed.push(write);
    return receipt({ requestFingerprint: write.requestFingerprint });
  }
}

describe('CommodityProfileTransactionCommandService', () => {
  it('commits an allowed lifecycle transition through one atomic port call', async () => {
    const port = new FakePort();
    const service = new CommodityProfileTransactionCommandService(port);

    const result = await service.execute(user, command, { hasJitAuthority: true });

    expect(result.lifecycle).toBe('APPROVED');
    expect(port.replayCalls[0]).toEqual({ actor: user, command });
    expect(port.snapshotCalls[0]).toEqual({ actor: user, command });
    expect(port.committed).toHaveLength(1);
    expect(port.committed[0]).toMatchObject({ fromLifecycle: 'REVIEW', toLifecycle: 'APPROVED' });
  });

  it('returns the original receipt on exact replay without a second authority read or commit', async () => {
    const port = new FakePort();
    const service = new CommodityProfileTransactionCommandService(port);
    const first = await service.execute(user, command, { hasJitAuthority: true });
    port.replay = first;
    port.committed = [];
    port.snapshotCalls = [];

    const replayed = await service.execute(user, command, { hasJitAuthority: true });

    expect(replayed.replayed).toBe(true);
    expect(port.snapshotCalls).toHaveLength(0);
    expect(port.committed).toHaveLength(0);
  });

  it('fails closed when the authoritative PostgreSQL version is stale', async () => {
    const port = new FakePort();
    port.snapshot = { ...port.snapshot, version: '8' };
    const service = new CommodityProfileTransactionCommandService(port);

    await expect(service.execute(user, command, { hasJitAuthority: true }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(port.committed).toHaveLength(0);
  });

  it('requires JIT authority for privileged lifecycle actions', async () => {
    const port = new FakePort();
    const service = new CommodityProfileTransactionCommandService(port);

    await expect(service.execute(user, command, { hasJitAuthority: false }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(port.committed).toHaveLength(0);
  });
});
