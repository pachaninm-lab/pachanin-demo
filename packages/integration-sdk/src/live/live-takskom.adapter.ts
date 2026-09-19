/**
 * Live Такском/СБИС ЭДО adapter (UPD/TORG-12/acts) over the shared HTTP client.
 * Mirrors the public methods of the mock. Per-vendor work left: endpoint paths +
 * field mapping (marked "VENDOR MAPPING").
 */

import type {
  EdoDocument,
  EdoOperator,
  EdoSendRequest,
  EdoStatusResponse,
} from '../adapters/takskom.adapter';
import type { HttpIntegrationClient } from './http-integration-client';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveTakskomAdapter extends LiveAdapterBase {
  readonly name = 'TAKSKOM';
  readonly version = '1.0.0-live';

  constructor(http: HttpIntegrationClient, private readonly operator: EdoOperator = 'TAKSKOM') {
    super(http);
  }

  async sendDocument(req: EdoSendRequest): Promise<EdoDocument> {
    // VENDOR MAPPING: Такском/СБИС document-send API.
    return this.http.request<EdoDocument>({
      method: 'POST',
      path: '/documents',
      body: { ...req, operator: this.operator },
      idempotencyKey: `takskom-send:${req.senderInn}:${req.recipientInn}:${req.dealId ?? req.title}`,
    });
  }

  async getStatus(externalId: string): Promise<EdoStatusResponse> {
    return this.http.request<EdoStatusResponse>({
      method: 'GET',
      path: `/documents/${encodeURIComponent(externalId)}/status`,
    });
  }

  async getDocument(externalId: string): Promise<EdoDocument | null> {
    return this.http.request<EdoDocument | null>({
      method: 'GET',
      path: `/documents/${encodeURIComponent(externalId)}`,
    });
  }

  async signDocument(externalId: string, certificateId: string): Promise<EdoDocument> {
    return this.http.request<EdoDocument>({
      method: 'POST',
      path: `/documents/${encodeURIComponent(externalId)}/sign`,
      body: { certificateId },
      idempotencyKey: `takskom-sign:${externalId}`,
    });
  }

  async rejectDocument(externalId: string, reason: string): Promise<EdoDocument> {
    return this.http.request<EdoDocument>({
      method: 'POST',
      path: `/documents/${encodeURIComponent(externalId)}/reject`,
      body: { reason },
      idempotencyKey: `takskom-reject:${externalId}`,
    });
  }

  async listByDeal(dealId: string): Promise<EdoDocument[]> {
    return this.http.request<EdoDocument[]>({
      method: 'GET',
      path: '/documents',
      query: { dealId },
    });
  }
}
