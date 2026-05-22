import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { AntiFraudModule } from '../anti-fraud/anti-fraud.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentUploadPolicyService } from './document-upload-policy.service';
import { DocumentMatrixService } from './document-matrix.service';

@Module({
  imports: [AuditModule, StorageModule, AntiFraudModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, AccessScopeService, DocumentUploadPolicyService, DocumentMatrixService],
  exports: [DocumentsService, DocumentMatrixService]
})
export class DocumentsModule {}
