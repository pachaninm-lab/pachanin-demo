import { BaseMockAdapter } from '../adapter.interface';

export type EdoDocumentType = 'UPD' | 'INVOICE' | 'ACT' | 'CONTRACT' | 'SPEC' | 'WAYBILL';
export type EdoStatus = 'SENT' | 'DELIVERED' | 'SIGNED' | 'REJECTED' | 'CANCELLED' | 'ERROR';

export interface EdoDocument {
  id?: string;
  externalId?: string;
  type: EdoDocumentType;
  senderInn: string;
  receiverInn: string;
  amount?: number;
  currency?: string;
  documentDate: string;
  documentNumber: string;
  content: string; // base64 PDF
  filename: string;
}

export interface EdoSendResult {
  externalId: string;
  status: EdoStatus;
  sentAt: string;
}

export interface EdoStatusUpdate {
  externalId: string;
  status: EdoStatus;
  updatedAt: string;
  rejectReason?: string;
}

export interface DiadokAdapter {
  sendDocument(doc: EdoDocument): Promise<EdoSendResult>;
  getDocumentStatus(externalId: string): Promise<EdoStatusUpdate>;
  signIncomingDocument(externalId: string, signatureBase64: string): Promise<void>;
  rejectDocument(externalId: string, reason: string): Promise<void>;
  listIncoming(senderInn?: string): Promise<EdoDocument[]>;
}

export class MockDiadokAdapter extends BaseMockAdapter<unknown, unknown> implements DiadokAdapter {
  readonly name = 'DIADOK';
  readonly version = '1.0.0';

  private readonly sent = new Map<string, EdoStatusUpdate>();

  async execute(request: unknown): Promise<unknown> {
    return { mock: true, request };
  }

  async sendDocument(doc: EdoDocument): Promise<EdoSendResult> {
    const externalId = `DIADOK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.sent.set(externalId, { externalId, status: 'DELIVERED', updatedAt: new Date().toISOString() });
    return { externalId, status: 'DELIVERED', sentAt: new Date().toISOString() };
  }

  async getDocumentStatus(externalId: string): Promise<EdoStatusUpdate> {
    return this.sent.get(externalId) ?? { externalId, status: 'SENT', updatedAt: new Date().toISOString() };
  }

  async signIncomingDocument(externalId: string, _signatureBase64: string): Promise<void> {
    const record = this.sent.get(externalId);
    if (record) record.status = 'SIGNED';
  }

  async rejectDocument(externalId: string, reason: string): Promise<void> {
    const record = this.sent.get(externalId);
    if (record) { record.status = 'REJECTED'; record.rejectReason = reason; }
  }

  async listIncoming(_senderInn?: string): Promise<EdoDocument[]> {
    return [];
  }
}
