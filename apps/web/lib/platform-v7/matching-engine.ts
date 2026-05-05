import { GrainBatch, MarketLot, RFQ, clampScore } from './core-types';
import { calculateBuyerLandedPrice, calculateSellerNetback } from './price-calculators';

export type MatchRecommendation = 'strong_match' | 'possible_match' | 'needs_clarification' | 'high_risk' | 'not_recommended';

export interface MatchScore {
  id: string;
  sellerId?: string;
  buyerId?: string;
  batchId?: string;
  lotId?: string;
  rfqId?: string;
  qualityScore: number;
  volumeScore: number;
  regionScore: number;
  logisticsScore: number;
  documentScore: number;
  priceScore: number;
  riskScore: number;
  totalScore: number;
  recommendation: MatchRecommendation;
  nextAction: string;
  sellerNetPricePerTon?: number;
  buyerLandedPricePerTon?: number;
  explanation: string[];
}

export interface MatchInput {
  batch?: GrainBatch;
  lot?: MarketLot;
  rfq: RFQ;
  sellerRiskScore?: number;
  buyerRiskScore?: number;
  logisticsCostPerTon?: number;
  qualityRiskPerTon?: number;
  documentRiskPerTon?: number;
}

const weights = {
  qualityScore: 0.2,
  volumeScore: 0.15,
  regionScore: 0.1,
  logisticsScore: 0.15,
  documentScore: 0.15,
  priceScore: 0.15,
  riskScore: 0.1,
};

function scoreRecommendation(totalScore: number, riskScore: number): MatchRecommendation {
  if (riskScore < 40) return 'high_risk';
  if (totalScore >= 85) return 'strong_match';
  if (totalScore >= 70) return 'possible_match';
  if (totalScore >= 55) return 'needs_clarification';
  return 'not_recommended';
}

function qualityScore(batch?: GrainBatch, lot?: MarketLot, rfq?: RFQ): number {
  const crop = lot?.crop ?? batch?.crop;
  const cropClass = lot?.cropClass ?? batch?.cropClass;
  if (!crop || !rfq) return 0;
  const cropMatch = crop.toLowerCase() === rfq.crop.toLowerCase() ? 55 : 0;
  const classMatch = !rfq.cropClass || !cropClass || rfq.cropClass === cropClass ? 45 : 10;
  return clampScore(cropMatch + classMatch);
}

function volumeScore(volume: number, requested: number): number {
  if (volume <= 0 || requested <= 0) return 0;
  const ratio = Math.min(volume, requested) / Math.max(volume, requested);
  return clampScore(ratio * 100);
}

function regionScore(region: string | undefined, rfqRegion: string): number {
  if (!region) return 0;
  return region.toLowerCase() === rfqRegion.toLowerCase() ? 100 : 60;
}

function priceScore(lot: MarketLot | undefined, rfq: RFQ): number {
  if (!lot || !rfq.maxPricePerTon) return 75;
  if (lot.pricePerTon <= rfq.maxPricePerTon) return 100;
  const overrun = (lot.pricePerTon - rfq.maxPricePerTon) / rfq.maxPricePerTon;
  return clampScore(100 - overrun * 250);
}

export function calculateMatch(input: MatchInput): MatchScore {
  const source = input.lot ?? input.batch;
  if (!source) throw new Error('Either lot or batch is required');
  const sourceVolume = input.lot?.volumeTons ?? input.batch?.availableVolumeTons ?? 0;
  const sourceRegion = input.lot?.region ?? input.batch?.region;
  const q = qualityScore(input.batch, input.lot, input.rfq);
  const v = volumeScore(sourceVolume, input.rfq.volumeTons);
  const r = regionScore(sourceRegion, input.rfq.region);
  const logistics = input.rfq.requiresLogistics ? 75 : 95;
  const docs = (input.batch?.documentsReady ?? false) || input.lot?.status === 'ready_to_publish' ? 90 : 55;
  const price = priceScore(input.lot, input.rfq);
  const risk = clampScore(((input.sellerRiskScore ?? 75) + (input.buyerRiskScore ?? 75)) / 2);
  const totalScore = clampScore(
    q * weights.qualityScore +
      v * weights.volumeScore +
      r * weights.regionScore +
      logistics * weights.logisticsScore +
      docs * weights.documentScore +
      price * weights.priceScore +
      risk * weights.riskScore,
  );
  const recommendation = scoreRecommendation(totalScore, risk);
  const lotPrice = input.lot?.pricePerTon ?? input.rfq.maxPricePerTon ?? 0;
  const sellerNet = calculateSellerNetback({
    buyerPricePerTon: lotPrice,
    volumeTons: sourceVolume || input.rfq.volumeTons,
    logisticsCostPerTon: input.logisticsCostPerTon ?? 0,
    qualityDiscountPerTon: input.qualityRiskPerTon ?? 0,
    platformFeePerTon: 0,
  });
  const buyerLanded = calculateBuyerLandedPrice({
    sellerPricePerTon: lotPrice,
    volumeTons: sourceVolume || input.rfq.volumeTons,
    logisticsCostPerTon: input.logisticsCostPerTon ?? 0,
    qualityRiskPerTon: input.qualityRiskPerTon ?? 0,
    documentCostPerTon: input.documentRiskPerTon ?? 0,
  });
  return {
    id: `MATCH-${input.lot?.id ?? input.batch?.id}-${input.rfq.id}`,
    sellerId: input.lot?.sellerId ?? input.batch?.sellerId,
    buyerId: input.rfq.buyerId,
    batchId: input.batch?.id,
    lotId: input.lot?.id,
    rfqId: input.rfq.id,
    qualityScore: q,
    volumeScore: v,
    regionScore: r,
    logisticsScore: logistics,
    documentScore: docs,
    priceScore: price,
    riskScore: risk,
    totalScore,
    recommendation,
    nextAction: recommendation === 'strong_match' ? 'Создать оффер' : recommendation === 'high_risk' ? 'Передать на ручную проверку' : 'Уточнить условия',
    sellerNetPricePerTon: sellerNet.pricePerTon,
    buyerLandedPricePerTon: buyerLanded.pricePerTon,
    explanation: [
      `Качество: ${q}/100`,
      `Объём: ${v}/100`,
      `Регион: ${r}/100`,
      `Документы: ${docs}/100`,
      `Цена: ${price}/100`,
      `Риск: ${risk}/100`,
    ],
  };
}

export function rankMatches(matches: MatchScore[]): MatchScore[] {
  return [...matches].sort((a, b) => b.totalScore - a.totalScore || (b.sellerNetPricePerTon ?? 0) - (a.sellerNetPricePerTon ?? 0));
}
