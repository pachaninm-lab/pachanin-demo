import { Injectable, NotFoundException } from '@nestjs/common';

const DOCUMENTS_SEED = [
  {
    id: 'DOC-001',
    dealId: 'DEAL-001',
    type: 'contract',
    status: 'SIGNED',
    name: 'Договор купли-продажи №DEAL-001',
    signedAt: '2026-03-25T12:00:00Z',
    uploadedAt: '2026-03-24T10:00:00Z',
    uploadedByUserId: 'user-farmer-1',
    mimeType: 'application/pdf',
    url: '/documents/DOC-001/content',
  },
  {
    id: 'DOC-002',
    dealId: 'DEAL-001',
    type: 'transport_waybill',
    status: 'SIGNED',
    name: 'ТТН №001',
    signedAt: '2026-03-28T08:00:00Z',
    uploadedAt: '2026-03-28T07:30:00Z',
    uploadedByUserId: 'user-logistician-1',
    mimeType: 'application/pdf',
    url: '/documents/DOC-002/content',
  },
  {
    id: 'DOC-003',
    dealId: 'DEAL-002',
    type: 'quality_certificate',
    status: 'GENERATED',
    name: 'Сертификат качества DEAL-002',
    uploadedAt: '2026-04-02T09:00:00Z',
    uploadedByUserId: 'user-lab-1',
    mimeType: 'application/pdf',
    url: '/documents/DOC-003/content',
  },
  {
    id: 'DOC-004',
    dealId: 'DEAL-003',
    type: 'contract',
    status: 'DRAFT',
    name: 'Договор купли-продажи №DEAL-003',
    uploadedAt: '2026-04-01T10:30:00Z',
    uploadedByUserId: 'user-farmer-2',
    mimeType: 'application/pdf',
    url: '/documents/DOC-004/content',
  },
];

@Injectable()
export class DocumentsService {
  private documents: any[] = DOCUMENTS_SEED.map((d) => ({ ...d }));
  private docCounter = 10;

  list(_user: any) {
    return this.documents;
  }

  getOne(id: string, _user: any) {
    const doc = this.documents.find((d) => d.id === id);
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return doc;
  }

  getSignedAccess(id: string, user: any) {
    const doc = this.getOne(id, user);
    return {
      documentId: doc.id,
      accessUrl: doc.url,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      mimeType: doc.mimeType,
    };
  }

  async streamContent(id: string, user: any) {
    const doc = this.getOne(id, user);
    return {
      file: {
        documentId: doc.id,
        name: doc.name,
        mimeType: doc.mimeType,
        content: `Demo content for ${doc.name}`,
      },
    };
  }

  upload(file: any | any, dto: any, user: any) {
    const id = `DOC-${String(++this.docCounter).padStart(3, '0')}`;
    const doc: any = {
      id,
      dealId: dto?.dealId ?? null,
      type: dto?.type ?? 'other',
      status: 'UPLOADED',
      name: dto?.name ?? (file?.originalname ?? `Document ${id}`),
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: user?.sub ?? user?.id ?? null,
      mimeType: file?.mimetype ?? dto?.mimeType ?? 'application/octet-stream',
      url: `/documents/${id}/content`,
      size: file?.size ?? null,
    };
    this.documents.push(doc);
    return doc;
  }

  download(id: string, user: any) {
    const doc = this.getOne(id, user);
    return {
      documentId: doc.id,
      downloadUrl: doc.url,
      name: doc.name,
      mimeType: doc.mimeType,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  signDocument(id: string, user: any) {
    const doc = this.getOne(id, user);
    doc.status = 'SIGNED';
    doc.signedAt = new Date().toISOString();
    doc.signedByUserId = user?.sub ?? user?.id ?? null;
    return doc;
  }

  generateDealPackage(dealId: string, user: any) {
    const generated: any[] = [];
    const types = ['contract', 'quality_certificate', 'transport_waybill'];
    for (const type of types) {
      const id = `DOC-${String(++this.docCounter).padStart(3, '0')}`;
      const doc: any = {
        id,
        dealId,
        type,
        status: 'GENERATED',
        name: `${type} для ${dealId}`,
        uploadedAt: new Date().toISOString(),
        uploadedByUserId: user?.sub ?? user?.id ?? null,
        mimeType: 'application/pdf',
        url: `/documents/${id}/content`,
      };
      this.documents.push(doc);
      generated.push(doc);
    }
    return { dealId, generated };
  }

  getPreview(id: string, user: any) {
    const doc = this.getOne(id, user);
    return {
      documentId: doc.id,
      name: doc.name,
      previewUrl: `${doc.url}?preview=true`,
      mimeType: doc.mimeType,
    };
  }

  getCorrectionPlan(id: string, user: any) {
    const doc = this.getOne(id, user);
    return {
      documentId: doc.id,
      status: doc.status,
      correctionRequired: doc.status === 'DRAFT' || doc.status === 'REJECTED',
      steps: doc.status === 'DRAFT'
        ? [{ step: 1, action: 'review', description: 'Review document content' }, { step: 2, action: 'sign', description: 'Sign the document' }]
        : [],
    };
  }
}
