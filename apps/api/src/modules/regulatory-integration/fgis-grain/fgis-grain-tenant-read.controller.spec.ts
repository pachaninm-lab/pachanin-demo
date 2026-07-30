import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { Role, type RequestUser } from '../../../common/types/request-user';
import {
  FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
  FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
} from './fgis-grain-tenant-read.contract';
import { FgisGrainTenantReadController } from './fgis-grain-tenant-read.controller';

function user(): RequestUser {
  return {
    id: 'user-1',
    email: 'operator@example.test',
    role: Role.ADMIN,
    orgId: 'org-1',
    tenantId: 'tenant-1',
    membershipId: 'membership-1',
    sessionId: 'session-1',
    mfaVerified: true,
  };
}

function response() {
  return { setHeader: jest.fn() } as unknown as Response;
}

function fixture() {
  const repository = {
    getView: jest.fn(),
    authorize: jest.fn(),
    attest: jest.fn(),
    execute: jest.fn(),
  };
  return {
    controller: new FgisGrainTenantReadController(repository as never),
    repository,
  };
}

describe('FgisGrainTenantReadController', () => {
  it('passes only the authenticated server user to status lookup and disables caching', async () => {
    const { controller, repository } = fixture();
    const actor = user();
    const http = response();
    repository.getView.mockResolvedValue({ id: 'authorization-001' });

    await expect(controller.status('authorization-001', actor, http)).resolves.toEqual({
      id: 'authorization-001',
    });
    expect(repository.getView).toHaveBeenCalledWith(actor, 'authorization-001');
    expect(http.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });

  it('rejects malformed route identifiers before repository access', async () => {
    const { controller, repository } = fixture();
    await expect(controller.status('../cross-tenant', user(), response()))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repository.getView).not.toHaveBeenCalled();
  });

  it('returns an authorization version ETag without exposing authority in the request', async () => {
    const { controller, repository } = fixture();
    const actor = user();
    const http = response();
    const dto = {
      schemaVersion: FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
      configurationId: 'config-fgis-001',
      configurationVersion: '2',
      allowedOperations: ['DICTIONARIES'],
      authorizationReference: 'authorization://tenant/org/read-001',
      validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
      reason: 'Tenant owner approved the bounded read-only operation set.',
    } as never;
    repository.authorize.mockResolvedValue({
      authorizationId: 'authorization-001',
      authorizationVersion: '0',
      state: 'AUTHORIZED_NOT_ATTESTED',
      operationalStatus: 'NOT_ATTESTED',
    });

    await controller.authorize(dto, actor, http);
    expect(repository.authorize).toHaveBeenCalledWith(actor, dto);
    expect(http.setHeader).toHaveBeenCalledWith('ETag', '"0"');
  });

  it('rejects stale If-Match before attestation repository access', async () => {
    const { controller, repository } = fixture();
    const dto = {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: 'authorization-001',
      authorizationVersion: '4',
      evidenceReference: 'evidence://fgis-grain/read-e2e-001',
      validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
      justification: 'External read evidence passed without provider writes.',
    } as never;

    await expect(controller.attest('"3"', dto, user(), response()))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repository.attest).not.toHaveBeenCalled();
  });

  it('passes the exact read request and authenticated actor with matching If-Match', async () => {
    const { controller, repository } = fixture();
    const actor = user();
    const http = response();
    const dto = {
      schemaVersion: FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
      authorizationId: 'authorization-001',
      authorizationVersion: '1',
      operationCode: 'GET_LIST_SDIZ',
      requestReference: 'object-store://fgis-grain/requests/request-001.xml',
      requestSha256: 'a'.repeat(64),
      correlationId: 'corr-fgis-read-001',
      idempotencyKey: 'idem-fgis-read-001',
    } as never;
    repository.execute.mockResolvedValue({
      authorizationId: 'authorization-001',
      authorizationVersion: '1',
      operationCode: 'GET_LIST_SDIZ',
      correlationId: 'corr-fgis-read-001',
      providerRequestId: 'provider-request-001',
      responseReference: 'provider-response://fgis-grain/read-001',
      responseSha256: 'b'.repeat(64),
      receivedAt: new Date().toISOString(),
      replayed: false,
      operationalStatus: 'NOT_ATTESTED',
    });

    await controller.execute('W/"1"', dto, actor, http);
    expect(repository.execute).toHaveBeenCalledWith(actor, dto);
    expect(http.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });
});
