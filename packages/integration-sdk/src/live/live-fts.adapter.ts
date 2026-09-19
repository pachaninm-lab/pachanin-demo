/**
 * Live ФТС adapter (customs declarations, phyto certificates, sanction lists)
 * over the shared HTTP client. Per-vendor work left: endpoint paths + field
 * mapping (marked "VENDOR MAPPING").
 */

import type {
  CustomsDeclaration,
  FtsAdapter,
  PhytoCertificate,
} from '../adapters/fts.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveFtsAdapter extends LiveAdapterBase implements FtsAdapter {
  readonly name = 'FTS';
  readonly version = '1.0.0-live';

  async getDeclarationStatus(dtNumber: string): Promise<CustomsDeclaration> {
    return this.http.request<CustomsDeclaration>({
      method: 'GET',
      path: `/declarations/${encodeURIComponent(dtNumber)}`,
    });
  }

  async submitDeclaration(
    data: Omit<CustomsDeclaration, 'dtNumber' | 'status' | 'submittedAt' | 'updatedAt'>,
  ): Promise<{ dtNumber: string }> {
    // VENDOR MAPPING: ДТ submission; idempotency keyed on the declared goods+value.
    return this.http.request<{ dtNumber: string }>({
      method: 'POST',
      path: '/declarations',
      body: data,
      idempotencyKey: `fts-declare:${data.tnvedCode}:${data.totalValueRub}`,
    });
  }

  async getPhytoCertificate(certificateNumber: string): Promise<PhytoCertificate | null> {
    return this.http.request<PhytoCertificate | null>({
      method: 'GET',
      path: `/phyto-certificates/${encodeURIComponent(certificateNumber)}`,
    });
  }

  async getSanctionList(country: string): Promise<{ sanctioned: boolean; listName?: string }> {
    return this.http.request<{ sanctioned: boolean; listName?: string }>({
      method: 'GET',
      path: '/sanctions',
      query: { country },
    });
  }
}
