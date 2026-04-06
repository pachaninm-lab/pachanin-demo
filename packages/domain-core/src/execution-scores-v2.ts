import { buildBuyerPaymentDisciplineScore, buildDisputeSeverityScore, buildExecutionReadinessScore, buildRouteReliabilityScore } from './scoring';

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function buildExecutionScoresV2(input: {
  payments?: any[];
  disputes?: any[];
  shipments?: any[];
  alerts?: any[];
  docsReady?: boolean;
  labReady?: boolean;
  receivingReady?: boolean;
  fundingReady?: boolean;
  connectorDegraded?: number;
  averageDaysLate?: number | null;
}) {
  const paymentDiscipline = buildBuyerPaymentDisciplineScore({ payments: input.payments, disputes: input.disputes, averageDaysLate: input.averageDaysLate });
  const routeReliability = buildRouteReliabilityScore({ shipments: input.shipments, alerts: input.alerts });
  const disputeSeverity = buildDisputeSeverityScore({ disputes: input.disputes });
  const executionReadiness = buildExecutionReadinessScore({
    docsReady: input.docsReady,
    labReady: input.labReady,
    receivingReady: input.receivingReady,
    fundingReady: input.fundingReady,
    openDisputes: Array.isArray(input.disputes) ? input.disputes.length : 0,
    connectorDegraded: input.connectorDegraded
  });
  const readyForBank = clamp(paymentDiscipline * 0.35 + executionReadiness * 0.45 + routeReliability * 0.2);
  const readyForNtb = clamp(executionReadiness * 0.35 + routeReliability * 0.2 + Math.max(0, 100 - disputeSeverity) * 0.2 + paymentDiscipline * 0.25);
  return {
    paymentDiscipline,
    routeReliability,
    disputeSeverity,
    executionReadiness,
    readyForBank,
    readyForNtb,
    breakdown: {
      payments: paymentDiscipline,
      logistics: routeReliability,
      disputePenalty: Math.max(0, 100 - disputeSeverity),
      execution: executionReadiness
    }
  };
}
