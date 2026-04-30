export type ISODateTime = string;
export type MoneyRoubles = number;

export type PlatformRole =
  | 'seller'
  | 'buyer'
  | 'operator'
  | 'bank'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'surveyor'
  | 'arbitrator'
  | 'investor';

export type AuctionMode = 'open_bids' | 'sealed_bids' | 'fixed_price' | 'negotiation';
export type BidVisibilityMode = 'open' | 'blind' | 'seller_only';

export interface QualityPassport {
  readonly proteinPct?: number;
  readonly glutenPct?: number;
  readonly moisturePct: number;
  readonly foreignMatterPct?: number;
  readonly testWeightGpl?: number;
  readonly labStatus: 'declared' | 'checked' | 'requires_recheck';
}

export interface Lot {
  readonly lotId: string;
  readonly sellerId: string;
  readonly crop: string;
  readonly grade: string;
  readonly volumeTons: number;
  readonly region: string;
  readonly basis: string;
  readonly targetPricePerTon: MoneyRoubles;
  readonly minAcceptablePricePerTon?: MoneyRoubles;
  readonly qualityPassport: QualityPassport;
  readonly fgisStatus: 'confirmed' | 'requires_check' | 'not_connected';
  readonly sdizStatus: 'ready' | 'missing' | 'requires_check';
  readonly documentsReadiness: number;
  readonly auctionMode: AuctionMode;
  readonly bidVisibilityMode: BidVisibilityMode;
  readonly status: 'draft' | 'published' | 'bidding' | 'offer_accepted' | 'deal_created' | 'expired' | 'cancelled';
  readonly expiresAt: ISODateTime;
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
}

export type PaymentTerms = 'bank_reserve' | 'postpay' | 'partial_prepay' | 'custom';
export type LogisticsOption = 'buyer_pickup' | 'seller_delivery' | 'platform_logistics_required';
export type BidStatus = 'submitted' | 'leading' | 'outbid' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';

export interface Bid {
  readonly bidId: string;
  readonly lotId: string;
  readonly buyerId: string;
  readonly buyerAlias?: string;
  readonly pricePerTon: MoneyRoubles;
  readonly volumeTons: number;
  readonly totalAmount: MoneyRoubles;
  readonly paymentTerms: PaymentTerms;
  readonly logisticsOption: LogisticsOption;
  readonly pickupWindow: string;
  readonly documentsRequired: readonly string[];
  readonly comment?: string;
  readonly status: BidStatus;
  readonly rejectionReason?: RejectionReason;
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
}

export type RejectionReason =
  | 'Цена ниже ожидания'
  | 'Не подходит объём'
  | 'Не подходит срок вывоза'
  | 'Не подходят условия оплаты'
  | 'Не готовы документы'
  | 'Другое';

export interface TimelineEvent {
  readonly eventId: string;
  readonly at: ISODateTime;
  readonly actorRole: PlatformRole;
  readonly title: string;
  readonly details: string;
}

export interface AuditEvent {
  readonly eventId: string;
  readonly at: ISODateTime;
  readonly actorRole: PlatformRole;
  readonly action: string;
  readonly objectType: 'lot' | 'bid' | 'deal' | 'logistics_request' | 'logistics_quote' | 'trip' | 'field_event' | 'money' | 'document' | 'dispute';
  readonly objectId: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

export interface Deal {
  readonly dealId: string;
  readonly lotId: string;
  readonly acceptedBidId: string;
  readonly sellerId: string;
  readonly buyerId: string;
  readonly crop: string;
  readonly grade: string;
  readonly volumeTons: number;
  readonly pricePerTon: MoneyRoubles;
  readonly totalAmount: MoneyRoubles;
  readonly paymentTerms: PaymentTerms;
  readonly logisticsMode: LogisticsOption;
  readonly status: 'created' | 'logistics_requested' | 'logistics_assigned' | 'in_transit' | 'receiving' | 'documents_pending' | 'to_money_release' | 'money_released' | 'dispute_open';
  readonly moneyStatus: 'not_requested' | 'reserve_requested' | 'reserve_confirmed' | 'blocked' | 'ready_to_release' | 'released' | 'held';
  readonly documentsStatus: 'missing' | 'partial' | 'complete';
  readonly disputeStatus?: 'none' | 'open' | 'resolved';
  readonly timeline: readonly TimelineEvent[];
  readonly auditTrail: readonly AuditEvent[];
}

export interface LogisticsRequest {
  readonly requestId: string;
  readonly dealId: string;
  readonly lotId: string;
  readonly cargo: {
    readonly crop: string;
    readonly grade: string;
    readonly volumeTons: number;
  };
  readonly pickupLocation: string;
  readonly deliveryLocation: string;
  readonly pickupWindow: string;
  readonly deliveryWindow: string;
  readonly vehicleRequirements: readonly string[];
  readonly documentsRequired: readonly string[];
  readonly sealRequired: boolean;
  readonly gpsRequired: boolean;
  readonly targetRate?: MoneyRoubles;
  readonly sentTo: readonly string[];
  readonly status: 'draft' | 'sent' | 'viewed' | 'quoted' | 'accepted' | 'rejected' | 'assigned' | 'in_transit' | 'completed' | 'cancelled';
  readonly slaResponseAt: ISODateTime;
}

export interface LogisticsQuote {
  readonly quoteId: string;
  readonly requestId: string;
  readonly carrierId: string;
  readonly rateType: 'per_ton' | 'per_trip';
  readonly rate: MoneyRoubles;
  readonly vehicleType: string;
  readonly vehicleNumber?: string;
  readonly driverCandidate?: string;
  readonly etaPickup: ISODateTime;
  readonly etaDelivery: ISODateTime;
  readonly conditions?: string;
  readonly status: 'submitted' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';
}

export interface GpsEvent {
  readonly at: ISODateTime;
  readonly lat: number;
  readonly lng: number;
  readonly source: 'gps' | 'manual_checkin';
}

export interface PhotoEvent {
  readonly photoId: string;
  readonly at: ISODateTime;
  readonly type: 'loading' | 'seal' | 'delivery' | 'deviation';
}

export interface DeviationEvent {
  readonly eventId: string;
  readonly at: ISODateTime;
  readonly reason: string;
  readonly severity: 'low' | 'medium' | 'high';
}

export interface Trip {
  readonly tripId: string;
  readonly dealId: string;
  readonly logisticsRequestId: string;
  readonly carrierId: string;
  readonly driverId: string;
  readonly vehicleId: string;
  readonly trailerId?: string;
  readonly status: 'driver_assigned' | 'at_pickup' | 'loaded' | 'in_transit' | 'arrived' | 'weighing' | 'accepted' | 'completed' | 'deviation' | 'cancelled';
  readonly gpsTrack: readonly GpsEvent[];
  readonly photoEvents: readonly PhotoEvent[];
  readonly sealNumber?: string;
  readonly weightGross?: number;
  readonly weightTare?: number;
  readonly weightNet?: number;
  readonly documentPack: readonly string[];
  readonly deviationEvents: readonly DeviationEvent[];
}

export interface FieldEvent {
  readonly eventId: string;
  readonly tripId: string;
  readonly dealId: string;
  readonly actorId: string;
  readonly actorRole: 'driver' | 'elevator' | 'surveyor' | 'lab';
  readonly eventType: string;
  readonly timestamp: ISODateTime;
  readonly geo?: {
    readonly lat: number;
    readonly lng: number;
  };
  readonly photoIds?: readonly string[];
  readonly comment?: string;
  readonly syncStatus: 'synced' | 'pending' | 'failed';
}

export interface Receiving {
  readonly receivingId: string;
  readonly tripId: string;
  readonly dealId: string;
  readonly weightNet: number;
  readonly weightStatus: 'pending' | 'confirmed' | 'disputed';
  readonly actStatus: 'missing' | 'draft' | 'signed';
}

export interface LabResult {
  readonly labResultId: string;
  readonly dealId: string;
  readonly tripId: string;
  readonly status: 'pending' | 'issued' | 'disputed';
  readonly qualityDeltaAmount: MoneyRoubles;
}

export interface DocumentPack {
  readonly packId: string;
  readonly dealId: string;
  readonly requiredDocuments: readonly string[];
  readonly signedDocuments: readonly string[];
  readonly status: 'missing' | 'partial' | 'complete';
}

export interface MoneyTimelineStep {
  readonly stepId: string;
  readonly dealId: string;
  readonly title: string;
  readonly status: 'done' | 'active' | 'blocked' | 'pending';
  readonly at?: ISODateTime;
}

export interface DisputePack {
  readonly disputeId: string;
  readonly dealId: string;
  readonly tripId: string;
  readonly status: 'none' | 'open' | 'resolved';
  readonly evidenceIds: readonly string[];
  readonly amountImpact: MoneyRoubles;
}

export interface ExecutionContourState {
  readonly lots: readonly Lot[];
  readonly bids: readonly Bid[];
  readonly deals: readonly Deal[];
  readonly logisticsRequests: readonly LogisticsRequest[];
  readonly logisticsQuotes: readonly LogisticsQuote[];
  readonly trips: readonly Trip[];
  readonly fieldEvents: readonly FieldEvent[];
  readonly receivings: readonly Receiving[];
  readonly labResults: readonly LabResult[];
  readonly documentPacks: readonly DocumentPack[];
  readonly moneyTimeline: readonly MoneyTimelineStep[];
  readonly disputePacks: readonly DisputePack[];
}

const now = '2026-05-01T09:00:00.000Z';

export const executionContourFixtures: ExecutionContourState = {
  lots: [
    {
      lotId: 'LOT-2403',
      sellerId: 'cp-seller-1',
      crop: 'Пшеница',
      grade: '4 класс',
      volumeTons: 500,
      region: 'Тамбовская область',
      basis: 'EXW склад продавца',
      targetPricePerTon: 15700,
      minAcceptablePricePerTon: 15400,
      qualityPassport: { proteinPct: 12.5, glutenPct: 23, moisturePct: 13.2, foreignMatterPct: 2, testWeightGpl: 760, labStatus: 'declared' },
      fgisStatus: 'requires_check',
      sdizStatus: 'requires_check',
      documentsReadiness: 82,
      auctionMode: 'sealed_bids',
      bidVisibilityMode: 'blind',
      status: 'bidding',
      expiresAt: '2026-05-01T12:20:00.000Z',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: now,
    },
  ],
  bids: [
    {
      bidId: 'BID-7001',
      lotId: 'LOT-2403',
      buyerId: 'cp-buyer-1',
      buyerAlias: 'Покупатель A',
      pricePerTon: 15900,
      volumeTons: 300,
      totalAmount: 4770000,
      paymentTerms: 'bank_reserve',
      logisticsOption: 'buyer_pickup',
      pickupWindow: '02.05.2026 08:00–14:00',
      documentsRequired: ['СДИЗ', 'УПД', 'ЭТрН'],
      status: 'leading',
      createdAt: '2026-04-30T11:00:00.000Z',
      updatedAt: now,
    },
    {
      bidId: 'BID-7002',
      lotId: 'LOT-2403',
      buyerId: 'cp-buyer-2',
      buyerAlias: 'Покупатель B',
      pricePerTon: 15700,
      volumeTons: 500,
      totalAmount: 7850000,
      paymentTerms: 'bank_reserve',
      logisticsOption: 'platform_logistics_required',
      pickupWindow: '02.05.2026 08:00–14:00',
      documentsRequired: ['СДИЗ', 'УПД', 'ЭТрН', 'путевой лист'],
      status: 'submitted',
      createdAt: '2026-04-30T11:30:00.000Z',
      updatedAt: now,
    },
    {
      bidId: 'BID-7003',
      lotId: 'LOT-2403',
      buyerId: 'cp-buyer-3',
      buyerAlias: 'Покупатель C',
      pricePerTon: 15500,
      volumeTons: 200,
      totalAmount: 3100000,
      paymentTerms: 'postpay',
      logisticsOption: 'buyer_pickup',
      pickupWindow: '03.05.2026 10:00–16:00',
      documentsRequired: ['СДИЗ', 'УПД'],
      status: 'submitted',
      createdAt: '2026-04-30T12:00:00.000Z',
      updatedAt: now,
    },
  ],
  deals: [],
  logisticsRequests: [],
  logisticsQuotes: [],
  trips: [],
  fieldEvents: [],
  receivings: [],
  labResults: [],
  documentPacks: [],
  moneyTimeline: [],
  disputePacks: [],
};

export function calculateBidTotal(pricePerTon: number, volumeTons: number): number {
  return pricePerTon * volumeTons;
}

export function submitBid(input: Omit<Bid, 'bidId' | 'totalAmount' | 'status' | 'createdAt' | 'updatedAt'>, createdAt: ISODateTime = now): Bid {
  return {
    ...input,
    bidId: `BID-${Math.floor(Math.random() * 900000) + 100000}`,
    totalAmount: calculateBidTotal(input.pricePerTon, input.volumeTons),
    status: 'submitted',
    createdAt,
    updatedAt: createdAt,
  };
}

export function updateBid(bid: Bid, patch: Pick<Partial<Bid>, 'pricePerTon' | 'volumeTons' | 'paymentTerms' | 'logisticsOption' | 'pickupWindow' | 'comment'>, updatedAt: ISODateTime = now): Bid {
  if (!['submitted', 'leading', 'outbid'].includes(bid.status)) {
    throw new Error('Изменять можно только активную ставку.');
  }
  const nextPrice = patch.pricePerTon ?? bid.pricePerTon;
  const nextVolume = patch.volumeTons ?? bid.volumeTons;
  return {
    ...bid,
    ...patch,
    pricePerTon: nextPrice,
    volumeTons: nextVolume,
    totalAmount: calculateBidTotal(nextPrice, nextVolume),
    updatedAt,
  };
}

export function withdrawBid(bid: Bid, updatedAt: ISODateTime = now): Bid {
  if (bid.status === 'accepted') {
    throw new Error('Принятую ставку нельзя отозвать.');
  }
  return { ...bid, status: 'withdrawn', updatedAt };
}

export function rejectBid(bid: Bid, reason: RejectionReason | undefined, updatedAt: ISODateTime = now): Bid {
  if (!reason) {
    throw new Error('Отклонение ставки без причины запрещено.');
  }
  return { ...bid, status: 'rejected', rejectionReason: reason, updatedAt };
}

export function acceptBid(args: { lot: Lot; bids: readonly Bid[]; bidId: string; actorRole?: PlatformRole; acceptedAt?: ISODateTime }): { lot: Lot; bids: Bid[]; deal: Deal; auditEvent: AuditEvent } {
  const acceptedAt = args.acceptedAt ?? now;
  const acceptedBid = args.bids.find(bid => bid.bidId === args.bidId && bid.lotId === args.lot.lotId);
  if (!acceptedBid) {
    throw new Error('Ставка не найдена для выбранного лота.');
  }
  if (acceptedBid.status === 'withdrawn' || acceptedBid.status === 'expired' || acceptedBid.status === 'rejected') {
    throw new Error('Нельзя принять закрытую ставку.');
  }

  const nextBids = args.bids.map(bid => {
    if (bid.bidId === acceptedBid.bidId) {
      return { ...bid, status: 'accepted' as const, updatedAt: acceptedAt };
    }
    if (bid.lotId !== args.lot.lotId || bid.status === 'withdrawn') {
      return bid;
    }
    return { ...bid, status: bid.pricePerTon > acceptedBid.pricePerTon ? 'outbid' as const : 'rejected' as const, updatedAt: acceptedAt };
  });

  const deal: Deal = {
    dealId: 'DL-9116',
    lotId: args.lot.lotId,
    acceptedBidId: acceptedBid.bidId,
    sellerId: args.lot.sellerId,
    buyerId: acceptedBid.buyerId,
    crop: args.lot.crop,
    grade: args.lot.grade,
    volumeTons: acceptedBid.volumeTons,
    pricePerTon: acceptedBid.pricePerTon,
    totalAmount: acceptedBid.totalAmount,
    paymentTerms: acceptedBid.paymentTerms,
    logisticsMode: acceptedBid.logisticsOption,
    status: 'created',
    moneyStatus: acceptedBid.paymentTerms === 'bank_reserve' ? 'reserve_requested' : 'not_requested',
    documentsStatus: args.lot.documentsReadiness >= 100 ? 'complete' : 'partial',
    disputeStatus: 'none',
    timeline: [
      {
        eventId: 'TL-ACCEPT-BID',
        at: acceptedAt,
        actorRole: args.actorRole ?? 'seller',
        title: 'Ставка принята',
        details: 'Условия ставки зафиксированы и перенесены в сделку.',
      },
    ],
    auditTrail: [],
  };

  const auditEvent: AuditEvent = {
    eventId: 'AUD-ACCEPT-BID',
    at: acceptedAt,
    actorRole: args.actorRole ?? 'seller',
    action: 'accept_bid_create_deal',
    objectType: 'bid',
    objectId: acceptedBid.bidId,
    before: acceptedBid,
    after: deal,
  };

  return {
    lot: { ...args.lot, status: 'deal_created', updatedAt: acceptedAt },
    bids: nextBids,
    deal: { ...deal, auditTrail: [auditEvent] },
    auditEvent,
  };
}

export function createLogisticsRequestFromDeal(deal: Deal, sentTo: readonly string[] = ['cp-carrier-1'], createdAt: ISODateTime = now): LogisticsRequest {
  return {
    requestId: 'LR-2041',
    dealId: deal.dealId,
    lotId: deal.lotId,
    cargo: {
      crop: deal.crop,
      grade: deal.grade,
      volumeTons: deal.volumeTons,
    },
    pickupLocation: 'Тамбовская область, склад № 4',
    deliveryLocation: 'Воронежская область, элеватор № 2',
    pickupWindow: '02.05.2026 08:00–14:00',
    deliveryWindow: '03.05.2026 09:00–18:00',
    vehicleRequirements: ['зерновоз', 'GPS', 'пломба', 'фото погрузки'],
    documentsRequired: ['ЭТрН', 'путевой лист', 'СДИЗ', 'доверенность'],
    sealRequired: true,
    gpsRequired: true,
    targetRate: 2400,
    sentTo,
    status: deal.logisticsMode === 'platform_logistics_required' ? 'draft' : 'sent',
    slaResponseAt: createdAt,
  };
}

export function submitLogisticsQuote(input: Omit<LogisticsQuote, 'quoteId' | 'status'>): LogisticsQuote {
  return { ...input, quoteId: 'LQ-3001', status: 'submitted' };
}

export function acceptLogisticsQuoteCreateTrip(args: { request: LogisticsRequest; quote: LogisticsQuote; driverId: string; vehicleId: string }): { request: LogisticsRequest; quote: LogisticsQuote; trip: Trip } {
  if (args.quote.requestId !== args.request.requestId) {
    throw new Error('Предложение перевозчика не связано с заявкой.');
  }
  const quote = { ...args.quote, status: 'accepted' as const };
  return {
    request: { ...args.request, status: 'assigned' },
    quote,
    trip: {
      tripId: 'TR-2041',
      dealId: args.request.dealId,
      logisticsRequestId: args.request.requestId,
      carrierId: quote.carrierId,
      driverId: args.driverId,
      vehicleId: args.vehicleId,
      status: 'driver_assigned',
      gpsTrack: [],
      photoEvents: [],
      sealNumber: undefined,
      documentPack: args.request.documentsRequired,
      deviationEvents: [],
    },
  };
}

export function canRoleSeeBid(args: { role: PlatformRole; lot: Lot; bid: Bid; viewerCounterpartyId?: string; dealCreated?: boolean }): boolean {
  if (args.role === 'operator') return true;
  if (args.role === 'seller') return true;
  if (args.role === 'buyer') return args.bid.buyerId === args.viewerCounterpartyId;
  if (args.role === 'bank') return Boolean(args.dealCreated && args.bid.status === 'accepted');
  return false;
}

export function visibleBidLabel(args: { role: PlatformRole; lot: Lot; bid: Bid }): string {
  if (args.role === 'seller' && args.lot.bidVisibilityMode === 'blind' && args.bid.status !== 'accepted') {
    return args.bid.buyerAlias ?? 'Покупатель';
  }
  return args.bid.buyerAlias ?? args.bid.buyerId;
}

export function getVisibleBidsForRole(args: { role: PlatformRole; lot: Lot; bids: readonly Bid[]; viewerCounterpartyId?: string; dealCreated?: boolean }): Bid[] {
  return args.bids.filter(bid => bid.lotId === args.lot.lotId && canRoleSeeBid({ ...args, bid }));
}

export interface ReleaseSafetyInput {
  readonly deal: Deal;
  readonly trip?: Trip;
  readonly receiving?: Receiving;
  readonly labResult?: LabResult;
  readonly documentPack?: DocumentPack;
  readonly disputePack?: DisputePack;
  readonly reserveConfirmed: boolean;
  readonly fgisReady: boolean;
  readonly edoReady: boolean;
  readonly manualReviewOpen: boolean;
}

export interface ReleaseSafetyResult {
  readonly allowed: boolean;
  readonly title: string;
  readonly reasons: readonly string[];
  readonly responsible: PlatformRole | 'seller' | 'buyer';
  readonly nextAction: string;
}

export function evaluateReleaseSafety(input: ReleaseSafetyInput): ReleaseSafetyResult {
  const reasons: string[] = [];
  if (!input.deal.acceptedBidId) reasons.push('нет принятой ставки');
  if (!input.reserveConfirmed) reasons.push('резерв не подтверждён');
  if (!input.trip || input.trip.status !== 'completed') reasons.push('рейс не закрыт');
  if (!input.receiving || input.receiving.weightStatus !== 'confirmed') reasons.push('вес не подтверждён');
  if (!input.labResult || input.labResult.status !== 'issued') reasons.push('лаборатория не закрыта');
  if (!input.fgisReady) reasons.push('СДИЗ/ФГИС требует проверки');
  if (!input.edoReady || !input.documentPack || input.documentPack.status !== 'complete') reasons.push('не подписан транспортный пакет');
  if (input.disputePack?.status === 'open') reasons.push('открыт спор');
  if (input.manualReviewOpen) reasons.push('открыта ручная проверка');

  if (reasons.length === 0) {
    return {
      allowed: true,
      title: 'Выпуск денег разрешён',
      reasons: [],
      responsible: 'bank',
      nextAction: 'Подтвердить выпуск денег по банковому событию.',
    };
  }

  const firstReason = reasons[0];
  const responsible: ReleaseSafetyResult['responsible'] = firstReason.includes('транспортный') || firstReason.includes('рейс') ? 'logistics' : firstReason.includes('лаборатория') ? 'lab' : firstReason.includes('спор') ? 'arbitrator' : 'operator';
  return {
    allowed: false,
    title: 'Выпуск денег заблокирован',
    reasons,
    responsible,
    nextAction: firstReason.includes('транспортный') ? 'Запросить подпись грузополучателя.' : 'Закрыть указанную причину остановки и повторить проверку.',
  };
}

export function assertExecutionGraphConsistency(state: ExecutionContourState): string[] {
  const errors: string[] = [];
  const lotIds = new Set(state.lots.map(lot => lot.lotId));
  const bidIds = new Set(state.bids.map(bid => bid.bidId));
  const dealIds = new Set(state.deals.map(deal => deal.dealId));
  const requestIds = new Set(state.logisticsRequests.map(request => request.requestId));
  const quoteIds = new Set(state.logisticsQuotes.map(quote => quote.quoteId));
  const tripIds = new Set(state.trips.map(trip => trip.tripId));

  for (const bid of state.bids) {
    if (!lotIds.has(bid.lotId)) errors.push(`Ставка ${bid.bidId} не связана с лотом.`);
  }
  for (const deal of state.deals) {
    if (!lotIds.has(deal.lotId)) errors.push(`Сделка ${deal.dealId} не связана с лотом.`);
    if (!bidIds.has(deal.acceptedBidId)) errors.push(`Сделка ${deal.dealId} создана без принятой ставки.`);
  }
  for (const request of state.logisticsRequests) {
    if (!dealIds.has(request.dealId)) errors.push(`Логистическая заявка ${request.requestId} создана без сделки.`);
  }
  for (const quote of state.logisticsQuotes) {
    if (!requestIds.has(quote.requestId)) errors.push(`Предложение ${quote.quoteId} создано без логистической заявки.`);
  }
  for (const trip of state.trips) {
    if (!dealIds.has(trip.dealId)) errors.push(`Рейс ${trip.tripId} создан без сделки.`);
    if (!requestIds.has(trip.logisticsRequestId)) errors.push(`Рейс ${trip.tripId} создан без логистической заявки.`);
  }
  for (const receiving of state.receivings) {
    if (!tripIds.has(receiving.tripId)) errors.push(`Приёмка ${receiving.receivingId} не связана с рейсом.`);
    if (!dealIds.has(receiving.dealId)) errors.push(`Приёмка ${receiving.receivingId} не связана со сделкой.`);
  }
  for (const dispute of state.disputePacks) {
    if (!dealIds.has(dispute.dealId)) errors.push(`Спор ${dispute.disputeId} не связан со сделкой.`);
    if (!tripIds.has(dispute.tripId)) errors.push(`Спор ${dispute.disputeId} не связан с рейсом.`);
  }
  for (const quote of state.logisticsQuotes) {
    if (quote.status === 'accepted' && !quoteIds.has(quote.quoteId)) errors.push(`Принятое предложение ${quote.quoteId} потеряно.`);
  }
  return errors;
}

export const forbiddenExternalTerms = [
  'AI',
  'Control Tower',
  'callback',
  'callbacks',
  'evidence-first',
  'release',
  'hold',
  'owner',
  'blocker',
  'sandbox dispatch',
  'Action handoff',
  'domain-core',
  'runtime',
  'idempotency',
  'guard',
  'legacy',
  'mock',
  'debug',
  'test user',
] as const;

export function scanForbiddenExternalTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return forbiddenExternalTerms.filter(term => lower.includes(term.toLowerCase()));
}

export const driverForbiddenSurfaces = ['money', 'grainPrice', 'bank', 'investor', 'roleSwitcher', 'bids', 'moneyDispute'] as const;

export function driverFieldView(trip: Trip) {
  return {
    tripId: trip.tripId,
    status: trip.status,
    route: 'Тамбов → Воронеж',
    pickupPoint: 'Тамбовская область, склад № 4',
    deliveryPoint: 'Воронежская область, элеватор № 2',
    eta: '03.05.2026 09:00–18:00',
    dispatcherContact: '+7 916 277-89-89',
    documentPack: trip.documentPack,
    fieldActions: ['Я прибыл на погрузку', 'Подтвердить загрузку', 'Прикрепить фото', 'Подтвердить пломбу', 'Начать рейс', 'Я прибыл на выгрузку', 'Подтвердить вес', 'Сообщить об отклонении'],
  };
}
