export type AcceptanceStage =
  | 'arrival_expected'
  | 'arrival_fixed'
  | 'gross_weight_fixed'
  | 'sampling_started'
  | 'quality_checked'
  | 'net_weight_fixed'
  | 'acceptance_signed'
  | 'documents_basis_ready';

export type AcceptanceFactStatus = 'ok' | 'review' | 'dispute';

export type AcceptanceEvidence = Readonly<{
  id: string;
  label: string;
  source: string;
  status: AcceptanceFactStatus;
  fixedAt: string;
}>;

export type AcceptanceQualityMetric = Readonly<{
  label: string;
  contractValue: string;
  actualValue: string;
  status: AcceptanceFactStatus;
}>;

/**
 * Type-only compatibility contract for historical presentation copy.
 * Runtime acceptance authority is owned by the canonical authenticated Deal
 * workspace and `apps/web/lib/deal-execution-server.ts`; this module must not
 * export local facts, labels, calculations, routes, or transition logic.
 */
export type DealAcceptanceState = Readonly<{
  dealId: string;
  routeId: string;
  lotNumber: string;
  sdizNumber: string;
  vehiclePlate: string;
  driverName: string;
  elevatorName: string;
  stage: AcceptanceStage;
  arrival: Readonly<{
    expectedWindow: string;
    fixedAt: string;
    geoPoint: string;
  }>;
  weight: Readonly<{
    grossKg: number;
    tareKg: number;
    netKg: number;
    contractKg: number;
    deltaKg: number;
  }>;
  quality: readonly AcceptanceQualityMetric[];
  evidence: readonly AcceptanceEvidence[];
  nextRoutes: ReadonlyArray<Readonly<{
    label: string;
    href: string;
    owner: string;
  }>>;
}>;
