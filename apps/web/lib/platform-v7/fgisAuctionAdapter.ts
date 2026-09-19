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

/** Type-only compatibility contract. Runtime import verification belongs to authenticated server adapters. */
export type FgisAuctionImportResult = {
  ok: boolean;
  lot?: FgisLotSnapshot;
  checks: FgisAuctionImportCheck[];
  reason?: string;
};
