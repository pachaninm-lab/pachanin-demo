import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, type DocumentRepository } from './document.repository';
import { DocumentMatrixService } from './document-matrix.service';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { integrationRegistry } from '../../../../../packages/integration-sdk/src/registry';

// Roles trusted across deals (platform-level oversight / shared operators).
// Party-scoped roles (FARMER, BUYER) may only reach documents of deals their
// org is a party to — mirroring the canonical object-scope policy.
const CROSS_DEAL_DOCUMENT_ROLES = new Set([
  'ADMIN',
  'SUPPORT_MANAGER',
  'EXECUTIVE',
  'LAB',
  'LOGISTICIAN',
  'ELEVATOR',
  'ACCOUNTING',
  'DRIVER',
]);

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    private readonly matrix: DocumentMatrixService,
    private readonly runtime: RuntimeCoreService,
  ) {}

  /**
   * Enforces per-document access. Party-scoped roles (FARMER/BUYER) may only
   * see documents belonging to a deal their org is a party to, or documents
   * they uploaded themselves. Fails closed when the owning deal cannot be
   * resolved for a party-scoped user.
   */
  private async assertDocumentAccess(doc: any, user: any): Promise<void> {
    if (!doc) throw new NotFoundException('Document not found');
    const role = String(user?.role || '');
    if (CROSS_DEAL_DOCUMENT_ROLES.has(role)) return;
    if (doc.uploadedByUserId && user?.id && doc.uploadedByUserId === user.id) return;

    let deal: any = null;
    try {
      deal = doc.dealId ? await this.runtime.getDeal(doc.dealId) : null;
    } catch {
      deal = null;
    }
    const isParty =
      !!deal && (deal.sellerOrgId === user?.orgId || deal.buyerOrgId === user?.orgId);
    if (!isParty) {
      throw new ForbiddenException(`Cross-organization access denied for document:${doc?.id ?? ''}`);
    }
  }

  async list(user: any) {
    const all = await this.documents.list();
    const role = String(user?.role || '');
    if (CROSS_DEAL_DOCUMENT_ROLES.has(role)) return all;
    // Party-scoped: keep only documents the user's org is a party to (or uploaded).
    const results = await Promise.all(
      all.map(async (doc: any) => {
        try {
          await this.assertDocumentAccess(doc, user);
          return doc;
        } catch {
          return null;
        }
      }),
    );
    return results.filter((doc) => doc !== null);
  }

  async getOne(id: string, user: any) {
    const doc = await this.documents.getById(id);
    await this.assertDocumentAccess(doc, user);
    return doc;
  }

  async getSignedAccess(id: string, user: any) {
    const doc = await this.documents.getById(id);
    await this.assertDocumentAccess(doc, user);
    return {
      documentId: doc.id,
      accessUrl: doc.url,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      mimeType: doc.mimeType,
    };
  }

  async streamContent(id: string, user: any) {
    const doc = await this.documents.getById(id);
    await this.assertDocumentAccess(doc, user);
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

  async download(id: string, user: any) {
    const doc = await this.documents.getById(id);
    await this.assertDocumentAccess(doc, user);
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

  async getPreview(id: string, user: any) {
    const doc = await this.documents.getById(id);
    await this.assertDocumentAccess(doc, user);
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

  async edoSend(id: string, params: { recipientInn: string; recipientBoxId?: string }, user: any) {
    const doc = await this.documents.getById(id);
    try {
      const diadok = integrationRegistry.get('DIADOK') as any;
      const result = await diadok.execute({
        action: 'sendDocument',
        documentId: id,
        documentName: doc.name,
        documentType: doc.type ?? 'CONTRACT',
        recipientBoxId: params.recipientBoxId ?? `box-${params.recipientInn}`,
        content: Buffer.from(`Document ${id}`).toString('base64'),
        senderBoxId: `box-${user.orgId}`,
      });
      return { documentId: id, edoExternalId: result.externalId, edoStatus: result.status, sentAt: new Date().toISOString() };
    } catch (err) {
      this.logger.warn(`EDO send failed for doc ${id}: ${(err as Error).message}`);
      return { documentId: id, edoStatus: 'SEND_FAILED', error: (err as Error).message };
    }
  }

  async edoSign(id: string, certificateId: string | undefined, user: any) {
    const doc = await this.documents.getById(id);
    try {
      const cryptopro = integrationRegistry.get('CRYPTOPRO_DSS') as any;
      const certId = certificateId ?? `cert-${user.id}-001`;
      const docHash = require('crypto').createHash('sha256').update(`Document ${id}`).digest('hex');
      const signature = await cryptopro.signDocument(docHash, certId);
      return { documentId: id, signature: signature.signatureBase64, certificateId: certId, documentHash: docHash, signedAt: signature.signedAt };
    } catch (err) {
      this.logger.warn(`EDO sign failed for doc ${id}: ${(err as Error).message}`);
      return { documentId: id, signed: false, error: (err as Error).message };
    }
  }

  async edoGetStatus(id: string, _user: any) {
    try {
      const diadok = integrationRegistry.get('DIADOK') as any;
      const result = await diadok.execute({ action: 'getDocumentStatus', externalId: `ext-${id}` });
      return { documentId: id, ...result };
    } catch (err) {
      return { documentId: id, edoStatus: 'UNKNOWN', error: (err as Error).message };
    }
  }

  async verifySignature(id: string, body: { signatureBase64: string; certificateId: string; documentHash?: string }, _user: any) {
    try {
      const cryptopro = integrationRegistry.get('CRYPTOPRO_DSS') as any;
      const docHash = body.documentHash ?? require('crypto').createHash('sha256').update(`Document ${id}`).digest('hex');
      const result = await cryptopro.verifySignature(docHash, {
        documentHash: docHash,
        signatureBase64: body.signatureBase64,
        certificateId: body.certificateId,
        signedAt: new Date().toISOString(),
        algorithm: 'GOST_R_34_10_2012',
      });
      return { documentId: id, ...result };
    } catch (err) {
      return { documentId: id, valid: false, error: (err as Error).message };
    }
  }

  async getUserCertificates(user: any) {
    try {
      const cryptopro = integrationRegistry.get('CRYPTOPRO_DSS') as any;
      return cryptopro.getCertificates(user.id);
    } catch (err) {
      return [];
    }
  }

  async checkCertificateStatus(certificateId: string) {
    const cryptopro = integrationRegistry.get('CRYPTOPRO_DSS') as any;
    const status = await cryptopro.checkCertificateStatus(certificateId);
    return { certificateId, status };
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

  async edoSendViaTakskom(id: string, params: { senderInn: string; recipientInn: string }, user: any) {
    const doc = await this.documents.getById(id);
    try {
      const takskom = integrationRegistry.get('TAKSKOM') as any;
      const result = await takskom.execute({
        action: 'sendDocument',
        type: doc.type === 'INVOICE' ? 'SF' : doc.type === 'ACT' ? 'ACT' : 'UPD',
        senderInn: params.senderInn,
        recipientInn: params.recipientInn,
        title: doc.name,
        content: JSON.stringify({ documentId: id }),
        dealId: doc.dealId,
      });
      return { documentId: id, edoExternalId: result.externalId, operator: 'TAKSKOM', edoStatus: result.status, sentAt: new Date().toISOString() };
    } catch (err) {
      this.logger.warn(`Такском send failed for doc ${id}: ${(err as Error).message}`);
      return { documentId: id, edoStatus: 'SEND_FAILED', operator: 'TAKSKOM', error: (err as Error).message };
    }
  }
}
