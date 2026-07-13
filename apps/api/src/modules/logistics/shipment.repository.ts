import type { Checkpoint, Shipment, ShipmentGpsPoint } from '@prisma/client';
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

export type ShipmentWorkspace = Readonly<{
  shipment: Shipment;
  checkpoints: Checkpoint[];
  gpsTrack: ShipmentGpsPoint[];
}>;

export type ShipmentMutationResult = Readonly<{
  shipment: Shipment;
  auditId: string;
  outboxId: string;
  duplicate: boolean;
  checkpoint?: Checkpoint;
  gpsPoint?: ShipmentGpsPoint;
  valid?: boolean;
}>;

export interface ShipmentRepository {
  list(user: RequestUser): Promise<Shipment[]>;
  getById(id: string, user: RequestUser): Promise<Shipment>;
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
  getGpsTrack(id: string, user: RequestUser): Promise<ShipmentGpsPoint[]>;
  verifyPin(
    id: string,
    command: VerifyPinCommand,
    user: RequestUser,
  ): Promise<ShipmentMutationResult>;
}
