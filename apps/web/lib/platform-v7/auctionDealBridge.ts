import type { PlatformV7RouteIconKey } from './platformV7RouteIcons';

/**
 * Type-only compatibility contract for the governed auction presentation layer.
 *
 * Runtime auction state, bids, winner selection and Deal creation must come from
 * the server-authoritative boundaries in `@/lib/auction-server`. This module
 * intentionally exports no values, fixtures, selectors or mutation helpers.
 */
export type AuctionStage =
  | 'lot_draft'
  | 'lot_admitted'
  | 'bidding_window'
  | 'winner_locked'
  | 'deal_basis_ready'
  | 'deal_created';

export type AuctionBid = {
  id: string;
  buyerName: string;
  priceRubPerTon: number;
  volumeTons: number;
  placedAt: string;
  isWinner?: boolean;
};

export type AuctionLot = {
  id: string;
  fgisLotNumber: string;
  sdizNumber: string;
  ownerInn: string;
  ownerName: string;
  culture: string;
  className: string;
  region: string;
  basis: string;
  storagePlace: string;
  volumeTons: number;
  availableWeightKg: number;
  startPriceRubPerTon: number;
  stage: AuctionStage;
  bids: AuctionBid[];
};

export type AuctionNextAction = {
  label: string;
  href: string;
  owner: string;
  iconKey: PlatformV7RouteIconKey;
  resultLabel: string;
};

export type AuctionDealBasis = {
  dealId: string;
  winner: AuctionBid;
  winnerBidId: string;
  lotNumber: string;
  sdizNumber: string;
  ownerInn: string;
  sellerName: string;
  buyerName: string;
  culture: string;
  className: string;
  region: string;
  storagePlace: string;
  priceRubPerTon: number;
  volumeTons: number;
  availableWeightKg: number;
  amountRub: number;
  deliveryTerms: string;
  journalLocks: Array<{ label: string; owner: string }>;
  readinessReasons: string[];
  nextRoutes: AuctionNextAction[];
};

export type AuctionDealBasisGuard = {
  key: string;
  label: string;
  status: 'ok' | 'block';
  owner: string;
};

export type AuctionDealBridge = {
  lot: AuctionLot;
  winnerBid?: AuctionBid;
  dealBasis?: AuctionDealBasis;
  nextActions: AuctionNextAction[];
  controls: string[];
  risks: string[];
};
