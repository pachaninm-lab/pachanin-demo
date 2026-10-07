export const FOUNDER_CONTROL_SCHEMA_VERSION = 'pc-crop.founder-control.r1.3.v1' as const;

export const FounderHealthCategory = {
  BUSINESS: 'BUSINESS',
  OPERATIONS: 'OPERATIONS',
  FINANCE: 'FINANCE',
  RISK: 'RISK',
  SYSTEM: 'SYSTEM',
} as const;

export type FounderHealthCategory =
  typeof FounderHealthCategory[keyof typeof FounderHealthCategory];

export const FounderMetricId = {
  OPEN_DEALS: 'business.open_deals',
  ACTIVE_SHIPMENTS: 'operations.active_shipments',
  UNMATCHED_STATEMENTS: 'finance.unmatched_statement_entries',
  HIGH_CRITICAL_DISPUTES: 'risk.high_critical_open_disputes',
  OUTBOX_ATTENTION: 'system.outbox_attention_entries',
} as const;

export type FounderMetricId = typeof FounderMetricId[keyof typeof FounderMetricId];

export const FOUNDER_METRIC_DEFINITIONS: ReadonlyArray<Readonly<{
  id: FounderMetricId;
  category: FounderHealthCategory;
  unit: 'COUNT';
  sourceRelation: string;
  grain: string;
  definition: string;
}>> = [
  {
    id: FounderMetricId.OPEN_DEALS,
    category: FounderHealthCategory.BUSINESS,
    unit: 'COUNT',
    sourceRelation: 'public.deals',
    grain: 'platform-wide canonical Deal rows at query time',
    definition: 'Deals whose canonical status is not SETTLED, CLOSED, CANCELLATION or CANCELLED.',
  },
  {
    id: FounderMetricId.ACTIVE_SHIPMENTS,
    category: FounderHealthCategory.OPERATIONS,
    unit: 'COUNT',
    sourceRelation: 'public.shipments',
    grain: 'platform-wide canonical Shipment rows at query time',
    definition: 'Shipments not in DELIVERED, COMPLETED, CANCELLED, CLOSED or FAILED terminal states.',
  },
  {
    id: FounderMetricId.UNMATCHED_STATEMENTS,
    category: FounderHealthCategory.FINANCE,
    unit: 'COUNT',
    sourceRelation: 'public.bank_statement_entries',
    grain: 'platform-wide bank statement entries at query time',
    definition: 'Bank statement entries whose reconciliation match state is UNMATCHED or MISMATCH.',
  },
  {
    id: FounderMetricId.HIGH_CRITICAL_DISPUTES,
    category: FounderHealthCategory.RISK,
    unit: 'COUNT',
    sourceRelation: 'dispute.cases',
    grain: 'platform-wide canonical dispute cases at query time',
    definition: 'Unresolved canonical disputes with HIGH or CRITICAL severity.',
  },
  {
    id: FounderMetricId.OUTBOX_ATTENTION,
    category: FounderHealthCategory.SYSTEM,
    unit: 'COUNT',
    sourceRelation: 'public.outbox_entries',
    grain: 'platform-wide canonical durable outbox rows at query time',
    definition: 'Canonical durable outbox entries in DEAD_LETTER or MANUAL_REVIEW.',
  },
] as const;

export type FounderMetricRow = {
  metric_id: string;
  category: string;
  value_count: bigint;
  unit: string;
  as_of: Date;
  source_relation: string;
  freshness_state: string;
  grain: string;
  definition: string;
};

export type FounderMetricDrillDownRow = {
  metric_id: string;
  object_type: string;
  object_id: string;
  status: string;
  tenant_id: string | null;
  observed_at: Date;
  metadata: unknown;
};

export type FounderDecisionQueueRow = {
  item_id: string;
  object_type: string;
  object_id: string;
  object_version: string;
  priority: string;
  owner_kind: string;
  owner_id: string | null;
  deadline: Date;
  impact: unknown;
  next_action: string;
  escalation: string;
  source_relation: string;
  source_ref: string;
  as_of: Date;
  freshness_state: string;
};

export function isFounderMetricId(value: unknown): value is FounderMetricId {
  return typeof value === 'string'
    && Object.values(FounderMetricId).includes(value as FounderMetricId);
}
