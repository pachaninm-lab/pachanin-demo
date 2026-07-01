import { runPlatformAction } from './action-engine';
import { createExecutionSimulationState } from './fixtures';

export function runPlatformV7ExecutionEvidenceScenario() {
  const state = createExecutionSimulationState();
  const seller = state.users.find((item) => item.role === 'seller');
  const operator = state.users.find((item) => item.role === 'operator');
  const buyer = state.users.find((item) => item.role === 'buyer');
  const firstAction = seller ? runPlatformAction(state, { type: 'createLot', actor: seller, payload: { lotId: 'LOT-P7-E2E-2096', volumeTonnes: 240, pricePerTonneRub: 16140, basis: 'EXW', qualityClass: '3' }, runtimeLabel: 'pilot', now: '2026-07-01T08:00:00.000Z' }) : null;
  const stateAfterFirstAction = firstAction?.ok ? firstAction.state : state;
  const secondAction = seller && firstAction?.ok ? runPlatformAction(stateAfterFirstAction, { type: 'publishLot', actor: seller, payload: { lotId: 'LOT-P7-E2E-2096' }, runtimeLabel: 'pilot', now: '2026-07-01T08:01:00.000Z' }) : null;
  const stateAfterSecondAction = secondAction?.ok ? secondAction.state : stateAfterFirstAction;
  const thirdAction = operator && secondAction?.ok ? runPlatformAction(stateAfterSecondAction, { type: 'createDeal', actor: operator, payload: { lotId: 'LOT-P7-E2E-2096', dealId: 'DL-P7-E2E-2096', buyerId: 'CP-B-001' }, runtimeLabel: 'pilot', now: '2026-07-01T08:02:00.000Z' }) : null;
  const scenarioState = thirdAction?.ok ? thirdAction.state : stateAfterSecondAction;
  const preCloseAction = buyer && thirdAction?.ok ? runPlatformAction(scenarioState, { type: 'requestReserve', actor: buyer, payload: { dealId: 'DL-P7-E2E-2096' }, idempotencyKey: 'P7-E2E-2096-PRE-CLOSE', runtimeLabel: 'pilot', now: '2026-07-01T08:03:00.000Z' }) : null;
  const closeBasis = { basisReady: false, docsReady: false, reviewClear: true, weightReady: false, qualityReady: false };
  const passedSteps = [
    { id: 'price', status: firstAction?.ok ? 'ACTION_RECORDED' : 'TERMS_READY' },
    { id: 'publish', status: secondAction?.ok ? 'ACTION_RECORDED' : 'PUBLISH_PENDING' },
    { id: 'deal', status: thirdAction?.ok ? 'ACTION_RECORDED' : 'DEAL_PENDING' },
    { id: 'pre-close-check', status: preCloseAction?.ok ? 'UNEXPECTED_RELEASE' : 'BLOCKED_AS_EXPECTED' },
  ];

  return {
    scenarioId: 'P7-E2E-2096',
    dealId: 'DL-P7-E2E-2096',
    finalStatus: scenarioState.deals.find((deal) => deal.id === 'DL-P7-E2E-2096')?.status ?? 'NO_DEAL',
    targetFinalStatus: 'CLOSED',
    firstActionOk: Boolean(firstAction?.ok),
    secondActionOk: Boolean(secondAction?.ok),
    thirdActionOk: Boolean(thirdAction?.ok),
    preCloseBlockedOk: Boolean(preCloseAction && !preCloseAction.ok),
    closeReady: false,
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
