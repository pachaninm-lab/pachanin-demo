import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import { Capability } from '../auth/membership-capability.resolver';
import {
  ONE_C_COMMANDS,
  ONE_C_PROTOCOL_VERSION,
  OneCCommand,
  type OneCSelfDiscovery,
} from './one-c-connector.protocol';
import { issueOneCMachineCredential } from './one-c-machine-credential.policy';
import {
  OneCBindingReadOutcome,
  OneCBindingRevokeOutcome,
  OneCHumanRefusal,
  OneCMachineAuthenticationDenial,
  OneCPairingChallengeOutcome,
  OneCRuntimeRepository,
  OneCRuntimeRepositoryError,
} from './one-c-runtime.repository';
import { WorkTaskRepository } from './work-task.repository';

const NOW = new Date('2026-08-18T19:30:00.000Z');
const USER: RequestUser = {
  id: 'user-accounting-1',
  email: 'accountant@example.test',
  role: Role.GUEST,
  orgId: 'org-1',
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  sessionId: 'session-1',
  mfaVerified: true,
  mfaVerifiedAt: new Date(NOW.getTime() - 60_000).toISOString(),
};

const DISCOVERY: OneCSelfDiscovery = {
  platformVersion: '8.3.27.1234',
  configurationName: 'Бухгалтерия предприятия',
  configurationVersion: '3.0.170.31',
  databaseInstanceId: 'db-instance-opaque-001',
  organizations: [
    {
      guid: '11111111-2222-3333-4444-555555555555',
      inn: '7707083893',
      kpp: '770701001',
      name: 'ООО Тест',
    },
  ],
  capabilities: ONE_C_COMMANDS,
  connectorVersion: '1.0.0',
  protocolVersion: ONE_C_PROTOCOL_VERSION,
};

function fixture(capabilities: readonly string[] = []): {
  repository: OneCRuntimeRepository;
  tx: { $queryRaw: jest.Mock };
  prismaQuery: jest.Mock;
  memberContext: jest.Mock;
  capabilitiesWithin: jest.Mock;
} {
  const tx = { $queryRaw: jest.fn() };
  const memberContext = jest.fn(
    async (
      _user: RequestUser | undefined,
      work: (client: Prisma.TransactionClient) => Promise<unknown>,
    ) => work(tx as unknown as Prisma.TransactionClient),
  );
  const transactions = {
    withOrganizationMemberContext: memberContext,
  } as unknown as RlsTransactionService;
  const capabilitiesWithin = jest.fn().mockResolvedValue([...capabilities]);
  const tasks = { capabilitiesWithin } as unknown as WorkTaskRepository;
  const prismaQuery = jest.fn();
  const prisma = { $queryRaw: prismaQuery } as unknown as PrismaService;

  return {
    repository: new OneCRuntimeRepository(prisma, transactions, tasks),
    tx,
    prismaQuery,
    memberContext,
    capabilitiesWithin,
  };
}

describe('OneCRuntimeRepository human authority', () => {
  it('uses the DB-proven organization-member context and refuses pairing without integrations.configure', async () => {
    const test = fixture([Capability.INTEGRATIONS_READ]);

    await expect(
      test.repository.createPairingChallenge(USER, {
        correlationId: 'corr-pair-1',
        now: NOW,
      }),
    ).resolves.toEqual({
      outcome: OneCPairingChallengeOutcome.REFUSED,
      challengeId: null,
      pairingCode: null,
      expiresAt: null,
      refusal: OneCHumanRefusal.CAPABILITY_REQUIRED,
    });

    expect(test.memberContext).toHaveBeenCalledTimes(1);
    expect(test.tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('requires a fresh MFA before returning the one-time pairing code', async () => {
    const test = fixture([Capability.INTEGRATIONS_CONFIGURE]);
    const staleUser = {
      ...USER,
      mfaVerifiedAt: new Date(NOW.getTime() - 301_000).toISOString(),
    };

    await expect(
      test.repository.createPairingChallenge(staleUser, {
        correlationId: 'corr-pair-stale',
        now: NOW,
      }),
    ).resolves.toMatchObject({
      outcome: OneCPairingChallengeOutcome.REFUSED,
      refusal: OneCHumanRefusal.MFA_STALE,
    });
    expect(test.tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns plaintext pairing material only from the challenge command result', async () => {
    const test = fixture([Capability.INTEGRATIONS_CONFIGURE]);
    const expires = new Date(NOW.getTime() + 600_000);
    test.tx.$queryRaw.mockResolvedValueOnce([
      {
        challengeId: 'one-c-pair-1',
        pairingCode: 'abcdefghijklmnopqrstuvwx12345678',
        expiresAt: expires,
      },
    ]);

    await expect(
      test.repository.createPairingChallenge(USER, {
        correlationId: 'corr-pair-ok',
        ttlSeconds: 600,
        now: NOW,
      }),
    ).resolves.toEqual({
      outcome: OneCPairingChallengeOutcome.ISSUED,
      challengeId: 'one-c-pair-1',
      pairingCode: 'abcdefghijklmnopqrstuvwx12345678',
      expiresAt: expires,
      refusal: null,
    });
  });

  it('refuses empty connector capability discovery before touching PostgreSQL', async () => {
    const test = fixture();
    const emptyCapabilities = {
      ...DISCOVERY,
      capabilities: [] as OneCCommand[],
    };

    await expect(
      test.repository.consumePairing({
        pairingCode: 'abcdefghijklmnopqrstuvwx12345678',
        discovery: emptyCapabilities,
        correlationId: 'corr-pair-empty-capabilities',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OneCRuntimeRepositoryError>>({
        code: 'ONE_C_CAPABILITIES_INVALID',
      }),
    );
    expect(test.prismaQuery).not.toHaveBeenCalled();
  });

  it('maps database pairing refusal to a bounded machine code instead of exposing raw SQL errors', async () => {
    const test = fixture();
    test.prismaQuery.mockRejectedValueOnce(
      new Error('sensitive database wording: ONE_C_ORGANIZATION_NOT_FOUND_IN_DISCOVERY, internal host=db1'),
    );

    await expect(
      test.repository.consumePairing({
        pairingCode: 'abcdefghijklmnopqrstuvwx12345678',
        discovery: DISCOVERY,
        correlationId: 'corr-pair-db-refusal',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OneCRuntimeRepositoryError>>({
        message: 'ONE_C_ORGANIZATION_NOT_FOUND_IN_DISCOVERY',
        code: 'ONE_C_ORGANIZATION_NOT_FOUND_IN_DISCOVERY',
      }),
    );
  });

  it('maps the cross-organization collision from its stable SQLSTATE when Prisma redacts the message', async () => {
    const test = fixture();
    test.prismaQuery.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('opaque database refusal', {
        code: 'P2010',
        clientVersion: '5.22.0',
        meta: {
          code: 'P1C01',
          message: 'ERROR: database refusal',
        },
      }),
    );

    await expect(
      test.repository.consumePairing({
        pairingCode: 'abcdefghijklmnopqrstuvwx12345678',
        discovery: DISCOVERY,
        correlationId: 'corr-pair-cross-organization-collision',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OneCRuntimeRepositoryError>>({
        message: 'ONE_C_ENTITY_ALREADY_BOUND_TO_ANOTHER_ORGANIZATION',
        code: 'ONE_C_ENTITY_ALREADY_BOUND_TO_ANOTHER_ORGANIZATION',
      }),
    );
  });

  it('does not expose a binding without integrations.read', async () => {
    const test = fixture([Capability.ACCOUNTING_DASHBOARD_READ]);

    await expect(test.repository.describeBinding(USER)).resolves.toEqual({
      outcome: OneCBindingReadOutcome.REFUSED,
      binding: null,
      refusal: OneCHumanRefusal.CAPABILITY_REQUIRED,
    });
    expect(test.tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('requires security.connection.revoke and fresh MFA for binding revocation', async () => {
    const noAuthority = fixture([Capability.INTEGRATIONS_CONFIGURE]);
    await expect(
      noAuthority.repository.revokeBinding(USER, {
        bindingId: 'binding-1',
        reason: 'CREDENTIAL_SUSPECTED_COMPROMISED',
        correlationId: 'corr-revoke-no-authority',
        now: NOW,
      }),
    ).resolves.toEqual({
      outcome: OneCBindingRevokeOutcome.REFUSED,
      refusal: OneCHumanRefusal.CAPABILITY_REQUIRED,
    });

    const stale = fixture([Capability.SECURITY_CONNECTION_REVOKE]);
    await expect(
      stale.repository.revokeBinding(
        { ...USER, mfaVerifiedAt: new Date(NOW.getTime() - 600_000).toISOString() },
        {
          bindingId: 'binding-1',
          reason: 'CREDENTIAL_SUSPECTED_COMPROMISED',
          correlationId: 'corr-revoke-stale',
          now: NOW,
        },
      ),
    ).resolves.toEqual({
      outcome: OneCBindingRevokeOutcome.REFUSED,
      refusal: OneCHumanRefusal.MFA_STALE,
    });
  });
});

describe('OneCRuntimeRepository machine authentication', () => {
  it('refuses malformed bearer without any credential lookup', async () => {
    const test = fixture();
    await expect(test.repository.authenticateMachineBearer('not-a-bearer')).resolves.toEqual({
      authorized: false,
      reason: OneCMachineAuthenticationDenial.MALFORMED_BEARER,
    });
    expect(test.prismaQuery).not.toHaveBeenCalled();
  });

  it('refuses oversized or non-base64url bearer before database lookup', async () => {
    const test = fixture();
    const id = '00000000-0000-4000-8000-000000000000';
    for (const bearer of [`${id}.${'x'.repeat(4096)}`, `${id}.${'!'.repeat(43)}`]) {
      await expect(test.repository.authenticateMachineBearer(bearer)).resolves.toEqual({
        authorized: false,
        reason: OneCMachineAuthenticationDenial.MALFORMED_BEARER,
      });
    }
    expect(test.prismaQuery).not.toHaveBeenCalled();
  });

  it('verifies possession against the persistent scope and command allowlist', async () => {
    const test = fixture();
    const issued = issueOneCMachineCredential(
      {
        connectorInstallationId: 'installation-1',
        connectionId: 'binding-1',
        platformOrganizationId: 'org-1',
        oneCOrganizationGuid: DISCOVERY.organizations[0].guid,
        protocolVersion: ONE_C_PROTOCOL_VERSION,
        allowedCommands: [OneCCommand.CREATE_SALES_DRAFT],
      },
      new Date(NOW.getTime() + 24 * 3600_000),
      NOW,
    );
    test.prismaQuery.mockResolvedValueOnce([
      {
        credentialId: issued.record.credentialId,
        salt: issued.record.salt,
        secretHash: issued.record.secretHash,
        installationId: issued.record.scope.connectorInstallationId,
        bindingId: issued.record.scope.connectionId,
        organizationId: issued.record.scope.platformOrganizationId,
        oneCOrganizationGuid: issued.record.scope.oneCOrganizationGuid,
        protocolVersion: issued.record.scope.protocolVersion,
        allowedCommands: [...issued.record.scope.allowedCommands],
        issuedAt: issued.record.issuedAt,
        expiresAt: issued.record.expiresAt,
        revokedAt: null,
        credentialStatus: 'ACTIVE',
        bindingStatus: 'ACTIVE',
        installationStatus: 'ACTIVE',
        version: BigInt(issued.record.version),
      },
    ]);

    await expect(
      test.repository.authenticateMachineBearer(
        issued.bearer,
        OneCCommand.CREATE_SALES_DRAFT,
        new Date(NOW.getTime() + 1_000),
      ),
    ).resolves.toMatchObject({
      authorized: true,
      credentialId: issued.record.credentialId,
      installationId: 'installation-1',
      connectionId: 'binding-1',
      organizationId: 'org-1',
      allowedCommands: [OneCCommand.CREATE_SALES_DRAFT],
    });
  });

  it('does not authorize a command outside the persistent allowlist', async () => {
    const test = fixture();
    const issued = issueOneCMachineCredential(
      {
        connectorInstallationId: 'installation-1',
        connectionId: 'binding-1',
        platformOrganizationId: 'org-1',
        oneCOrganizationGuid: DISCOVERY.organizations[0].guid,
        protocolVersion: ONE_C_PROTOCOL_VERSION,
        allowedCommands: [OneCCommand.CREATE_SALES_DRAFT],
      },
      new Date(NOW.getTime() + 24 * 3600_000),
      NOW,
    );
    test.prismaQuery.mockResolvedValueOnce([
      {
        credentialId: issued.record.credentialId,
        salt: issued.record.salt,
        secretHash: issued.record.secretHash,
        installationId: 'installation-1',
        bindingId: 'binding-1',
        organizationId: 'org-1',
        oneCOrganizationGuid: DISCOVERY.organizations[0].guid,
        protocolVersion: ONE_C_PROTOCOL_VERSION,
        allowedCommands: [OneCCommand.CREATE_SALES_DRAFT],
        issuedAt: NOW,
        expiresAt: new Date(NOW.getTime() + 24 * 3600_000),
        revokedAt: null,
        credentialStatus: 'ACTIVE',
        bindingStatus: 'ACTIVE',
        installationStatus: 'ACTIVE',
        version: 1n,
      },
    ]);

    await expect(
      test.repository.authenticateMachineBearer(
        issued.bearer,
        OneCCommand.PUSH_PAYMENT_STATUS,
        new Date(NOW.getTime() + 1_000),
      ),
    ).resolves.toEqual({ authorized: false, reason: 'COMMAND_NOT_ALLOWED' });
  });

  it('keeps the DB verifier independent of a raw-secret hash', () => {
    const issued = issueOneCMachineCredential(
      {
        connectorInstallationId: 'installation-1',
        connectionId: 'binding-1',
        platformOrganizationId: 'org-1',
        oneCOrganizationGuid: DISCOVERY.organizations[0].guid,
        protocolVersion: ONE_C_PROTOCOL_VERSION,
        allowedCommands: [OneCCommand.CREATE_SALES_DRAFT],
      },
      new Date(NOW.getTime() + 24 * 3600_000),
      NOW,
    );
    const secret = issued.bearer.split('.')[1] ?? '';
    expect(issued.record.secretHash).not.toBe(createHash('sha256').update(secret).digest('hex'));
    expect(issued.record.secretHash).not.toContain(secret);
  });
});
