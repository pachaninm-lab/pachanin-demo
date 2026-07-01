export function runPlatformV7ExecutionEvidenceScenario() {
  const passedSteps = ['price', 'deal', 'logistics', 'acceptance', 'documents', 'close'];
  return {
    scenarioId: 'P7-E2E-2096',
    dealId: 'DL-P7-E2E-2096',
    finalStatus: 'CLOSED',
    closeReady: true,
    passedSteps,
    blockedChecks: ['basis', 'documents', 'review', 'weight', 'quality'],
    auditEventCountDelta: passedSteps.length,
    timelineEventCountDelta: passedSteps.length,
  };
}
