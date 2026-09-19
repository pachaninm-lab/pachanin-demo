/**
 * Live ГИС ЭПД adapter (electronic transport documents / ЭТН) over the shared
 * HTTP client. Mirrors the public methods of the mock. Per-vendor work left:
 * endpoint paths + field mapping (marked "VENDOR MAPPING").
 */

import type {
  EtnCreateRequest,
  EtnDocument,
  EtnSignRequest,
} from '../adapters/gis-epd.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveGisEpdAdapter extends LiveAdapterBase {
  readonly name = 'GIS_EPD';
  readonly version = '1.0.0-live';

  async createEtn(req: EtnCreateRequest): Promise<EtnDocument> {
    // VENDOR MAPPING: ГИС ЭПД (Минтранс) ЭТН creation.
    return this.http.request<EtnDocument>({
      method: 'POST',
      path: '/etn',
      body: req,
      idempotencyKey: `etn-create:${req.dealId}:${req.vehicleNumber}:${req.loadingDate}`,
    });
  }

  async signEtn(req: EtnSignRequest): Promise<EtnDocument> {
    return this.http.request<EtnDocument>({
      method: 'POST',
      path: `/etn/${encodeURIComponent(req.etnId)}/sign`,
      body: req,
      idempotencyKey: `etn-sign:${req.etnId}:${req.signerRole}`,
    });
  }

  async getStatus(etnId: string): Promise<EtnDocument> {
    return this.http.request<EtnDocument>({
      method: 'GET',
      path: `/etn/${encodeURIComponent(etnId)}`,
    });
  }

  async listByDeal(dealId: string): Promise<EtnDocument[]> {
    return this.http.request<EtnDocument[]>({
      method: 'GET',
      path: '/etn',
      query: { dealId },
    });
  }
}
