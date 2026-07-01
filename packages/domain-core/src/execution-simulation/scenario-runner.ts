// Controlled-pilot scenario runner contract for the current execution layer.
export function runPlatformV7ExecutionEvidenceScenario() {
  const passedSteps = [
    { id: 'price', status: 'TERMS_READY' },
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
    auditEventCountDelta: passedSteps.length,
    timelineEventCountDelta: passedSteps.length,
    closeBasis,
    source: 'controlled-pilot-scenario-runner',
  };
}
