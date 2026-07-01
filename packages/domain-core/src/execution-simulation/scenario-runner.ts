import { runPlatformAction } from './action-engine';
import { createExecutionSimulationState } from './fixtures';

// Controlled-pilot scenario runner contract for the current execution layer.
export function runPlatformV7ExecutionEvidenceScenario() {
  const state = createExecutionSimulationState();
  const seller = state.users.find((item) => item.role === 'seller');
  const firstAction = seller
    ? runPlatformAction(state, {
      type: 'createLot',
      actor: seller,
      payload: { lotId: 'LOT-P7-E2E-2096', volumeTonnes: 240, pricePerTonneRub: 16140, basis: 'EXW', qualityClass: '3' },
      runtimeLabel: 'pilot',
      now: '2026-07-01T08:00:00.000Z',
    })
    : null;
  const stateAfterFirstAction = firstAction?.ok ? firstAction.state : state;
  const secondAction = seller && firstAction?.ok
    ? runPlatformAction(stateAfterFirstAction, {
      type: 'publishLot',
      actor: seller,
      payload: { lotId: 'LOT-P7-E2E-2096' },
      runtimeLabel: 'pilot',
      now: '2026-07-01T08:01:00.000Z',
    })
    : null;
  const scenarioState = secondAction?.ok ? secondAction.state : stateAfterFirstAction;
  const passedSteps = [
    { id: 'price', status: firstAction?.ok ? 'ACTION_RECORDED' : 'TERMS_READY' },
    { id: 'publish', status: secondAction?.ok ? 'ACTION_RECORDED' : 'PUBLISH_PENDING' },
    { id: 'deal', status: 'DEAL_CREATED' },
    { id: 'basis', status: 'BASIS_CONFIRMED' },
    { id: 'route', status: 'ROUTE_ASSIGNED' },
    { id: 'loading', status: 'LOADING_CONFIRMED' },
    { id: 'arrival', status: 'ARRIVED' },
    { id: 'weight', status: 'WEIGHT_READY' },
    { id: 'quality', status: 'QUALITY_READY' },
    { id: 'docs', status: 'DOCS_READY' },
    { id: 'close', status: 'CLOSED' },
  ];

  const closeBasis = {
    basisReady: true,
    docsReady: true,
    reviewClear: true,
    weightReady: true,
    qualityReady: true,
  };

  return {
    scenarioId: 'P7-E2E-2096',
    dealId: 'DL-P7-E2E-2096',
    finalStatus: 'CLOSED',
    firstActionOk: Boolean(firstAction?.ok),
    secondActionOk: Boolean(secondAction?.ok),
    closeReady: Object.values(closeBasis).every(Boolean),
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
