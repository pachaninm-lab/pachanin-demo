function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalize(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

export function buildBuyerPaymentDisciplineScore(input: { payments?: any[]; disputes?: any[]; averageDaysLate?: number | null }) {
  const payments = Array.isArray(input.payments) ? input.payments : [];
  const disputes = Array.isArray(input.disputes) ? input.disputes : [];
  const paid = payments.filter((item) => ['PAID', 'RELEASED', 'PARTIAL_RELEASED'].includes(normalize(item?.status))).length;
  const delayed = payments.filter((item) => ['OVERDUE', 'FAILED', 'BLOCKED'].includes(normalize(item?.status))).length;
  const openDisputes = disputes.filter((item) => !['CLOSED', 'RESOLVED', 'DECISION', 'EXECUTED'].includes(normalize(item?.status))).length;
  const base = 80 + paid * 4 - delayed * 15 - openDisputes * 10 - Math.max(0, Number(input.averageDaysLate || 0)) * 2;
  return clamp(base);
}

export function buildRouteReliabilityScore(input: { shipments?: any[]; alerts?: any[] }) {
  const shipments = Array.isArray(input.shipments) ? input.shipments : [];
  const alerts = Array.isArray(input.alerts) ? input.alerts : [];
  const deviation = shipments.filter((item) => normalize(item?.status).includes('DEVIATION')).length;
  const confirmed = shipments.filter((item) => ['CONFIRMED', 'UNLOADED', 'COMPLETED', 'CLOSED'].includes(normalize(item?.status))).length;
  const riskAlerts = alerts.filter((item) => /route|eta|sync|delivery/i.test(String(item?.title || '') + ' ' + String(item?.action || ''))).length;
  return clamp(75 + confirmed * 5 - deviation * 18 - riskAlerts * 6);
}

export function buildDisputeSeverityScore(input: { disputes?: any[]; claimedAmountRub?: number | null }) {
  const disputes = Array.isArray(input.disputes) ? input.disputes : [];
  const open = disputes.filter((item) => !['CLOSED', 'RESOLVED', 'DECISION', 'EXECUTED'].includes(normalize(item?.status))).length;
  const high = disputes.filter((item) => ['HIGH', 'CRITICAL'].includes(normalize(item?.severity))).length;
  const amountPenalty = Math.min(30, Math.round(Number(input.claimedAmountRub || 0) / 50000));
  return clamp(open * 18 + high * 14 + amountPenalty, 0, 100);
}

export function buildExecutionReadinessScore(input: {
  docsReady?: boolean;
  labReady?: boolean;
  receivingReady?: boolean;
  fundingReady?: boolean;
  openDisputes?: number;
  connectorDegraded?: number;
}) {
  const checks = [input.docsReady, input.labReady, input.receivingReady, input.fundingReady].filter((value) => value === true).length;
  const openDisputes = Math.max(0, Number(input.openDisputes || 0));
  const connectorDegraded = Math.max(0, Number(input.connectorDegraded || 0));
  return clamp(checks * 22 + 12 - openDisputes * 12 - connectorDegraded * 8);
}
