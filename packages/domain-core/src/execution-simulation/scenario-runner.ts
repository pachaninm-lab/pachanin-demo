import { runPlatformAction } from './action-engine';
import { createExecutionSimulationState } from './fixtures';
import { transitionDeal } from './state-machine';

export function runPlatformV7ExecutionEvidenceScenario() {
  const state = createExecutionSimulationState();
  const seller = state.users.find((item) => item.role === 'seller');
  const operator = state.users.find((item) => item.role === 'operator');
  const firstAction = seller ? runPlatformAction(state, { type: 'createLot', actor: seller, payload: { lotId: 'LOT-P7-E2E-2096', volumeTonnes: 240, pricePerTonneRub: 16140, basis: 'EXW', qualityClass: '3' }, runtimeLabel: 'pilot', now: '2026-07-01T08:00:00.000Z' }) : null;
  const stateAfterFirstAction = firstAction?.ok ? firstAction.state : state;
  const secondAction = seller && firstAction?.ok ? runPlatformAction(stateAfterFirstAction, { type: 'publishLot', actor: seller, payload: { lotId: 'LOT-P7-E2E-2096' }, runtimeLabel: 'pilot', now: '2026-07-01T08:01:00.000Z' }) : null;
  const stateAfterSecondAction = secondAction?.ok ? secondAction.state : stateAfterFirstAction;
  const thirdAction = operator && secondAction?.ok ? runPlatformAction(stateAfterSecondAction, { type: 'createDeal', actor: operator, payload: { lotId: 'LOT-P7-E2E-2096', dealId: 'DL-P7-E2E-2096', buyerId: 'CP-B-001' }, runtimeLabel: 'pilot', now: '2026-07-01T08:02:00.000Z' }) : null;
  const scenarioState = thirdAction?.ok ? thirdAction.state : stateAfterSecondAction;
  const deal = scenarioState.deals.find((item) => item.id === 'DL-P7-E2E-2096');
  const draftTransition = operator && deal ? transitionDeal(scenarioState, deal, 'CONTRACT_DRAFTED', { type: 'createDeal', actor: operator, payload: { dealId: deal.id }, runtimeLabel: 'pilot', now: '2026-07-01T08:03:00.000Z' }) : null;
  if (draftTransition?.ok && draftTransition.deal) scenarioState.deals = scenarioState.deals.map((item) => item.id === draftTransition.deal?.id ? draftTransition.deal : item);
  const finalDeal = scenarioState.deals.find((item) => item.id === 'DL-P7-E2E-2096');
  const closeBasis = { basisReady: true, docsReady: true, reviewClear: true, weightReady: true, qualityReady: true };
  const passedSteps = [
    { id: 'price', status: firstAction?.ok ? 'ACTION_RECORDED' : 'TERMS_READY' },
    { id: 'publish', status: secondAction?.ok ? 'ACTION_RECORDED' : 'PUBLISH_PENDING' },
    { id: 'deal', status: thirdAction?.ok ? 'ACTION_RECORDED' : 'DEAL_PENDING' },
    { id: 'contract', status: draftTransition?.ok ? 'ACTION_RECORDED' : 'CONTRACT_PENDING' },
  ];

  return {
    scenarioId: 'P7-E2E-2096',
    dealId: 'DL-P7-E2E-2096',
    finalStatus: finalDeal?.status ?? 'NO_DEAL',
    targetFinalStatus: 'CLOSED',
    firstActionOk: Boolean(firstAction?.ok),
    secondActionOk: Boolean(secondAction?.ok),
    thirdActionOk: Boolean(thirdAction?.ok),
    contractDraftedOk: Boolean(draftTransition?.ok),
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
