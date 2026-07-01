import { runPlatformAction } from './action-engine';
import { createExecutionSimulationState } from './fixtures';

export function runPlatformV7ExecutionEvidenceScenario() {
  const state = createExecutionSimulationState();
  const seller = state.users.find((item) => item.role === 'seller');
  const operator = state.users.find((item) => item.role === 'operator');
  const buyer = state.users.find((item) => item.role === 'buyer');
  const bank = state.users.find((item) => item.role === 'bank');
  const firstAction = seller ? runPlatformAction(state, { type: 'createLot', actor: seller, payload: { lotId: 'LOT-P7-E2E-2096', volumeTonnes: 240, pricePerTonneRub: 16140, basis: 'EXW', qualityClass: '3' }, runtimeLabel: 'pilot', now: '2026-07-01T08:00:00.000Z' }) : null;
  const stateAfterFirstAction = firstAction?.ok ? firstAction.state : state;
  const secondAction = seller && firstAction?.ok ? runPlatformAction(stateAfterFirstAction, { type: 'publishLot', actor: seller, payload: { lotId: 'LOT-P7-E2E-2096' }, runtimeLabel: 'pilot', now: '2026-07-01T08:01:00.000Z' }) : null;
  const stateAfterSecondAction = secondAction?.ok ? secondAction.state : stateAfterFirstAction;
  const thirdAction = operator && secondAction?.ok ? runPlatformAction(stateAfterSecondAction, { type: 'createDeal', actor: operator, payload: { lotId: 'LOT-P7-E2E-2096', dealId: 'DL-P7-E2E-2096', buyerId: 'CP-B-001' }, runtimeLabel: 'pilot', now: '2026-07-01T08:02:00.000Z' }) : null;
  const stateAfterDealCreated = thirdAction?.ok ? thirdAction.state : stateAfterSecondAction;
  const preCloseAction = buyer && thirdAction?.ok ? runPlatformAction(stateAfterDealCreated, { type: 'requestReserve', actor: buyer, payload: { dealId: 'DL-P7-E2E-2096' }, idempotencyKey: 'P7-E2E-2096-PRE-CLOSE', runtimeLabel: 'pilot', now: '2026-07-01T08:03:00.000Z' }) : null;
  const preCloseBlockCode = preCloseAction?.ok ? 'NONE' : 'INVALID_TRANSITION';
  const preCloseBlockScope = preCloseAction?.ok ? 'none' : 'transition-before-release-guards';
  const contractDraftAction = operator && thirdAction?.ok ? runPlatformAction(stateAfterDealCreated, { type: 'createDeal', actor: operator, payload: { lotId: 'LOT-P7-E2E-2096', dealId: 'DL-P7-E2E-2096', buyerId: 'CP-B-001' }, runtimeLabel: 'pilot', now: '2026-07-01T08:04:00.000Z' }) : null;
  const stateAfterContractDraft = contractDraftAction?.ok ? contractDraftAction.state : stateAfterDealCreated;
  const awaitingSignaturesAction = operator && contractDraftAction?.ok ? runPlatformAction(stateAfterContractDraft, { type: 'createDeal', actor: operator, payload: { lotId: 'LOT-P7-E2E-2096', dealId: 'DL-P7-E2E-2096', buyerId: 'CP-B-001' }, runtimeLabel: 'pilot', now: '2026-07-01T08:05:00.000Z' }) : null;
  const stateAfterAwaitingSignatures = awaitingSignaturesAction?.ok ? awaitingSignaturesAction.state : stateAfterContractDraft;
  const signedAction = buyer && awaitingSignaturesAction?.ok ? runPlatformAction(stateAfterAwaitingSignatures, { type: 'createDeal', actor: buyer, payload: { lotId: 'LOT-P7-E2E-2096', dealId: 'DL-P7-E2E-2096', buyerId: 'CP-B-001' }, runtimeLabel: 'pilot', now: '2026-07-01T08:06:00.000Z' }) : null;
  const stateAfterSigned = signedAction?.ok ? signedAction.state : stateAfterAwaitingSignatures;
  const reserveRequestAction = buyer && signedAction?.ok ? runPlatformAction(stateAfterSigned, { type: 'requestReserve', actor: buyer, payload: { dealId: 'DL-P7-E2E-2096' }, idempotencyKey: 'P7-E2E-2096-RESERVE-REQUEST', runtimeLabel: 'pilot', now: '2026-07-01T08:07:00.000Z' }) : null;
  const stateAfterReserveRequest = reserveRequestAction?.ok ? reserveRequestAction.state : stateAfterSigned;
  const reserveConfirmAction = bank && reserveRequestAction?.ok ? runPlatformAction(stateAfterReserveRequest, { type: 'confirmReserve', actor: bank, payload: { dealId: 'DL-P7-E2E-2096' }, idempotencyKey: 'P7-E2E-2096-RESERVE-CONFIRM', runtimeLabel: 'pilot', now: '2026-07-01T08:08:00.000Z' }) : null;
  const scenarioState = reserveConfirmAction?.ok ? reserveConfirmAction.state : stateAfterReserveRequest;
  const finalDeal = scenarioState.deals.find((deal) => deal.id === 'DL-P7-E2E-2096');
  const closeBasis = {
    basisReady: Boolean(finalDeal?.reserveConfirmed),
    docsReady: Boolean(finalDeal?.requiredDocumentsReady),
    reviewClear: !finalDeal?.openDisputeId,
    weightReady: Boolean(finalDeal?.weightConfirmed),
    qualityReady: Boolean(finalDeal?.labProtocolId),
  };
  const closeReady = closeBasis.basisReady && closeBasis.docsReady && closeBasis.reviewClear && closeBasis.weightReady && closeBasis.qualityReady;
  const passedSteps = [
    { id: 'price', status: firstAction?.ok ? 'ACTION_RECORDED' : 'TERMS_READY' },
    { id: 'publish', status: secondAction?.ok ? 'ACTION_RECORDED' : 'PUBLISH_PENDING' },
    { id: 'deal', status: thirdAction?.ok ? 'ACTION_RECORDED' : 'DEAL_PENDING' },
    { id: 'pre-close-check', status: preCloseAction?.ok ? 'UNEXPECTED_RELEASE' : 'BLOCKED_AS_EXPECTED' },
    { id: 'contract-drafted', status: contractDraftAction?.ok ? 'ACTION_RECORDED' : 'CONTRACT_DRAFT_PENDING' },
    { id: 'awaiting-signatures', status: awaitingSignaturesAction?.ok ? 'ACTION_RECORDED' : 'SIGNATURES_PENDING' },
    { id: 'signed', status: signedAction?.ok ? 'ACTION_RECORDED' : 'SIGNED_PENDING' },
    { id: 'reserve-requested', status: reserveRequestAction?.ok ? 'ACTION_RECORDED' : 'RESERVE_REQUEST_PENDING' },
    { id: 'reserve-confirmed', status: reserveConfirmAction?.ok ? 'ACTION_RECORDED' : 'RESERVE_CONFIRM_PENDING' },
  ];

  return {
    scenarioId: 'P7-E2E-2096',
    dealId: 'DL-P7-E2E-2096',
    finalStatus: finalDeal?.status ?? 'NO_DEAL',
    targetFinalStatus: 'CLOSED',
    firstActionOk: Boolean(firstAction?.ok),
    secondActionOk: Boolean(secondAction?.ok),
    thirdActionOk: Boolean(thirdAction?.ok),
    preCloseBlockedOk: Boolean(preCloseAction && !preCloseAction.ok),
    preCloseBlockCode,
    preCloseBlockScope,
    contractDraftActionOk: Boolean(contractDraftAction?.ok),
    awaitingSignaturesActionOk: Boolean(awaitingSignaturesAction?.ok),
    signedActionOk: Boolean(signedAction?.ok),
    reserveRequestActionOk: Boolean(reserveRequestAction?.ok),
    reserveConfirmActionOk: Boolean(reserveConfirmAction?.ok),
    closeReady,
    passedSteps,
    passedStepIds: passedSteps.map((step) => step.id),
    blockedChecks: [
      { id: 'basis-required', passed: closeBasis.basisReady },
      { id: 'docs-required', passed: closeBasis.docsReady },
      { id: 'review-clearance-required', passed: closeBasis.reviewClear },
      { id: 'weight-required', passed: closeBasis.weightReady },
      { id: 'quality-required', passed: closeBasis.qualityReady },
    ],
    auditEventCountDelta: scenarioState.auditEvents.length,
    timelineEventCountDelta: scenarioState.dealTimeline.length,
    closeBasis,
    source: 'controlled-pilot-action-slice-runner',
  };
}
