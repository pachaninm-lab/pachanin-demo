import {
  FOUNDER_CONTROL_ASSUMPTIONS as A,
  FOUNDER_CONTROL_BASE_FINANCIALS as BASE,
  FOUNDER_CONTROL_BASE_PLAN,
  FOUNDER_CONTROL_EVIDENCE_REQUIREMENTS,
  FOUNDER_CONTROL_PIPELINE_PROBABILITY,
  FOUNDER_CONTROL_REFERENCE_VERSION,
  FOUNDER_CONTROL_TYPES,
  FOUNDER_CONTROL_WORKBOOK_PARITY,
} from './founder-control.reference';
import type {
  FounderControlAlert,
  FounderControlGate,
  FounderControlHealth,
  FounderControlOverview,
  FounderControlRecordDto,
  FounderControlRecordType,
} from './founder-control.types';

type Payload = Record<string, unknown>;
type Pnl = Readonly<{ contribution: number; cm: number; infra: number }>;
type Retention = Readonly<{ period: number; grr: number; nrr: number }>;

const COMMERCIAL_START = new Date(Date.UTC(2026, 8, 8));

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function number(value: unknown, fallback = 0): number {
  return finite(value) ? value : fallback;
}
function nullableNumber(value: unknown): number | null {
  return finite(value) ? value : null;
}
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
function bool(value: unknown): boolean {
  return value === true || value === 'YES' || value === 'PASS';
}
function active(records: readonly FounderControlRecordDto[], type: FounderControlRecordType) {
  return records.filter((record) => record.recordType === type && record.status === 'ACTIVE');
}
function inputValue(records: readonly FounderControlRecordDto[], key: string): number | null {
  const record = active(records, 'CEO_INPUT').find((item) => item.recordKey === key);
  return record ? nullableNumber(record.payload.value) : null;
}
function periodNumber(record: FounderControlRecordDto): number | null {
  const value = nullableNumber(record.payload.period);
  if (value !== null && Number.isInteger(value) && value >= 1 && value <= 12) return value;
  const match = record.recordKey.match(/(?:period-)?(\d{1,2})$/u);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}
function periodStart(period: number): Date {
  return new Date(Date.UTC(COMMERCIAL_START.getUTCFullYear(), COMMERCIAL_START.getUTCMonth() + period - 1, COMMERCIAL_START.getUTCDate()));
}
function periodEnd(period: number): Date {
  const next = periodStart(period + 1);
  return new Date(next.getTime() - 1);
}
function isoMs(value: unknown): number | null {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : null;
}
function evidenceGate(records: readonly FounderControlRecordDto[], gate: keyof typeof FOUNDER_CONTROL_EVIDENCE_REQUIREMENTS): FounderControlGate {
  const required = FOUNDER_CONTROL_EVIDENCE_REQUIREMENTS[gate];
  const items = active(records, 'EVIDENCE').filter((record) => text(record.payload.gate) === gate);
  return required.every((itemCode) => items.some((record) => (
    text(record.payload.itemCode) === itemCode
    && text(record.payload.status) === 'PASS'
    && Boolean(text(record.payload.ref))
    && Boolean(text(record.payload.verifiedBy))
    && isoMs(record.payload.checkedAt) !== null
  ))) ? 'PASS' : 'EVIDENCE';
}

function clientContractGate(payload: Payload): FounderControlGate {
  const pkg = text(payload.package);
  const mrr = number(payload.mrrRub);
  const launchFee = number(payload.launchFeeRub);
  const supportHours = number(payload.supportHours);
  const engineerHours = number(payload.engineerHours);
  const otherDirect = number(payload.otherDirectCostRub);
  const benefit = number(payload.benefitRubPerMonth);
  const actualLaunchCost = nullableNumber(payload.actualLaunchCostRub);
  const expectedLaunchCost = pkg === 'Assisted' ? A.assistedExpectedLaunchCostRub : A.selfExpectedLaunchCostRub;
  const launchCost = actualLaunchCost ?? expectedLaunchCost;
  if (!mrr || !launchFee || !benefit || !['Assisted', 'Self'].includes(pkg)) return 'EVIDENCE';
  const recurringCost = mrr * A.creditsReservePct
    + (mrr - mrr * A.creditsReservePct) * A.channelCommissionPct
    + supportHours * A.supportPlanningRateRub
    + engineerHours * A.engineerPlanningRateRub
    + otherDirect;
  const cm = (mrr - recurringCost) / mrr;
  const benefitMultiple = benefit / mrr;
  const launchPayback = launchFee / benefit;
  const integration = text(payload.integrationFunded);
  const paymentTerms = nullableNumber(payload.paymentTermsDays);
  const launchPrepay = nullableNumber(payload.launchPrepayPct);
  if (paymentTerms === null || launchPrepay === null) return 'EVIDENCE';
  return cm >= A.minContributionMarginPct
    && benefitMultiple >= A.minClientBenefitMultiple
    && launchPayback <= A.maxClientLaunchPaybackMonths
    && launchFee - launchCost > 0
    && launchPrepay >= A.launchPrepayPct
    && paymentTerms === 0
    && (integration === 'YES' || integration === 'N/A')
    ? 'PASS' : 'BLOCK';
}
function clientProofPass(payload: Payload): boolean {
  return text(payload.status) === 'ACTIVE'
    && clientContractGate(payload) === 'PASS'
    && bool(payload.launchPrepayReceived)
    && Boolean(text(payload.paymentEvidenceRef))
    && bool(payload.repeatPaid)
    && isoMs(payload.lastPaidAt ?? payload.lastPaid) !== null
    && bool(payload.roiEvidence)
    && bool(payload.costMeasured)
    && finite(payload.actualLaunchCostRub);
}
function clientPnl(payload: Payload, now: Date): Pnl | null {
  const recurring = nullableNumber(payload.actualRecurringRevenueRub);
  const launch = nullableNumber(payload.actualLaunchRevenueRub);
  const support = nullableNumber(payload.actualSupportHours);
  const engineer = nullableNumber(payload.actualEngineerHours);
  const other = nullableNumber(payload.actualOtherDirectCostRub);
  const infra = nullableNumber(payload.actualInfraAllocationRub);
  if ([recurring, launch, support, engineer, other, infra].some((value) => value === null)) return null;
  const revenue = recurring! + launch!;
  if (revenue <= 0) return null;
  const month = isoMs(payload.pnlMonth);
  const taxDate = month === null ? now : new Date(month);
  const rate = taxDate <= new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999)) ? A.usn2026Pct : A.usn2027Pct;
  const direct = support! * A.supportPlanningRateRub + engineer! * A.engineerPlanningRateRub + other! + infra! + revenue * rate;
  const contribution = revenue - direct;
  return Object.freeze({ contribution, cm: contribution / revenue, infra: infra! });
}

function latestForecast(records: readonly FounderControlRecordDto[], period: number) {
  const actual = active(records, 'ACTUAL_PERIOD').find((record) => periodNumber(record) === period);
  const forecast = active(records, 'FORECAST').find((record) => periodNumber(record) === period);
  const plan = FOUNDER_CONTROL_BASE_PLAN[period - 1];
  const actualMrr = actual ? nullableNumber(actual.payload.actualMrrRub) : null;
  const actualResult = actual ? nullableNumber(actual.payload.actualRecurringResultRub) : null;
  const actualClients = actual ? nullableNumber(actual.payload.actualClients) : null;
  if (actualMrr !== null && actualResult !== null && actualClients !== null) {
    return { state: 'ACTUAL' as const, mrrRub: actualMrr, resultRub: actualResult, clients: actualClients };
  }
  const forecastMrr = forecast ? nullableNumber(forecast.payload.forecastMrrRub) : null;
  const forecastResult = forecast ? nullableNumber(forecast.payload.forecastRecurringResultRub) : null;
  const forecastClients = forecast ? nullableNumber(forecast.payload.forecastClients) : null;
  if (forecastMrr !== null && forecastResult !== null && forecastClients !== null) {
    return { state: 'FORECAST' as const, mrrRub: forecastMrr, resultRub: forecastResult, clients: forecastClients };
  }
  return { state: 'PLAN' as const, mrrRub: plan.mrrRub, resultRub: plan.recurringResultRub, clients: plan.activeAssisted + plan.activeSelf };
}

function forecastAccuracy(records: readonly FounderControlRecordDto[]) {
  const forecasts = active(records, 'FORECAST');
  const actuals = active(records, 'ACTUAL_PERIOD');
  const errors: number[] = [];
  let lateApprovalCount = 0;
  for (const forecast of forecasts) {
    const period = periodNumber(forecast);
    if (!period) continue;
    const actual = actuals.find((record) => periodNumber(record) === period);
    if (!actual) continue;
    const approvedAt = isoMs(forecast.payload.approvedAt);
    if (approvedAt === null || !text(forecast.payload.approvalEvidenceRef) || approvedAt > periodStart(period).getTime()) {
      lateApprovalCount += 1;
      continue;
    }
    const predicted = nullableNumber(forecast.payload.forecastMrrRub);
    const fact = nullableNumber(actual.payload.actualMrrRub);
    if (predicted === null || predicted === 0 || fact === null) continue;
    errors.push(Math.abs(fact - predicted) / Math.abs(predicted));
  }
  return {
    measured: errors.length,
    avgMrrErrorPct: errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null,
    lateApprovalCount,
  };
}

function monthlyCloseStatus(payload: Payload): FounderControlGate {
  const checks = [
    'bankReconciled','arReconciled','revenueVerified','clientPnlComplete','payrollVendorsEntered',
    'taxReserveChecked','evidenceCurrent','cashForecastRolled','forecastApproved',
  ];
  if (checks.some((key) => payload[key] === false || payload[key] === 'NO')) return 'BLOCK';
  if (!checks.every((key) => bool(payload[key])) || !text(payload.owner) || isoMs(payload.closedAt) === null || !text(payload.evidenceRef)) return 'EVIDENCE';
  return 'PASS';
}
function dueCloseNotPass(records: readonly FounderControlRecordDto[], now: Date) {
  const closes = active(records, 'MONTHLY_CLOSE');
  let due = 0;
  let blocked = 0;
  for (let period = 1; period <= 12; period += 1) {
    if (periodEnd(period) >= now) continue;
    const record = closes.find((item) => periodNumber(item) === period);
    if (!record || monthlyCloseStatus(record.payload) !== 'PASS') due += 1;
    if (record && monthlyCloseStatus(record.payload) === 'BLOCK') blocked += 1;
  }
  return { due, blocked };
}
function assumptionEvidenceCount(records: readonly FounderControlRecordDto[]) {
  return active(records, 'ASSUMPTION_CHANGE').filter((record) => {
    const p = record.payload;
    return !text(p.area) || !text(p.metric) || !text(p.sourceCell) || p.oldValue === undefined || p.newValue === undefined
      || !text(p.financialImpact) || !text(p.reason) || !text(p.approvedBy) || !text(p.evidenceRef);
  }).length;
}
function retentionSnapshot(records: readonly FounderControlRecordDto[], clients: readonly FounderControlRecordDto[]): Retention | null {
  const rows = active(records, 'RETENTION_MRR');
  if (clients.length === 0 || rows.length === 0) return null;
  const byClientPeriod = new Map<string, number>();
  for (const row of rows) {
    const clientKey = text(row.payload.clientKey);
    const period = nullableNumber(row.payload.period);
    const mrr = nullableNumber(row.payload.mrrRub);
    if (!clientKey || period === null || mrr === null) continue;
    byClientPeriod.set(`${clientKey}:${period}`, mrr);
  }
  let latest: Retention | null = null;
  for (let period = 2; period <= 12; period += 1) {
    const eligible = clients.filter((client) => {
      const goLive = isoMs(client.payload.goLive);
      return goLive !== null && goLive <= periodEnd(period - 1).getTime();
    });
    if (eligible.length === 0) continue;
    const pairs = eligible.map((client) => ({
      previous: byClientPeriod.get(`${client.recordKey}:${period - 1}`),
      current: byClientPeriod.get(`${client.recordKey}:${period}`),
    }));
    if (pairs.some((pair) => pair.previous === undefined || pair.current === undefined)) continue;
    const starting = pairs.reduce((sum, pair) => sum + pair.previous!, 0);
    if (starting <= 0) continue;
    const lost = pairs.reduce((sum, pair) => sum + Math.max(pair.previous! - pair.current!, 0), 0);
    const expansion = pairs.reduce((sum, pair) => sum + Math.max(pair.current! - pair.previous!, 0), 0);
    latest = Object.freeze({ period, grr: Math.max((starting - lost) / starting, 0), nrr: Math.max((starting - lost + expansion) / starting, 0) });
  }
  return latest;
}
function cash13w(records: readonly FounderControlRecordDto[], openingCash: number | null) {
  if (openingCash === null) return { complete: false, minClosingRub: null as number | null, gate: 'EVIDENCE' as FounderControlGate };
  const weeks = active(records, 'CASH_WEEK');
  let cash = openingCash;
  let minimum = openingCash;
  for (let week = 1; week <= 13; week += 1) {
    const row = weeks.find((record) => nullableNumber(record.payload.week) === week || record.recordKey === `week-${week}`);
    if (!row) return { complete: false, minClosingRub: null as number | null, gate: 'EVIDENCE' as FounderControlGate };
    const required = ['confirmedRecurringRub','launchPrepayRub','fundingDrawRub','corePayrollVendorsRub','clientVariableOnboardingRub','otherCommittedRub'] as const;
    if (required.some((key) => nullableNumber(row.payload[key]) === null)) return { complete: false, minClosingRub: null as number | null, gate: 'EVIDENCE' as FounderControlGate };
    const inflow = number(row.payload.confirmedRecurringRub) + number(row.payload.launchPrepayRub) + number(row.payload.fundingDrawRub);
    const outflow = number(row.payload.corePayrollVendorsRub) + number(row.payload.clientVariableOnboardingRub) + number(row.payload.otherCommittedRub);
    const start = isoMs(row.payload.weekStart);
    const taxDate = start === null ? new Date(COMMERCIAL_START.getTime() + (week - 1) * 7 * 86_400_000) : new Date(start);
    const taxRate = taxDate <= new Date(Date.UTC(2026,11,31,23,59,59,999)) ? A.usn2026Pct : A.usn2027Pct;
    const taxReserve = (number(row.payload.confirmedRecurringRub) + number(row.payload.launchPrepayRub)) * taxRate;
    cash += inflow - outflow - taxReserve;
    minimum = Math.min(minimum, cash);
  }
  const weeklyCoreReference = A.coreMonthlyRub / 4.33;
  const gate: FounderControlGate = minimum < 0 ? 'BLOCK' : minimum < weeklyCoreReference * 2 ? 'WATCH' : 'PASS';
  return { complete: true, minClosingRub: minimum, gate };
}

function hiringGate(input: Readonly<{
  mrrRub: number;
  proofGroups: number;
  runwayGate: FounderControlGate;
  workload: number | null;
  mrrFloor: number;
  proofFloor: number;
}>): FounderControlGate {
  if (input.workload === null || input.runwayGate === 'EVIDENCE') return 'EVIDENCE';
  return input.mrrRub >= input.mrrFloor && input.proofGroups >= input.proofFloor && input.runwayGate === 'PASS' && input.workload >= 0.85 ? 'READY' : 'HOLD';
}

function priorityHealth(status: FounderControlGate | FounderControlHealth): FounderControlHealth {
  if (status === 'PASS' || status === 'UNLOCKED' || status === 'READY' || status === 'GREEN') return 'GREEN';
  if (status === 'BLOCK' || status === 'RED') return 'RED';
  return 'YELLOW';
}

export function calculateFounderControlOverview(records: readonly FounderControlRecordDto[], now = new Date()): FounderControlOverview {
  const clients = active(records, 'CLIENT');
  const pipeline = active(records, 'PIPELINE_OPPORTUNITY');
  const invoices = active(records, 'AR_INVOICE');
  const activeClients = clients.filter((record) => text(record.payload.status) === 'ACTIVE');
  const activeAssisted = activeClients.filter((record) => text(record.payload.package) === 'Assisted').length;
  const activeSelf = activeClients.filter((record) => text(record.payload.package) === 'Self').length;
  const activeMrrRub = activeClients.reduce((sum, record) => sum + number(record.payload.mrrRub), 0);

  const proofGroups = new Set(clients.filter((record) => clientProofPass(record.payload)).map((record) => text(record.payload.controlGroupId)).filter(Boolean)).size;
  const groupMrr = new Map<string, number>();
  let missingGroup = false;
  for (const record of activeClients) {
    const group = text(record.payload.controlGroupId);
    if (!group) { missingGroup = true; continue; }
    groupMrr.set(group, (groupMrr.get(group) ?? 0) + number(record.payload.mrrRub));
  }
  const largestGroupShare = missingGroup || activeMrrRub === 0 ? null : Math.max(...groupMrr.values()) / activeMrrRub;

  const qualifiedOpen = pipeline.filter((record) => bool(record.payload.qualified) && text(record.payload.status) === 'OPEN');
  const weightedPipelineMrrRub = pipeline.filter((record) => text(record.payload.status) === 'OPEN').reduce((sum, record) => sum + number(record.payload.mrrRub) * (FOUNDER_CONTROL_PIPELINE_PROBABILITY[text(record.payload.stage)] ?? 0), 0);
  const won = pipeline.filter((record) => bool(record.payload.qualified) && text(record.payload.status) === 'WON').length;
  const lost = pipeline.filter((record) => bool(record.payload.qualified) && text(record.payload.status) === 'LOST').length;
  const observedWinRate = won + lost > 0 ? won / (won + lost) : null;

  let openArRub = 0; let overdueArRub = 0; let ar90Rub = 0; let paidWeight = 0; let paidDaysWeight = 0; let openAgeWeight = 0;
  for (const invoice of invoices) {
    const amount = number(invoice.payload.amountRub); const paid = number(invoice.payload.paidAmountRub); const open = Math.max(amount - paid, 0);
    openArRub += open;
    const due = isoMs(invoice.payload.dueDate); const issued = isoMs(invoice.payload.invoiceDate); const paidAt = isoMs(invoice.payload.paidDate);
    const paidEvidence = text(invoice.payload.paymentEvidenceRef);
    if (open > 0 && due !== null && due < now.getTime()) overdueArRub += open;
    if (open > 0 && issued !== null) {
      const age = Math.max((now.getTime() - issued) / 86_400_000, 0); openAgeWeight += open * age;
      if (age > 90) ar90Rub += open;
    }
    if (amount > 0 && paid >= amount && issued !== null && paidAt !== null && paidEvidence) {
      paidWeight += amount; paidDaysWeight += amount * Math.max((paidAt - issued) / 86_400_000, 0);
    }
  }
  const paidCollectionDays = paidWeight > 0 ? paidDaysWeight / paidWeight : null;
  const openArAgeDays = openArRub > 0 ? openAgeWeight / openArRub : null;

  const cashOnBankRub = inputValue(records, 'cashOnBankRub');
  const committedFundingRub = inputValue(records, 'committedFundingRub') ?? 0;
  const coreRunwayMonths = cashOnBankRub === null ? null : (cashOnBankRub + committedFundingRub) / A.coreMonthlyRub;
  const founderHours = inputValue(records, 'founderHours'); const engineerHours = inputValue(records, 'engineerHours'); const supportHours = inputValue(records, 'supportHours'); const infraMonthlyRub = inputValue(records, 'infraMonthlyRub');
  const cashProjection = cash13w(records, cashOnBankRub);

  const legalGate = evidenceGate(records, 'LEGAL_LIVE'); const taxGate = evidenceGate(records, 'TAX_2PCT'); const teamGate = evidenceGate(records, 'TEAM'); const infraEvidenceGate = evidenceGate(records, 'INFRA');
  const concentrationGate: FounderControlGate = largestGroupShare === null ? 'EVIDENCE' : largestGroupShare <= A.maxClientGroupConcentrationPct ? 'PASS' : 'BLOCK';
  const runwayGate: FounderControlGate = coreRunwayMonths === null ? 'EVIDENCE' : coreRunwayMonths >= A.runwayTargetMonths ? 'PASS' : 'BLOCK';
  const infraGate: FounderControlGate = infraMonthlyRub !== null && infraMonthlyRub > 0 && infraEvidenceGate === 'PASS' ? 'PASS' : 'EVIDENCE';

  const pnls = activeClients.map((record) => clientPnl(record.payload, now)).filter((value): value is Pnl => value !== null);
  const clientPnlMeasuredCount = pnls.length;
  const clientPnlBlockCount = pnls.filter((row) => row.contribution <= 0 || row.cm < A.minContributionMarginPct).length;
  const clientPnlContributionRub = pnls.reduce((sum, row) => sum + row.contribution, 0);
  const totalPnlRevenueApprox = pnls.reduce((sum, row) => sum + (row.cm !== 0 ? row.contribution / row.cm : 0), 0);
  const clientPnlCmPct = totalPnlRevenueApprox > 0 ? clientPnlContributionRub / totalPnlRevenueApprox : null;
  const infraAllocationRub = pnls.reduce((sum, row) => sum + row.infra, 0);
  const infraAllocationGate: FounderControlGate = activeClients.length === 0 || infraGate !== 'PASS' ? 'EVIDENCE' : Math.abs(infraAllocationRub - infraMonthlyRub!) <= Math.max(1_000, infraMonthlyRub! * 0.05) ? 'PASS' : 'BLOCK';

  const m6 = latestForecast(records, 6); const m12 = latestForecast(records, 12); const accuracy = forecastAccuracy(records); const close = dueCloseNotPass(records, now); const retention = retentionSnapshot(records, clients); const assumptionEvidenceMissing = assumptionEvidenceCount(records);
  const founderUtilization = founderHours === null ? null : founderHours / A.founderUsableHours;
  const engineerUtilization = engineerHours === null ? null : engineerHours / A.engineerUsableHours;
  const supportUtilization = supportHours === null ? null : supportHours / A.supportUsableHours;
  const hireDeveloper = hiringGate({ mrrRub:activeMrrRub, proofGroups, runwayGate, workload:engineerUtilization, mrrFloor:900_000, proofFloor:2 });
  const hireSales = hiringGate({ mrrRub:activeMrrRub, proofGroups, runwayGate, workload:founderUtilization === null ? null : Math.max(founderUtilization, qualifiedOpen.length / 5), mrrFloor:600_000, proofFloor:1 });
  const hireSupport = hiringGate({ mrrRub:activeMrrRub, proofGroups, runwayGate, workload:supportUtilization, mrrFloor:600_000, proofFloor:2 });
  const hireFinance = hiringGate({ mrrRub:activeMrrRub, proofGroups, runwayGate, workload:activeMrrRub / 1_200_000, mrrFloor:1_200_000, proofFloor:2 });
  const hireLegal = hiringGate({ mrrRub:activeMrrRub, proofGroups, runwayGate, workload:activeMrrRub / 900_000, mrrFloor:900_000, proofFloor:2 });
  const trancheBGate: FounderControlGate = proofGroups >= 2 && legalGate === 'PASS' && teamGate === 'PASS' && infraGate === 'PASS' && runwayGate === 'PASS' ? 'UNLOCKED' : 'LOCKED';

  const scaleGate: FounderControlGate = proofGroups >= BASE.proofGroupsRequired && legalGate === 'PASS' && teamGate === 'PASS' && activeAssisted >= BASE.scaleAssistedClients && activeSelf >= BASE.scaleSelfClients && BASE.scaleStressRub >= A.scaleStressFloorRub && runwayGate === 'PASS' && cashProjection.gate === 'PASS' && concentrationGate === 'PASS' && infraGate === 'PASS' ? 'UNLOCKED' : 'LOCKED';

  const alerts: FounderControlAlert[] = [];
  const add = (id: string, severity: 'P0' | 'P1', area: string, status: 'ALERT' | 'EVIDENCE', title: string, action: string) => alerts.push({ id, severity, area, status, title, action });
  if (cashOnBankRub === null) add('cash-evidence','P0','Cash','EVIDENCE','Нет подтверждённого остатка денег','Внести фактический остаток и сверить 13-недельный cash.'); else if (cashOnBankRub <= 0) add('cash-zero','P0','Cash','ALERT','Операционный cash не положительный','Закрыть кассовый разрыв до необязательных расходов.');
  if (coreRunwayMonths === null) add('runway-evidence','P0','Runway','EVIDENCE','Runway не доказан','Внести cash и только подтверждённое финансирование.'); else if (coreRunwayMonths < A.runwayTargetMonths) add('runway-low','P0','Runway','ALERT','Runway ниже 6 месяцев','Не открывать scale-spend; увеличить предоплату/финансирование или снизить burn.');
  if (cashProjection.gate === 'EVIDENCE') add('cash13w-evidence','P0','Cash','EVIDENCE','13-недельный cash не заполнен','Внести 13 недель подтверждённых inflow/outflow; пустое не считается нулём.'); else if (cashProjection.gate === 'BLOCK') add('cash13w-block','P0','Cash','ALERT','13-недельный cash уходит ниже нуля','Перенести/сократить обязательства или закрыть финансирование до расхода.');
  if (qualifiedOpen.length < 5) add('pipeline-low','P0','Sales','ALERT','Недостаточно qualified opportunities','Довести активную qualified-воронку минимум до 5 возможностей.');
  if (proofGroups < BASE.proofGroupsRequired) add('proof-low','P0','Commercial proof','ALERT','Коммерческое доказательство не закрыто','Получить 2 независимые proof-группы: prepay → use → repeat → ROI → measured cost.');
  if (legalGate !== 'PASS') add('legal-evidence','P0','Legal/live','EVIDENCE','Первый платный контур не доказан','Закрыть company/bank/signatory/live evidence.');
  if (overdueArRub > 0) add('ar-overdue','P0','AR','ALERT','Есть просроченная дебиторка','Собрать оплату или пересмотреть условия/приостановку сервиса.');
  if (m6.resultRub <= 0) add('forecast-m6-result','P0','Forecast','ALERT','M6 forecast теряет положительный recurring result','Пересобрать sales/cost план до расширения burn.');
  if (clientPnlBlockCount > 0) add('client-pnl-block','P0','Client economics','ALERT','Есть убыточная клиентская экономика','Пересчитать цену/scope и остановить субсидирование клиента.');
  if (close.blocked > 0) add('monthly-close-block','P0','Monthly close','ALERT','Есть заблокированный monthly close','Закрыть расхождение до использования месяца как факта.');
  if (taxGate !== 'PASS') add('tax-evidence','P1','Tax','EVIDENCE','2% УСН требует evidence','Подтвердить Тамбов, технопарк, ОКВЭД и ≥70% профильных доходов.');
  if (teamGate !== 'PASS') add('team-evidence','P1','Team','EVIDENCE','Нет доказанного delivery backup','Закрепить реального резервного исполнителя и зоны ответственности.');
  if (infraGate !== 'PASS') add('infra-evidence','P1','Infrastructure','EVIDENCE','Фактическая инфраструктурная стоимость не подтверждена','Внести сумму и verified invoice/contract evidence.');
  if (infraAllocationGate === 'BLOCK') add('infra-allocation','P1','Client economics','ALERT','Инфраструктура не сверена с Client P&L','Распределить фактическую infra cost между клиентами с отклонением ≤5%.');
  if (concentrationGate === 'BLOCK') add('concentration','P1','Concentration','ALERT','Концентрация одной группы выше 25%','Не масштабировать зависимость от одного холдинга.'); else if (concentrationGate === 'EVIDENCE' && activeClients.length > 0) add('concentration-evidence','P1','Concentration','EVIDENCE','Не хватает canonical Control Group ID','Заполнить группу контроля по каждому активному клиенту.');
  if (founderHours === null) add('founder-load','P1','Delivery','EVIDENCE','Загрузка основателя не измерена','Внести фактические часы месяца.'); else if (founderHours > A.founderUsableHours) add('founder-overload','P1','Delivery','ALERT','Основатель выше usable capacity','Снять нагрузку, не лечить перегрузку бесплатной переработкой.'); else if (founderHours > A.founderUsableHours * 0.85) add('founder-watch','P1','Delivery','ALERT','Основатель выше 85% usable capacity','Готовить делегирование только по Hiring Gate.');
  if (engineerHours === null) add('engineer-load','P1','Delivery','EVIDENCE','Загрузка инженера не измерена','Внести фактические часы месяца.'); else if (engineerHours > A.engineerUsableHours * 0.85) add('engineer-overload','P1','Delivery','ALERT','Инженерная загрузка выше 85%','Пересмотреть scope/подрядчика и открыть Hiring Gate только при прочих PASS.');
  if (supportHours === null) add('support-load','P1','Delivery','EVIDENCE','Загрузка поддержки не измерена','Внести фактические часы месяца.'); else if (supportHours > A.supportUsableHours * 0.85) add('support-overload','P1','Delivery','ALERT','Support загрузка выше 85%','Перераспределить scope или добавить оплачиваемую мощность.');
  if (paidCollectionDays !== null && paidCollectionDays > 30) add('dso','P1','Collections','ALERT','Средний срок получения оплаты выше 30 дней','Ужесточить terms или заложить стоимость оборотного капитала.');
  if (ar90Rub > 0) add('ar-90','P1','AR','ALERT','Есть дебиторка 90+ дней','Эскалировать взыскание и условия продолжения сервиса.');
  if (m6.mrrRub < BASE.m6MrrRub * 0.9) add('forecast-m6-mrr','P1','Forecast','ALERT','M6 MRR ниже 90% BASE','Изменить pipeline/cycle/offer до расширения расходов.');
  if (accuracy.lateApprovalCount > 0) add('forecast-backdate','P1','Forecast accuracy','ALERT','Есть forecast, утверждённый после начала периода','Не использовать его как доказательство точности прогноза.');
  else if (accuracy.avgMrrErrorPct !== null && accuracy.avgMrrErrorPct > 0.25) add('forecast-error','P1','Forecast accuracy','ALERT','Ошибка MRR forecast выше 25%','Перекалибровать assumptions и cadence.');
  if (activeClients.length > 0 && clientPnlMeasuredCount === 0) add('client-pnl-evidence','P1','Client economics','EVIDENCE','Client P&L ещё не измерен','Внести фактические revenue/hours/cost по клиентам.');
  if (close.due > 0) add('monthly-close-evidence','P1','Monthly close','EVIDENCE','Не все наступившие месяцы закрыты','Закрыть bank/AR/P&L/payroll/tax/evidence/cash/forecast checklist.');
  if (retention && (retention.grr < 0.9 || retention.nrr < 1)) add('retention','P1','Retention','ALERT','GRR/NRR ниже management target','Разобрать churn/contraction до масштабирования acquisition.');
  else if (activeClients.length > 0 && !retention) add('retention-evidence','P1','Retention','EVIDENCE','Retention ещё не измерен','Внести MRR клиента по завершённым периодам.');
  if (assumptionEvidenceMissing > 0) add('assumption-governance','P1','Governance','ALERT','Есть незавершённые изменения допущений','Заполнить impact/reason/approval/evidence.');
  if (scaleGate === 'LOCKED') add('scale-locked','P1','Scale','ALERT','Scale budget остаётся LOCKED','Не открывать growth/hiring до полного operating gate.');

  const forecastCloseHealth: FounderControlHealth = m6.resultRub <= 0 || close.blocked > 0 ? 'RED' : close.due > 0 || accuracy.measured === 0 || assumptionEvidenceMissing > 0 ? 'YELLOW' : 'GREEN';
  const clientHealth: FounderControlHealth = clientPnlBlockCount > 0 || infraAllocationGate === 'BLOCK' ? 'RED' : activeClients.length === 0 || clientPnlMeasuredCount < activeClients.length || infraAllocationGate !== 'PASS' ? 'YELLOW' : 'GREEN';
  const arHealth: FounderControlHealth = overdueArRub > 0 || ar90Rub > 0 ? 'RED' : activeClients.length > 0 && invoices.length === 0 ? 'YELLOW' : paidCollectionDays !== null && paidCollectionDays > 30 ? 'YELLOW' : 'GREEN';
  const dimensions: Array<[string, number, FounderControlHealth]> = [
    ['Cash / Runway',20,runwayGate === 'BLOCK' || cashProjection.gate === 'BLOCK' ? 'RED' : runwayGate !== 'PASS' || cashProjection.gate !== 'PASS' ? 'YELLOW' : 'GREEN'],
    ['Sales / Pipeline',15,qualifiedOpen.length === 0 ? 'RED' : qualifiedOpen.length < 5 || m6.mrrRub < BASE.m6MrrRub * .9 ? 'YELLOW' : 'GREEN'],
    ['Commercial Proof',20,proofGroups === 0 ? 'RED' : proofGroups < 2 ? 'YELLOW' : 'GREEN'],
    ['Client Economics',15,clientHealth],
    ['AR / Collections',10,arHealth],
    ['Delivery Capacity',5,founderHours === null || engineerHours === null || supportHours === null ? 'YELLOW' : founderHours > A.founderUsableHours || engineerHours > A.engineerUsableHours || supportHours > A.supportUsableHours ? 'RED' : founderHours > A.founderUsableHours*.85 || engineerHours > A.engineerUsableHours*.85 || supportHours > A.supportUsableHours*.85 ? 'YELLOW' : 'GREEN'],
    ['Legal / Tax / Infra',5,legalGate !== 'PASS' ? 'RED' : taxGate !== 'PASS' || infraGate !== 'PASS' ? 'YELLOW' : 'GREEN'],
    ['Team',5,teamGate === 'PASS' ? 'GREEN' : 'YELLOW'],
    ['Forecast / Close',5,forecastCloseHealth],
  ];
  const healthScore = dimensions.reduce((sum,[,weight,h]) => sum + weight * (h === 'GREEN' ? 1 : h === 'YELLOW' ? .6 : 0),0);
  const health: FounderControlHealth = dimensions.some(([, , h]) => h === 'RED') ? 'RED' : dimensions.some(([, , h]) => h === 'YELLOW') ? 'YELLOW' : 'GREEN';
  const limiter = dimensions.find(([, , h]) => h === 'RED')?.[0] ?? dimensions.find(([, , h]) => h === 'YELLOW')?.[0] ?? 'None';
  const counts = Object.fromEntries(FOUNDER_CONTROL_TYPES.map((type) => [type, active(records,type).length])) as Record<FounderControlRecordType,number>;

  const healthDimensions = Object.freeze(dimensions.map(([name,weight,status]) => Object.freeze({ name, weight, status, score: status === 'GREEN' ? 100 : status === 'YELLOW' ? 60 : 0 })));

  return Object.freeze({
    referenceVersion: FOUNDER_CONTROL_REFERENCE_VERSION,
    asOf: now.toISOString(), health, healthScore, primaryValueLimiter: limiter, healthDimensions,
    metrics: Object.freeze({
      activeAssisted,activeSelf,activeMrrRub,proofGroups,qualifiedOpenCount:qualifiedOpen.length,weightedPipelineMrrRub,observedWinRate,
      openArRub,overdueArRub,ar90Rub,paidCollectionDays,openArAgeDays,cashOnBankRub,committedFundingRub,coreRunwayMonths,cash13wMinClosingRub:cashProjection.minClosingRub,cash13wStatus:cashProjection.gate,largestGroupShare,
      founderHours,engineerHours,supportHours,founderUtilization,engineerUtilization,supportUtilization,infraMonthlyRub,clientPnlMeasuredCount,clientPnlBlockCount,clientPnlContributionRub,clientPnlCmPct,
      developerLoadedCostRub:A.developerLoadedCostRub,salesLoadedCostRub:A.salesLoadedCostRub,supportLoadedCostRub:A.supportLoadedCostRub,financeLoadedCostRub:A.financeLoadedCostRub,legalLoadedCostRub:A.legalLoadedCostRub,
      infraAllocationRub,m6LatestMrrRub:m6.mrrRub,m6LatestRecurringResultRub:m6.resultRub,m12LatestMrrRub:m12.mrrRub,m12LatestRecurringResultRub:m12.resultRub,
      forecastAccuracyMrrPct:accuracy.avgMrrErrorPct,forecastAccuracyMeasured:accuracy.measured,dueCloseNotPass:close.due,retentionGrr:retention?.grr ?? null,retentionNrr:retention?.nrr ?? null,
      assumptionEvidenceMissing,m6MrrPlanRub:BASE.m6MrrRub,m6RecurringResultPlanRub:BASE.m6RecurringResultRub,fundingPlusReservePlanRub:BASE.fundingPlusReserveRub,
      fundingWith30dCollectionsRub:BASE.fundingWith30dCollectionsRub,scaleStressRub:BASE.scaleStressRub,
    }),
    gates: Object.freeze({legalLive:legalGate,tax2pct:taxGate,team:teamGate,infra:infraGate,infraAllocation:infraAllocationGate,concentration:concentrationGate,runway:runwayGate,cash13w:cashProjection.gate,trancheB:trancheBGate,hireDeveloper,hireSales,hireSupport,hireFinance,hireLegal,scaleBudget:scaleGate}),
    alerts:Object.freeze(alerts),counts:Object.freeze(counts),workbookParity:FOUNDER_CONTROL_WORKBOOK_PARITY,
  });
}
