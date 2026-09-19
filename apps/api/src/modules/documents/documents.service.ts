import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { DealDocument } from '@prisma/client';
import type { RequestUser } from '../../common/types/request-user';
import { StorageService } from '../storage/storage.service';
import { DOCUMENT_REPOSITORY, DocumentRepository } from './document.repository';
import { DocumentMatrixService } from './document-matrix.service';
import { GenerateDocumentPackageDto } from './dto/generate-document-package.dto';
import { SignDocumentDto } from './dto/sign-document.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

const DOWNLOAD_TTL_SECONDS = 900;

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    private readonly matrix: DocumentMatrixService,
    private readonly storage: StorageService,
  ) {}

  async list(user: RequestUser, dealId?: string) {
    const documents = await this.documents.list(user, dealId);
    return documents.map(toDocumentView);
  }

  async getOne(id: string, user: RequestUser) {
    return toDocumentView(await this.documents.getById(id, user));
  }

  async getSignedAccess(id: string, user: RequestUser) {
    const document = await this.documents.getById(id, user);
    const access = await this.getSourceAccess(document.sourceFileId, user);
    return {
      documentId: document.id,
      accessUrl: access.url,
      expiresAt: access.expiresAt,
      mimeType: document.mimeType,
      hash: document.hash,
      status: document.status,
    };
  }

  async streamContent(id: string, user: RequestUser) {
    const document = await this.documents.getById(id, user);
    const access = await this.getSourceAccess(document.sourceFileId, user);
    return {
      file: {
        documentId: document.id,
        name: document.name,
        mimeType: document.mimeType,
        sha256: document.hash,
        downloadUrl: access.url,
        expiresAt: access.expiresAt,
      },
    };
  }

  async upload(dto: UploadDocumentDto, user: RequestUser) {
    return toMutationView(await this.documents.createVersion(dto, user));
  }

  async download(id: string, user: RequestUser) {
    const document = await this.documents.getById(id, user);
    const access = await this.getSourceAccess(document.sourceFileId, user);
    return {
      documentId: document.id,
      downloadUrl: access.url,
      name: document.name,
      mimeType: document.mimeType,
      sha256: document.hash,
      expiresAt: access.expiresAt,
    };
  }

  async signDocument(id: string, dto: SignDocumentDto, user: RequestUser) {
    return toMutationView(await this.documents.submitSignature(id, dto, user));
  }

  async generateDealPackage(dealId: string, dto: GenerateDocumentPackageDto, user: RequestUser) {
    return toMutationView(await this.documents.generateDealPackage(dealId, dto, user));
  }

  async getPreview(id: string, user: RequestUser) {
    const document = await this.documents.getById(id, user);
    const access = await this.getSourceAccess(document.sourceFileId, user);
    return {
      documentId: document.id,
      name: document.name,
      previewUrl: access.url,
      expiresAt: access.expiresAt,
      mimeType: document.mimeType,
      sha256: document.hash,
    };
  }

  async getReleaseGate(dealId: string, user: RequestUser) {
    const documents = await this.documents.list(user, dealId);
    const presentDocs = this.matrix.toPresentDocs(documents);
    const gate = this.matrix.releaseReadiness(presentDocs);
    return {
      dealId,
      canRelease: gate.canProceed,
      blocking: gate.blocking,
      summary: this.matrix.releaseBlockerSummary(documents),
    };
  }

  async getCorrectionPlan(id: string, user: RequestUser) {
    const document = await this.documents.getById(id, user);
    return {
      documentId: document.id,
      status: document.status,
      immutable: document.isImmutable,
      correctionCreatesNewVersion: true,
      nextVersion: document.version + 1,
      steps: [
        { step: 1, action: 'storage.upload', description: 'Загрузить и подтвердить новый объект доказательства' },
        { step: 2, action: 'document.version.create', description: 'Создать новую версию со ссылкой supersedesId' },
      ],
    };
  }

  edoSend(): never {
    return integrationNotActivated('EDO_SEND');
  }

  edoSign(): never {
    return integrationNotActivated('QUALIFIED_SIGNATURE');
  }

  edoGetStatus(): never {
    return integrationNotActivated('EDO_STATUS');
  }

  verifySignature(): never {
    return integrationNotActivated('QUALIFIED_SIGNATURE_VERIFICATION');
  }

  getUserCertificates(): never {
    return integrationNotActivated('CERTIFICATE_DIRECTORY');
  }

  checkCertificateStatus(): never {
    return integrationNotActivated('CERTIFICATE_STATUS');
  }

  edoSendViaTakskom(): never {
    return integrationNotActivated('TAKSKOM_EDO_SEND');
  }

  private async getSourceAccess(sourceFileId: string | null, user: RequestUser) {
    if (!sourceFileId) {
      throw new ConflictException({
        code: 'DOCUMENT_HAS_NO_OBJECT',
        message: 'This document is a metadata manifest and has no downloadable object.',
      });
    }
    return this.storage.getDownloadUrl(sourceFileId, DOWNLOAD_TTL_SECONDS, user);
  }
}

function integrationNotActivated(capability: string): never {
  throw new ServiceUnavailableException({
    code: 'INTEGRATION_NOT_ACTIVATED',
    capability,
    message: 'The external integration has not completed contract and credential activation.',
  });
}

function toMutationView(result: Awaited<ReturnType<DocumentRepository['createVersion']>>) {
  return {
    document: toDocumentView(result.document),
    auditId: result.auditId,
    outboxId: result.outboxId,
    duplicate: result.duplicate,
  };
}

function toDocumentView(document: DealDocument) {
  return {
    id: document.id,
    dealId: document.dealId,
    type: document.type,
    status: document.status,
    name: document.name,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    sha256: document.hash,
    uploadedAt: document.uploadedAt.toISOString(),
    uploadedByUserId: document.uploadedByUserId,
    version: document.version,
    immutable: document.isImmutable,
    sourceFileId: document.sourceFileId,
    signatureFileId: document.signatureFileId,
    supersedesId: document.supersedesId,
  };
}
