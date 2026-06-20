import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, type DocumentRepository } from './document.repository';
import { DocumentMatrixService } from './document-matrix.service';

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    private readonly matrix: DocumentMatrixService,
  ) {}

  list(_user: any) {
    return this.documents.list();
  }

  getOne(id: string, _user: any) {
    return this.documents.getById(id);
  }

  async getSignedAccess(id: string, _user: any) {
    const doc = await this.documents.getById(id);
    return {
      documentId: doc.id,
      accessUrl: doc.url,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      mimeType: doc.mimeType,
    };
  }

  async streamContent(id: string, _user: any) {
    const doc = await this.documents.getById(id);
    return {
      file: {
        documentId: doc.id,
        name: doc.name,
        mimeType: doc.mimeType,
        content: `Runtime content for ${doc.name}`,
      },
    };
  }

  upload(file: any, dto: any, user: any) {
    return this.documents.upload(file, dto, user);
  }

  async download(id: string, _user: any) {
    const doc = await this.documents.getById(id);
    return {
      documentId: doc.id,
      downloadUrl: doc.url,
      name: doc.name,
      mimeType: doc.mimeType,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  signDocument(id: string, user: any) {
    return this.documents.sign(id, user);
  }

  generateDealPackage(dealId: string, user: any) {
    return this.documents.generateDealPackage(dealId, user);
  }

  async getPreview(id: string, _user: any) {
    const doc = await this.documents.getById(id);
    return {
      documentId: doc.id,
      name: doc.name,
      previewUrl: `${doc.url}?preview=true`,
      mimeType: doc.mimeType,
    };
  }

  async getReleaseGate(dealId: string, _user: any) {
    const docs = (await this.documents.list()).filter((d: any) => d.dealId === dealId);
    const presentDocs = this.matrix.toPresentDocs(docs);
    const gate = this.matrix.releaseReadiness(presentDocs);
    return {
      dealId,
      canRelease: gate.canProceed,
      blocking: gate.blocking,
      summary: this.matrix.releaseBlockerSummary(docs),
    };
  }

  async getCorrectionPlan(id: string, _user: any) {
    const doc = await this.documents.getById(id);
    return {
      documentId: doc.id,
      status: doc.status,
      correctionRequired: doc.status === 'DRAFT' || doc.status === 'REJECTED',
      completeness: doc.completeness,
      steps: doc.status === 'DRAFT'
        ? [{ step: 1, action: 'review', description: 'Проверить содержимое документа' }, { step: 2, action: 'sign', description: 'Подписать документ' }]
        : [],
    };
  }
}
