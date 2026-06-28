import { IntegrationAdapter, HealthStatus } from '../adapter.interface';

export type VesselType = 'BULK_CARRIER' | 'CONTAINER' | 'GENERAL_CARGO' | 'TANKER';
export type VesselStatus = 'AT_SEA' | 'AT_ANCHOR' | 'MOORED' | 'UNDERWAY' | 'NOT_DEFINED';

export interface VesselPosition {
  mmsi: string;
  imo: string;
  vesselName: string;
  flag: string;
  type: VesselType;
  status: VesselStatus;
  latitude: number;
  longitude: number;
  speedKnots: number;
  courseDeg: number;
  destinationPort?: string;
  eta?: string;
  updatedAt: string;
}

export interface PortCall {
  portCode: string;
  portName: string;
  country: string;
  arrivalAt?: string;
  departureAt?: string;
  berthCode?: string;
}

export interface VesselRoute {
  mmsi: string;
  vesselName: string;
  departurePort: string;
  arrivalPort: string;
  departedAt?: string;
  estimatedArrival?: string;
  distanceNm: number;
  previousCalls: PortCall[];
}

export interface CargoCapacity {
  mmsi: string;
  deadweightTons: number;
  availableCapacityTons: number;
  grainsCapacityTons: number;
  holdCount: number;
}

const MOCK_VESSELS: VesselPosition[] = [
  {
    mmsi: '273210490', imo: '9234567', vesselName: 'SVETLANA GRAIN', flag: 'RU',
    type: 'BULK_CARRIER', status: 'AT_SEA',
    latitude: 46.35, longitude: 30.72, speedKnots: 12.4, courseDeg: 215,
    destinationPort: 'TRPOR', eta: new Date(Date.now() + 3 * 24 * 3600_000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    mmsi: '273198001', imo: '9345678', vesselName: 'KRASNODAR WHEAT', flag: 'RU',
    type: 'BULK_CARRIER', status: 'MOORED',
    latitude: 47.47, longitude: 38.92, speedKnots: 0, courseDeg: 0,
    destinationPort: 'EGPSD', eta: new Date(Date.now() + 5 * 24 * 3600_000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    mmsi: '636018001', imo: '9456789', vesselName: 'PACIFIC GRAIN EXPRESS', flag: 'MH',
    type: 'BULK_CARRIER', status: 'AT_SEA',
    latitude: 43.10, longitude: 28.55, speedKnots: 14.1, courseDeg: 180,
    destinationPort: 'NOVOROSSIYSK', eta: new Date(Date.now() + 1 * 24 * 3600_000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export class MockMarineAdapter implements IntegrationAdapter {
  readonly name = 'MARINE_TRAFFIC';
  readonly version = '2.0.0';
  readonly mode = 'mock' as const;

  async execute(request: {
    action: 'getVesselPosition' | 'getVesselRoute' | 'searchVessels' | 'getPortCalls' | 'getCargoCapacity';
    [key: string]: unknown;
  }): Promise<unknown> {
    switch (request.action) {
      case 'getVesselPosition':
        return this.getVesselPosition(request.mmsi as string);
      case 'getVesselRoute':
        return this.getVesselRoute(request.mmsi as string);
      case 'searchVessels':
        return this.searchVessels(request.query as string, request.type as VesselType | undefined);
      case 'getPortCalls':
        return this.getPortCalls(request.mmsi as string);
      case 'getCargoCapacity':
        return this.getCargoCapacity(request.mmsi as string);
      default:
        throw new Error(`Unknown MarineTraffic action: ${(request as { action: string }).action}`);
    }
  }

  async getVesselPosition(mmsi: string): Promise<VesselPosition | null> {
    const vessel = MOCK_VESSELS.find(v => v.mmsi === mmsi);
    if (!vessel) return null;
    // Add slight position drift for realism
    const drift = (Date.now() % 1000) / 100000;
    return { ...vessel, latitude: vessel.latitude + drift, longitude: vessel.longitude + drift, updatedAt: new Date().toISOString() };
  }

  async getVesselRoute(mmsi: string): Promise<VesselRoute | null> {
    const vessel = MOCK_VESSELS.find(v => v.mmsi === mmsi);
    if (!vessel) return null;
    return {
      mmsi,
      vesselName: vessel.vesselName,
      departurePort: 'RUNKL', // Новороссийск
      arrivalPort: vessel.destinationPort ?? 'TRPOR',
      departedAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
      estimatedArrival: vessel.eta,
      distanceNm: 850,
      previousCalls: [
        { portCode: 'RUNKL', portName: 'Новороссийск', country: 'RU', arrivalAt: new Date(Date.now() - 3 * 24 * 3600_000).toISOString(), departureAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(), berthCode: 'B-12' },
      ],
    };
  }

  async searchVessels(query: string, type?: VesselType): Promise<VesselPosition[]> {
    let results = MOCK_VESSELS;
    if (type) results = results.filter(v => v.type === type);
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(v => v.vesselName.toLowerCase().includes(q) || v.mmsi.includes(q) || v.imo.includes(q));
    }
    return results.map(v => ({ ...v, updatedAt: new Date().toISOString() }));
  }

  async getPortCalls(mmsi: string): Promise<PortCall[]> {
    const vessel = MOCK_VESSELS.find(v => v.mmsi === mmsi);
    if (!vessel) return [];
    return [
      { portCode: 'RUNKL', portName: 'Новороссийск', country: 'RU', arrivalAt: new Date(Date.now() - 10 * 24 * 3600_000).toISOString(), departureAt: new Date(Date.now() - 8 * 24 * 3600_000).toISOString() },
      { portCode: 'TRPOR', portName: 'Port of Derince', country: 'TR', arrivalAt: new Date(Date.now() - 5 * 24 * 3600_000).toISOString(), departureAt: new Date(Date.now() - 3 * 24 * 3600_000).toISOString() },
    ];
  }

  async getCargoCapacity(mmsi: string): Promise<CargoCapacity | null> {
    const vessel = MOCK_VESSELS.find(v => v.mmsi === mmsi);
    if (!vessel) return null;
    return {
      mmsi,
      deadweightTons: 45_000,
      availableCapacityTons: 28_000,
      grainsCapacityTons: 30_000,
      holdCount: 5,
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'ok', lastCheckedAt: new Date().toISOString(), detail: 'MarineTraffic mock adapter — sandbox mode' };
  }
}
