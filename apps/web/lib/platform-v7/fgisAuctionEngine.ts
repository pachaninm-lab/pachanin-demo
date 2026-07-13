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

export type FgisAuctionState = {
  lot: FgisLotSnapshot;
  admission: AuctionAdmissionStatus;
  runStatus: AuctionRunStatus;
  checks: AuctionGateCheck[];
  buyers: AuctionBuyerGate[];
  bidRules: AuctionBidRule[];
  nextRoutes: Array<{ label: string; href: string; owner: string }>;
};

export function kgToTons(value: number) {
  return value / 1000;
}

export function canOpenAuction(state: FgisAuctionState) {
  return state.checks.every((check) => check.status !== 'block')
    && state.checks.every((check) => check.status !== 'review');
}

export function admissionLabel(status: AuctionAdmissionStatus) {
  if (status === 'admitted') return 'допущен к торгам';
  if (status === 'review_required') return 'требует проверки';
  return 'заблокирован';
}

export function importStatusLabel(status: FgisImportStatus) {
  switch (status) {
    case 'matched': return 'лот сверен';
    case 'requested': return 'запрос отправлен';
    case 'requires_review': return 'требует проверки';
    case 'rejected': return 'отклонён';
    default: return 'ожидает подключения';
  }
}
