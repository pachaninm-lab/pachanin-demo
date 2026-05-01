import { runtimePersistencePassport } from '@/lib/platform-v7/runtime-persistence-passport';
import {
  acceptBid,
  calculateBidTotal,
  executionContourFixtures,
  getVisibleBidsForRole,
  rejectBid,
  submitBid,
  updateBid,
  withdrawBid,
  type Bid,
  type Deal,
  type Lot,
  type PlatformRole,
  type RejectionReason,
} from '@/lib/platform-v7/execution-contour';

export type BidRuntimeAction = 'accept_bid' | 'reject_bid' | 'clarify_bid' | 'improve_bid' | 'withdraw_bid' | 'submit_bid';

export type BidRuntimeCommand = {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly action: BidRuntimeAction;
  readonly status: 'SUCCEEDED' | 'FAILED';
  readonly payload: Record<string, unknown>;
  readonly result?: Record<string, unknown>;
  readonly error?: string;
  readonly createdAt: string;
};

export type BidRuntimeEvent = {
  readonly eventId: string;
  readonly commandId: string;
  readonly at: string;
  readonly actorRole: PlatformRole;
  readonly action: BidRuntimeAction;
  readonly title: string;
  readonly details: string;
  readonly objectType: 'bid' | 'lot' | 'deal';
  readonly objectId: string;
};

type BidRuntimeState = {
  readonly scopeId: string;
  revision: number;
  lots: Lot[];
  bids: Bid[];
  deals: Deal[];
  commands: BidRuntimeCommand[];
  events: BidRuntimeEvent[];
};

type CommandInput = {
  readonly scopeId?: string;
  readonly idempotencyKey?: string;
  readonly action: BidRuntimeAction;
  readonly actorRole?: PlatformRole;
  readonly lotId?: string;
  readonly bidId?: string;
  readonly viewerCounterpartyId?: string;
  readonly reason?: RejectionReason;
  readonly priceDelta?: number;
};

function cloneFixtures(): Pick<BidRuntimeState, 'lots' | 'bids' | 'deals' | 'commands' | 'events'> {
  return {
    lots: executionContourFixtures.lots.map((lot) => ({ ...lot })),
    bids: executionContourFixtures.bids.map((bid) => ({ ...bid, documentsRequired: [...bid.documentsRequired] })),
    deals: [],
    commands: [],
    events: [],
  };
}

const globalStore = globalThis as typeof globalThis & {
  __platformV7BidRuntimeStores?: Map<string, BidRuntimeState>;
};

function stores(): Map<string, BidRuntimeState> {
  if (!globalStore.__platformV7BidRuntimeStores) {
    globalStore.__platformV7BidRuntimeStores = new Map();
  }
  return globalStore.__platformV7BidRuntimeStores;
}

function stateFor(scopeId = 'default'): BidRuntimeState {
  const map = stores();
  const current = map.get(scopeId);
  if (current) return current;
  const state: BidRuntimeState = { scopeId, revision: 1, ...cloneFixtures() };
  map.set(scopeId, state);
  return state;
}

function money(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}

function commandId(action: string): string {
  return `CMD-${action}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function eventId(action: string): string {
  return `EVT-${action}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function findLot(state: BidRuntimeState, lotId?: string): Lot {
  const lot = state.lots.find((item) => item.lotId === (lotId || 'LOT-2403'));
  if (!lot) throw new Error('Лот не найден.');
  return lot;
}

function findBid(state: BidRuntimeState, bidId?: string): Bid {
  const bid = state.bids.find((item) => item.bidId === bidId);
  if (!bid) throw new Error('Ставка не найдена.');
  return bid;
}

function assertActiveBid(bid: Bid, actionTitle: string) {
  if (!['submitted', 'leading', 'outbid'].includes(bid.status)) {
    throw new Error(`${actionTitle} можно выполнить только по активной ставке.`);
  }
}

function assertBuyerOwnsBid(bid: Bid, viewerCounterpartyId?: string) {
  if (viewerCounterpartyId && bid.buyerId !== viewerCounterpartyId) {
    throw new Error('Покупатель может управлять только своей ставкой.');
  }
}

function appendEvent(state: BidRuntimeState, event: Omit<BidRuntimeEvent, 'eventId'>): BidRuntimeEvent {
  const next: BidRuntimeEvent = { eventId: eventId(event.action), ...event };
  state.events = [next, ...state.events].slice(0, 40);
  return next;
}

function saveCommand(state: BidRuntimeState, command: Omit<BidRuntimeCommand, 'commandId' | 'createdAt'> & { readonly commandId?: string; readonly createdAt?: string }): BidRuntimeCommand {
  const next: BidRuntimeCommand = {
    commandId: command.commandId || commandId(command.action),
    createdAt: command.createdAt || new Date().toISOString(),
    ...command,
  };
  state.commands = [next, ...state.commands].slice(0, 80);
  return next;
}

export function getBidRuntimeView(params?: { readonly scopeId?: string; readonly lotId?: string; readonly role?: PlatformRole; readonly viewerCounterpartyId?: string }) {
  const state = stateFor(params?.scopeId);
  const lot = findLot(state, params?.lotId);
  const role = params?.role || 'seller';
  const visibleBids = getVisibleBidsForRole({
    role,
    lot,
    bids: state.bids,
    viewerCounterpartyId: params?.viewerCounterpartyId,
    dealCreated: state.deals.some((deal) => deal.lotId === lot.lotId),
  });

  return {
    ok: true,
    scopeId: state.scopeId,
    revision: state.revision,
    lot,
    bids: visibleBids,
    deals: state.deals,
    events: state.events,
    commands: state.commands,
    persistence: runtimePersistencePassport,
  };
}

export function resetBidRuntimeScope(scopeId = 'default') {
  stores().delete(scopeId);
  return getBidRuntimeView({ scopeId });
}

export function applyBidRuntimeCommand(input: CommandInput) {
  const state = stateFor(input.scopeId);
  const idempotencyKey = input.idempotencyKey || `${input.action}:${input.lotId || 'LOT-2403'}:${input.bidId || 'new'}:${state.revision}`;
  const existing = state.commands.find((command) => command.idempotencyKey === idempotencyKey);
  if (existing) {
    return {
      ...getBidRuntimeView({ scopeId: state.scopeId, lotId: input.lotId, role: input.actorRole, viewerCounterpartyId: input.viewerCounterpartyId }),
      command: existing,
      event: state.events.find((event) => event.commandId === existing.commandId) || null,
      idempotent: true,
    };
  }

  const now = new Date().toISOString();
  const actorRole = input.actorRole || 'operator';
  const commandBase = {
    idempotencyKey,
    action: input.action,
    payload: { ...input },
    createdAt: now,
  };

  try {
    const lot = findLot(state, input.lotId);
    let objectId = input.bidId || lot.lotId;
    let title = 'Действие выполнено';
    let details = 'Команда обработана и записана в журнал.';
    let result: Record<string, unknown> = {};

    if (input.action === 'accept_bid') {
      const acceptedBid = findBid(state, input.bidId);
      assertActiveBid(acceptedBid, 'Принять ставку');
      const accepted = acceptBid({ lot, bids: state.bids, bidId: input.bidId || '', actorRole, acceptedAt: now });
      state.lots = state.lots.map((item) => item.lotId === lot.lotId ? accepted.lot : item);
      state.bids = accepted.bids;
      state.deals = state.deals.some((deal) => deal.dealId === accepted.deal.dealId) ? state.deals : [accepted.deal, ...state.deals];
      objectId = input.bidId || accepted.deal.acceptedBidId;
      title = 'Ставка принята';
      details = `Создана сделка ${accepted.deal.dealId}. Условия ставки заморожены.`;
      result = { dealId: accepted.deal.dealId, bidId: accepted.deal.acceptedBidId };
    }

    if (input.action === 'reject_bid') {
      const bid = findBid(state, input.bidId);
      assertActiveBid(bid, 'Отклонить ставку');
      const nextBid = rejectBid(bid, input.reason || 'Цена ниже ожидания', now);
      state.bids = state.bids.map((item) => item.bidId === nextBid.bidId ? nextBid : item);
      objectId = nextBid.bidId;
      title = 'Ставка отклонена';
      details = `${nextBid.buyerAlias || 'Покупатель'}: ${nextBid.rejectionReason}.`;
      result = { bidId: nextBid.bidId, status: nextBid.status };
    }

    if (input.action === 'clarify_bid') {
      const bid = findBid(state, input.bidId);
      assertActiveBid(bid, 'Запросить уточнение');
      objectId = bid.bidId;
      title = 'Запрошено уточнение';
      details = `${bid.buyerAlias || 'Покупатель'} должен подтвердить окно вывоза, документы и условия оплаты.`;
      result = { bidId: bid.bidId, status: bid.status };
    }

    if (input.action === 'improve_bid') {
      const bid = findBid(state, input.bidId);
      assertBuyerOwnsBid(bid, input.viewerCounterpartyId);
      const nextBid = updateBid(bid, { pricePerTon: bid.pricePerTon + (input.priceDelta || 100), comment: 'Цена повышена покупателем в пилотном интерфейсе.' }, now);
      state.bids = state.bids.map((item) => item.bidId === nextBid.bidId ? nextBid : item);
      objectId = nextBid.bidId;
      title = 'Ставка изменена';
      details = `Новая цена: ${money(nextBid.pricePerTon)}/т. Сумма пересчитана автоматически.`;
      result = { bidId: nextBid.bidId, pricePerTon: nextBid.pricePerTon, totalAmount: nextBid.totalAmount };
    }

    if (input.action === 'withdraw_bid') {
      const bid = findBid(state, input.bidId);
      assertBuyerOwnsBid(bid, input.viewerCounterpartyId);
      const nextBid = withdrawBid(bid, now);
      state.bids = state.bids.map((item) => item.bidId === nextBid.bidId ? nextBid : item);
      objectId = nextBid.bidId;
      title = 'Ставка отозвана';
      details = 'Покупатель убрал ставку из активного сравнения.';
      result = { bidId: nextBid.bidId, status: nextBid.status };
    }

    if (input.action === 'submit_bid') {
      const nextBid = submitBid({
        lotId: lot.lotId,
        buyerId: input.viewerCounterpartyId || 'cp-buyer-2',
        buyerAlias: actorRole === 'seller' ? 'Покупатель B' : undefined,
        pricePerTon: lot.targetPricePerTon,
        volumeTons: lot.volumeTons,
        paymentTerms: 'bank_reserve',
        logisticsOption: 'platform_logistics_required',
        pickupWindow: '02.05.2026 08:00–14:00',
        documentsRequired: ['СДИЗ', 'УПД', 'ЭТрН', 'путевой лист'],
        comment: 'Новая ставка из пилотного интерфейса.',
      }, now);
      const deterministicBid = {
        ...nextBid,
        bidId: `BID-${Math.abs(idempotencyKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0))}`,
        totalAmount: calculateBidTotal(nextBid.pricePerTon, nextBid.volumeTons),
      };
      state.bids = [deterministicBid, ...state.bids];
      objectId = deterministicBid.bidId;
      title = 'Ставка отправлена';
      details = `Создана новая ставка на ${money(deterministicBid.totalAmount)}.`;
      result = { bidId: deterministicBid.bidId, totalAmount: deterministicBid.totalAmount };
    }

    state.revision += 1;
    const command = saveCommand(state, { ...commandBase, status: 'SUCCEEDED', result });
    const event = appendEvent(state, {
      commandId: command.commandId,
      at: now,
      actorRole,
      action: input.action,
      title,
      details,
      objectType: input.action === 'accept_bid' ? 'deal' : 'bid',
      objectId,
    });

    return {
      ...getBidRuntimeView({ scopeId: state.scopeId, lotId: lot.lotId, role: actorRole, viewerCounterpartyId: input.viewerCounterpartyId }),
      command,
      event,
      idempotent: false,
    };
  } catch (error) {
    state.revision += 1;
    const command = saveCommand(state, {
      ...commandBase,
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Команда не выполнена.',
    });
    const event = appendEvent(state, {
      commandId: command.commandId,
      at: now,
      actorRole,
      action: input.action,
      title: 'Действие остановлено',
      details: command.error || 'Команда не выполнена.',
      objectType: 'bid',
      objectId: input.bidId || input.lotId || 'LOT-2403',
    });
    return {
      ...getBidRuntimeView({ scopeId: state.scopeId, lotId: input.lotId, role: actorRole, viewerCounterpartyId: input.viewerCounterpartyId }),
      ok: false,
      command,
      event,
      idempotent: false,
    };
  }
}
