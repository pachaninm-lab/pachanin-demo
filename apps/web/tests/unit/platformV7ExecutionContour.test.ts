import { describe, expect, it } from 'vitest';
import {
  acceptBid,
  acceptLogisticsQuoteCreateTrip,
  assertExecutionGraphConsistency,
  createLogisticsRequestFromDeal,
  driverFieldView,
  evaluateReleaseSafety,
  executionContourFixtures,
  getVisibleBidsForRole,
  rejectBid,
  scanForbiddenExternalTerms,
  submitLogisticsQuote,
} from '@/lib/platform-v7/execution-contour';

describe('platform-v7 execution contour', () => {
  it('keeps bid visibility role-bound before deal creation', () => {
    const lot = executionContourFixtures.lots[0];
    const bids = executionContourFixtures.bids;

    expect(getVisibleBidsForRole({ role: 'seller', lot, bids })).toHaveLength(3);
    expect(getVisibleBidsForRole({ role: 'operator', lot, bids })).toHaveLength(3);
    expect(getVisibleBidsForRole({ role: 'buyer', lot, bids, viewerCounterpartyId: 'cp-buyer-2' }).map(bid => bid.bidId)).toEqual(['BID-7002']);
    expect(getVisibleBidsForRole({ role: 'bank', lot, bids })).toHaveLength(0);
    expect(getVisibleBidsForRole({ role: 'logistics', lot, bids })).toHaveLength(0);
    expect(getVisibleBidsForRole({ role: 'driver', lot, bids })).toHaveLength(0);
  });

  it('forbids rejecting a bid without a seller-visible reason', () => {
    expect(() => rejectBid(executionContourFixtures.bids[0], undefined)).toThrow('Отклонение ставки без причины запрещено.');
    expect(rejectBid(executionContourFixtures.bids[0], 'Не подходят условия оплаты').status).toBe('rejected');
  });

  it('accepts one bid, freezes its economics, closes competing bids and creates a deal', () => {
    const result = acceptBid({
      lot: executionContourFixtures.lots[0],
      bids: executionContourFixtures.bids,
      bidId: 'BID-7002',
    });

    const acceptedBid = result.bids.find(bid => bid.bidId === 'BID-7002');
    expect(acceptedBid?.status).toBe('accepted');
    expect(result.bids.filter(bid => bid.status === 'accepted')).toHaveLength(1);
    expect(result.bids.filter(bid => bid.bidId !== 'BID-7002').every(bid => ['rejected', 'outbid'].includes(bid.status))).toBe(true);
    expect(result.lot.status).toBe('deal_created');
    expect(result.deal).toMatchObject({
      dealId: 'DL-9116',
      lotId: 'LOT-2403',
      acceptedBidId: 'BID-7002',
      sellerId: 'cp-seller-1',
      buyerId: 'cp-buyer-2',
      crop: 'Пшеница',
      grade: '4 класс',
      volumeTons: 500,
      pricePerTon: 15700,
      totalAmount: 7850000,
      paymentTerms: 'bank_reserve',
      logisticsMode: 'platform_logistics_required',
    });
    expect(result.deal.auditTrail[0]).toMatchObject({ action: 'accept_bid_create_deal', objectType: 'bid', objectId: 'BID-7002' });
  });

  it('creates logistics request, carrier quote and trip only through the accepted chain', () => {
    const { deal } = acceptBid({
      lot: executionContourFixtures.lots[0],
      bids: executionContourFixtures.bids,
      bidId: 'BID-7002',
    });
    const request = createLogisticsRequestFromDeal(deal);
    const quote = submitLogisticsQuote({
      requestId: request.requestId,
      carrierId: 'cp-carrier-1',
      rateType: 'per_ton',
      rate: 2400,
      vehicleType: 'зерновоз',
      vehicleNumber: 'А123ВС68',
      driverCandidate: 'driver-2041',
      etaPickup: '2026-05-02T08:00:00.000Z',
      etaDelivery: '2026-05-03T09:00:00.000Z',
      conditions: 'GPS и пломба обязательны',
    });
    const assigned = acceptLogisticsQuoteCreateTrip({ request, quote, driverId: 'driver-2041', vehicleId: 'truck-2041' });

    expect(request).toMatchObject({ requestId: 'LR-2041', dealId: 'DL-9116', lotId: 'LOT-2403', status: 'draft' });
    expect(assigned.request.status).toBe('assigned');
    expect(assigned.quote.status).toBe('accepted');
    expect(assigned.trip).toMatchObject({
      tripId: 'TR-2041',
      dealId: 'DL-9116',
      logisticsRequestId: 'LR-2041',
      carrierId: 'cp-carrier-1',
      driverId: 'driver-2041',
      vehicleId: 'truck-2041',
      status: 'driver_assigned',
    });
  });

  it('blocks money release until trip, receiving, lab, FGIS, EDO, documents and disputes are clean', () => {
    const { deal } = acceptBid({ lot: executionContourFixtures.lots[0], bids: executionContourFixtures.bids, bidId: 'BID-7002' });
    const blocked = evaluateReleaseSafety({
      deal,
      reserveConfirmed: true,
      fgisReady: false,
      edoReady: false,
      manualReviewOpen: false,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.title).toBe('Выпуск денег заблокирован');
    expect(blocked.reasons).toEqual(expect.arrayContaining(['рейс не закрыт', 'СДИЗ/ФГИС требует проверки', 'не подписан транспортный пакет']));

    const request = createLogisticsRequestFromDeal(deal);
    const quote = submitLogisticsQuote({
      requestId: request.requestId,
      carrierId: 'cp-carrier-1',
      rateType: 'per_ton',
      rate: 2400,
      vehicleType: 'зерновоз',
      etaPickup: '2026-05-02T08:00:00.000Z',
      etaDelivery: '2026-05-03T09:00:00.000Z',
    });
    const { trip } = acceptLogisticsQuoteCreateTrip({ request, quote, driverId: 'driver-2041', vehicleId: 'truck-2041' });
    const allowed = evaluateReleaseSafety({
      deal,
      trip: { ...trip, status: 'completed' },
      receiving: { receivingId: 'RCV-1', tripId: trip.tripId, dealId: deal.dealId, weightNet: 500, weightStatus: 'confirmed', actStatus: 'signed' },
      labResult: { labResultId: 'LAB-1', dealId: deal.dealId, tripId: trip.tripId, status: 'issued', qualityDeltaAmount: 0 },
      documentPack: { packId: 'DOC-1', dealId: deal.dealId, requiredDocuments: ['ЭТрН', 'СДИЗ', 'УПД'], signedDocuments: ['ЭТрН', 'СДИЗ', 'УПД'], status: 'complete' },
      disputePack: { disputeId: 'DK-0', dealId: deal.dealId, tripId: trip.tripId, status: 'none', evidenceIds: [], amountImpact: 0 },
      reserveConfirmed: true,
      fgisReady: true,
      edoReady: true,
      manualReviewOpen: false,
    });

    expect(allowed).toMatchObject({ allowed: true, title: 'Выпуск денег разрешён', responsible: 'bank' });
  });

  it('keeps the driver field shell free of forbidden commercial surfaces', () => {
    const { deal } = acceptBid({ lot: executionContourFixtures.lots[0], bids: executionContourFixtures.bids, bidId: 'BID-7002' });
    const request = createLogisticsRequestFromDeal(deal);
    const quote = submitLogisticsQuote({
      requestId: request.requestId,
      carrierId: 'cp-carrier-1',
      rateType: 'per_ton',
      rate: 2400,
      vehicleType: 'зерновоз',
      etaPickup: '2026-05-02T08:00:00.000Z',
      etaDelivery: '2026-05-03T09:00:00.000Z',
    });
    const { trip } = acceptLogisticsQuoteCreateTrip({ request, quote, driverId: 'driver-2041', vehicleId: 'truck-2041' });
    const fieldView = driverFieldView(trip);

    expect(Object.keys(fieldView).sort()).toEqual(['deliveryPoint', 'dispatcherContact', 'documentPack', 'eta', 'fieldActions', 'pickupPoint', 'route', 'status', 'tripId'].sort());
    expect(JSON.stringify(fieldView).toLowerCase()).not.toContain('банк');
    expect(JSON.stringify(fieldView).toLowerCase()).not.toContain('ставк');
    expect(JSON.stringify(fieldView).toLowerCase()).not.toContain('инвестор');
  });

  it('scans external UI copy for forbidden technical terms', () => {
    expect(scanForbiddenExternalTerms('Control Tower callback debug AI')).toEqual(['AI', 'Control Tower', 'callback', 'debug']);
    expect(scanForbiddenExternalTerms('Центр управления: выпуск денег заблокирован, причина остановки — не подписан транспортный пакет.')).toEqual([]);
  });

  it('checks graph consistency across lot, bid, deal, logistics, trip, receiving and dispute objects', () => {
    const accepted = acceptBid({ lot: executionContourFixtures.lots[0], bids: executionContourFixtures.bids, bidId: 'BID-7002' });
    const request = createLogisticsRequestFromDeal(accepted.deal);
    const quote = submitLogisticsQuote({
      requestId: request.requestId,
      carrierId: 'cp-carrier-1',
      rateType: 'per_ton',
      rate: 2400,
      vehicleType: 'зерновоз',
      etaPickup: '2026-05-02T08:00:00.000Z',
      etaDelivery: '2026-05-03T09:00:00.000Z',
    });
    const assigned = acceptLogisticsQuoteCreateTrip({ request, quote, driverId: 'driver-2041', vehicleId: 'truck-2041' });

    expect(assertExecutionGraphConsistency({
      ...executionContourFixtures,
      lots: [accepted.lot],
      bids: accepted.bids,
      deals: [accepted.deal],
      logisticsRequests: [assigned.request],
      logisticsQuotes: [assigned.quote],
      trips: [assigned.trip],
      receivings: [{ receivingId: 'RCV-1', tripId: assigned.trip.tripId, dealId: accepted.deal.dealId, weightNet: 500, weightStatus: 'confirmed', actStatus: 'signed' }],
      labResults: [{ labResultId: 'LAB-1', dealId: accepted.deal.dealId, tripId: assigned.trip.tripId, status: 'issued', qualityDeltaAmount: 0 }],
      documentPacks: [{ packId: 'DOC-1', dealId: accepted.deal.dealId, requiredDocuments: ['ЭТрН'], signedDocuments: ['ЭТрН'], status: 'complete' }],
      disputePacks: [{ disputeId: 'DK-1', dealId: accepted.deal.dealId, tripId: assigned.trip.tripId, status: 'open', evidenceIds: ['EV-1'], amountImpact: 120000 }],
    })).toEqual([]);

    expect(assertExecutionGraphConsistency({
      ...executionContourFixtures,
      lots: [accepted.lot],
      bids: accepted.bids,
      deals: [],
      logisticsRequests: [request],
    })).toEqual(['Логистическая заявка LR-2041 создана без сделки.']);
  });
});
