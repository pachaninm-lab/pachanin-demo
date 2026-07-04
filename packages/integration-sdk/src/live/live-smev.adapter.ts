/**
 * Live СМЭВ adapter (inter-agency gov requests: ЕГРЮЛ, Росреестр, МФЦ, licensing)
 * over the shared HTTP client. Mirrors the public methods of the mock. СМЭВ uses
 * signed SOAP envelopes + mTLS in production — the per-vendor work left is the
 * envelope mapping and transport certificates (marked "VENDOR MAPPING").
 */

import type {
  EgrulRecord,
  SmevRequest,
  SmevResponse,
  SmevServiceType,
} from '../adapters/smev.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveSmevAdapter extends LiveAdapterBase {
  readonly name = 'SMEV';
  readonly version = '1.0.0-live';

  async sendRequest(service: SmevServiceType, payload: Record<string, unknown>): Promise<SmevRequest> {
    // VENDOR MAPPING: wrap payload in the СМЭВ 3.x envelope for `service`.
    return this.http.request<SmevRequest>({
      method: 'POST',
      path: '/requests',
      body: { service, payload },
      idempotencyKey: `smev-req:${service}:${String(payload.inn ?? payload.applicationId ?? payload.snils ?? '')}`,
    });
  }

  async getResponse(requestId: string): Promise<SmevResponse> {
    return this.http.request<SmevResponse>({
      method: 'GET',
      path: `/requests/${encodeURIComponent(requestId)}`,
    });
  }

  async verifyInn(
    inn: string,
    ogrn?: string,
  ): Promise<{ valid: boolean; inn: string; ogrn?: string; status: string; errorCode?: string }> {
    return this.http.request({
      method: 'POST',
      path: '/inn/verify',
      body: { inn, ogrn },
    });
  }

  async getEgrul(inn: string): Promise<EgrulRecord | null> {
    return this.http.request<EgrulRecord | null>({
      method: 'GET',
      path: `/egrul/${encodeURIComponent(inn)}`,
    });
  }

  async checkLicense(
    inn: string,
    licenseType: string,
  ): Promise<{ inn: string; licenseType: string; hasLicense: boolean; licenseNumber?: string; validUntil?: string }> {
    return this.http.request({
      method: 'GET',
      path: `/licenses/${encodeURIComponent(inn)}`,
      query: { licenseType },
    });
  }
}
