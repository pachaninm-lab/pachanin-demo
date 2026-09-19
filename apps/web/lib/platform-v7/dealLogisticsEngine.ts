export type DealLogisticsStage =
  | 'deal_basis'
  | 'route_planning'
  | 'carrier_admission'
  | 'vehicle_assigned'
  | 'loading_window'
  | 'in_transit'
  | 'arrival'
  | 'acceptance'
  | 'documents_ready';

export type DealRoutePoint = Readonly<{
  label: string;
  address: string;
  window: string;
  owner: string;
}>;

export type DealVehicle = Readonly<{
  plate: string;
  driverName: string;
  driverPhoneMasked: string;
  carrierName: string;
  capacityTons: number;
  admission: 'ok' | 'review' | 'blocked';
}>;

/**
 * Type-only compatibility contract for historical presentation copy.
 * Runtime logistics authority is owned by authenticated server endpoints and
 * `apps/web/lib/logistics-server.ts`; this module must never export fixtures,
 * labels derived from local state, or transition logic.
 */
export type DealLogisticsState = Readonly<{
  dealId: string;
  stage: DealLogisticsStage;
  lotNumber: string;
  sdizNumber: string;
  sellerName: string;
  buyerName: string;
  volumeTons: number;
  basis: string;
  route: readonly DealRoutePoint[];
  vehicle: DealVehicle;
  controls: ReadonlyArray<Readonly<{
    label: string;
    owner: string;
    status: 'ok' | 'review' | 'block';
  }>>;
  nextRoutes: ReadonlyArray<Readonly<{
    label: string;
    href: string;
    owner: string;
  }>>;
}>;
