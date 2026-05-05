import { describe, expect, it } from 'vitest';
import { calculateBuyerLandedPrice, calculateSellerNetback } from './price-calculators';
import { calculateMatch } from './matching-engine';
import { calculateBuyerReliabilityScore, calculateSellerReliabilityScore, ratingAdmission } from './reputation';
import { createCounterOffer, transitionOffer } from './offer-state-machine';
import { createDealDraftFromAcceptedOffer, evaluateDealDraftGuards } from './deal-draft';
import { scanMessageForLeaks } from './anti-leak-filter';
import { calculateBypassRiskProfile, mapLeakFindingToSignal, platformTrustScoreFromBypassRisk } from './bypass-risk-score';
import { canRevealContact } from './contact-vault';
import { createDealFingerprint, isSimilarDealFingerprint } from './deal-fingerprint';
import { canAccessSensitiveField } from './deal-access-gate';
import { canDownloadDocument, documentAccessLabel } from './document-access-control';
import { createDocumentFingerprint } from './document-fingerprinting';
import { scanAttachmentRisk } from './attachment-risk-scanner';
import { canPlatformV7RoleSeeField } from './role-access';
import type { GrainBatch, MarketLot, Offer, RFQ } from './core-types';

const createdAt = '2026-05-06T00:00:00.000Z';

const batch: GrainBatch = {
  id: 'BATCH-1',
  sellerId: 'SELLER-1',
  crop: 'Пшеница',
  cropClass: '4',
  volumeTons: 600,
  availableVolumeTons: 600,
  region: 'Тамбовская область',
  qualityReady: true,
  documentsReady: true,
  sdizReady: true,
  status: 'ready_for_lot',
  createdAt,
  updatedAt: createdAt,
};

const lot: MarketLot = {
  id: 'LOT-1',
  batchId: 'BATCH-1',
  sellerId: 'SELLER-1',
  crop: 'Пшеница',
  cropClass: '4',
  volumeTons: 600,
  region: 'Тамбовская область',
  basis: 'EXW',
  pricePerTon: 16000,
  visibility: 'verified_buyers',
  status: 'ready_to_publish',
  createdAt,
  updatedAt: createdAt,
};

const rfq: RFQ = {
  id: 'RFQ-1',
  buyerId: 'BUYER-1',
  crop: 'Пшеница',
  cropClass: '4',
  volumeTons: 600,
  region: 'Тамбовская область',
  basis: 'EXW',
  maxPricePerTon: 16500,
  requiresDocuments: true,
  requiresLogistics: true,
  status: 'published',
  createdAt,
  updatedAt: createdAt,
};

const offer: Offer = {
  id: 'OFFER-1',
  lotId: 'LOT-1',
  batchId: 'BATCH-1',
  sellerId: 'SELLER-1',
  buyerId: 'BUYER-1',
  pricePerTon: 16000,
  volumeTons: 600,
  basis: 'EXW',
  logisticsOption: 'platform_logistics',
  paymentTerms: 'after_documents',
  documentRequirements: ['contract', 'upd'],
  qualityRequirements: ['protein'],
  status: 'sent',
  version: 1,
  createdAt,
  updatedAt: createdAt,
};

describe('platform-v7 grain core', () => {
  it('calculates seller netback and buyer landed price', () => {
    expect(calculateSellerNetback({ buyerPricePerTon: 16000, volumeTons: 100, logisticsCostPerTon: 500, dryingCostPerTon: 100 }).pricePerTon).toBe(15400);
    expect(calculateBuyerLandedPrice({ sellerPricePerTon: 16000, volumeTons: 100, logisticsCostPerTon: 500, documentCostPerTon: 50 }).pricePerTon).toBe(16550);
  });

  it('matches lot to rfq and returns ranked business explanation', () => {
    const match = calculateMatch({ lot, batch, rfq, sellerRiskScore: 90, buyerRiskScore: 85, logisticsCostPerTon: 300 });
    expect(match.totalScore).toBeGreaterThanOrEqual(80);
    expect(match.recommendation).toBe('strong_match');
    expect(match.sellerNetPricePerTon).toBe(15700);
    expect(match.buyerLandedPricePerTon).toBe(16300);
  });

  it('scores reliability and maps admission level', () => {
    const buyer = calculateBuyerReliabilityScore({ buyerId: 'BUYER-1', identityScore: 90, legalScore: 90, financialScore: 90, paymentDisciplineScore: 90, documentDisciplineScore: 80, disputeScore: 90, platformHistoryScore: 80, counterpartyRatingScore: 90, redFlags: [], updatedAt: createdAt });
    const seller = calculateSellerReliabilityScore({ sellerId: 'SELLER-1', identityScore: 90, legalScore: 90, batchAccuracyScore: 90, qualityAccuracyScore: 90, weightAccuracyScore: 90, shipmentDisciplineScore: 90, documentDisciplineScore: 90, sdizDisciplineScore: 90, disputeScore: 90, platformHistoryScore: 90, counterpartyRatingScore: 90, redFlags: [], updatedAt: createdAt });
    expect(buyer.riskLevel).toBe('low');
    expect(seller.riskLevel).toBe('low');
    expect(ratingAdmission(55).automaticAdmission).toBe(false);
  });

  it('enforces offer transitions, counter offer versions and rejection reason', () => {
    expect(() => transitionOffer(offer, 'rejected', 'SELLER-1')).toThrow(/reason/);
    const counter = createCounterOffer(offer, { pricePerTon: 16100 }, 'BUYER-1', 'Уточнение цены');
    expect(counter.offer.version).toBe(2);
    expect(counter.auditEvent.action).toBe('offer_countered');
  });

  it('creates DealDraft only from accepted offer and blocks execution until plans are ready', () => {
    const accepted = transitionOffer(offer, 'accepted', 'SELLER-1').offer;
    const draft = createDealDraftFromAcceptedOffer(accepted);
    expect(evaluateDealDraftGuards(draft).ready).toBe(false);
    expect(evaluateDealDraftGuards({ ...draft, moneyPlanReady: true, documentPlanReady: true, logisticsPlanReady: true, sdizStatus: 'ready' }).ready).toBe(true);
  });

  it('detects contact leakage and converts it to bypass risk', () => {
    const scan = scanMessageForLeaks('созвонимся напрямую +7 916 277 89 89, скину номер');
    expect(scan.action).toBe('assisted_mode');
    const signals = scan.findings.map((finding) => mapLeakFindingToSignal(finding, 'BUYER-1', 'buyer', 'SELLER-1'));
    const profile = calculateBypassRiskProfile('BUYER-1', signals);
    expect(profile.manualReviewRequired).toBe(true);
    expect(platformTrustScoreFromBypassRisk(profile.totalScore)).toBeLessThan(100);
  });

  it('blocks early contact reveal and sensitive access', () => {
    const entry = { id: 'CV-1', counterpartyId: 'SELLER-1', contactType: 'phone' as const, encryptedValue: '+79990000000', revealPolicy: { minStage: 'deal_confirmed' as const, allowedRoles: ['buyer' as const], requireOperatorApproval: false, blockIfBypassRiskAbove: 40 }, createdAt };
    expect(canRevealContact(entry, { role: 'buyer', stage: 'offer_sent', actorId: 'BUYER-1' }).allowed).toBe(false);
    expect(canAccessSensitiveField('phone', { role: 'buyer', stage: 'offer_sent', hasOffer: true, hasDealDraft: false, trustScore: 80, counterpartyAdmitted: true }).allowed).toBe(false);
  });

  it('controls document access and fingerprints files', () => {
    const context = { role: 'buyer' as const, hasDealDraft: true, hasAcceptedOffer: true, maturity: 'controlled-pilot' as const };
    expect(canDownloadDocument(context).allowed).toBe(true);
    expect(documentAccessLabel({ ...context, hasDealDraft: false })).toContain('preview');
    const fingerprint = createDocumentFingerprint({ fileId: 'DOC-1', userId: 'BUYER-1', dealId: 'DL-1', accessLevel: 'preview', fileHash: 'abc' });
    expect(fingerprint.visibleWatermark).toContain('DL-1');
  });

  it('scans attachments and keeps role leakage closed', () => {
    const attachment = scanAttachmentRisk({ fileName: 'scan.pdf', extractedText: 'телефон +7 900 111 22 33', liveOcrEnabled: false });
    expect(attachment.allowDownload).toBe(false);
    expect(canPlatformV7RoleSeeField('driver', 'bankDetails').allowed).toBe(false);
  });

  it('creates stable deal fingerprints for similar cancelled flows', () => {
    const first = createDealFingerprint({ sellerId: 'S1', buyerId: 'B1', crop: 'Пшеница', cropClass: '4', volumeTons: 612, region: 'Тамбовская область', basis: 'EXW', pricePerTon: 16040, deliveryWindow: 'май', qualityHash: 'q1', documentHash: 'd1' });
    const second = createDealFingerprint({ sellerId: 'S1', buyerId: 'B1', crop: 'Пшеница', cropClass: '4', volumeTons: 650, region: 'Тамбовская область', basis: 'EXW', pricePerTon: 16110, deliveryWindow: 'май', qualityHash: 'q2', documentHash: 'd2' });
    expect(isSimilarDealFingerprint(first, second)).toBe(true);
  });
});
