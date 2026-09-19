import { Injectable, NotFoundException } from '@nestjs/common';
import type { DealDocument } from '@prisma/client';
import type { RequestUser } from '../../common/types/request-user';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import {
  CreateDocumentVersionCommand,
  DocumentMutationResult,
  DocumentRepository,
  GenerateDocumentPackageCommand,
  SubmitDocumentSignatureCommand,
} from './document.repository';

/**
 * Explicit development/test adapter. It is never registered by DocumentsModule
 * and therefore cannot enter the staging or production dependency graph.
 */
@Injectable()
export class RuntimeDocumentRepository implements DocumentRepository {
  constructor(private readonly runtime: RuntimeCoreService) {}

  async list(_user: RequestUser, dealId?: string): Promise<DealDocument[]> {
    const documents = this.runtime.listDocuments() as unknown as DealDocument[];
    return dealId ? documents.filter((document) => document.dealId === dealId) : documents;
  }

  async getById(id: string, _user: RequestUser): Promise<DealDocument> {
    const document = this.runtime.getDocument(id) as unknown as DealDocument | undefined;
    if (!document) throw new NotFoundException('Development document not found.');
    return document;
  }

  async createVersion(
    command: CreateDocumentVersionCommand,
    user: RequestUser,
  ): Promise<DocumentMutationResult> {
    const document = this.runtime.uploadDocument(
      { name: command.name ?? command.sourceFileId },
      { type: command.type, sourceFileId: command.sourceFileId, supersedesId: command.supersedesId },
      user,
    ) as unknown as DealDocument;
    return developmentReceipt(document, command.commandId);
  }

  async submitSignature(
    id: string,
    command: SubmitDocumentSignatureCommand,
    user: RequestUser,
  ): Promise<DocumentMutationResult> {
    const document = this.runtime.signDocument(id, user) as unknown as DealDocument;
    return developmentReceipt(document, command.commandId);
  }

  async generateDealPackage(
    dealId: string,
    command: GenerateDocumentPackageCommand,
    user: RequestUser,
  ): Promise<DocumentMutationResult> {
    const document = this.runtime.generateDealPackage(dealId, user) as unknown as DealDocument;
    return developmentReceipt(document, command.commandId);
  }
}

function developmentReceipt(document: DealDocument, commandId: string): DocumentMutationResult {
  return {
    document,
    auditId: `development-memory-only:audit:${commandId}`,
    outboxId: `development-memory-only:outbox:${commandId}`,
    duplicate: false,
  };
}
