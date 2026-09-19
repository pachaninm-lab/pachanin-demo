import { describe, expect, it } from 'vitest';
import {
  canPlatformV7CreateProposal,
  canPlatformV7LotCreateDeal,
  isPlatformV7LotPriceAllowed,
  isPlatformV7LotVisibleForRequest,
  type PlatformV7BuyerRequest,
  type PlatformV7MarketLot,
  type PlatformV7ReliabilityRating,
} from '@/lib/platform-v7/market-model';

const sellerRating: PlatformV7ReliabilityRating = {
  partyId: 'seller-1',
  score: 82,
  level: 'medium',
  completedDeals: 12,
  disputesCount: 1,
  documentIssuesCount: 1,
  cancellationRate: 0.03,
  reviewScore: 4.6,
  explanation: ['Документы закрываются с ручной проверкой'],
  lastUpdatedAt: '2026-05-06T10:00:00.000Z',
};

const buyerRating: PlatformV7ReliabilityRating = {
  partyId: 'buyer-1',
  score: 88,
  level: 'high',
  completedDeals: 18,
  disputesCount: 1,
  documentIssuesCount: 0,
  cancellationRate: 0.01,
  reviewScore: 4.8,
  explanation: ['Резерв денег подтверждается без просрочек'],
  lastUpdatedAt: '2026-05-06T10:00:00.000Z',
};

const lot: PlatformV7MarketLot = {
  id: 'lot-1',
  batchId: 'batch-1',
  sellerId: 'seller-1',
  crop: 'Пшеница',
  class: '4',
  tons: 600,
  priceRubPerTon: 16000,
  netbackRubPerTon: 15400,
  basis: 'EXW',
  region: 'Тамбовская область',
  status: 'published',
  readinessScore: 84,
  riskLevel: 'medium',
  sellerRating,
};

const request: PlatformV7BuyerRequest = {
  id: 'req-1',
  buyerId: 'buyer-1',
  crop: 'Пшеница',
  class: '4',
  requiredTons: 500,
  region: 'Тамбовская область',
  deliveryBasis: 'EXW',
  maxPriceRubPerTon: 16500,
  fgisRequired: true,
  sdizRequired: true,
  logisticsRequired: true,
  status: 'published',
  matchedLots: [],
  buyerRating,
};

describe('platform-v7 market model', () => {
  it('shows a lot only when crop, class, region, volume, risk and readiness match the buyer request', () => {
    expect(isPlatformV7LotVisibleForRequest(lot, request)).toBe(true);
    expect(isPlatformV7LotVisibleForRequest({ ...lot, class: '3' }, request)).toBe(false);
    expect(isPlatformV7LotVisibleForRequest({ ...lot, tons: 300 }, request)).toBe(false);
    expect(isPlatformV7LotVisibleForRequest({ ...lot, riskLevel: 'high' }, request)).toBe(false);
    expect(isPlatformV7LotVisibleForRequest({ ...lot, readinessScore: 60 }, request)).toBe(false);
  });

  it('checks buyer price limits before allowing a proposal', () => {
    expect(isPlatformV7LotPriceAllowed(lot, request)).toBe(true);
    expect(isPlatformV7LotPriceAllowed({ ...lot, priceRubPerTon: 17000 }, request)).toBe(false);
    expect(isPlatformV7LotPriceAllowed({ ...lot, priceRubPerTon: 17000 }, { ...request, maxPriceRubPerTon: undefined })).toBe(true);
  });

  it('creates a proposal only from a published request and suitable lot', () => {
    expect(canPlatformV7CreateProposal(request, lot)).toBe(true);
    expect(canPlatformV7CreateProposal({ ...request, status: 'draft' }, lot)).toBe(false);
    expect(canPlatformV7CreateProposal(request, { ...lot, status: 'draft' })).toBe(false);
  });

  it('creates a deal only from reserved, ready and not high-risk lots', () => {
    expect(canPlatformV7LotCreateDeal({ ...lot, status: 'reserved' })).toBe(true);
    expect(canPlatformV7LotCreateDeal({ ...lot, status: 'published' })).toBe(false);
    expect(canPlatformV7LotCreateDeal({ ...lot, status: 'reserved', readinessScore: 70 })).toBe(false);
    expect(canPlatformV7LotCreateDeal({ ...lot, status: 'reserved', riskLevel: 'high' })).toBe(false);
  });
});
