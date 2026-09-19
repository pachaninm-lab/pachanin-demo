/**
 * Live ЭДО Контур.Диадок adapter (УПД/акты/счета-фактуры) over the shared HTTP
 * client. Transport (auth/retries/timeouts) is handled by the client; the
 * per-vendor work left is endpoint paths + field mapping (marked "VENDOR MAPPING")
 * and wiring the status webhooks. Stays at pre-integration maturity until a real
 * Диадок contract and credentials land.
 */

import type {
  DiadokAdapter,
  EdoDocument,
  EdoSendResult,
  EdoStatusUpdate,
} from '../adapters/diadok.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveDiadokAdapter extends LiveAdapterBase implements DiadokAdapter {
  readonly name = 'DIADOK';
  readonly version = '1.0.0-live';

  async sendDocument(doc: EdoDocument): Promise<EdoSendResult> {
    // VENDOR MAPPING: Диадок message-send API (organization box, document type).
    return this.http.request<EdoSendResult>({
      method: 'POST',
      path: '/documents',
      body: doc,
      idempotencyKey: `diadok-send:${doc.senderInn}:${doc.receiverInn}:${doc.documentNumber}`,
    });
  }

  async getDocumentStatus(externalId: string): Promise<EdoStatusUpdate> {
    return this.http.request<EdoStatusUpdate>({
      method: 'GET',
      path: `/documents/${encodeURIComponent(externalId)}/status`,
    });
  }

  async signIncomingDocument(externalId: string, signatureBase64: string): Promise<void> {
    await this.http.request<void>({
      method: 'POST',
      path: `/documents/${encodeURIComponent(externalId)}/sign`,
      body: { signatureBase64 },
      idempotencyKey: `diadok-sign:${externalId}`,
    });
  }

  async rejectDocument(externalId: string, reason: string): Promise<void> {
    await this.http.request<void>({
      method: 'POST',
      path: `/documents/${encodeURIComponent(externalId)}/reject`,
      body: { reason },
      idempotencyKey: `diadok-reject:${externalId}`,
    });
  }

  async listIncoming(senderInn?: string): Promise<EdoDocument[]> {
    return this.http.request<EdoDocument[]>({
      method: 'GET',
      path: '/documents/incoming',
      query: { senderInn },
    });
  }
}
