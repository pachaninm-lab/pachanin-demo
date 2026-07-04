/**
 * Live MarineTraffic adapter (vessel positions, routes, port calls, capacity)
 * over the shared HTTP client. Mirrors the public methods of the mock. Read-only
 * lookups. Per-vendor work left: endpoint paths + field mapping (marked
 * "VENDOR MAPPING").
 */

import type {
  CargoCapacity,
  PortCall,
  VesselPosition,
  VesselRoute,
  VesselType,
} from '../adapters/marine.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveMarineAdapter extends LiveAdapterBase {
  readonly name = 'MARINE_TRAFFIC';
  readonly version = '1.0.0-live';

  async getVesselPosition(mmsi: string): Promise<VesselPosition | null> {
    // VENDOR MAPPING: MarineTraffic single-vessel position endpoint.
    return this.http.request<VesselPosition | null>({
      method: 'GET',
      path: `/vessels/${encodeURIComponent(mmsi)}/position`,
    });
  }

  async getVesselRoute(mmsi: string): Promise<VesselRoute | null> {
    return this.http.request<VesselRoute | null>({
      method: 'GET',
      path: `/vessels/${encodeURIComponent(mmsi)}/route`,
    });
  }

  async searchVessels(query: string, type?: VesselType): Promise<VesselPosition[]> {
    return this.http.request<VesselPosition[]>({
      method: 'GET',
      path: '/vessels',
      query: { query, type },
    });
  }

  async getPortCalls(mmsi: string): Promise<PortCall[]> {
    return this.http.request<PortCall[]>({
      method: 'GET',
      path: `/vessels/${encodeURIComponent(mmsi)}/port-calls`,
    });
  }

  async getCargoCapacity(mmsi: string): Promise<CargoCapacity | null> {
    return this.http.request<CargoCapacity | null>({
      method: 'GET',
      path: `/vessels/${encodeURIComponent(mmsi)}/capacity`,
    });
  }
}
