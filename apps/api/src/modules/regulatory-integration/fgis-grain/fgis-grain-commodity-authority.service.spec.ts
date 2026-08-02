import { ForbiddenException } from '@nestjs/common';
import { Role, type RequestUser } from '../../../common/types/request-user';
import { FgisGrainCommodityAuthorityService } from './fgis-grain-commodity-authority.service';

function user(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'user-1',
    email: 'seller@example.test',
    role: Role.FARMER,
    orgId: 'org-1',
    tenantId: 'tenant-1',
    sessionId: 'session-1',
    membershipId: 'membership-1',
    mfaVerified: false,
    ...overrides,
  };
}

function fixture() {
  const accepted = { ok: true, auditId: 'audit-1', outboxId: 'outbox-1', duplicate: false };
  const repository = {
    bindConnection: jest.fn().mockResolvedValue(accepted),
    startSyncRun: jest.fn().mockResolvedValue(accepted),
    acceptPartySnapshot: jest.fn().mockResolvedValue(accepted),
    reserveVolume: jest.fn().mockResolvedValue(accepted),
    transitionReservation: jest.fn().mockResolvedValue(accepted),
    createLotPassport: jest.fn().mockResolvedValue(accepted),
    sealLotPassport: jest.fn().mockResolvedValue(accepted),
    openReconciliationCase: jest.fn().mockResolvedValue(accepted),
  };
  return {
    repository,
    service: new FgisGrainCommodityAuthorityService(repository as never),
  };
}

const meta = {
  commandId: 'command-1',
  idempotencyKey: 'idem-1',
  correlationId: 'corr-1',
};

describe('FgisGrainCommodityAuthorityService', () => {
  it('requires an MFA-backed organization admin before binding a connection', async () => {
    const { service, repository } = fixture();
    await expect(
      service.bindConnection(user(), {
        ...meta,
        providerConfigurationId: 'config-1',
        expectedVersion: '0',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.bindConnection(user({ role: Role.ADMIN, mfaVerified: false }), {
        ...meta,
        providerConfigurationId: 'config-1',
        expectedVersion: '0',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.bindConnection).not.toHaveBeenCalled();
  });

  it('passes a validated connection command without accepting tenant or organization fields', async () => {
    const { service, repository } = fixture();
    await service.bindConnection(user({ role: Role.ADMIN, mfaVerified: true }), {
      ...meta,
      providerConfigurationId: 'config-1',
      expectedVersion: '0',
      tenantId: 'forged-tenant',
      organizationId: 'forged-org',
    });
    expect(repository.bindConnection).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', orgId: 'org-1' }),
      {
        ...meta,
        providerConfigurationId: 'config-1',
        expectedVersion: '0',
      },
    );
  });

  it('requires commodity volume as a decimal string and never accepts a JS float', async () => {
    const { service, repository } = fixture();
    await expect(
      service.reserveVolume(user(), {
        ...meta,
        partyCurrentId: 'party-1',
        sourceSnapshotId: 'snapshot-1',
        volume: 12.5,
        unit: 'TNE',
        reason: 'Seller lot draft',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        expectedPartyVersion: '1',
      }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(repository.reserveVolume).not.toHaveBeenCalled();
  });

  it('validates and delegates a seller reservation command', async () => {
    const { service, repository } = fixture();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    await service.reserveVolume(user(), {
      ...meta,
      partyCurrentId: 'party-1',
      sourceSnapshotId: 'snapshot-1',
      volume: '12.500000',
      unit: 'TNE',
      reason: 'Seller lot draft',
      expiresAt,
      expectedPartyVersion: '1',
    });
    expect(repository.reserveVolume).toHaveBeenCalledWith(
      expect.objectContaining({ role: Role.FARMER }),
      expect.objectContaining({
        volume: '12.500000',
        unit: 'TNE',
        partyCurrentId: 'party-1',
      }),
    );
  });

  it('does not expose the provider snapshot persistence command to a seller', async () => {
    const { service, repository } = fixture();
    await expect(
      service.acceptPartySnapshot(user(), {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.acceptPartySnapshot).not.toHaveBeenCalled();
  });

  it('requires MFA-backed operational authority for reconciliation', async () => {
    const { service, repository } = fixture();
    await expect(
      service.openReconciliationCase(
        user({ role: Role.COMPLIANCE_OFFICER, mfaVerified: false }),
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.openReconciliationCase).not.toHaveBeenCalled();
  });
});
