import { Module, type Provider } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { AntiFraudModule } from '../anti-fraud/anti-fraud.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentUploadPolicyService } from './document-upload-policy.service';
import { DocumentMatrixService } from './document-matrix.service';
import { DocumentTemplateService } from './document-template.service';
import { DOCUMENT_REPOSITORY } from './document.repository';
import { selectDocumentRepository } from './document-repository.factory';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Document repository binding.
 *
 * Default (controlled-pilot / pre-integration): in-memory RuntimeCore adapter.
 * The DB-backed Prisma adapter is selected ONLY when
 * PLATFORM_V7_DOCUMENT_REPOSITORY=prisma is explicitly set. No silent Prisma
 * activation and no silent fallback between adapters.
 */
const documentRepositoryProvider: Provider = {
  provide: DOCUMENT_REPOSITORY,
  useFactory: (runtime: RuntimeCoreService, prisma?: PrismaService) =>
    selectDocumentRepository(runtime, prisma),
  inject: [RuntimeCoreService, { token: PrismaService, optional: true }],
};

@Module({
  imports: [AuditModule, StorageModule, AntiFraudModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, AccessScopeService, DocumentUploadPolicyService, DocumentMatrixService, DocumentTemplateService, documentRepositoryProvider],
  exports: [DocumentsService, DocumentMatrixService, DocumentTemplateService]
})
export class DocumentsModule {}
