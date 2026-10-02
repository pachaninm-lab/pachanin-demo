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

function validSnapshotCommand() {
  return {
    ...meta,
    connectionId: 'connection-1',
    syncRunId: 'sync-run-1',
    expectedCurrentVersion: '0',
    snapshot: {
      externalPartyId: 'party-1',
      externalPartyNumber: 'party-number-1',
      externalRecordId: 'record-1',
      adapterVersion: 'fgis-zerno-1.0.23-catalog.v1',
      contractVersion: '1.0.23',
      ownerReference: 'owner://org-1',
      agentReference: null,
      repositoryReference: 'repository://org-1/elevator',
      productCode: 'WHEAT',
      productName: 'Пшеница',
      okpd2Code: '01.11.11',
      tnvedCode: '1001',
      targetCode: 'FOOD',
      purposeCode: 'SALE',
      harvestYear: '2026',
      storagePlace: { name: 'Элеватор Южный', region: '23' },
      amountOriginal: '120.000000',
      amountAvailable: '100.000000',
      sourceUnitCode: 'TNE',
      normalizedUnitCode: 'TNE',
      unitAuthority: 'PROVIDER',
      qualityValues: { protein: { value: '12.4', sourceCode: 'FGIS' } },
      externalStatus: 'SUBSCRIBED',
      sourceRegisteredAt: new Date(Date.now() - 60_000).toISOString(),
      sourceUpdatedAt: new Date().toISOString(),
      organicFlag: false,
      quarantineZoneFlag: false,
      payloadHash: 'a'.repeat(64),
      criticalHash: 'b'.repeat(64),
      protectedRawReference: 'evidence://fgis-grain/party-1/a',
    },
  };
}

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

  it('does not expose snapshot ingestion to a seller or organization admin', async () => {
    const { service, repository } = fixture();
    await expect(service.acceptPartySnapshot(user(), validSnapshotCommand())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.acceptPartySnapshot(
        user({ role: Role.ADMIN, mfaVerified: true }),
        validSnapshotCommand(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.acceptPartySnapshot).not.toHaveBeenCalled();
  });

  it('delegates snapshot ingestion only for the server-derived provider principal', async () => {
    const { service, repository } = fixture();
    const provider: RequestUser = {
      id: 'service-fgis-grain-provider',
      email: 'service-fgis-grain-provider@internal.invalid',
      role: Role.FGIS_GRAIN_PROVIDER,
      orgId: 'org-1',
      tenantId: 'tenant-1',
    };

    await service.acceptPartySnapshot(provider, validSnapshotCommand());

    expect(repository.acceptPartySnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'service-fgis-grain-provider',
        role: Role.FGIS_GRAIN_PROVIDER,
        tenantId: 'tenant-1',
        orgId: 'org-1',
      }),
      expect.objectContaining({
        connectionId: 'connection-1',
        syncRunId: 'sync-run-1',
        expectedCurrentVersion: '0',
      }),
    );
  });

  it('rejects a provider principal that carries a human session or membership', async () => {
    const { service, repository } = fixture();
    await expect(
      service.acceptPartySnapshot(
        user({
          role: Role.FGIS_GRAIN_PROVIDER,
          id: 'service-fgis-grain-provider',
          sessionId: 'human-session',
          membershipId: undefined,
        }),
        validSnapshotCommand(),
      ),
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
