/**
 * Live РЖД ЭТРАН adapter (rail waybills ГУ-29, wagon tracking, demurrage) over
 * the shared HTTP client. Mirrors the public methods of the mock. Per-vendor
 * work left: endpoint paths + field mapping (marked "VENDOR MAPPING").
 */

import type {
  EtranDemurrageQuery,
  EtranDemurrageResult,
  EtranWaybillRequest,
  EtranWaybillResult,
  EtranWagonStatus,
} from '../adapters/rzd-etran.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveRzdEtranAdapter extends LiveAdapterBase {
  readonly name = 'RZD_ETRAN';
  readonly version = '1.0.0-live';

  async createWaybill(req: EtranWaybillRequest): Promise<EtranWaybillResult> {
    // VENDOR MAPPING: ЭТРАН waybill (ГУ-29) creation.
    return this.http.request<EtranWaybillResult>({
      method: 'POST',
      path: '/waybills',
      body: req,
      idempotencyKey: `etran-waybill:${req.wagonNumber}:${req.loadDate}`,
    });
  }

  async getWagonStatus(wagonNumber: string): Promise<EtranWagonStatus> {
    return this.http.request<EtranWagonStatus>({
      method: 'GET',
      path: `/wagons/${encodeURIComponent(wagonNumber)}/status`,
    });
  }

  async getDemurrage(req: EtranDemurrageQuery): Promise<EtranDemurrageResult> {
    return this.http.request<EtranDemurrageResult>({
      method: 'GET',
      path: `/wagons/${encodeURIComponent(req.wagonNumber)}/demurrage`,
      query: { from: req.fromDate, to: req.toDate },
    });
  }
}
