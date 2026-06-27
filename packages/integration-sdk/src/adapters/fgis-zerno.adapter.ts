import { BaseMockAdapter } from '../adapter.interface';

export interface FgisLot {
  id: string;
  culture: string;
  cropClass: string;
  volumeTons: number;
  producerInn: string;
  regionCode: string;
  gost: string;
}

export interface FgisLotStatus {
  fgisLotId: string;
  status: 'REGISTERED' | 'SHIPPED' | 'ACCEPTED' | 'ARCHIVED';
  updatedAt: string;
}

export interface FgisShipmentConfirmation {
  fgisLotId: string;
  vehicleNumber: string;
  driverName: string;
  routeFrom: string;
  routeTo: string;
  loadedTons: number;
  departedAt: string;
}

export interface FgisAcceptance {
  fgisLotId: string;
  receiverInn: string;
  acceptedTons: number;
  quality: Record<string, number>; // parameter → value
  acceptedAt: string;
}

export interface FgisCertificate {
  fgisLotId: string;
  certificateNumber: string;
  issuedAt: string;
  validUntil: string;
  culture: string;
  cropClass: string;
  producerName: string;
}

export interface FgisAdapter {
  registerLot(lot: FgisLot): Promise<{ fgisLotId: string }>;
  getLotStatus(fgisLotId: string): Promise<FgisLotStatus>;
  confirmShipment(data: FgisShipmentConfirmation): Promise<void>;
  confirmAcceptance(data: FgisAcceptance): Promise<void>;
  getCertificate(fgisLotId: string): Promise<FgisCertificate>;
  getCrops(): Promise<Array<{ code: string; name: string; classes: string[] }>>;
}

export class MockFgisZernoAdapter extends BaseMockAdapter<unknown, unknown> implements FgisAdapter {
  readonly name = 'FGIS_ZERNO';
  readonly version = '1.0.0';

  async execute(request: unknown): Promise<unknown> {
    return { mock: true, request };
  }

  async registerLot(lot: FgisLot): Promise<{ fgisLotId: string }> {
    return { fgisLotId: `FGIS-${lot.producerInn}-${Date.now()}` };
  }

  async getLotStatus(fgisLotId: string): Promise<FgisLotStatus> {
    return { fgisLotId, status: 'REGISTERED', updatedAt: new Date().toISOString() };
  }

  async confirmShipment(_data: FgisShipmentConfirmation): Promise<void> {}

  async confirmAcceptance(_data: FgisAcceptance): Promise<void> {}

  async getCertificate(fgisLotId: string): Promise<FgisCertificate> {
    return {
      fgisLotId,
      certificateNumber: `CERT-${Date.now()}`,
      issuedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 90 * 86400000).toISOString(),
      culture: 'Пшеница',
      cropClass: '4',
      producerName: 'Mock Producer ООО',
    };
  }

  async getCrops() {
    return [
      { code: 'WHEAT', name: 'Пшеница', classes: ['1', '2', '3', '4', '5'] },
      { code: 'BARLEY', name: 'Ячмень', classes: ['1', '2', '3'] },
      { code: 'CORN', name: 'Кукуруза', classes: ['1', '2', '3'] },
      { code: 'SUNFLOWER', name: 'Подсолнечник', classes: ['1', '2'] },
      { code: 'SOY', name: 'Соя', classes: ['1', '2'] },
    ];
  }
}
