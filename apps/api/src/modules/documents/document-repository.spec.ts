import { DealDocument } from '@prisma/client';
import {
  assertIndustrialProductionStartup,
  IndustrialStartupError,
} from '../../common/config/industrial-mode';
import type { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { DOCUMENT_REPOSITORY } from './document.repository';
import { selectDocumentRepository } from './document-repository.factory';
import { DocumentsModule } from './documents.module';
import { PrismaDocumentRepository } from './prisma-document.repository';
import { RuntimeDocumentRepository } from './runtime-document.repository';

const USER: RequestUser = {
  id: 'user-1',
  orgId: 'org-1',
  tenantId: 'tenant-1',
  role: Role.FARMER,
  email: 'user-1@example.invalid',
  sessionId: 'session-1',
};

function makeRuntime() {
  return {
    listDocuments: jest.fn().mockReturnValue([{ id: 'DOC-1', dealId: 'DEAL-1' }]),
    getDocument: jest.fn().mockReturnValue({ id: 'DOC-1', dealId: 'DEAL-1' }),
    uploadDocument: jest.fn().mockReturnValue({ id: 'DOC-2', dealId: 'DEAL-1' }),
    signDocument: jest.fn().mockReturnValue({ id: 'DOC-3', dealId: 'DEAL-1' }),
    generateDealPackage: jest.fn().mockReturnValue({ id: 'DOC-4', dealId: 'DEAL-1' }),
  } as unknown as RuntimeCoreService;
}

describe('Documents repository composition', () => {
  it('binds Prisma directly in DocumentsModule and excludes RuntimeCore from its providers', () => {
    const providers = Reflect.getMetadata('providers', DocumentsModule) as unknown[];
    expect(providers).toContain(PrismaDocumentRepository);
    expect(providers).not.toContain(RuntimeDocumentRepository);
    expect(providers).not.toContain(RuntimeCoreService);
    expect(providers).toContainEqual({
      provide: DOCUMENT_REPOSITORY,
      useExisting: PrismaDocumentRepository,
    });
  });

  it('requires an explicit, typed repository mode for dev/test composition', () => {
    const runtime = makeRuntime();
    const rls = {} as unknown as RlsTransactionService;
    expect(() => selectDocumentRepository(runtime, rls, undefined)).toThrow(IndustrialStartupError);
    expect(() => selectDocumentRepository(runtime, rls, 'unexpected')).toThrow(/unknown value/);
    expect(selectDocumentRepository(runtime, rls, 'memory')).toBeInstanceOf(RuntimeDocumentRepository);
    expect(selectDocumentRepository(runtime, rls, 'prisma')).toBeInstanceOf(PrismaDocumentRepository);
  });

  it('allows the process-memory adapter only when it is instantiated explicitly', async () => {
    const runtime = makeRuntime();
    const repository = new RuntimeDocumentRepository(runtime);
    expect(await repository.list(USER)).toEqual([{ id: 'DOC-1', dealId: 'DEAL-1' }]);
    const result = await repository.createVersion({
      sourceFileId: 'FILE-1',
      type: 'contract',
      commandId: 'COMMAND-1',
      idempotencyKey: 'IDEM-1',
    }, USER);
    expect(result.document).toEqual({ id: 'DOC-2', dealId: 'DEAL-1' } as DealDocument);
    expect(result.auditId).toMatch(/^development-memory-only:/);
  });
});

describe('production startup document authority gate', () => {
  const base = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://deal@production.invalid/db',
    STORAGE_DATABASE_URL: 'postgresql://app_storage@production.invalid/db',
    PLATFORM_V7_DEAL_REPOSITORY: 'prisma',
    PLATFORM_V7_DOCUMENT_REPOSITORY: 'prisma',
  };

  it('accepts only the explicit Prisma document binding', () => {
    expect(() => assertIndustrialProductionStartup(base)).not.toThrow();
  });

  it.each([undefined, 'memory', 'typo'])('fails closed for mode %s', (mode) => {
    expect(() => assertIndustrialProductionStartup({
      ...base,
      PLATFORM_V7_DOCUMENT_REPOSITORY: mode,
    })).toThrow(IndustrialStartupError);
  });
});
