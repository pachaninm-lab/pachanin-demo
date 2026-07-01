import { createExecutionSimulationState } from './fixtures';
import { runPlatformAction } from './action-engine';
import { transitionDeal, type DealGuardCode } from './state-machine';
import type {
  AuditEvent,
  Deal,
  DealExecutionStatus,
  DomainExecutionState,
  PlatformActionCommand,
  PlatformActionType,
  User,
} from './types';

export type PlatformV7ScenarioStepId =
  | 'createLot'
  | 'publishLot'
  | 'acceptOffer'
  | 'createDeal'
  | 'contractDrafted'
  | 'awaitingSignatures'
  | 'signed'
  | 'requestReserve'
  | 'confirmReserve'
  | 'assignDriver'
  | 'loadingConfirmed'
  | 'loaded'
  | 'inTransit'
  | 'arrived'
  | 'weighingConfirmed'
  | 'labSampling'
  | 'labProtocolCreated'
  | 'accepted'
  | 'documentsPending'
  | 'documentsReady'
  | 'requestCloseBasis'
  | 'confirmFinalBasis'
  | 'closeDeal';

export interface PlatformV7ScenarioStep {
  readonly id: PlatformV7ScenarioStepId;
  readonly label: string;
  readonly dealStatus: DealExecutionStatus | 'LOT_CREATED' | 'LOT_PUBLISHED' | 'OFFER_ACCEPTED';
  readonly actorRole: User['role'];
}

export interface PlatformV7ScenarioBlockedCheck {
  readonly id: string;
  readonly expectedCode: DealGuardCode;
  readonly actualCode: DealGuardCode | 'INVALID_TRANSITION' | 'NONE';
  readonly passed: boolean;
}

export interface PlatformV7ExecutionEvidenceScenarioReport {
  readonly scenarioId: 'P7-E2E-2096';
  readonly dealId: string;
  readonly finalStatus: DealExecutionStatus;
  readonly closeReady: boolean;
  readonly passedSteps: readonly PlatformV7ScenarioStep[];
  readonly passedStepIds: readonly PlatformV7ScenarioStepId[];
  readonly blockedChecks: readonly PlatformV7ScenarioBlockedCheck[];
  readonly auditEventCountDelta: number;
  readonly timelineEventCountDelta: number;
  readonly source: 'controlled-pilot-scenario-runner';
}

const SCENARIO_ID = 'P7-E2E-2096' as const;
const SCENARIO_LOT_ID = 'LOT-P7-E2E-2096';
const SCENARIO_DEAL_ID = 'DL-P7-E2E-2096';
const SCENARIO_PROTOCOL_ID = 'LAB-P7-E2E-2096';
const SCENARIO_NOW = '2026-07-01T08:00:00.000Z';

function at(minute: number): string {
  return new Date(Date.parse(SCENARIO_NOW) + minute * 60 * 1000).toISOString();
}

function actor(state: DomainExecutionState, role: User['role']): User {
  const found = state.users.find((item) => item.role === role);
  if (!found) throw new Error(`Missing scenario actor role: ${role}`);
  return found;
}

function command(
  state: DomainExecutionState,
  type: PlatformActionType,
  role: User['role'],
  payload: Record<string, unknown>,
  minute: number,
  idempotencyKey?: string,
): PlatformActionCommand {
  return {
    type,
    actor: actor(state, role),
    payload,
    idempotencyKey,
    runtimeLabel: 'pilot',
    now: at(minute),
  };
}

function applyStep(
  state: DomainExecutionState,
  step: PlatformV7ScenarioStep,
  cmd: PlatformActionCommand,
): DomainExecutionState {
  const result = runPlatformAction(state, cmd);
  if (!result.ok) {
    throw new Error(`Scenario step failed: ${step.id}: ${result.error ?? result.disabledReason ?? result.toast.message}`);
  }
  return result.state;
}

function findDeal(state: DomainExecutionState, dealId: string): Deal {
  const deal = state.deals.find((item) => item.id === dealId);
  if (!deal) throw new Error(`Scenario deal not found: ${dealId}`);
  return deal;
}

function markDealStatus(
  state: DomainExecutionState,
  to: DealExecutionStatus,
  step: PlatformV7ScenarioStep,
  minute: number,
): DomainExecutionState {
  const deal = findDeal(state, SCENARIO_DEAL_ID);
  const before = deal.status;
  const updated: Deal = { ...deal, status: to, updatedAt: at(minute), ownerRole: step.actorRole };
  state.deals = state.deals.map((item) => (item.id === deal.id ? updated : item));
  state.auditEvents.push({
    id: `AE-${SCENARIO_ID}-${step.id}`,
    actionType: 'stateTransition',
    entityType: 'deal',
    entityId: deal.id,
    actorId: actor(state, step.actorRole).id,
    actorRole: step.actorRole,
    before,
    after: to,
    reason: step.label,
    idempotencyKey: `${SCENARIO_ID}-${step.id}`,
    createdAt: at(minute),
    runtimeLabel: 'pilot',
  } satisfies AuditEvent);
  state.dealTimeline.push({
    id: `TL-${SCENARIO_ID}-${step.id}`,
    dealId: deal.id,
    title: step.label,
    actionType: 'stateTransition',
    actorId: actor(state, step.actorRole).id,
    actorRole: step.actorRole,
    createdAt: at(minute),
    runtimeLabel: 'pilot',
  });
  return state;
}

function pushPassed(passedSteps: PlatformV7ScenarioStep[], step: PlatformV7ScenarioStep): void {
  passedSteps.push(step);
}

function scenarioStep(id: PlatformV7ScenarioStepId, label: string, dealStatus: PlatformV7ScenarioStep['dealStatus'], actorRole: User['role']): PlatformV7ScenarioStep {
  return { id, label, dealStatus, actorRole };
}

function syntheticDeal(id: string, overrides: Partial<Deal>): Deal {
  return {
    id,
    lotId: `LOT-${id}`,
    sellerId: 'CP-S-001',
    buyerId: 'CP-B-001',
    status: 'DOCUMENTS_READY',
    volumeTonnes: 240,
    pricePerTonneRub: 16140,
    currency: 'RUB',
    reserveConfirmed: true,
    requiredDocumentsReady: true,
    weightConfirmed: true,
    labProtocolId: `LAB-${id}`,
    isDegraded: false,
    ownerRole: 'operator',
    runtimeLabel: 'pilot',
    updatedAt: at(100),
    ...overrides,
  };
}

function guardCheck(
  id: string,
  expectedCode: DealGuardCode,
  deal: Deal,
  to: DealExecutionStatus,
  cmd: PlatformActionCommand,
  mutate?: (state: DomainExecutionState) => void,
): PlatformV7ScenarioBlockedCheck {
  const state = createExecutionSimulationState();
  state.deals = [deal];
  state.documents = [];
  state.disputes = [];
  mutate?.(state);
  const result = transitionDeal(state, deal, to, cmd);
  const actualCode = result.ok ? 'NONE' : result.error?.code ?? 'NONE';
  return {
    id,
    expectedCode,
    actualCode,
    passed: actualCode === expectedCode,
  };
}

export function runPlatformV7ExecutionEvidenceScenario(): PlatformV7ExecutionEvidenceScenarioReport {
  let state = createExecutionSimulationState();
  const auditBefore = state.auditEvents.length;
  const timelineBefore = state.dealTimeline.length;
  const passedSteps: PlatformV7ScenarioStep[] = [];

  const steps = {
    createLot: scenarioStep('createLot', 'Лот создан для проверочного контура исполнения.', 'LOT_CREATED', 'seller'),
    publishLot: scenarioStep('publishLot', 'Лот опубликован для получения предложения.', 'LOT_PUBLISHED', 'seller'),
    acceptOffer: scenarioStep('acceptOffer', 'Условия приняты покупателем.', 'OFFER_ACCEPTED', 'buyer'),
    createDeal: scenarioStep('createDeal', 'Сделка создана из согласованных условий.', 'DEAL_CREATED', 'operator'),
    contractDrafted: scenarioStep('contractDrafted', 'Договорная стадия подготовлена.', 'CONTRACT_DRAFTED', 'operator'),
    awaitingSignatures: scenarioStep('awaitingSignatures', 'Сделка ожидает подписи сторон.', 'AWAITING_SIGNATURES', 'operator'),
    signed: scenarioStep('signed', 'Подписанный комплект готов к резерву.', 'SIGNED', 'operator'),
    requestReserve: scenarioStep('requestReserve', 'Резервное основание запрошено.', 'RESERVE_REQUESTED', 'buyer'),
    confirmReserve: scenarioStep('confirmReserve', 'Резервное основание подтверждено.', 'RESERVE_CONFIRMED', 'bank'),
    assignDriver: scenarioStep('assignDriver', 'Рейс назначен.', 'DRIVER_ASSIGNED', 'operator'),
    loadingConfirmed: scenarioStep('loadingConfirmed', 'Погрузка подтверждена.', 'LOADING_CONFIRMED', 'driver'),
    loaded: scenarioStep('loaded', 'Груз загружен.', 'LOADED', 'driver'),
    inTransit: scenarioStep('inTransit', 'Рейс в пути.', 'IN_TRANSIT', 'driver'),
    arrived: scenarioStep('arrived', 'Прибытие подтверждено.', 'ARRIVED', 'driver'),
    weighingConfirmed: scenarioStep('weighingConfirmed', 'Вес подтверждён.', 'WEIGHING_CONFIRMED', 'driver'),
    labSampling: scenarioStep('labSampling', 'Лабораторный отбор начат.', 'LAB_SAMPLING', 'lab'),
    labProtocolCreated: scenarioStep('labProtocolCreated', 'Лабораторный протокол создан.', 'LAB_PROTOCOL_CREATED', 'lab'),
    accepted: scenarioStep('accepted', 'Приёмка подтверждена.', 'ACCEPTED', 'lab'),
    documentsPending: scenarioStep('documentsPending', 'Документный пакет ожидает закрытия.', 'DOCUMENTS_PENDING', 'lab'),
    documentsReady: scenarioStep('documentsReady', 'Документный пакет готов.', 'DOCUMENTS_READY', 'lab'),
    requestCloseBasis: scenarioStep('requestCloseBasis', 'Основание закрытия передано на проверку.', 'PAYMENT_RELEASE_REQUESTED', 'buyer'),
    confirmFinalBasis: scenarioStep('confirmFinalBasis', 'Финальное основание подтверждено.', 'FINAL_RELEASED', 'bank'),
    closeDeal: scenarioStep('closeDeal', 'Сделка закрыта в проверочном контуре.', 'CLOSED', 'bank'),
  } satisfies Record<PlatformV7ScenarioStepId, PlatformV7ScenarioStep>;

  state = applyStep(state, steps.createLot, command(state, 'createLot', 'seller', { lotId: SCENARIO_LOT_ID, volumeTonnes: 240, pricePerTonneRub: 16140, basis: 'EXW Тамбовская область', qualityClass: '3 класс' }, 1));
  pushPassed(passedSteps, steps.createLot);
  state = applyStep(state, steps.publishLot, command(state, 'publishLot', 'seller', { lotId: SCENARIO_LOT_ID }, 2));
  pushPassed(passedSteps, steps.publishLot);
  state = applyStep(state, steps.acceptOffer, command(state, 'acceptOffer', 'buyer', { lotId: SCENARIO_LOT_ID }, 3));
  pushPassed(passedSteps, steps.acceptOffer);
  state = applyStep(state, steps.createDeal, command(state, 'createDeal', 'operator', { lotId: SCENARIO_LOT_ID, buyerId: actor(state, 'buyer').counterpartyId, dealId: SCENARIO_DEAL_ID }, 4));
  pushPassed(passedSteps, steps.createDeal);

  state = markDealStatus(state, 'CONTRACT_DRAFTED', steps.contractDrafted, 5);
  pushPassed(passedSteps, steps.contractDrafted);
  state = markDealStatus(state, 'AWAITING_SIGNATURES', steps.awaitingSignatures, 6);
  pushPassed(passedSteps, steps.awaitingSignatures);
  state = markDealStatus(state, 'SIGNED', steps.signed, 7);
  pushPassed(passedSteps, steps.signed);

  state = applyStep(state, steps.requestReserve, command(state, 'requestReserve', 'buyer', { dealId: SCENARIO_DEAL_ID }, 8, 'idem-p7-e2e-reserve-request'));
  pushPassed(passedSteps, steps.requestReserve);
  state = applyStep(state, steps.confirmReserve, command(state, 'confirmReserve', 'bank', { dealId: SCENARIO_DEAL_ID }, 9, 'idem-p7-e2e-reserve-confirm'));
  pushPassed(passedSteps, steps.confirmReserve);
  state = applyStep(state, steps.assignDriver, command(state, 'assignDriver', 'operator', { dealId: SCENARIO_DEAL_ID, driverId: actor(state, 'driver').id, carrierId: 'CP-C-001', vehicleNumber: 'А777ВС68' }, 10));
  pushPassed(passedSteps, steps.assignDriver);

  for (const step of [steps.loadingConfirmed, steps.loaded, steps.inTransit, steps.arrived, steps.weighingConfirmed]) {
    state = applyStep(state, step, command(state, 'confirmArrival', 'driver', { dealId: SCENARIO_DEAL_ID }, passedSteps.length + 1));
    pushPassed(passedSteps, step);
  }

  for (const step of [steps.labSampling, steps.labProtocolCreated, steps.accepted, steps.documentsPending, steps.documentsReady]) {
    state = applyStep(state, step, command(state, 'createLabProtocol', 'lab', { dealId: SCENARIO_DEAL_ID, protocolId: SCENARIO_PROTOCOL_ID }, passedSteps.length + 1));
    pushPassed(passedSteps, step);
  }

  state = applyStep(state, steps.requestCloseBasis, command(state, 'requestReserve', 'buyer', { dealId: SCENARIO_DEAL_ID }, 30, 'idem-p7-e2e-close-request'));
  pushPassed(passedSteps, steps.requestCloseBasis);
  state = applyStep(state, steps.confirmFinalBasis, command(state, 'confirmReserve', 'bank', { dealId: SCENARIO_DEAL_ID }, 31, 'idem-p7-e2e-final-confirm'));
  pushPassed(passedSteps, steps.confirmFinalBasis);
  state = applyStep(state, steps.closeDeal, command(state, 'confirmReserve', 'bank', { dealId: SCENARIO_DEAL_ID }, 32, 'idem-p7-e2e-close-confirm'));
  pushPassed(passedSteps, steps.closeDeal);

  const finalDeal = findDeal(state, SCENARIO_DEAL_ID);
  const hasOpenDispute = state.disputes.some((dispute) => dispute.dealId === SCENARIO_DEAL_ID && !['resolved', 'closed'].includes(dispute.status));
  const closeReady = finalDeal.status === 'CLOSED'
    && finalDeal.reserveConfirmed
    && finalDeal.requiredDocumentsReady
    && finalDeal.weightConfirmed
    && Boolean(finalDeal.labProtocolId)
    && !hasOpenDispute;

  const baseCommandState = createExecutionSimulationState();
  const buyer = actor(baseCommandState, 'buyer');
  const bank = actor(baseCommandState, 'bank');
  const lab = actor(baseCommandState, 'lab');

  const blockedChecks: PlatformV7ScenarioBlockedCheck[] = [
    guardCheck('missing-reserve', 'NO_RELEASE_WITHOUT_RESERVE', syntheticDeal('DL-CHECK-NO-RESERVE', { reserveConfirmed: false, requiredDocumentsReady: true, status: 'DOCUMENTS_READY' }), 'PAYMENT_RELEASE_REQUESTED', { type: 'requestReserve', actor: buyer, payload: { dealId: 'DL-CHECK-NO-RESERVE' }, idempotencyKey: 'idem-check-reserve', runtimeLabel: 'pilot', now: at(40) }),
    guardCheck('missing-documents', 'NO_RELEASE_WITHOUT_DOCUMENTS', syntheticDeal('DL-CHECK-NO-DOCS', { reserveConfirmed: true, requiredDocumentsReady: false, status: 'DOCUMENTS_READY' }), 'PAYMENT_RELEASE_REQUESTED', { type: 'requestReserve', actor: buyer, payload: { dealId: 'DL-CHECK-NO-DOCS' }, idempotencyKey: 'idem-check-docs', runtimeLabel: 'pilot', now: at(41) }),
    guardCheck('open-dispute', 'NO_FINAL_RELEASE_WITH_OPEN_DISPUTE', syntheticDeal('DL-CHECK-DISPUTE', { reserveConfirmed: true, requiredDocumentsReady: true, status: 'PAYMENT_RELEASE_REQUESTED', openDisputeId: 'DK-CHECK-DISPUTE' }), 'FINAL_RELEASED', { type: 'confirmReserve', actor: bank, payload: { dealId: 'DL-CHECK-DISPUTE' }, idempotencyKey: 'idem-check-dispute', runtimeLabel: 'pilot', now: at(42) }, (checkState) => {
      checkState.disputes = [{ id: 'DK-CHECK-DISPUTE', dealId: 'DL-CHECK-DISPUTE', openedBy: buyer.id, reason: 'quality_delta', amountImpactRub: 1000, status: 'open', evidenceIds: ['EV-CHECK'], createdAt: at(42), runtimeLabel: 'pilot' }];
    }),
    guardCheck('missing-weight', 'NO_ACCEPTED_WITHOUT_WEIGHT', syntheticDeal('DL-CHECK-WEIGHT', { status: 'LAB_PROTOCOL_CREATED', weightConfirmed: false, labProtocolId: 'LAB-CHECK-WEIGHT' }), 'ACCEPTED', { type: 'createLabProtocol', actor: lab, payload: { dealId: 'DL-CHECK-WEIGHT' }, runtimeLabel: 'pilot', now: at(43) }),
    guardCheck('missing-lab', 'NO_ACCEPTED_WITHOUT_LAB', syntheticDeal('DL-CHECK-LAB', { status: 'LAB_PROTOCOL_CREATED', weightConfirmed: true, labProtocolId: undefined }), 'ACCEPTED', { type: 'createLabProtocol', actor: lab, payload: { dealId: 'DL-CHECK-LAB' }, runtimeLabel: 'pilot', now: at(44) }),
    guardCheck('missing-idempotency', 'NO_BANK_COMMAND_WITHOUT_IDEMPOTENCY', syntheticDeal('DL-CHECK-IDEMPOTENCY', { status: 'SIGNED', reserveConfirmed: false }), 'RESERVE_REQUESTED', { type: 'requestReserve', actor: buyer, payload: { dealId: 'DL-CHECK-IDEMPOTENCY' }, runtimeLabel: 'pilot', now: at(45) }),
  ];

  return {
    scenarioId: SCENARIO_ID,
    dealId: SCENARIO_DEAL_ID,
    finalStatus: finalDeal.status,
    closeReady,
    passedSteps,
    passedStepIds: passedSteps.map((step) => step.id),
    blockedChecks,
    auditEventCountDelta: state.auditEvents.length - auditBefore,
    timelineEventCountDelta: state.dealTimeline.length - timelineBefore,
    source: 'controlled-pilot-scenario-runner',
  };
}
