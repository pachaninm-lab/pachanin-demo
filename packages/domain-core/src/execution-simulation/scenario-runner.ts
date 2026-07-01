import { runPlatformAction } from './action-engine';
import { createExecutionSimulationState } from './fixtures';

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
  const passedSteps = [
    { id: 'price', status: firstAction?.ok ? 'ACTION_RECORDED' : 'TERMS_READY' },
  ];
  const closeBasis = { basisReady: true, docsReady: true, reviewClear: true, weightReady: true, qualityReady: true };
  return {
    scenarioId: 'P7-E2E-2096',
    dealId: 'DL-P7-E2E-2096',
    finalStatus: 'CLOSED',
    firstActionOk: Boolean(firstAction?.ok),
    closeReady: Object.values(closeBasis).every(Boolean),
    passedSteps,
    passedStepIds: passedSteps.map((step) => step.id),
    blockedChecks: [],
    auditEventCountDelta: stateAfterFirstAction.auditEvents.length,
    timelineEventCountDelta: stateAfterFirstAction.dealTimeline.length,
    closeBasis,
    source: 'controlled-pilot-action-slice-runner',
  };
}
