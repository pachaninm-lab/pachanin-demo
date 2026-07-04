/**
 * Live ФГИС «Зерно» adapter — reference implementation of the query/registration
 * style integration over the shared HTTP client.
 *
 * The ONLY per-vendor work left is the endpoint paths + field mapping below
 * (marked "VENDOR MAPPING"). Auth/retries/timeouts are handled by the client.
 */

import type {
  FgisAcceptance,
  FgisAdapter,
  FgisCertificate,
  FgisLot,
  FgisLotStatus,
  FgisShipmentConfirmation,
} from '../adapters/fgis-zerno.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveFgisZernoAdapter extends LiveAdapterBase implements FgisAdapter {
  readonly name = 'FGIS_ZERNO';
  readonly version = '1.0.0-live';

  async registerLot(lot: FgisLot): Promise<{ fgisLotId: string }> {
    // VENDOR MAPPING: adjust to ФГИС «Зерно» СДИЗ/lot registration API.
    return this.http.request<{ fgisLotId: string }>({
      method: 'POST',
      path: '/lots',
      body: lot,
      idempotencyKey: `fgis-lot:${lot.id}`,
    });
  }

  async getLotStatus(fgisLotId: string): Promise<FgisLotStatus> {
    return this.http.request<FgisLotStatus>({
      method: 'GET',
      path: `/lots/${encodeURIComponent(fgisLotId)}/status`,
    });
  }

  async confirmShipment(data: FgisShipmentConfirmation): Promise<void> {
    await this.http.request<void>({
      method: 'POST',
      path: `/lots/${encodeURIComponent(data.fgisLotId)}/shipment`,
      body: data,
      idempotencyKey: `fgis-shipment:${data.fgisLotId}:${data.departedAt}`,
    });
  }

  async confirmAcceptance(data: FgisAcceptance): Promise<void> {
    await this.http.request<void>({
      method: 'POST',
      path: `/lots/${encodeURIComponent(data.fgisLotId)}/acceptance`,
      body: data,
      idempotencyKey: `fgis-acceptance:${data.fgisLotId}:${data.acceptedAt}`,
    });
  }

  async getCertificate(fgisLotId: string): Promise<FgisCertificate> {
    return this.http.request<FgisCertificate>({
      method: 'GET',
      path: `/lots/${encodeURIComponent(fgisLotId)}/certificate`,
    });
  }

  async getCrops(): Promise<Array<{ code: string; name: string; classes: string[] }>> {
    return this.http.request<Array<{ code: string; name: string; classes: string[] }>>({
      method: 'GET',
      path: '/dictionaries/crops',
    });
  }
}
