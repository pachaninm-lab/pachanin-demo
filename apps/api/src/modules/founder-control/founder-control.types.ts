export const FOUNDER_CONTROL_RECORD_TYPES = [
  'CEO_INPUT',
  'PIPELINE_OPPORTUNITY',
  'CLIENT',
  'CASH_WEEK',
  'AR_INVOICE',
  'FORECAST',
  'ACTUAL_PERIOD',
  'RETENTION_MRR',
  'EVIDENCE',
  'ASSUMPTION_CHANGE',
  'MONTHLY_CLOSE',
  'DECISION',
  'RESOURCE_ACTUAL',
] as const;

export type FounderControlRecordType = (typeof FOUNDER_CONTROL_RECORD_TYPES)[number];
export type FounderControlStatus = 'ACTIVE' | 'ARCHIVED';

export type FounderControlRecordDto = Readonly<{
  id: string;
  recordType: FounderControlRecordType;
  recordKey: string;
  payload: Record<string, unknown>;
  status: FounderControlStatus;
  source: string;
  version: string;
  updatedAt: string;
}>;

export type FounderControlMutationCommand = Readonly<{
  recordType: FounderControlRecordType;
  recordKey: string;
  payload: Record<string, unknown>;
  status: FounderControlStatus;
  source: string;
  reason: string;
  expectedVersion: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type FounderControlHealth = 'GREEN' | 'YELLOW' | 'RED';
export type FounderControlGate = 'PASS' | 'EVIDENCE' | 'BLOCK' | 'LOCKED' | 'UNLOCKED' | 'INFO' | 'WATCH' | 'READY' | 'HOLD';

export type FounderControlAlert = Readonly<{
  id: string;
  severity: 'P0' | 'P1';
  area: string;
  status: 'ALERT' | 'EVIDENCE';
  title: string;
  action: string;
}>;

export type FounderControlOverview = Readonly<{
  referenceVersion: string;
  asOf: string;
  health: FounderControlHealth;
  healthScore: number;
  primaryValueLimiter: string;
  healthDimensions: readonly Readonly<{ name: string; weight: number; status: FounderControlHealth; score: number }>[];
  metrics: Record<string, number | string | null>;
  gates: Record<string, FounderControlGate>;
  alerts: readonly FounderControlAlert[];
  counts: Record<FounderControlRecordType, number>;
  workbookParity: readonly { sheet: string; module: string }[];
}>;
