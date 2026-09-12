export type FounderControlGate = 'PASS' | 'EVIDENCE' | 'BLOCK' | 'LOCKED' | 'UNLOCKED' | 'INFO' | 'WATCH' | 'READY' | 'HOLD';
export type FounderControlHealth = 'GREEN' | 'YELLOW' | 'RED';

export type FounderControlRecordType =
  | 'CEO_INPUT'
  | 'PIPELINE_OPPORTUNITY'
  | 'CLIENT'
  | 'CASH_WEEK'
  | 'AR_INVOICE'
  | 'FORECAST'
  | 'ACTUAL_PERIOD'
  | 'RETENTION_MRR'
  | 'EVIDENCE'
  | 'ASSUMPTION_CHANGE'
  | 'MONTHLY_CLOSE'
  | 'DECISION'
  | 'RESOURCE_ACTUAL';

export type FounderControlRecord = Readonly<{
  id: string;
  recordType: FounderControlRecordType;
  recordKey: string;
  payload: Record<string, unknown>;
  status: 'ACTIVE' | 'ARCHIVED';
  source: string;
  version: string;
  updatedAt: string;
}>;

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

export type FounderControlSpec = Readonly<{
  referenceVersion: string;
  referenceArtifact: Readonly<{ fileName: string; sizeBytes: number; sha256: string }>;
  assumptions: Readonly<Record<string, number>>;
  baseFinancials: Readonly<Record<string, number>>;
  basePlan: readonly Readonly<Record<string, number>>[];
  evidenceRequirements: Readonly<Record<string, readonly string[]>>;
  recordTypes: readonly FounderControlRecordType[];
  workbookParity: readonly { sheet: string; module: string }[];
}>;

export type FounderControlEvent = Readonly<{
  id: string;
  recordType: string;
  recordKey: string;
  action: string;
  resultStatus: string;
  reason: string;
  actorUserId: string;
  correlationId: string;
  aggregateVersion: string;
  createdAt: string;
  hash: string;
  prevHash: string | null;
}>;

export type FounderControlBundle = Readonly<{
  available: boolean;
  overview: FounderControlOverview | null;
  spec: FounderControlSpec | null;
  records: readonly FounderControlRecord[];
  events: readonly FounderControlEvent[];
  error?: string;
}>;
