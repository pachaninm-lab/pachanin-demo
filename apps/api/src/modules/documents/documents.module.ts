import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { DOCUMENT_REPOSITORY } from './document.repository';
import { DocumentMatrixService } from './document-matrix.service';
import { DocumentTemplateService } from './document-template.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PrismaDocumentRepository } from './prisma-document.repository';

@Module({
  imports: [StorageModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentMatrixService,
    DocumentTemplateService,
    PrismaDocumentRepository,
    { provide: DOCUMENT_REPOSITORY, useExisting: PrismaDocumentRepository },
  ],
  exports: [DocumentsService, DocumentMatrixService, DocumentTemplateService],
})
export class DocumentsModule {}
