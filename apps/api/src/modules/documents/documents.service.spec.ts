import type { DealDocument } from '@prisma/client';
import { ServiceUnavailableException } from '@nestjs/common';
import { Role, type RequestUser } from '../../common/types/request-user';
import type { StorageService } from '../storage/storage.service';
import type { DocumentRepository } from './document.repository';
import { DocumentMatrixService } from './document-matrix.service';
import { DocumentsService } from './documents.service';

const USER: RequestUser = {
  id: 'user-1',
  orgId: 'org-1',
  tenantId: 'tenant-1',
  role: Role.FARMER,
  email: 'user-1@example.invalid',
  sessionId: 'session-1',
};

const DOCUMENT = {
  id: 'DOC-1',
  dealId: 'DEAL-1',
  tenantId: 'tenant-1',
  type: 'contract',
  status: 'PENDING_REVIEW',
  name: 'contract.pdf',
  mimeType: 'application/pdf',
  s3Key: 'tenant/tenant-1/deal/DEAL-1/FILE-1/contract.pdf',
  sizeBytes: 100,
  hash: 'a'.repeat(64),
  uploadedAt: new Date('2026-07-12T10:00:00.000Z'),
  uploadedByUserId: 'user-1',
  signedAt: null,
  signatories: null,
  bankRequired: false,
  releaseRequired: false,
  bankAcceptance: 'PENDING',
  edoStatus: null,
  edoExternalId: null,
  version: 1,
  isImmutable: true,
  sourceFileId: 'FILE-1',
  signatureFileId: null,
  supersedesId: null,
  seriesId: 'SERIES-1',
  idempotencyKey: 'document:tenant-1:IDEM-1',
  correlationId: 'COMMAND-1',
  createdByOrgId: 'org-1',
  metadata: {},
} satisfies DealDocument;

function makeService(documents: DealDocument[] = [DOCUMENT]) {
  const repository: jest.Mocked<DocumentRepository> = {
    list: jest.fn().mockResolvedValue(documents),
    getById: jest.fn().mockResolvedValue(documents[0]),
    createVersion: jest.fn().mockResolvedValue({
      document: documents[0],
      auditId: 'AUDIT-1',
      outboxId: 'OUTBOX-1',
      duplicate: false,
    }),
    submitSignature: jest.fn(),
    generateDealPackage: jest.fn(),
  };
  const storage = {
    getDownloadUrl: jest.fn().mockResolvedValue({
      url: 'https://object-storage.invalid/presigned',
      expiresAt: '2026-07-12T10:15:00.000Z',
      file: {},
    }),
  } as unknown as jest.Mocked<StorageService>;
  return {
    repository,
    storage,
    service: new DocumentsService(repository, new DocumentMatrixService(), storage),
  };
}

describe('DocumentsService PostgreSQL authority boundary', () => {
  it('passes the trusted server identity into every repository read', async () => {
    const { service, repository } = makeService();
    const document = await service.getOne('DOC-1', USER);
    expect(document).toMatchObject({ id: 'DOC-1', sha256: 'a'.repeat(64) });
    expect(document).not.toHaveProperty('s3Key');
    expect(document).not.toHaveProperty('idempotencyKey');
    expect(document).not.toHaveProperty('metadata');
    expect(repository.getById).toHaveBeenCalledWith('DOC-1', USER);
  });

  it('returns storage-controlled access without synthetic file content', async () => {
    const { service, storage } = makeService();
    const result = await service.streamContent('DOC-1', USER);
    expect(result.file).toEqual(expect.objectContaining({
      documentId: 'DOC-1',
      sha256: 'a'.repeat(64),
      downloadUrl: 'https://object-storage.invalid/presigned',
    }));
    expect(result.file).not.toHaveProperty('content');
    expect(storage.getDownloadUrl).toHaveBeenCalledWith('FILE-1', 900, USER);
  });

  it('promotes a verified storage object through the typed repository command', async () => {
    const { service, repository } = makeService();
    const command = {
      sourceFileId: 'FILE-1',
      type: 'contract',
      commandId: 'COMMAND-1',
      idempotencyKey: 'IDEM-1',
    };
    await service.upload(command, USER);
    expect(repository.createVersion).toHaveBeenCalledWith(command, USER);
  });

  it('keeps unverified document versions out of the release-ready state', async () => {
    const { service } = makeService();
    const gate = await service.getReleaseGate('DEAL-1', USER);
    expect(gate.canRelease).toBe(false);
    expect(gate.blocking).toEqual(expect.arrayContaining([
      expect.objectContaining({ docType: 'contract', reason: 'manual_review' }),
    ]));
  });

  it.each([
    'edoSend',
    'edoSign',
    'edoGetStatus',
    'verifySignature',
    'getUserCertificates',
    'checkCertificateStatus',
    'edoSendViaTakskom',
  ] as const)('fails closed for inactive integration method %s', (method) => {
    const { service } = makeService();
    expect(() => service[method]()).toThrow(ServiceUnavailableException);
  });
});
