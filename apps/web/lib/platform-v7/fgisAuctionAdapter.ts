import type { FgisLotSnapshot } from './fgisAuctionEngine';

export type FgisAuctionImportRequest = {
  lotNumber?: string;
  sdizNumber?: string;
  ownerInn: string;
  requestedVolumeKg?: number;
};

export type FgisAuctionImportCheck = {
  key: string;
  label: string;
  ok: boolean;
};

/**
 * Type-only compatibility contract. Runtime FGIS import verification must be
 * performed by authenticated server adapters and persisted authority records.
 */
export type FgisAuctionImportResult = {
  ok: boolean;
  lot?: FgisLotSnapshot;
  checks: FgisAuctionImportCheck[];
  reason?: string;
};
