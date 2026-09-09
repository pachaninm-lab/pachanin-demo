import type { FounderControlRecordType } from './founder-control.types';

export const FOUNDER_CONTROL_REFERENCE_VERSION = 'v11.2';

export const FOUNDER_CONTROL_REFERENCE_ARTIFACT = Object.freeze({
  fileName: 'Prozrachnaya_Cena_v11_2_CEO_Control_Center_MAX.xlsx',
  sizeBytes: 409684,
  sha256: '388a86ce5ddad3cee7d2322af2dab6bec7166b4dcbd4efa83bc8e57021b79256',
});


export const FOUNDER_CONTROL_ASSUMPTIONS = Object.freeze({
  assistedMonthlyFeeRub: 120_000,
  selfMonthlyFeeRub: 60_000,
  assistedLaunchFeeRub: 180_000,
  selfLaunchFeeRub: 90_000,
  launchPrepayPct: 0.70,
  recurringPrepayPct: 1,
  creditsReservePct: 0.02,
  channelCommissionPct: 0.05,
  minContributionMarginPct: 0.68,
  minClientBenefitMultiple: 2.5,
  maxClientLaunchPaybackMonths: 3,
  usn2026Pct: 0.02,
  usn2027Pct: 0.06,
  vatThresholdRub: 20_000_000,
  maxClientGroupConcentrationPct: 0.25,
  cashReserveMonths: 2,
  scaleStressFloorRub: 100_000,
  founderUsableHours: 136,
  engineerUsableHours: 119,
  supportUsableHours: 136,
  supportPlanningRateRub: 800,
  engineerPlanningRateRub: 2_000,
  assistedExpectedLaunchCostRub: 95_000,
  selfExpectedLaunchCostRub: 45_000,
  coreMonthlyRub: 316_300,
  runwayTargetMonths: 6,
  developerLoadedCostRub: 260_000,
  salesLoadedCostRub: 156_000,
  supportLoadedCostRub: 117_000,
  financeLoadedCostRub: 117_000,
  legalLoadedCostRub: 80_000,
});

export const FOUNDER_CONTROL_EVIDENCE_REQUIREMENTS = Object.freeze({
  LEGAL_LIVE: Object.freeze([
    'COMPANY_REGISTRATION',
    'BANK_SIGNATORY',
    'PAID_JOURNEY',
    'INVOICE_SUPPORT_PROCESS',
  ]),
  TAX_2PCT: Object.freeze([
    'TAMBOV_REGISTRATION',
    'TECHNOPARK_RESIDENT',
    'QUALIFYING_ACTIVITY',
    'PROFILE_REVENUE_70',
  ]),
  TEAM: Object.freeze([
    'DELIVERY_BACKUP_AGREEMENT',
    'RESPONSIBILITY_HANDOVER',
  ]),
  INFRA: Object.freeze([
    'CURRENT_INFRA_INVOICES',
  ]),
});

export const FOUNDER_CONTROL_BASE_PLAN = Object.freeze([
  { period: 1, activeAssisted: 0, activeSelf: 0, mrrRub: 0, recurringResultRub: -316_300 },
  { period: 2, activeAssisted: 1, activeSelf: 0, mrrRub: 120_000, recurringResultRub: -234_980 },
  { period: 3, activeAssisted: 2, activeSelf: 0, mrrRub: 240_000, recurringResultRub: -153_660 },
  { period: 4, activeAssisted: 3, activeSelf: 0, mrrRub: 360_000, recurringResultRub: -72_340 },
  { period: 5, activeAssisted: 4, activeSelf: 1, mrrRub: 540_000, recurringResultRub: 30_940 },
  { period: 6, activeAssisted: 4, activeSelf: 2, mrrRub: 600_000, recurringResultRub: 72_100 },
  { period: 7, activeAssisted: 5, activeSelf: 2, mrrRub: 720_000, recurringResultRub: 148_620 },
  { period: 8, activeAssisted: 5, activeSelf: 3, mrrRub: 780_000, recurringResultRub: 139_780 },
  { period: 9, activeAssisted: 6, activeSelf: 3, mrrRub: 900_000, recurringResultRub: 216_300 },
  { period: 10, activeAssisted: 6, activeSelf: 4, mrrRub: 960_000, recurringResultRub: 257_460 },
  { period: 11, activeAssisted: 7, activeSelf: 5, mrrRub: 1_140_000, recurringResultRub: 375_140 },
  { period: 12, activeAssisted: 8, activeSelf: 6, mrrRub: 1_320_000, recurringResultRub: 492_820 },
]);

export const FOUNDER_CONTROL_BASE_FINANCIALS = Object.freeze({
  m6MrrRub: 600_000,
  m6RecurringResultRub: 72_100,
  peakCashGapRub: 1_045_060,
  fundingPlusReserveRub: 1_677_660,
  fundingWith30dCollectionsRub: 2_089_240,
  scaleStressRub: 111_880,
  scaleAssistedClients: 7,
  scaleSelfClients: 2,
  proofGroupsRequired: 2,
});

export const FOUNDER_CONTROL_PIPELINE_PROBABILITY: Readonly<Record<string, number>> = Object.freeze({
  NEW: 0.05,
  DISCOVERY: 0.15,
  QUALIFIED: 0.25,
  DEMO: 0.35,
  PROPOSAL: 0.50,
  NEGOTIATION: 0.70,
  VERBAL: 0.90,
  WON: 1,
  LOST: 0,
});

export const FOUNDER_CONTROL_WORKBOOK_PARITY = Object.freeze([
  ['Допущения', 'Reference / assumptions'],
  ['Unit economics', 'Clients / contract gate'],
  ['Портфель 12М', 'Forecast / base plan'],
  ['Стрессы', 'Company Health / scale gate'],
  ['Коммерческий gate', 'Clients / first-revenue gate'],
  ['Роли и UX', 'Reference / product boundary'],
  ['Ресурсы', 'Resources / hiring gate'],
  ['Факты клиентов', 'Clients / commercial proof'],
  ['Экосистема 100', 'System Audit / control design'],
  ['Деньги 13н', 'Cash 13W'],
  ['Источники', 'Evidence / reference sources'],
  ['Решение', 'CEO Control'],
  ['Налоговый gate', 'Evidence / tax'],
  ['Инвестор', 'Investor / capital'],
  ['Транши и капитал', 'Investor / capital'],
  ['DD инвестора', 'Evidence / investor diligence'],
  ['Стадия проекта', 'CEO Control / stage'],
  ['Сценарии стадии', 'Forecast / scenarios'],
  ['Инвестор fit', 'Investor / fit'],
  ['Продажи и CAC', 'Sales / pipeline'],
  ['Итог РФ', 'CEO Control / RF summary'],
  ['Справочники', 'Reference / dictionaries'],
  ['Pipeline', 'Sales / pipeline'],
  ['Клиенты', 'Clients / economics'],
  ['Cash 13W', 'Cash / runway'],
  ['Вводы CEO', 'CEO inputs'],
  ['Plan vs Actual', 'Forecast / actuals'],
  ['Hiring Gate', 'Resources / hiring'],
  ['Investor Gates', 'Investor / milestones'],
  ['Decision Log', 'Governance / decisions'],
  ['CEO Control', 'CEO Control'],
  ['Evidence Register', 'Evidence'],
  ['System Audit', 'System Audit'],
  ['Rolling Forecast', 'Forecast'],
  ['Forecast Accuracy', 'Forecast / accuracy'],
  ['AR DSO', 'Cash / receivables'],
  ['Client P&L', 'Clients / P&L'],
  ['Monthly Close', 'Governance / monthly close'],
  ['Retention', 'Clients / retention'],
  ['Assumption Log', 'Governance / assumptions'],
  ['Management Alerts', 'CEO Control / alerts'],
  ['Company Health', 'CEO Control / health'],
].map(([sheet, module]) => Object.freeze({ sheet, module })));

export const FOUNDER_CONTROL_TYPES: readonly FounderControlRecordType[] = Object.freeze([
  'CEO_INPUT', 'PIPELINE_OPPORTUNITY', 'CLIENT', 'CASH_WEEK', 'AR_INVOICE', 'FORECAST',
  'ACTUAL_PERIOD', 'RETENTION_MRR', 'EVIDENCE', 'ASSUMPTION_CHANGE', 'MONTHLY_CLOSE',
  'DECISION', 'RESOURCE_ACTUAL',
]);
