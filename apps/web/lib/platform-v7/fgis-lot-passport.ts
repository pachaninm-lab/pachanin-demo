/**
 * FGIS-first market layer domain types.
 *
 * Integration maturity: sandbox (no live FGIS API calls).
 * All FGIS operations are simulated until a live FGIS SOAP/REST connector is wired.
 *
 * Backbone: FGISParty -> LotPassport -> MarketLot -> RFQ/Offer/Auction -> Deal
 */

import type { EntityId, IsoDateTime, MoneyAmount, CounterpartyRef } from './domain/types';
import type { MaturityStatus } from './domain/canonical';

export const FGIS_MATURITY: MaturityStatus = 'sandbox';

// ---------------------------------------------------------------------------
// FGIS Party — grain producer/owner registered in ФГИС ЗЕРНО
// ---------------------------------------------------------------------------

export type FGISPartyStatus =
  | 'verified'       // confirmed ФГИС record, XMLDSig valid
  | 'pending_sync'   // queued for ФГИС sync
  | 'sync_error'     // last sync failed; manual mode active
  | 'manual_mode'    // operator manually approved without live ФГИС
  | 'blocked';       // compliance hold

export interface FGISPartyBatch {
  readonly batchId: string;
  readonly grain: string;
  readonly volumeTons: number;
  readonly harvestYear: number;
  readonly region: string;
  readonly sdizNumber?: string;       // СДИЗ identifier
  readonly fgisRecordId?: string;     // ФГИС internal record ID
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

// ---------------------------------------------------------------------------
// Lot Passport — from FGIS batch to marketable lot
// ---------------------------------------------------------------------------

export type LotPassportSource = 'fgis' | 'manual_draft' | 'rfq_response';

export type LotPassportStatus =
  | 'draft'
  | 'fgis_linked'      // batch from ФГИС confirmed
  | 'quality_attached' // lab/ГОСТ data attached
  | 'published'        // visible on marketplace
  | 'reserved'         // reserved for deal
  | 'completed'        // deal closed
  | 'cancelled';

export interface LotPassportQuality {
  readonly moisture?: number;       // влажность %
  readonly natweight?: number;      // натурная масса г/л
  readonly protein?: number;        // белок %
  readonly weed?: number;           // сорная примесь %
  readonly grainImpurity?: number;  // зерновая примесь %
  readonly fallingNumber?: number;  // число падения сек
  readonly gostClass?: string;      // ГОСТ класс
  readonly labProtocolId?: string;  // reference to LabProtocol
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
  readonly elevatorId?: EntityId;   // storage location
  readonly harvestYear: number;
  readonly quality?: LotPassportQuality;
  readonly sdizNumber?: string;
  readonly maturity: MaturityStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Market Lot — published offer derived from LotPassport
// ---------------------------------------------------------------------------

export type MarketLotStatus =
  | 'draft'
  | 'under_moderation'
  | 'active'
  | 'offer_received'
  | 'reserved'
  | 'sold'
  | 'expired'
  | 'cancelled';

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

// ---------------------------------------------------------------------------
// RFQ — request for quote from Buyer
// ---------------------------------------------------------------------------

export type RFQStatus =
  | 'draft'
  | 'open'
  | 'published'
  | 'offers_received'
  | 'offer_accepted'
  | 'expired'
  | 'cancelled';

export interface RFQQualityRequirement {
  readonly moisture?: number;       // alias for moistureMax (≤ this value)
  readonly moistureMax?: number;
  readonly natweightMin?: number;
  readonly protein?: number;        // alias for proteinMin (≥ this value)
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

// ---------------------------------------------------------------------------
// Offer — seller's response to RFQ, or direct buy-now offer
// ---------------------------------------------------------------------------

export type OfferType = 'rfq_response' | 'buy_now' | 'auction_bid';

export type OfferStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'accepted'          // winner; creates draft Deal
  | 'rejected'
  | 'expired'
  | 'outbid';           // auction only

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
  readonly dealId?: EntityId;       // set when offer is accepted and deal is created
  readonly maturity: MaturityStatus;
  readonly createdAt: IsoDateTime;
  readonly expiresAt?: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/** Returns true if the party can proceed to create a lot passport. */
export function canCreateLotPassport(party: FGISParty): boolean {
  return (
    party.status !== 'blocked' &&
    party.batches.some(
      (b) => b.syncStatus === 'verified' || b.syncStatus === 'manual_mode'
    )
  );
}

/** Returns true if the lot passport is ready to be published as a market lot. */
export function canPublishLot(passport: LotPassport): boolean {
  return (
    passport.status === 'fgis_linked' ||
    passport.status === 'quality_attached'
  );
}

/** Returns true if the offer can be accepted and a deal created. */
export function canAcceptOffer(offer: Offer): boolean {
  return offer.status === 'submitted' || offer.status === 'under_review';
}

/** Returns warning reason if lot source is manual (not FGIS-first). */
export function manualLotWarning(passport: LotPassport): string | null {
  if (passport.source !== 'fgis' && passport.source !== 'rfq_response') {
    return 'Лот создан вручную, а не из ФГИС. Источник данных: manual_draft. Для полноценного контура подтяните партию из ФГИС ЗЕРНО.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fixtures for sandbox/demo
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();
const YESTERDAY = new Date(Date.now() - 86400000).toISOString();

export const SANDBOX_FGIS_PARTIES: readonly FGISParty[] = [
  {
    id: 'fgis-party-001',
    inn: '6829123456',
    orgName: 'Агро-Юг ООО',
    ogrn: '1086829001234',
    kpp: '682901001',
    region: 'Тамбовская',
    status: 'verified',
    maturity: 'sandbox',
    lastSyncAt: YESTERDAY,
    batches: [
      {
        batchId: 'batch-001-1',
        grain: 'Пшеница 4 кл.',
        volumeTons: 450,
        harvestYear: 2025,
        region: 'Тамбовская',
        sdizNumber: 'СДИЗ-68-2025-0001',
        fgisRecordId: 'ФГИС-0001-2025',
        syncStatus: 'verified',
        syncAt: YESTERDAY,
      },
      {
        batchId: 'batch-001-2',
        grain: 'Ячмень 2 кл.',
        volumeTons: 180,
        harvestYear: 2025,
        region: 'Тамбовская',
        sdizNumber: 'СДИЗ-68-2025-0002',
        syncStatus: 'verified',
        syncAt: YESTERDAY,
      },
    ],
  },
  {
    id: 'fgis-party-002',
    inn: '3664098765',
    orgName: 'КФХ Мирный',
    region: 'Воронежская',
    status: 'pending_sync',
    maturity: 'sandbox',
    batches: [
      {
        batchId: 'batch-002-1',
        grain: 'Пшеница 3 кл.',
        volumeTons: 240,
        harvestYear: 2025,
        region: 'Воронежская',
        syncStatus: 'pending_sync',
      },
    ],
  },
  {
    id: 'fgis-party-003',
    inn: '7701234567',
    orgName: 'АО СолнцеАгро',
    region: 'Ставропольский',
    status: 'sync_error',
    maturity: 'sandbox',
    lastSyncAt: YESTERDAY,
    batches: [
      {
        batchId: 'batch-003-1',
        grain: 'Кукуруза 1 кл.',
        volumeTons: 600,
        harvestYear: 2025,
        region: 'Ставропольский',
        syncStatus: 'sync_error',
        syncAt: YESTERDAY,
        syncError: 'ФГИС ЗЕРНО API timeout. Повторная попытка через 15 мин.',
      },
    ],
  },
];

const TWO_DAYS_AGO = new Date(Date.now() - 2 * 86400000).toISOString();
const NEXT_WEEK = new Date(Date.now() + 7 * 86400000).toISOString();

export const SANDBOX_LOT_PASSPORTS: readonly LotPassport[] = [
  {
    id: 'lp-001',
    fgisPartyId: 'fgis-party-001',
    fgisBatchId: 'batch-001-1',
    source: 'fgis',
    status: 'published',
    grain: 'Пшеница 4 кл.',
    volumeTons: 450,
    region: 'Тамбовская',
    harvestYear: 2025,
    sdizNumber: 'СДИЗ-68-2025-0001',
    quality: {
      moisture: 12.5,
      natweight: 760,
      protein: 10.8,
      weed: 1.2,
      grainImpurity: 2.0,
      fallingNumber: 280,
      gostClass: '4',
    },
    maturity: 'sandbox',
    createdAt: YESTERDAY,
    updatedAt: NOW,
  },
  {
    id: 'lp-002',
    fgisPartyId: 'fgis-party-001',
    fgisBatchId: 'batch-001-2',
    source: 'fgis',
    status: 'quality_attached',
    grain: 'Ячмень 2 кл.',
    volumeTons: 180,
    region: 'Тамбовская',
    harvestYear: 2025,
    sdizNumber: 'СДИЗ-68-2025-0002',
    quality: {
      moisture: 13.0,
      natweight: 640,
      protein: 11.5,
      gostClass: '2',
    },
    maturity: 'sandbox',
    createdAt: TWO_DAYS_AGO,
    updatedAt: YESTERDAY,
  },
];

export const SANDBOX_MARKET_LOTS: readonly MarketLot[] = [
  {
    id: 'ml-001',
    lotPassportId: 'lp-001',
    seller: { id: 'fgis-party-001', name: 'Агро-Юг ООО', role: 'seller', inn: '6829123456' },
    grain: 'Пшеница 4 кл.',
    volumeTons: 450,
    pricePerTon: 12400,
    priceBasis: 'EXW',
    currency: 'RUB',
    region: 'Тамбовская',
    status: 'active',
    quality: {
      moisture: 12.5,
      natweight: 760,
      protein: 10.8,
      gostClass: '4',
    },
    maturity: 'sandbox',
    publishedAt: YESTERDAY,
    createdAt: YESTERDAY,
  },
  {
    id: 'ml-002',
    seller: { id: 'seller-kfh-002', name: 'КФХ Петров', role: 'seller', inn: '6101234509' },
    grain: 'Пшеница 3 кл.',
    volumeTons: 300,
    pricePerTon: 13800,
    priceBasis: 'CPT',
    currency: 'RUB',
    region: 'Ростовская',
    status: 'active',
    quality: {
      moisture: 12.0,
      natweight: 770,
      protein: 12.5,
      fallingNumber: 320,
      gostClass: '3',
    },
    maturity: 'sandbox',
    publishedAt: YESTERDAY,
    createdAt: YESTERDAY,
  },
  {
    id: 'ml-003',
    seller: { id: 'seller-solnce-003', name: 'АО СолнцеАгро', role: 'seller', inn: '7701234567' },
    grain: 'Кукуруза 1 кл.',
    volumeTons: 600,
    pricePerTon: 11200,
    priceBasis: 'EXW',
    currency: 'RUB',
    region: 'Ставропольский',
    status: 'active',
    quality: {
      moisture: 14.0,
      natweight: 720,
      gostClass: '1',
    },
    maturity: 'sandbox',
    publishedAt: TWO_DAYS_AGO,
    createdAt: TWO_DAYS_AGO,
  },
  {
    id: 'ml-004',
    seller: { id: 'seller-agro-004', name: 'Агрохолдинг СК', role: 'seller', inn: '2301234567' },
    grain: 'Пшеница 4 кл.',
    volumeTons: 800,
    pricePerTon: 12100,
    priceBasis: 'EXW',
    currency: 'RUB',
    region: 'Краснодарский',
    status: 'active',
    quality: {
      moisture: 13.5,
      natweight: 750,
      protein: 10.2,
      gostClass: '4',
    },
    maturity: 'sandbox',
    publishedAt: TWO_DAYS_AGO,
    createdAt: TWO_DAYS_AGO,
  },
  {
    id: 'ml-005',
    seller: { id: 'seller-mirny-005', name: 'КФХ Мирный', role: 'seller', inn: '3664098765' },
    grain: 'Ячмень 2 кл.',
    volumeTons: 240,
    pricePerTon: 9800,
    priceBasis: 'EXW',
    currency: 'RUB',
    region: 'Воронежская',
    status: 'reserved',
    quality: {
      moisture: 12.8,
      natweight: 630,
      protein: 10.9,
      gostClass: '2',
    },
    maturity: 'sandbox',
    publishedAt: TWO_DAYS_AGO,
    createdAt: TWO_DAYS_AGO,
  },
];

export const SANDBOX_RFQS: readonly RFQ[] = [
  {
    id: 'rfq-001',
    buyer: { id: 'buyer-agroholding', name: 'Агрохолдинг СК', role: 'buyer', inn: '2301234567' },
    grain: 'Пшеница 3 кл.',
    volumeTons: 250,
    targetPricePerTon: 14000,
    deliveryRegion: 'Ростовская',
    deliveryDateFrom: NOW,
    deliveryDateTo: NEXT_WEEK,
    qualityRequirements: { moisture: 13.0, protein: 12.0, gostClass: '3' },
    status: 'open',
    offerIds: ['offer-001', 'offer-002'],
    maturity: 'sandbox',
    createdAt: YESTERDAY,
    expiresAt: NEXT_WEEK,
  },
  {
    id: 'rfq-002',
    buyer: { id: 'buyer-zernotrade', name: 'ЗерноТрейд ООО', role: 'buyer', inn: '7712345678' },
    grain: 'Кукуруза 1 кл.',
    volumeTons: 500,
    targetPricePerTon: 11500,
    deliveryRegion: 'Ставропольский',
    status: 'open',
    offerIds: ['offer-003'],
    maturity: 'sandbox',
    createdAt: TWO_DAYS_AGO,
    expiresAt: NEXT_WEEK,
  },
];

export const SANDBOX_OFFERS: readonly Offer[] = [
  {
    id: 'offer-001',
    type: 'rfq_response',
    rfqId: 'rfq-001',
    marketLotId: 'ml-002',
    seller: { id: 'seller-kfh-002', name: 'КФХ Петров', role: 'seller', inn: '6101234509' },
    buyer: { id: 'buyer-agroholding', name: 'Агрохолдинг СК', role: 'buyer' },
    grain: 'Пшеница 3 кл.',
    volumeTons: 300,
    pricePerTon: 13800,
    priceBasis: 'CPT',
    currency: 'RUB',
    quality: { moisture: 12.0, natweight: 770, protein: 12.5, gostClass: '3' },
    status: 'submitted',
    maturity: 'sandbox',
    createdAt: YESTERDAY,
    expiresAt: NEXT_WEEK,
  },
  {
    id: 'offer-002',
    type: 'rfq_response',
    rfqId: 'rfq-001',
    seller: { id: 'seller-agro-004', name: 'Агрохолдинг СК', role: 'seller', inn: '2301234567' },
    buyer: { id: 'buyer-agroholding', name: 'Агрохолдинг СК', role: 'buyer' },
    grain: 'Пшеница 3 кл.',
    volumeTons: 250,
    pricePerTon: 13500,
    priceBasis: 'CPT',
    currency: 'RUB',
    quality: { moisture: 12.8, natweight: 760, protein: 11.8, gostClass: '3' },
    status: 'under_review',
    maturity: 'sandbox',
    createdAt: YESTERDAY,
    expiresAt: NEXT_WEEK,
  },
  {
    id: 'offer-003',
    type: 'buy_now',
    marketLotId: 'ml-003',
    seller: { id: 'seller-solnce-003', name: 'АО СолнцеАгро', role: 'seller', inn: '7701234567' },
    grain: 'Кукуруза 1 кл.',
    volumeTons: 500,
    pricePerTon: 11200,
    priceBasis: 'EXW',
    currency: 'RUB',
    quality: { moisture: 14.0, gostClass: '1' },
    status: 'submitted',
    maturity: 'sandbox',
    createdAt: TWO_DAYS_AGO,
    expiresAt: NEXT_WEEK,
  },
];
