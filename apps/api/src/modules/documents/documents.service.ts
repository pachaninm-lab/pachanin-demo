import { Injectable } from '@nestjs/common';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';

@Injectable()
export class DocumentsService {
  constructor(private readonly runtime: RuntimeCoreService) {}

  list(_user: any) {
    return this.runtime.listDocuments();
  }

  getOne(id: string, _user: any) {
    return this.runtime.getDocument(id);
  }

  getSignedAccess(id: string, _user: any) {
    const doc = this.runtime.getDocument(id);
    return {
      documentId: doc.id,
      accessUrl: doc.url,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      mimeType: doc.mimeType,
    };
  }

  async streamContent(id: string, _user: any) {
    const doc = this.runtime.getDocument(id);
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
    return this.runtime.uploadDocument(file, dto, user);
  }

  download(id: string, _user: any) {
    const doc = this.runtime.getDocument(id);
    return {
      documentId: doc.id,
      downloadUrl: doc.url,
      name: doc.name,
      mimeType: doc.mimeType,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  signDocument(id: string, user: any) {
    return this.runtime.signDocument(id, user);
  }

  generateDealPackage(dealId: string, user: any) {
    return this.runtime.generateDealPackage(dealId, user);
  }

  getPreview(id: string, _user: any) {
    const doc = this.runtime.getDocument(id);
    return {
      documentId: doc.id,
      name: doc.name,
      previewUrl: `${doc.url}?preview=true`,
      mimeType: doc.mimeType,
    };
  }

  getCorrectionPlan(id: string, _user: any) {
    const doc = this.runtime.getDocument(id);
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
