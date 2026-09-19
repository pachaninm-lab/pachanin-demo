/**
 * Live БКИ / НБКИ adapter (credit reports, consent verification) over the shared
 * HTTP client. Mirrors the public methods of the mock. Per-vendor work left:
 * endpoint paths + field mapping (marked "VENDOR MAPPING").
 */

import type { BkiConsentRequest, BkiCreditReport } from '../adapters/bki.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveBkiAdapter extends LiveAdapterBase {
  readonly name = 'BKI_NBKI';
  readonly version = '1.0.0-live';

  async getCreditReport(inn: string, organizationName?: string): Promise<BkiCreditReport> {
    // VENDOR MAPPING: НБКИ report pull (requires a valid subject consent).
    return this.http.request<BkiCreditReport>({
      method: 'GET',
      path: `/credit-reports/${encodeURIComponent(inn)}`,
      query: { organizationName },
    });
  }

  async verifyConsent(req: BkiConsentRequest): Promise<{ consentValid: boolean; consentDocumentId: string }> {
    return this.http.request<{ consentValid: boolean; consentDocumentId: string }>({
      method: 'POST',
      path: '/consents/verify',
      body: req,
      idempotencyKey: `bki-consent:${req.subjectInn}:${req.consentDocumentId}`,
    });
  }
}
