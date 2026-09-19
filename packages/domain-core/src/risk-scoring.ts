export function buildExecutionRiskScore(input: {
  activeDisputes?: number;
  missingDocs?: number;
  staleDocs?: number;
  routeDeviationAlerts?: number;
  failedCallbacks?: number;
  fallbackSurfaces?: number;
}) {
  const score = Math.max(0, 100
    - Number(input.activeDisputes || 0) * 18
    - Number(input.missingDocs || 0) * 8
    - Number(input.staleDocs || 0) * 4
    - Number(input.routeDeviationAlerts || 0) * 6
    - Number(input.failedCallbacks || 0) * 10
    - Number(input.fallbackSurfaces || 0) * 12
  );
  return {
    score,
    state: score >= 80 ? 'GREEN' : score >= 60 ? 'AMBER' : 'RED'
  };
}
