/**
 * FGIS-first market domain layer.
 * Source: clean-transfer from Claude Code PR #209.
 * Maturity: sandbox. No live external calls are claimed here.
 */

import type { CounterpartyRef, EntityId, IsoDateTime, MoneyAmount } from './domain/types';
import type { MaturityStatus } from './domain/canonical';

export const FGIS_MATURITY: MaturityStatus = 'sandbox';

export type FGISPartyStatus = 'verified' | 'pending_sync' | 'sync_error' | 'manual_mode' | 'blocked';

export interface FGISPartyBatch {
  readonly batchId: string;
  readonly grain: string;
  readonly volumeTons: number;
  readonly harvestYear: number;
  readonly region: string;
  readonly sdizNumber?: string;
  readonly fgisRecordId?: string;
  readonly syncStatus: FGISPartyStatus;
  readonly syncAt?: IsoDateTime;
  readonly syncError?: string;
}

export interface FGISParty {
  readonly id: EntityId;
  readonly inn: string;
  readonly orgName: string;
  readonly ogrn?: string;
  readonly kpp?: string;
  readonly region: string;
  readonly status: FGISPartyStatus;
  readonly batches: readonly FGISPartyBatch[];
  readonly lastSyncAt?: IsoDateTime;
  readonly maturity: MaturityStatus;
}

export type LotPassportSource = 'fgis' | 'manual_draft' | 'rfq_response';
export type LotPassportStatus = 'draft' | 'fgis_linked' | 'quality_attached' | 'published' | 'reserved' | 'completed' | 'cancelled';

export interface LotPassportQuality {
  readonly moisture?: number;
  readonly natweight?: number;
  readonly protein?: number;
  readonly weed?: number;
  readonly grainImpurity?: number;
  readonly fallingNumber?: number;
  readonly gostClass?: string;
  readonly labProtocolId?: string;
}

export interface LotPassport {
  readonly id: EntityId;
  readonly fgisPartyId: EntityId;
  readonly fgisBatchId: string;
  readonly source: LotPassportSource;
  readonly status: LotPassportStatus;
  readonly grain: string;
  readonly volumeTons: number;
  readonly region: string;
  readonly elevatorId?: EntityId;
  readonly harvestYear: number;
  readonly quality?: LotPassportQuality;
  readonly sdizNumber?: string;
  readonly maturity: MaturityStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type MarketLotStatus = 'draft' | 'under_moderation' | 'active' | 'offer_received' | 'reserved' | 'sold' | 'expired' | 'cancelled';
export type PriceBasis = 'EXW' | 'FCA' | 'CPT' | 'DAP' | 'DAT' | 'CIF';

export interface MarketLot {
  readonly id: EntityId;
  readonly lotPassportId?: EntityId;
  readonly seller: CounterpartyRef;
  readonly grain: string;
  readonly volumeTons: number;
  readonly pricePerTon: MoneyAmount;
  readonly priceBasis: PriceBasis;
  readonly currency: 'RUB';
  readonly region: string;
  readonly shipDateFrom?: IsoDateTime;
  readonly shipDateTo?: IsoDateTime;
  readonly status: MarketLotStatus;
  readonly quality?: LotPassportQuality;
  readonly maturity: MaturityStatus;
  readonly publishedAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export type RFQStatus = 'draft' | 'open' | 'published' | 'offers_received' | 'offer_accepted' | 'expired' | 'cancelled';

export interface RFQQualityRequirement {
  readonly moisture?: number;
  readonly moistureMax?: number;
  readonly natweightMin?: number;
  readonly protein?: number;
  readonly proteinMin?: number;
  readonly weedMax?: number;
  readonly gostClass?: string;
}

export interface RFQ {
  readonly id: EntityId;
  readonly buyer: CounterpartyRef;
  readonly grain: string;
  readonly volumeTons: number;
  readonly targetPricePerTon?: MoneyAmount;
  readonly deliveryRegion: string;
  readonly deliveryDateFrom?: IsoDateTime;
  readonly deliveryDateTo?: IsoDateTime;
  readonly qualityRequirements?: RFQQualityRequirement;
  readonly status: RFQStatus;
  readonly offerIds: readonly EntityId[];
  readonly maturity: MaturityStatus;
  readonly createdAt: IsoDateTime;
  readonly expiresAt?: IsoDateTime;
}

export type OfferType = 'rfq_response' | 'buy_now' | 'auction_bid';
export type OfferStatus = 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'expired' | 'outbid';

export interface Offer {
  readonly id: EntityId;
  readonly type: OfferType;
  readonly marketLotId?: EntityId;
  readonly rfqId?: EntityId;
  readonly seller: CounterpartyRef;
  readonly buyer?: CounterpartyRef;
  readonly grain: string;
  readonly volumeTons: number;
  readonly pricePerTon: MoneyAmount;
  readonly priceBasis: PriceBasis;
  readonly currency: 'RUB';
  readonly quality?: LotPassportQuality;
  readonly status: OfferStatus;
  readonly dealId?: EntityId;
  readonly maturity: MaturityStatus;
  readonly createdAt: IsoDateTime;
  readonly expiresAt?: IsoDateTime;
}

export function canCreateLotPassport(party: FGISParty): boolean {
  return party.status !== 'blocked'
    && party.batches.some((batch) => batch.syncStatus === 'verified' || batch.syncStatus === 'manual_mode');
}

export function canPublishLot(passport: LotPassport): boolean {
  return passport.status === 'fgis_linked' || passport.status === 'quality_attached';
}

export function canAcceptOffer(offer: Offer): boolean {
  return offer.status === 'submitted' || offer.status === 'under_review';
}

export function manualLotWarning(passport: LotPassport): string | null {
  if (passport.source === 'fgis' || passport.source === 'rfq_response') return null;
  return 'Лот создан вручную, а не из ФГИС. Источник данных: manual_draft.';
}

const NOW = '2026-04-27T00:00:00.000Z';
const YESTERDAY = '2026-04-26T00:00:00.000Z';
const TWO_DAYS_AGO = '2026-04-25T00:00:00.000Z';
const NEXT_WEEK = '2026-05-04T00:00:00.000Z';

const sellerFgis: CounterpartyRef = { id: 'fgis-party-001', name: 'Sandbox Seller A', role: 'seller', inn: 'SANDBOX-INN-001' };
const sellerExternal: CounterpartyRef = { id: 'seller-002', name: 'Sandbox Seller B', role: 'seller', inn: 'SANDBOX-INN-002' };
const buyerAnchor: CounterpartyRef = { id: 'buyer-001', name: 'Sandbox Buyer A', role: 'buyer', inn: 'SANDBOX-INN-101' };

export const SANDBOX_FGIS_PARTIES: readonly FGISParty[] = [
  {
    id: 'fgis-party-001',
    inn: 'SANDBOX-INN-001',
    orgName: 'Sandbox Seller A',
    region: 'Тамбовская',
    status: 'verified',
    maturity: 'sandbox',
    lastSyncAt: YESTERDAY,
    batches: [
      { batchId: 'batch-001-1', grain: 'Пшеница 4 кл.', volumeTons: 450, harvestYear: 2025, region: 'Тамбовская', sdizNumber: 'SANDBOX-SDIZ-001', fgisRecordId: 'SANDBOX-FGIS-001', syncStatus: 'verified', syncAt: YESTERDAY },
      { batchId: 'batch-001-2', grain: 'Ячмень 2 кл.', volumeTons: 180, harvestYear: 2025, region: 'Тамбовская', sdizNumber: 'SANDBOX-SDIZ-002', syncStatus: 'verified', syncAt: YESTERDAY },
    ],
  },
  {
    id: 'fgis-party-002',
    inn: 'SANDBOX-INN-002',
    orgName: 'Sandbox Seller B',
    region: 'Воронежская',
    status: 'pending_sync',
    maturity: 'sandbox',
    batches: [{ batchId: 'batch-002-1', grain: 'Пшеница 3 кл.', volumeTons: 240, harvestYear: 2025, region: 'Воронежская', syncStatus: 'pending_sync' }],
  },
  {
    id: 'fgis-party-003',
    inn: 'SANDBOX-INN-003',
    orgName: 'Sandbox Seller C',
    region: 'Ставропольский',
    status: 'sync_error',
    maturity: 'sandbox',
    lastSyncAt: YESTERDAY,
    batches: [{ batchId: 'batch-003-1', grain: 'Кукуруза 1 кл.', volumeTons: 600, harvestYear: 2025, region: 'Ставропольский', syncStatus: 'sync_error', syncAt: YESTERDAY, syncError: 'Sandbox sync error.' }],
  },
];

export const SANDBOX_LOT_PASSPORTS: readonly LotPassport[] = [
  { id: 'lp-001', fgisPartyId: 'fgis-party-001', fgisBatchId: 'batch-001-1', source: 'fgis', status: 'published', grain: 'Пшеница 4 кл.', volumeTons: 450, region: 'Тамбовская', harvestYear: 2025, sdizNumber: 'SANDBOX-SDIZ-001', quality: { moisture: 12.5, natweight: 760, protein: 10.8, gostClass: '4' }, maturity: 'sandbox', createdAt: YESTERDAY, updatedAt: NOW },
  { id: 'lp-002', fgisPartyId: 'fgis-party-001', fgisBatchId: 'batch-001-2', source: 'fgis', status: 'quality_attached', grain: 'Ячмень 2 кл.', volumeTons: 180, region: 'Тамбовская', harvestYear: 2025, sdizNumber: 'SANDBOX-SDIZ-002', quality: { moisture: 13.0, natweight: 640, protein: 11.5, gostClass: '2' }, maturity: 'sandbox', createdAt: TWO_DAYS_AGO, updatedAt: YESTERDAY },
];

export const SANDBOX_MARKET_LOTS: readonly MarketLot[] = [
  { id: 'ml-001', lotPassportId: 'lp-001', seller: sellerFgis, grain: 'Пшеница 4 кл.', volumeTons: 450, pricePerTon: 12400, priceBasis: 'EXW', currency: 'RUB', region: 'Тамбовская', status: 'active', quality: { moisture: 12.5, natweight: 760, protein: 10.8, gostClass: '4' }, maturity: 'sandbox', publishedAt: YESTERDAY, createdAt: YESTERDAY },
  { id: 'ml-002', seller: sellerExternal, grain: 'Пшеница 3 кл.', volumeTons: 300, pricePerTon: 13800, priceBasis: 'CPT', currency: 'RUB', region: 'Ростовская', status: 'active', quality: { moisture: 12.0, natweight: 770, protein: 12.5, gostClass: '3' }, maturity: 'sandbox', publishedAt: YESTERDAY, createdAt: YESTERDAY },
  { id: 'ml-003', seller: { id: 'seller-003', name: 'Sandbox Seller C', role: 'seller', inn: 'SANDBOX-INN-003' }, grain: 'Кукуруза 1 кл.', volumeTons: 600, pricePerTon: 11200, priceBasis: 'EXW', currency: 'RUB', region: 'Ставропольский', status: 'active', quality: { moisture: 14.0, natweight: 720, gostClass: '1' }, maturity: 'sandbox', publishedAt: TWO_DAYS_AGO, createdAt: TWO_DAYS_AGO },
  { id: 'ml-004', seller: { id: 'seller-004', name: 'Sandbox Seller D', role: 'seller', inn: 'SANDBOX-INN-004' }, grain: 'Пшеница 4 кл.', volumeTons: 800, pricePerTon: 12100, priceBasis: 'EXW', currency: 'RUB', region: 'Краснодарский', status: 'active', quality: { moisture: 13.5, natweight: 750, protein: 10.2, gostClass: '4' }, maturity: 'sandbox', publishedAt: TWO_DAYS_AGO, createdAt: TWO_DAYS_AGO },
  { id: 'ml-005', seller: sellerExternal, grain: 'Ячмень 2 кл.', volumeTons: 240, pricePerTon: 9800, priceBasis: 'EXW', currency: 'RUB', region: 'Воронежская', status: 'reserved', quality: { moisture: 12.8, natweight: 630, protein: 10.9, gostClass: '2' }, maturity: 'sandbox', publishedAt: TWO_DAYS_AGO, createdAt: TWO_DAYS_AGO },
];

export const SANDBOX_RFQS: readonly RFQ[] = [
  { id: 'rfq-001', buyer: buyerAnchor, grain: 'Пшеница 3 кл.', volumeTons: 250, targetPricePerTon: 14000, deliveryRegion: 'Ростовская', deliveryDateFrom: NOW, deliveryDateTo: NEXT_WEEK, qualityRequirements: { moisture: 13.0, protein: 12.0, gostClass: '3' }, status: 'open', offerIds: ['offer-001', 'offer-002'], maturity: 'sandbox', createdAt: YESTERDAY, expiresAt: NEXT_WEEK },
  { id: 'rfq-002', buyer: { id: 'buyer-002', name: 'Sandbox Buyer B', role: 'buyer', inn: 'SANDBOX-INN-102' }, grain: 'Кукуруза 1 кл.', volumeTons: 500, targetPricePerTon: 11500, deliveryRegion: 'Ставропольский', status: 'open', offerIds: ['offer-003'], maturity: 'sandbox', createdAt: TWO_DAYS_AGO, expiresAt: NEXT_WEEK },
];

export const SANDBOX_OFFERS: readonly Offer[] = [
  { id: 'offer-001', type: 'rfq_response', rfqId: 'rfq-001', marketLotId: 'ml-002', seller: sellerExternal, buyer: buyerAnchor, grain: 'Пшеница 3 кл.', volumeTons: 300, pricePerTon: 13800, priceBasis: 'CPT', currency: 'RUB', quality: { moisture: 12.0, natweight: 770, protein: 12.5, gostClass: '3' }, status: 'submitted', maturity: 'sandbox', createdAt: YESTERDAY, expiresAt: NEXT_WEEK },
  { id: 'offer-002', type: 'rfq_response', rfqId: 'rfq-001', seller: { id: 'seller-004', name: 'Sandbox Seller D', role: 'seller', inn: 'SANDBOX-INN-004' }, buyer: buyerAnchor, grain: 'Пшеница 3 кл.', volumeTons: 250, pricePerTon: 13500, priceBasis: 'CPT', currency: 'RUB', quality: { moisture: 12.8, natweight: 760, protein: 11.8, gostClass: '3' }, status: 'under_review', maturity: 'sandbox', createdAt: YESTERDAY, expiresAt: NEXT_WEEK },
  { id: 'offer-003', type: 'buy_now', marketLotId: 'ml-003', seller: { id: 'seller-003', name: 'Sandbox Seller C', role: 'seller', inn: 'SANDBOX-INN-003' }, grain: 'Кукуруза 1 кл.', volumeTons: 500, pricePerTon: 11200, priceBasis: 'EXW', currency: 'RUB', quality: { moisture: 14.0, gostClass: '1' }, status: 'submitted', maturity: 'sandbox', createdAt: TWO_DAYS_AGO, expiresAt: NEXT_WEEK },
];
