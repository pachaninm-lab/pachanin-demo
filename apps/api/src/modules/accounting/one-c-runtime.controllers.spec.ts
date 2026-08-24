import { BadRequestException } from '@nestjs/common';
import { PUBLIC_ROUTE } from '../../common/decorators/public.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { Role, type RequestUser } from '../../common/types/request-user';
import { ONE_C_COMMANDS, ONE_C_PROTOCOL_VERSION } from './one-c-connector.protocol';
import { OneCConnectionManagementController } from './one-c-connection-management.controller';
import { OneCConnectorController } from './one-c-connector.controller';
import {
  OneCPairingChallengeOutcome,
  OneCRuntimeRepository,
  OneCRuntimeRepositoryError,
} from './one-c-runtime.repository';

const USER: RequestUser = {
  id: 'user-1',
  email: 'accountant@example.test',
  role: Role.GUEST,
  orgId: 'org-1',
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  sessionId: 'session-1',
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

const DISCOVERY = {
  platformVersion: '8.3.27.1234',
  configurationName: 'Бухгалтерия предприятия',
  configurationVersion: '3.0.170.31',
  databaseInstanceId: 'opaque-database-instance-1',
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

function fixture() {
  const runtime = {
    consumePairing: jest.fn(),
    createPairingChallenge: jest.fn(),
    describeBinding: jest.fn(),
    revokeBinding: jest.fn(),
  } as unknown as OneCRuntimeRepository;
  return {
    runtime,
    connector: new OneCConnectorController(runtime),
    management: new OneCConnectionManagementController(runtime),
  };
}

describe('1C connector HTTP bootstrap boundary', () => {
  it('makes only the one-time pair handler public', () => {
    expect(
      Reflect.getMetadata(PUBLIC_ROUTE, OneCConnectorController.prototype.pair),
    ).toBe(true);
    expect(
      Reflect.getMetadata(PUBLIC_ROUTE, OneCConnectionManagementController.prototype.createPairingChallenge),
    ).not.toBe(true);
  });

  it('admits GUEST at HTTP only on the capability-gated organization management controller', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, OneCConnectionManagementController) as string[];
    expect(roles).toContain('GUEST');
    expect(roles).toEqual(
      expect.arrayContaining([
        'ADMIN',
        'FARMER',
        'BUYER',
        'LOGISTICIAN',
        'SURVEYOR',
        'LAB',
        'ELEVATOR',
        'EXECUTIVE',
        'GUEST',
      ]),
    );
    expect(roles).not.toContain('ACCOUNTING');
    expect(roles).not.toContain('DRIVER');
    expect(roles).not.toContain('ANY_AUTHENTICATED');
  });

  it('forwards only code + normalized discovery and does not invent a client-selected organization GUID', async () => {
    const test = fixture();
    const result = {
      installationId: 'installation-1',
      bindingId: 'binding-1',
      credentialId: '11111111-2222-4333-8444-555555555555',
      machineBearer: '11111111-2222-4333-8444-555555555555.secret-secret-secret-secret-secret-1',
      credentialExpiresAt: new Date('2026-09-18T00:00:00.000Z'),
      organizationId: 'org-1',
      oneCOrganizationGuid: DISCOVERY.organizations[0].guid,
      protocolVersion: '1',
      allowedCommands: ONE_C_COMMANDS,
    };
    (test.runtime.consumePairing as jest.Mock).mockResolvedValueOnce(result);

    await expect(
      test.connector.pair(
        { code: 'abcdefghijklmnopqrstuvwx12345678', discovery: DISCOVERY },
        'corr-pair-1',
      ),
    ).resolves.toBe(result);

    expect(test.runtime.consumePairing).toHaveBeenCalledWith({
      pairingCode: 'abcdefghijklmnopqrstuvwx12345678',
      discovery: DISCOVERY,
      correlationId: 'corr-pair-1',
    });
    expect(test.runtime.consumePairing).not.toHaveBeenCalledWith(
      expect.objectContaining({ selectedOneCOrganizationGuid: expect.anything() }),
    );
  });

  it('rejects unknown top-level/discovery organization fields before repository execution', async () => {
    const test = fixture();

    await expect(
      test.connector.pair(
        {
          code: 'abcdefghijklmnopqrstuvwx12345678',
          discovery: DISCOVERY,
          organizationId: 'attacker-selected-org',
        },
        'corr-extra-top',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      test.connector.pair(
        {
          code: 'abcdefghijklmnopqrstuvwx12345678',
          discovery: {
            ...DISCOVERY,
            organizations: [
              { ...DISCOVERY.organizations[0], sql: 'select * from everything' },
            ],
          },
        },
        'corr-extra-org',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(test.runtime.consumePairing).not.toHaveBeenCalled();
  });

  it('surfaces only the bounded repository error code, never raw database text', async () => {
    const test = fixture();
    (test.runtime.consumePairing as jest.Mock).mockRejectedValueOnce(
      new OneCRuntimeRepositoryError('ONE_C_PAIRING_CHALLENGE_NOT_ACTIVE'),
    );

    const promise = test.connector.pair(
      { code: 'abcdefghijklmnopqrstuvwx12345678', discovery: DISCOVERY },
      'corr-refused',
    );
    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toMatchObject({
      response: { code: 'ONE_C_PAIRING_CHALLENGE_NOT_ACTIVE' },
    });
  });
});

describe('1C human connection management boundary', () => {
  it('does not accept a free-text revoke reason or extra mutation fields', async () => {
    const test = fixture();

    expect(() =>
      test.management.revoke(
        'binding-1',
        { reasonCode: 'please revoke because token leaked' },
        USER,
        'corr-revoke-free-text',
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      test.management.revoke(
        'binding-1',
        { reasonCode: 'CREDENTIAL_SUSPECTED_COMPROMISED', force: true },
        USER,
        'corr-revoke-extra',
      ),
    ).toThrow(BadRequestException);

    expect(test.runtime.revokeBinding).not.toHaveBeenCalled();
  });

  it('returns the one-time challenge exactly as produced by the capability/MFA repository', async () => {
    const test = fixture();
    const issued = {
      outcome: OneCPairingChallengeOutcome.ISSUED,
      challengeId: 'challenge-1',
      pairingCode: 'abcdefghijklmnopqrstuvwx12345678',
      expiresAt: new Date('2026-08-18T20:00:00.000Z'),
      refusal: null,
    };
    (test.runtime.createPairingChallenge as jest.Mock).mockResolvedValueOnce(issued);

    await expect(
      test.management.createPairingChallenge(USER, 'corr-human-pair'),
    ).resolves.toBe(issued);
    expect(test.runtime.createPairingChallenge).toHaveBeenCalledWith(USER, {
      correlationId: 'corr-human-pair',
      ttlSeconds: 600,
    });
  });
});
