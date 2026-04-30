import type {
  AuditEvent,
  Deal,
  DealTimelineEvent,
  Dispute,
  Document,
  DomainExecutionState,
  Evidence,
  LabProtocol,
  Lot,
  MoneyEvent,
  PlatformActionCommand,
  PlatformActionResult,
  TransportPack
} from './types';
import { transitionDeal } from './state-machine';

function cloneState(state: DomainExecutionState): DomainExecutionState {
  return JSON.parse(JSON.stringify(state)) as DomainExecutionState;
}

function createId(prefix: string, now: string, suffix?: string) {
  return `${prefix}-${now.replace(/[^0-9]/g, '').slice(0, 14)}${suffix ? `-${suffix}` : ''}`;
}

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required payload field: ${key}`);
  }
  return value;
}

function requireNumber(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Missing required numeric payload field: ${key}`);
  }
  return value;
}

function findDeal(state: DomainExecutionState, dealId: string): Deal {
  const deal = state.deals.find((item) => item.id === dealId);
  if (!deal) throw new Error(`Deal not found: ${dealId}`);
  return deal;
}

function replaceDeal(state: DomainExecutionState, deal: Deal) {
  state.deals = state.deals.map((item) => (item.id === deal.id ? deal : item));
}

function appendAuditAndTimeline(
  state: DomainExecutionState,
  command: PlatformActionCommand,
  entityType: AuditEvent['entityType'],
  entityId: string,
  before?: unknown,
  after?: unknown,
  dealId?: string
): { auditEvent: AuditEvent; timelineEvent?: DealTimelineEvent } {
  const now = command.now || new Date().toISOString();
  const runtimeLabel = command.runtimeLabel || 'sandbox';
  const auditEvent: AuditEvent = {
    id: createId('AE', now, String(state.auditEvents.length + 1).padStart(3, '0')),
    actionType: command.type,
    entityType,
    entityId,
    actorId: command.actor.id,
    actorRole: command.actor.role,
    before: before === undefined ? undefined : JSON.stringify(before),
    after: after === undefined ? undefined : JSON.stringify(after),
    idempotencyKey: command.idempotencyKey,
    createdAt: now,
    runtimeLabel
  };
  state.auditEvents.push(auditEvent);

  const timelineEvent = dealId
    ? {
        id: createId('TL', now, String(state.dealTimeline.length + 1).padStart(3, '0')),
        dealId,
        title: simulationActionMessages[command.type] || 'Simulation action completed',
        actionType: command.type,
        actorId: command.actor.id,
        actorRole: command.actor.role,
        createdAt: now,
        runtimeLabel
      }
    : undefined;

  if (timelineEvent) state.dealTimeline.push(timelineEvent);
  return { auditEvent, timelineEvent };
}

const simulationActionMessages: Record<string, string> = {
  createLot: 'Лот создан в sandbox-контуре',
  publishLot: 'Лот опубликован в sandbox-контуре',
  acceptOffer: 'Оффер акцептован в sandbox-контуре',
  createDeal: 'Сделка создана в sandbox-контуре',
  requestReserve: 'Запрошен резерв средств в sandbox-контуре',
  confirmReserve: 'Резерв средств подтверждён в sandbox-контуре',
  assignDriver: 'Водитель назначен в sandbox-контуре',
  confirmArrival: 'Прибытие подтверждено в sandbox-контуре',
  createLabProtocol: 'Лабораторный протокол создан в sandbox-контуре',
  openDispute: 'Спор открыт в sandbox-контуре'
};

export function getPlatformActionDisabledReason(state: DomainExecutionState, command: PlatformActionCommand): string | null {
  const role = command.actor.role;
  const allowed: Record<string, string[]> = {
    createLot: ['seller', 'operator', 'admin'],
    publishLot: ['seller', 'operator', 'admin'],
    acceptOffer: ['buyer', 'operator', 'admin'],
    createDeal: ['seller', 'buyer', 'operator', 'admin'],
    requestReserve: ['buyer', 'bank', 'operator', 'admin'],
    confirmReserve: ['bank', 'operator', 'admin'],
    assignDriver: ['logistics', 'operator', 'admin'],
    confirmArrival: ['driver', 'elevator', 'operator', 'admin'],
    createLabProtocol: ['lab', 'operator', 'admin'],
    openDispute: ['seller', 'buyer', 'operator', 'arbitrator', 'admin']
  };

  if (!allowed[command.type]?.includes(role)) return `Роль ${role} не может выполнить ${command.type}`;
  if ((command.type === 'requestReserve' || command.type === 'confirmReserve') && !command.idempotencyKey) return 'Банковое действие требует idempotencyKey';
  if (command.type !== 'createLot' && command.type !== 'publishLot' && command.type !== 'acceptOffer') {
    const dealId = String(command.payload.dealId || '');
    if (dealId && !state.deals.some((deal) => deal.id === dealId)) return `Сделка не найдена: ${dealId}`;
  }
  return null;
}

function createLot(state: DomainExecutionState, command: PlatformActionCommand): { entityId: string; dealId?: string; before?: unknown; after?: unknown } {
  const now = command.now || new Date().toISOString();
  const payload = command.payload as Record<string, unknown>;
  const lot: Lot = {
    id: String(payload.lotId || createId('LOT', now)),
    sellerId: String(payload.sellerId || command.actor.counterpartyId || 'CP-S-001'),
    crop: (payload.crop as Lot['crop']) || 'wheat',
    volumeTonnes: requireNumber(payload, 'volumeTonnes'),
    pricePerTonneRub: requireNumber(payload, 'pricePerTonneRub'),
    basis: String(payload.basis || 'EXW Тамбовская область'),
    qualityClass: String(payload.qualityClass || '3 класс'),
    status: 'draft',
    createdAt: now,
    runtimeLabel: command.runtimeLabel || 'sandbox'
  };
  state.lots.push(lot);
  return { entityId: lot.id, after: lot };
}

function publishLot(state: DomainExecutionState, command: PlatformActionCommand): { entityId: string; before?: unknown; after?: unknown } {
  const lotId = requireString(command.payload, 'lotId');
  const lot = state.lots.find((item) => item.id === lotId);
  if (!lot) throw new Error(`Lot not found: ${lotId}`);
  const before = { ...lot };
  lot.status = 'published';
  return { entityId: lot.id, before, after: lot };
}

function acceptOffer(state: DomainExecutionState, command: PlatformActionCommand): { entityId: string; before?: unknown; after?: unknown } {
  const lotId = requireString(command.payload, 'lotId');
  const lot = state.lots.find((item) => item.id === lotId);
  if (!lot) throw new Error(`Lot not found: ${lotId}`);
  const before = { ...lot };
  lot.status = 'offer_accepted';
  return { entityId: lot.id, before, after: lot };
}

function createDeal(state: DomainExecutionState, command: PlatformActionCommand): { entityId: string; dealId: string; before?: unknown; after?: unknown } {
  const now = command.now || new Date().toISOString();
  const payload = command.payload as Record<string, unknown>;
  const lotId = requireString(payload, 'lotId');
  const lot = state.lots.find((item) => item.id === lotId);
  if (!lot) throw new Error(`Lot not found: ${lotId}`);

  const deal: Deal = {
    id: String(payload.dealId || createId('DL', now)),
    lotId,
    sellerId: lot.sellerId,
    buyerId: String(payload.buyerId || command.actor.counterpartyId || 'CP-B-001'),
    status: 'DEAL_CREATED',
    volumeTonnes: lot.volumeTonnes,
    pricePerTonneRub: lot.pricePerTonneRub,
    currency: 'RUB',
    reserveConfirmed: false,
    requiredDocumentsReady: false,
    weightConfirmed: false,
    isDegraded: false,
    ownerRole: 'operator',
    runtimeLabel: command.runtimeLabel || 'sandbox',
    updatedAt: now
  };
  state.deals.push(deal);
  lot.status = 'deal_created';
  return { entityId: deal.id, dealId: deal.id, after: deal };
}

function requestReserve(state: DomainExecutionState, command: PlatformActionCommand): { entityId: string; dealId: string; before?: unknown; after?: unknown } {
  const now = command.now || new Date().toISOString();
  const deal = findDeal(state, requireString(command.payload, 'dealId'));
  const before = { ...deal };
  const transition = transitionDeal(state, deal, deal.status === 'SIGNED' ? 'RESERVE_REQUESTED' : 'PAYMENT_RELEASE_REQUESTED', command);
  if (!transition.ok || !transition.deal) throw new Error(transition.error?.message || 'Reserve request blocked');
  replaceDeal(state, transition.deal);
  const event: MoneyEvent = {
    id: createId('ME', now, String(state.moneyEvents.length + 1)),
    dealId: deal.id,
    type: 'reserve_requested',
    amountRub: deal.volumeTonnes * deal.pricePerTonneRub,
    status: 'pending',
    idempotencyKey: command.idempotencyKey,
    createdAt: now,
    runtimeLabel: command.runtimeLabel || 'sandbox'
  };
  state.moneyEvents.push(event);
  return { entityId: deal.id, dealId: deal.id, before, after: transition.deal };
}

function confirmReserve(state: DomainExecutionState, command: PlatformActionCommand): { entityId: string; dealId: string; before?: unknown; after?: unknown } {
  const now = command.now || new Date().toISOString();
  const deal = findDeal(state, requireString(command.payload, 'dealId'));
  const before = { ...deal };
  const to = deal.status === 'RESERVE_REQUESTED' ? 'RESERVE_CONFIRMED' : deal.status === 'PAYMENT_RELEASE_REQUESTED' ? 'FINAL_RELEASED' : deal.status === 'FINAL_RELEASED' ? 'CLOSED' : 'RESERVE_CONFIRMED';
  const transition = transitionDeal(state, { ...deal, reserveConfirmed: to === 'RESERVE_CONFIRMED' ? true : deal.reserveConfirmed }, to, command);
  if (!transition.ok || !transition.deal) throw new Error(transition.error?.message || 'Reserve confirmation blocked');
  const updated: Deal = { ...transition.deal, reserveConfirmed: true, ownerRole: to === 'RESERVE_CONFIRMED' ? 'logistics' : transition.deal.ownerRole };
  replaceDeal(state, updated);
  state.moneyEvents.push({
    id: createId('ME', now, String(state.moneyEvents.length + 1)),
    dealId: deal.id,
    type: to === 'RESERVE_CONFIRMED' ? 'reserve_confirmed' : 'final_release',
    amountRub: deal.volumeTonnes * deal.pricePerTonneRub,
    status: 'confirmed',
    idempotencyKey: command.idempotencyKey,
    bankEventId: `SBER-SANDBOX-${command.idempotencyKey}`,
    createdAt: now,
    runtimeLabel: command.runtimeLabel || 'sandbox'
  });
  return { entityId: deal.id, dealId: deal.id, before, after: updated };
}

function assignDriver(state: DomainExecutionState, command: PlatformActionCommand): { entityId: string; dealId: string; before?: unknown; after?: unknown } {
  const now = command.now || new Date().toISOString();
  const deal = findDeal(state, requireString(command.payload, 'dealId'));
  const before = { ...deal };
  const transition = transitionDeal(state, deal, 'DRIVER_ASSIGNED', command);
  if (!transition.ok || !transition.deal) throw new Error(transition.error?.message || 'Driver assignment blocked');
  const updated = { ...transition.deal, driverId: String(command.payload.driverId || 'U-DRIVER-1'), ownerRole: 'driver' as const };
  replaceDeal(state, updated);
  const pack: TransportPack = {
    id: createId('TP', now, deal.id),
    dealId: deal.id,
    carrierId: String(command.payload.carrierId || 'CP-C-001'),
    driverId: updated.driverId,
    vehicleNumber: String(command.payload.vehicleNumber || 'А777ВС68'),
    routeId: String(command.payload.routeId || `R-${deal.id}`),
    status: 'assigned',
    etaAt: command.payload.etaAt ? String(command.payload.etaAt) : undefined,
    runtimeLabel: command.runtimeLabel || 'sandbox'
  };
  state.transportPacks.push(pack);
  return { entityId: deal.id, dealId: deal.id, before, after: updated };
}

function confirmArrival(state: DomainExecutionState, command: PlatformActionCommand): { entityId: string; dealId: string; before?: unknown; after?: unknown } {
  const deal = findDeal(state, requireString(command.payload, 'dealId'));
  const before = { ...deal };
  const target = deal.status === 'DRIVER_ASSIGNED' ? 'LOADING_CONFIRMED' : deal.status === 'LOADING_CONFIRMED' ? 'LOADED' : deal.status === 'LOADED' ? 'IN_TRANSIT' : deal.status === 'IN_TRANSIT' ? 'ARRIVED' : 'WEIGHING_CONFIRMED';
  const transition = transitionDeal(state, deal, target, command);
  if (!transition.ok || !transition.deal) throw new Error(transition.error?.message || 'Arrival confirmation blocked');
  const updated = { ...transition.deal, weightConfirmed: ['ARRIVED', 'WEIGHING_CONFIRMED'].includes(target) || transition.deal.weightConfirmed, ownerRole: target === 'WEIGHING_CONFIRMED' ? 'lab' as const : transition.deal.ownerRole };
  replaceDeal(state, updated);
  const evidence: Evidence = {
    id: createId('EV', command.now || new Date().toISOString(), String(state.evidence.length + 1)),
    dealId: deal.id,
    type: target === 'ARRIVED' ? 'arrival' : 'gps',
    title: `Sandbox ${target.toLowerCase()} evidence`,
    hash: `sha256-${deal.id}-${target}-${state.evidence.length + 1}`,
    capturedAt: command.now || new Date().toISOString(),
    actorId: command.actor.id,
    runtimeLabel: command.runtimeLabel || 'sandbox'
  };
  state.evidence.push(evidence);
  return { entityId: deal.id, dealId: deal.id, before, after: updated };
}

function createLabProtocol(state: DomainExecutionState, command: PlatformActionCommand): { entityId: string; dealId: string; before?: unknown; after?: unknown } {
  const now = command.now || new Date().toISOString();
  const deal = findDeal(state, requireString(command.payload, 'dealId'));
  const before = { ...deal };
  const target = deal.status === 'WEIGHING_CONFIRMED' ? 'LAB_SAMPLING' : deal.status === 'LAB_SAMPLING' ? 'LAB_PROTOCOL_CREATED' : deal.status === 'LAB_PROTOCOL_CREATED' ? 'ACCEPTED' : deal.status === 'ACCEPTED' ? 'DOCUMENTS_PENDING' : 'DOCUMENTS_READY';
  const protocolId = String(command.payload.protocolId || createId('LAB', now, deal.id));
  const enrichedDeal = target === 'ACCEPTED' ? { ...deal, labProtocolId: deal.labProtocolId || protocolId, weightConfirmed: true } : deal;
  const transition = transitionDeal(state, enrichedDeal, target, command);
  if (!transition.ok || !transition.deal) throw new Error(transition.error?.message || 'Lab protocol action blocked');

  if (!state.labProtocols.some((protocol) => protocol.id === protocolId)) {
    const protocol: LabProtocol = {
      id: protocolId,
      dealId: deal.id,
      labId: String(command.actor.counterpartyId || 'CP-L-001'),
      humidityPct: Number(command.payload.humidityPct || 12.5),
      glutenPct: Number(command.payload.glutenPct || 24.2),
      proteinPct: Number(command.payload.proteinPct || 11.8),
      natureGramPerLiter: Number(command.payload.natureGramPerLiter || 750),
      status: 'issued',
      createdAt: now,
      runtimeLabel: command.runtimeLabel || 'sandbox'
    };
    state.labProtocols.push(protocol);
  }

  const updated = { ...transition.deal, labProtocolId: protocolId, requiredDocumentsReady: target === 'DOCUMENTS_READY' || transition.deal.requiredDocumentsReady, ownerRole: target === 'DOCUMENTS_READY' ? 'bank' as const : transition.deal.ownerRole };
  replaceDeal(state, updated);
  if (target === 'DOCUMENTS_READY') {
    const doc: Document = {
      id: createId('DOC', now, deal.id),
      dealId: deal.id,
      type: 'lab_protocol',
      status: 'signed',
      version: 1,
      hash: `sha256-lab-doc-${deal.id}`,
      signerIds: [command.actor.id],
      createdAt: now,
      runtimeLabel: command.runtimeLabel || 'sandbox'
    };
    state.documents.push(doc);
  }
  return { entityId: deal.id, dealId: deal.id, before, after: updated };
}

function openDispute(state: DomainExecutionState, command: PlatformActionCommand): { entityId: string; dealId: string; before?: unknown; after?: unknown } {
  const now = command.now || new Date().toISOString();
  const deal = findDeal(state, requireString(command.payload, 'dealId'));
  const before = { ...deal };
  const transition = transitionDeal(state, deal, 'DISPUTE_OPEN', command);
  if (!transition.ok || !transition.deal) throw new Error(transition.error?.message || 'Dispute opening blocked');
  const dispute: Dispute = {
    id: String(command.payload.disputeId || createId('DK', now, deal.id)),
    dealId: deal.id,
    openedBy: command.actor.id,
    reason: (command.payload.reason as Dispute['reason']) || 'other',
    amountImpactRub: Number(command.payload.amountImpactRub || 0),
    status: 'open',
    evidenceIds: Array.isArray(command.payload.evidenceIds) ? command.payload.evidenceIds.map(String) : [],
    createdAt: now,
    runtimeLabel: command.runtimeLabel || 'sandbox'
  };
  state.disputes.push(dispute);
  const updated = { ...transition.deal, openDisputeId: dispute.id, blocker: 'Открыт спор: финальный выпуск средств заблокирован', ownerRole: 'arbitrator' as const };
  replaceDeal(state, updated);
  return { entityId: dispute.id, dealId: deal.id, before, after: dispute };
}

const actionHandlers = {
  createLot,
  publishLot,
  acceptOffer,
  createDeal,
  requestReserve,
  confirmReserve,
  assignDriver,
  confirmArrival,
  createLabProtocol,
  openDispute
};

export function runPlatformAction(state: DomainExecutionState, command: PlatformActionCommand): PlatformActionResult {
  const disabledReason = getPlatformActionDisabledReason(state, command);
  if (disabledReason) {
    return {
      ok: false,
      state,
      disabledReason,
      toast: { type: 'disabled', message: disabledReason }
    };
  }

  const beforeState = cloneState(state);
  const nextState = cloneState(state);

  try {
    const handler = actionHandlers[command.type];
    const outcome = handler(nextState, command);
    const { auditEvent, timelineEvent } = appendAuditAndTimeline(nextState, command, command.type === 'createLot' || command.type === 'publishLot' || command.type === 'acceptOffer' ? 'lot' : command.type === 'openDispute' ? 'dispute' : command.type === 'createLabProtocol' ? 'lab' : command.type === 'assignDriver' || command.type === 'confirmArrival' ? 'transport' : 'deal', outcome.entityId, outcome.before, outcome.after, outcome.dealId);
    return {
      ok: true,
      state: nextState,
      toast: { type: 'success', message: simulationActionMessages[command.type] },
      auditEvent,
      timelineEvent
    };
  } catch (error) {
    return {
      ok: false,
      state: beforeState,
      toast: { type: 'error', message: error instanceof Error ? error.message : 'Simulation action failed' },
      error: error instanceof Error ? error.message : 'Simulation action failed'
    };
  }
}

export function usePlatformAction(state: DomainExecutionState) {
  return (command: PlatformActionCommand) => runPlatformAction(state, command);
}
