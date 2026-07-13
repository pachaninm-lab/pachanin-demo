import type { RequestUser } from '../../common/types/request-user';

/** PostgreSQL-backed shipment data-access boundary used by production. */
export const SHIPMENT_REPOSITORY = 'SHIPMENT_REPOSITORY';

export type LogisticsCommand = Readonly<{
  commandId: string;
  idempotencyKey: string;
  expectedVersion: string;
  correlationId?: string;
}>;

export type RecordCheckpointCommand = LogisticsCommand & Readonly<{
  type: string;
  occurredAt: string;
  lat?: number;
  lng?: number;
  note?: string;
}>;

export type RecordGpsCommand = LogisticsCommand & Readonly<{
  lat: number;
  lng: number;
  speedKmh?: number;
  headingDeg?: number;
  accuracyM?: number;
  recordedAt: string;
}>;

export type VerifyPinCommand = LogisticsCommand & Readonly<{
  pin: string;
}>;

export type ShipmentRecord = Readonly<{
  id: string;
  dealId: string;
  tenantId: string;
  status: string;
  driverUserId: string | null;
  driverName: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
  carrierOrgId: string | null;
  carrierName: string | null;
  routeFrom: string | null;
  routeTo: string | null;
  etaHours: number | null;
  loadedTons: number | null;
  pinVerified: boolean;
  driverPinHash: string | null;
  pinVerifiedAt: Date | null;
  pinVerifiedByUserId: string | null;
  pinFailedAttempts: number;
  pinLockedUntil: Date | null;
  version: bigint;
  nextAction: string | null;
  blockers: string | null;
  geoLat: number | null;
  geoLng: number | null;
  lastGeoAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ShipmentCheckpointRecord = Readonly<{
  id: string;
  shipmentId: string;
  tenantId: string;
  type: string;
  completedAt: Date | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  photoUrl: string | null;
  actorId: string | null;
  commandId: string | null;
  idempotencyKey: string | null;
  correlationId: string | null;
  createdAt: Date;
}>;

export type ShipmentGpsPointRecord = Readonly<{
  id: string;
  shipmentId: string;
  tenantId: string;
  actorUserId: string;
  lat: number;
  lng: number;
  speedKmh: number | null;
  headingDeg: number | null;
  accuracyM: number | null;
  recordedAt: Date;
  commandId: string;
  idempotencyKey: string;
  correlationId: string | null;
  createdAt: Date;
}>;

export type ShipmentWorkspace = Readonly<{
  shipment: ShipmentRecord;
  checkpoints: ShipmentCheckpointRecord[];
  gpsTrack: ShipmentGpsPointRecord[];
}>;

export type ShipmentMutationResult = Readonly<{
  shipment: ShipmentRecord;
  auditId: string;
  outboxId: string;
  duplicate: boolean;
  checkpoint?: ShipmentCheckpointRecord;
  gpsPoint?: ShipmentGpsPointRecord;
  valid?: boolean;
}>;

export interface ShipmentRepository {
  list(user: RequestUser): Promise<ShipmentRecord[]>;
  getById(id: string, user: RequestUser): Promise<ShipmentRecord>;
  workspace(id: string, user: RequestUser): Promise<ShipmentWorkspace>;
  recordCheckpoint(
    id: string,
    command: RecordCheckpointCommand,
    user: RequestUser,
  ): Promise<ShipmentMutationResult>;
  recordGps(
    id: string,
    command: RecordGpsCommand,
    user: RequestUser,
  ): Promise<ShipmentMutationResult>;
  getGpsTrack(id: string, user: RequestUser): Promise<ShipmentGpsPointRecord[]>;
  verifyPin(
    id: string,
    command: VerifyPinCommand,
    user: RequestUser,
  ): Promise<ShipmentMutationResult>;
}
