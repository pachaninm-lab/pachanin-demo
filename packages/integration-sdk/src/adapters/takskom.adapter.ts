import { IntegrationAdapter, HealthStatus } from '../adapter.interface';

export type EdoDocumentType = 'UPD' | 'TORG12' | 'SF' | 'ACT' | 'CONTRACT' | 'ADDITIONAL_AGREEMENT';
export type EdoDocumentStatus = 'DRAFT' | 'SENT' | 'DELIVERED' | 'SIGNED' | 'REJECTED' | 'CANCELLED';
export type EdoOperator = 'TAKSKOM' | 'SBIS';

export interface EdoDocument {
  id: string;
  externalId: string;
  operator: EdoOperator;
  type: EdoDocumentType;
  status: EdoDocumentStatus;
  senderInn: string;
  recipientInn: string;
  title: string;
  amount?: number;
  currency?: string;
  dealId?: string;
  sentAt?: string;
  deliveredAt?: string;
  signedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface EdoSendRequest {
  type: EdoDocumentType;
  senderInn: string;
  recipientInn: string;
  title: string;
  content: string;
  dealId?: string;
  amount?: number;
  currency?: string;
}

export interface EdoStatusResponse {
  externalId: string;
  status: EdoDocumentStatus;
  updatedAt: string;
  details?: string;
}

export class MockTakskomAdapter implements IntegrationAdapter {
  readonly name = 'TAKSKOM';
  readonly version = '4.2.0';
  readonly mode = 'mock' as const;
  private readonly operator: EdoOperator;
  private readonly docs = new Map<string, EdoDocument>();
  private counter = 0;

  constructor(operator: EdoOperator = 'TAKSKOM') {
    this.operator = operator;
  }

  async execute(request: {
    action: 'sendDocument' | 'getStatus' | 'signDocument' | 'rejectDocument' | 'listByDeal' | 'getDocument';
    [key: string]: unknown;
  }): Promise<unknown> {
    switch (request.action) {
      case 'sendDocument':
        return this.sendDocument(request as unknown as EdoSendRequest);
      case 'getStatus':
        return this.getStatus(request.externalId as string);
      case 'signDocument':
        return this.signDocument(request.externalId as string, request.certificateId as string);
      case 'rejectDocument':
        return this.rejectDocument(request.externalId as string, request.reason as string);
      case 'listByDeal':
        return this.listByDeal(request.dealId as string);
      case 'getDocument':
        return this.getDocument(request.externalId as string);
      default:
        throw new Error(`Unknown Takskom action: ${(request as { action: string }).action}`);
    }
  }

  async sendDocument(req: EdoSendRequest): Promise<EdoDocument> {
    const id = `edo-${this.operator.toLowerCase()}-${String(++this.counter).padStart(6, '0')}`;
    const doc: EdoDocument = {
      id,
      externalId: id,
      operator: this.operator,
      type: req.type,
      status: 'SENT',
      senderInn: req.senderInn,
      recipientInn: req.recipientInn,
      title: req.title,
      amount: req.amount,
      currency: req.currency ?? 'RUB',
      dealId: req.dealId,
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Simulate delivery after creation
    setTimeout(() => {
      const d = this.docs.get(id);
      if (d && d.status === 'SENT') {
        d.status = 'DELIVERED';
        d.deliveredAt = new Date().toISOString();
      }
    }, 200);

    this.docs.set(id, doc);
    return { ...doc };
  }

  async getStatus(externalId: string): Promise<EdoStatusResponse> {
    const doc = this.docs.get(externalId);
    if (!doc) {
      return { externalId, status: 'DRAFT', updatedAt: new Date().toISOString(), details: 'Document not found in mock store' };
    }
    return {
      externalId,
      status: doc.status,
      updatedAt: doc.signedAt ?? doc.deliveredAt ?? doc.sentAt ?? doc.createdAt,
    };
  }

  async getDocument(externalId: string): Promise<EdoDocument | null> {
    return this.docs.get(externalId) ?? null;
  }

  async signDocument(externalId: string, _certificateId: string): Promise<EdoDocument> {
    const doc = this.docs.get(externalId);
    if (!doc) throw new Error(`EDO document ${externalId} not found`);
    if (doc.status !== 'DELIVERED') throw new Error(`Cannot sign document in status ${doc.status}`);
    doc.status = 'SIGNED';
    doc.signedAt = new Date().toISOString();
    return { ...doc };
  }

  async rejectDocument(externalId: string, reason: string): Promise<EdoDocument> {
    const doc = this.docs.get(externalId);
    if (!doc) throw new Error(`EDO document ${externalId} not found`);
    doc.status = 'REJECTED';
    doc.rejectedAt = new Date().toISOString();
    doc.rejectionReason = reason;
    return { ...doc };
  }

  async listByDeal(dealId: string): Promise<EdoDocument[]> {
    return Array.from(this.docs.values()).filter(d => d.dealId === dealId);
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'ok',
      lastCheckedAt: new Date().toISOString(),
      detail: `${this.operator} ЭДО mock adapter — sandbox mode`,
    };
  }
}
