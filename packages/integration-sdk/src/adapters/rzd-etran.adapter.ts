import { IntegrationAdapter, HealthStatus } from '../adapter.interface';

export interface EtranWaybillRequest {
  wagonNumber: string;
  loadStationCode: string;
  destStationCode: string;
  senderId: string;
  receiverId: string;
  cargoCode: string;
  weightTons: number;
  loadDate: string;
  dealId?: string;
}

export interface EtranWaybillResult {
  waybillId: string;
  gu29Number: string;
  status: 'ACCEPTED' | 'PROCESSING' | 'REJECTED';
  acceptedAt: string;
}

export interface EtranWagonStatus {
  wagonNumber: string;
  currentStation: string;
  stationCode: string;
  operationCode: string;
  operationName: string;
  timestamp: string;
  estimatedArrivalAt?: string;
}

export interface EtranDemurrageQuery {
  wagonNumber: string;
  fromDate: string;
  toDate: string;
}

export interface EtranDemurrageResult {
  wagonNumber: string;
  chargeableHours: number;
  rateKopecksPerHour: number;
  totalKopecks: number;
  periods: Array<{ stationCode: string; hoursHeld: number; from: string; to: string }>;
}

export class MockRzdEtranAdapter implements IntegrationAdapter {
  readonly name = 'RZD_ETRAN';
  readonly version = '2.4.0';
  readonly mode = 'mock' as const;

  private waybillCounter = 1000;

  async execute(request: {
    action: 'createWaybill' | 'getWagonStatus' | 'getDemurrage';
    [key: string]: unknown;
  }): Promise<unknown> {
    switch (request.action) {
      case 'createWaybill':
        return this.createWaybill(request as unknown as EtranWaybillRequest);
      case 'getWagonStatus':
        return this.getWagonStatus(request.wagonNumber as string);
      case 'getDemurrage':
        return this.getDemurrage(request as unknown as EtranDemurrageQuery);
      default:
        throw new Error(`Unknown ЭТРАН action: ${(request as { action: string }).action}`);
    }
  }

  async createWaybill(req: EtranWaybillRequest): Promise<EtranWaybillResult> {
    const num = ++this.waybillCounter;
    return {
      waybillId: `etran-${Date.now()}-${num}`,
      gu29Number: `ГУ29-${String(num).padStart(6, '0')}`,
      status: 'ACCEPTED',
      acceptedAt: new Date().toISOString(),
    };
  }

  async getWagonStatus(wagonNumber: string): Promise<EtranWagonStatus> {
    const stations = [
      { code: '060400', name: 'Тамбов' },
      { code: '075000', name: 'Воронеж-Курский' },
      { code: '110000', name: 'Москва-Товарная-Павелецкая' },
      { code: '600000', name: 'Новороссийск' },
    ];
    const idx = Math.floor(Date.now() / 60000) % stations.length;
    const st = stations[idx];
    return {
      wagonNumber,
      currentStation: st.name,
      stationCode: st.code,
      operationCode: '01',
      operationName: 'Прибытие на станцию',
      timestamp: new Date().toISOString(),
      estimatedArrivalAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
    };
  }

  async getDemurrage(req: EtranDemurrageQuery): Promise<EtranDemurrageResult> {
    const from = new Date(req.fromDate).getTime();
    const to = new Date(req.toDate).getTime();
    const totalHours = Math.max(0, (to - from) / 3_600_000);
    const freeTime = 24;
    const chargeableHours = Math.max(0, totalHours - freeTime);
    const rateKopecksPerHour = 15_000;
    return {
      wagonNumber: req.wagonNumber,
      chargeableHours,
      rateKopecksPerHour,
      totalKopecks: Math.round(chargeableHours * rateKopecksPerHour),
      periods: chargeableHours > 0 ? [
        { stationCode: '060400', hoursHeld: chargeableHours, from: req.fromDate, to: req.toDate },
      ] : [],
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'ok', lastCheckedAt: new Date().toISOString(), detail: 'РЖД ЭТРАН mock — sandbox mode' };
  }
}
