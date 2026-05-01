import { runtimePersistencePassport } from '@/lib/platform-v7/runtime-persistence-passport';
import {
  acceptBid,
  acceptLogisticsQuoteCreateTrip,
  createLogisticsRequestFromDeal,
  executionContourFixtures,
  submitLogisticsQuote,
  type LogisticsQuote,
  type LogisticsRequest,
  type PlatformRole,
  type Trip,
} from '@/lib/platform-v7/execution-contour';

export type LogisticsRuntimeAction = 'send_request' | 'view_request' | 'submit_quote' | 'accept_quote' | 'reject_quote';

export type LogisticsRuntimeEvent = {
  readonly eventId: string;
  readonly at: string;
  readonly actorRole: PlatformRole;
  readonly action: LogisticsRuntimeAction;
  readonly title: string;
  readonly details: string;
  readonly objectId: string;
};

export type LogisticsRuntimeCommand = {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly action: LogisticsRuntimeAction;
  readonly status: 'SUCCEEDED' | 'FAILED';
  readonly error?: string;
  readonly result?: Record<string, unknown>;
  readonly createdAt: string;
};

type LogisticsState = {
  revision: number;
  request: LogisticsRequest;
  quotes: LogisticsQuote[];
  trip: Trip | null;
  commands: LogisticsRuntimeCommand[];
  events: LogisticsRuntimeEvent[];
};

type LogisticsInput = {
  readonly scopeId?: string;
  readonly idempotencyKey?: string;
  readonly action: LogisticsRuntimeAction;
  readonly actorRole?: PlatformRole;
  readonly requestId?: string;
  readonly quoteId?: string;
};

const accepted = acceptBid({ lot: executionContourFixtures.lots[0], bids: executionContourFixtures.bids, bidId: 'BID-7002' });
const baseRequest = createLogisticsRequestFromDeal(accepted.deal);
const holder = globalThis as typeof globalThis & { __pcLogisticsRuntime?: Map<string, LogisticsState> };

function map(): Map<string, LogisticsState> {
  if (!holder.__pcLogisticsRuntime) holder.__pcLogisticsRuntime = new Map();
  return holder.__pcLogisticsRuntime;
}

function cloneRequest(): LogisticsRequest {
  return {
    ...baseRequest,
    cargo: { ...baseRequest.cargo },
    vehicleRequirements: [...baseRequest.vehicleRequirements],
    documentsRequired: [...baseRequest.documentsRequired],
    sentTo: [...baseRequest.sentTo],
  };
}

function state(scopeId = 'default'): LogisticsState {
  const current = map().get(scopeId);
  if (current) return current;
  const next: LogisticsState = {
    revision: 1,
    request: cloneRequest(),
    quotes: [],
    trip: null,
    commands: [],
    events: [{ eventId: 'LOG-INIT', at: '2026-05-01T09:00:00.000Z', actorRole: 'operator', action: 'send_request', title: 'Заявка создана из сделки', details: `${baseRequest.requestId} связана со сделкой ${baseRequest.dealId}.`, objectId: baseRequest.requestId }],
  };
  map().set(scopeId, next);
  return next;
}

function money(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}

function makeCommand(action: LogisticsRuntimeAction, idempotencyKey: string, status: LogisticsRuntimeCommand['status'], result?: Record<string, unknown>, error?: string): LogisticsRuntimeCommand {
  return { commandId: `LCMD-${Date.now()}-${Math.floor(Math.random() * 10000)}`, idempotencyKey, action, status, result, error, createdAt: new Date().toISOString() };
}

function makeEvent(action: LogisticsRuntimeAction, actorRole: PlatformRole, title: string, details: string, objectId: string): LogisticsRuntimeEvent {
  return { eventId: `LEVT-${Date.now()}-${Math.floor(Math.random() * 10000)}`, at: new Date().toISOString(), actorRole, action, title, details, objectId };
}

function view(scopeId: string, stateValue: LogisticsState, actorRole: PlatformRole) {
  return { ok: true, scopeId, revision: stateValue.revision, request: stateValue.request, quotes: stateValue.quotes, trip: stateValue.trip, commands: stateValue.commands, events: stateValue.events, actorRole, persistence: runtimePersistencePassport };
}

export function getLogisticsRuntimeView(params?: { readonly scopeId?: string; readonly actorRole?: PlatformRole }) {
  const scopeId = params?.scopeId || 'default';
  return view(scopeId, state(scopeId), params?.actorRole || 'logistics');
}

export function applyLogisticsRuntimeCommand(input: LogisticsInput) {
  const scopeId = input.scopeId || 'default';
  const current = state(scopeId);
  const actorRole = input.actorRole || 'operator';
  const idempotencyKey = input.idempotencyKey || `${input.action}:${current.revision}`;
  const existing = current.commands.find((command) => command.idempotencyKey === idempotencyKey);
  if (existing) return { ...view(scopeId, current, actorRole), command: existing, event: current.events.find((event) => event.eventId.includes(existing.commandId)) || null, idempotent: true };

  try {
    if (input.requestId && input.requestId !== current.request.requestId) throw new Error('Логистическая заявка не найдена.');
    let title = 'Действие выполнено';
    let details = 'Команда логистики записана в журнал.';
    let objectId = current.request.requestId;
    let result: Record<string, unknown> = {};

    if (input.action === 'send_request') {
      if (current.request.status !== 'draft') throw new Error('Отправить можно только черновик заявки.');
      current.request = { ...current.request, status: 'sent' };
      title = 'Заявка отправлена перевозчику';
      details = 'Перевозчик получил груз, маршрут, окна, требования к ТС и список документов.';
      result = { requestId: current.request.requestId, status: current.request.status };
    }
    if (input.action === 'view_request') {
      if (!['draft', 'sent'].includes(current.request.status)) throw new Error('Просмотр можно отметить только до получения предложения.');
      current.request = { ...current.request, status: 'viewed' };
      title = 'Заявка просмотрена';
      details = 'Перевозчик открыл заявку и должен дать ответ в рамках SLA.';
      result = { requestId: current.request.requestId, status: current.request.status };
    }
    if (input.action === 'submit_quote') {
      if (current.trip) throw new Error('Предложение нельзя подать после создания рейса.');
      if (current.quotes.some((quote) => quote.status === 'submitted')) throw new Error('Уже есть активное предложение перевозчика.');
      const quote = submitLogisticsQuote({ requestId: current.request.requestId, carrierId: 'cp-carrier-1', rateType: 'per_ton', rate: 2400, vehicleType: 'зерновоз', vehicleNumber: 'А123ВС68', driverCandidate: 'driver-2041', etaPickup: '2026-05-02T08:00:00.000Z', etaDelivery: '2026-05-03T09:00:00.000Z', conditions: 'GPS, пломба, фото погрузки и ЭТрН обязательны.' });
      current.quotes = [quote, ...current.quotes];
      current.request = { ...current.request, status: 'quoted' };
      title = 'Перевозчик предложил условия';
      details = `Ставка перевозки ${money(quote.rate)}/т, ТС: ${quote.vehicleType}.`;
      objectId = quote.quoteId;
      result = { quoteId: quote.quoteId, rate: quote.rate };
    }
    if (input.action === 'accept_quote') {
      if (current.trip) throw new Error('Рейс уже создан.');
      const quote = current.quotes.find((item) => item.quoteId === input.quoteId || (!input.quoteId && item.status === 'submitted'));
      if (!quote || quote.status !== 'submitted') throw new Error('Выбрать можно только активное предложение.');
      const assigned = acceptLogisticsQuoteCreateTrip({ request: current.request, quote, driverId: 'driver-2041', vehicleId: 'truck-2041' });
      current.request = assigned.request;
      current.quotes = current.quotes.map((item) => item.quoteId === quote.quoteId ? assigned.quote : item);
      current.trip = assigned.trip;
      title = 'Предложение выбрано, рейс создан';
      details = `Создан рейс ${assigned.trip.tripId}. Назначены водитель и машина.`;
      objectId = assigned.trip.tripId;
      result = { tripId: assigned.trip.tripId, quoteId: quote.quoteId };
    }
    if (input.action === 'reject_quote') {
      const quote = current.quotes.find((item) => item.quoteId === input.quoteId || (!input.quoteId && item.status === 'submitted'));
      if (!quote || quote.status !== 'submitted') throw new Error('Отклонить можно только активное предложение.');
      current.quotes = current.quotes.map((item) => item.quoteId === quote.quoteId ? { ...item, status: 'rejected' } : item);
      current.request = { ...current.request, status: 'sent' };
      title = 'Предложение перевозчика отклонено';
      details = 'Причина: не подходит ставка или окно подачи. Можно запросить новое предложение.';
      objectId = quote.quoteId;
      result = { quoteId: quote.quoteId, status: 'rejected' };
    }

    current.revision += 1;
    const command = makeCommand(input.action, idempotencyKey, 'SUCCEEDED', result);
    const event = makeEvent(input.action, actorRole, title, details, objectId);
    current.commands = [command, ...current.commands].slice(0, 80);
    current.events = [event, ...current.events].slice(0, 40);
    return { ...view(scopeId, current, actorRole), command, event, idempotent: false };
  } catch (error) {
    current.revision += 1;
    const message = error instanceof Error ? error.message : 'Команда логистики не выполнена.';
    const command = makeCommand(input.action, idempotencyKey, 'FAILED', undefined, message);
    const event = makeEvent(input.action, actorRole, 'Действие остановлено', message, input.quoteId || input.requestId || current.request.requestId);
    current.commands = [command, ...current.commands].slice(0, 80);
    current.events = [event, ...current.events].slice(0, 40);
    return { ...view(scopeId, current, actorRole), ok: false, command, event, idempotent: false };
  }
}
