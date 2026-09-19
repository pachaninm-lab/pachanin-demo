export interface KpiDealInput {
  id: string;
  reservedAmount: number;
  holdAmount: number;
  releaseAmount?: number;
  riskScore: number;
  status: string;
  blockers: string[];
  slaDeadline: string | null;
  dispute?: { id: string };
  routeState?: string;
}

export interface KpiContributor {
  dealId: string;
  amount: number;
  reason: string;
}

export interface KpiMetric {
  value: number;
  contributors: KpiContributor[];
}

export interface ControlTowerKpis {
  moneyAtRisk: KpiMetric;
  heldAmount: KpiMetric;
  readyToRelease: KpiMetric;
  integrationStops: KpiMetric;
  transportStops: KpiMetric;
  slaCritical: KpiMetric;
  reserveTotal: KpiMetric;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function sum(contributors: KpiContributor[]): number {
  return contributors.reduce((total, item) => total + item.amount, 0);
}

function metric(contributors: KpiContributor[]): KpiMetric {
  return { value: sum(contributors), contributors };
}

function isReleasePending(deal: KpiDealInput): boolean {
  return deal.status === 'release_requested' || deal.status === 'release_approved' || deal.status === 'RELEASE_PENDING';
}

function isSlaCritical(deadline: string | null, now: Date): boolean {
  if (!deadline) return false;
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() - now.getTime() <= DAY_MS;
}

export function computeControlTowerKpis(deals: KpiDealInput[], now: Date = new Date()): ControlTowerKpis {
  const reserveTotal = deals.map((deal) => ({ dealId: deal.id, amount: deal.reservedAmount, reason: 'reserve' }));

  const heldAmount = deals
    .filter((deal) => deal.holdAmount > 0)
    .map((deal) => ({ dealId: deal.id, amount: deal.holdAmount, reason: 'hold' }));

  const readyToRelease = deals
    .filter(isReleasePending)
    .map((deal) => ({
      dealId: deal.id,
      amount: deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0),
      reason: 'release-pending',
    }));

  const moneyAtRisk = deals
    .filter((deal) => deal.holdAmount > 0 || Boolean(deal.dispute))
    .map((deal) => ({
      dealId: deal.id,
      amount: deal.holdAmount + Math.round(deal.reservedAmount * 0.1),
      reason: deal.dispute ? 'dispute-risk' : 'hold-risk',
    }));

  const integrationStops = deals
    .filter((deal) => deal.blockers.some((blocker) => blocker.includes('integration') || blocker.includes('fgis') || blocker.includes('esia')))
    .map((deal) => ({ dealId: deal.id, amount: 1, reason: 'integration-stop' }));

  const transportStops = deals
    .filter((deal) => deal.routeState?.toLowerCase().includes('отклонение') || deal.blockers.includes('transport'))
    .map((deal) => ({ dealId: deal.id, amount: 1, reason: 'transport-stop' }));

  const slaCritical = deals
    .filter((deal) => isSlaCritical(deal.slaDeadline, now))
    .map((deal) => ({ dealId: deal.id, amount: 1, reason: 'sla-critical' }));

  return {
    moneyAtRisk: metric(moneyAtRisk),
    heldAmount: metric(heldAmount),
    readyToRelease: metric(readyToRelease),
    integrationStops: metric(integrationStops),
    transportStops: metric(transportStops),
    slaCritical: metric(slaCritical),
    reserveTotal: metric(reserveTotal),
  };
}

export function formatKpiFormula(metricName: keyof ControlTowerKpis, metricValue: KpiMetric): string {
  const details = metricValue.contributors.map((item) => `${item.dealId}: ${item.amount}`).join(', ');
  return `${metricName}: ${metricValue.value}${details ? ` = ${details}` : ''}`;
}
