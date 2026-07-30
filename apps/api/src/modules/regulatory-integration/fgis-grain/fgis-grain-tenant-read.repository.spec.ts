import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Role, type RequestUser } from '../../../common/types/request-user';
import {
  FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
  FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
} from './fgis-grain-tenant-read.contract';
import { FgisGrainTenantReadRepository } from './fgis-grain-tenant-read.repository';
import { DisabledFgisGrainTenantReadTransport } from './fgis-grain-tenant-read.transport';

function user(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'user-1',
    email: 'operator@example.test',
    role: Role.ADMIN,
    orgId: 'org-1',
    tenantId: 'tenant-1',
    membershipId: 'membership-1',
    sessionId: 'session-1',
    mfaVerified: true,
    ...overrides,
  };
}

function repository() {
  const transactions = {
    withTrustedContext: jest.fn(),
  };
  const disabled = new DisabledFgisGrainTenantReadTransport();
  return {
    repository: new FgisGrainTenantReadRepository(
      transactions as never,
      disabled,
      disabled,
    ),
    transactions,
  };
}

const authorization = {
  schemaVersion: FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
  configurationId: 'config-fgis-001',
  configurationVersion: '1',
  allowedOperations: ['DICTIONARIES'] as const,
  authorizationReference: 'authorization://tenant/org/read-001',
  validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
  reason: 'Tenant owner approved the bounded read-only operation set.',
};

describe('FgisGrainTenantReadRepository fail-closed boundary', () => {
  it('rejects non-management roles before opening a transaction', async () => {
    const fixture = repository();
    await expect(fixture.repository.authorize(
      user({ role: Role.FARMER }),
      authorization,
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(fixture.transactions.withTrustedContext).not.toHaveBeenCalled();
  });

  it('requires MFA for authorization management', async () => {
    const fixture = repository();
    await expect(fixture.repository.authorize(
      user({ mfaVerified: false }),
      authorization,
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(fixture.transactions.withTrustedContext).not.toHaveBeenCalled();
  });

  it('cannot record external attestation while transport is disabled', async () => {
    const fixture = repository();
    await expect(fixture.repository.attest(user(), {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: 'authorization-001',
      authorizationVersion: '0',
      evidenceReference: 'evidence://fgis-grain/read-e2e-001',
      validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
      justification: 'External read evidence passed without provider writes.',
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fixture.transactions.withTrustedContext).not.toHaveBeenCalled();
  });

  it('rejects catalog mutation operations before transport or PostgreSQL', async () => {
    const fixture = repository();
    await expect(fixture.repository.execute(user({ role: Role.BUYER }), {
      schemaVersion: FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
      authorizationId: 'authorization-001',
      authorizationVersion: '1',
      operationCode: 'CREATE_SDIZ' as never,
      requestReference: 'object-store://fgis-grain/requests/request-001.xml',
      requestSha256: 'a'.repeat(64),
      correlationId: 'corr-fgis-read-001',
      idempotencyKey: 'idem-fgis-read-001',
    })).rejects.toMatchObject({ code: 'MUTATION_OPERATION_FORBIDDEN' });
    expect(fixture.transactions.withTrustedContext).not.toHaveBeenCalled();
  });

  it('rejects guest read access before PostgreSQL', async () => {
    const fixture = repository();
    await expect(fixture.repository.getView(
      user({ role: Role.GUEST }),
      'authorization-001',
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(fixture.transactions.withTrustedContext).not.toHaveBeenCalled();
  });
});
