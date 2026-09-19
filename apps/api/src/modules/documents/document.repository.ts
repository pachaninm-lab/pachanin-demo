import type { DealDocument, Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/types/request-user';

export const DOCUMENT_REPOSITORY = 'DOCUMENT_REPOSITORY';

export type CreateDocumentVersionCommand = Readonly<{
  sourceFileId: string;
  type: string;
  name?: string;
  supersedesId?: string;
  commandId: string;
  idempotencyKey: string;
  correlationId?: string;
}>;

export type SubmitDocumentSignatureCommand = Readonly<{
  signatureFileId: string;
  commandId: string;
  idempotencyKey: string;
  correlationId?: string;
}>;

export type GenerateDocumentPackageCommand = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId?: string;
}>;

export type DocumentMutationResult = Readonly<{
  document: DealDocument;
  auditId: string;
  outboxId: string;
  duplicate: boolean;
}>;

export interface DocumentRepository {
  list(user: RequestUser, dealId?: string): Promise<DealDocument[]>;
  getById(id: string, user: RequestUser): Promise<DealDocument>;
  createVersion(
    command: CreateDocumentVersionCommand,
    user: RequestUser,
  ): Promise<DocumentMutationResult>;
  submitSignature(
    id: string,
    command: SubmitDocumentSignatureCommand,
    user: RequestUser,
  ): Promise<DocumentMutationResult>;
  generateDealPackage(
    dealId: string,
    command: GenerateDocumentPackageCommand,
    user: RequestUser,
  ): Promise<DocumentMutationResult>;
}

export type DocumentTransaction = Prisma.TransactionClient;
