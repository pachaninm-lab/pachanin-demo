export type FgisSourceKind = 'fgis_lot' | 'fgis_sdiz' | 'manual_review';
export type FgisImportStatus = 'not_connected' | 'requested' | 'matched' | 'requires_review' | 'rejected';
export type AuctionAdmissionStatus = 'blocked' | 'review_required' | 'admitted';
export type AuctionRunStatus = 'not_opened' | 'open' | 'closed' | 'winner_locked' | 'deal_basis_ready';

export type FgisLotSnapshot = {
  source: FgisSourceKind;
  importStatus: FgisImportStatus;
  lotNumber: string;
  sdizNumber?: string;
  ownerInn: string;
  ownerName: string;
  culture: string;
  className: string;
  purpose: string;
  region: string;
  elevatorName: string;
  availableWeightKg: number;
  lockedWeightKg: number;
  quality: Array<{ label: string; value: string }>;
  documents: Array<{ label: string; status: 'ok' | 'required' | 'review' }>;
};

export type AuctionBuyerGate = {
  buyerId: string;
  buyerName: string;
  admission: 'ok' | 'review' | 'blocked';
  limitRub: number;
  reason?: string;
};

export type AuctionGateCheck = {
  key: string;
  label: string;
  status: 'ok' | 'review' | 'block';
  owner: string;
};

export type AuctionBidRule = {
  key: string;
  label: string;
};

/** Type-only compatibility contract. Runtime auction facts come from authenticated PostgreSQL authority envelopes. */
export type FgisAuctionState = {
  lot: FgisLotSnapshot;
  admission: AuctionAdmissionStatus;
  runStatus: AuctionRunStatus;
  checks: AuctionGateCheck[];
  buyers: AuctionBuyerGate[];
  bidRules: AuctionBidRule[];
  nextRoutes: Array<{ label: string; href: string; owner: string }>;
};
