/**
 * Live Россельхознадзор adapter (phytosanitary certificates) over the shared
 * HTTP client. Per-vendor work left: endpoint paths + field mapping (marked
 * "VENDOR MAPPING").
 */

import type { PhytosanitaryCertificate, RshnAdapter } from '../adapters/rshn.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveRshnAdapter extends LiveAdapterBase implements RshnAdapter {
  readonly name = 'RSHN';
  readonly version = '1.0.0-live';

  async applyForCertificate(
    data: Omit<PhytosanitaryCertificate, 'id' | 'status'>,
  ): Promise<{ id: string }> {
    // VENDOR MAPPING: РСХН certificate application intake.
    return this.http.request<{ id: string }>({
      method: 'POST',
      path: '/certificates',
      body: data,
      idempotencyKey: `rshn-apply:${data.producerInn}:${data.culture}:${data.destinationCountry}`,
    });
  }

  async getCertificateStatus(id: string): Promise<PhytosanitaryCertificate> {
    return this.http.request<PhytosanitaryCertificate>({
      method: 'GET',
      path: `/certificates/${encodeURIComponent(id)}`,
    });
  }

  async listActiveCertificates(producerInn: string): Promise<PhytosanitaryCertificate[]> {
    return this.http.request<PhytosanitaryCertificate[]>({
      method: 'GET',
      path: '/certificates',
      query: { producerInn, status: 'ISSUED' },
    });
  }
}
