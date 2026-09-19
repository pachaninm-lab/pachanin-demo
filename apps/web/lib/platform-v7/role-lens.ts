import type { PlatformRole } from '@/stores/usePlatformV7RStore';

/**
 * Atoms: named data points in the platform.
 * Each role has explicit visibility for each atom.
 * This is the single source of truth for "who sees what".
 */
export type DataAtom =
  | 'deal_reserve_amount'
  | 'deal_release_amount'
  | 'deal_hold_amount'
  | 'deal_price_per_ton'
  | 'deal_total_amount'
  | 'deal_counterparty_name'
  | 'deal_risk_score'
  | 'deal_dispute_id'
  | 'logistics_route'
  | 'logistics_driver_name'
  | 'logistics_gps'
  | 'quality_protocol'
  | 'quality_gost_params'
  | 'fgis_sdiz'
  | 'bank_decision'
  | 'bank_release_basis'
  | 'dispute_evidence'
  | 'dispute_decision'
  | 'compliance_audit_log'
  | 'executive_portfolio_summary';

type RoleLensRow = Record<DataAtom, boolean>;

const ALL_ATOMS: DataAtom[] = [
  'deal_reserve_amount', 'deal_release_amount', 'deal_hold_amount',
  'deal_price_per_ton', 'deal_total_amount', 'deal_counterparty_name',
  'deal_risk_score', 'deal_dispute_id',
  'logistics_route', 'logistics_driver_name', 'logistics_gps',
  'quality_protocol', 'quality_gost_params',
  'fgis_sdiz', 'bank_decision', 'bank_release_basis',
  'dispute_evidence', 'dispute_decision',
  'compliance_audit_log', 'executive_portfolio_summary',
];

function row(visible: DataAtom[]): RoleLensRow {
  const set = new Set(visible);
  return Object.fromEntries(ALL_ATOMS.map((a) => [a, set.has(a)])) as RoleLensRow;
}

export const ROLE_LENS: Record<PlatformRole, RoleLensRow> = {
  operator: row(ALL_ATOMS),

  executive: row([
    'deal_reserve_amount', 'deal_release_amount', 'deal_hold_amount',
    'deal_price_per_ton', 'deal_total_amount', 'deal_risk_score',
    'deal_dispute_id', 'executive_portfolio_summary',
    'fgis_sdiz', 'bank_decision',
  ]),

  buyer: row([
    'deal_price_per_ton', 'deal_total_amount', 'deal_reserve_amount',
    'deal_hold_amount', 'deal_dispute_id',
    'logistics_route', 'quality_protocol',
    'fgis_sdiz', 'bank_decision', 'bank_release_basis',
  ]),

  seller: row([
    'deal_price_per_ton', 'deal_total_amount', 'deal_reserve_amount',
    'deal_release_amount', 'deal_hold_amount',
    'logistics_route', 'quality_protocol', 'quality_gost_params',
    'fgis_sdiz', 'bank_release_basis',
  ]),

  logistics: row([
    'logistics_route', 'logistics_driver_name', 'logistics_gps',
    'deal_counterparty_name',
  ]),

  driver: row([
    'logistics_route', 'logistics_gps',
  ]),

  surveyor: row([
    'logistics_route', 'logistics_gps',
    'quality_gost_params', 'dispute_evidence',
  ]),

  elevator: row([
    'logistics_route', 'logistics_driver_name',
    'quality_gost_params', 'fgis_sdiz',
  ]),

  lab: row([
    'quality_protocol', 'quality_gost_params',
  ]),

  bank: row([
    'deal_reserve_amount', 'deal_release_amount', 'deal_hold_amount',
    'deal_total_amount', 'deal_dispute_id',
    'bank_decision', 'bank_release_basis',
    'fgis_sdiz', 'quality_protocol',
  ]),

  arbitrator: row([
    'deal_reserve_amount', 'deal_hold_amount',
    'deal_dispute_id', 'dispute_evidence', 'dispute_decision',
    'quality_protocol', 'logistics_route',
  ]),

  compliance: row([
    'fgis_sdiz', 'compliance_audit_log',
    'deal_risk_score', 'deal_dispute_id',
    'bank_decision', 'dispute_decision',
  ]),
};

/** Returns true if the given role can see the given atom. */
export function canSee(role: PlatformRole, atom: DataAtom): boolean {
  return ROLE_LENS[role]?.[atom] ?? false;
}

/** Returns all atoms visible to a role. */
export function visibleAtoms(role: PlatformRole): DataAtom[] {
  const lens = ROLE_LENS[role];
  if (!lens) return [];
  return ALL_ATOMS.filter((a) => lens[a]);
}
